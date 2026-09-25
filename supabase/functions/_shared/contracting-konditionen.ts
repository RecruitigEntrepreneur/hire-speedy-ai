/**
 * Die Konditionen für Contracting -- EIN Text für Aufnahme (Frontend),
 * Eingangsbestätigung und Nachweis (intake-submit).
 *
 * Befund (Live, 25.09.2026, Kanna Medics): Ein Kunde wählte Contracting und
 * bekam im Paketschritt die Festanstellungs-Konditionen (Prozent vom
 * Jahresgehalt) -- mit einem Vertrag dahinter, der für Contracting nicht passt.
 *
 * Grundlage: CONTRACTING_ABRECHNUNGSMODELL.md (Durchleitung, 14.09.2026) und
 * Modul B im Vertragswerk v4 (§ 12 Abs. 4: der Tagessatz enthält die Vergütung
 * des Spezialisten und die von Matchunt).
 *
 * Entscheidung 25.09.2026 (zweite Runde): Der Kunde sieht einen Tagessatz, in
 * dem alles steckt -- NICHT die Aufteilung. Branchenüblich (Hays, GULP & Co.),
 * kein Verhandlungsanker auf die Marge, keine Einladung zur Umgehung, und
 * Matchunt vermittelt im Rahmen des Budgets. Die Anteile unten sind Innenseite:
 * für Admin, Recruiter und Spezialisten, nie für die Kundenseite.
 *
 * Ändert sich ein Wort, ändert sich die Fassung -- sonst ist der Nachweis wertlos.
 */

export const CONTRACTING_FASSUNG = 'contracting-2026-09-v2';

/** INNENSEITE: Anteil des Spezialisten am Tagessatz, in Prozent. Nicht an Kunden. */
export const ANTEIL_SPEZIALIST = 78;
/** INNENSEITE: Anteil von Matchunt am Tagessatz, in Prozent. Nicht an Kunden. */
export const ANTEIL_MATCHUNT = 22;

export const CONTRACTING_EINLEITUNG =
  'Matchunt ist Ihr Vertragspartner. Der Spezialist arbeitet als selbstständiger Subunternehmer von Matchunt. '
  + 'Sie haben einen Vertrag, eine Rechnung und einen Ansprechpartner.';

export const CONTRACTING_BUDGET_HINWEIS =
  'Wir stellen Ihnen nur Spezialisten vor, deren Tagessatz in dieses Budget passt. '
  + 'Der Satz enthält die Vergütung des Spezialisten und unsere Leistung.';

export const CONTRACTING_OHNE_BUDGET = 'Wir stimmen den Tagessatz vor jedem Einsatz mit Ihnen ab.';

export const CONTRACTING_PUNKTE: { label: string; text: string }[] = [
  { label: 'Vergütung', text: 'Fester Tagessatz je geleistetem Einsatztag, zzgl. USt. Ein Vermittlungshonorar fällt nicht an.' },
  { label: 'Leistung Matchunt', text: 'Auswahl und Vorstellung, Vertragsabwicklung mit dem Spezialisten, Abrechnung.' },
  // 14 statt 30 Tage (Entscheidung 25.09.2026): Rechnung am Tag der Freigabe,
  // Geld um Tag 21 nach Monatsende -- vor der Auszahlung an den Spezialisten
  // (30 Tage ab seiner Rechnung, die erst nach der Freigabe kommen darf).
  { label: 'Abrechnung', text: 'Monatlich nach den von Ihnen freigegebenen Tätigkeitsnachweisen, zahlbar innerhalb von 14 Tagen netto.' },
  { label: 'Kündigung', text: 'Je Einsatz mit zwei Wochen zum Monatsende, im ersten Einsatzmonat mit einer Woche.' },
  { label: 'Übernahme', text: 'In Festanstellung jederzeit möglich: 20 % des Zielgehalts, je Einsatzmonat um ein Zwölftel geringer, nach zwölf Monaten kostenfrei.' },
  { label: 'Reisekosten', text: 'Nur nach vorheriger Freigabe, ohne Aufschlag.' },
];

export const CONTRACTING_SCHLUSS =
  'Kosten entstehen erst ab dem ersten Einsatztag. Den genauen Tagessatz legen wir je Spezialist im Projektauftrag fest.';

export const CONTRACTING_ZUSTIMMUNG =
  'Ich bestätige die Konditionen für Contracting und beauftrage Matchunt mit der Suche nach einem Spezialisten. '
  + 'Ein Einsatz kommt erst mit einem Projektauftrag zustande. Es gelten die AGB von Matchunt.';

const betrag = (n: number) => Math.round(n).toLocaleString('de-DE');
const spanne = (von: number, bis: number) => (von === bis ? `${betrag(von)} €` : `${betrag(von)}–${betrag(bis)} €`);

const zahl = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Das Budget der Aufnahme als geordnete Spanne, oder null ohne Angabe. */
function budgetSpanne(min: unknown, max: unknown): [number, number] | null {
  const von = zahl(min);
  const bis = zahl(max);
  if (!von && !bis) return null;
  return [Math.min(von ?? bis!, bis ?? von!), Math.max(von ?? bis!, bis ?? von!)];
}

/** INNENSEITE: was beim Spezialisten ankommt, gerundet auf ganze Euro. */
export const anteilSpezialist = (tagessatz: number): number => Math.round((tagessatz * ANTEIL_SPEZIALIST) / 100);

/**
 * Die Budgetzeile für den Kunden. Ohne Budget kein Betrag -- eine erfundene
 * Zahl sähe aus wie ein Angebot.
 */
export function budgetZeile(min: unknown, max: unknown): string | null {
  const s = budgetSpanne(min, max);
  return s ? `Ihr Budget: ${spanne(s[0], s[1])} je Tag, alles inklusive` : null;
}

/** INNENSEITE: die Rechnung für Admin und Recruiter. */
export function innenRechnung(min: unknown, max: unknown): string | null {
  const s = budgetSpanne(min, max);
  if (!s) return null;
  return `Budget ${spanne(s[0], s[1])} je Tag (all-in) → Spezialist bis `
    + `${spanne(anteilSpezialist(s[0]), anteilSpezialist(s[1]))} (${ANTEIL_SPEZIALIST} %), Matchunt ${ANTEIL_MATCHUNT} %.`;
}
