// deno-lint-ignore-file no-explicit-any
// Einstellung und Rechnung (Paket 4a, 22.10.2026). Ein einziger Weg zur
// Einstellung: Ist der Arbeitsvertrag verbindlich (Paket 3), entsteht genau ein
// Placement (Zielgehalt = fix + variabel laut Vertrag) und ein Rechnungsentwurf.
// Matchunt gibt den Entwurf frei: dann feste Nummer, PDF, Mail an die
// Rechnungs-E-Mail des Kunden. Danach bucht Matchunt den Zahlungseingang.
import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { canUserActOnJob } from './team-access.ts';
import { dbFail, must, type ServiceCtx } from './interview-service.ts';
import { PAYMENT_TERMS_DAYS, VAT_RATE, NUMBERING, formatNumber, isReverseCharge, releaseBlockers } from './billing-config.ts';
import { eur, renderInvoicePdf, type InvoiceDoc } from './invoice-pdf.ts';
import { esc, layout } from './intake-mail.ts';

export interface FilePort {
  put(path: string, bytes: Uint8Array): Promise<void>;
  get(path: string): Promise<Uint8Array | null>;
  url(path: string, seconds: number): Promise<string | null>;
}

export interface PlacementCtx extends ServiceCtx {
  invoiceFiles: FilePort;
}

const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ACTIVE_STAGES = ['submitted', 'in_review', 'interview_requested', 'candidate_opted_in', 'interview_scheduled', 'interview_counter_proposed', 'interview_completed', 'offer'];
const PACKAGE_NAMES: Record<string, string> = { core: 'Matchunt Core', continuity_90: 'Matchunt Continuity 90', continuity_180: 'Matchunt Continuity 180' };
const dateDe = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' }) : '');
const todayKey = (now: number) => new Date(now).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
const plusDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export function bucketFiles(db: SupabaseClient, bucket: string): FilePort {
  let ready = false;
  const ensure = async () => {
    if (ready) return;
    const { data } = await db.storage.getBucket(bucket);
    if (!data) await db.storage.createBucket(bucket, { public: false });
    ready = true;
  };
  return {
    put: async (path, bytes) => {
      await ensure();
      const { error } = await db.storage.from(bucket).upload(path, bytes, { contentType: 'application/pdf', upsert: true });
      if (error) throw new Error(`Datei konnte nicht gespeichert werden: ${error.message}`);
    },
    get: async (path) => { const { data } = await db.storage.from(bucket).download(path); return data ? new Uint8Array(await data.arrayBuffer()) : null; },
    url: async (path, seconds) => { const { data } = await db.storage.from(bucket).createSignedUrl(path, seconds); return data?.signedUrl ?? null; },
  };
}

export function placementCtx(base: ServiceCtx): PlacementCtx {
  return { ...base, invoiceFiles: bucketFiles(base.db, 'invoices') };
}

async function isAdmin(db: SupabaseClient, userId: string) {
  const { data } = await db.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
  return !!data;
}
async function adminIds(db: SupabaseClient): Promise<string[]> {
  const { data } = await db.from('user_roles').select('user_id').eq('role', 'admin');
  return ((data ?? []) as any[]).map((r) => r.user_id);
}
async function profile(db: SupabaseClient, userId: string | null | undefined) {
  if (!userId) return null;
  const { data } = await db.from('profiles').select('full_name, email').eq('user_id', userId).maybeSingle();
  return data ? { name: (data as any).full_name ?? '', email: (data as any).email ?? null } : null;
}
async function notify(ctx: ServiceCtx, userId: string | null | undefined, type: string, title: string, message: string, relatedType: string, relatedId: string) {
  if (!userId) return;
  const { error } = await ctx.db.from('notifications').insert({ user_id: userId, type, title, message, related_type: relatedType, related_id: relatedId });
  if (error) console.warn('[placement] Benachrichtigung nicht gespeichert', error.code, error.message);
}

