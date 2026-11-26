// deno-lint-ignore-file no-explicit-any
// Eine Stelle für Kalender und Gesprächswerkzeuge (26.11.2026):
// Kalender = Outlook (Microsoft 365) ODER Google, je Person einer.
// Gesprächswerkzeug = Teams (am Outlook-Termin), Google Meet (am Google-Termin)
// oder Zoom (eigener Anschluss, zusätzlich zum Kalender).
// Interview-Terminierung und Terminseite sprechen nur noch mit dieser Datei.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptToken, encryptToken } from './encryption.ts';
import type { Interval } from './interview-availability.ts';
import {
  cancelEvent as msCancel, createTeamsEvent, deleteEvent as msDelete, getBusy as msBusy, msConfig, userAccessToken, type MsConfig,
} from './msgraph-calendar.ts';
import { googleBusy, googleConfig, googleCreateEvent, googleDeleteEvent, googleRefresh, GoogleError, GOOGLE_SCOPES, type GoogleConfig, type GoogleTokens } from './google-calendar.ts';
import { zoomConfig, zoomCreateMeeting, zoomDeleteMeeting, zoomRefresh, ZoomError, type ZoomConfig, type ZoomTokens } from './zoom-meetings.ts';

export type CalProvider = 'microsoft' | 'google';
export type VideoTool = 'teams' | 'meet' | 'zoom';
export const VIDEO_TOOLS: VideoTool[] = ['teams', 'meet', 'zoom'];
export const isVideoTool = (v: unknown): v is VideoTool => VIDEO_TOOLS.includes(v as VideoTool);
export const TOOL_NAME: Record<VideoTool, string> = { teams: 'Microsoft Teams', meet: 'Google Meet', zoom: 'Zoom' };
/** Welches Werkzeug am Kalender hängt: Outlook → Teams, Google → Meet. */
export const toolOfCalendar = (p: CalProvider): VideoTool => (p === 'google' ? 'meet' : 'teams');

export interface HubConfig { ms: MsConfig | null; google: GoogleConfig | null; zoom: ZoomConfig | null }
export const hubConfig = (): HubConfig => ({ ms: msConfig(), google: googleConfig(), zoom: zoomConfig() });

export interface UserCalendar { provider: CalProvider; token: string; accountEmail: string | null }

// ---------------------------------------------------------------------------
// Tokens für Google und Zoom (Microsoft: msgraph-calendar.ts › userAccessToken)
// ---------------------------------------------------------------------------

type OtherProvider = 'google' | 'zoom';

