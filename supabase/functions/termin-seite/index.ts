// deno-lint-ignore-file no-explicit-any
/**
 * termin-seite – öffentliche Terminseite des Headhunters (21.10.2026).
 *
 * Kandidaten (ohne Konto) sehen auf matchunt.ai/t/<slug>/<stelle> die Stelle
 * anonym und nur Zeiten, die im verbundenen Outlook des Headhunters frei sind;
 * sie buchen ein Erstgespräch, optional mit Lebenslauf, und können über den
 * Link aus der Mail verschieben oder absagen.
 *
 * Aktionen (body.action):
 *   seite       { slug, stelle? }                 → Headhunter, Steckbrief, freie Zeiten
 *   lebenslauf  { slug, datei?, text?, name, typ } → liest Kontakt aus, merkt die Datei vor
 *   buchen      { slug, stelle?, start, mode, first_name, last_name, email, phone?, linkedin_url?, note?, consent, upload_id?, website }
 *   termin      { token }                         → gebuchter Termin + andere freie Zeiten
 *   verschieben { token, start }
 *   absagen     { token, grund? }
 *
 * Öffentlich (verify_jwt = false). Alles läuft mit Service-Role; geprüft wird
 * hier: aktive Terminseite, laufende Suche, Ratenbegrenzung, Bot-Falle, freie Zeit.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { clientIp, fail, json, preflight } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { checkLimits, LIMITS } from '../_shared/intake-limits.ts';
import { generateToken, hashToken } from '../_shared/tokens.ts';
import { getPublicAppUrl } from '../_shared/app-url.ts';
import { createTeamsEvent, deleteEvent, getBusy, loadConnection, msConfig, userAccessToken } from '../_shared/msgraph-calendar.ts';
import type { Interval } from '../_shared/interview-availability.ts';
import { buildIcs } from '../_shared/interview-ics.ts';
import { sendInterviewMail } from '../_shared/interview-mailer.ts';
import {
  einstellungenAus, freieZeiten, initialen, nachTagen, passtZurStelle, pruefeBuchung, steckbrief, terminText, zeitNochFrei,
  type Gespraechsart, type TerminEinstellungen,
} from '../_shared/termin-seite.ts';
import { headhunterAbgesagt, headhunterNeu, kandidatAbgesagt, kandidatBestaetigt } from '../_shared/termin-mails.ts';
import { pdfToText, PdfTextError } from '../_shared/pdf-text.ts';
import { buildCvSystemPrompt, buildCvUserPrompt, CV_TOOL, prepareCvText, splitContactHeader, validateCv } from '../_shared/cv-extraction.ts';
import { aiChat } from '../_shared/ai.ts';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;
const imHintergrund = (p: Promise<unknown>) => {
  const sicher = p.catch((e) => console.error('termin-seite hintergrund', e instanceof Error ? e.message : e));
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(sicher);
};

const FROM_EMAIL = () => Deno.env.get('INTERVIEW_FROM_EMAIL') ?? 'termine@matchunt.ai';
const MAX_DATEI = 10 * 1024 * 1024;

class Fehler extends Error {
  constructor(public grund: Parameters<typeof fail>[0], meldung: string, public extra?: Record<string, unknown>) { super(meldung); }
}
function muss(bedingung: unknown, grund: Parameters<typeof fail>[0], meldung: string): asserts bedingung {
  if (!bedingung) throw new Fehler(grund, meldung);
}

interface Seite {
  recruiter_id: string; slug: string; active: boolean; e: TerminEinstellungen;
  name: string; vorname: string; titel: string | null; linkedin: string | null; email: string | null;
}

async function ladeSeite(db: SupabaseClient, slug: unknown): Promise<Seite> {
  const s = typeof slug === 'string' ? slug.trim().toLowerCase() : '';
  muss(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s), 'not_found', 'Diese Terminseite gibt es nicht.');
  const { data: page } = await db.from('recruiter_booking_pages').select('*').eq('slug', s).maybeSingle();
  muss(page, 'not_found', 'Diese Terminseite gibt es nicht.');
  const { data: prof } = await db.from('profiles').select('full_name, role_title, linkedin_url, email').eq('user_id', page.recruiter_id).maybeSingle();
  const name = (prof?.full_name ?? '').trim() || 'Dein Headhunter';
  return {
    recruiter_id: page.recruiter_id, slug: page.slug, active: !!page.active, e: einstellungenAus(page),
    name, vorname: name.split(/\s+/)[0], titel: prof?.role_title && prof.role_title !== 'Talent Acquisition Manager' ? prof.role_title : null,
    linkedin: prof?.linkedin_url ? `https://www.${String(prof.linkedin_url).replace(/^https?:\/\//, '').replace(/^www\./, '')}` : null,
    email: prof?.email ?? null,
  };
}

interface Stelle { job: Record<string, any>; offen: boolean; teil: string }

/** Die Stelle zum Link-Teil, nur unter den Stellen, die der Headhunter sucht oder gesucht hat. */
async function ladeStelle(db: SupabaseClient, seite: Seite, teil: unknown): Promise<Stelle | null> {
  const t = typeof teil === 'string' ? teil.trim().toLowerCase() : '';
  if (!t) return null;
  const { data: akt } = await db.from('recruiter_job_activations').select('job_id, status').eq('recruiter_id', seite.recruiter_id).in('status', ['active', 'paused']);
  const kandidaten = (akt ?? []).filter((a: any) => passtZurStelle(a.job_id, t));
  if (!kandidaten.length) return null;
  const { data: jobs } = await db.from('jobs').select('*').in('id', kandidaten.map((a: any) => a.job_id));
  // Eindeutig über den ganzen Link-Teil (Titel + ID-Anfang); sonst der erste Treffer.
  const job = (jobs ?? []).find((j: any) => jobTeil(j) === t) ?? (jobs ?? [])[0];
  if (!job) return null;
  const treffer = kandidaten.find((a: any) => a.job_id === job.id)!;
  const pausiert = !!job.paused_at && (!job.pause_until || Date.parse(job.pause_until) > Date.now());
  return { job, teil: t, offen: treffer.status === 'active' && job.status === 'published' && !pausiert };
}