/** Paket für Stellen ohne Einzelauftrag (Bestand): Core-Aufteilung zum Satz der Stelle. */
export function fallbackSnapshot(job: any) {
  const fee = Number(job.fee_percentage) > 0 ? Number(job.fee_percentage) : 20;
  const recruiter = Math.round(fee * 0.75 * 100) / 100;
  return {
    packageKey: 'core', packageVersion: 1, publicName: 'Matchunt Core', clientFeePct: fee, continuityDays: null,
    recruiterInitialPct: recruiter, recruiterRetentionPct: 0, matchuntPct: Math.round((fee - recruiter) * 100) / 100,
    researchBountyPct: 0, matchuntOnClaimPct: Math.round((fee - recruiter) * 100) / 100, researchMaxActiveDays: null, claimNoticeDays: 14,
    eligibleClaimCategories: [], excludedClaimCategories: [], capturedAt: new Date().toISOString(), source: 'job_fee_percentage',
  };
}

/** Beträge wie der Trigger placements_derive (für Bestandsstellen ohne Auftrag und Tests ohne Trigger). */
function amountsFor(snapshot: any, grossCents: number) {
  const client = Math.round(grossCents * Number(snapshot.clientFeePct) / 100);
  const initial = Math.round(grossCents * Number(snapshot.recruiterInitialPct) / 100);
  const retention = Math.round(grossCents * Number(snapshot.recruiterRetentionPct ?? 0) / 100);
  return { client_fee_cents: client, recruiter_initial_cents: initial, recruiter_retention_cents: retention, matchunt_cents: client - initial - retention };
}

async function loadSubmission(db: SupabaseClient, submissionId: string) {
  const { data: submission } = await db.from('submissions').select('id, job_id, candidate_id, recruiter_id, stage, identity_unlocked, company_revealed').eq('id', submissionId).maybeSingle();
  must(submission, 'Bewerbung nicht gefunden.', 'not_found');
  const [{ data: job }, { data: candidate }] = await Promise.all([
    db.from('jobs').select('id, title, company_name, industry, client_id, fee_percentage, mandate_id, status').eq('id', (submission as any).job_id).maybeSingle(),
    db.from('candidates').select('id, full_name').eq('id', (submission as any).candidate_id).maybeSingle(),
  ]);
  must(job, 'Stelle nicht gefunden.', 'not_found');
  return { submission: submission as any, job: job as any, candidate: (candidate ?? { id: (submission as any).candidate_id, full_name: 'Kandidat' }) as any };
}

// ---------------------------------------------------------------------------
// Ab „verbindlich“: Placement, Stelle, andere Einreichungen, Rechnungsentwurf
// ---------------------------------------------------------------------------

