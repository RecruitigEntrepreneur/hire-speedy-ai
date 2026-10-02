// deno-lint-ignore-file no-explicit-any
// Microsoft-365-Anbindung für Interviews (delegiert, je Kunde) und das
// Matchunt-eigene Teams-Konto (Anwendungsrechte) für Kunden ohne Verbindung.
//
// Rechte der App (delegiert): offline_access openid email profile
// Calendars.ReadWrite. Damit: frei/belegt des Nutzers und seiner Kollegen
// (getSchedule), Termin mit Teams-Link anlegen/ändern/absagen. Keine Mail-,
// Datei- oder Chat-Rechte. Tokens liegen AES-GCM-verschlüsselt in
// calendar_connections und verlassen den Server nie.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptToken, encryptToken } from './encryption.ts';
import type { Interval } from './interview-availability.ts';

export const GRAPH = 'https://graph.microsoft.com/v1.0';
export const MS_SCOPES = 'offline_access openid email profile https://graph.microsoft.com/Calendars.ReadWrite';

export interface MsConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  encryptionKey: string;
  /** Matchunt-eigenes Teams-Konto (optional) */
  appTenantId?: string;
  organizerUserId?: string;
}

/** Liest die Konfiguration; null, wenn die Microsoft-App noch nicht eingerichtet ist. */
export function msConfig(env: (k: string) => string | undefined = (k) => Deno.env.get(k)): MsConfig | null {
  const clientId = env('MS_CLIENT_ID');
  const clientSecret = env('MS_CLIENT_SECRET');
  const encryptionKey = env('ENCRYPTION_KEY');
  if (!clientId || !clientSecret || !encryptionKey) return null;
  const supabaseUrl = env('SUPABASE_URL') ?? '';
  return {
    clientId,
    clientSecret,
    encryptionKey,
    redirectUri: env('MS_REDIRECT_URI') ?? `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/calendar-oauth-callback`,
    appTenantId: env('MS_APP_TENANT_ID') || undefined,
    organizerUserId: env('MS_ORGANIZER_USER_ID') || undefined,
  };
}

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(new Uint8Array(digest)) };
}

export function authorizeUrl(cfg: MsConfig, state: string, challenge: string, loginHint?: string): string {
  const p = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: 'code',
    redirect_uri: cfg.redirectUri,
    response_mode: 'query',
    scope: MS_SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  if (loginHint) p.set('login_hint', loginHint);
  return `https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize?${p}`;
}

/** Link, mit dem die IT des Kunden die App einmal für die ganze Firma freigibt. */
export function adminConsentUrl(cfg: MsConfig, state: string): string {
  const p = new URLSearchParams({ client_id: cfg.clientId, scope: 'https://graph.microsoft.com/.default', redirect_uri: cfg.redirectUri, state });
  return `https://login.microsoftonline.com/organizations/v2.0/adminconsent?${p}`;
}

export interface TokenSet { accessToken: string; refreshToken: string | null; expiresAt: number; idClaims: Record<string, unknown> }

function decodeJwtPayload(token: string | undefined): Record<string, unknown> {
  if (!token) return {};
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(part + '='.repeat((4 - (part.length % 4)) % 4)), (c) => c.charCodeAt(0))));
  } catch {
    return {};
  }
}

export class GraphError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

async function tokenRequest(body: Record<string, string>, tenant = 'organizations'): Promise<TokenSet> {
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new GraphError(res.status, String(data.error ?? 'token_error'), String(data.error_description ?? 'Token-Anfrage gescheitert').split('\r\n')[0]);
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    idClaims: decodeJwtPayload(data.id_token),
  };
}

export const exchangeCode = (cfg: MsConfig, code: string, verifier: string) =>
  tokenRequest({ client_id: cfg.clientId, client_secret: cfg.clientSecret, grant_type: 'authorization_code', code, redirect_uri: cfg.redirectUri, code_verifier: verifier, scope: MS_SCOPES });

export interface ConnectionRow {
  id: string;
  user_id: string;
  provider: string;
  account_email: string | null;
  tenant_id: string | null;
  refresh_token_encrypted: string | null;
  access_token_encrypted: string | null;
  token_expires_at: string | null;
  status: string;
}

