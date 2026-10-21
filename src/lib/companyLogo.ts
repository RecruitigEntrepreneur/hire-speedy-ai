/**
 * Firmenlogo: Kürzel für den Fall ohne Logo.
 *
 * Bis 19.10.2026 lief hier ein Ersatz über Clearbit (Dienst seit Dezember 2025
 * abgeschaltet) und ui-avatars.com (bekam bei jedem Aufruf den Firmennamen).
 * Das Logo kommt jetzt aus client_companies.logo_url — hochgeladen oder von der
 * Website geholt (Function firmenlogo-holen); das Kürzel zeichnet FirmenLogo selbst.
 */

/** Rechtsformen und Füllwörter zählen nicht als Anfangsbuchstabe. */
const OHNE = new Set([
  'gmbh', 'mbh', 'ag', 'kg', 'kgaa', 'se', 'ug', 'ohg', 'gbr', 'ev', 'e.v.', 'eg', 'co', 'co.', 'kg.',
  'inc', 'inc.', 'ltd', 'ltd.', 'llc', 'bv', 'b.v.', 'sa', 's.a.', 'sarl', 'plc', 'und', 'and', 'the', 'der', 'die', 'das',
]);

/** „Bluewater & Bridge GmbH" → „BB", „ASMPT GmbH & Co. KG" → „AS", leer → „?". */
export const firmenInitialen = (companyName: string | null | undefined): string => {
  const woerter = (companyName ?? '')
    .split(/[\s/,+&()-]+/)
    .map(w => w.trim())
    .filter(w => w && !OHNE.has(w.toLowerCase()))
    .map(w => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
  if (woerter.length === 0) return '?';
  if (woerter.length === 1) return woerter[0].slice(0, 2).toUpperCase();
  return (woerter[0][0] + woerter[1][0]).toUpperCase();
};

/**
 * Format headcount number into human-readable band
 */
export const formatHeadcount = (count: number | null | undefined): string | null => {
  if (!count) return null;

  if (count < 50) return '< 50 MA';
  if (count < 200) return '50-200 MA';
  if (count < 500) return '200-500 MA';
  if (count < 1000) return '500-1.000 MA';
  if (count < 5000) return '1.000-5.000 MA';
  return '5.000+ MA';
};