export async function saveOtherConnection(db: SupabaseClient, provider: OtherProvider, key: string, userId: string, tokens: GoogleTokens | ZoomTokens, accountEmail: string | null) {
  const row = {
    user_id: userId,
    provider,
    account_email: accountEmail,
    tenant_id: null,
    refresh_token_encrypted: tokens.refreshToken ? await encryptToken(tokens.refreshToken, key) : null,
    access_token_encrypted: await encryptToken(tokens.accessToken, key),
    token_expires_at: new Date(tokens.expiresAt).toISOString(),
    scopes: provider === 'google' ? GOOGLE_SCOPES : 'user:read:user meeting:write:meeting meeting:delete:meeting',
    status: 'connected',
    error_message: null,
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from('calendar_connections').upsert(row, { onConflict: 'user_id,provider' });
  if (error) throw error;
}

async function otherToken(db: SupabaseClient, hub: HubConfig, userId: string, provider: OtherProvider): Promise<string | null> {
  const cfg = provider === 'google' ? hub.google : hub.zoom;
  if (!cfg) return null;
  const { data: conn } = await db.from('calendar_connections').select('*').eq('user_id', userId).eq('provider', provider).maybeSingle();
  if (!conn || conn.status !== 'connected') return null;
  const expires = conn.token_expires_at ? Date.parse(conn.token_expires_at) : 0;
  if (conn.access_token_encrypted && expires - Date.now() > 5 * 60000) return await decryptToken(conn.access_token_encrypted, cfg.encryptionKey);
  if (!conn.refresh_token_encrypted) return null;
  try {
    const refresh = await decryptToken(conn.refresh_token_encrypted, cfg.encryptionKey);
    const tokens = provider === 'google' ? await googleRefresh(cfg as GoogleConfig, refresh) : await zoomRefresh(cfg as ZoomConfig, refresh);
    await db.from('calendar_connections').update({
      access_token_encrypted: await encryptToken(tokens.accessToken, cfg.encryptionKey),
      refresh_token_encrypted: tokens.refreshToken ? await encryptToken(tokens.refreshToken, cfg.encryptionKey) : conn.refresh_token_encrypted,
      token_expires_at: new Date(tokens.expiresAt).toISOString(),
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', conn.id);
    return tokens.accessToken;
  } catch (error) {
    const code = error instanceof GoogleError || error instanceof ZoomError ? error.code : 'refresh_failed';
    await db.from('calendar_connections').update({
      status: code === 'invalid_grant' || code === 'invalid_request' ? 'expired' : 'error',
      error_message: error instanceof Error ? error.message.slice(0, 300) : 'Erneuerung gescheitert',
      updated_at: new Date().toISOString(),
    }).eq('id', conn.id);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Kalender der Person
// ---------------------------------------------------------------------------

/** Verbundener Kalender (Outlook oder Google) mit gültigem Token; null = keiner. prefer: der beim Buchen benutzte. */
export async function userCalendar(db: SupabaseClient, hub: HubConfig, userId: string | null | undefined, prefer?: CalProvider | null): Promise<UserCalendar | null> {
  if (!userId) return null;
  const { data } = await db.from('calendar_connections').select('provider, account_email, status, connected_at')
    .eq('user_id', userId).in('provider', ['microsoft', 'google']).eq('status', 'connected').order('connected_at', { ascending: false });
  const rows = (data ?? []) as any[];
  const row = (prefer ? rows.find((r) => r.provider === prefer) : null) ?? rows[0];
  if (!row) return null;
  try {
    const token = row.provider === 'microsoft'
      ? (hub.ms ? await userAccessToken(db, hub.ms, userId) : null)
      : await otherToken(db, hub, userId, 'google');
    return token ? { provider: row.provider, token, accountEmail: row.account_email ? String(row.account_email).toLowerCase() : null } : null;
  } catch (e) {
    console.warn('[kalender] Token nicht verfügbar', row.provider, e instanceof Error ? e.message : e);
    return null;
  }
}

export async function zoomToken(db: SupabaseClient, hub: HubConfig, userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  return await otherToken(db, hub, userId, 'zoom').catch(() => null);
}

/** Kalender-Adressen je Nutzer (die Login-Adresse kann eine andere sein als die im Kalender). */
export async function calendarAddresses(db: SupabaseClient, userIds: string[], provider: CalProvider): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!userIds.length) return out;
  const { data } = await db.from('calendar_connections').select('user_id, account_email').in('user_id', userIds).eq('provider', provider).eq('status', 'connected');
  for (const row of (data ?? []) as any[]) if (row.account_email) out.set(row.user_id, String(row.account_email).toLowerCase());
  return out;
}

export const calBusy = (cal: UserCalendar, emails: string[], fromMs: number, toMs: number): Promise<Record<string, Interval[] | null>> =>
  cal.provider === 'google' ? googleBusy(cal.token, emails, fromMs, toMs) : msBusy(cal.token, emails, fromMs, toMs);

export interface CalEventInput {
  subject: string;
  bodyHtml: string;
  startMs: number;
  endMs: number;
  attendees: { email: string; name: string; required: boolean }[];
  /** eindeutige Kennung (Outlook: transactionId, Google: requestId) */
  key: string;
  /** Link am Kalendertermin selbst anlegen (Teams bei Outlook, Meet bei Google) */
  withMeeting: boolean;
  location?: string;
}

export async function calCreate(cal: UserCalendar, input: CalEventInput): Promise<{ eventId: string; joinUrl: string | null }> {
  if (cal.provider === 'google') {
    return googleCreateEvent(cal.token, { subject: input.subject, bodyHtml: input.bodyHtml, startMs: input.startMs, endMs: input.endMs, attendees: input.attendees, requestId: input.key, meet: input.withMeeting, location: input.location });
  }
  return createTeamsEvent(cal.token, { subject: input.subject, bodyHtml: input.bodyHtml, startMs: input.startMs, endMs: input.endMs, attendees: input.attendees, transactionId: input.key, online: input.withMeeting, location: input.location });
}

/** Termin mit Eingeladenen absagen (die Kollegen bekommen die Absage aus dem Kalender). */
export const calCancel = (cal: UserCalendar, eventId: string, comment: string) =>
  cal.provider === 'google' ? googleDeleteEvent(cal.token, eventId, true) : msCancel(cal.token, eventId, comment);

/** Termin ohne Eingeladene entfernen (Erstgespräch der Terminseite). */
export const calDelete = (cal: UserCalendar, eventId: string) =>
  cal.provider === 'google' ? googleDeleteEvent(cal.token, eventId, false) : msDelete(cal.token, eventId);

export { zoomCreateMeeting, zoomDeleteMeeting };