export async function saveConnection(db: SupabaseClient, cfg: MsConfig, userId: string, tokens: TokenSet) {
  const email = String(tokens.idClaims.preferred_username ?? tokens.idClaims.email ?? '') || null;
  const tenant = String(tokens.idClaims.tid ?? '') || null;
  const row = {
    user_id: userId,
    provider: 'microsoft',
    account_email: email,
    tenant_id: tenant,
    refresh_token_encrypted: tokens.refreshToken ? await encryptToken(tokens.refreshToken, cfg.encryptionKey) : null,
    access_token_encrypted: await encryptToken(tokens.accessToken, cfg.encryptionKey),
    token_expires_at: new Date(tokens.expiresAt).toISOString(),
    scopes: MS_SCOPES,
    status: 'connected',
    error_message: null,
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from('calendar_connections').upsert(row, { onConflict: 'user_id,provider' });
  if (error) throw error;
  return { email, tenant };
}

export async function loadConnection(db: SupabaseClient, userId: string): Promise<ConnectionRow | null> {
  const { data } = await db.from('calendar_connections').select('*').eq('user_id', userId).eq('provider', 'microsoft').maybeSingle();
  return (data as ConnectionRow | null) ?? null;
}

/** Gültiges Zugriffstoken des Nutzers, erneuert bei Bedarf; null, wenn nicht (mehr) verbunden. */
export async function userAccessToken(db: SupabaseClient, cfg: MsConfig, userId: string): Promise<string | null> {
  const conn = await loadConnection(db, userId);
  if (!conn || conn.status !== 'connected') return null;
  const expires = conn.token_expires_at ? Date.parse(conn.token_expires_at) : 0;
  if (conn.access_token_encrypted && expires - Date.now() > 5 * 60000) {
    return await decryptToken(conn.access_token_encrypted, cfg.encryptionKey);
  }
  if (!conn.refresh_token_encrypted) return null;
  try {
    const refresh = await decryptToken(conn.refresh_token_encrypted, cfg.encryptionKey);
    const tokens = await tokenRequest({ client_id: cfg.clientId, client_secret: cfg.clientSecret, grant_type: 'refresh_token', refresh_token: refresh, scope: MS_SCOPES });
    await db.from('calendar_connections').update({
      access_token_encrypted: await encryptToken(tokens.accessToken, cfg.encryptionKey),
      // Microsoft dreht das Refresh-Token: immer das neue speichern
      refresh_token_encrypted: tokens.refreshToken ? await encryptToken(tokens.refreshToken, cfg.encryptionKey) : conn.refresh_token_encrypted,
      token_expires_at: new Date(tokens.expiresAt).toISOString(),
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', conn.id);
    return tokens.accessToken;
  } catch (error) {
    const code = error instanceof GraphError ? error.code : 'refresh_failed';
    await db.from('calendar_connections').update({
      status: code === 'invalid_grant' ? 'expired' : 'error',
      error_message: error instanceof Error ? error.message.slice(0, 300) : 'Erneuerung gescheitert',
      updated_at: new Date().toISOString(),
    }).eq('id', conn.id);
    return null;
  }
}

async function graph(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(path.startsWith('http') ? path : `${GRAPH}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new GraphError(res.status, String(data?.error?.code ?? 'graph_error'), String(data?.error?.message ?? `Graph ${res.status}`));
  return data;
}

const utcInput = (ms: number) => ({ dateTime: new Date(ms).toISOString().replace('Z', '').replace(/\.\d{3}$/, ''), timeZone: 'UTC' });
const parseUtc = (dt: { dateTime: string }) => Date.parse(dt.dateTime.endsWith('Z') ? dt.dateTime : `${dt.dateTime}Z`);

/**
 * Belegte Zeiten mehrerer Personen derselben Firma über das Token EINER
 * verbundenen Person (wie der Terminplanungs-Assistent in Outlook).
 * Ergebnis je E-Mail: Intervalle oder null (Kalender nicht sichtbar).
 */
export async function getBusy(token: string, emails: string[], fromMs: number, toMs: number): Promise<Record<string, Interval[] | null>> {
  const out: Record<string, Interval[] | null> = {};
  const unique = [...new Set(emails.map((e) => e.toLowerCase()))];
  for (let i = 0; i < unique.length; i += 20) {
    const batch = unique.slice(i, i + 20);
    const data = await graph(token, '/me/calendar/getSchedule', {
      method: 'POST',
      body: JSON.stringify({ schedules: batch, startTime: utcInput(fromMs), endTime: utcInput(toMs), availabilityViewInterval: 15 }),
    });
    for (const info of (data?.value ?? []) as Array<Record<string, any>>) {
      const id = String(info.scheduleId ?? '').toLowerCase();
      if (info.error) { out[id] = null; continue; }
      out[id] = ((info.scheduleItems ?? []) as Array<Record<string, any>>)
        .filter((it) => ['busy', 'tentative', 'oof'].includes(String(it.status)))
        .map((it) => ({ start: parseUtc(it.start), end: parseUtc(it.end) }));
    }
    for (const e of batch) if (!(e in out)) out[e] = null;
  }
  return out;
}

export interface EventInput {
  subject: string;
  bodyHtml: string;
  startMs: number;
  endMs: number;
  attendees: { email: string; name: string; required: boolean }[];
  transactionId: string;
}

/** Termin mit Teams-Link im Kalender des Kunden anlegen. Kollegen bekommen die Einladung aus Outlook. */
export async function createTeamsEvent(token: string, input: EventInput): Promise<{ eventId: string; joinUrl: string | null }> {
  const created = await graph(token, '/me/events', {
    method: 'POST',
    body: JSON.stringify({
      subject: input.subject,
      body: { contentType: 'HTML', content: input.bodyHtml },
      start: utcInput(input.startMs),
      end: utcInput(input.endMs),
      location: { displayName: 'Microsoft Teams-Besprechung' },
      attendees: input.attendees.map((a) => ({ emailAddress: { address: a.email, name: a.name }, type: a.required ? 'required' : 'optional' })),
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness',
      allowNewTimeProposals: false,
      transactionId: input.transactionId,
    }),
  });
  let joinUrl: string | null = created?.onlineMeeting?.joinUrl ?? null;
  if (!joinUrl && created?.id) {
    // Der Link wird teils erst kurz nach dem Anlegen befüllt
    for (let i = 0; i < 3 && !joinUrl; i++) {
      await new Promise((r) => setTimeout(r, 800));
      const again = await graph(token, `/me/events/${encodeURIComponent(created.id)}?$select=onlineMeeting`);
      joinUrl = again?.onlineMeeting?.joinUrl ?? null;
    }
  }
  return { eventId: created.id, joinUrl };
}

export async function cancelEvent(token: string, eventId: string, comment: string) {
  await graph(token, `/me/events/${encodeURIComponent(eventId)}/cancel`, { method: 'POST', body: JSON.stringify({ comment }) });
}

// --- Matchunt-eigenes Teams-Konto (Anwendungsrechte) -------------------------

async function appToken(cfg: MsConfig): Promise<string> {
  const t = await tokenRequest({ client_id: cfg.clientId, client_secret: cfg.clientSecret, grant_type: 'client_credentials', scope: 'https://graph.microsoft.com/.default' }, cfg.appTenantId);
  return t.accessToken;
}

/** Teams-Besprechung aus dem Matchunt-Konto; Wartebereich offen, damit niemand von Matchunt dabei sein muss. */
export async function createMatchuntMeeting(cfg: MsConfig, subject: string, startMs: number, endMs: number): Promise<{ meetingId: string; joinUrl: string } | null> {
  if (!cfg.appTenantId || !cfg.organizerUserId) return null;
  const token = await appToken(cfg);
  const data = await graph(token, `/users/${encodeURIComponent(cfg.organizerUserId)}/onlineMeetings`, {
    method: 'POST',
    body: JSON.stringify({
      subject,
      startDateTime: new Date(startMs).toISOString(),
      endDateTime: new Date(endMs).toISOString(),
      lobbyBypassSettings: { scope: 'everyone', isDialInBypassEnabled: true },
      allowedPresenters: 'everyone',
    }),
  });
  return data?.joinWebUrl ? { meetingId: data.id, joinUrl: data.joinWebUrl } : null;
}

export async function deleteMatchuntMeeting(cfg: MsConfig, meetingId: string) {
  if (!cfg.appTenantId || !cfg.organizerUserId) return;
  const token = await appToken(cfg);
  await graph(token, `/users/${encodeURIComponent(cfg.organizerUserId)}/onlineMeetings/${encodeURIComponent(meetingId)}`, { method: 'DELETE' });
}