async function gehaltZeigen(db: SupabaseClient, recruiterId: string, jobId: string): Promise<boolean> {
  const { data } = await db.from('job_linkedin_posts').select('show_salary').eq('recruiter_id', recruiterId).eq('job_id', jobId)
    .in('status', ['posted', 'manual']).order('posted_at', { ascending: false }).limit(1);
  return data?.[0]?.show_salary ?? true;
}

/** Outlook des Headhunters: Token und belegte Zeiten. null = nicht verbunden oder nicht lesbar. */
async function kalender(db: SupabaseClient, recruiterId: string, fromMs: number, toMs: number): Promise<{ token: string; busy: Interval[] } | null> {
  // Nur für lokale Tests (TERMIN_TEST_KALENDER=1): morgen 10–11 Uhr belegt, kein Outlook. In Lovable nie setzen.
  if (Deno.env.get('TERMIN_TEST_KALENDER') === '1') {
    const morgen = new Date(Date.now() + 86400000);
    const zehn = Date.parse(`${morgen.toISOString().slice(0, 10)}T08:00:00Z`);
    return { token: '', busy: [{ start: zehn, end: zehn + 3600000 }] };
  }
  const cfg = msConfig();
  if (!cfg) return null;
  const conn = await loadConnection(db, recruiterId);
  const adresse = (conn as any)?.account_email ? String((conn as any).account_email).toLowerCase() : null;
  if (!adresse) return null;
  const token = await userAccessToken(db, cfg, recruiterId).catch(() => null);
  if (!token) return null;
  const busy = await getBusy(token, [adresse], fromMs, toMs).then((r) => r[adresse] ?? null).catch(() => null);
  return busy ? { token, busy } : null;
}

async function gebuchteZeiten(db: SupabaseClient, recruiterId: string, fromMs: number, toMs: number, ohne?: string): Promise<Interval[]> {
  const { data } = await db.from('recruiter_bookings').select('id, starts_at, ends_at').eq('recruiter_id', recruiterId).eq('status', 'booked')
    .gte('ends_at', new Date(fromMs).toISOString()).lte('starts_at', new Date(toMs).toISOString());
  return (data ?? []).filter((b: any) => b.id !== ohne).map((b: any) => ({ start: Date.parse(b.starts_at), end: Date.parse(b.ends_at) }));
}

async function zeitenFuer(db: SupabaseClient, seite: Seite, ohne?: string): Promise<{ verbunden: boolean; tage: { tag: string; zeiten: string[] }[] }> {
  const jetzt = Date.now();
  const bis = jetzt + seite.e.rules.horizonDays * 86400000;
  const k = await kalender(db, seite.recruiter_id, jetzt, bis);
  if (!k) return { verbunden: false, tage: [] };
  const gebucht = await gebuchteZeiten(db, seite.recruiter_id, jetzt, bis, ohne);
  return { verbunden: true, tage: nachTagen(freieZeiten(seite.e, jetzt, k.busy, gebucht)) };
}

const headhunterOeffentlich = (s: Seite) => ({ name: s.name, initialen: initialen(s.name), titel: s.titel, linkedin: s.linkedin });

// ---------------------------------------------------------------------------

async function seiteZeigen(db: SupabaseClient, body: any) {
  const seite = await ladeSeite(db, body.slug);
  const stelle = await ladeStelle(db, seite, body.stelle);
  const sb = stelle ? steckbrief(stelle.job, await gehaltZeigen(db, seite.recruiter_id, stelle.job.id)) : null;
  const buchbar = seite.active && (!body.stelle || stelle?.offen === true);
  const z = buchbar ? await zeitenFuer(db, seite) : { verbunden: true, tage: [] };
  return json({
    headhunter: headhunterOeffentlich(seite),
    stelle: sb,
    stelle_gefunden: !body.stelle || !!stelle,
    offen: buchbar,
    pausiert: !seite.active,
    kalender: z.verbunden,
    dauer: seite.e.dauer,
    arten: seite.e.arten,
    tage: z.tage,
  });
}

