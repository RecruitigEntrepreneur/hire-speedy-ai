import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkLimits, LIMITS, type LimitResult, type LimitRule } from './intake-limits.ts';
import { sendIntakeMail, layout, esc } from './intake-mail.ts';
import { isPlausibleEmail, maskEmail } from './domain.ts';
import { must, dbError } from './recruiter-onboarding-service.ts';
import { checkLoginLink } from './recruiter-login-link.ts';
import { CODE_LENGTH, CODE_PATTERN, storeCode, redeemCode, type SessionDeps } from './login-code.ts';

/**
 * Kundenanmeldung per Code (/anmelden, Entscheidung 25.09.2026).
 *
 * Nach der Gegenzeichnung bekommt der Kunde eine Mail mit einem persönlichen
 * Link (client-access.ts). Der Link meldet niemanden an: Die Seite begrüßt mit
 * Namen, schickt auf Knopfdruck einen Code an die Adresse des Kontos, und erst
 * der Code öffnet die Sitzung. Ohne Link geht dasselbe über die Adresse.
 *
 * Wie bei den Headhuntern legt die Anmeldung nie ein Konto an, und für
 * Adressen ohne Kundenkonto antwortet sie genauso wie für bekannte, damit
 * niemand Konten ausforscht. Eigene Schlüssel für Code und Link: ein
 * Headhunter-Link öffnet die Kundenanmeldung nicht.
 */

export const CLIENT_CODE_KEY = 'client_code';
export const CLIENT_LINK_KEY = 'client_login_link';

export interface ClientCodeDeps extends SessionDeps {
  limits: (db: SupabaseClient, rules: LimitRule[]) => Promise<LimitResult>;
  mail: typeof sendIntakeMail;
}
export const liveClientDeps = (): ClientCodeDeps => ({
  limits: checkLimits,
  mail: sendIntakeMail,
  fetch: (input, init) => globalThis.fetch(input, init),
  env: key => Deno.env.get(key),
});

interface Identity { email?: unknown; link?: unknown }
interface ClientAccount { id: string; email: string; name: string }

const normalizeEmail = (value: string) => value.trim().toLowerCase();
// profiles.email übernimmt die Schreibweise aus der Aufnahme; ilike ohne Platzhalter.
const exactIlike = (value: string) => value.replace(/[\\%_]/g, m => `\\${m}`);

/** Bestehendes Kundenkonto zu einer Adresse, ohne etwas anzulegen (Profil und Rolle). */
export async function findClient(db: SupabaseClient, email: string): Promise<ClientAccount | null> {
  const { data: profile, error } = await db.from('profiles').select('user_id,full_name,email')
    .ilike('email', exactIlike(email)).limit(1).maybeSingle();
  dbError(error);
  if (!profile) return null;
  const { data: role, error: roleError } = await db.from('user_roles').select('user_id')
    .eq('user_id', profile.user_id).eq('role', 'client').limit(1).maybeSingle();
  dbError(roleError);
  return role ? { id: profile.user_id as string, email, name: String(profile.full_name ?? '').trim() } : null;
}

/** Persönlicher Link → Kundenkonto. Nur mit Kundenrolle, sonst wie ein fremder Link. */
async function linkClient(db: SupabaseClient, link: unknown): Promise<{ status: 'open'; account: ClientAccount } | { status: 'expired' | 'invalid' }> {
  const state = await checkLoginLink(db, link, Date.now(), CLIENT_LINK_KEY);
  if (state.status !== 'open') return state;
  const account = await findClient(db, normalizeEmail(state.user.email ?? ''));
  return account ? { status: 'open', account } : { status: 'invalid' };
}

/** Anmeldeseite mit Link: Name und maskierte Adresse, nie die Adresse selbst. */
export async function peekClientLink(db: SupabaseClient, link: unknown) {
  const found = await linkClient(db, link);
  return found.status === 'open'
    ? { status: 'open' as const, name: found.account.name, masked_email: maskEmail(found.account.email) }
    : { status: found.status };
}

// Wohin der Code geht: über den Link an die Adresse des Kontos, sonst an die eingetippte.
async function resolveEmail(db: SupabaseClient, body: Identity): Promise<string> {
  if (body.link !== undefined) {
    const found = await linkClient(db, body.link);
    must(found.status !== 'expired', 'Dieser Link ist abgelaufen. Geben Sie Ihre E-Mail-Adresse ein, wir senden Ihnen einen Code.', 'expired');
    must(found.status === 'open', 'Dieser Link funktioniert nicht mehr. Geben Sie Ihre E-Mail-Adresse ein, wir senden Ihnen einen Code.', 'not_found');
    return found.account.email;
  }
  const email = normalizeEmail(String(body.email ?? ''));
  must(isPlausibleEmail(email), 'Bitte geben Sie eine gültige E-Mail-Adresse an.');
  return email;
}

