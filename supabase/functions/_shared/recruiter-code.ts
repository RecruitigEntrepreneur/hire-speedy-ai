import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';
import { hashToken } from './tokens.ts';
import { checkLimits, LIMITS, type LimitResult, type LimitRule } from './intake-limits.ts';
import { sendIntakeMail, layout, esc } from './intake-mail.ts';
import { isPlausibleEmail, maskEmail } from './domain.ts';
import { normalizeEmail } from './recruiter-contract-policy.ts';
import { must, dbError, type OnboardingCase } from './recruiter-onboarding-service.ts';
import { checkLoginLink } from './recruiter-login-link.ts';
import { CODE_LENGTH, CODE_PATTERN, storeCode, redeemCode, type SessionDeps } from './login-code.ts';

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
 * Statt der Adresse kann der persönliche `link` aus der Willkommensmail kommen
 * (recruiter-login-link.ts); dann ist der Code an die Adresse des Kontos gebunden.
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
export { CODE_LENGTH, CODE_TTL_MINUTES, CODE_MAX_ATTEMPTS, CODE_PATTERN } from './login-code.ts';
const CODE_KEY = 'recruiter_code';

export interface CodeDeps extends SessionDeps {
  limits: (db: SupabaseClient, rules: LimitRule[]) => Promise<LimitResult>;
  mail: typeof sendIntakeMail;
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
interface Identity { token?: unknown; email?: unknown; link?: unknown }
// Anmeldeseite: per Adresse mit `login`, oder immer über den persönlichen Link.
const loginMode = (body: Identity & { login?: boolean }) => body.token === undefined && (body.login === true || body.link !== undefined);

/** Persönlicher Link → Headhunter-Konto. Nur mit Recruiter-Rolle, sonst wie ein fremder Link. */
async function linkRecruiter(db: SupabaseClient, link: unknown): Promise<{ status: 'open'; email: string; name: string } | { status: 'expired' | 'invalid' }> {
  const state = await checkLoginLink(db, link);
  if (state.status !== 'open') return state;
  const email = normalizeEmail(state.user.email ?? '');
  const found = await findRecruiter(db, email);
  return found ? { status: 'open', email, name: found.name || firstName(state.user.user_metadata?.full_name) } : { status: 'invalid' };
}

/** Anmeldeseite mit Link: Vorname und maskierte Adresse, nie die Adresse selbst. */
export async function peekLoginLink(db: SupabaseClient, link: unknown) {
  const found = await linkRecruiter(db, link);
  return found.status === 'open' ? { status: 'open' as const, name: found.name, masked_email: maskEmail(found.email) } : { status: found.status };
}
// Wohin der Code geht. Ein begonnener Vorgang darf weitermachen, auch wenn der
// Link inzwischen abgelaufen ist; das entspricht der Regel in `load`.
async function resolveTarget(db: SupabaseClient, body: Identity): Promise<Target> {
  if (body.token === undefined && body.link !== undefined) {
    const found = await linkRecruiter(db, body.link);
    must(found.status !== 'expired', 'Dieser Link ist abgelaufen. Gib deine E-Mail-Adresse ein, wir schicken dir einen Code.', 'expired');
    must(found.status === 'open', 'Dieser Link funktioniert nicht mehr. Gib deine E-Mail-Adresse ein, wir schicken dir einen Code.', 'not_found');
    return { email: found.email, name: found.name, caseId: null };
  }
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

/** Bestehendes Headhunter-Konto zu einer Adresse, ohne etwas anzulegen (Profil und Rolle). */
async function findRecruiter(db: SupabaseClient, email: string): Promise<{ id: string; name: string } | null> {
  const { data: profile, error } = await db.from('profiles').select('user_id,full_name').eq('email', email).limit(1).maybeSingle();
  dbError(error);
  if (!profile) return null;
  const { data: role, error: roleError } = await db.from('user_roles').select('user_id').eq('user_id', profile.user_id).eq('role', 'recruiter').limit(1).maybeSingle();
  dbError(roleError);
  return role ? { id: profile.user_id as string, name: firstName(profile.full_name) } : null;
}

// Konto anlegen oder nachschlagen. Der Trigger handle_new_user legt Profil und
// Recruiter-Rolle an; ein vorhandenes Konto bleibt unverändert. Zum Nachschlagen
// dient generateLink, das Konto samt Metadaten liefert; das dabei erzeugte
// Link-Token bleibt ungenutzt.
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

export async function sendCode(db: SupabaseClient, body: Identity & { ip: string | null; login?: boolean }, deps: CodeDeps = liveDeps()) {
  const login = loginMode(body);
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
  const code = await storeCode(db, userId, target.email, CODE_KEY);
  must(code, 'Der Code konnte nicht erzeugt werden. Bitte versuche es gleich noch einmal.', 'upstream_error');
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

export async function verifyCode(db: SupabaseClient, body: Identity & { code?: unknown; ip: string | null; login?: boolean }, deps: CodeDeps = liveDeps()) {
  const target = await resolveTarget(db, body);
  const code = String(body.code ?? '').replace(/\s+/g, '');
  must(CODE_PATTERN.test(code), 'Bitte gib den sechsstelligen Code aus der E-Mail ein.');
  const url = deps.env('SUPABASE_URL');
  const key = deps.env('SUPABASE_ANON_KEY');
  must(url && key, 'Die Anmeldung ist noch nicht eingerichtet.', 'not_deployed');
  const limit = await deps.limits(db, LIMITS.recruiterVerify(target.email, body.ip));
  must(limit.allowed, 'Zu viele Versuche. Warte einen Moment und fordere dann einen neuen Code an.', 'rate_limited');
  // Anmeldeseite: Ohne bestehendes Headhunter-Konto gibt es nichts zu prüfen und nichts anzulegen.
  if (loginMode(body)) must(await findRecruiter(db, target.email), 'Der Code ist falsch oder abgelaufen. Fordere einfach einen neuen an.');
  const result = await redeemCode(db, target.email, code, CODE_KEY, deps);
  if (result.ok) return result.session;
  must(result.failure !== 'exhausted', 'Zu oft falsch eingegeben. Fordere bitte einen neuen Code an.');
  must(result.failure !== 'wrong', 'Der Code ist falsch oder abgelaufen. Fordere einfach einen neuen an.');
  must(result.failure !== 'unsaved', 'Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuche es gleich noch einmal.', 'upstream_error');
  must(false, 'Die Anmeldung konnte nicht abgeschlossen werden. Bitte fordere einen neuen Code an.', 'upstream_error');
}