function zerlegeName(voll: string): { first_name: string; last_name: string } {
  const teile = voll.trim().split(/\s+/).filter(Boolean);
  if (teile.length < 2) return { first_name: teile[0] ?? '', last_name: '' };
  return { first_name: teile.slice(0, -1).join(' '), last_name: teile[teile.length - 1] };
}

async function lebenslaufLesen(db: SupabaseClient, body: any) {
  const seite = await ladeSeite(db, body.slug);
  muss(seite.active, 'not_allowed', 'Diese Terminseite nimmt gerade keine Buchungen an.');
  const name = typeof body.name === 'string' ? body.name.slice(0, 160) : 'lebenslauf';
  const typ = typeof body.typ === 'string' ? body.typ.slice(0, 120) : '';
  let bytes: Uint8Array | null = null;
  if (typeof body.datei === 'string' && body.datei) {
    const b64 = body.datei.replace(/^data:[^;]+;base64,/, '');
    muss(b64.length < MAX_DATEI * 1.4, 'invalid_request', 'Die Datei ist größer als 10 MB.');
    bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    muss(bytes.length <= MAX_DATEI, 'invalid_request', 'Die Datei ist größer als 10 MB.');
  }
  const istPdf = !!bytes && String.fromCharCode(...bytes.subarray(0, 4)) === '%PDF';
  let roh = typeof body.text === 'string' ? body.text.slice(0, 40000) : '';
  let hinweise: Record<string, unknown> = {};
  if (!roh.trim() && istPdf && bytes) {
    const r = await pdfToText(bytes, { contactHeader: true });
    const kopf = splitContactHeader(r.text);
    roh = kopf.text.slice(0, 40000);
    hinweise = kopf.hints as Record<string, unknown>;
  }
  muss(bytes || roh.trim(), 'invalid_request', 'Bitte lade einen Lebenslauf als PDF oder Word hoch.');
  muss(istPdf || /word|officedocument|msword/.test(typ) || /\.(docx?|pdf)$/i.test(name), 'invalid_request', 'Bitte lade den Lebenslauf als PDF oder Word hoch.');
  const kontakt = roh.trim().length >= 40 ? prepareCvText(roh, hinweise as any).contact : null;
  let pfad = '';
  if (bytes) {
    pfad = `${seite.recruiter_id}/termin-${crypto.randomUUID()}-${name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80)}`;
    const { error } = await db.storage.from('cv-documents').upload(pfad, bytes, { contentType: istPdf ? 'application/pdf' : (typ || 'application/octet-stream') });
    muss(!error, 'internal_error', 'Der Lebenslauf konnte nicht gespeichert werden.');
  }
  const { data: up, error } = await db.from('booking_cv_uploads').insert({
    recruiter_id: seite.recruiter_id, path: pfad, file_name: name, file_size: bytes?.length ?? null,
    mime_type: istPdf ? 'application/pdf' : typ || null, raw_text: roh || null, hints: kontakt ?? {},
  }).select('id').single();
  muss(!error && up, 'internal_error', 'Der Lebenslauf konnte nicht gespeichert werden.');
  const n = kontakt?.full_name ? zerlegeName(kontakt.full_name) : { first_name: '', last_name: '' };
  return json({
    upload_id: up.id,
    gelesen: !!kontakt,
    felder: { ...n, email: kontakt?.email ?? '', phone: kontakt?.phone ?? '', linkedin_url: kontakt?.linkedin_url ?? '' },
  });
}

/** Kandidat im Talent Pool des Headhunters: gleiche E-Mail wird ergänzt statt doppelt angelegt. */
async function kandidatAnlegen(db: SupabaseClient, recruiterId: string, b: { first_name: string; last_name: string; email: string; phone: string | null; linkedin_url: string | null }, herkunft: string): Promise<{ id: string; neu: boolean }> {
  const { data: alt } = await db.from('candidates').select('id, phone, linkedin_url').eq('recruiter_id', recruiterId).ilike('email', b.email).limit(1);
  if (alt?.[0]) {
    const ergaenzen: Record<string, unknown> = {};
    if (!alt[0].phone && b.phone) ergaenzen.phone = b.phone;
    if (!alt[0].linkedin_url && b.linkedin_url) ergaenzen.linkedin_url = b.linkedin_url;
    if (Object.keys(ergaenzen).length) await db.from('candidates').update(ergaenzen).eq('id', alt[0].id);
    return { id: alt[0].id, neu: false };
  }
  const { data, error } = await db.from('candidates').insert({
    recruiter_id: recruiterId, full_name: `${b.first_name} ${b.last_name}`.trim(), email: b.email,
    phone: b.phone, linkedin_url: b.linkedin_url, import_source: herkunft,
  }).select('id').single();
  if (error || !data) throw new Fehler('internal_error', 'Der Termin konnte nicht gebucht werden.');
  return { id: data.id, neu: true };
}

