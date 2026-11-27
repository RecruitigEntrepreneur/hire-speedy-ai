// deno-lint-ignore-file no-explicit-any
// Zoom-Anbindung (26.11.2026): jeder Nutzer verbindet sein eigenes Zoom-Konto
// (Marko: „Jeder selbst“), Matchunt legt beim Buchen die Besprechung an.
//
// Rechte der Zoom-App (im Zoom Marketplace eingestellt, nicht in der URL):
//   user:read:user           wer sich verbunden hat (E-Mail)
//   meeting:write:meeting    Besprechung anlegen
//   meeting:delete:meeting   Besprechung bei Absage löschen
// Tokens liegen AES-GCM-verschlüsselt in calendar_connections (provider 'zoom').

export interface ZoomConfig { clientId: string; clientSecret: string; redirectUri: string; encryptionKey: string }

export function zoomConfig(env: (k: string) => string | undefined = (k) => Deno.env.get(k)): ZoomConfig | null {
  const clientId = env('ZOOM_CLIENT_ID');
  const clientSecret = env('ZOOM_CLIENT_SECRET');
  const encryptionKey = env('ENCRYPTION_KEY');
  if (!clientId || !clientSecret || !encryptionKey) return null;
  const supabaseUrl = (env('SUPABASE_URL') ?? '').replace(/\/+$/, '');
  return { clientId, clientSecret, encryptionKey, redirectUri: env('ZOOM_REDIRECT_URI') ?? `${supabaseUrl}/functions/v1/calendar-oauth-callback` };
}

export class ZoomError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export function zoomAuthorizeUrl(cfg: ZoomConfig, state: string, challenge: string): string {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return `https://zoom.us/oauth/authorize?${p}`;
}

export interface ZoomTokens { accessToken: string; refreshToken: string | null; expiresAt: number }

async function tokenRequest(cfg: ZoomConfig, body: Record<string, string>): Promise<ZoomTokens> {
  const res = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${btoa(`${cfg.clientId}:${cfg.clientSecret}`)}` },
    body: new URLSearchParams(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ZoomError(res.status, String(data.error ?? data.reason ?? 'token_error'), String(data.error_description ?? data.reason ?? 'Token-Anfrage gescheitert'));
  return { accessToken: data.access_token, refreshToken: data.refresh_token ?? null, expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000 };
}

export const zoomExchangeCode = (cfg: ZoomConfig, code: string, verifier: string) =>
  tokenRequest(cfg, { grant_type: 'authorization_code', code, redirect_uri: cfg.redirectUri, code_verifier: verifier });

/** Zoom dreht das Refresh-Token bei jeder Erneuerung: immer das neue speichern. */
export const zoomRefresh = (cfg: ZoomConfig, refreshToken: string) =>
  tokenRequest(cfg, { grant_type: 'refresh_token', refresh_token: refreshToken });

async function zoom(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.zoom.us/v2${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ZoomError(res.status, String(data?.code ?? 'zoom_error'), String(data?.message ?? `Zoom ${res.status}`));
  return data;
}

export async function zoomMe(token: string): Promise<{ email: string | null; accountId: string | null }> {
  const me = await zoom(token, '/users/me');
  return { email: me?.email ? String(me.email).toLowerCase() : null, accountId: me?.account_id ?? null };
}

/** Besprechung anlegen. Ohne Wartebereich und mit Beitritt vor dem Gastgeber, damit der Kandidat nicht hängen bleibt. */
export async function zoomCreateMeeting(token: string, o: { topic: string; startMs: number; endMs: number }): Promise<{ meetingId: string; joinUrl: string }> {
  const data = await zoom(token, '/users/me/meetings', {
    method: 'POST',
    body: JSON.stringify({
      topic: o.topic.slice(0, 200),
      type: 2,
      start_time: new Date(o.startMs).toISOString().replace(/\.\d{3}Z$/, 'Z'),
      duration: Math.max(15, Math.round((o.endMs - o.startMs) / 60000)),
      timezone: 'Europe/Berlin',
      settings: { join_before_host: true, waiting_room: false, mute_upon_entry: false },
    }),
  });
  return { meetingId: String(data.id), joinUrl: String(data.join_url) };
}

export async function zoomDeleteMeeting(token: string, meetingId: string) {
  try {
    await zoom(token, `/meetings/${encodeURIComponent(meetingId)}`, { method: 'DELETE' });
  } catch (e) {
    if (e instanceof ZoomError && e.status === 404) return;
    throw e;
  }
}
