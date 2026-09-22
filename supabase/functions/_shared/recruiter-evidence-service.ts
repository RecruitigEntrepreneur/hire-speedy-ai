import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';
import { getPublicAppUrl } from './app-url.ts';
import { esc, layout, sendIntakeMail } from './intake-mail.ts';
import { dbError, must } from './recruiter-onboarding-service.ts';
import { noticeRecipients } from './recruiter-signed-notice.ts';
import { EVIDENCE, EVIDENCE_PATH, INCOME_OPTIONS, REMIND_DAYS, dueReminders, validUntilOk, type EvidenceKind, type EvidenceRow } from './recruiter-evidence.ts';

/**
 * Nachweise auf dem Server: Headhunter melden hochgeladene Dateien zur Prüfung an
 * und geben die Erklärung zu ihren Einkünften ab; Matchunt prüft oder lehnt mit
 * Grund ab; ein täglicher Lauf erinnert 30 Tage vor Ablauf. Status und Prüfung
 * setzt nur dieser Code (Service-Rolle), nie der Browser.
 */
export const EVIDENCE_BUCKET = 'recruiter-evidence';
const DAY = 86_400_000;

type Deps = { mail: typeof sendIntakeMail; appUrl: () => string; recipients: () => string[]; now: () => number };
const liveDeps: Deps = { mail: sendIntakeMail, appUrl: getPublicAppUrl, recipients: () => noticeRecipients(), now: () => Date.now() };
const date = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' });
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';

async function recruiterOf(db: SupabaseClient, userId: string) {
  const { data, error } = await db.from('profiles').select('full_name,email').eq('user_id', userId).maybeSingle();
  dbError(error);
  return { name: String(data?.full_name ?? '').trim(), email: String(data?.email ?? '').trim() };
}

async function requireRecruiter(db: SupabaseClient, userId: string) {
  const { data, error } = await db.from('user_roles').select('user_id').eq('user_id', userId).eq('role', 'recruiter').maybeSingle();
  dbError(error);
  must(data, 'Nachweise gibt es nur für Headhunter.', 'not_allowed');
}

/** Hinweis an Matchunt; scheitert er, bleibt die Eingabe trotzdem gespeichert. */
async function notifyMatchunt(db: SupabaseClient, deps: Deps, subject: string, body: string, meta: Record<string, unknown>) {
  try {
    const html = layout({ preheader: subject, heading: subject, body, cta: { label: 'Recruiterverwaltung öffnen', url: `${deps.appUrl()}/admin/recruiters` } });
    for (const to of deps.recipients()) await deps.mail(db, { to, subject, html, template: 'recruiter_evidence_notice', meta });
  } catch (e) {
    console.error('[recruiter-evidence] Hinweis an Matchunt nicht verschickt', e instanceof Error ? e.message : e);
  }
}