async function lebenslaufAnhaengen(db: SupabaseClient, recruiterId: string, candidateId: string, uploadId: string, bookingId: string) {
  const { data: up } = await db.from('booking_cv_uploads').select('*').eq('id', uploadId).eq('recruiter_id', recruiterId).is('used_by', null).maybeSingle();
  if (!up) return null;
  await db.from('booking_cv_uploads').update({ used_by: bookingId }).eq('id', uploadId);
  if (up.path) {
    const { data: { publicUrl } } = db.storage.from('cv-documents').getPublicUrl(up.path);
    await db.from('candidate_documents').update({ is_current: false }).eq('candidate_id', candidateId).eq('document_type', 'cv');
    const { data: alt } = await db.from('candidate_documents').select('version').eq('candidate_id', candidateId).eq('document_type', 'cv').order('version', { ascending: false }).limit(1);
    await db.from('candidate_documents').insert({
      candidate_id: candidateId, document_type: 'cv', version: (alt?.[0]?.version ?? 0) + 1, file_name: up.file_name, file_url: publicUrl,
      file_size: up.file_size, mime_type: up.mime_type, is_current: true, uploaded_by: recruiterId, notes: 'Beim Buchen über die Terminseite hochgeladen',
    });
    await db.from('candidates').update({ cv_url: publicUrl }).eq('id', candidateId);
  }
  return up as { raw_text: string | null; hints: any };
}

/** Akte aus dem Lebenslauf vorbefüllen (im Hintergrund; nur leere Felder, nichts überschreiben). */
async function akteVorbefuellen(db: SupabaseClient, candidateId: string, roh: string, hinweise: any) {
  if (!roh || roh.trim().length < 40) return;
  const prepared = prepareCvText(roh, hinweise ?? {});
  const result = await aiChat({ system: buildCvSystemPrompt(), user: buildCvUserPrompt(prepared.redacted, ''), tool: CV_TOOL, temperature: 0 });
  const now = new Date();
  const cv = validateCv(result.toolArguments, prepared, '', `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`);
  const { data: c } = await db.from('candidates').select('job_title, company, experience_years, city, cv_ai_summary').eq('id', candidateId).maybeSingle();
  const wert = (k: string) => (cv.fields as any)[k]?.value ?? null;
  const update: Record<string, unknown> = { cv_raw_text: roh, cv_parsed_at: now.toISOString(), cv_parser_version: cv.version };
  if (!c?.job_title && wert('job_title')) update.job_title = wert('job_title');
  if (!c?.company && wert('company')) update.company = wert('company');
  if (c?.experience_years == null && typeof wert('experience_years') === 'number') update.experience_years = wert('experience_years');
  if (!c?.city && cv.contact.city) update.city = cv.contact.city;
  if (!c?.cv_ai_summary && cv.suggestions.summary) { update.cv_ai_summary = cv.suggestions.summary; update.cv_ai_bullets = cv.suggestions.highlights.length ? cv.suggestions.highlights : null; }
  await db.from('candidates').update(update).eq('id', candidateId);
  const { count } = await db.from('candidate_experiences').select('id', { count: 'exact', head: true }).eq('candidate_id', candidateId);
  if (!count && cv.stations.length) {
    const monat = (ym: string | null) => (ym ? `${ym}-01` : null);
    await db.from('candidate_experiences').insert(cv.stations.map((s, i) => ({
      candidate_id: candidateId, company_name: s.company_name || null, job_title: s.job_title || null, location: s.location || null,
      start_date: monat(s.start), end_date: s.is_current ? null : monat(s.end), is_current: s.is_current, description: s.description || null, sort_order: i,
    })));
  }
  const { count: ausb } = await db.from('candidate_educations').select('id', { count: 'exact', head: true }).eq('candidate_id', candidateId);
  if (!ausb && cv.educations.length) {
    await db.from('candidate_educations').insert(cv.educations.map((e, i) => ({
      candidate_id: candidateId, institution: e.institution, degree: e.degree || null, field_of_study: e.field_of_study || null,
      graduation_year: e.graduation_year, grade: e.grade || null, sort_order: i,
    })));
  }
  const { count: sk } = await db.from('candidate_skills').select('id', { count: 'exact', head: true }).eq('candidate_id', candidateId);
  if (!sk && cv.skills.length) await db.from('candidate_skills').insert(cv.skills.slice(0, 30).map((s) => ({ candidate_id: candidateId, skill_name: s.name, years_experience: s.years })));
  const { count: sp } = await db.from('candidate_languages').select('id', { count: 'exact', head: true }).eq('candidate_id', candidateId);
  if (!sp && cv.languages.length) await db.from('candidate_languages').insert(cv.languages.map((l) => ({ candidate_id: candidateId, language: l.language, proficiency: l.level || null })));
}

