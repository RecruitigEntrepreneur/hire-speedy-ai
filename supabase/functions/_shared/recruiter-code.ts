import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';
import { hashToken, hashCode, generateNumericCode, timingSafeEqual } from './tokens.ts';
import { checkLimits, LIMITS, type LimitResult, type LimitRule } from './intake-limits.ts';
import { sendIntakeMail, layout, esc } from './intake-mail.ts';
import { isPlausibleEmail, maskEmail } from './domain.ts';
import { normalizeEmail } from './recruiter-contract-policy.ts';
import { must, dbError, type OnboardingCase } from './recruiter-onboarding-service.ts';

/**
 * Anmeldung per Code statt Konto.
 *
 * Der Headhunter registriert sich nicht. Er bestätigt seine E-Mail-Adresse mit
 * einem sechsstelligen Code und ist danach angemeldet; das Passwort kommt erst
 * mit der Freischaltung. Drei öffentliche Aktionen, alle ohne Sitzung:
 *
 *   peek    Einladungslink → Vorname, maskierte Adresse, Status. Sonst nichts.
 *   code    Konto anlegen falls nötig, eigenen Code erzeugen, per Resend im
 *           Matchunt-Layout verschicken. Bei Einladungen geht der Code immer an
 *           die Einladungsadresse; sie verlässt den Server nie.
 *   verify  Code prüfen und die Sitzung zurückgeben.
 *
 * Mit `login` (Anmeldeseite /recruiter/login, 21.09.2026) legen code und verify
 * kein Konto an: Der Code geht nur an bestehende Headhunter-Konten, und die
 * Antwort ist für unbekannte Adressen dieselbe, damit niemand Konten ausforscht.
 *
 * Der Code ist unserer, wie in der Kunden-Jobaufnahme: sechs Ziffern, eine
 * Stunde gültig, fünf Versuche. Gespeichert wird nur der gepfefferte Hash in
 * den Admin-Metadaten des Auth-Kontos (app_metadata). Die kann nur der Server
 * schreiben, und es braucht keine eigene Tabelle, also keine Migration.
 *
 * Supabase stellt nach der Prüfung nur die Sitzung aus: generateLink liefert
 * ein Einmal-Token, das der Server in derselben Sekunde gegen /auth/v1/verify
 * einlöst. Länge und Ablauf der Supabase-OTPs spielen deshalb keine Rolle;
 * auf Lovable Cloud lassen sie sich ohnehin nicht einstellen (16.09.2026).
 */

export type CaseStatus = 'open' | 'claimed' | 'expired' | 'revoked';
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const CODE_LENGTH = 6;
export const CODE_TTL_MINUTES = 60;
export const CODE_MAX_ATTEMPTS = 5;
export const CODE_PATTERN = /^\d{6}$/;
const CODE_KEY = 'recruiter_code';
interface StoredCode { hash: string; expires_at: string; attempts: number }

export interface CodeDeps {
  limits: (db: SupabaseClient, rules: LimitRule[]) => Promise<LimitResult>;
  mail: typeof sendIntakeMail;
  fetch: typeof fetch;
  env: (key: string) => string | undefined;
}
export const liveDeps = (): CodeDeps => ({
  limits: checkLimits,
  mail: sendIntakeMail,
  fetch: (input, init) => globalThis.fetch(input, init),
  env: key => Deno.env.get(key),
});

export function caseStatus(c: Pick<OnboardingCase, 'revoked_at' | 'claimed_by' | 'expires_at'>, now = Date.now()): CaseStatus {
  if (c.revoked_at) return 'revoked';
  if (c.claimed_by) return 'claimed';
  return Date.parse(c.expires_at) > now ? 'open' : 'expired';
}
export const firstName = (name: unknown): string => String(name ?? '').trim().split(/\s+/)[0] ?? '';

export async function caseByToken(db: SupabaseClient, token: unknown): Promise<OnboardingCase> {
  must(typeof token === 'string' && TOKEN_PATTERN.test(token), 'Ungültiger Einladungslink.');
  const { data, error } = await db.from('recruiter_onboarding_cases').select('*').eq('token_hash', await hashToken(token)).maybeSingle();
  dbError(error);
  must(data, 'Dieser Einladungslink ist ungültig.', 'not_found');
  return data as OnboardingCase;
}

export async function peekCase(db: SupabaseClient, token: unknown) {
  const c = await caseByToken(db, token);
  return { name: firstName(c.profile?.name), masked_email: maskEmail(c.email), expires_at: c.expires_at, status: caseStatus(c) };
}

