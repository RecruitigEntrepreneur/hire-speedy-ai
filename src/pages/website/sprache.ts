import { COOKIE_SPRACHE, ausSlug, type Code } from '@/startseite/website/sprachen';

/**
 * Sprache einer Website-Seite in der App: aus der Adresse (/w/<sprache>), sonst die im Menü gemerkte
 * Wahl (Cookie mu_sprache), sonst Deutsch. Gilt für Startseite, Headhunter-Seite und Rechtstexte.
 */
export function websiteSprache(slug?: string | null): Code {
  return ausSlug(slug)?.code ?? ausSlug(gemerkteSprache())?.code ?? 'de';
}

function gemerkteSprache(): string | null {
  if (typeof document === 'undefined') return null;
  const eintrag = document.cookie.split('; ').find((c) => c.startsWith(`${COOKIE_SPRACHE}=`));
  return eintrag ? decodeURIComponent(eintrag.split('=')[1]) : null;
}