function icsFuer(o: { bookingId: string; sequence: number; method: 'REQUEST' | 'CANCEL'; startIso: string; dauer: number; seite: Seite; stelle: string | null; mode: Gespraechsart; joinUrl: string | null; email: string; name: string; verwaltenUrl: string }) {
  return buildIcs({
    method: o.method, uid: `termin-${o.bookingId}@matchunt.ai`, sequence: o.sequence, startIso: o.startIso, durationMinutes: o.dauer,
    summary: `Gespräch mit ${o.seite.name}${o.stelle ? ` · ${o.stelle}` : ''}`,
    description: `${o.mode === 'teams' ? `Microsoft Teams: ${o.joinUrl ?? 'Link folgt per Mail'}` : `${o.seite.vorname} ruft dich an.`}\nVerschieben oder absagen: ${o.verwaltenUrl}`,
    location: o.mode === 'teams' ? 'Microsoft Teams' : 'Telefon', url: o.verwaltenUrl,
    organizerEmail: FROM_EMAIL(), organizerName: `${o.seite.name} über Matchunt`, attendeeEmail: o.email, attendeeName: o.name,
  });
}

async function ereignisAnlegen(token: string, o: { bookingId: string; startMs: number; endMs: number; name: string; stelle: string | null; mode: Gespraechsart; phone: string | null; akteUrl: string; herkunft: string }) {
  if (!token) return { eventId: null as unknown as string, joinUrl: o.mode === 'teams' ? 'https://teams.microsoft.com/l/meetup-join/test-matchunt' : null }; // Testkalender
  return createTeamsEvent(token, {
    subject: `Erstgespräch ${o.name}${o.stelle ? ` · ${o.stelle}` : ''} (Matchunt)`,
    bodyHtml: `<p>${o.mode === 'phone' ? `Telefon: ${o.phone ?? ''} · du rufst an` : 'Microsoft Teams'}</p><p>Akte: <a href="${o.akteUrl}">${o.akteUrl}</a></p><p>Gebucht über ${o.herkunft === 'linkedin_beitrag' ? 'deinen LinkedIn-Beitrag' : 'deine Terminseite'}.</p>`,
    startMs: o.startMs, endMs: o.endMs, attendees: [], transactionId: `termin-${o.bookingId}-${o.startMs}`,
    online: o.mode === 'teams', location: o.mode === 'phone' ? `Telefon ${o.phone ?? ''}` : undefined,
  });
}

