import i18n from '@/i18n';
import { languageDef } from '@/i18n/languages';

// Anzeige für Auswahlwerte und Katalogtexte der Kandidatenakte und des Interviews.
// Gespeichert, verglichen und an Functions geschickt wird weiter der deutsche Wert;
// nur was auf dem Bildschirm steht, läuft über term(). Der Schlüssel ist der deutsche
// Text in Kleinbuchstaben ohne Sonderzeichen (termKey), abgelegt im Namespace
// candidateTerms unter „t“. Unbekanntes (eigene Worte, Firmennamen) bleibt, wie es ist.

export const TERMS_NS = 'candidateTerms';

export function termKey(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Deutsch, Österreich und Schweiz lesen die Quelle; dort ist nichts zu übersetzen. */
export const isGermanUi = (language: string = i18n.language) => languageDef(language).base === 'de';

function lookup(text: string): string | null {
  const key = termKey(text);
  if (!key) return null;
  const hit = i18n.t(`${TERMS_NS}:t.${key}`, { defaultValue: '' });
  return hit || null;
}

const NOTICE = /^(\d+ (?:Wochen|Monate?)) (zum .+)$/;
const MINUTES = /^(\d+) Min\.$/;
const TEAM = /^Team von (\d+) geführt$/;
const LEITUNG = /^Leitung (.+)$/;
const FUEHRT = /^führt (\d+)$/;
const JAHRE = /^(\d+) J\.$/;

/** Anzeige eines gespeicherten oder aus einem Katalog stammenden deutschen Texts in der Sprache der Oberfläche. */
export function term(text: string | null | undefined): string {
  if (!text) return text ?? '';
  if (isGermanUi()) return text;
  const direct = lookup(text);
  if (direct) return direct;
  const notice = text.match(NOTICE);
  if (notice) return `${term(notice[1])} ${term(notice[2])}`;
  const minutes = text.match(MINUTES);
  if (minutes) return i18n.t(`${TERMS_NS}:pattern.minutes`, { n: minutes[1] });
  const team = text.match(TEAM);
  if (team) return i18n.t(`${TERMS_NS}:pattern.teamLed`, { n: team[1] });
  const leitung = text.match(LEITUNG);
  if (leitung) return i18n.t(`${TERMS_NS}:pattern.headOf`, { area: term(leitung[1]) });
  const fuehrt = text.match(FUEHRT);
  if (fuehrt) return i18n.t(`${TERMS_NS}:pattern.leads`, { n: fuehrt[1] });
  const jahre = text.match(JAHRE);
  if (jahre) return i18n.t(`${TERMS_NS}:pattern.yearsShort`, { n: jahre[1] });
  // „Lücke: Weiterbildung“, „Weiterbildung: <Zertifikat>“, „<Firma>: Probezeit beendet“
  const colon = text.indexOf(': ');
  if (colon > 0) {
    const a = text.slice(0, colon);
    const b = text.slice(colon + 2);
    const ta = lookup(a);
    const tb = lookup(b);
    if (ta || tb) return `${ta ?? a}: ${tb ?? b}`;
  }
  return text;
}

/** Mehrere Werte, in der Sprache der Oberfläche aufgezählt. */
export function termList(values: string[], separator = ', '): string {
  return values.map((v) => term(v)).join(separator);
}
