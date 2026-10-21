/**
 * Nachgespräch mit dem Kandidaten nach dem Interview (20.10.2026).
 *
 * Ersetzt das „Debrief“: Statt den Kandidaten selbst zu benoten, hält der Headhunter
 * fest, was der Kandidat sagt. Danach Abgleich mit Akte und Stelle, dann die Frage an
 * den Kunden. Gehalt, Angebot, Start und Bedenken gehen nie an den Kunden.
 */
import { earliestStart } from './candidateDossier';

export type Drei = 'ja' | 'unsicher' | 'nein';
export type Bauch = 'gut' | 'gemischt' | 'schlecht';
export type StartArt = 'sofort' | 'nach_frist' | 'fester_tag';

export interface Nachgespraech {
  verlauf: string;
  bauchgefuehl: Bauch | null;
  zusammenarbeit: Drei | null;
  ansprechpartner: string;
  gehalt_besprochen: boolean | null;
  gehalt_kandidat: number | null;
  gehalt_firma: number | null;
  angebot_fix_min: number | null;
  angebot_punkte: string[];
  angebot_text: string;
  start_art: StartArt | null;
  start_datum: string | null;
  will_weiter: Drei | null;
  bedenken: string;
}

export const LEER: Nachgespraech = {
  verlauf: '', bauchgefuehl: null, zusammenarbeit: null, ansprechpartner: '',
  gehalt_besprochen: null, gehalt_kandidat: null, gehalt_firma: null, angebot_fix_min: null, angebot_punkte: [],
  angebot_text: '', start_art: null, start_datum: null, will_weiter: null, bedenken: '',
};

export const BAUCH: { key: Bauch; label: string }[] = [
  { key: 'gut', label: 'Gut' }, { key: 'gemischt', label: 'Gemischt' }, { key: 'schlecht', label: 'Schlecht' },
];
export const DREI: { key: Drei; label: string }[] = [
  { key: 'ja', label: 'Ja' }, { key: 'unsicher', label: 'Unsicher' }, { key: 'nein', label: 'Nein' },
];
export const ANGEBOT_PUNKTE: { key: string; label: string }[] = [
  { key: 'bonus', label: 'Bonus' }, { key: 'homeoffice', label: 'Homeoffice-Tage' }, { key: 'urlaub', label: 'Urlaub' },
  { key: 'titel', label: 'Titel' }, { key: 'weiterbildung', label: 'Weiterbildung' }, { key: 'firmenwagen', label: 'Firmenwagen' },
];
export const START: { key: StartArt; label: string }[] = [
  { key: 'sofort', label: 'Sofort' }, { key: 'nach_frist', label: 'Nach Kündigungsfrist' }, { key: 'fester_tag', label: 'Fester Tag' },
];

