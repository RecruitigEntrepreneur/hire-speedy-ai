/**
 * Nachgespräch mit dem Kandidaten nach dem Interview (20.10.2026).
 *
 * Ersetzt das „Debrief“: Statt den Kandidaten selbst zu benoten, hält der Headhunter
 * fest, was der Kandidat sagt. Danach Abgleich mit Akte und Stelle, dann die Frage an
 * den Kunden. Gehalt, Angebot, Start und Bedenken gehen nie an den Kunden.
 */
import { earliestStart } from './candidateDossier';
import i18n from '@/i18n';
import { fmtDate, fmtMoney, isGerman, tFor } from '@/lib/localeFormat';

// Sätze in der Sprache der Oberfläche (taskTexts:nachLib), gelesen beim Aufruf (README Regel 7).
// Die Listen unten tragen den deutschen Text als Rückfall; angezeigt wird recruiterTasks:nach.options.*.
const tn = (key: string, options?: Record<string, unknown>): string => i18n.t(`taskTexts:nachLib.${key}`, options);

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

const GROUP = new Map<unknown, string>([[BAUCH, 'bauch'], [DREI, 'drei'], [ANGEBOT_PUNKTE, 'angebot'], [START, 'start']]);
const labelOf = (list: { key: string; label: string }[], key: string | null) => {
  const hit = list.find(x => x.key === key);
  if (!hit) return null;
  return i18n.t(`recruiterTasks:nach.options.${GROUP.get(list)}.${hit.key}`, { defaultValue: hit.label });
};
/** „92.000 €“ auf Deutsch wie bisher, sonst Geldformat der Sprache. */
export const euroVoll = (n: number) => (isGerman() ? `${n.toLocaleString('de-DE')} €` : fmtMoney(n));
const datum = (iso: string) => fmtDate(`${iso.slice(0, 10)}T12:00:00`);

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
  const was = n.angebot_fix_min ? tn('salary.offerFrom', { amount: euroVoll(wunsch) }) : tn('salary.named', { amount: euroVoll(wunsch) });
  const teile: string[] = [];
  let warn = false;
  if (ctx.stelleMax && wunsch > ctx.stelleMax) { teile.push(tn('salary.aboveJob', { max: euroVoll(ctx.stelleMax) })); warn = true; }
  else if (ctx.stelleMax && wunsch === ctx.stelleMax) { teile.push(tn('salary.topOfJob', { max: euroVoll(ctx.stelleMax) })); warn = true; }
  else if (ctx.stelleMax || ctx.stelleMin) teile.push(tn('salary.fitsJob'));
  if (n.gehalt_besprochen && n.gehalt_firma && wunsch > n.gehalt_firma) {
    teile.push(teile.length ? tn('salary.companyNamed', { amount: euroVoll(n.gehalt_firma) }) : tn('salary.aboveCompany', { amount: euroVoll(n.gehalt_firma) }));
    warn = true;
  }
  const akte = ctx.akte !== wunsch
    ? { field: 'expected_salary' as const, value: wunsch, label: ctx.akte ? tn('salary.fileFromTo', { from: euroVoll(ctx.akte), to: euroVoll(wunsch) }) : tn('salary.fileSet', { amount: euroVoll(wunsch) }) }
    : undefined;
  if (teile.length === 0 && !akte) return null;
  return { tone: warn ? 'warn' : 'ok', text: teile.length ? tn('sentence', { what: was, parts: teile.join(', ') }) : tn('sentenceShort', { what: was }), akte };
}

