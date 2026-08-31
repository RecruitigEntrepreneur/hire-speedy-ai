/**
 * Basis-URL fuer Links in E-Mails.
 *
 * Heute gibt es dafuer vier konkurrierende Ableitungen:
 *   organization-invite/index.ts:175    origin-Header mit SITE_URL-Fallback
 *   request-reference/index.ts:114      reiner origin-Header, ohne Fallback
 *   _shared/provider-config.ts:74-76    APP_URL, Default http://localhost:8080
 *   send-interview-invitation:271-276   Deno.env('VITE_SUPABASE_URL') mit
 *                                       .replace('.supabase.co','')
 *
 * Der origin-Header taugt nicht: er ist vom Aufrufer steuerbar (damit ein
 * Link-Manipulationsvektor) und im Server-zu-Server-Fall leer. Deshalb hier
 * ausschliesslich Konfiguration, mit der kanonischen Domain als Fallback.
 *
 * Gelockt in ONBOARDING_INTAKE_MASTERANALYSE.md: der Akquise-Link laeuft als
 * matchunt.ai/start/<token> auf der kanonischen Domain, kein URL-Shortener.
 */
const FALLBACK = 'https://matchunt.ai';

export function getPublicAppUrl(): string {
  const raw = Deno.env.get('APP_URL') ?? Deno.env.get('SITE_URL') ?? FALLBACK;
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(trimmed)) return FALLBACK;
  // localhost ist in einer versendeten Mail immer ein Konfigurationsfehler.
  if (/localhost|127\.0\.0\.1/.test(trimmed)) {
    console.warn('[app-url] APP_URL zeigt auf localhost — fuer Mail-Links wird', FALLBACK, 'benutzt.');
    return FALLBACK;
  }
  return trimmed;
}

/** Einstiegslink eines Aufnahme-Links. */
export const intakeStartUrl = (token: string): string =>
  `${getPublicAppUrl()}/start/${encodeURIComponent(token)}`;

/** Fortsetzungslink eines konkreten Entwurfs. */
export const intakeResumeUrl = (draftToken: string): string =>
  `${getPublicAppUrl()}/aufnahme/${encodeURIComponent(draftToken)}`;