interface Target { email: string; name: string; caseId: string | null }
// Wohin der Code geht. Ein begonnener Vorgang darf weitermachen, auch wenn der
// Link inzwischen abgelaufen ist; das entspricht der Regel in `load`.
async function resolveTarget(db: SupabaseClient, body: { token?: unknown; email?: unknown }): Promise<Target> {
  if (body.token !== undefined) {
    const c = await caseByToken(db, body.token);
    const status = caseStatus(c);
    must(status !== 'revoked', 'Dieser Einladungslink wurde zurückgezogen. Sag uns kurz Bescheid, dann bekommst du einen neuen.', 'revoked');
    must(status !== 'expired', 'Dein Einladungslink ist abgelaufen. Sag uns kurz Bescheid, wir schicken dir einen neuen.', 'expired');
    return { email: c.email, name: firstName(c.profile?.name), caseId: c.id };
  }
  const email = normalizeEmail(String(body.email ?? ''));
  must(isPlausibleEmail(email), 'Bitte gib eine gültige E-Mail-Adresse an.');
  return { email, name: '', caseId: null };
}

const alreadyRegistered = (error: { code?: string; message?: string }) =>
  error.code === 'email_exists' || /already|exists|registered/i.test(error.message ?? '');

// Konto anlegen oder nachschlagen. Der Trigger handle_new_user legt Profil und
// Recruiter-Rolle an; ein vorhandenes Konto bleibt unverändert. Zum Nachschlagen
// dient generateLink, das Konto samt Metadaten liefert; das dabei erzeugte
// Link-Token bleibt ungenutzt.
/** Bestehendes Headhunter-Konto zu einer Adresse, ohne etwas anzulegen (Profil und Rolle). */
async function findRecruiter(db: SupabaseClient, email: string): Promise<{ id: string; name: string } | null> {
  const { data: profile, error } = await db.from('profiles').select('user_id,full_name').eq('email', email).limit(1).maybeSingle();
  dbError(error);
  if (!profile) return null;
  const { data: role, error: roleError } = await db.from('user_roles').select('user_id').eq('user_id', profile.user_id).eq('role', 'recruiter').limit(1).maybeSingle();
  dbError(roleError);
  return role ? { id: profile.user_id as string, name: firstName(profile.full_name) } : null;
}

async function ensureUser(db: SupabaseClient, email: string, name: string): Promise<User> {
  const created = await db.auth.admin.createUser({ email, email_confirm: false, user_metadata: { full_name: name, role: 'recruiter' } });
  if (created.data?.user) return created.data.user;
  if (created.error && !alreadyRegistered(created.error)) {
    console.error('[recruiter-code] Konto nicht angelegt', created.error.status ?? '');
    must(false, 'Der Zugang konnte nicht vorbereitet werden. Bitte versuche es gleich noch einmal.', 'upstream_error');
  }
  const link = await db.auth.admin.generateLink({ type: 'magiclink', email });
  if (link.error) console.error('[recruiter-code] Konto nicht gefunden', link.error.status ?? '');
  must(!link.error && link.data?.user, 'Der Zugang konnte nicht vorbereitet werden. Bitte versuche es gleich noch einmal.', 'upstream_error');
  return link.data.user;
}

export async function sendCode(db: SupabaseClient, body: { token?: unknown; email?: unknown; ip: string | null; login?: boolean }, deps: CodeDeps = liveDeps()) {
  const login = body.login === true && body.token === undefined;
  const target = await resolveTarget(db, body);
  const limit = await deps.limits(db, LIMITS.recruiterCode(target.email, body.ip));
  if (!limit.allowed) {
    const uhr = limit.retryAt?.toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });
    must(false, uhr
      ? `Gerade wurden mehrere Codes angefordert. Ein neuer Code ist ab ${uhr} Uhr möglich. Ein schon erhaltener Code lässt sich weiterhin eintragen.`
      : 'Gerade wurden mehrere Codes angefordert. Bitte versuche es in einigen Minuten erneut.', 'rate_limited');
  }
  let userId: string;
  let name = target.name;
  if (login) {
    const found = await findRecruiter(db, target.email);
    // Neutral antworten: Die Seite verrät nicht, ob es zu der Adresse ein Konto gibt.
    if (!found) return { sent: true, masked_email: maskEmail(target.email), code_length: CODE_LENGTH };
    userId = found.id; name = found.name;
  } else {
    userId = (await ensureUser(db, target.email, target.name)).id;
  }
  const code = generateNumericCode(CODE_LENGTH);
  const stored: StoredCode = { hash: await hashCode(target.email, code), expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60000).toISOString(), attempts: 0 };
  // Ein neuer Code ersetzt den alten: es ist immer nur einer gültig.
  const saved = await db.auth.admin.updateUserById(userId, { app_metadata: { [CODE_KEY]: stored } });
  if (saved.error) console.error('[recruiter-code] Code nicht gespeichert', saved.error.status ?? '');
  must(!saved.error, 'Der Code konnte nicht erzeugt werden. Bitte versuche es gleich noch einmal.', 'upstream_error');
  const result = await deps.mail(db, {
    to: target.email,
    subject: `${code} ist dein Matchunt-Code`,
    template: 'recruiter_onboarding_code',
    html: layout({
      preheader: `Dein Code: ${code}`,
      heading: login ? 'Dein Anmeldecode' : 'Dein Code für Matchunt',
      body: `<p style="margin:0 0 16px 0;">Hallo${name ? ' ' + esc(name) : ''},</p>
        <p style="margin:0 0 20px 0;">${login ? 'mit diesem Code meldest du dich bei Matchunt an' : 'mit diesem Code bestätigst du deine E-Mail-Adresse'}, ganz ohne Passwort:</p>
        <div style="font-size:34px;font-weight:700;letter-spacing:10px;padding:18px 0;color:#111827;">${esc(code)}</div>
        <p style="margin:12px 0 0 0;">Der Code ist eine Stunde gültig. Danach fordere auf der Seite einfach einen neuen an.</p>`,
      footnote: 'Wenn du gerade nichts bei Matchunt gestartet hast, ignoriere diese Nachricht. Gib den Code nicht weiter.',
    }),
    meta: { case_id: target.caseId },
  });
  must(result.sent, 'Der Code konnte nicht versendet werden. Bitte versuche es gleich noch einmal.', 'upstream_error');
  return { sent: true, masked_email: maskEmail(target.email), code_length: CODE_LENGTH };
}