export async function onContractFinal(ctx: PlacementCtx, contractId: string) {
  const { data: contract } = await ctx.db.from('employment_contracts').select('*').eq('id', contractId).maybeSingle();
  if (!contract || (contract as any).status !== 'final') return { created: false };
  const c = contract as any;
  const { data: existing } = await ctx.db.from('placements').select('id').eq('submission_id', c.submission_id).maybeSingle();
  if (existing) return { created: false, placementId: (existing as any).id };
  const b = await loadSubmission(ctx.db, c.submission_id);
  const gross = Math.round(((c.salary ?? 0) + (c.variable_salary ?? 0)) * 100);
  const snapshot = b.job.mandate_id ? null : fallbackSnapshot(b.job);
  const nowIso = new Date(ctx.now()).toISOString();
  const row: Record<string, unknown> = {
    submission_id: b.submission.id, start_date: c.start_date, first_working_day: c.start_date,
    agreed_salary: (c.salary ?? 0) + (c.variable_salary ?? 0), gross_annual_target_compensation_cents: gross,
    compensation_verified_at: nowIso, placement_state: 'agreed', payment_status: 'pending',
    ...(snapshot ? { pricing_snapshot: snapshot, package_key: 'core', package_version: 1, ...amountsFor(snapshot, gross) } : {}),
  };
  const { data: placement, error } = await ctx.db.from('placements').insert(row).select('*').maybeSingle();
  if (error?.code === '23505') return { created: false };
  dbFail(error, 'Die Einstellung');
  let p = placement as any;
  // Mit Auftrag rechnet der Trigger; ohne Trigger (Tests) aus dem Snapshot nachrechnen
  if (p.client_fee_cents == null && p.pricing_snapshot) Object.assign(p, amountsFor(p.pricing_snapshot, gross));

  // Bewerbung: eingestellt
  await ctx.db.from('submissions').update({ stage: 'placed' }).eq('id', b.submission.id);

  // Andere laufende Einreichungen des Kandidaten: zurückgezogen, Kunde informiert
  const { data: others } = await ctx.db.from('submissions').select('id, job_id, stage, identity_unlocked').eq('candidate_id', b.candidate.id).in('stage', ACTIVE_STAGES);
  for (const o of ((others ?? []) as any[]).filter((x) => x.id !== b.submission.id)) {
    await ctx.db.from('submissions').update({ stage: 'withdrawn' }).eq('id', o.id);
    const { data: oj } = await ctx.db.from('jobs').select('client_id, title').eq('id', o.job_id).maybeSingle();
    await notify(ctx, (oj as any)?.client_id, 'candidate_unavailable', 'Kandidat steht nicht mehr zur Verfügung', `${o.identity_unlocked ? b.candidate.full_name : 'Ein Kandidat'} für „${(oj as any)?.title ?? 'Ihre Stelle'}“ hat eine andere Stelle angenommen.`, 'submission', o.id);
  }

  // Stelle als besetzt schließen (Wahl beim Melden)
  if (c.close_job && !['closed', 'filled'].includes(b.job.status)) {
    await ctx.db.from('jobs').update({
      status: 'filled', closed_reason: 'filled_via_matchunt', closed_at: nowIso,
      closed_hire_submission_id: b.submission.id, closed_hire_start: c.start_date, closed_hire_salary: c.salary,
    }).eq('id', b.job.id);
    const { data: subs } = await ctx.db.from('submissions').select('id, recruiter_id').eq('job_id', b.job.id).in('stage', ACTIVE_STAGES);
    for (const r of [...new Set(((subs ?? []) as any[]).map((x) => x.recruiter_id).filter((x) => x && x !== b.submission.recruiter_id))]) {
      await notify(ctx, r as string, 'job_filled', 'Stelle besetzt', `„${b.job.title}“ ist besetzt. Deine Einreichungen dafür sind abgeschlossen.`, 'job', b.job.id);
    }
  }

  const invoiceId = await createInvoiceDraft(ctx, p, b, c);
  for (const uid of await adminIds(ctx.db)) {
    await notify(ctx, uid, 'invoice_draft', `Rechnung zur Freigabe: ${b.candidate.full_name}`, `${b.job.company_name} · ${eur(p.client_fee_cents ?? 0)} netto`, 'invoice', invoiceId ?? p.id);
  }
  await notify(ctx, b.submission.recruiter_id, 'placement_created', `Einstellung verbindlich: ${b.candidate.full_name}`, `Start ${dateDe(c.start_date)}. Deine Tranchen siehst du unter Verdienste.`, 'placement', p.id);
  const { error: evErr } = await ctx.db.from('employment_contract_events').insert({ contract_id: c.id, event_type: 'placement_created', actor_role: 'system', details: { placementId: p.id, invoiceId } });
  if (evErr) console.warn('[placement] Verlauf nicht gespeichert', evErr.message);
  return { created: true, placementId: p.id, invoiceId };
}

