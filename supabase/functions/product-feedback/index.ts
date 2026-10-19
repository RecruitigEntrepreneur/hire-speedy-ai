/**
 * Feedback-Lasche und Ticket-Eingang (19.10.2026).
 *
 * action 'submit' — Feedback anlegen. Zwei Wege hinein:
 *   - eingeloggt (Kunde, Headhunter, Admin): Nutzer-Token im Authorization-Header
 *   - Gast auf einem Aufnahme-Link: der Token aus dem Pfad (/start/:token bzw.
 *     /aufnahme/:draftToken) im Body. Er muss zu einem echten Link oder Entwurf
 *     gehören; abgelaufen oder widerrufen ist egal — gerade auf der Fehlerseite
 *     ist ein Hinweis wertvoll.
 *   Ticket anlegen, Bild und Ausschnitte in den privaten Bucket, antworten.
 *   Danach im Hintergrund: KI-Briefing (nur Ausschnitte), Mail an Matchunt.
 *
 * action 'brief' — Briefing neu formulieren (nur Admins).
 *
 * action 'purge' — Bilder älter als 90 Tage löschen (Cron mit x-cron-token,
 *   oder ein Admin von Hand). Direktes DELETE auf storage.objects ist gesperrt.
 *
 * verify_jwt = false: Gäste haben kein Konto. Die Prüfung sitzt hier.
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { preflight, json, fail, clientIp } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { hashToken } from '../_shared/tokens.ts';
import { checkLimits, type LimitRule } from '../_shared/intake-limits.ts';
import { esc, layout, sendIntakeMail } from '../_shared/intake-mail.ts';
import { getPublicAppUrl } from '../_shared/app-url.ts';
import { requireAdmin } from '../_shared/admin-auth.ts';
import { generateBrief, type FeedbackBrief } from '../_shared/feedback-brief.ts';

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

const BUCKET = 'feedback-screenshots';
const KEEP_DAYS = 90;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_CROP_BYTES = 1.5 * 1024 * 1024;
const MAX_CROPS = 20;
const NOTIFY_TO = () => Deno.env.get('FEEDBACK_NOTIFY_TO') ?? 'marko.benko@bluewater-bridge.de';

type Role = 'client' | 'recruiter' | 'admin' | 'guest';

interface Reporter {
  source: 'app' | 'intake';
  userId: string | null;
  role: Role;
  name: string | null;
  email: string | null;
  company: string | null;
  linkId: string | null;
  draftId: string | null;
}

interface Image { bytes: Uint8Array; type: string; ext: string; dataUrl: string }

const KIND_LABEL: Record<string, string> = { bug: 'Fehler', unclear: 'Unklar', idea: 'Idee', praise: 'Gefällt mir' };
const SEVERITY_LABEL: Record<string, string> = { blocker: 'blockiert', annoying: 'nervt', minor: 'Kleinigkeit' };
const ROLE_LABEL: Record<Role, string> = {
  client: 'Kunde', recruiter: 'Headhunter', admin: 'Admin', guest: 'Gast (Aufnahme-Link)',
};

const ticketLabel = (no: number | string) => `FB-${String(no).padStart(4, '0')}`;

/** Läuft nach der Antwort weiter; ohne EdgeRuntime (lokal) wird gewartet. */
function background(task: Promise<unknown>) {
  const guarded = task.catch((e) => console.error('[product-feedback] Hintergrund:', e instanceof Error ? e.message : e));
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(guarded);
    return Promise.resolve();
  }
  return guarded;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return fail('invalid_request', 'Nur POST.');

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail('invalid_request', 'Ungültige Anfrage.');
  }

  const supabase = serviceClient();

  try {
    if (body.action === 'submit') return await submit(req, supabase, body);
    if (body.action === 'brief') return await regenerate(req, supabase, body);
    if (body.action === 'purge') return await purge(req, supabase);
    return fail('invalid_request', 'Unbekannte Aktion.');
  } catch (e) {
    console.error('[product-feedback]', e instanceof Error ? e.message : e);
    return fail('internal_error', 'Feedback konnte nicht gespeichert werden.');
  }
});

