import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hashToken } from './tokens.ts';
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
 *   code    Konto anlegen falls nötig, Code von Supabase holen, per Resend im
 *           Matchunt-Layout verschicken. Bei Einladungen geht der Code immer an
 *           die Einladungsadresse; sie verlässt den Server nicht.
 *   verify  Code gegen Supabase prüfen und die Sitzung zurückgeben. Supabase
 *           bestätigt dabei die Adresse, was verifiedUser() voraussetzt.
 *
 * Erzeugung und Prüfung des Codes liegen bei Supabase (generateLink/verify):
 * Gültigkeit und Einmaligkeit folgen der Auth-Einstellung des Projekts, ein
 * eigener Code-Speicher entfällt. Der Versand bleibt bei uns, damit die Mail
 * aussieht wie die Einladung und nicht wie eine Systemmail.
 */

export type CaseStatus = 'open' | 'claimed' | 'expired' | 'revoked';
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
// Die Länge bestimmt die Auth-Einstellung des Projekts (Supabase erlaubt 6 bis 10).
// Nicht fest verdrahten: das Projekt lief mit 8 Ziffern, als hier noch 6 stand.
export const CODE_PATTERN = /^\d{6,10}$/;

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

export async function sendCode(db: SupabaseClient, body: { token?: unknown; email?: unknown; ip: string | null }, deps: CodeDeps = liveDeps()) {
  const target = await resolveTarget(db, body);
  const limit = await deps.limits(db, LIMITS.recruiterCode(target.email, body.ip));
  if (!limit.allowed) {
    const uhr = limit.retryAt?.toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });
    must(false, uhr
      ? `Gerade wurden mehrere Codes angefordert. Ein neuer Code ist ab ${uhr} Uhr möglich. Ein schon erhaltener Code lässt sich weiterhin eintragen.`
      : 'Gerade wurden mehrere Codes angefordert. Bitte versuche es in einigen Minuten erneut.', 'rate_limited');
  }
  // Konto anlegen, falls es fehlt. Der Trigger handle_new_user legt Profil und
  // Recruiter-Rolle an; ein vorhandenes Konto bleibt unverändert.
  const created = await db.auth.admin.createUser({ email: target.email, email_confirm: false, user_metadata: { full_name: target.name, role: 'recruiter' } });
  if (created.error && !alreadyRegistered(created.error)) {
    console.error('[recruiter-code] Konto nicht angelegt', created.error.status ?? '');
    must(false, 'Der Zugang konnte nicht vorbereitet werden. Bitte versuche es gleich noch einmal.', 'upstream_error');
  }
  const link = await db.auth.admin.generateLink({ type: 'magiclink', email: target.email });
  const otp = link.data?.properties?.email_otp;
  if (link.error || !otp) console.error('[recruiter-code] Code nicht erzeugt', link.error?.status ?? '');
  must(!link.error && otp, 'Der Code konnte nicht erzeugt werden. Bitte versuche es gleich noch einmal.', 'upstream_error');
  const result = await deps.mail(db, {
    to: target.email,
    subject: `${otp} ist dein Matchunt-Code`,
    template: 'recruiter_onboarding_code',
    html: layout({
      preheader: `Dein Code: ${otp}`,
      heading: 'Dein Code für Matchunt',
      body: `<p style="margin:0 0 16px 0;">Hallo${target.name ? ' ' + esc(target.name) : ''},</p>
        <p style="margin:0 0 20px 0;">mit diesem Code bestätigst du deine E-Mail-Adresse, ganz ohne Passwort:</p>
        <div style="font-size:34px;font-weight:700;letter-spacing:10px;padding:18px 0;color:#111827;">${esc(otp)}</div>
        <p style="margin:12px 0 0 0;">Der Code ist kurz gültig. Wenn er abgelaufen ist, fordere auf der Seite einfach einen neuen an.</p>`,
      footnote: 'Wenn du gerade nichts bei Matchunt gestartet hast, ignoriere diese Nachricht. Gib den Code nicht weiter.',
    }),
    meta: { case_id: target.caseId },
  });
  must(result.sent, 'Der Code konnte nicht versendet werden. Bitte versuche es gleich noch einmal.', 'upstream_error');
  // Die Länge sagt dem Formular, wie viele Kästchen es zeigt.
  return { sent: true, masked_email: maskEmail(target.email), code_length: otp.length };
}

export async function verifyCode(db: SupabaseClient, body: { token?: unknown; email?: unknown; code?: unknown }, deps: CodeDeps = liveDeps()) {
  const target = await resolveTarget(db, body);
  const code = String(body.code ?? '').replace(/\s+/g, '');
  must(CODE_PATTERN.test(code), 'Bitte gib den Code aus der E-Mail ein, nur die Ziffern.');
  const url = deps.env('SUPABASE_URL');
  const key = deps.env('SUPABASE_ANON_KEY');
  must(url && key, 'Die Anmeldung ist noch nicht eingerichtet.', 'not_deployed');
  // Serverseitig, damit die Adresse bei Einladungen im Browser nie auftaucht.
  const res = await deps.fetch(`${url}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email: target.email, token: code }),
    signal: AbortSignal.timeout(15000),
  });
  must(res.status !== 429, 'Zu viele Versuche. Warte einen Moment und fordere dann einen neuen Code an.', 'rate_limited');
  const session = res.ok ? await res.json().catch(() => null) : null;
  must(session?.access_token && session?.refresh_token, 'Der Code ist falsch oder abgelaufen. Fordere einfach einen neuen an.');
  return { access_token: session.access_token as string, refresh_token: session.refresh_token as string, expires_in: session.expires_in ?? null };
}