async function buchen(db: SupabaseClient, body: any, ip: string | null) {
  const seite = await ladeSeite(db, body.slug);
  muss(seite.active, 'not_allowed', 'Diese Terminseite nimmt gerade keine Buchungen an.');
  const p = pruefeBuchung(body, seite.e);
  if (!p.ok) {
    if (p.bot) return json({ ok: true, termin: null }); // Bots bekommen kein Signal
    throw new Fehler('invalid_request', p.meldung, { feld: p.feld });
  }
  const b = p.buchung;
  const grenze = await checkLimits(db, LIMITS.terminBuchen(ip, b.email));
  muss(grenze.allowed, 'rate_limited', 'Du hast heute schon mehrere Termine gebucht. Versuch es morgen wieder.');
  const stelle = await ladeStelle(db, seite, body.stelle);
  if (body.stelle) muss(stelle?.offen, 'not_allowed', 'Diese Stelle ist gerade nicht offen.');
  const startMs = Date.parse(b.start);
  const endMs = startMs + seite.e.dauer * 60000;
  const k = await kalender(db, seite.recruiter_id, startMs - 86400000, endMs + 86400000);
  muss(k, 'conflict', 'Die Terminseite ist gerade nicht erreichbar. Versuch es gleich noch einmal.');
  const gebucht = await gebuchteZeiten(db, seite.recruiter_id, startMs - 86400000, endMs + 86400000);
  if (!zeitNochFrei(seite.e, Date.now(), k.busy, gebucht, b.start)) {
    const z = await zeitenFuer(db, seite);
    throw new Fehler('conflict', 'Diese Zeit wurde eben vergeben.', { tage: z.tage });
  }
  const herkunft = stelle ? 'linkedin_beitrag' : 'terminseite';
  const token = generateToken();
  const { data: post } = stelle
    ? await db.from('job_linkedin_posts').select('id').eq('recruiter_id', seite.recruiter_id).eq('job_id', stelle.job.id).in('status', ['posted', 'manual']).order('posted_at', { ascending: false }).limit(1)
    : { data: null };
  const { data: row, error } = await db.from('recruiter_bookings').insert({
    recruiter_id: seite.recruiter_id, job_id: stelle?.job.id ?? null, starts_at: b.start, ends_at: new Date(endMs).toISOString(),
    mode: b.mode, first_name: b.first_name, last_name: b.last_name, email: b.email, phone: b.phone, linkedin_url: b.linkedin_url,
    note: b.note, source: herkunft, post_id: post?.[0]?.id ?? null, manage_token_hash: await hashToken(token),
  }).select('id').single();
  if (error?.code === '23505') {
    const z = await zeitenFuer(db, seite);
    throw new Fehler('conflict', 'Diese Zeit wurde eben vergeben.', { tage: z.tage });
  }
  muss(!error && row, 'internal_error', 'Der Termin konnte nicht gebucht werden.');

  const app = getPublicAppUrl();
  const kandidat = await kandidatAnlegen(db, seite.recruiter_id, b, herkunft);
  const akteUrl = `${app}/recruiter/candidates/${kandidat.id}`;
  const verwaltenUrl = `${app}/t/termin/${token}`;
  const upload = b.upload_id ? await lebenslaufAnhaengen(db, seite.recruiter_id, kandidat.id, b.upload_id, row.id) : null;
  const name = `${b.first_name} ${b.last_name}`;
  const stellenTitel = stelle?.job.title ?? null;

  let joinUrl: string | null = null;
  let eventId: string | null = null;
  try {
    const ev = await ereignisAnlegen(k.token, { bookingId: row.id, startMs, endMs, name, stelle: stellenTitel, mode: b.mode, phone: b.phone, akteUrl, herkunft });
    eventId = ev.eventId;
    joinUrl = ev.joinUrl;
  } catch (e) {
    console.error('termin-seite outlook', e instanceof Error ? e.message : e);
  }
  await db.from('recruiter_bookings').update({ candidate_id: kandidat.id, outlook_event_id: eventId, join_url: joinUrl }).eq('id', row.id);

  const anKandidat = kandidatBestaetigt({ vorname: b.first_name, hhName: seite.name, stelle: stellenTitel, startIso: b.start, dauer: seite.e.dauer, mode: b.mode, joinUrl, verwaltenUrl, mitLebenslauf: !!upload });
  await sendInterviewMail({
    fromEmail: FROM_EMAIL(), fromName: `${seite.name} über Matchunt`, to: b.email, subject: anKandidat.subject, html: anKandidat.html, text: anKandidat.text,
    replyTo: seite.email ?? undefined,
    ics: { method: 'REQUEST', content: icsFuer({ bookingId: row.id, sequence: 0, method: 'REQUEST', startIso: b.start, dauer: seite.e.dauer, seite, stelle: stellenTitel, mode: b.mode, joinUrl, email: b.email, name, verwaltenUrl }) },
  }).catch((e) => console.error('termin-seite mail kandidat', e));
  if (seite.email) {
    const anHH = headhunterNeu({
      hhVorname: seite.vorname, kandidat: { name, email: b.email, phone: b.phone, linkedin: b.linkedin_url, note: b.note }, stelle: stellenTitel,
      startIso: b.start, dauer: seite.e.dauer, mode: b.mode, joinUrl, imOutlook: !!eventId, akteUrl, herkunft, lebenslauf: !!upload,
    });
    await sendInterviewMail({ fromEmail: FROM_EMAIL(), fromName: 'Matchunt', to: seite.email, subject: anHH.subject, html: anHH.html, text: anHH.text, replyTo: b.email })
      .catch((e) => console.error('termin-seite mail headhunter', e));
  }
  await db.from('notifications').insert({
    user_id: seite.recruiter_id, type: 'booking_created', title: `Neuer Termin: ${name}`,
    message: `${terminText(new Date(startMs).toISOString())}${stellenTitel ? ` · ${stellenTitel}` : ''}${herkunft === 'linkedin_beitrag' ? ' · über LinkedIn' : ''}`,
    related_type: 'candidate', related_id: kandidat.id,
  });
  await db.from('consents').insert({
    subject_id: kandidat.id, subject_type: 'candidate', consent_type: 'candidate_data_processing', granted: true,
    granted_at: new Date().toISOString(), scope: row.id, version: 'terminseite-2026-10',
  }).then(() => undefined, () => undefined);
  if (upload?.raw_text) imHintergrund(akteVorbefuellen(db, kandidat.id, upload.raw_text, upload.hints));

  return json({ ok: true, termin: { start: b.start, ende: new Date(endMs).toISOString(), mode: b.mode, join_url: joinUrl, headhunter: seite.name }, verwalten_url: verwaltenUrl });
}

async function ladeTermin(db: SupabaseClient, token: unknown) {
  muss(typeof token === 'string' && token.length >= 20, 'not_found', 'Diesen Termin gibt es nicht.');
  const { data: t } = await db.from('recruiter_bookings').select('*').eq('manage_token_hash', await hashToken(token)).maybeSingle();
  muss(t, 'not_found', 'Diesen Termin gibt es nicht.');
  const { data: page } = await db.from('recruiter_booking_pages').select('slug').eq('recruiter_id', t.recruiter_id).maybeSingle();
  muss(page, 'not_found', 'Diesen Termin gibt es nicht.');
  const seite = await ladeSeite(db, page.slug);
  const { data: job } = t.job_id ? await db.from('jobs').select('id, title').eq('id', t.job_id).maybeSingle() : { data: null };
  return { t, seite, stelle: (job as any)?.title ?? null };
}