// ---------------------------------------------------------------------------
// Absenden
// ---------------------------------------------------------------------------
async function submit(req: Request, supabase: SupabaseClient, body: Record<string, unknown>) {
  const reporter = (await reporterFromSession(req, supabase)) ?? (await reporterFromGuestToken(supabase, body.guest_token));
  if (!reporter) return fail('not_allowed', 'Feedback ist nur angemeldet oder über einen Aufnahme-Link möglich.');

  // Schalter (Notaus): aus = nur Admins.
  if (reporter.role !== 'admin') {
    const { data: settings } = await supabase.from('feedback_settings').select('enabled').eq('id', 1).maybeSingle();
    if (settings && settings.enabled === false) {
      return fail('not_allowed', 'Die Feedback-Funktion ist gerade ausgeschaltet.');
    }
  }

  const ip = clientIp(req);
  const rules: LimitRule[] = [{ zweck: 'feedback', scope: 'ip', key: ip, limit: 60 }];
  if (reporter.userId) rules.push({ zweck: 'feedback', scope: 'email', key: reporter.userId, limit: 40 });
  if (reporter.draftId) rules.push({ zweck: 'feedback', scope: 'draft', key: reporter.draftId, limit: 20 });
  else if (reporter.linkId) rules.push({ zweck: 'feedback', scope: 'link', key: reporter.linkId, limit: 60 });
  const limit = await checkLimits(supabase, rules);
  if (!limit.allowed) return fail('rate_limited', 'Zu viele Rückmeldungen in kurzer Zeit. Bitte später noch einmal.');

  const message = str(body.message, 5000)?.trim() ?? '';
  if (message.length < 3) return fail('invalid_request', 'Bitte kurz beschreiben, was gemeint ist.');

  const pagePath = str(body.page_path, 500);
  const row = {
    source: reporter.source,
    area: areaOf(pagePath, reporter),
    user_id: reporter.userId,
    reporter_role: reporter.role,
    reporter_name: reporter.name,
    reporter_email: reporter.email,
    reporter_company: reporter.company,
    intake_link_id: reporter.linkId,
    intake_draft_id: reporter.draftId,
    kind: typeof body.kind === 'string' && body.kind in KIND_LABEL ? body.kind : null,
    severity: typeof body.severity === 'string' && body.severity in SEVERITY_LABEL ? body.severity : null,
    message,
    marks: cleanMarks(body.marks),
    blackout_count: Math.max(0, Math.min(50, Number(body.blackout_count) || 0)),
    page_path: pagePath,
    page_title: str(body.page_title, 200),
    route_pattern: str(body.route_pattern, 200),
    source_file: str(body.source_file, 300),
    viewport: cleanViewport(body.viewport),
    user_agent: str(body.user_agent, 400) ?? str(req.headers.get('user-agent'), 400),
    app_version: str(body.app_version, 80),
    console_errors: cleanList(body.console_errors, 20, (o) => ({ t: str(o.t, 40), m: str(o.m, 500) })),
    network_errors: cleanList(body.network_errors, 15, (o) => ({
      t: str(o.t, 40),
      method: str(o.method, 10),
      url: str(o.url, 300),
      status: Number.isFinite(Number(o.status)) ? Number(o.status) : null,
      ms: Number.isFinite(Number(o.ms)) ? Math.round(Number(o.ms)) : null,
    })),
    breadcrumbs: cleanList(body.breadcrumbs, 25, (o) => ({
      t: str(o.t, 40),
      type: str(o.type, 12),
      label: str(o.label, 200),
    })),
    screenshot_note: str(body.screenshot_note, 300),
  };

  const { data: created, error: insertErr } = await supabase
    .from('product_feedback')
    .insert(row)
    .select('*')
    .single();
  if (insertErr || !created) {
    console.error('[product-feedback] Anlegen:', insertErr?.message);
    return fail('internal_error', 'Feedback konnte nicht gespeichert werden.');
  }

  // ---- Bild und Ausschnitte (Schwärzungen sind schon eingebrannt) ----------
  const d = new Date(created.created_at);
  const folder = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  const patch: Record<string, unknown> = {};

  const screenshot = decodeImage(body.screenshot, MAX_IMAGE_BYTES);
  if (screenshot === 'too_large') {
    patch.screenshot_note = 'Bild zu groß, nicht gespeichert.';
  } else if (screenshot) {
    const path = `${folder}/${created.id}.${screenshot.ext}`;
    if (await uploadImage(supabase, path, screenshot)) patch.screenshot_path = path;
    else patch.screenshot_note = 'Bild-Upload fehlgeschlagen.';
  }

  const crops: Image[] = (Array.isArray(body.crops) ? body.crops.slice(0, MAX_CROPS) : [])
    .map((c) => decodeImage(c, MAX_CROP_BYTES))
    .filter((c): c is Image => !!c && c !== 'too_large');
  const cropPaths: string[] = [];
  for (let i = 0; i < crops.length; i++) {
    const path = `${folder}/${created.id}-ausschnitt-${i + 1}.${crops[i].ext}`;
    if (await uploadImage(supabase, path, crops[i])) cropPaths.push(path);
  }
  if (cropPaths.length) patch.crop_paths = cropPaths;
  if (Object.keys(patch).length) await supabase.from('product_feedback').update(patch).eq('id', created.id);

  await supabase.from('product_feedback_events').insert({
    feedback_id: created.id,
    kind: 'created',
    data: { role: reporter.role, crops: cropPaths.length, has_image: !!patch.screenshot_path },
  });

  // ---- Danach: KI-Briefing und Mail, ohne den Absender warten zu lassen -----
  await background((async () => {
    const full = { ...created, ...patch };
    const brief = await briefAndStore(supabase, full, crops.map((c) => c.dataUrl), null);
    await notifyMatchunt(supabase, full, reporter, brief).catch((e) =>
      console.warn('[product-feedback] Mail:', e instanceof Error ? e.message : e));
  })());

  return json({ ok: true, ticket_no: created.ticket_no });
}