async function createInvoiceDraft(ctx: PlacementCtx, p: any, b: Awaited<ReturnType<typeof loadSubmission>>, c: any): Promise<string | null> {
  const { data: company } = await ctx.db.from('company_profiles').select('company_name, legal_name, street, postal_code, city, address, tax_id, billing_email').eq('user_id', b.job.client_id).maybeSingle();
  const cp = (company ?? {}) as any;
  const owner = await profile(ctx.db, b.job.client_id);
  const vatId = (cp.tax_id ?? '').trim() || null;
  const reverse = isReverseCharge(vatId);
  const net = Number(p.client_fee_cents ?? 0);
  const vat = reverse ? 0 : Math.round(net * VAT_RATE / 100);
  const pct = p.pricing_snapshot?.clientFeePct ?? null;
  const pkg = PACKAGE_NAMES[p.package_key ?? ''] ?? p.pricing_snapshot?.publicName ?? '';
  let reference: string | null = null;
  if (b.job.mandate_id) {
    const { data: m } = await ctx.db.from('commercial_mandates').select('mandate_number').eq('id', b.job.mandate_id).maybeSingle();
    reference = (m as any)?.mandate_number ?? null;
  }
  const recipient = {
    name: cp.legal_name || cp.company_name || b.job.company_name,
    street: cp.street || (cp.address ? String(cp.address).split(',')[0] : null),
    city: [cp.postal_code, cp.city].filter(Boolean).join(' ') || null,
    vatId,
    email: cp.billing_email || owner?.email || null,
    reference,
  };
  const lines = [{
    title: `Personalvermittlung: ${b.job.title}`,
    details: [
      `Kandidat/in: ${b.candidate.full_name} · Beginn ${dateDe(c.start_date)}`,
      `Arbeitsvertrag geschlossen am ${dateDe(c.signed_on)}`,
      `Bemessungsgrundlage: Bruttojahreszielgehalt ${eur(Number(p.gross_annual_target_compensation_cents ?? 0))}${pct ? ` × ${String(pct).replace('.', ',')} %` : ''}${pkg ? ` (${pkg})` : ''}`,
    ],
    amountCents: net,
    serviceOn: c.signed_on ?? null,
  }];
  const { data, error } = await ctx.db.from('invoices').insert({
    placement_id: p.id, client_id: b.job.client_id, invoice_number: `ENTWURF-${String(p.id).slice(0, 8)}`,
    amount: net / 100, tax_amount: vat / 100, total_amount: (net + vat) / 100,
    status: 'draft', invoice_type: 'placement_fee', amount_cents: net, tax_amount_cents: vat, total_amount_cents: net + vat,
    payment_terms_days: PAYMENT_TERMS_DAYS, pricing_snapshot: p.pricing_snapshot ?? null, mandate_id: b.job.mandate_id ?? null,
    submission_id: b.submission.id, job_id: b.job.id, vat_rate: reverse ? 0 : VAT_RATE, reverse_charge: reverse,
    recipient, lines, issued_at: todayKey(ctx.now()),
  }).select('id').maybeSingle();
  if (error) { console.warn('[placement] Rechnungsentwurf nicht angelegt', error.code, error.message); return null; }
  return (data as any)?.id ?? null;
}

// ---------------------------------------------------------------------------
// PDF, Freigabe, Zahlung
// ---------------------------------------------------------------------------

function docOf(inv: any, overrides: Partial<InvoiceDoc> = {}): InvoiceDoc {
  const r = inv.recipient ?? {};
  return {
    kind: 'invoice', draft: inv.status === 'draft', number: inv.status === 'draft' ? null : inv.invoice_number,
    issuedOn: inv.issued_at ?? new Date().toISOString().slice(0, 10), dueOn: inv.due_date ?? null,
    serviceOn: inv.lines?.[0]?.serviceOn ?? null,
    recipient: { name: r.name ?? '', street: r.street ?? null, city: r.city ?? null, vatId: r.vatId ?? null },
    reference: r.reference ?? null,
    lines: (inv.lines ?? []) as any,
    netCents: Number(inv.amount_cents ?? 0), vatRate: Number(inv.vat_rate ?? VAT_RATE), vatCents: Number(inv.tax_amount_cents ?? 0),
    totalCents: Number(inv.total_amount_cents ?? 0), reverseCharge: !!inv.reverse_charge,
    ...overrides,
  };
}

async function loadInvoice(db: SupabaseClient, invoiceId: unknown) {
  must(typeof invoiceId === 'string' && UUID.test(invoiceId), 'Ungültige Rechnung.');
  const { data, error } = await db.from('invoices').select('*').eq('id', invoiceId).maybeSingle();
  dbFail(error, 'Die Rechnung');
  must(data, 'Rechnung nicht gefunden.', 'not_found');
  return data as any;
}

async function requireAdmin(ctx: ServiceCtx, user: User) {
  must(await isAdmin(ctx.db, user.id), 'Nur für Matchunt.', 'not_allowed');
}

export async function invoicePreview(ctx: PlacementCtx, user: User, body: any) {
  await requireAdmin(ctx, user);
  const inv = await loadInvoice(ctx.db, body?.invoiceId);
  const bytes = await renderInvoicePdf(docOf(inv));
  const missingAddress = !inv.recipient?.street || !inv.recipient?.city;
  return { pdfBase64: encodeBase64(bytes), blockers: [...releaseBlockers('invoice'), ...(missingAddress ? ['Anschrift des Kunden (Firmendaten)'] : [])] };
}

