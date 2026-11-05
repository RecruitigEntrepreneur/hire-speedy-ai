import type { Gespraechsart } from '@/lib/terminApi';

/**
 * Texte der Einladung zum Gespräch (01.11.2026). Der Headhunter wählt, was er anbietet;
 * der Satz dazu passt sich an. [Link] markiert die Stelle des persönlichen Links.
 */
export type EinladungAnlass = 'kennenlernen' | 'besprochen';
export const EINLADUNG_ANLAESSE: { key: EinladungAnlass; label: string }[] = [
  { key: 'kennenlernen', label: 'Erstes Kennenlernen' },
  { key: 'besprochen', label: 'Wie besprochen' },
];

export type Angebot = 'teams' | 'phone' | 'beides';
export const angebotArten = (a: Angebot): Gespraechsart[] => (a === 'beides' ? ['teams', 'phone'] : [a]);

const ART_SATZ: Record<Angebot, string> = {
  teams: 'Wir sprechen über Teams, den Link bekommst du direkt nach der Buchung.',
  phone: 'Ich rufe dich zur gebuchten Zeit an.',
  beides: 'Ob per Teams oder Telefon, entscheidest du.',
};

export function einladungsText(o: { vorname: string; hhVorname: string; dauer: number; anlass: EinladungAnlass; angebot: Angebot }): string {
  const start = o.anlass === 'besprochen'
    ? `wie besprochen hier der Link für unser Gespräch, wir brauchen rund ${o.dauer} Minuten.`
    : `ich würde dich gern kurz kennenlernen und hören, was dir beim nächsten Schritt wichtig ist. Dafür reichen rund ${o.dauer} Minuten.`;
  return `Hallo ${o.vorname},\n\n${start} ${ART_SATZ[o.angebot]} Such dir einfach eine Zeit aus, die dir passt:\n\n[Link]\n\nViele Grüße\n${o.hhVorname}`;
}

/** Text zum Selbstverschicken: [Link] wird zum echten Link; fehlt die Marke, steht der Link am Ende. */
export const textMitLink = (text: string, link: string) => (text.includes('[Link]') ? text.replace('[Link]', link) : `${text.trim()}\n\n${link}`);

// ---------------------------------------------------------------------------
// Lebenslauf anfragen (05.11.2026)
// ---------------------------------------------------------------------------

/** Kommt mit dem Häkchen „Lebenslauf anfragen“ in die Einladung und geht mit ihm wieder raus. */
export const LEBENSLAUF_SATZ = 'Wenn du magst, lade dort gleich deinen Lebenslauf hoch, dann kann ich mich gut vorbereiten. Dein LinkedIn-Profil reicht auch.';

/**
 * Den Satz zur Einladung ergänzen oder entfernen, ohne den übrigen Text anzufassen:
 * Er steht als eigener Absatz direkt nach dem Link, sonst vor dem Gruß.
 */
export function mitLebenslaufSatz(text: string, an: boolean): string {
  const ohne = text.replace(`\n\n${LEBENSLAUF_SATZ}`, '').replace(LEBENSLAUF_SATZ, '').replace(/\n{3,}/g, '\n\n');
  if (!an) return ohne;
  if (ohne.includes('[Link]')) return ohne.replace('[Link]', `[Link]\n\n${LEBENSLAUF_SATZ}`);
  const gruss = ohne.lastIndexOf('\n\nViele Grüße');
  return gruss >= 0 ? `${ohne.slice(0, gruss)}\n\n${LEBENSLAUF_SATZ}${ohne.slice(gruss)}` : `${ohne.trim()}\n\n${LEBENSLAUF_SATZ}`;
}

export type LebenslaufAnlass = 'nachher' | 'vorher';
export const LEBENSLAUF_ANLAESSE: { key: LebenslaufAnlass; label: string }[] = [
  { key: 'nachher', label: 'Nach dem Gespräch' },
  { key: 'vorher', label: 'Vor dem Gespräch' },
];

/** Text für „Lebenslauf anfragen“ ohne Termin; [Link] markiert die Stelle des persönlichen Links. */
export function lebenslaufText(o: { vorname: string; hhVorname: string; anlass: LebenslaufAnlass }): string {
  const satz = o.anlass === 'nachher'
    ? 'danke für das gute Gespräch. Damit ich dich passenden Unternehmen vorstellen kann, brauche ich noch deinen Lebenslauf.'
    : 'damit ich mich gut auf unser Gespräch vorbereiten kann, freue ich mich über deinen Lebenslauf.';
  return `Hallo ${o.vorname},\n\n${satz} Lade ihn einfach hier hoch, das geht auch vom Handy:\n\n[Link]\n\nViele Grüße\n${o.hhVorname}`;
}
