/**
 * CORS- und Antwort-Helfer.
 *
 * Die identische corsHeaders-Konstante liegt heute in 82 Function-Dateien
 * kopiert vor. Neue Functions benutzen diese hier.
 *
 * Warum 'authorization, apikey' in Allow-Headers stehen MUSS, auch bei
 * verify_jwt = false: supabase-js haengt bei jedem invoke() automatisch
 * apikey und Authorization an; ohne Session faellt der Access-Token auf den
 * anon-Key zurueck. Ein Preflight ohne diese Header schlaegt fehl.
 */
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const preflight = (req: Request): Response | null =>
  req.method === 'OPTIONS' ? new Response(null, { headers: corsHeaders }) : null;

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/**
 * Fehlerantwort mit maschinenlesbarem Grund.
 *
 * Die Gruende folgen validate-invite/index.ts:51-62, damit das Frontend
 * dieselbe Fallunterscheidung fahren kann wie beim Einladungslink.
 */
export type FailureReason =
  | 'invalid_request'
  | 'not_found'
  | 'expired'
  | 'revoked'
  | 'exhausted'
  | 'rate_limited'
  | 'not_allowed'
  | 'conflict'
  | 'upstream_error'
  | 'not_deployed'
  | 'internal_error';

const STATUS: Record<FailureReason, number> = {
  invalid_request: 400,
  not_found: 404,
  expired: 410,
  revoked: 410,
  exhausted: 410,
  rate_limited: 429,
  not_allowed: 403,
  conflict: 409,
  upstream_error: 502,
  not_deployed: 503,
  internal_error: 500,
};

export const fail = (reason: FailureReason, message: string, extra?: Record<string, unknown>) =>
  json({ error: reason, reason, message, ...(extra ?? {}) }, STATUS[reason]);

/** Client-IP aus den ueblichen Proxy-Headern. Kann fehlen — dann null. */
export const clientIp = (req: Request): string | null => {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim() || null;
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? null;
};

/** Erste 200 Zeichen des User-Agent; laenger ist fuer den Nachweis wertlos. */
export const userAgent = (req: Request): string | null =>
  (req.headers.get('user-agent') ?? '').slice(0, 200) || null;

/**
 * Ein fehlendes Schema ist kein interner Fehler, sondern eine nicht angewandte
 * Migration. Der Unterschied ist wichtig: hier darf nicht "gespeichert"
 * gemeldet werden, wenn nichts gespeichert wurde — genau das passiert heute in
 * intakeCapture.ts:56, wo der Fehler still geschluckt wird.
 */
export const isMissingRelation = (error: { code?: string; message?: string } | null): boolean => {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST204') return true;
  const m = (error.message ?? '').toLowerCase();
  return (
    (m.includes('relation') && m.includes('does not exist')) ||
    (m.includes('could not find') && m.includes('schema cache'))
  );
};
