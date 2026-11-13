/**
 * Sprachen auf dem Server (Mehrsprachigkeit, 12.11.2026).
 *
 * Die Sprache hängt an der Person. Gleiche Liste und gleiche Zuordnung wie im
 * Frontend (src/i18n/languages.ts, matchLanguage). de-AT und de-CH lesen die
 * deutschen Texte; für die Schweiz wird „ß“ zu „ss“.
 *
 * Reine Logik ohne Datenbank, damit sie sich testen lässt.
 */
export type Lang = 'de' | 'de-AT' | 'de-CH' | 'en' | 'sv' | 'nb';
export type BaseLang = 'de' | 'en' | 'sv' | 'nb';
export const LANGS: readonly Lang[] = ['de', 'de-AT', 'de-CH', 'en', 'sv', 'nb'];

/** Sprachangabe (Body, Browser, Datenbank) → Plattform-Sprache; alles andere null. */
export function normLang(value: unknown): Lang | null {
  if (typeof value !== 'string') return null;
  const t = value.trim().toLowerCase().replace('_', '-');
  if (!t) return null;
  const [lang, region] = t.split('-');
  if (lang === 'de') return region === 'at' ? 'de-AT' : region === 'ch' || region === 'li' ? 'de-CH' : 'de';
  if (lang === 'en') return 'en';
  if (lang === 'sv') return 'sv';
  if (lang === 'nb' || lang === 'no' || lang === 'nn') return 'nb';
  return null;
}

/** Sprache, aus der die Texte kommen. Ohne Angabe Deutsch, wie vor der Mehrsprachigkeit. */
export function baseLang(lang: Lang | null | undefined): BaseLang {
  return lang === 'en' || lang === 'sv' || lang === 'nb' ? lang : 'de';
}

/** Schweizer Schreibweise: kein Eszett. */
export const swiss = (text: string): string => text.replace(/ß/g, 'ss');

export interface Texts { de: string; en?: string; sv?: string; nb?: string }

/**
 * Text in der Sprache der Person. Fehlt eine Übersetzung, gilt der deutsche Text.
 * Platzhalter `{name}` werden erst nach der Sprachwahl ersetzt, damit die
 * Schweizer Schreibweise nur den Text trifft und keine Namen.
 */
export function tr(lang: Lang | null | undefined, texts: Texts, vars?: Record<string, string | number>): string {
  const base = baseLang(lang);
  let text = texts[base] ?? texts.de;
  if (lang === 'de-CH' && text === texts.de) text = swiss(text);
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (all, key) => key in vars ? String(vars[key]) : all);
}

/** Region für Datum und Uhrzeit (Intl), wie intlLocale im Frontend. */
export function intlLocale(lang: Lang | null | undefined): string {
  switch (lang) {
    case 'de-AT': return 'de-AT';
    case 'de-CH': return 'de-CH';
    case 'en': return 'en-GB';
    case 'sv': return 'sv-SE';
    case 'nb': return 'nb-NO';
    default: return 'de-DE';
  }
}

/** Wert für das lang-Attribut einer Mail. */
export const htmlLang = (lang: Lang | null | undefined): string => lang ?? 'de';
