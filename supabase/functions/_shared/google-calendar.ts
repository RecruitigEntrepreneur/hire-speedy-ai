// deno-lint-ignore-file no-explicit-any
// Google-Kalender-Anbindung (26.11.2026), Gegenstück zu msgraph-calendar.ts.
//
// Rechte der App (delegiert, so wenige wie möglich):
//   openid email                       wer sich verbunden hat
//   calendar.events                    Termin mit Google-Meet-Link anlegen/absagen
//   calendar.freebusy                  frei/belegt des Nutzers und seiner Kollegen
// Keine Leserechte auf Inhalte fremder Termine, keine Mail-, Drive- oder Kontakte-Rechte.
// Tokens liegen AES-GCM-verschlüsselt in calendar_connections (provider 'google').
import type { Interval } from './interview-availability.ts';

export const GCAL = 'https://www.googleapis.com/calendar/v3';
export const GOOGLE_SCOPES = 'openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy';
const NEEDED = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.freebusy'];

export interface GoogleConfig { clientId: string; clientSecret: string; redirectUri: string; encryptionKey: string }

/** null, solange die Google-App nicht eingerichtet ist (Secrets fehlen). */
export function googleConfig(env: (k: string) => string | undefined = (k) => Deno.env.get(k)): GoogleConfig | null {
  const clientId = env('GOOGLE_CALENDAR_CLIENT_ID');
  const clientSecret = env('GOOGLE_CALENDAR_CLIENT_SECRET');
  const encryptionKey = env('ENCRYPTION_KEY');
  if (!clientId || !clientSecret || !encryptionKey) return null;
  const supabaseUrl = (env('SUPABASE_URL') ?? '').replace(/\/+$/, '');
  return { clientId, clientSecret, encryptionKey, redirectUri: env('GOOGLE_CALENDAR_REDIRECT_URI') ?? `${supabaseUrl}/functions/v1/calendar-oauth-callback` };
}

export class GoogleError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export function googleAuthorizeUrl(cfg: GoogleConfig, state: string, challenge: string, loginHint?: string): string {
  const p = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'offline', // Refresh-Token, damit Matchunt auch ohne Anmeldung buchen kann
    prompt: 'consent select_account',
    include_granted_scopes: 'true',
  });
  if (loginHint) p.set('login_hint', loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export interface GoogleTokens { accessToken: string; refreshToken: string | null; expiresAt: number; email: string | null; scope: string }

function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const part = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(part + '='.repeat((4 - (part.length % 4)) % 4)));
    return claims.email ? String(claims.email).toLowerCase() : null;
  } catch {
    return null;
  }
}

async function tokenRequest(body: Record<string, string>): Promise<GoogleTokens> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new GoogleError(res.status, String(data.error ?? 'token_error'), String(data.error_description ?? 'Token-Anfrage gescheitert'));
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    email: emailFromIdToken(data.id_token),
    scope: String(data.scope ?? ''),
  };
}

export async function googleExchangeCode(cfg: GoogleConfig, code: string, verifier: string): Promise<GoogleTokens> {
  const tokens = await tokenRequest({ client_id: cfg.clientId, client_secret: cfg.clientSecret, grant_type: 'authorization_code', code, redirect_uri: cfg.redirectUri, code_verifier: verifier });
  // Google lässt einzelne Häkchen abwählen: ohne Kalenderrechte gibt es nichts zu verbinden.
  const granted = tokens.scope.split(/\s+/);
  if (!NEEDED.every((s) => granted.includes(s))) throw new GoogleError(403, 'scopes_missing', 'Nicht alle Kalender-Rechte wurden erteilt.');
  return tokens;
}

export const googleRefresh = (cfg: GoogleConfig, refreshToken: string) =>
  tokenRequest({ client_id: cfg.clientId, client_secret: cfg.clientSecret, grant_type: 'refresh_token', refresh_token: refreshToken });