/** Der Headhunter meldet eine hochgeladene Datei zur Prüfung an. */
export async function submitEvidence(db: SupabaseClient, user: User, body: { kind?: unknown; path?: unknown; file_name?: unknown; valid_until?: unknown }, deps: Deps = liveDeps) {
  const path = String(body.path ?? '');
  const match = EVIDENCE_PATH.exec(path);
  must(match && match[1] === user.id && match[2] === body.kind, 'Die Datei gehört nicht zu diesem Nachweis.', 'not_allowed');
  const kind = match[2] as EvidenceKind;
  const validUntil = body.valid_until === undefined || body.valid_until === null || body.valid_until === '' ? null : body.valid_until;
  if (EVIDENCE[kind].expires) must(validUntilOk(validUntil, deps.now()), 'Bitte gib an, bis wann der Nachweis gilt.');
  else must(validUntil === null || validUntilOk(validUntil, deps.now()), 'Das Datum „gültig bis“ stimmt nicht.');
  await requireRecruiter(db, user.id);
  // Liegt die Datei wirklich im Ordner des Headhunters?
  const folder = path.slice(0, path.lastIndexOf('/'));
  const name = path.slice(path.lastIndexOf('/') + 1);
  const { data: files, error: listError } = await db.storage.from(EVIDENCE_BUCKET).list(folder, { search: name, limit: 10 });
  must(!listError && files?.some(f => f.name === name), 'Die Datei wurde nicht gefunden. Bitte lade sie noch einmal hoch.', 'not_found');
  const fileName = String(body.file_name ?? '').trim().slice(0, 200) || name;
  const { data: row, error } = await db.from('recruiter_evidence')
    .insert({ recruiter_id: user.id, kind, file_path: path, file_name: fileName, valid_until: validUntil, status: 'pending' }).select('id').single();
  dbError(error);
  must(row, 'Der Nachweis konnte nicht gespeichert werden. Bitte versuche es noch einmal.', 'upstream_error');
  const who = await recruiterOf(db, user.id);
  await notifyMatchunt(db, deps, `Nachweis zur Prüfung: ${EVIDENCE[kind].label}`,
    `<p>${esc(who.name || who.email)} hat einen Nachweis hochgeladen: <strong>${esc(EVIDENCE[kind].label)}</strong>${validUntil ? `, gültig bis ${esc(date(validUntil))}` : ''}.</p>`
      + '<p>Du findest ihn in der Recruiterverwaltung in der Akte unter „Nachweise“.</p>',
    { user_id: user.id, evidence_id: row.id, kind });
  return { id: row.id as string, status: 'pending' as const };
}

/** Eigene Erklärung zu den Einkünften; gilt sofort. Läuft mehr als die Hälfte über Matchunt, erfährt Matchunt es. */
export async function declareIncome(db: SupabaseClient, user: User, body: { declaration?: unknown }, deps: Deps = liveDeps) {
  const declaration = body.declaration;
  must(declaration === 'below' || declaration === 'above', 'Bitte wähle eine der beiden Angaben.');
  await requireRecruiter(db, user.id);
  const { data: row, error } = await db.from('recruiter_evidence')
    .insert({ recruiter_id: user.id, kind: 'income', declaration, status: 'approved' }).select('id').single();
  dbError(error);
  must(row, 'Die Erklärung konnte nicht gespeichert werden. Bitte versuche es noch einmal.', 'upstream_error');
  if (declaration === 'above') {
    const who = await recruiterOf(db, user.id);
    await notifyMatchunt(db, deps, 'Erklärung zu Einkünften: mehr als die Hälfte über Matchunt',
      `<p>${esc(who.name || who.email)} hat erklärt: <strong>${esc(INCOME_OPTIONS.above)}</strong>.</p>`
        + '<p>Das ist ein Punkt bei der Frage, ob die Tätigkeit selbstständig ist. Bitte prüfen, ob etwas zu tun ist.</p>',
      { user_id: user.id, evidence_id: row.id, kind: 'income' });
  }
  return { id: row.id as string, status: 'approved' as const };
}