export async function releaseInvoice(ctx: PlacementCtx, user: User, body: any) {
  await requireAdmin(ctx, user);
  const blockers = releaseBlockers('invoice');
  must(blockers.length === 0, `Freigabe noch gesperrt. Es fehlt: ${blockers.join(', ')}.`, 'conflict');
  const inv = await loadInvoice(ctx.db, body?.invoiceId);
  must(inv.status === 'draft', 'Die Rechnung ist schon gestellt.', 'conflict');
  // Anschrift aus den aktuellen Firmendaten (§ 14 UStG: vollständige Anschrift des Empfängers)
  const { data: company } = await ctx.db.from('company_profiles').select('company_name, legal_name, street, postal_code, city, address, tax_id').eq('user_id', inv.client_id).maybeSingle();
  const cp = (company ?? {}) as any;
  inv.recipient = {
    ...inv.recipient,
    name: cp.legal_name || cp.company_name || inv.recipient?.name,
    street: cp.street || inv.recipient?.street || null,
    city: [cp.postal_code, cp.city].filter(Boolean).join(' ') || inv.recipient?.city || null,
    vatId: (cp.tax_id ?? '').trim() || inv.recipient?.vatId || null,
  };
  must(inv.recipient.street && inv.recipient.city, 'Die Anschrift des Kunden fehlt. Bitte in den Firmendaten des Kunden Straße, PLZ und Ort ergänzen.', 'conflict');
  const recipientEmail = (typeof body?.email === 'string' && body.email.trim()) || inv.recipient?.email;
  must(recipientEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail), 'Bitte die Rechnungs-E-Mail des Kunden angeben.');
  const today = todayKey(ctx.now());
  const year = Number(today.slice(0, 4));
  const { data: n, error: nErr } = await ctx.db.rpc('next_document_number', { _kind: 'invoice', _year: year, _start: NUMBERING.invoice.startNext });
  must(!nErr && typeof n === 'number', 'Die Rechnungsnummer konnte nicht vergeben werden.');
  const number = formatNumber(NUMBERING.invoice.template, year, n as number);
  const due = plusDays(today, inv.payment_terms_days ?? PAYMENT_TERMS_DAYS);
  const final = { ...inv, status: 'open', invoice_number: number, issued_at: today, due_date: due };
  const bytes = await renderInvoicePdf(docOf(final));
  const path = `${year}/${number.replace(/[^\w.-]/g, '_')}.pdf`;
  await ctx.invoiceFiles.put(path, bytes);
  const nowIso = new Date(ctx.now()).toISOString();
  const { data: updated, error } = await ctx.db.from('invoices').update({
    status: 'open', invoice_number: number, issued_at: today, due_date: due, pdf_path: path,
    released_at: nowIso, released_by: user.id, recipient: { ...inv.recipient, email: recipientEmail },
  }).eq('id', inv.id).eq('status', 'draft').select('*').maybeSingle();
  dbFail(error, 'Die Rechnung');
  must(updated, 'Die Rechnung wurde gerade schon freigegeben.', 'conflict');
  await ctx.db.from('placements').update({ invoice_state: 'invoiced' }).eq('id', inv.placement_id);

  // Versand an die Rechnungs-E-Mail, PDF im Anhang
  const heading = `Rechnung ${number}`;
  const body2 = [
    `<p style="margin:0 0 12px 0;">Guten Tag,</p>`,
    `<p style="margin:0 0 12px 0;">anbei unsere Rechnung <strong>${esc(number)}</strong> über <strong>${esc(eur(Number(inv.total_amount_cents)))}</strong> für die Personalvermittlung (${esc(inv.lines?.[0]?.title?.replace('Personalvermittlung: ', '') ?? '')}).</p>`,
    `<p style="margin:0 0 12px 0;">Zahlbar bis ${esc(dateDe(due))}. Bei Fragen antworten Sie einfach auf diese Mail.</p>`,
  ].join('');
  const result = await ctx.mail({
    fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: recipientEmail, replyTo: 'info@bluewater-bridge.de',
    subject: `${heading} – Matchunt`, html: layout({ preheader: heading, heading, body: body2 }),
    text: `${heading}\nBetrag: ${eur(Number(inv.total_amount_cents))}\nZahlbar bis ${dateDe(due)}`,
    attachments: [{ filename: `${number.replace(/[^\w.-]/g, '_')}.pdf`, contentBase64: encodeBase64(bytes), contentType: 'application/pdf' }],
  }, { template: 'invoice_issued', meta: { invoice_id: inv.id } });
  if (result.sent) await ctx.db.from('invoices').update({ sent_at: nowIso, sent_to: recipientEmail }).eq('id', inv.id);

  // Kundenteam im Dashboard
  if (inv.submission_id) {
    const { data: offer } = await ctx.db.from('offers').select('created_by').eq('submission_id', inv.submission_id).eq('status', 'accepted').maybeSingle();
    for (const uid of [...new Set([(offer as any)?.created_by, inv.client_id].filter(Boolean))] as string[]) {
      await notify(ctx, uid, 'invoice_issued', `Rechnung ${number}`, `${eur(Number(inv.total_amount_cents))}, zahlbar bis ${dateDe(due)}`, 'submission', inv.submission_id);
    }
  }
  return { ok: true, number, sent: result.sent, mailError: result.sent ? null : result.error ?? null };
}

