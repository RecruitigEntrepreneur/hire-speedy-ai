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