async function terminZeigen(db: SupabaseClient, body: any) {
  const { t, seite, stelle } = await ladeTermin(db, body.token);
  const vorbei = Date.parse(t.starts_at) < Date.now();
  const z = t.status === 'booked' && !vorbei ? await zeitenFuer(db, seite, t.id) : { verbunden: true, tage: [] };
  return json({
    status: vorbei && t.status === 'booked' ? 'vorbei' : t.status, start: t.starts_at, ende: t.ends_at, mode: t.mode, join_url: t.join_url,
    vorname: t.first_name, headhunter: headhunterOeffentlich(seite), stelle, dauer: seite.e.dauer, tage: z.tage,
  });
}

async function verschieben(db: SupabaseClient, body: any) {
  const { t, seite, stelle } = await ladeTermin(db, body.token);
  muss(t.status === 'booked' && Date.parse(t.starts_at) > Date.now(), 'not_allowed', 'Dieser Termin lässt sich nicht mehr verschieben.');
  const start = typeof body.start === 'string' ? new Date(Date.parse(body.start)).toISOString() : '';
  muss(start && Date.parse(start) > Date.now(), 'invalid_request', 'Bitte wähle eine neue Zeit.');
  const startMs = Date.parse(start);
  const endMs = startMs + seite.e.dauer * 60000;
  const k = await kalender(db, seite.recruiter_id, startMs - 86400000, endMs + 86400000);
  muss(k, 'conflict', 'Die Terminseite ist gerade nicht erreichbar. Versuch es gleich noch einmal.');
  // Der eigene alte Termin steht schon im Outlook: beim Verschieben auf eine überlappende Zeit nicht als belegt zählen.
  const alt = { start: Date.parse(t.starts_at), end: Date.parse(t.ends_at) };
  const busy = k.busy.filter((x) => !(x.start === alt.start && x.end === alt.end));
  const gebucht = await gebuchteZeiten(db, seite.recruiter_id, startMs - 86400000, endMs + 86400000, t.id);
  muss(zeitNochFrei(seite.e, Date.now(), busy, gebucht, start), 'conflict', 'Diese Zeit wurde eben vergeben.');
  const app = getPublicAppUrl();
  const akteUrl = t.candidate_id ? `${app}/recruiter/candidates/${t.candidate_id}` : `${app}/recruiter/interviews`;
  const name = `${t.first_name} ${t.last_name}`;
  if (t.outlook_event_id && k.token) await deleteEvent(k.token, t.outlook_event_id).catch((e) => console.error('termin-seite outlook löschen', e));
  let joinUrl: string | null = null;
  let eventId: string | null = null;
  try {
    const ev = await ereignisAnlegen(k.token, { bookingId: t.id, startMs, endMs, name, stelle, mode: t.mode, phone: t.phone, akteUrl, herkunft: t.source });
    eventId = ev.eventId; joinUrl = ev.joinUrl;
  } catch (e) { console.error('termin-seite outlook', e instanceof Error ? e.message : e); }
  const { error } = await db.from('recruiter_bookings').update({ starts_at: start, ends_at: new Date(endMs).toISOString(), outlook_event_id: eventId, join_url: joinUrl }).eq('id', t.id);
  muss(!error, error?.code === '23505' ? 'conflict' : 'internal_error', error?.code === '23505' ? 'Diese Zeit wurde eben vergeben.' : 'Der Termin konnte nicht verschoben werden.');
  const verwaltenUrl = `${app}/t/termin/${body.token}`;
  const anKandidat = kandidatBestaetigt({ vorname: t.first_name, hhName: seite.name, stelle, startIso: start, dauer: seite.e.dauer, mode: t.mode, joinUrl, verwaltenUrl, mitLebenslauf: false, verschoben: true });
  await sendInterviewMail({
    fromEmail: FROM_EMAIL(), fromName: `${seite.name} über Matchunt`, to: t.email, subject: anKandidat.subject, html: anKandidat.html, text: anKandidat.text, replyTo: seite.email ?? undefined,
    ics: { method: 'REQUEST', content: icsFuer({ bookingId: t.id, sequence: Math.floor(Date.now() / 1000), method: 'REQUEST', startIso: start, dauer: seite.e.dauer, seite, stelle, mode: t.mode, joinUrl, email: t.email, name, verwaltenUrl }) },
  }).catch((e) => console.error('termin-seite mail kandidat', e));
  if (seite.email) {
    const anHH = headhunterNeu({
      hhVorname: seite.vorname, kandidat: { name, email: t.email, phone: t.phone, linkedin: t.linkedin_url, note: null }, stelle, startIso: start, dauer: seite.e.dauer,
      mode: t.mode, joinUrl, imOutlook: !!eventId, akteUrl, herkunft: t.source, lebenslauf: false, verschoben: { vonIso: t.starts_at },
    });
    await sendInterviewMail({ fromEmail: FROM_EMAIL(), fromName: 'Matchunt', to: seite.email, subject: anHH.subject, html: anHH.html, text: anHH.text, replyTo: t.email }).catch(() => undefined);
  }
  await db.from('notifications').insert({ user_id: seite.recruiter_id, type: 'booking_moved', title: `Verschoben: ${name}`, message: `von ${terminText(t.starts_at)} auf ${terminText(start)}`, related_type: 'candidate', related_id: t.candidate_id });
  return json({ ok: true, start, join_url: joinUrl });
}