export async function sendClientCode(db: SupabaseClient, body: Identity & { ip: string | null }, deps: ClientCodeDeps = liveClientDeps()) {
  const email = await resolveEmail(db, body);
  const limit = await deps.limits(db, LIMITS.clientCode(email, body.ip));
  if (!limit.allowed) {
    const uhr = limit.retryAt?.toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });
    must(false, uhr
      ? `Gerade wurden mehrere Codes angefordert. Ein neuer Code ist ab ${uhr} Uhr möglich. Ein schon erhaltener Code lässt sich weiterhin eintragen.`
      : 'Gerade wurden mehrere Codes angefordert. Bitte versuchen Sie es in einigen Minuten erneut.', 'rate_limited');
  }
  const neutral = { sent: true, masked_email: maskEmail(email), code_length: CODE_LENGTH };
  const account = await findClient(db, email);
  if (!account) return neutral;
  const code = await storeCode(db, account.id, email, CLIENT_CODE_KEY);
  must(code, 'Der Code konnte nicht erzeugt werden. Bitte versuchen Sie es gleich noch einmal.', 'upstream_error');
  const result = await deps.mail(db, {
    to: email,
    subject: `${code} ist Ihr Matchunt-Anmeldecode`,
    template: 'client_login_code',
    html: layout({
      preheader: `Ihr Anmeldecode: ${code}`,
      heading: 'Ihr Anmeldecode',
      body: `<p style="margin:0 0 16px 0;">Guten Tag${account.name ? ' ' + esc(account.name) : ''},</p>
        <p style="margin:0 0 20px 0;">mit diesem Code melden Sie sich bei Matchunt an:</p>
        <div style="font-size:34px;font-weight:700;letter-spacing:10px;padding:18px 0;color:#111827;">${esc(code)}</div>
        <p style="margin:12px 0 0 0;">Der Code ist eine Stunde gültig. Danach fordern Sie auf der Seite einfach einen neuen an.</p>`,
      footnote: 'Wenn Sie sich gerade nicht bei Matchunt anmelden wollten, ignorieren Sie diese Nachricht. Geben Sie den Code nicht weiter.',
    }),
    meta: { user_id: account.id },
  });
  must(result.sent, 'Der Code konnte nicht versendet werden. Bitte versuchen Sie es gleich noch einmal.', 'upstream_error');
  return neutral;
}

export async function verifyClientCode(db: SupabaseClient, body: Identity & { code?: unknown; ip: string | null }, deps: ClientCodeDeps = liveClientDeps()) {
  const email = await resolveEmail(db, body);
  const code = String(body.code ?? '').replace(/\s+/g, '');
  must(CODE_PATTERN.test(code), 'Bitte geben Sie den sechsstelligen Code aus der E-Mail ein.');
  must(deps.env('SUPABASE_URL') && deps.env('SUPABASE_ANON_KEY'), 'Die Anmeldung ist noch nicht eingerichtet.', 'not_deployed');
  const limit = await deps.limits(db, LIMITS.clientVerify(email, body.ip));
  must(limit.allowed, 'Zu viele Versuche. Warten Sie einen Moment und fordern Sie dann einen neuen Code an.', 'rate_limited');
  // Ohne Kundenkonto gibt es nichts zu prüfen; die Antwort verrät das nicht.
  must(await findClient(db, email), 'Der Code stimmt nicht. Prüfen Sie ihn oder fordern Sie unten einen neuen an.');
  const result = await redeemCode(db, email, code, CLIENT_CODE_KEY, deps);
  if (result.ok) return result.session;
  must(result.failure !== 'exhausted', 'Zu oft falsch eingegeben. Fordern Sie bitte einen neuen Code an.');
  must(result.failure !== 'wrong', 'Der Code stimmt nicht. Prüfen Sie ihn oder fordern Sie unten einen neuen an.');
  must(result.failure !== 'unsaved', 'Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuchen Sie es gleich noch einmal.', 'upstream_error');
  must(false, 'Die Anmeldung konnte nicht abgeschlossen werden. Bitte fordern Sie einen neuen Code an.', 'upstream_error');
}
