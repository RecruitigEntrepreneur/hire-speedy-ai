// deno-lint-ignore-file no-explicit-any
// Arbeitsvertrag und Unterschrift (Paket 3, 22.10.2026). Die Functions
// employment-contract, employment-docusign-webhook und contract-followups
// dispatchen hierher.
//
// Zwei Wege nach der Zusage:
//  - digital: Kunde lädt seinen Vertrag hoch, wir hängen eine Unterschriftenseite
//    an, DocuSign: erst die Firma, dann der Kandidat. Abgeschlossen = verbindlich.
//  - selbst: Kunde schickt selbst. Melden darf jede Seite. Kunde: sofort
//    unterschrieben, 24 h rückgängig, Headhunter macht die Gegenprobe.
//    Headhunter oder Matchunt: Kunde bestätigt (Matchunt mit Beleg direkt).
// Ohne Meldung: Tag 7 Kunde, Tag 10 Headhunter, Tag 21 Matchunt.
// „Verbindlich“ (final) ist der Punkt, an dem Paket 4 Einstellung und Rechnung anlegt.
import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { encodeBase64, decodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { canUserActOnJob } from './team-access.ts';
import { dbFail, must, type ServiceCtx } from './interview-service.ts';
import * as mails from './contract-mails.ts';
import { accessToken, completedDocument, createEnvelope, docusignConfig, envelopeStatus } from './docusign.ts';
import { employmentConnect } from './recruiter-connect.ts';

const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const UNDO_HOURS = 24;
export const MAX_PDF_BYTES = 8 * 1024 * 1024;
const OPEN = ['preparing', 'sent_self', 'sent_digital', 'company_signed', 'reported'];
const DIGITAL_RUNNING = ['sent_digital', 'company_signed'];
const DAY_MS = 86_400_000;
const BUCKET = 'employment-contracts';

// ---------------------------------------------------------------------------
// Anschlüsse: DocuSign und Dateiablage (in Tests ersetzt)
// ---------------------------------------------------------------------------

export interface SignerSnapshot {
  status: string;
  signers: { recipientId: string; status: string; signedDateTime?: string; declinedDateTime?: string; declinedReason?: string }[];
}

export interface SignPort {
  send(args: { subject: string; blurb: string; documents: { base64: string; name: string }[]; company: { name: string; email: string }; candidate: { name: string; email: string }; contractId: string }): Promise<{ envelopeId: string }>;
  void(envelopeId: string, reason: string): Promise<void>;
  /** null = Stand unbekannt (Testmodus) */
  status(envelopeId: string): Promise<SignerSnapshot | null>;
  document(envelopeId: string): Promise<Uint8Array | null>;
}

export interface FilePort {
  put(path: string, bytes: Uint8Array): Promise<void>;
  get(path: string): Promise<Uint8Array | null>;
  url(path: string, seconds: number): Promise<string | null>;
}

export interface ContractCtx extends ServiceCtx {
  sign: SignPort | null;
  files: FilePort;
  /** DocuSign im Demo-Betrieb: Umschläge sind nicht rechtsverbindlich */
  signDemo?: boolean;
}

/** Echtes DocuSign; lokal (Supabase nicht https) mit DOCUSIGN_FAKE=1 ein Testmodus ohne DocuSign. */
export function signPort(env = (k: string) => Deno.env.get(k)): SignPort | null {
  const url = env('SUPABASE_URL') ?? '';
  const local = /^http:\/\/(kong|localhost|127\.0\.0\.1|host\.docker\.internal)(:\d+)?\/?$/.test(url);
  if (local && env('DOCUSIGN_FAKE') === '1') {
    return {
      send: async () => ({ envelopeId: `fake-${crypto.randomUUID()}` }),
      void: async () => {},
      status: async () => null,
      document: async () => null,
    };
  }
  const cfg = docusignConfig();
  if (!cfg) return null;
  return {
    send: async (a) => {
      const r = await createEnvelope(cfg, {
        subject: a.subject,
        blurb: a.blurb,
        documents: a.documents,
        signers: [
          { name: a.company.name, email: a.company.email, anchor: '/mh_ag/', routingOrder: 1, recipientId: '1' },
          { name: a.candidate.name, email: a.candidate.email, anchor: '/mh_an/', routingOrder: 2, recipientId: '2' },
        ],
        customFields: { matchunt_employment_contract: a.contractId },
        eventNotification: employmentConnect(env),
      });
      return { envelopeId: r.envelopeId };
    },
    void: async (envelopeId, reason) => {
      const token = await accessToken(cfg);
      const res = await fetch(`${cfg.apiBase}/v2.1/accounts/${cfg.accountId}/envelopes/${envelopeId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'voided', voidedReason: reason.slice(0, 200) }),
      });
      if (!res.ok && res.status !== 400) throw new Error(`Umschlag konnte nicht zurückgezogen werden (${res.status}).`);
    },
    status: async (envelopeId) => {
      const r = await envelopeStatus(cfg, envelopeId);
      return { status: r.status, signers: (r.recipients?.signers ?? []) as SignerSnapshot['signers'] };
    },
    document: async (envelopeId) => await completedDocument(cfg, envelopeId),
  };
}

export function filePort(db: SupabaseClient): FilePort {
  let ready = false;
  const ensure = async () => {
    if (ready) return;
    const { data } = await db.storage.getBucket(BUCKET);
    if (!data) await db.storage.createBucket(BUCKET, { public: false });
    ready = true;
  };
  return {
    put: async (path, bytes) => {
      await ensure();
      const { error } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: 'application/pdf', upsert: true });
      if (error) throw new Error(`Datei konnte nicht gespeichert werden: ${error.message}`);
    },
    get: async (path) => {
      const { data } = await db.storage.from(BUCKET).download(path);
      return data ? new Uint8Array(await data.arrayBuffer()) : null;
    },
    url: async (path, seconds) => {
      const { data } = await db.storage.from(BUCKET).createSignedUrl(path, seconds);
      return data?.signedUrl ?? null;
    },
  };
}

export function contractCtx(base: ServiceCtx): ContractCtx {
  const sign = signPort();
  const demo = Deno.env.get('DOCUSIGN_FAKE') === '1' || (Deno.env.get('DOCUSIGN_API_BASE') ?? 'https://demo.docusign.net/restapi').includes('demo.docusign');
  return { ...base, sign, files: filePort(base.db), signDemo: !!sign && demo };
}

// ---------------------------------------------------------------------------
// Laden und Rechte
// ---------------------------------------------------------------------------

type Role = 'client' | 'recruiter' | 'admin';

interface Bundle {
  submission: any; job: any; candidate: any;
  recruiter: { name: string; email: string | null } | null;
  offer: any | null;
  contract: any | null;
}

const firstName = (full: string | null | undefined) => (full ? full.trim().split(/\s+/)[0] : 'Der Kandidat');
const companyFor = (b: Bundle) => (b.submission.company_revealed ? b.job.company_name : (b.job.industry ? `${b.job.industry}-Unternehmen` : 'Unternehmen'));
const todayKey = (now: number) => new Date(now).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
const text = (v: unknown, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown) => (v == null || v === '' ? null : Math.round(Number(String(v).replace(/[^\d]/g, ''))) || null);

async function profile(db: SupabaseClient, userId: string | null | undefined) {
  if (!userId) return null;
  const { data } = await db.from('profiles').select('full_name, email').eq('user_id', userId).maybeSingle();
  return data ? { name: (data as any).full_name ?? '', email: (data as any).email ?? null } : null;
}

async function isAdmin(db: SupabaseClient, userId: string) {
  const { data } = await db.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
  return !!data;
}

async function loadBundle(db: SupabaseClient, submissionId: unknown): Promise<Bundle> {
  must(typeof submissionId === 'string' && UUID.test(submissionId), 'Ungültige Bewerbung.');
  const { data: submission, error } = await db.from('submissions')
    .select('id, job_id, candidate_id, recruiter_id, identity_unlocked, company_revealed, stage, status').eq('id', submissionId).maybeSingle();
  dbFail(error, 'Die Bewerbung');
  must(submission, 'Bewerbung nicht gefunden.', 'not_found');
  const [{ data: job }, { data: candidate }, { data: offers }, { data: contracts }] = await Promise.all([
    db.from('jobs').select('id, title, company_name, industry, client_id, location, remote_type, onsite_days_required, benefits, fee_percentage, mandate_id').eq('id', (submission as any).job_id).maybeSingle(),
    db.from('candidates').select('id, full_name, email, phone').eq('id', (submission as any).candidate_id).maybeSingle(),
    db.from('offers').select('*').eq('submission_id', submissionId).eq('status', 'accepted').order('created_at', { ascending: false }).limit(1),
    db.from('employment_contracts').select('*').eq('submission_id', submissionId).order('created_at', { ascending: false }).limit(1),
  ]);
  must(job, 'Stelle nicht gefunden.', 'not_found');
  return {
    submission, job,
    candidate: candidate ?? { id: (submission as any).candidate_id, full_name: 'Kandidat', email: null },
    recruiter: await profile(db, (submission as any).recruiter_id),
    offer: (offers ?? [])[0] ?? null,
    contract: (contracts ?? [])[0] ?? null,
  };
}

async function roleOf(ctx: ContractCtx, user: User, b: Bundle): Promise<Role | null> {
  if (b.submission.recruiter_id === user.id) return 'recruiter';
  if (await canUserActOnJob(ctx.db, user.id, b.job.id)) return (await isAdmin(ctx.db, user.id)) ? 'admin' : 'client';
  return (await isAdmin(ctx.db, user.id)) ? 'admin' : null;
}

async function access(ctx: ContractCtx, user: User, submissionId: unknown, allowed: Role[]) {
  const b = await loadBundle(ctx.db, submissionId);
  const role = await roleOf(ctx, user, b);
  must(role && allowed.includes(role), 'Dafür fehlt Ihnen die Berechtigung.', 'not_allowed');
  return { b, role: role as Role };
}

/** Kundenseite: wer das Angebot gemacht hat und wer die Stelle angelegt hat. */
const clientRecipients = (b: Bundle) => [...new Set([b.offer?.created_by, b.job.client_id].filter(Boolean))] as string[];

async function adminIds(db: SupabaseClient): Promise<string[]> {
  const { data } = await db.from('user_roles').select('user_id').eq('role', 'admin');
  return ((data ?? []) as any[]).map((r) => r.user_id);
}

async function notify(ctx: ContractCtx, userId: string | null | undefined, type: string, title: string, message: string, relatedType: string, relatedId: string) {
  if (!userId) return;
  const { error } = await ctx.db.from('notifications').insert({ user_id: userId, type, title, message, related_type: relatedType, related_id: relatedId });
  if (error) console.warn('[contract] Benachrichtigung nicht gespeichert', error.code, error.message);
}

async function event(ctx: ContractCtx, contractId: string, type: string, role: string, actorId: string | null, details: Record<string, unknown> = {}) {
  const { error } = await ctx.db.from('employment_contract_events').insert({ contract_id: contractId, event_type: type, actor_role: role, actor_id: actorId, details });
  if (error) console.warn('[contract] Verlauf nicht gespeichert', error.code, error.message);
}

const urls = (ctx: ContractCtx, b: Bundle) => ({
  profile: `${ctx.appUrl()}/dashboard/candidates/${b.submission.id}`,
  akte: `${ctx.appUrl()}/recruiter/candidates/${b.candidate.id}`,
  admin: `${ctx.appUrl()}/admin/vertraege`,
});

async function tellRecruiter(ctx: ContractCtx, b: Bundle, title: string, detail: string | null = null) {
  await notify(ctx, b.submission.recruiter_id, 'contract_update', `${b.candidate.full_name}: ${title}`, detail ?? `${companyFor(b)} · ${b.job.title}`, 'candidate', b.candidate.id);
  if (!b.recruiter?.email) return;
  const content = mails.recruiterContractUpdate({ recruiterFirstName: firstName(b.recruiter.name), candidateName: b.candidate.full_name, companyName: companyFor(b), text: title, detail, akteUrl: urls(ctx, b).akte });
  await ctx.mail({ fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: b.recruiter.email, ...content }, { template: 'contract_update_recruiter', meta: { submission_id: b.submission.id } });
}

async function tellClient(ctx: ContractCtx, b: Bundle, title: string, detail: string | null = null, mailToo = true) {
  for (const uid of clientRecipients(b)) {
    await notify(ctx, uid, 'contract_update', `${b.candidate.full_name}: ${title}`, detail ?? b.job.title, 'submission', b.submission.id);
    if (!mailToo) continue;
    const prof = await profile(ctx.db, uid);
    if (!prof?.email) continue;
    const content = mails.clientContractUpdate({ name: prof.name, candidateName: b.candidate.full_name, text: title, detail, profileUrl: urls(ctx, b).profile });
    await ctx.mail({ fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: prof.email, ...content }, { template: 'contract_update_client', meta: { submission_id: b.submission.id } });
  }
}

async function tellAdmins(ctx: ContractCtx, b: Bundle, reason: string, contractId: string) {
  for (const uid of await adminIds(ctx.db)) {
    await notify(ctx, uid, 'contract_case', `Unterschrift klären: ${b.candidate.full_name}`, reason, 'contract', contractId);
    const prof = await profile(ctx.db, uid);
    if (!prof?.email) continue;
    const content = mails.adminCase({ candidateName: b.candidate.full_name, companyName: b.job.company_name, recruiterName: b.recruiter?.name ?? 'Headhunter', reason, adminUrl: urls(ctx, b).admin });
    await ctx.mail({ fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: prof.email, ...content }, { template: 'contract_case_admin', meta: { contract_id: contractId } });
  }
}

async function update(ctx: ContractCtx, id: string, patch: Record<string, unknown>, expectStatus?: string[]) {
  let q = ctx.db.from('employment_contracts').update({ ...patch, updated_at: new Date(ctx.now()).toISOString() }).eq('id', id);
  if (expectStatus) q = q.in('status', expectStatus);
  const { data, error } = await q.select('*').maybeSingle();
  dbFail(error, 'Der Vertrag');
  must(data, 'Der Stand hat sich gerade geändert. Bitte neu laden.', 'conflict');
  return data as any;
}

/**
 * Vertrag zur Zusage: entsteht mit der Zusage, sonst beim ersten Zugriff. Nach
 * „abgelehnt“ oder „zurückgezogen“ nur auf ausdrücklichen Wunsch (neu senden,
 * selbst verschicken, melden) neu; nach „abgesprungen“ nur zu einer neuen Zusage.
 */
async function ensureContract(ctx: ContractCtx, b: Bundle, actorId: string | null, recreate = false) {
  const c = b.contract;
  if (c && OPEN.concat(['signed', 'final']).includes(c.status)) return c;
  const newOffer = !!(c && b.offer && c.offer_id && c.offer_id !== b.offer.id);
  if (c && !newOffer && !(recreate && ['declined', 'voided'].includes(c.status))) return c;
  const { data, error } = await ctx.db.from('employment_contracts').insert({
    submission_id: b.submission.id, offer_id: b.offer?.id ?? null, job_id: b.job.id, way: 'self', status: 'preparing',
    salary: b.offer?.salary_offered ?? null, variable_salary: b.offer?.variable_salary ?? null, start_date: b.offer?.start_date ?? null,
    created_by: actorId,
  }).select('*').maybeSingle();
  if (error?.code === '23505') {
    const { data: again } = await ctx.db.from('employment_contracts').select('*').eq('submission_id', b.submission.id).in('status', OPEN.concat(['signed', 'final'])).maybeSingle();
    b.contract = again;
    return again;
  }
  dbFail(error, 'Der Vertrag');
  b.contract = data;
  return data;
}

// ---------------------------------------------------------------------------
// Verbindlich machen (24 h abgelaufen) – hier hängt Paket 4 Einstellung und Rechnung an
// ---------------------------------------------------------------------------

async function makeFinal(ctx: ContractCtx, c: any, patch: Record<string, unknown> = {}) {
  const nowIso = new Date(ctx.now()).toISOString();
  const done = await update(ctx, c.id, { ...patch, status: 'final', final_at: nowIso, undo_until: null }, [c.status]);
  await event(ctx, c.id, 'final', 'system', null, {});
  return done;
}

async function finalizeIfDue(ctx: ContractCtx, b: Bundle) {
  const c = b.contract;
  if (c?.status === 'signed' && c.undo_until && Date.parse(c.undo_until) <= ctx.now()) {
    try { b.contract = await makeFinal(ctx, c); } catch { /* gleichzeitig verbindlich geworden */ }
  }
}

// ---------------------------------------------------------------------------
// Sicht je Rolle
// ---------------------------------------------------------------------------

export function contractView(c: any, role: Role) {
  if (!c) return null;
  const forClient = role !== 'recruiter';
  return {
    id: c.id, way: c.way, status: c.status, sentAt: c.sent_at,
    companySignerName: forClient ? c.company_signer_name : null,
    companySignedAt: c.company_signed_at, candidateSignedAt: c.candidate_signed_at,
    reportedRole: c.reported_role, reportedAt: c.reported_at, reportNote: c.report_note,
    signedOn: c.signed_on, salary: c.salary, variable: c.variable_salary, startDate: c.start_date, closeJob: !!c.close_job,
    undoUntil: c.undo_until, confirmedAt: c.confirmed_at,
    recruiterCheck: c.recruiter_check, recruiterCheckNote: role === 'client' ? null : c.recruiter_check_note,
    declineReason: c.decline_reason, dropReason: c.drop_reason, finalAt: c.final_at,
    hasSignedDocument: forClient && !!c.signed_document_path,
  };
}

async function feePercent(db: SupabaseClient, job: any): Promise<number | null> {
  if (job.mandate_id) {
    const { data } = await db.from('commercial_mandates').select('pricing_snapshot').eq('id', job.mandate_id).maybeSingle();
    const pct = Number((data as any)?.pricing_snapshot?.clientFeePct);
    if (Number.isFinite(pct) && pct > 0) return pct;
  }
  const fallback = Number(job.fee_percentage);
  return Number.isFinite(fallback) && fallback > 0 ? fallback : null;
}

function workModel(job: any, offer: any): string {
  if (offer?.work_model) return offer.work_model;
  const model = job.remote_type === 'remote' ? 'remote' : job.remote_type === 'hybrid' ? `${job.onsite_days_required && job.onsite_days_required < 5 ? job.onsite_days_required : 3} Tage Büro` : job.remote_type === 'onsite' ? 'vor Ort' : '';
  return [job.location, model].filter(Boolean).join(' · ');
}

export async function contractContext(ctx: ContractCtx, user: User, body: any) {
  const { b, role } = await access(ctx, user, body?.submissionId, ['client', 'recruiter', 'admin']);
  if (b.offer) await ensureContract(ctx, b, null);
  await finalizeIfDue(ctx, b);
  if (b.contract && DIGITAL_RUNNING.includes(b.contract.status) && ctx.sign) {
    const stale = !b.contract.envelope_synced_at || ctx.now() - Date.parse(b.contract.envelope_synced_at) > 10 * 60_000;
    if (stale && b.contract.envelope_id) {
      try {
        const snap = await ctx.sign.status(b.contract.envelope_id);
        if (snap) await applySnapshot(ctx, b, snap);
        else await update(ctx, b.contract.id, { envelope_synced_at: new Date(ctx.now()).toISOString() });
      } catch (e) { console.warn('[contract] DocuSign-Stand nicht abrufbar', e instanceof Error ? e.message : e); }
    }
  }
  const { data: events } = role === 'recruiter' || !b.contract ? { data: [] } : await ctx.db.from('employment_contract_events').select('event_type, actor_role, details, created_at').eq('contract_id', b.contract.id).order('created_at');
  const extras: string[] = b.offer?.extras ?? [];
  const reporter = b.contract?.reported_by ? await profile(ctx.db, b.contract.reported_by) : null;
  return {
    role,
    submissionId: b.submission.id,
    candidateId: b.candidate.id,
    candidateName: b.candidate.full_name,
    candidateEmail: role === 'recruiter' ? null : b.candidate.email ?? null,
    candidatePhone: b.candidate.phone ?? null,
    jobTitle: b.job.title,
    companyName: role === 'recruiter' ? companyFor(b) : b.job.company_name,
    recruiterName: b.recruiter?.name ?? null,
    reporterName: reporter?.name ?? null,
    feePercent: role === 'recruiter' ? null : await feePercent(ctx.db, b.job),
    digitalAvailable: !!ctx.sign,
    digitalDemo: !!ctx.signDemo,
    offer: b.offer ? {
      id: b.offer.id, salary: b.offer.salary_offered, variable: b.offer.variable_salary ?? null, startDate: b.offer.start_date ?? null,
      contractType: b.offer.contract_type ?? 'permanent', probationMonths: b.offer.probation_months ?? null,
      workModel: workModel(b.job, b.offer), extras, acceptedAt: b.offer.decision_at ?? b.offer.responded_at ?? null,
    } : null,
    contract: contractView(b.contract, role),
    events: ((events ?? []) as any[]).map((e) => ({ type: e.event_type, role: e.actor_role, at: e.created_at, details: e.details })),
  };
}

export async function signedDocument(ctx: ContractCtx, user: User, body: any) {
  const { b } = await access(ctx, user, body?.submissionId, ['client', 'admin']);
  must(b.contract?.signed_document_path, 'Es gibt noch kein unterschriebenes PDF.', 'not_found');
  const url = await ctx.files.url(b.contract.signed_document_path, 120);
  must(url, 'Das PDF ist gerade nicht abrufbar.', 'not_found');
  return { url };
}

// ---------------------------------------------------------------------------
// Kunde: selbst verschicken
// ---------------------------------------------------------------------------

export async function sendSelf(ctx: ContractCtx, user: User, body: any) {
  const { b } = await access(ctx, user, body?.submissionId, ['client', 'admin']);
  must(b.offer, 'Ohne Zusage gibt es noch keinen Vertrag.', 'conflict');
  const c = await ensureContract(ctx, b, user.id, true);
  must(['preparing', 'sent_self'].includes(c.status), c.status === 'dropped' ? 'Der Kandidat ist abgesprungen.' : 'Der Vertrag läuft schon digital. Ziehen Sie ihn zuerst zurück.', 'conflict');
  const sentOn = typeof body.sentOn === 'string' && DATE.test(body.sentOn) ? body.sentOn : null;
  must(!sentOn || sentOn <= todayKey(ctx.now()), 'Das Datum liegt in der Zukunft.');
  const done = await update(ctx, c.id, { way: 'self', status: sentOn ? 'sent_self' : 'preparing', sent_at: sentOn ? `${sentOn}T12:00:00Z` : null }, ['preparing', 'sent_self']);
  await event(ctx, c.id, sentOn ? 'sent_self' : 'way_self', 'client', user.id, { sentOn });
  const first = firstName(b.candidate.full_name);
  await tellRecruiter(ctx, b, sentOn ? `Vertrag am ${mails.dateDe(sentOn)} selbst verschickt` : 'Kunde schickt den Vertrag selbst', `Bitte bei ${first} nachhaken und die Unterschrift melden, sobald sie da ist.`);
  return { ok: true, contract: contractView(done, 'client') };
}

// ---------------------------------------------------------------------------
// Kunde: digital über DocuSign
// ---------------------------------------------------------------------------

/** Unterschriftenseite mit den Ankern für DocuSign (weiß, unsichtbar). */
export async function signaturePage(o: { companyName: string; candidateName: string; jobTitle: string; fileName: string; signerName: string }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.1, 0.12);
  let y = 770;
  const line = (s: string, size = 11, f = font) => { page.drawText(s, { x: 60, y, size, font: f, color: ink }); y -= size + 8; };
  line('Unterschriften zum Arbeitsvertrag', 18, bold);
  y -= 6;
  line(`Arbeitgeber: ${o.companyName}`);
  line(`Arbeitnehmer/in: ${o.candidateName}`);
  line(`Tätigkeit: ${o.jobTitle}`);
  y -= 8;
  line('Dieses Blatt gehört zum beigefügten Arbeitsvertrag', 10);
  line(`(Datei „${o.fileName.slice(0, 80)}“). Mit ihrer Unterschrift schließen beide Seiten`, 10);
  line('den Arbeitsvertrag in der beigefügten Fassung.', 10);
  const block = (label: string, name: string, anchor: string, top: number) => {
    page.drawText(label, { x: 60, y: top, size: 10, font: bold, color: ink });
    page.drawText(anchor, { x: 60, y: top - 40, size: 8, font, color: rgb(1, 1, 1) });
    page.drawLine({ start: { x: 60, y: top - 60 }, end: { x: 330, y: top - 60 }, thickness: 0.6, color: ink });
    page.drawText(name, { x: 60, y: top - 74, size: 10, font, color: ink });
  };
  block('Für den Arbeitgeber', o.signerName, '/mh_ag/', 520);
  block('Arbeitnehmer/in', o.candidateName, '/mh_an/', 380);
  page.drawText('Elektronisch unterschrieben über DocuSign, versendet über Matchunt.', { x: 60, y: 80, size: 8, font, color: rgb(0.45, 0.45, 0.5) });
  return await pdf.save();
}

export async function sendDigital(ctx: ContractCtx, user: User, body: any) {
  const { b } = await access(ctx, user, body?.submissionId, ['client', 'admin']);
  must(b.offer, 'Ohne Zusage gibt es noch keinen Vertrag.', 'conflict');
  must(ctx.sign, 'Die digitale Unterschrift ist gerade nicht eingerichtet. Bitte „Selbst verschicken“ wählen.', 'conflict');
  must(typeof body.fixedTerm === 'boolean' && typeof body.nonCompete === 'boolean', 'Bitte beide Fragen beantworten.');
  // Befristung (§ 14 Abs. 4 TzBfG) und nachvertragliches Wettbewerbsverbot (§ 74 HGB) brauchen die Schriftform.
  must(!body.fixedTerm && !body.nonCompete, 'Befristung oder Wettbewerbsverbot: Dafür gilt die Schriftform. Bitte „Selbst verschicken“ wählen.');
  const signerName = text(body.signerName, 120);
  const signerEmail = text(body.signerEmail, 200).toLowerCase();
  const candidateEmail = text(body.candidateEmail, 200).toLowerCase();
  must(signerName && EMAIL.test(signerEmail), 'Bitte Name und Mail der Person angeben, die für die Firma unterschreibt.');
  must(EMAIL.test(candidateEmail), 'Bitte die Mail des Kandidaten angeben.');
  must(signerEmail !== candidateEmail, 'Firma und Kandidat brauchen zwei verschiedene Mailadressen.');
  const salary = num(body.salary);
  must(salary && salary >= 10000 && salary <= 2000000, 'Bitte das Gehalt laut Vertrag angeben.');
  const variable = num(body.variable);
  must(typeof body.startDate === 'string' && DATE.test(body.startDate), 'Bitte den Beginn laut Vertrag angeben.');
  const fileName = text(body.fileName, 120) || 'Arbeitsvertrag.pdf';
  must(typeof body.fileBase64 === 'string' && body.fileBase64.length > 8, 'Bitte den Vertrag als PDF hochladen.');
  let bytes: Uint8Array;
  try { bytes = decodeBase64(body.fileBase64.replace(/^data:[^,]+,/, '')); } catch { must(false, 'Die Datei konnte nicht gelesen werden.'); }
  must(bytes!.length <= MAX_PDF_BYTES, 'Die Datei ist größer als 8 MB.');
  must(new TextDecoder().decode(bytes!.slice(0, 5)) === '%PDF-', 'Bitte eine PDF-Datei hochladen.');

  const c = await ensureContract(ctx, b, user.id, true);
  must(['preparing', 'sent_self'].includes(c.status), DIGITAL_RUNNING.includes(c.status) ? 'Es läuft schon ein Umschlag. Bitte zuerst zurückziehen.' : 'Der Vertrag ist schon gemeldet.', 'conflict');
  const path = `${b.submission.id}/${c.id}/vertrag-${ctx.now()}.pdf`;
  await ctx.files.put(path, bytes!);
  const page = await signaturePage({ companyName: b.job.company_name, candidateName: b.candidate.full_name, jobTitle: b.job.title, fileName, signerName });
  const { envelopeId } = await ctx.sign.send({
    subject: `Arbeitsvertrag ${b.job.title} – ${b.job.company_name}`.slice(0, 100),
    blurb: `${b.job.company_name} bittet um Ihre Unterschrift unter den Arbeitsvertrag. Versendet über Matchunt.`,
    documents: [{ base64: encodeBase64(bytes!), name: fileName }, { base64: encodeBase64(page), name: 'Unterschriften.pdf' }],
    company: { name: signerName, email: signerEmail },
    candidate: { name: b.candidate.full_name, email: candidateEmail },
    contractId: c.id,
  });
  const nowIso = new Date(ctx.now()).toISOString();
  const done = await update(ctx, c.id, {
    way: 'digital', status: 'sent_digital', sent_at: nowIso, envelope_id: envelopeId, document_path: path,
    company_signer_name: signerName, company_signer_email: signerEmail, candidate_email: candidateEmail,
    company_signed_at: null, candidate_signed_at: null, envelope_synced_at: nowIso,
    fixed_term: false, non_compete: false, salary, variable_salary: variable, start_date: body.startDate,
  }, ['preparing', 'sent_self']);
  await event(ctx, c.id, 'sent_digital', 'client', user.id, { envelopeId, salary, variable, startDate: body.startDate });
  await tellRecruiter(ctx, b, 'Arbeitsvertrag über DocuSign verschickt', `Erst unterschreibt ${b.submission.company_revealed ? b.job.company_name : 'die Firma'}, dann ${firstName(b.candidate.full_name)}. Du bekommst Bescheid.`);
  return { ok: true, contract: contractView(done, 'client') };
}

export async function voidDigital(ctx: ContractCtx, user: User, body: any) {
  const { b } = await access(ctx, user, body?.submissionId, ['client', 'admin']);
  const c = b.contract;
  must(c && DIGITAL_RUNNING.includes(c.status), 'Es läuft gerade kein digitaler Umschlag.', 'conflict');
  if (ctx.sign && c.envelope_id) await ctx.sign.void(c.envelope_id, 'Vom Kunden zurückgezogen');
  const toSelf = body.toSelf === true;
  const done = await update(ctx, c.id, { status: 'preparing', way: toSelf ? 'self' : 'digital', envelope_id: null, company_signed_at: null, candidate_signed_at: null, sent_at: null }, DIGITAL_RUNNING);
  await event(ctx, c.id, 'voided', 'client', user.id, { envelopeId: c.envelope_id, toSelf });
  await tellRecruiter(ctx, b, toSelf ? 'Digitaler Vertrag zurückgezogen, Kunde schickt selbst' : 'Digitaler Vertrag zurückgezogen, wird neu gesendet', null);
  return { ok: true, contract: contractView(done, 'client') };
}

// ---------------------------------------------------------------------------
// DocuSign-Stand übernehmen (Webhook und Abfrage, idempotent)
// ---------------------------------------------------------------------------

async function applySnapshot(ctx: ContractCtx, b: Bundle, snap: SignerSnapshot) {
  let c = b.contract;
  const nowIso = new Date(ctx.now()).toISOString();
  const company = snap.signers.find((s) => s.recipientId === '1');
  const cand = snap.signers.find((s) => s.recipientId === '2');
  const first = firstName(b.candidate.full_name);
  if (!DIGITAL_RUNNING.includes(c.status)) {
    await update(ctx, c.id, { envelope_synced_at: nowIso });
    return;
  }
  const declined = [company, cand].find((s) => s?.status === 'declined');
  if (declined) {
    const who = declined.recipientId === '1' ? 'Die Firma' : first;
    const reason = text(declined.declinedReason, 500) || null;
    c = await update(ctx, c.id, { status: 'declined', decline_reason: reason, envelope_synced_at: nowIso }, DIGITAL_RUNNING);
    b.contract = c;
    await event(ctx, c.id, 'declined', 'docusign', null, { by: declined.recipientId, reason });
    await tellClient(ctx, b, `${who} hat in DocuSign abgelehnt`, reason);
    await tellRecruiter(ctx, b, `${who} hat den Vertrag in DocuSign abgelehnt`, reason ?? 'Bitte mit allen klären.');
    return;
  }
  if (snap.status === 'voided') {
    c = await update(ctx, c.id, { status: 'preparing', envelope_id: null, company_signed_at: null, candidate_signed_at: null, sent_at: null, envelope_synced_at: nowIso }, DIGITAL_RUNNING);
    b.contract = c;
    await event(ctx, c.id, 'voided', 'docusign', null, {});
    return;
  }
  const patch: Record<string, unknown> = { envelope_synced_at: nowIso };
  const companyDone = company?.status === 'completed';
  const candDone = cand?.status === 'completed';
  if (companyDone && !c.company_signed_at) patch.company_signed_at = company?.signedDateTime ?? nowIso;
  if (candDone && !c.candidate_signed_at) patch.candidate_signed_at = cand?.signedDateTime ?? nowIso;
  if (companyDone && candDone) {
    const last = String(patch.candidate_signed_at ?? c.candidate_signed_at ?? nowIso);
    let signedPath: string | null = null;
    try {
      const doc = ctx.sign ? await ctx.sign.document(c.envelope_id) : null;
      if (doc) { signedPath = `${b.submission.id}/${c.id}/unterschrieben.pdf`; await ctx.files.put(signedPath, doc); }
    } catch (e) { console.warn('[contract] unterschriebenes PDF nicht gesichert', e instanceof Error ? e.message : e); }
    c = await update(ctx, c.id, {
      ...patch, status: 'final', final_at: nowIso, signed_on: new Date(last).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }),
      reported_role: 'docusign', reported_at: nowIso, confirmed_at: nowIso, ...(signedPath ? { signed_document_path: signedPath } : {}),
    }, DIGITAL_RUNNING);
    b.contract = c;
    await event(ctx, c.id, 'signed_digital', 'docusign', null, { signedOn: c.signed_on });
    const facts = { signedOn: c.signed_on, salary: c.salary, variable: c.variable_salary, startDate: c.start_date };
    for (const uid of clientRecipients(b)) {
      await notify(ctx, uid, 'contract_signed', `${b.candidate.full_name} hat unterschrieben`, `Arbeitsvertrag über DocuSign abgeschlossen`, 'submission', b.submission.id);
      const prof = await profile(ctx.db, uid);
      if (prof?.email) {
        const content = mails.clientContractDone({ name: prof.name, candidateName: b.candidate.full_name, facts, digital: true, profileUrl: urls(ctx, b).profile });
        await ctx.mail({ fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: prof.email, ...content }, { template: 'contract_done_client', meta: { contract_id: c.id } });
      }
    }
    await tellRecruiter(ctx, b, `Arbeitsvertrag unterschrieben (${mails.dateDe(c.signed_on)})`, 'Beide Seiten haben über DocuSign unterschrieben.');
    return;
  }
  if (companyDone && c.status === 'sent_digital') {
    patch.status = 'company_signed';
    c = await update(ctx, c.id, patch, ['sent_digital']);
    b.contract = c;
    await event(ctx, c.id, 'company_signed', 'docusign', null, {});
    await tellRecruiter(ctx, b, 'Firma hat unterschrieben', `Jetzt fehlt nur noch ${first}. Stoß ${first} kurz an.`);
    return;
  }
  b.contract = await update(ctx, c.id, patch);
}

/** Webhook: Umschlag zuordnen und Stand übernehmen. */
export async function applyEnvelopeEvent(ctx: ContractCtx, envelopeId: string, snap: SignerSnapshot) {
  const { data } = await ctx.db.from('employment_contracts').select('submission_id').eq('envelope_id', envelopeId).maybeSingle();
  if (!data) return { matched: false };
  const b = await loadBundle(ctx.db, (data as any).submission_id);
  if (!b.contract || b.contract.envelope_id !== envelopeId) return { matched: false };
  await applySnapshot(ctx, b, snap);
  return { matched: true, status: b.contract.status };
}

export async function refreshDigital(ctx: ContractCtx, user: User, body: any) {
  const { b, role } = await access(ctx, user, body?.submissionId, ['client', 'recruiter', 'admin']);
  must(b.contract && DIGITAL_RUNNING.includes(b.contract.status), 'Es läuft gerade kein digitaler Umschlag.', 'conflict');
  must(ctx.sign, 'Die digitale Unterschrift ist gerade nicht eingerichtet.', 'conflict');
  const snap = await ctx.sign.status(b.contract.envelope_id);
  if (snap) await applySnapshot(ctx, b, snap);
  return { ok: true, contract: contractView(b.contract, role) };
}

// ---------------------------------------------------------------------------
// Melden, bestätigen, rückgängig, Gegenprobe, abgesprungen
// ---------------------------------------------------------------------------

function facts(body: any, now: number, fallback: any) {
  const signedOn = typeof body.signedOn === 'string' && DATE.test(body.signedOn) ? body.signedOn : null;
  must(signedOn, 'Bitte das Datum der Unterschrift angeben.');
  must(signedOn <= todayKey(now), 'Das Datum der Unterschrift liegt in der Zukunft.');
  const salary = num(body.salary) ?? fallback?.salary ?? null;
  must(salary && salary >= 10000 && salary <= 2000000, 'Bitte das Gehalt laut Vertrag angeben.');
  const variable = body.variable === undefined ? fallback?.variable_salary ?? null : num(body.variable);
  const startDate = typeof body.startDate === 'string' && DATE.test(body.startDate) ? body.startDate : fallback?.start_date ?? null;
  must(startDate, 'Bitte den ersten Arbeitstag angeben.');
  return { signed_on: signedOn, salary, variable_salary: variable, start_date: startDate };
}

export async function report(ctx: ContractCtx, user: User, body: any) {
  const { b, role } = await access(ctx, user, body?.submissionId, ['client', 'recruiter', 'admin']);
  must(b.offer || role !== 'recruiter', 'Ohne Zusage im System meldet der Kunde die Einstellung.', 'conflict');
  const c = await ensureContract(ctx, b, user.id, true);
  must(c.status !== 'dropped', 'Der Kandidat ist abgesprungen.', 'conflict');
  must(!DIGITAL_RUNNING.includes(c.status), 'Der Vertrag läuft digital; die Unterschrift kommt von DocuSign. Oder zuerst „Doch selbst verschicken“.', 'conflict');
  must(['preparing', 'sent_self', 'reported'].includes(c.status), 'Die Unterschrift ist schon gemeldet.', 'conflict');
  must(c.status !== 'reported' || role !== 'recruiter', 'Die Unterschrift ist schon gemeldet; der Kunde bestätigt noch.', 'conflict');
  const f = facts(body, ctx.now(), c);
  const nowIso = new Date(ctx.now()).toISOString();
  const evidence = text(body.evidence);
  const note = text(body.note) || null;
  const base = { ...f, reported_by: user.id, reported_role: role, reported_at: nowIso, report_note: note, close_job: body.closeJob === true, previous_status: c.status === 'reported' ? c.previous_status : c.status };
  const first = firstName(b.candidate.full_name);
  const factsOut = { signedOn: f.signed_on, salary: f.salary, variable: f.variable_salary, startDate: f.start_date };

  if (role === 'client') {
    const done = await update(ctx, c.id, { ...base, status: 'signed', confirmed_by: user.id, confirmed_at: nowIso, undo_until: new Date(ctx.now() + UNDO_HOURS * 3_600_000).toISOString(), recruiter_check: null }, [c.status]);
    await event(ctx, c.id, 'reported', 'client', user.id, factsOut);
    // Gegenprobe beim Headhunter
    await notify(ctx, b.submission.recruiter_id, 'contract_check', `${companyFor(b)} meldet: ${b.candidate.full_name} hat unterschrieben`, `Passt das zu dem, was ${first} sagt?`, 'candidate', b.candidate.id);
    if (b.recruiter?.email) {
      const content = mails.recruiterCheckRequest({ recruiterFirstName: firstName(b.recruiter.name), candidateName: b.candidate.full_name, companyName: companyFor(b), facts: factsOut, akteUrl: urls(ctx, b).akte });
      await ctx.mail({ fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: b.recruiter.email, ...content }, { template: 'contract_check_recruiter', meta: { contract_id: c.id } });
    }
    return { ok: true, contract: contractView(done, role) };
  }

  if (role === 'admin' && evidence) {
    const done = await update(ctx, c.id, { ...base, evidence_note: evidence, status: 'final', final_at: nowIso, confirmed_by: user.id, confirmed_at: nowIso }, [c.status]);
    await event(ctx, c.id, 'reported_with_evidence', 'admin', user.id, { ...factsOut, evidence });
    await tellClient(ctx, b, `Unterschrift von Matchunt bestätigt (${mails.dateDe(f.signed_on)})`, null);
    await tellRecruiter(ctx, b, `Unterschrift bestätigt (${mails.dateDe(f.signed_on)})`, null);
    return { ok: true, contract: contractView(done, role) };
  }

  // Headhunter oder Matchunt ohne Beleg: der Kunde bestätigt
  const done = await update(ctx, c.id, { ...base, status: 'reported', evidence_note: evidence || null }, [c.status]);
  await event(ctx, c.id, 'reported', role, user.id, factsOut);
  const reporterName = role === 'recruiter' ? (b.recruiter?.name || 'Ihr Headhunter') : 'Matchunt';
  for (const uid of clientRecipients(b)) {
    await notify(ctx, uid, 'contract_confirm', `${reporterName} meldet: ${b.candidate.full_name} hat unterschrieben`, 'Stimmt das? Bitte im Profil bestätigen.', 'submission', b.submission.id);
    const prof = await profile(ctx.db, uid);
    if (!prof?.email) continue;
    const content = mails.clientConfirmRequest({ name: prof.name, candidateName: b.candidate.full_name, reporterName, facts: factsOut, profileUrl: urls(ctx, b).profile });
    await ctx.mail({ fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: prof.email, ...content }, { template: 'contract_confirm_client', meta: { contract_id: c.id } });
  }
  return { ok: true, contract: contractView(done, role) };
}

export async function confirm(ctx: ContractCtx, user: User, body: any) {
  const { b } = await access(ctx, user, body?.submissionId, ['client', 'admin']);
  const c = b.contract;
  must(c?.status === 'reported', 'Es ist keine Meldung offen.', 'conflict');
  const way = body?.way;
  must(['yes', 'values', 'not_yet'].includes(way), 'Bitte eine Antwort wählen.');
  const nowIso = new Date(ctx.now()).toISOString();
  if (way === 'not_yet') {
    const done = await update(ctx, c.id, { status: c.previous_status && OPEN.includes(c.previous_status) && c.previous_status !== 'reported' ? c.previous_status : 'preparing', reported_by: null, reported_role: null, reported_at: null, report_note: null, signed_on: null }, ['reported']);
    await event(ctx, c.id, 'report_rejected', 'client', user.id, {});
    await tellRecruiter(ctx, b, 'Kunde sagt: noch nicht unterschrieben', 'Die Erinnerungen laufen weiter.');
    return { ok: true, contract: contractView(done, 'client') };
  }
  const values = way === 'values' ? facts(body, ctx.now(), c) : {};
  const done = await makeFinal(ctx, c, { ...values, confirmed_by: user.id, confirmed_at: nowIso });
  await event(ctx, c.id, way === 'values' ? 'confirmed_other_values' : 'confirmed', 'client', user.id, values);
  await tellRecruiter(ctx, b, way === 'values' ? 'Unterschrift bestätigt, mit anderen Werten' : 'Unterschrift vom Kunden bestätigt',
    way === 'values' ? mails.factLines({ signedOn: done.signed_on, salary: done.salary, variable: done.variable_salary, startDate: done.start_date }).join(' · ') : null);
  return { ok: true, contract: contractView(done, 'client') };
}

export async function undo(ctx: ContractCtx, user: User, body: any) {
  const { b } = await access(ctx, user, body?.submissionId, ['client', 'admin']);
  const c = b.contract;
  must(c?.status === 'signed' && c.reported_role === 'client', 'Hier gibt es nichts zurückzunehmen.', 'conflict');
  must(c.undo_until && Date.parse(c.undo_until) > ctx.now(), 'Die 24 Stunden sind vorbei. Bitte wenden Sie sich an Matchunt.', 'conflict');
  const back = c.previous_status && ['preparing', 'sent_self'].includes(c.previous_status) ? c.previous_status : 'preparing';
  const done = await update(ctx, c.id, { status: back, undo_until: null, reported_by: null, reported_role: null, reported_at: null, report_note: null, signed_on: null, confirmed_by: null, confirmed_at: null, recruiter_check: null, recruiter_check_note: null, recruiter_checked_at: null }, ['signed']);
  await event(ctx, c.id, 'undone', 'client', user.id, {});
  await tellRecruiter(ctx, b, 'Kunde hat die Unterschrift-Meldung zurückgenommen', null);
  return { ok: true, contract: contractView(done, 'client') };
}

export async function check(ctx: ContractCtx, user: User, body: any) {
  const { b } = await access(ctx, user, body?.submissionId, ['recruiter']);
  const c = b.contract;
  must(c && ['signed', 'final'].includes(c.status) && c.reported_role === 'client' && !c.recruiter_check, 'Hier ist keine Gegenprobe offen.', 'conflict');
  const way = body?.way;
  must(way === 'ok' || way === 'differs', 'Bitte „Stimmt“ oder „Weicht ab“ wählen.');
  const note = text(body.note) || null;
  must(way === 'ok' || note, 'Bitte kurz eintragen, was abweicht.');
  const done = await update(ctx, c.id, { recruiter_check: way, recruiter_check_note: note, recruiter_checked_at: new Date(ctx.now()).toISOString() }, ['signed', 'final']);
  await event(ctx, c.id, way === 'ok' ? 'check_ok' : 'check_differs', 'recruiter', user.id, { note });
  if (way === 'differs') await tellAdmins(ctx, b, `Gegenprobe weicht ab: ${note}`, c.id);
  return { ok: true, contract: contractView(done, 'recruiter') };
}

export async function drop(ctx: ContractCtx, user: User, body: any) {
  const { b, role } = await access(ctx, user, body?.submissionId, ['client', 'recruiter', 'admin']);
  const c = await ensureContract(ctx, b, user.id);
  must(OPEN.includes(c.status) || c.status === 'declined', c.status === 'dropped' ? 'Schon als abgesprungen gemeldet.' : 'Die Unterschrift ist schon gemeldet. Bitte wenden Sie sich an Matchunt.', 'conflict');
  const reason = text(body.reason, 1000);
  must(reason, 'Bitte kurz den Grund angeben.');
  if (DIGITAL_RUNNING.includes(c.status) && ctx.sign && c.envelope_id) {
    try { await ctx.sign.void(c.envelope_id, 'Kandidat abgesprungen'); } catch (e) { console.warn('[contract] Umschlag nicht zurückgezogen', e instanceof Error ? e.message : e); }
  }
  const done = await update(ctx, c.id, { status: 'dropped', drop_reason: reason }, OPEN.concat(['declined']));
  await event(ctx, c.id, 'dropped', role, user.id, { reason });
  const { error } = await ctx.db.from('submissions').update({ stage: 'withdrawn' }).eq('id', b.submission.id);
  if (error) console.warn('[contract] Stufe nicht gesetzt', error.code, error.message);
  const first = firstName(b.candidate.full_name);
  if (role !== 'recruiter') await tellRecruiter(ctx, b, `${first} ist laut Kunde abgesprungen`, reason);
  if (role !== 'client') await tellClient(ctx, b, `${first} ist abgesprungen`, reason);
  return { ok: true, contract: contractView(done, role) };
}

// ---------------------------------------------------------------------------
// Täglicher Lauf: Tag 7 / 10 / 21, abgelaufene 24 h, DocuSign nachholen
// ---------------------------------------------------------------------------

export async function runFollowups(ctx: ContractCtx) {
  const now = ctx.now();
  const out = { final: 0, client: 0, recruiter: 0, admin: 0, synced: 0 };
  // Zusagen ohne Vertragszeile (älter als dieser Ablauf) bekommen eine
  const { data: accepted } = await ctx.db.from('offers').select('submission_id').eq('status', 'accepted');
  for (const o of (accepted ?? []) as any[]) {
    const b = await loadBundle(ctx.db, o.submission_id);
    await ensureContract(ctx, b, null);
  }
  const { data: rows } = await ctx.db.from('employment_contracts').select('submission_id').in('status', OPEN.concat(['signed']));
  for (const r of (rows ?? []) as any[]) {
    const b = await loadBundle(ctx.db, r.submission_id);
    const c = b.contract;
    if (!c) continue;
    if (c.status === 'signed') { await finalizeIfDue(ctx, b); if (b.contract.status === 'final') out.final++; continue; }
    if (DIGITAL_RUNNING.includes(c.status) && ctx.sign && c.envelope_id) {
      try { const snap = await ctx.sign.status(c.envelope_id); if (snap) { await applySnapshot(ctx, b, snap); out.synced++; } } catch { /* nächster Lauf */ }
      if (!OPEN.includes(b.contract.status)) continue;
    }
    const anchor = DIGITAL_RUNNING.includes(b.contract.status) && b.contract.sent_at ? b.contract.sent_at : (b.offer?.decision_at ?? b.offer?.responded_at ?? b.contract.created_at);
    const days = Math.floor((now - Date.parse(anchor)) / DAY_MS);
    const nowIso = new Date(now).toISOString();
    const first = firstName(b.candidate.full_name);
    if (days >= 7 && !b.contract.client_reminded_at) {
      for (const uid of clientRecipients(b)) {
        await notify(ctx, uid, 'contract_reminder', `Ist der Vertrag mit ${b.candidate.full_name} unterschrieben?`, 'Kurz im Profil melden.', 'submission', b.submission.id);
        const prof = await profile(ctx.db, uid);
        if (!prof?.email) continue;
        const content = mails.clientReminder({ name: prof.name, candidateName: b.candidate.full_name, recruiterName: b.recruiter?.name || 'Ihr Headhunter', profileUrl: urls(ctx, b).profile });
        await ctx.mail({ fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: prof.email, ...content }, { template: 'contract_reminder_client', meta: { contract_id: b.contract.id } });
      }
      await update(ctx, b.contract.id, { client_reminded_at: nowIso });
      await event(ctx, b.contract.id, 'reminder_client', 'system', null, { days });
      out.client++;
    }
    if (days >= 10 && !b.contract.recruiter_reminded_at) {
      await notify(ctx, b.submission.recruiter_id, 'contract_followup', `Vertrag mit ${b.candidate.full_name} nachfassen`, `Seit ${days} Tagen keine Unterschrift gemeldet. Frag bei ${first} nach.`, 'candidate', b.candidate.id);
      if (b.recruiter?.email) {
        const content = mails.recruiterFollowup({ recruiterFirstName: firstName(b.recruiter.name), candidateName: b.candidate.full_name, companyName: companyFor(b), days, akteUrl: urls(ctx, b).akte });
        await ctx.mail({ fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: b.recruiter.email, ...content }, { template: 'contract_followup_recruiter', meta: { contract_id: b.contract.id } });
      }
      await update(ctx, b.contract.id, { recruiter_reminded_at: nowIso });
      await event(ctx, b.contract.id, 'reminder_recruiter', 'system', null, { days });
      out.recruiter++;
    }
    if (days >= 21 && !b.contract.admin_case_at) {
      await tellAdmins(ctx, b, b.contract.status === 'reported' ? `Meldung seit ${days} Tagen nicht bestätigt.` : `Zusage vor ${days} Tagen, keine Unterschrift gemeldet.`, b.contract.id);
      await update(ctx, b.contract.id, { admin_case_at: nowIso });
      await event(ctx, b.contract.id, 'admin_case', 'system', null, { days });
      out.admin++;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Admin: offene Fälle
// ---------------------------------------------------------------------------

export async function adminCases(ctx: ContractCtx, user: User) {
  must(await isAdmin(ctx.db, user.id), 'Nur für Matchunt.', 'not_allowed');
  const { data } = await ctx.db.from('employment_contracts').select('*').in('status', OPEN.concat(['signed', 'final', 'declined'])).order('updated_at', { ascending: false }).limit(200);
  const out = [];
  for (const c of (data ?? []) as any[]) {
    if (c.status === 'final' && c.recruiter_check !== 'differs') continue;
    const b = await loadBundle(ctx.db, c.submission_id);
    out.push({
      submissionId: c.submission_id, candidateName: b.candidate.full_name, companyName: b.job.company_name, jobTitle: b.job.title,
      recruiterName: b.recruiter?.name ?? null, acceptedAt: b.offer?.decision_at ?? null,
      contract: contractView(c, 'admin'), adminCaseAt: c.admin_case_at,
    });
  }
  return { cases: out };
}
