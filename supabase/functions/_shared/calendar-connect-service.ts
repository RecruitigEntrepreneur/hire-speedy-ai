// deno-lint-ignore-file no-explicit-any
// Kalender verbinden (Microsoft 365): Status, Anmeldung starten, trennen,
// Freigabe-Bitte an die IT, Rücksprung von Microsoft.
import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateToken } from './tokens.ts';
import { adminConsentUrl, authorizeUrl, exchangeCode, pkcePair, saveConnection, type MsConfig } from './msgraph-calendar.ts';
import { calendarStatusFor, must, type ServiceCtx } from './interview-service.ts';
import * as mails from './interview-mails.ts';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Nur interne Pfade als Rücksprung zulassen. */
export function safeReturnPath(raw: unknown, fallback = '/dashboard/settings#kalender'): string {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') && value.length < 300 ? value : fallback;
}

/** Hängt ?kalender=… an einen Pfad und behält einen vorhandenen #Anker. */
export function withStatus(appUrl: string, path: string, status: string, extra: Record<string, string> = {}): string {
  const [base, hash] = path.split('#');
  const url = new URL(base, appUrl);
  url.searchParams.set('kalender', status);
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  return `${url.toString()}${hash ? `#${hash}` : ''}`;
}

export async function status(ctx: ServiceCtx, user: User) {
  return calendarStatusFor(ctx, user.id);
}

export async function connect(ctx: ServiceCtx, user: User, body: any) {
  must(ctx.ms, 'Die Kalender-Verbindung ist noch nicht eingerichtet.', 'not_deployed');
  const { verifier, challenge } = await pkcePair();
  const state = generateToken();
  const { error } = await ctx.db.from('calendar_oauth_states').insert({
    state, user_id: user.id, provider: 'microsoft', purpose: 'connect', code_verifier: verifier,
    return_path: safeReturnPath(body.returnPath), expires_at: new Date(ctx.now() + 15 * 60000).toISOString(),
  });
  must(!error, 'Die Anmeldung konnte nicht gestartet werden.', 'internal_error');
  return { url: authorizeUrl(ctx.ms!, state, challenge, user.email ?? undefined) };
}

export async function disconnect(ctx: ServiceCtx, user: User) {
  await ctx.db.from('calendar_connections').delete().eq('user_id', user.id).eq('provider', 'microsoft');
  return { ok: true };
}

export async function itRequest(ctx: ServiceCtx, user: User, body: any) {
  must(ctx.ms, 'Die Kalender-Verbindung ist noch nicht eingerichtet.', 'not_deployed');
  const itEmail = String(body.itEmail ?? '').trim().toLowerCase();
  must(EMAIL.test(itEmail), 'Bitte eine gültige E-Mail-Adresse Ihrer IT angeben.');
  const { data: member } = await ctx.db.from('organization_members').select('organization_id').eq('user_id', user.id).eq('status', 'active').limit(1).maybeSingle();
  const { data: owned } = await ctx.db.from('organizations').select('id, name').eq('owner_id', user.id).limit(1).maybeSingle();
  const orgId = owned?.id ?? member?.organization_id ?? null;
  const { data: org } = orgId ? await ctx.db.from('organizations').select('name').eq('id', orgId).maybeSingle() : { data: null };
  const { data: request, error } = await ctx.db.from('calendar_it_requests').insert({ requested_by: user.id, organization_id: orgId, it_email: itEmail }).select('id').single();
  must(!error && request, 'Die Bitte an die IT konnte nicht gespeichert werden.', 'internal_error');
  const state = generateToken();
  await ctx.db.from('calendar_oauth_states').insert({
    state, user_id: user.id, provider: 'microsoft', purpose: 'admin_consent', it_request_id: request!.id,
    expires_at: new Date(ctx.now() + 30 * 86400000).toISOString(),
  });
  const link = adminConsentUrl(ctx.ms!, state);
  const { data: prof } = await ctx.db.from('profiles').select('full_name').eq('user_id', user.id).maybeSingle();
  const content = mails.itConsentRequest({
    requesterName: prof?.full_name || user.email || 'Ein Kollege',
    companyName: org?.name ?? null,
    consentUrl: link,
    datasheetUrl: `${ctx.appUrl()}/kalender-datenblatt.html`,
  });
  const result = await ctx.mail({ fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: itEmail, replyTo: user.email ?? undefined, ...content }, { template: 'calendar_it_request', meta: { it_request_id: request!.id } });
  return { sent: result.sent, link };
}

/** Rücksprung von Microsoft (Anmeldung oder Firmen-Freigabe). Liefert die Weiterleitungs-URL. */
export async function handleCallback(ctx: ServiceCtx, params: URLSearchParams): Promise<string> {
  const app = ctx.appUrl();
  const stateKey = params.get('state') ?? '';
  const { data: state } = stateKey ? await ctx.db.from('calendar_oauth_states').select('*').eq('state', stateKey).maybeSingle() : { data: null };
  if (!state || Date.parse(state.expires_at) < ctx.now()) return withStatus(app, '/dashboard/settings#kalender', 'fehler', { grund: 'abgelaufen' });
  const returnPath = safeReturnPath(state.return_path);
  const error = params.get('error');
  const description = params.get('error_description') ?? '';

  if (state.purpose === 'admin_consent') {
    await ctx.db.from('calendar_oauth_states').delete().eq('state', stateKey);
    if (error || params.get('admin_consent')?.toLowerCase() !== 'true') return `${app}/kalender-freigabe.html?status=fehler`;
    const { data: req } = await ctx.db.from('calendar_it_requests').update({ status: 'approved', approved_at: new Date(ctx.now()).toISOString(), tenant_id: params.get('tenant') })
      .eq('id', state.it_request_id).select('requested_by').maybeSingle();
    if (req?.requested_by) {
      const { data: prof } = await ctx.db.from('profiles').select('full_name, email').eq('user_id', req.requested_by).maybeSingle();
      if (prof?.email) {
        const content = mails.itApproved({ name: prof.full_name ?? '', connectUrl: `${app}/dashboard/settings#kalender` });
        await ctx.mail({ fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: prof.email, ...content }, { template: 'calendar_it_approved', meta: { it_request_id: state.it_request_id } });
      }
    }
    return `${app}/kalender-freigabe.html?status=ok`;
  }

  await ctx.db.from('calendar_oauth_states').delete().eq('state', stateKey);
  if (error) {
    // AADSTS65001/90094/90095: Zustimmung nur durch Admin möglich
    const needsAdmin = /AADSTS(65001|90094|90095|90099)|admin|consent_required/i.test(`${error} ${description}`);
    console.warn('[calendar] Microsoft-Fehler', error, description.slice(0, 160));
    return withStatus(app, returnPath, needsAdmin ? 'it' : 'fehler', needsAdmin ? {} : { grund: error.slice(0, 40) });
  }
  const code = params.get('code');
  if (!code || !state.code_verifier || !state.user_id) return withStatus(app, returnPath, 'fehler');
  try {
    await saveConnection(ctx.db as SupabaseClient, ctx.ms as MsConfig, state.user_id, await exchangeCode(ctx.ms as MsConfig, code, state.code_verifier));
    await ctx.db.from('calendar_it_requests').update({ status: 'approved', approved_at: new Date(ctx.now()).toISOString() }).eq('requested_by', state.user_id).eq('status', 'sent');
    return withStatus(app, returnPath, 'verbunden');
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[calendar] Code-Tausch gescheitert', message.slice(0, 200));
    return withStatus(app, returnPath, /AADSTS(65001|90094|90095)|consent/i.test(message) ? 'it' : 'fehler');
  }
}