async function absagen(db: SupabaseClient, body: any) {
  const { t, seite, stelle } = await ladeTermin(db, body.token);
  muss(t.status === 'booked' && Date.parse(t.starts_at) > Date.now(), 'not_allowed', 'Dieser Termin lässt sich nicht mehr absagen.');
  const grund = typeof body.grund === 'string' ? body.grund.trim().slice(0, 500) || null : null;
  await db.from('recruiter_bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_by: 'candidate', cancel_reason: grund }).eq('id', t.id);
  if (t.outlook_event_id) {
    const cfg = msConfig();
    const token = cfg ? await userAccessToken(db, cfg, t.recruiter_id).catch(() => null) : null;
    if (token) await deleteEvent(token, t.outlook_event_id).catch((e) => console.error('termin-seite outlook löschen', e));
  }
  const app = getPublicAppUrl();
  const { data: job } = t.job_id ? await db.from('jobs').select('id, title').eq('id', t.job_id).maybeSingle() : { data: null };
  const neu = `${app}/t/${seite.slug}${job ? `/${jobTeil(job)}` : ''}`;
  const name = `${t.first_name} ${t.last_name}`;
  const anKandidat = kandidatAbgesagt({ vorname: t.first_name, hhName: seite.name, startIso: t.starts_at, dauer: seite.e.dauer, neuBuchenUrl: seite.active ? neu : null });
  await sendInterviewMail({
    fromEmail: FROM_EMAIL(), fromName: `${seite.name} über Matchunt`, to: t.email, subject: anKandidat.subject, html: anKandidat.html, text: anKandidat.text,
    ics: { method: 'CANCEL', content: icsFuer({ bookingId: t.id, sequence: Math.floor(Date.now() / 1000), method: 'CANCEL', startIso: t.starts_at, dauer: seite.e.dauer, seite, stelle, mode: t.mode, joinUrl: t.join_url, email: t.email, name, verwaltenUrl: `${app}/t/termin/${body.token}` }) },
  }).catch(() => undefined);
  if (seite.email) {
    const anHH = headhunterAbgesagt({ hhVorname: seite.vorname, kandidat: name, stelle, startIso: t.starts_at, dauer: seite.e.dauer, grund, akteUrl: t.candidate_id ? `${app}/recruiter/candidates/${t.candidate_id}` : `${app}/recruiter/interviews` });
    await sendInterviewMail({ fromEmail: FROM_EMAIL(), fromName: 'Matchunt', to: seite.email, subject: anHH.subject, html: anHH.html, text: anHH.text }).catch(() => undefined);
  }
  await db.from('notifications').insert({ user_id: seite.recruiter_id, type: 'booking_cancelled', title: `Abgesagt: ${name}`, message: `${terminText(t.starts_at)} ist wieder frei · ${grund ? `„${grund}“` : 'ohne Grund'}`, related_type: 'candidate', related_id: t.candidate_id });
  return json({ ok: true });
}

/** Derselbe Stellen-Teil wie im Frontend (src/lib/linkedinBeitrag.ts › jobSlug). */
function jobTeil(job: { id: string; title: string }) {
  const basis = String(job.title).replace(/\s*\((?:m\/w\/d|w\/m\/d|m\/f\/d|d\/m\/w|all genders?)\)\s*/i, ' ').replace(/\s+/g, ' ').trim().split(/\s[–-]\s/)[0]
    .toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return `${basis || 'stelle'}-${job.id.replace(/-/g, '').slice(0, 6)}`;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return fail('invalid_request', 'Nur POST.');
  const db = serviceClient();
  const ip = clientIp(req);
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? '');
    const topf = action === 'lebenslauf' ? LIMITS.terminLebenslauf(ip) : ['termin', 'verschieben', 'absagen'].includes(action) ? LIMITS.terminVerwalten(ip) : LIMITS.terminSeite(ip);
    const grenze = await checkLimits(db, topf);
    if (!grenze.allowed) return fail('rate_limited', 'Zu viele Anfragen. Versuch es in ein paar Minuten wieder.');
    switch (action) {
      case 'seite': return await seiteZeigen(db, body);
      case 'lebenslauf': return await lebenslaufLesen(db, body);
      case 'buchen': return await buchen(db, body, ip);
      case 'termin': return await terminZeigen(db, body);
      case 'verschieben': return await verschieben(db, body);
      case 'absagen': return await absagen(db, body);
      default: return fail('invalid_request', 'Unbekannte Aktion.');
    }
  } catch (e) {
    if (e instanceof Fehler) return fail(e.grund, e.message, e.extra);
    if (e instanceof PdfTextError) return fail('upstream_error', 'Der Lebenslauf konnte nicht gelesen werden. Du kannst trotzdem buchen.');
    console.error('termin-seite', e instanceof Error ? e.message : e);
    return fail('internal_error', 'Das hat gerade nicht geklappt. Versuch es gleich noch einmal.');
  }
});