const labelOf = (list: { key: string; label: string }[], key: string | null) => list.find(x => x.key === key)?.label ?? null;
export const euroVoll = (n: number) => `${n.toLocaleString('de-DE')} €`;
const datum = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** „92.000“, „92k“, „92 000 €“ → 92000. Leer → null. */
export function parseEuro(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/€|eur/g, '').trim();
  if (!s) return null;
  const k = /k$/.test(s);
  const n = Number(s.replace(/k$/, '').replace(/[.\s]/g, '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  const v = Math.round(k ? n * 1000 : n < 1000 ? n * 1000 : n);
  return v > 10_000_000 ? null : v;
}

/** Genug für „festgehalten“: wenigstens Bauchgefühl, Will-weiter oder ein Satz. */
export function istAusgefuellt(n: Nachgespraech): boolean {
  return !!n.bauchgefuehl || !!n.will_weiter || n.verlauf.trim().length > 0;
}

/** Was der Kandidat fix haben will: die Angebotsgrenze, sonst die genannte Zahl. */
export const wunschGehalt = (n: Nachgespraech) => n.angebot_fix_min ?? (n.gehalt_besprochen ? n.gehalt_kandidat : null);

export interface Abgleich {
  tone: 'warn' | 'ok';
  text: string;
  /** Vorschlag, die Akte nachzuziehen */
  akte?: { field: 'expected_salary' | 'availability_date'; value: number | string; label: string };
}

export function gehaltAbgleich(n: Nachgespraech, ctx: { akte: number | null; stelleMin: number | null; stelleMax: number | null }): Abgleich | null {
  const wunsch = wunschGehalt(n);
  if (!wunsch) return null;
  const was = n.angebot_fix_min ? `Angebot ab ${euroVoll(wunsch)}` : `${euroVoll(wunsch)} genannt`;
  const teile: string[] = [];
  let warn = false;
  if (ctx.stelleMax && wunsch > ctx.stelleMax) { teile.push(`liegt über der Stelle (bis ${euroVoll(ctx.stelleMax)})`); warn = true; }
  else if (ctx.stelleMax && wunsch === ctx.stelleMax) { teile.push(`liegt am oberen Ende der Stelle (bis ${euroVoll(ctx.stelleMax)})`); warn = true; }
  else if (ctx.stelleMax || ctx.stelleMin) teile.push('passt zur Stelle');
  if (n.gehalt_besprochen && n.gehalt_firma && wunsch > n.gehalt_firma) {
    teile.push(teile.length ? `Firma nannte ${euroVoll(n.gehalt_firma)}` : `liegt über dem, was die Firma nannte (${euroVoll(n.gehalt_firma)})`);
    warn = true;
  }
  const akte = ctx.akte !== wunsch
    ? { field: 'expected_salary' as const, value: wunsch, label: ctx.akte ? `Akte von ${euroVoll(ctx.akte)} auf ${euroVoll(wunsch)} setzen?` : `Wunschgehalt ${euroVoll(wunsch)} in die Akte?` }
    : undefined;
  if (teile.length === 0 && !akte) return null;
  return { tone: warn ? 'warn' : 'ok', text: teile.length ? `${was} ${teile.join(', ')}.` : `${was}.`, akte };
}

export function startAbgleich(n: Nachgespraech, ctx: { noticePeriod: string | null; availabilityDate: string | null }, today: Date): Abgleich | null {
  const frist = ctx.noticePeriod ? earliestStart(ctx.noticePeriod, today) : null;
  const wunsch = n.start_art === 'sofort' ? isoTag(today) : n.start_art === 'nach_frist' ? frist : n.start_datum;
  if (!wunsch) return null;
  const was = n.start_art === 'sofort' ? 'Start sofort' : `Start ${datum(wunsch)}`;
  let text: string;
  let warn = false;
  if (frist && wunsch < frist) { text = `${was} liegt vor dem Ende der Kündigungsfrist (frühestens ${datum(frist)}).`; warn = true; }
  else if (frist) text = `${was} passt zur Kündigungsfrist.`;
  else text = `${was}.`;
  const akte = (ctx.availabilityDate ?? '').slice(0, 10) !== wunsch
    ? { field: 'availability_date' as const, value: wunsch, label: ctx.availabilityDate ? `Akte „verfügbar ab“ von ${datum(ctx.availabilityDate)} auf ${datum(wunsch)} setzen?` : `„Verfügbar ab ${datum(wunsch)}“ in die Akte?` }
    : undefined;
  return { tone: warn ? 'warn' : 'ok', text, akte };
}

function isoTag(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Zeilen für „Festgehalten“ im Fenster. */
export function zusammenfassung(n: Nachgespraech, today: Date, noticePeriod: string | null = null): string[] {
  const z: string[] = [];
  const bauch = labelOf(BAUCH, n.bauchgefuehl);
  if (bauch) z.push(`Bauchgefühl ${bauch.toLowerCase()}`);
  if (n.zusammenarbeit) z.push(`Zusammenarbeit: ${labelOf(DREI, n.zusammenarbeit)!.toLowerCase()}${n.ansprechpartner.trim() ? ` (${n.ansprechpartner.trim()})` : ''}`);
  if (n.gehalt_besprochen === false) z.push('Gehalt: nicht besprochen');
  else if (n.gehalt_besprochen && (n.gehalt_kandidat || n.gehalt_firma)) {
    z.push(`Gehalt: ${[n.gehalt_kandidat ? `Kandidat ${euroVoll(n.gehalt_kandidat)}` : null, n.gehalt_firma ? `Firma ${euroVoll(n.gehalt_firma)}` : null].filter(Boolean).join(', ')}`);
  }
  const punkte = n.angebot_punkte.map(k => labelOf(ANGEBOT_PUNKTE, k)).filter(Boolean).join(', ');
  if (n.angebot_fix_min || punkte) z.push(`Angebot: ${[n.angebot_fix_min ? `ab ${euroVoll(n.angebot_fix_min)} fix` : null, punkte || null].filter(Boolean).join(', ')}`);
  if (n.start_art) {
    const frist = n.start_art === 'nach_frist' && noticePeriod ? earliestStart(noticePeriod, today) : null;
    z.push(`Start: ${n.start_art === 'sofort' ? 'sofort' : n.start_art === 'nach_frist' ? `nach Kündigungsfrist${frist ? `, ${datum(frist)}` : ''}` : n.start_datum ? datum(n.start_datum) : 'fester Tag, noch offen'}`);
  }
  if (n.will_weiter) z.push(`Will weiter: ${labelOf(DREI, n.will_weiter)!.toLowerCase()}`);
  return z;
}

/** Eine Zeile fürs Prozess-Fenster im Profil. */
export function kurzzeile(n: Nachgespraech): string {
  const t: string[] = [];
  if (n.bauchgefuehl) t.push(labelOf(BAUCH, n.bauchgefuehl)!.toLowerCase());
  if (n.will_weiter === 'ja') t.push('will weiter');
  else if (n.will_weiter === 'unsicher') t.push('unsicher');
  else if (n.will_weiter === 'nein') t.push('will nicht weiter');
  const head = t.join(', ');
  const wunsch = wunschGehalt(n);
  return [head || null, wunsch ? (n.angebot_fix_min ? `Angebot ab ${euroVoll(wunsch)}` : euroVoll(wunsch)) : null, n.start_datum ? `Start ${datum(n.start_datum)}` : n.start_art === 'sofort' ? 'Start sofort' : n.start_art === 'nach_frist' ? 'Start nach Kündigungsfrist' : null]
    .filter(Boolean).join(' · ');
}

/**
 * Vorschlag an den Kunden. Ohne Namen (die Mail nennt den Kandidaten darunter) und
 * ohne Gehalt, Angebot, Start oder Bedenken.
 */
export function kundenText(n: Nachgespraech): string {
  if (n.will_weiter === 'nein') {
    return 'Nach dem Interview hat sich der Kandidat entschieden, den Prozess nicht weiterzuführen. Danke für Ihre Zeit und das Gespräch. Gern stelle ich Ihnen weitere Profile vor.';
  }
  if (n.will_weiter === 'ja') {
    const eindruck = n.bauchgefuehl === 'gut' ? 'einen sehr guten Eindruck vom Interview' : 'einen guten Eindruck vom Interview';
    return `Der Kandidat hat ${eindruck} und möchte gern weitermachen. Wie ist Ihr Eindruck, und wie sieht der nächste Schritt aus?`;
  }
  return 'Das Interview ist gelaufen, ich bin mit dem Kandidaten im Austausch. Wie ist Ihr Eindruck, und wie sieht der nächste Schritt aus?';
}

/** Zeile aus der Datenbank → Formular */
export function ausZeile(row: Record<string, any> | null | undefined): Nachgespraech {
  if (!row) return { ...LEER };
  return {
    verlauf: row.verlauf ?? '', bauchgefuehl: row.bauchgefuehl ?? null,
    zusammenarbeit: row.zusammenarbeit ?? null, ansprechpartner: row.ansprechpartner ?? '', gehalt_besprochen: row.gehalt_besprochen ?? null,
    gehalt_kandidat: row.gehalt_kandidat ?? null, gehalt_firma: row.gehalt_firma ?? null, angebot_fix_min: row.angebot_fix_min ?? null,
    angebot_punkte: row.angebot_punkte ?? [], angebot_text: row.angebot_text ?? '', start_art: row.start_art ?? null,
    start_datum: row.start_datum ?? null, will_weiter: row.will_weiter ?? null, bedenken: row.bedenken ?? '',
  };
}

/** Formular → Zeile. Leere Texte als null, Gehalt nur, wenn besprochen. */
export function zuZeile(n: Nachgespraech) {
  const t = (s: string) => (s.trim() ? s.trim() : null);
  return {
    verlauf: t(n.verlauf), bauchgefuehl: n.bauchgefuehl,
    zusammenarbeit: n.zusammenarbeit, ansprechpartner: t(n.ansprechpartner), gehalt_besprochen: n.gehalt_besprochen,
    gehalt_kandidat: n.gehalt_besprochen ? n.gehalt_kandidat : null, gehalt_firma: n.gehalt_besprochen ? n.gehalt_firma : null,
    angebot_fix_min: n.angebot_fix_min, angebot_punkte: n.angebot_punkte, angebot_text: t(n.angebot_text),
    start_art: n.start_art, start_datum: n.start_art === 'fester_tag' ? n.start_datum : null, will_weiter: n.will_weiter, bedenken: t(n.bedenken),
  };
}
