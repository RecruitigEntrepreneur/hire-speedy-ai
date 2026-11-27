/**
 * Adressen der öffentlichen Website (27.11.2026). main.tsx startet für sie ein eigenes, leichtes Bündel
 * (WebsiteApp) statt der ganzen App – die Website soll schnell laden, auch am Handy und für Google.
 * Klein halten: main.tsx importiert diese Datei direkt.
 */
export const WEBSITE_SEITEN = ['/', '/headhunter', '/karriere', '/impressum', '/datenschutz', '/agb'] as const;
/** Alte Adressen, die auf die Website umleiten. */
export const ALTE_SEITEN: Record<string, string> = {
  '/about': '/', '/contact': '/', '/blog': '/', '/guides': '/', '/docs': '/', '/help': '/', '/press': '/',
  '/careers': '/karriere',
};

export function istWebsitePfad(pfad: string): boolean {
  const p = pfad.length > 1 ? pfad.replace(/\/+$/, '') : pfad;
  return (WEBSITE_SEITEN as readonly string[]).includes(p) || p in ALTE_SEITEN || /^\/w\/[a-z-]+$/.test(p);
}