async function gcal(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${GCAL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new GoogleError(res.status, String(data?.error?.status ?? data?.error?.code ?? 'google_error'), String(data?.error?.message ?? `Google ${res.status}`));
  return data;
}

/**
 * Belegte Zeiten mehrerer Personen (eigene Firma: Google Workspace teilt frei/belegt
 * im Haus). Ergebnis je E-Mail: Intervalle oder null (Kalender nicht sichtbar).
 */
export async function googleBusy(token: string, emails: string[], fromMs: number, toMs: number): Promise<Record<string, Interval[] | null>> {
  const out: Record<string, Interval[] | null> = {};
  const unique = [...new Set(emails.map((e) => e.toLowerCase()))];
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const data = await gcal(token, '/freeBusy', {
      method: 'POST',
      body: JSON.stringify({ timeMin: new Date(fromMs).toISOString(), timeMax: new Date(toMs).toISOString(), items: batch.map((id) => ({ id })) }),
    });
    const cals = (data?.calendars ?? {}) as Record<string, any>;
    for (const e of batch) {
      const c = cals[e] ?? Object.entries(cals).find(([k]) => k.toLowerCase() === e)?.[1];
      if (!c || (Array.isArray(c.errors) && c.errors.length)) { out[e] = null; continue; }
      out[e] = ((c.busy ?? []) as any[]).map((x) => ({ start: Date.parse(x.start), end: Date.parse(x.end) }));
    }
  }
  return out;
}

export interface GoogleEventInput {
  subject: string;
  /** Beschreibung; Google zeigt einfache HTML-Auszeichnung an */
  bodyHtml: string;
  startMs: number;
  endMs: number;
  attendees: { email: string; name: string; required: boolean }[];
  requestId: string;
  /** true = Google-Meet-Link anlegen */
  meet: boolean;
  location?: string;
}

/** Termin im Google-Kalender anlegen; Google schickt die Einladung an die Kollegen selbst. */
export async function googleCreateEvent(token: string, input: GoogleEventInput): Promise<{ eventId: string; joinUrl: string | null }> {
  const created = await gcal(token, `/calendars/primary/events?conferenceDataVersion=1&sendUpdates=${input.attendees.length ? 'all' : 'none'}`, {
    method: 'POST',
    body: JSON.stringify({
      summary: input.subject,
      description: input.bodyHtml,
      start: { dateTime: new Date(input.startMs).toISOString() },
      end: { dateTime: new Date(input.endMs).toISOString() },
      ...(input.location ? { location: input.location } : {}),
      attendees: input.attendees.map((a) => ({ email: a.email, displayName: a.name, optional: !a.required })),
      guestsCanModify: false,
      ...(input.meet ? { conferenceData: { createRequest: { requestId: input.requestId.slice(0, 60), conferenceSolutionKey: { type: 'hangoutsMeet' } } } } : {}),
    }),
  });
  const linkOf = (ev: any): string | null => ev?.hangoutLink ?? (ev?.conferenceData?.entryPoints ?? []).find((p: any) => p.entryPointType === 'video')?.uri ?? null;
  let joinUrl = input.meet ? linkOf(created) : null;
  if (input.meet && !joinUrl && created?.id) {
    // Der Meet-Link entsteht teils erst kurz nach dem Anlegen
    for (let i = 0; i < 3 && !joinUrl; i++) {
      await new Promise((r) => setTimeout(r, 800));
      joinUrl = linkOf(await gcal(token, `/calendars/primary/events/${encodeURIComponent(created.id)}`));
    }
  }
  return { eventId: created.id, joinUrl };
}

/** Termin absagen; mit notify schickt Google allen Eingeladenen die Absage. */
export async function googleDeleteEvent(token: string, eventId: string, notify: boolean) {
  try {
    await gcal(token, `/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=${notify ? 'all' : 'none'}`, { method: 'DELETE' });
  } catch (e) {
    // schon gelöscht: nichts zu tun
    if (e instanceof GoogleError && (e.status === 404 || e.status === 410)) return;
    throw e;
  }
}
