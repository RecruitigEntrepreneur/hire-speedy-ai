import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkLimits, LIMITS, type LimitResult, type LimitRule } from './intake-limits.ts';
import { normalizeDomain, domainFromEmail, isFreemailAddress } from './domain.ts';
import { must, type OnboardingCase } from './recruiter-onboarding-service.ts';
import { suggestionFrom, type EnrichmentData } from './recruiter-company.ts';

/**
 * Vertragsdaten aus dem Impressum statt aus zwanzig Feldern.
 *
 * Der Headhunter nennt seine Website, oder sie ergibt sich aus seiner
 * geschäftlichen E-Mail-Adresse. Die vorhandene Function
 * `enrich-company-from-domain` (Jobaufnahme) liest die Seite und das Impressum:
 * Firmierung, Anschrift, Registernummer, USt-IdNr., Geschäftsführung. Daraus
 * wird ein Vorschlag, den er auf einer Karte bestätigt oder korrigiert.
 *
 * Ein Vorschlag ist ein Vorschlag: gespeichert wird erst, was der Headhunter
 * bestätigt hat, und Matchunt prüft alles vor der Gegenzeichnung.
 */

export interface EnrichDeps {
  limits: (db: SupabaseClient, rules: LimitRule[]) => Promise<LimitResult>;
  fetch: typeof fetch;
  env: (key: string) => string | undefined;
}
export const liveEnrichDeps = (): EnrichDeps => ({
  limits: checkLimits,
  fetch: (input, init) => globalThis.fetch(input, init),
  env: key => Deno.env.get(key),
});

export async function enrichCase(db: SupabaseClient, c: OnboardingCase, body: { website?: unknown }, ip: string | null, deps: EnrichDeps = liveEnrichDeps()) {
  must(c.state === 'draft', 'Die Angaben sind bereits zur Prüfung eingereicht.', 'conflict');
  const website = typeof body.website === 'string' ? body.website.trim() : '';
  // Ohne Angabe zählt die Domain der geschäftlichen Adresse; Freemail sagt nichts über die Firma.
  const domain = website ? normalizeDomain(website) : (isFreemailAddress(c.email) ? null : domainFromEmail(c.email));
  must(domain, website ? 'Das sieht nicht nach einer Website aus. Bitte prüfe die Adresse.' : 'Bitte gib die Website deines Unternehmens an.');
  const limit = await deps.limits(db, LIMITS.recruiterEnrich(c.id, ip));
  must(limit.allowed, 'Gerade viele Anfragen. Bitte versuche es in ein paar Minuten noch einmal.', 'rate_limited');
  const url = deps.env('SUPABASE_URL');
  const key = deps.env('SUPABASE_SERVICE_ROLE_KEY');
  must(url && key, 'Das Lesen der Website ist noch nicht eingerichtet.', 'not_deployed');
  let res: Response;
  try {
    res = await deps.fetch(`${url}/functions/v1/enrich-company-from-domain`, {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain }), signal: AbortSignal.timeout(55_000),
    });
  } catch (e) {
    console.error('[recruiter-enrich] Aufruf fehlgeschlagen', e instanceof Error ? e.name : '');
    must(false, 'Wir konnten die Website gerade nicht lesen. Trag die Angaben bitte selbst ein.', 'upstream_error');
  }
  const payload = res.ok ? await res.json().catch(() => null) : null;
  const data = payload?.success ? payload.data as EnrichmentData : null;
  // Nur Angaben aus dem Impressum zählen. Den Namen rät die Function notfalls aus der
  // Domain; allein ist er kein Fund. So stand am 16.09.2026 „Bluewater-bridge“ ohne
  // Anschrift auf der Karte, obwohl Firecrawl die Seite gar nicht gelesen hatte.
  if (!data || !(data.legal_name || (data.street && data.postal_code))) {
    const warnings: { step?: string; status?: number; detail?: string }[] = Array.isArray(payload?.warnings) ? payload.warnings : [];
    const unread = warnings.filter(w => w?.step === 'impressum');
    if (warnings.length) console.error('[recruiter-enrich] Impressum nicht gelesen', warnings.map(w => `${w?.step}:${w?.status ?? w?.detail ?? ''}`).join(' '));
    must(!unread.length, 'Wir konnten deine Website gerade nicht lesen. Trag die Angaben bitte selbst ein.', 'upstream_error');
    must(false, 'Auf der Website haben wir kein Impressum gefunden. Trag die Angaben bitte selbst ein.', 'not_found');
  }
  return { suggestion: suggestionFrom(data!, domain) };
}