/** Matchunt prüft einen Nachweis. Bei Ablehnung bekommt der Headhunter den Grund per Mail. */
export async function reviewEvidence(db: SupabaseClient, admin: { userId?: string; email?: string }, body: { id?: unknown; decision?: unknown; reason?: unknown }, deps: Deps = liveDeps) {
  must(typeof body.id === 'string' && /^[0-9a-f-]{36}$/.test(body.id), 'Unbekannter Nachweis.');
  must(body.decision === 'approved' || body.decision === 'rejected', 'Bitte „Geprüft“ oder „Ablehnen“ wählen.');
  const reason = String(body.reason ?? '').trim().slice(0, 500);
  if (body.decision === 'rejected') must(reason.length >= 5, 'Bitte gib kurz an, warum der Nachweis nicht passt.');
  const { data: row, error } = await db.from('recruiter_evidence').select('*').eq('id', body.id).maybeSingle();
  dbError(error);
  must(row, 'Unbekannter Nachweis.', 'not_found');
  must(row.kind !== 'income', 'Die Erklärung zu den Einkünften braucht keine Prüfung.', 'conflict');
  must(row.status === 'pending', 'Dieser Nachweis wurde schon geprüft.', 'conflict');
  const { error: writeError } = await db.from('recruiter_evidence')
    .update({ status: body.decision, reason: body.decision === 'rejected' ? reason : null, reviewed_at: new Date(deps.now()).toISOString(), reviewed_by: admin.userId ?? null })
    .eq('id', row.id).eq('status', 'pending');
  dbError(writeError);
  let mailed = false;
  if (body.decision === 'rejected') {
    const who = await recruiterOf(db, row.recruiter_id);
    if (who.email) {
      const label = EVIDENCE[row.kind as EvidenceKind].label;
      const html = layout({
        preheader: `${label}: bitte eine neue Datei hochladen.`,
        heading: 'Dein Nachweis braucht eine neue Datei',
        body: `<p>Hallo${firstName(who.name) ? ' ' + esc(firstName(who.name)) : ''},</p><p>wir konnten deinen Nachweis <strong>${esc(label)}</strong> leider nicht übernehmen.</p>`
          + `<p><strong>Grund:</strong> ${esc(reason)}</p><p>Lade bitte eine neue Datei hoch. Bei Fragen antworte einfach auf diese Mail.</p>`,
        cta: { label: 'Nachweis hochladen', url: `${deps.appUrl()}/recruiter/profile/nachweise` },
      });
      const result = await deps.mail(db, { to: who.email, subject: 'Dein Nachweis braucht eine neue Datei', html, template: 'recruiter_evidence_rejected', replyTo: admin.email, meta: { user_id: row.recruiter_id, evidence_id: row.id } });
      mailed = !!result?.sent;
    }
  }
  return { id: row.id as string, status: body.decision as 'approved' | 'rejected', mailed };
}

/** Täglicher Lauf: Erinnerung 30 Tage vor Ablauf, einmal je Nachweis. */
export async function remindExpiring(db: SupabaseClient, deps: Deps = liveDeps) {
  const now = deps.now();
  const horizon = new Date(now + REMIND_DAYS * DAY).toISOString().slice(0, 10);
  const { data: soon, error } = await db.from('recruiter_evidence').select('recruiter_id').eq('status', 'approved').not('valid_until', 'is', null).lte('valid_until', horizon).is('reminded_at', null);
  dbError(error);
  const recruiters = [...new Set((soon ?? []).map(r => r.recruiter_id as string))];
  if (!recruiters.length) return { reminded: 0 };
  // Alle Einträge dieser Headhunter, damit ein schon ersetzter Nachweis keine Erinnerung auslöst.
  const { data: rows, error: rowsError } = await db.from('recruiter_evidence').select('*').in('recruiter_id', recruiters);
  dbError(rowsError);
  let reminded = 0;
  for (const row of dueReminders((rows ?? []) as EvidenceRow[], now)) {
    const who = await recruiterOf(db, row.recruiter_id!);
    if (!who.email) continue;
    const label = EVIDENCE[row.kind].label;
    const html = layout({
      preheader: `${label} läuft am ${date(row.valid_until!)} ab.`,
      heading: 'Dein Nachweis läuft bald ab',
      body: `<p>Hallo${firstName(who.name) ? ' ' + esc(firstName(who.name)) : ''},</p><p>dein <strong>${esc(label)}</strong> gilt bis ${esc(date(row.valid_until!))}.</p>`
        + '<p>Lade bitte rechtzeitig einen neuen Nachweis hoch, dann bleibt alles in Ordnung.</p>',
      cta: { label: 'Neuen Nachweis hochladen', url: `${deps.appUrl()}/recruiter/profile/nachweise` },
    });
    const result = await deps.mail(db, { to: who.email, subject: `${label} läuft bald ab`, html, template: 'recruiter_evidence_expiring', idempotencyKey: `recruiter-evidence-expiring/${row.id}`, meta: { user_id: row.recruiter_id, evidence_id: row.id } });
    if (!result?.sent) continue;
    const { error: markError } = await db.from('recruiter_evidence').update({ reminded_at: new Date(now).toISOString() }).eq('id', row.id);
    dbError(markError);
    reminded += 1;
  }
  return { reminded };
}