export async function verifyCode(db: SupabaseClient, body: { token?: unknown; email?: unknown; code?: unknown; ip: string | null; login?: boolean }, deps: CodeDeps = liveDeps()) {
  const target = await resolveTarget(db, body);
  const code = String(body.code ?? '').replace(/\s+/g, '');
  must(CODE_PATTERN.test(code), 'Bitte gib den sechsstelligen Code aus der E-Mail ein.');
  const url = deps.env('SUPABASE_URL');
  const key = deps.env('SUPABASE_ANON_KEY');
  must(url && key, 'Die Anmeldung ist noch nicht eingerichtet.', 'not_deployed');
  const limit = await deps.limits(db, LIMITS.recruiterVerify(target.email, body.ip));
  must(limit.allowed, 'Zu viele Versuche. Warte einen Moment und fordere dann einen neuen Code an.', 'rate_limited');
  // Anmeldeseite: Ohne bestehendes Headhunter-Konto gibt es nichts zu prüfen und nichts anzulegen.
  if (body.login === true && body.token === undefined) must(await findRecruiter(db, target.email), 'Der Code ist falsch oder abgelaufen. Fordere einfach einen neuen an.');
  // Konto samt gespeichertem Code holen; das Einmal-Token wird gleich zur Sitzung.
  const link = await db.auth.admin.generateLink({ type: 'magiclink', email: target.email });
  const user = link.data?.user;
  const tokenHash = link.data?.properties?.hashed_token;
  must(!link.error && user && tokenHash, 'Der Code ist falsch oder abgelaufen. Fordere einfach einen neuen an.');
  const stored = (user.app_metadata as Record<string, unknown> | undefined)?.[CODE_KEY] as StoredCode | undefined;
  const usable = !!stored && typeof stored.hash === 'string' && Date.parse(stored.expires_at) > Date.now() && stored.attempts < CODE_MAX_ATTEMPTS;
  if (!usable || !timingSafeEqual(stored.hash, await hashCode(target.email, code))) {
    // Fehlversuch zählen; ein abgelaufener oder verbrauchter Code wird entfernt.
    const attempts = usable ? stored.attempts + 1 : CODE_MAX_ATTEMPTS;
    const remaining = usable && attempts < CODE_MAX_ATTEMPTS;
    await db.auth.admin.updateUserById(user.id, { app_metadata: { [CODE_KEY]: remaining ? { ...stored, attempts } : null } });
    must(false, usable && !remaining ? 'Zu oft falsch eingegeben. Fordere bitte einen neuen Code an.' : 'Der Code ist falsch oder abgelaufen. Fordere einfach einen neuen an.');
  }
  const cleared = await db.auth.admin.updateUserById(user.id, { app_metadata: { [CODE_KEY]: null } });
  must(!cleared.error, 'Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuche es gleich noch einmal.', 'upstream_error');
  // Serverseitig, damit die Adresse bei Einladungen im Browser nie auftaucht.
  const res = await deps.fetch(`${url}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash: tokenHash }),
    signal: AbortSignal.timeout(15000),
  });
  const session = res.ok ? await res.json().catch(() => null) : null;
  if (!session?.access_token) console.error('[recruiter-code] Sitzung nicht ausgestellt', res.status);
  must(session?.access_token && session?.refresh_token, 'Die Anmeldung konnte nicht abgeschlossen werden. Bitte fordere einen neuen Code an.', 'upstream_error');
  return { access_token: session.access_token as string, refresh_token: session.refresh_token as string, expires_in: session.expires_in ?? null };
}