export async function bookPayment(ctx: PlacementCtx, user: User, body: any) {
  await requireAdmin(ctx, user);
  const inv = await loadInvoice(ctx.db, body?.invoiceId);
  must(['open', 'partially_paid', 'pending', 'overdue'].includes(inv.status), 'Für diese Rechnung ist keine Zahlung offen.', 'conflict');
  must(typeof body?.paidOn === 'string' && DATE.test(body.paidOn) && body.paidOn <= todayKey(ctx.now()), 'Bitte das Datum des Zahlungseingangs angeben.');
  const amount = Math.round(Number(body?.amountCents));
  must(Number.isFinite(amount) && amount > 0, 'Bitte den Betrag laut Konto angeben.');
  const paidTotal = Number(inv.paid_amount_cents ?? 0) + amount;
  const full = paidTotal >= Number(inv.total_amount_cents);
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 1000) || null : null;
  await ctx.db.from('invoices').update({ status: full ? 'paid' : 'partially_paid', paid_amount_cents: paidTotal, paid_at: full ? `${body.paidOn}T12:00:00Z` : null, payment_note: note }).eq('id', inv.id);
  if (full) {
    await ctx.db.from('placements').update({ invoice_state: 'paid', payment_status: 'paid', paid_at: `${body.paidOn}T12:00:00Z` }).eq('id', inv.placement_id);
    const { data: p } = await ctx.db.from('placements').select('submission_id').eq('id', inv.placement_id).maybeSingle();
    if (p) {
      const { data: s } = await ctx.db.from('submissions').select('recruiter_id, candidate_id').eq('id', (p as any).submission_id).maybeSingle();
      await notify(ctx, (s as any)?.recruiter_id, 'placement_paid', 'Kunde hat bezahlt', `Rechnung ${inv.invoice_number}. Tranche 1 folgt nach dem Antritt.`, 'placement', inv.placement_id);
    }
  }
  return { ok: true, status: full ? 'paid' : 'partially_paid', paidTotal };
}

export async function invoiceFile(ctx: PlacementCtx, user: User, body: any) {
  const inv = await loadInvoice(ctx.db, body?.invoiceId);
  must(inv.status !== 'draft' && inv.pdf_path, 'Die Rechnung ist noch nicht gestellt.', 'not_found');
  const allowed = (await isAdmin(ctx.db, user.id)) || inv.client_id === user.id || (inv.job_id && (await canUserActOnJob(ctx.db, user.id, inv.job_id)));
  must(allowed, 'Dafür fehlt Ihnen die Berechtigung.', 'not_allowed');
  const url = await ctx.invoiceFiles.url(inv.pdf_path, 120);
  must(url, 'Das PDF ist gerade nicht abrufbar.', 'not_found');
  return { url };
}

