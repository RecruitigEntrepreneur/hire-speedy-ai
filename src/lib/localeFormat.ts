import i18n from '@/i18n';
import { intlLocale, languageDef, matchLanguage, type LanguageCode } from '@/i18n/languages';
import { dateFnsLocale } from '@/lib/candidateDateLocale';

// Datum, Uhrzeit, Zahl und Geld in der Sprache der Oberfläche.
// Für alles, was ein Mensch auf dem Bildschirm liest. Werte, die gespeichert oder an
// eine Function geschickt werden, behalten ihr festes Format.
// Ohne Sprachangabe gilt die aktuelle Sprache; Texte für einen bestimmten Empfänger
// (Kunde, Kandidat) geben dessen Sprache mit.

const loc = (lang?: string | null) => intlLocale(lang ?? i18n.language);
const asDate = (value: string | number | Date) => (value instanceof Date ? value : new Date(value));

/** 13.11.2026 · 13/11/2026 · 2026-11-13 */
export const fmtDate = (value: string | number | Date, lang?: string | null) =>
  asDate(value).toLocaleDateString(loc(lang), { day: '2-digit', month: '2-digit', year: 'numeric' });

/** 13.11. · 13/11 */
export const fmtDayMonth = (value: string | number | Date, lang?: string | null) =>
  asDate(value).toLocaleDateString(loc(lang), { day: '2-digit', month: '2-digit' });

/** Fr., 13.11.2026 · fre 13/11/2026 */
export const fmtWeekdayDate = (value: string | number | Date, lang?: string | null) =>
  asDate(value).toLocaleDateString(loc(lang), { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });

/** Fr., 13.11. */
export const fmtWeekdayDayMonth = (value: string | number | Date, lang?: string | null) =>
  asDate(value).toLocaleDateString(loc(lang), { weekday: 'short', day: '2-digit', month: '2-digit' });

/** 13. November 2026 */
export const fmtLongDate = (value: string | number | Date, lang?: string | null) =>
  asDate(value).toLocaleDateString(loc(lang), { day: 'numeric', month: 'long', year: 'numeric' });

/** November 2026 */
export const fmtMonthYear = (value: string | number | Date, lang?: string | null) =>
  asDate(value).toLocaleDateString(loc(lang), { month: 'long', year: 'numeric' });

/** 16:00 (ohne „Uhr“; das Wort gehört, wenn nötig, in den übersetzten Satz) */
export const fmtTime = (value: string | number | Date, lang?: string | null, timeZone?: string) =>
  asDate(value).toLocaleTimeString(loc(lang), { hour: '2-digit', minute: '2-digit', ...(timeZone ? { timeZone } : {}) });

/** 85.000 € · €85,000 · 85 000 € */
export const fmtMoney = (value: number, lang?: string | null, options: Intl.NumberFormatOptions = {}) =>
  new Intl.NumberFormat(loc(lang), { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, ...options }).format(value);

/** 85.000 · 85,000 · 85 000 */
export const fmtNumber = (value: number, lang?: string | null, options: Intl.NumberFormatOptions = {}) =>
  new Intl.NumberFormat(loc(lang), options).format(value);

/** date-fns-Locale der aktuellen (oder angegebenen) Sprache, für format(), formatDistance() usw. */
export const dfLocale = (lang?: string | null) => dateFnsLocale(lang ?? i18n.language);

/**
 * Sprache eines Empfängers auf der Kundenseite. Reihenfolge: die Sprache, die der Kunde
 * selbst gewählt hat (Profil), sonst das Land der Firma oder Stelle, sonst Deutsch
 * (so verhält sich die Plattform heute).
 */
export function clientLanguage(input: { profileLanguage?: string | null; country?: string | null }): LanguageCode {
  const own = matchLanguage(input.profileLanguage);
  if (own) return own;
  switch ((input.country ?? '').trim().toUpperCase()) {
    case 'SE': case 'SWEDEN': case 'SCHWEDEN': return 'sv';
    case 'NO': case 'NORWAY': case 'NORWEGEN': return 'nb';
    case 'AT': case 'AUSTRIA': case 'ÖSTERREICH': return 'de-AT';
    case 'CH': case 'SWITZERLAND': case 'SCHWEIZ': return 'de-CH';
    default: return 'de';
  }
}

/** Texte an Kandidaten schreibt der Headhunter in seiner eigenen Sprache (sein Markt). */
export const candidateLanguage = (): LanguageCode => (matchLanguage(i18n.language) ?? 'de');

/** Übersetzungsfunktion für einen bestimmten Empfänger, unabhängig von der Oberfläche. */
export const tFor = (lang: string, ns: string | string[]) => i18n.getFixedT(lang, ns);

export const isGerman = (lang?: string | null) => languageDef(lang ?? i18n.language).base === 'de';
