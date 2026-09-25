/**
 * Die Konditionen für Contracting -- EIN Text für Aufnahme (Frontend),
 * Eingangsbestätigung und Nachweis (intake-submit).
 *
 * Befund (Live, 25.09.2026, Kanna Medics): Ein Kunde wählte Contracting und
 * bekam im Paketschritt die Festanstellungs-Konditionen (Prozent vom
 * Jahresgehalt) -- mit einem Vertrag dahinter, der für Contracting nicht passt.
 *
 * Grundlage: CONTRACTING_ABRECHNUNGSMODELL.md (Durchleitung, 14.09.2026) und
 * Modul B im Vertragswerk v4. Entscheidung 25.09.2026: Die Aufteilung 78/22
 * wird dem Kunden offen gezeigt (vorher „Innenseite“). Der Anteil des
 * Recruiters an der Marge bleibt Innenseite und steht hier nicht.
 *
 * Ändert sich ein Wort, ändert sich die Fassung -- sonst ist der Nachweis wertlos.
 */

export const CONTRACTING_FASSUNG = 'contracting-2026-09-v1';

/** Anteil des Spezialisten am Tagessatz, in Prozent. */
export const ANTEIL_SPEZIALIST = 78;
/** Anteil von Matchunt am Tagessatz, in Prozent. */
export const ANTEIL_MATCHUNT = 22;

export const CONTRACTING_EINLEITUNG =
  'Matchunt ist Ihr Vertragspartner. Der Spezialist arbeitet als selbstständiger Subunternehmer von Matchunt. '
  + 'Sie haben einen Vertrag, eine Rechnung und einen Ansprechpartner.';

export const CONTRACTING_PUNKTE: { label: string; text: string }[] = [
  { label: 'Vergütung', text: 'Fester Tagessatz je geleistetem Einsatztag, zzgl. USt. Ein Vermittlungshonorar fällt nicht an.' },
  { label: 'Leistung Matchunt', text: 'Auswahl und Vorstellung, Vertragsabwicklung mit dem Spezialisten, Abrechnung.' },
  { label: 'Abrechnung', text: 'Monatlich nach den von Ihnen freigegebenen Tätigkeitsnachweisen, 30 Tage netto.' },
  { label: 'Kündigung', text: 'Je Einsatz mit zwei Wochen zum Monatsende, im ersten Einsatzmonat mit einer Woche.' },
  { label: 'Übernahme', text: 'In Festanstellung jederzeit möglich: 20 % des Zielgehalts, je Einsatzmonat um ein Zwölftel geringer, nach zwölf Monaten kostenfrei.' },
  { label: 'Reisekosten', text: 'Nur nach vorheriger Freigabe, ohne Aufschlag.' },
];

export const CONTRACTING_SCHLUSS =
  'Kosten entstehen erst ab dem ersten Einsatztag. Jeder Einsatz wird mit einem eigenen Projektauftrag vereinbart.';

export const CONTRACTING_ZUSTIMMUNG =
  'Ich bestätige die Konditionen für Contracting und beauftrage Matchunt mit der Suche nach einem Spezialisten. '
  + 'Ein Einsatz kommt erst mit einem Projektauftrag zustande. Es gelten die AGB von Matchunt.';

const betrag = (n: number) => Math.round(n).toLocaleString('de-DE');
const spanne = (von: number, bis: number) => (von === bis ? `${betrag(von)} €` : `${betrag(von)}–${betrag(bis)} €`);

/** Was beim Spezialisten ankommt, gerundet auf ganze Euro. */
export const anteilSpezialist = (tagessatz: number): number => Math.round((tagessatz * ANTEIL_SPEZIALIST) / 100);

const zahl = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Der Satz unter dem Balken, aus dem Budget der Aufnahme. Ohne Budget kein
 * Satz -- eine erfundene Beispielzahl sähe aus wie ein Angebot.
 */
export function aufteilungAusBudget(min: unknown, max: unknown): string | null {
  const von = zahl(min);
  const bis = zahl(max);
  if (!von && !bis) return null;
  const a = Math.min(von ?? bis!, bis ?? von!);
  const b = Math.max(von ?? bis!, bis ?? von!);
  return `Mit Ihrem Budget von ${spanne(a, b)} je Tag erhält der Spezialist `
    + `${spanne(anteilSpezialist(a), anteilSpezialist(b))} je Tag.`;
}
