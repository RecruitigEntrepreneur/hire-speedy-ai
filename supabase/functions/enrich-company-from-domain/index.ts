import { enrichDomain } from '../_shared/company-enrichment.ts';

/**
 * Firma aus Website und Impressum. Die Arbeit steckt in
 * _shared/company-enrichment.ts (Firecrawl v2, Impressum-Suche, Zeitbudget) und
 * _shared/impressum.ts (Prüfung jedes Werts gegen den Seitentext).
 *
 * Antwort wie bisher { success, domain, data, warnings }, damit Kunden-Jobaufnahme,
 * Headhunter-Onboarding und Outreach unverändert lesen. Neu ist `impressum`:
 * ob geprüfte Impressum-Angaben gefunden wurden, von welcher Seite, und was
 * verworfen wurde. `success: true` heißt nur, dass die Anfrage lief; ob Firecrawl
 * geliefert hat, steht in `warnings`, ob ein Impressum dabei war, in `impressum.found`.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { domain } = await req.json();
    if (!domain) return json({ success: false, error: 'Domain is required' }, 400);

    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlKey) return json({ success: false, error: 'FIRECRAWL_API_KEY not configured' }, 500);

    const outcome = await enrichDomain(String(domain), {
      fetch: (input, init) => fetch(input, init),
      firecrawlKey,
      lovableKey: Deno.env.get('LOVABLE_API_KEY'),
    });
    if (!outcome) return json({ success: false, error: 'Invalid domain' }, 400);

    const { impressum, warnings } = outcome;
    const steps = warnings.map(w => `${w.step}:${w.status ?? w.detail ?? ''}`).join(' ');
    console.log(`[Enrich] ${outcome.domain}: Impressum ${impressum.found ? 'gefunden' : 'nicht gefunden'}`
      + ` (${impressum.url ?? 'keine Seite'}), verworfen: ${impressum.dropped.join(', ') || '-'}, Warnungen: ${steps || '-'}`);
    if (warnings.length) console.error('[Enrich] Firecrawl-Warnungen', JSON.stringify(warnings));

    return json({ success: true, domain: outcome.domain, data: outcome.data, warnings, impressum });
  } catch (error: unknown) {
    console.error('[Enrich] Error:', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