/** Briefing erzeugen und speichern. Priorität nur setzen, solange keine da ist. */
async function briefAndStore(
  supabase: SupabaseClient,
  row: Record<string, any>,
  crops: string[],
  actorId: string | null,
): Promise<FeedbackBrief | null> {
  try {
    const { brief, model } = await generateBrief(supabase, row, crops);
    const update: Record<string, unknown> = {
      title: brief.title,
      ai_brief: brief,
      ai_status: 'done',
      ai_error: null,
      ai_model: model,
      ai_generated_at: new Date().toISOString(),
    };
    if (!row.priority) update.priority = brief.priority;
    await supabase.from('product_feedback').update(update).eq('id', row.id);
    await supabase.from('product_feedback_events').insert({
      feedback_id: row.id,
      actor_id: actorId,
      kind: 'ai_brief',
      data: { model, priority: brief.priority, crops: crops.length },
    });
    return brief;
  } catch (e) {
    const message = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    console.error('[product-feedback] Briefing:', message);
    await supabase.from('product_feedback').update({ ai_status: 'failed', ai_error: message }).eq('id', row.id);
    await supabase.from('product_feedback_events').insert({
      feedback_id: row.id,
      actor_id: actorId,
      kind: 'ai_failed',
      body: message,
    });
    return null;
  }
}

/** Eingeloggt? Rolle und Namen aus Konto und Profil. */
async function reporterFromSession(req: Request, supabase: SupabaseClient): Promise<Reporter | null> {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!jwt || jwt === Deno.env.get('SUPABASE_ANON_KEY')) return null;

  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await asUser.auth.getUser();
  if (error || !data?.user) return null;
  const user = data.user;

  const [{ data: roles }, { data: profile }] = await Promise.all([
    supabase.from('user_roles').select('role').eq('user_id', user.id),
    supabase.from('profiles').select('full_name, email, company_name').eq('user_id', user.id).maybeSingle(),
  ]);
  const set = new Set((roles ?? []).map((r: { role: string }) => r.role));
  const role: Role = set.has('admin') ? 'admin' : set.has('recruiter') ? 'recruiter' : 'client';

  return {
    source: 'app',
    userId: user.id,
    role,
    name: profile?.full_name ?? null,
    email: profile?.email ?? user.email ?? null,
    company: profile?.company_name ?? null,
    linkId: null,
    draftId: null,
  };
}

/** Gast: Token eines Aufnahme-Links oder eines Entwurfs. */
async function reporterFromGuestToken(supabase: SupabaseClient, token: unknown): Promise<Reporter | null> {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) return null;
  const hash = await hashToken(token);

  const { data: link } = await supabase
    .from('intake_links')
    .select('id, prefill')
    .eq('token_hash', hash)
    .maybeSingle();
  if (link) {
    const p = (link.prefill ?? {}) as Record<string, unknown>;
    return {
      source: 'intake',
      userId: null,
      role: 'guest',
      name: (p.contact_name as string) ?? null,
      email: (p.contact_email as string) ?? null,
      company: (p.company_name as string) ?? null,
      linkId: link.id,
      draftId: null,
    };
  }

  const { data: draftToken } = await supabase
    .from('intake_draft_tokens')
    .select('draft_id')
    .eq('token_hash', hash)
    .maybeSingle();
  if (!draftToken) return null;

  const { data: draft } = await supabase
    .from('intake_drafts')
    .select('id, link_id, contact_name, contact_email, company_name')
    .eq('id', draftToken.draft_id)
    .maybeSingle();
  return {
    source: 'intake',
    userId: null,
    role: 'guest',
    name: draft?.contact_name ?? null,
    email: draft?.contact_email ?? null,
    company: draft?.company_name ?? null,
    linkId: draft?.link_id ?? null,
    draftId: draft?.id ?? null,
  };
}

