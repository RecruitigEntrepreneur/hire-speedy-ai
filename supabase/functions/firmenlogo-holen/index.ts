import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceRole } from '../_shared/admin-auth.ts';
import { holeFirmenlogo, type HolErgebnis } from '../_shared/firmenlogo.ts';

/**
 * Firmenlogo von der Website holen (19.10.2026), siehe _shared/firmenlogo.ts.
 *
 *   { company_id }            – eine Firma; Kunde (Inhaber/Admin des Kontos) oder Matchunt
 *   { company_id, neu: true } – nur Matchunt: immer neu holen, auch über ein eigenes Logo
 *   { alle: true }            – nur Matchunt: Bestand nachholen, Stück für Stück im Zeitbudget;
 *                               die Antwort sagt, wie viele noch offen sind
 *
 * Ausgelöst, sobald die Website bekannt ist: beim Beantragen oder Ändern einer
 * Firma (Einstellungen, Aufnahme), bei der Annahme einer Aufnahme (intake-admin)
 * und aus Admin › Firmen prüfen.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const BESTAND_BUDGET_MS = 40_000;
const BESTAND_JE_AUFRUF = 25;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Nur POST.' }, 405);

  const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const deps = { fetch: (input: string | URL | Request, init?: RequestInit) => fetch(input, init), firecrawlKey: Deno.env.get('FIRECRAWL_API_KEY') ?? undefined };

  let body: { company_id?: unknown; alle?: unknown; neu?: unknown } = {};
  try { body = await req.json(); } catch { /* leer */ }
  const companyId = typeof body.company_id === 'string' ? body.company_id : null;

  // Wer ruft? Service (unser Backend), Matchunt-Admin oder ein Kunde.
  const intern = isServiceRole(req);
  let userId: string | null = null;
  let admin = intern;
  if (!intern) {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!jwt) return json({ error: 'Nicht angemeldet.' }, 401);
    const { data, error } = await service.auth.getUser(jwt);
    if (error || !data?.user) return json({ error: 'Sitzung ungültig.' }, 401);
    userId = data.user.id;
    const { data: rollen } = await service.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').limit(1);
    admin = !!rollen?.length;
  }

  try {
    // ---- Bestand nachholen (nur Matchunt) -----------------------------------
    if (body.alle === true) {
      if (!admin) return json({ error: 'Keine Berechtigung.' }, 403);
      const start = Date.now();
      const { data: offen, error } = await service.from('client_companies')
        .select('id')
        .is('logo_source', null)
        .is('logo_checked_at', null)
        .order('requested_at', { ascending: true })
        .limit(BESTAND_JE_AUFRUF);
      if (error) return json({ error: error.message }, 500);
      const ergebnisse: { id: string; status: HolErgebnis['status'] }[] = [];
      for (const { id } of offen ?? []) {
        if (Date.now() - start > BESTAND_BUDGET_MS) break;
        const r = await holeFirmenlogo(service, id as string, deps);
        ergebnisse.push({ id: id as string, status: r.status });
      }
      const { count } = await service.from('client_companies')
        .select('id', { count: 'exact', head: true })
        .is('logo_source', null)
        .is('logo_checked_at', null);
      return json({
        geholt: ergebnisse.filter(e => e.status === 'geholt').length,
        ohne: ergebnisse.filter(e => e.status !== 'geholt').length,
        offen: count ?? 0,
        ergebnisse,
      });
    }

    // ---- Eine Firma ----------------------------------------------------------
    if (!companyId) return json({ error: 'company_id fehlt.' }, 400);
    if (!admin) {
      const { data: firma } = await service.from('client_companies').select('owner_id').eq('id', companyId).maybeSingle();
      if (!firma) return json({ error: 'Firma nicht gefunden.' }, 404);
      const { data: konto } = await service.rpc('client_account_of', { p_user_id: userId });
      const ownerId = (Array.isArray(konto) ? konto[0] : konto)?.owner_id;
      if (!ownerId || ownerId !== (firma as { owner_id: string }).owner_id) return json({ error: 'Keine Berechtigung.' }, 403);
    }
    const ergebnis = await holeFirmenlogo(service, companyId, { ...deps, neu: admin && body.neu === true });
    return json(ergebnis, ergebnis.status === 'fehler' ? 500 : 200);
  } catch (e) {
    console.error('[firmenlogo-holen]', e instanceof Error ? e.message : e);
    return json({ error: 'Logo konnte nicht geholt werden.' }, 500);
  }
});