// ---------------------------------------------------------------------------
// Admin › Besetzungen: Fahrplan und Rechnungen
// ---------------------------------------------------------------------------

export async function adminOverview(ctx: PlacementCtx, user: User) {
  await requireAdmin(ctx, user);
  const today = todayKey(ctx.now());
  const [{ data: placements }, { data: invoices }] = await Promise.all([
    ctx.db.from('placements').select('*').order('created_at', { ascending: false }).limit(200),
    ctx.db.from('invoices').select('*').order('created_at', { ascending: false }).limit(300),
  ]);
  const invByPlacement = new Map<string, any>();
  for (const i of (invoices ?? []) as any[]) if (i.invoice_type === 'placement_fee' && !invByPlacement.has(i.placement_id)) invByPlacement.set(i.placement_id, i);
  const rows = [];
  for (const p of (placements ?? []) as any[]) {
    const { data: s } = await ctx.db.from('submissions').select('id, job_id, candidate_id, recruiter_id').eq('id', p.submission_id).maybeSingle();
    if (!s) continue;
    const [{ data: job }, { data: cand }] = await Promise.all([
      ctx.db.from('jobs').select('title, company_name').eq('id', (s as any).job_id).maybeSingle(),
      ctx.db.from('candidates').select('full_name').eq('id', (s as any).candidate_id).maybeSingle(),
    ]);
    const rec = await profile(ctx.db, (s as any).recruiter_id);
    const inv = invByPlacement.get(p.id) ?? null;
    const overdue = inv && ['open', 'partially_paid'].includes(inv.status) && inv.due_date && inv.due_date < today;
    const next = !inv ? { key: 'no_invoice', label: 'Rechnung fehlt' }
      : inv.status === 'draft' ? { key: 'release', label: 'Rechnung freigeben' }
        : ['open', 'partially_paid'].includes(inv.status) ? { key: 'payment', label: overdue ? 'Überfällig: Zahlung prüfen' : 'Zahlung eingegangen?' }
          : p.placement_state === 'agreed' ? { key: 'wait_start', label: `wartet auf Start ${dateDe(p.first_working_day ?? p.start_date)}` }
            : { key: 'none', label: 'nichts zu tun' };
    rows.push({
      placementId: p.id, submissionId: p.submission_id, candidateName: (cand as any)?.full_name ?? 'Kandidat', companyName: (job as any)?.company_name ?? '',
      jobTitle: (job as any)?.title ?? '', recruiterName: rec?.name ?? null, packageKey: p.package_key, startDate: p.first_working_day ?? p.start_date,
      placementState: p.placement_state, invoiceState: p.invoice_state, clientFeeCents: p.client_fee_cents, recruiterInitialCents: p.recruiter_initial_cents,
      recruiterRetentionCents: p.recruiter_retention_cents, matchuntCents: p.matchunt_cents,
      invoice: inv ? { id: inv.id, number: inv.status === 'draft' ? null : inv.invoice_number, status: inv.status, totalCents: inv.total_amount_cents, dueDate: inv.due_date, overdue: !!overdue } : null,
      next,
    });
  }
  const list = ((invoices ?? []) as any[]).map((i) => ({
    id: i.id, number: i.status === 'draft' ? null : i.invoice_number, status: i.status, type: i.invoice_type, issuedAt: i.issued_at, dueDate: i.due_date,
    totalCents: i.total_amount_cents ?? Math.round(Number(i.total_amount ?? 0) * 100), paidCents: i.paid_amount_cents, recipient: i.recipient?.name ?? null,
    email: i.recipient?.email ?? null, sentAt: i.sent_at, hasPdf: !!i.pdf_path, overdue: ['open', 'partially_paid'].includes(i.status) && !!i.due_date && i.due_date < today,
  }));
  const sum = (f: (i: any) => boolean) => list.filter(f).reduce((a, i) => a + Number(i.totalCents ?? 0) - Number(i.paidCents ?? 0), 0);
  return {
    rows, invoices: list,
    kpis: { openCents: sum((i) => ['open', 'partially_paid'].includes(i.status)), overdueCents: sum((i) => i.overdue), drafts: list.filter((i) => i.status === 'draft').length },
    blockers: releaseBlockers('invoice'),
  };
}