function areaOf(path: string | null, reporter: Reporter): string {
  if (reporter.source === 'intake' || /^\/(start|aufnahme)\//.test(path ?? '')) return 'intake';
  if (/^\/dashboard(\/|$)/.test(path ?? '')) return 'client';
  if (/^\/recruiter(\/|$)/.test(path ?? '')) return 'recruiter';
  if (/^\/admin(\/|$)/.test(path ?? '')) return 'admin';
  return 'other';
}

async function uploadImage(supabase: SupabaseClient, path: string, image: Image) {
  const put = () => supabase.storage.from(BUCKET).upload(path, image.bytes, { contentType: image.type, upsert: false });
  let { error } = await put();
  if (error && /bucket not found|not found/i.test(error.message)) {
    // Erster Lauf: privaten Bucket anlegen, dann noch einmal.
    const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_IMAGE_BYTES,
      allowedMimeTypes: ['image/jpeg', 'image/png'],
    });
    if (createErr && !/already exists/i.test(createErr.message)) {
      console.error('[product-feedback] Bucket anlegen:', createErr.message);
      return false;
    }
    ({ error } = await put());
  }
  if (error) {
    console.error('[product-feedback] Upload:', error.message);
    return false;
  }
  return true;
}

async function notifyMatchunt(
  supabase: SupabaseClient,
  row: Record<string, any>,
  reporter: Reporter,
  brief: FeedbackBrief | null,
) {
  const ticket = ticketLabel(row.ticket_no);
  const who = [reporter.name, reporter.company].filter(Boolean).join(', ') || reporter.email || 'unbekannt';
  const art = [row.kind ? KIND_LABEL[row.kind] : null, row.severity ? SEVERITY_LABEL[row.severity] : null]
    .filter(Boolean).join(' · ');
  const snippet = String(row.message).replace(/\s+/g, ' ').slice(0, 60) + (String(row.message).length > 60 ? '…' : '');
  const subject = brief
    ? `${ticket} · ${brief.priority.toUpperCase()} · ${brief.title}`
    : `${ticket} · Feedback von ${ROLE_LABEL[reporter.role]}: „${snippet}“`;

  const line = (label: string, value: string) =>
    `<tr><td style="padding:2px 12px 2px 0;color:#6b7280;white-space:nowrap;vertical-align:top;">${esc(label)}</td><td style="padding:2px 0;">${value}</td></tr>`;
  const html = layout({
    preheader: brief?.summary ?? snippet,
    heading: brief ? `${ticket}: ${brief.title}` : `${ticket}: neues Feedback`,
    body: `
      ${brief ? `<p style="margin:0 0 12px 0;">${esc(brief.summary)}</p>` : ''}
      <div style="white-space:pre-wrap;border-left:3px solid #D85A30;padding:4px 0 4px 12px;margin:0 0 16px 0;">${esc(row.message)}</div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.5;">
        ${brief ? line('Priorität', `${esc(brief.priority.toUpperCase())} · ${esc(brief.priority_reason)}`) : ''}
        ${line('Von', `${esc(ROLE_LABEL[reporter.role])} · ${esc(who)}`)}
        ${reporter.email ? line('E-Mail', esc(reporter.email)) : ''}
        ${line('Seite', esc(row.page_path ?? '—'))}
        ${row.source_file ? line('Datei', esc(row.source_file)) : ''}
        ${art ? line('Art', esc(art)) : ''}
        ${line('Bild', row.screenshot_path ? 'ja, im Ticket' : 'nein')}
        ${row.network_errors?.length ? line('Netzwerk', `${row.network_errors.length} fehlgeschlagene Aufrufe`) : ''}
        ${row.console_errors?.length ? line('Konsole', `${row.console_errors.length} Fehlermeldung(en)`) : ''}
      </table>`,
    cta: { label: `${ticket} öffnen`, url: `${getPublicAppUrl()}/admin/feedback/${ticket}` },
  });

  await sendIntakeMail(supabase, {
    to: NOTIFY_TO(),
    subject,
    html,
    template: 'product_feedback',
    replyTo: reporter.email ?? undefined,
    meta: { feedback_id: row.id, ticket_no: row.ticket_no },
    idempotencyKey: `product-feedback-${row.id}`,
  });
}

