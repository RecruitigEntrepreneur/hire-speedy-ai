/**
 * Der Fragenkatalog in der Sprache des Lesers — nur die ANZEIGE.
 *
 * `briefCatalog.ts` bleibt, wie es ist: sein deutscher Wortlaut ist zugleich
 * das, was gespeichert, an die KI geschickt und in `intakeMapping.ts`
 * verglichen wird (Chip-Text = Speicherwert, `askIf.equals`, Schlagworte).
 * Diese Datei legt nur eine Übersetzung darüber, über stabile Schlüssel:
 *
 *   intakeCatalog:q.<frage>.text | textFreelance | kurz | kurzFreelance | intro | why | chapter
 *   intakeCatalog:slot.<zeile>.label | labelFreelance | placeholder
 *   intakeCatalog:chips.<zeile>.c<n>            (n = Stelle in `chips`)
 *   intakeCatalog:chipsFreelance.<zeile>.c<n>   (n = Stelle in `chipsFreelance`)
 *
 * Fehlt eine Übersetzung, steht der deutsche Wortlaut da. Was Nutzer selbst
 * eintragen und was die KI vorschlägt, steht in keiner Liste und bleibt
 * unverändert.
 *
 * Gelesen wird beim Aufruf (README Regel 7). Die Komponente, die diese
 * Funktionen nutzt, lädt den Namespace: `useTranslation(['intake', 'intakeCatalog'])`.
 * `src/lib/briefCatalogText.test.ts` prüft, dass die deutsche Sprachdatei
 * wortgleich mit dem Katalog ist.
 */
import i18n from '@/i18n';
import { intlLocale } from '@/i18n/languages';
import {
  ALL_SLOTS, type BriefQuestion, type BriefSlot, type Vertrag,
} from './briefCatalog';

export const CATALOG_NS = 'intakeCatalog';

const tx = (key: string, deutsch: string): string =>
  i18n.t(`${CATALOG_NS}:${key}`, { defaultValue: deutsch });

export const frageTextT = (q: BriefQuestion, c: Vertrag): string =>
  c === 'freelance' && q.textFreelance
    ? tx(`q.${q.key}.textFreelance`, q.textFreelance)
    : tx(`q.${q.key}.text`, q.text);

/** Wie `frageKurz`: bei Contracting gewinnt `kurzFreelance`, dann `textFreelance`, sonst `kurz`. */
export const frageKurzT = (q: BriefQuestion, c: Vertrag): string | undefined => {
  if (c === 'freelance' && q.kurzFreelance) return tx(`q.${q.key}.kurzFreelance`, q.kurzFreelance);
  if (c === 'freelance' && q.textFreelance) return tx(`q.${q.key}.textFreelance`, q.textFreelance);
  return q.kurz ? tx(`q.${q.key}.kurz`, q.kurz) : undefined;
};

export const frageIntroT = (q: BriefQuestion): string | undefined =>
  q.intro ? tx(`q.${q.key}.intro`, q.intro) : undefined;

export const frageWhyT = (q: BriefQuestion): string => tx(`q.${q.key}.why`, q.why);

export const frageChapterT = (q: BriefQuestion): string => tx(`q.${q.key}.chapter`, q.chapter);

export const slotLabelT = (s: BriefSlot, c: Vertrag): string =>
  c === 'freelance' && s.labelFreelance
    ? tx(`slot.${s.key}.labelFreelance`, s.labelFreelance)
    : tx(`slot.${s.key}.label`, s.label);

export const slotPlaceholderT = (s: BriefSlot): string | undefined =>
  s.placeholder ? tx(`slot.${s.key}.placeholder`, s.placeholder) : undefined;

/**
 * Die Beschriftung eines Chips. `chip` ist der deutsche Text aus dem Katalog
 * (der Speicherwert bzw. der Schlüssel in `chipValues`) und bleibt es auch.
 */
export const chipLabelT = (s: BriefSlot, c: Vertrag, chip: string): string => {
  const zuerst = c === 'freelance' && s.chipsFreelance ? 'chipsFreelance' : 'chips';
  const danach = zuerst === 'chips' ? 'chipsFreelance' : 'chips';
  for (const liste of [zuerst, danach] as const) {
    const i = s[liste]?.indexOf(chip) ?? -1;
    if (i >= 0) return tx(`${liste}.${s.key}.c${i}`, chip);
  }
  return chip;
};

const SLOTS = new Map<string, BriefSlot>(ALL_SLOTS.map((s) => [s.key, s]));
export const slotNach = (key: string): BriefSlot | undefined => SLOTS.get(key);

/** Beschriftung einer Zeile nach ihrem Schlüssel; unbekannte Schlüssel bleiben, wie sie sind. */
export const slotLabelNachKeyT = (key: string, c: Vertrag): string => {
  const s = SLOTS.get(key);
  return s ? slotLabelT(s, c) : key;
};

/** Ein gespeicherter Einzelwert -> Chip-Beschriftung, falls er zu einem Chip gehört. */
const einWertT = (s: BriefSlot | undefined, c: Vertrag, wert: unknown): string => {
  if (s) {
    for (const [liste, werte] of [
      ['chips', s.chipValues], ['chipsFreelance', s.chipValuesFreelance ?? s.chipValues],
    ] as const) {
      const chips = s[liste];
      if (!chips) continue;
      const i = chips.findIndex((chip) => (werte?.[chip] ?? chip) === wert);
      if (i >= 0) return tx(`${liste}.${s.key}.c${i}`, chips[i]);
    }
  }
  if (typeof wert === 'boolean') return tx(wert ? 'value.yes' : 'value.no', wert ? 'Ja' : 'Nein');
  return String(wert ?? '');
};

/**
 * Ein gespeicherter Wert zum Lesen: Chip-Texte in der Sprache des Lesers,
 * Zahlen in seiner Schreibweise. Freitext bleibt, wie er eingegeben wurde;
 * in „Baustein · Baustein · eigene Worte“ werden nur die Bausteine übersetzt.
 */
export function wertAnzeigeT(slotKey: string | null | undefined, wert: unknown, c: Vertrag): string {
  const s = slotKey ? SLOTS.get(slotKey) : undefined;
  if (Array.isArray(wert)) return wert.map((x) => einWertT(s, c, x)).join(' · ');
  if (wert && typeof wert === 'object') {
    const o = wert as Record<string, unknown>;
    if ('min' in o || 'max' in o) {
      const zahl = (n: unknown) => (n ? Number(n).toLocaleString(intlLocale(i18n.language)) : null);
      const a = zahl(o.min);
      const b = zahl(o.max);
      return a && b ? `${a} – ${b}` : (a ?? b ?? '—');
    }
    return tx('value.given', 'angegeben');
  }
  if (typeof wert === 'string' && wert.includes(' · ') && (s?.form === 'ai' || s?.form === 'text')) {
    return wert.split(' · ').map((teil) => einWertT(s, c, teil.trim())).join(' · ');
  }
  return einWertT(s, c, wert);
}

/**
 * Ein Text aus einer festen deutschen Liste, deren Einträge zugleich
 * Speicherwerte sind (z. B. Benefits): übersetzt über die Stelle in der Liste,
 * `intakeCatalog:<bereich>.c<n>`. Was nicht in der Liste steht, bleibt.
 */
export const listenTextT = (bereich: string, liste: readonly string[], wert: string): string => {
  const i = liste.indexOf(wert);
  return i >= 0 ? tx(`${bereich}.c${i}`, wert) : wert;
};

/** Ein einzelner Text des Katalog-Namespaces mit deutschem Rückfall. */
export const katalogTextT = tx;
