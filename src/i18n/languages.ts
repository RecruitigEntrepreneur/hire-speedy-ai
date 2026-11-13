// Sprachen der Plattform. Sprache hängt an der Person, Land an Kunde und Stelle.
// Reine Logik ohne Browser- oder i18next-Zugriff, damit sie sich testen lässt.

export type LanguageCode = 'de' | 'de-AT' | 'de-CH' | 'en' | 'sv' | 'nb';
export type FlagCode = 'de' | 'at' | 'ch' | 'gb' | 'se' | 'no';

export interface LanguageDef {
  code: LanguageCode;
  /** Name in der eigenen Sprache, so steht er im Menü. */
  label: string;
  flag: FlagCode;
  /** Sprache, aus der die Texte kommen (de-AT und de-CH lesen die deutschen). */
  base: 'de' | 'en' | 'sv' | 'nb';
  /** Land, das die Wahl in den Firmenangaben vorbelegt. */
  country?: 'DE' | 'AT' | 'CH' | 'SE' | 'NO';
  /** „draft“: übersetzt, aber noch nicht gegengelesen. Erscheint nur lokal oder mit Freischaltung. */
  status: 'live' | 'draft';
  /** Hinweiszeile in dieser Sprache: „Diese Seite gibt es auch auf …“. */
  hint: { text: string; action: string };
}

export const LANGUAGES: readonly LanguageDef[] = [
  { code: 'de', label: 'Deutsch', flag: 'de', base: 'de', country: 'DE', status: 'live',
    hint: { text: 'Diese Seite gibt es auch auf Deutsch.', action: 'Zu Deutsch wechseln' } },
  { code: 'de-AT', label: 'Deutsch (Österreich)', flag: 'at', base: 'de', country: 'AT', status: 'live',
    hint: { text: 'Diese Seite gibt es auch auf Deutsch.', action: 'Zu Deutsch wechseln' } },
  { code: 'de-CH', label: 'Deutsch (Schweiz)', flag: 'ch', base: 'de', country: 'CH', status: 'live',
    hint: { text: 'Diese Seite gibt es auch auf Deutsch.', action: 'Zu Deutsch wechseln' } },
  { code: 'en', label: 'English', flag: 'gb', base: 'en', status: 'live',
    hint: { text: 'This page is also available in English.', action: 'Switch to English' } },
  { code: 'sv', label: 'Svenska', flag: 'se', base: 'sv', country: 'SE', status: 'live',
    hint: { text: 'Den här sidan finns också på svenska.', action: 'Byt till svenska' } },
  { code: 'nb', label: 'Norsk', flag: 'no', base: 'nb', country: 'NO', status: 'live',
    hint: { text: 'Denne siden finnes også på norsk.', action: 'Bytt til norsk' } },
];

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code) as LanguageCode[];
export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export function languageDef(code: string | null | undefined): LanguageDef {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && (LANGUAGE_CODES as string[]).includes(value);
}

/** Sprachen, die gerade wählbar sind. Entwürfe nur mit Freischaltung. */
export function visibleLanguages(showDrafts: boolean): LanguageDef[] {
  return LANGUAGES.filter((l) => l.status === 'live' || showDrafts);
}

/**
 * Ordnet eine Sprachangabe (Browser, Link, Profil) einer Plattform-Sprache zu.
 * „sv-SE“ wird zu sv, „no“/„nn“/„nb-NO“ zu nb, „de-AT“ bleibt, „de-LI“ zählt zur Schweiz.
 */
export function matchLanguage(tag: string | null | undefined): LanguageCode | null {
  if (!tag) return null;
  const t = tag.trim().toLowerCase().replace('_', '-');
  if (!t) return null;
  const [lang, region] = t.split('-');
  if (lang === 'de') return region === 'at' ? 'de-AT' : region === 'ch' || region === 'li' ? 'de-CH' : 'de';
  if (lang === 'en') return 'en';
  if (lang === 'sv') return 'sv';
  if (lang === 'nb' || lang === 'no' || lang === 'nn') return 'nb';
  return null;
}

export type LanguageSource = 'choice' | 'link' | 'browser' | 'default';

export interface LanguagePick {
  language: LanguageCode;
  source: LanguageSource;
  /** Browser-Sprache, wenn sie von der Link-Sprache abweicht: Anlass für die Hinweiszeile. */
  suggestion: LanguageCode | null;
}

/**
 * Vorauswahl: eigene frühere Wahl, dann Sprache des Links (Einladung oder
 * Sprachzusatz ?lang=), dann Browser, sonst Englisch.
 */
export function pickLanguage(input: {
  stored?: string | null;
  link?: string | null;
  browser?: readonly string[];
  showDrafts?: boolean;
}): LanguagePick {
  const allowed = new Set(visibleLanguages(!!input.showDrafts).map((l) => l.code));
  const ok = (tag: string | null | undefined) => {
    const code = matchLanguage(tag);
    return code && allowed.has(code) ? code : null;
  };
  const browser = (input.browser ?? []).map(ok).find(Boolean) ?? null;

  const stored = ok(input.stored);
  if (stored) return { language: stored, source: 'choice', suggestion: null };

  const link = ok(input.link);
  if (link) {
    const differs = browser && languageDef(browser).base !== languageDef(link).base;
    return { language: link, source: 'link', suggestion: differs ? browser : null };
  }
  if (browser) return { language: browser, source: 'browser', suggestion: null };
  return { language: DEFAULT_LANGUAGE, source: 'default', suggestion: null };
}

/** Schweizer Schreibweise: kein Eszett. */
export function swissSpelling(text: string): string {
  return text.replace(/ß/g, 'ss');
}

/** Region für Datum, Zahl und Währung (Intl). */
export function intlLocale(code: string | null | undefined): string {
  switch (languageDef(code).code) {
    case 'de-AT': return 'de-AT';
    case 'de-CH': return 'de-CH';
    case 'en': return 'en-GB';
    case 'sv': return 'sv-SE';
    case 'nb': return 'nb-NO';
    default: return 'de-DE';
  }
}