// ---------------------------------------------------------------------------
// Briefing neu formulieren (Admin)
// ---------------------------------------------------------------------------
async function regenerate(req: Request, supabase: SupabaseClient, body: Record<string, unknown>) {
  const admin = await requireAdmin(req, supabase);
  if (!admin.ok) return fail('not_allowed', admin.message ?? 'Keine Berechtigung.');
  if (typeof body.id !== 'string') return fail('invalid_request', 'Ticket fehlt.');

  const { data: row } = await supabase.from('product_feedback').select('*').eq('id', body.id).maybeSingle();
  if (!row) return fail('not_found', 'Ticket nicht gefunden.');

  const crops: string[] = [];
  for (const path of (row.crop_paths ?? []) as string[]) {
    const { data: blob } = await supabase.storage.from(BUCKET).download(path);
    if (!blob) continue;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    crops.push(`data:${blob.type || 'image/jpeg'};base64,${toBase64(bytes)}`);
  }

  await supabase.from('product_feedback').update({ ai_status: 'pending' }).eq('id', row.id);
  const brief = await briefAndStore(supabase, row, crops, admin.userId ?? null);
  if (!brief) return fail('upstream_error', 'Die KI hat gerade nicht geantwortet. Bitte gleich noch einmal.');
  return json({ ok: true, brief });
}

// ---------------------------------------------------------------------------
// Bilder nach 90 Tagen löschen
// ---------------------------------------------------------------------------
async function purge(req: Request, supabase: SupabaseClient) {
  const cronToken = req.headers.get('x-cron-token');
  if (cronToken) {
    const { data: valid } = await supabase.rpc('cron_token_valid', { _name: 'feedback-purge', _token: cronToken });
    if (valid !== true) return fail('not_allowed', 'Ungültiger Schlüssel.');
  } else {
    const admin = await requireAdmin(req, supabase);
    if (!admin.ok) return fail('not_allowed', admin.message ?? 'Keine Berechtigung.');
  }

  const cutoff = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString();
  let removed = 0;
  for (let round = 0; round < 10; round++) {
    const { data: rows, error } = await supabase
      .from('product_feedback')
      .select('id, screenshot_path, crop_paths')
      .or('screenshot_path.not.is.null,crop_paths.neq.{}')
      .lt('created_at', cutoff)
      .limit(100);
    if (error) {
      console.error('[product-feedback] Purge lesen:', error.message);
      return fail('internal_error', 'Löschlauf fehlgeschlagen.');
    }
    if (!rows?.length) break;

    const paths = rows.flatMap((r) => [r.screenshot_path, ...((r.crop_paths ?? []) as string[])].filter(Boolean)) as string[];
    if (paths.length) {
      const { error: rmErr } = await supabase.storage.from(BUCKET).remove(paths);
      if (rmErr) {
        console.error('[product-feedback] Purge löschen:', rmErr.message);
        return fail('internal_error', 'Löschlauf fehlgeschlagen.');
      }
    }
    await supabase
      .from('product_feedback')
      .update({ screenshot_path: null, crop_paths: [], screenshot_deleted_at: new Date().toISOString() })
      .in('id', rows.map((r) => r.id));
    removed += rows.length;
  }
  return json({ ok: true, removed });
}

// ---------------------------------------------------------------------------
// Eingaben säubern
// ---------------------------------------------------------------------------
function str(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const s = value.slice(0, max);
  return s.length ? s : null;
}

const clamp01 = (v: unknown) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  return Math.min(1, Math.max(0, Math.round(n * 10000) / 10000));
};

function cleanList<T>(value: unknown, max: number, map: (o: Record<string, unknown>) => T): T[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-max).map((e) => map((e ?? {}) as Record<string, unknown>));
}

function cleanMarks(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map((m, i) => {
    const o = (m ?? {}) as Record<string, unknown>;
    const el = (o.element ?? null) as Record<string, unknown> | null;
    return {
      n: i + 1,
      x: clamp01(o.x),
      y: clamp01(o.y),
      w: clamp01(o.w),
      h: clamp01(o.h),
      element: el
        ? {
            kind: str(el.kind, 40),
            label: str(el.label, 120),
            context: str(el.context, 120),
            tour: str(el.tour, 120),
            inside: Array.isArray(el.inside) ? el.inside.slice(0, 8).map((x) => str(x, 120)).filter(Boolean) : [],
          }
        : null,
    };
  });
}

function cleanViewport(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const o = value as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
  return { w: num(o.w), h: num(o.h), dpr: num(o.dpr) };
}

function decodeImage(value: unknown, maxBytes: number): Image | 'too_large' | null {
  if (typeof value !== 'string') return null;
  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) return null;
  // base64: 4 Zeichen = 3 Bytes
  if ((match[2].length * 3) / 4 > maxBytes) return 'too_large';
  const bin = atob(match[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, type: match[1], ext: match[1] === 'image/png' ? 'png' : 'jpg', dataUrl: value };
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}