export function startAbgleich(n: Nachgespraech, ctx: { noticePeriod: string | null; availabilityDate: string | null }, today: Date): Abgleich | null {
  const frist = ctx.noticePeriod ? earliestStart(ctx.noticePeriod, today) : null;
  const wunsch = n.start_art === 'sofort' ? isoTag(today) : n.start_art === 'nach_frist' ? frist : n.start_datum;
  if (!wunsch) return null;
  const was = n.start_art === 'sofort' ? tn('start.now') : tn('start.on', { date: datum(wunsch) });
  let text: string;
  let warn = false;
  if (frist && wunsch < frist) { text = tn('start.beforeNotice', { what: was, date: datum(frist) }); warn = true; }
  else if (frist) text = tn('start.fitsNotice', { what: was });
  else text = tn('sentenceShort', { what: was });
  const akte = (ctx.availabilityDate ?? '').slice(0, 10) !== wunsch
    ? { field: 'availability_date' as const, value: wunsch, label: ctx.availabilityDate ? tn('start.fileFromTo', { from: datum(ctx.availabilityDate), to: datum(wunsch) }) : tn('start.fileSet', { date: datum(wunsch) }) }
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
  if (bauch) z.push(tn('summary.gut', { value: bauch.toLowerCase() }));
  if (n.zusammenarbeit) {
    const value = labelOf(DREI, n.zusammenarbeit)!.toLowerCase();
    z.push(n.ansprechpartner.trim() ? tn('summary.togetherWith', { value, person: n.ansprechpartner.trim() }) : tn('summary.together', { value }));
  }
  if (n.gehalt_besprochen === false) z.push(tn('summary.salaryNot'));
  else if (n.gehalt_besprochen && (n.gehalt_kandidat || n.gehalt_firma)) {
    z.push(tn('summary.salary', { list: [n.gehalt_kandidat ? tn('summary.salaryCandidate', { amount: euroVoll(n.gehalt_kandidat) }) : null, n.gehalt_firma ? tn('summary.salaryCompany', { amount: euroVoll(n.gehalt_firma) }) : null].filter(Boolean).join(', ') }));
  }
  const punkte = n.angebot_punkte.map(k => labelOf(ANGEBOT_PUNKTE, k)).filter(Boolean).join(', ');
  if (n.angebot_fix_min || punkte) z.push(tn('summary.offer', { list: [n.angebot_fix_min ? tn('summary.offerFix', { amount: euroVoll(n.angebot_fix_min) }) : null, punkte || null].filter(Boolean).join(', ') }));
  if (n.start_art) {
    const frist = n.start_art === 'nach_frist' && noticePeriod ? earliestStart(noticePeriod, today) : null;
    const value = n.start_art === 'sofort' ? tn('summary.startNow')
      : n.start_art === 'nach_frist' ? (frist ? tn('summary.startNoticeOn', { date: datum(frist) }) : tn('summary.startNotice'))
        : n.start_datum ? datum(n.start_datum) : tn('summary.startOpen');
    z.push(tn('summary.start', { value }));
  }
  if (n.will_weiter) z.push(tn('summary.wants', { value: labelOf(DREI, n.will_weiter)!.toLowerCase() }));
  return z;
}

/** Eine Zeile fürs Prozess-Fenster im Profil. */
export function kurzzeile(n: Nachgespraech): string {
  const t: string[] = [];
  if (n.bauchgefuehl) t.push(labelOf(BAUCH, n.bauchgefuehl)!.toLowerCase());
  if (n.will_weiter === 'ja') t.push(tn('short.wants'));
  else if (n.will_weiter === 'unsicher') t.push(tn('short.unsure'));
  else if (n.will_weiter === 'nein') t.push(tn('short.wantsNot'));
  const head = t.join(', ');
  const wunsch = wunschGehalt(n);
  return [head || null, wunsch ? (n.angebot_fix_min ? tn('salary.offerFrom', { amount: euroVoll(wunsch) }) : euroVoll(wunsch)) : null, n.start_datum ? tn('start.on', { date: datum(n.start_datum) }) : n.start_art === 'sofort' ? tn('start.now') : n.start_art === 'nach_frist' ? tn('short.startNotice') : null]
    .filter(Boolean).join(' · ');
}

/**
 * Vorschlag an den Kunden. Ohne Namen (die Mail nennt den Kandidaten darunter) und
 * ohne Gehalt, Angebot, Start oder Bedenken. In der Sprache des Kunden (`lang`, sonst Deutsch).
 */
export function kundenText(n: Nachgespraech, lang = 'de'): string {
  const t = (key: string) => tFor(lang, 'taskMessages')(`client.${key}`) as string;
  if (n.will_weiter === 'nein') return t('afterNo');
  if (n.will_weiter === 'ja') return t(n.bauchgefuehl === 'gut' ? 'afterYesVeryGood' : 'afterYes');
  return t('afterOpen');
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
