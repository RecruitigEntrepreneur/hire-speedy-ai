import i18n from '@/i18n';
import type { Gespraechsart } from '@/lib/terminApi';
import { candidateLanguage, tFor } from '@/lib/localeFormat';

/**
 * Texte der Einladung zum Gespräch (01.11.2026). Der Headhunter wählt, was er anbietet;
 * der Satz dazu passt sich an. [Link] markiert die Stelle des persönlichen Links.
 *
 * Mehrsprachig (13.11.2026): Die Texte an den Kandidaten entstehen in der Sprache des
 * Headhunters (er spricht Kandidaten in seinem Markt an, candidateLanguage()); die
 * Beschriftung der Auswahl folgt der Oberfläche. Beides wird beim Aufruf gelesen
 * (Namespace recruiterTermin, texte.*). [Link] bleibt in jeder Sprache die Marke.
 */
const tt = (key: string, options?: Record<string, unknown>): string => tFor(candidateLanguage(), 'recruiterTermin')(`texte.${key}`, options) as string;
export type EinladungAnlass = 'kennenlernen' | 'besprochen';
export const EINLADUNG_ANLAESSE: { key: EinladungAnlass; label: string }[] = [
  { key: 'kennenlernen', get label() { return i18n.t('recruiterTermin:anlass.kennenlernen'); } },
  { key: 'besprochen', get label() { return i18n.t('recruiterTermin:anlass.besprochen'); } },
];

export type Angebot = 'teams' | 'phone' | 'beides';
export const angebotArten = (a: Angebot): Gespraechsart[] => (a === 'beides' ? ['teams', 'phone'] : [a]);

const ART_SATZ: Record<Angebot, string> = { teams: 'artTeams', phone: 'artPhone', beides: 'artBeides' };

export function einladungsText(o: { vorname: string; hhVorname: string; dauer: number; anlass: EinladungAnlass; angebot: Angebot }): string {
  const start = tt(o.anlass === 'besprochen' ? 'startBesprochen' : 'startKennenlernen', { n: o.dauer });
  return tt('einladung', { name: o.vorname, start, art: tt(ART_SATZ[o.angebot]), gruss: tt('gruss'), hh: o.hhVorname });
}

/** Text zum Selbstverschicken: [Link] wird zum echten Link; fehlt die Marke, steht der Link am Ende. */
export const textMitLink = (text: string, link: string) => (text.includes('[Link]') ? text.replace('[Link]', link) : `${text.trim()}\n\n${link}`);

// ---------------------------------------------------------------------------
// Lebenslauf anfragen (05.11.2026)
// ---------------------------------------------------------------------------

/** Kommt mit dem Häkchen „Lebenslauf anfragen“ in die Einladung und geht mit ihm wieder raus (Sprache des Headhunters). */
export const lebenslaufSatz = () => tt('lebenslaufSatz');
/** Deutsche Fassung des Satzes (Bezug für Tests). */
export const LEBENSLAUF_SATZ = 'Wenn du magst, lade dort gleich deinen Lebenslauf hoch, dann kann ich mich gut vorbereiten. Dein LinkedIn-Profil reicht auch.';

/**
 * Den Satz zur Einladung ergänzen oder entfernen, ohne den übrigen Text anzufassen:
 * Er steht als eigener Absatz direkt nach dem Link, sonst vor dem Gruß.
 */
export function mitLebenslaufSatz(text: string, an: boolean): string {
  const satz = lebenslaufSatz();
  const ohne = text.replace(`\n\n${satz}`, '').replace(satz, '').replace(/\n{3,}/g, '\n\n');
  if (!an) return ohne;
  if (ohne.includes('[Link]')) return ohne.replace('[Link]', `[Link]\n\n${satz}`);
  const gruss = ohne.lastIndexOf(`\n\n${tt('gruss')}`);
  return gruss >= 0 ? `${ohne.slice(0, gruss)}\n\n${satz}${ohne.slice(gruss)}` : `${ohne.trim()}\n\n${satz}`;
}

export type LebenslaufAnlass = 'nachher' | 'vorher';
export const LEBENSLAUF_ANLAESSE: { key: LebenslaufAnlass; label: string }[] = [
  { key: 'nachher', get label() { return i18n.t('recruiterTermin:anlass.nachher'); } },
  { key: 'vorher', get label() { return i18n.t('recruiterTermin:anlass.vorher'); } },
];

/** Text für „Lebenslauf anfragen“ ohne Termin; [Link] markiert die Stelle des persönlichen Links. */
export function lebenslaufText(o: { vorname: string; hhVorname: string; anlass: LebenslaufAnlass }): string {
  const satz = tt(o.anlass === 'nachher' ? 'cvNachher' : 'cvVorher');
  return tt('lebenslauf', { name: o.vorname, satz, gruss: tt('gruss'), hh: o.hhVorname });
}
