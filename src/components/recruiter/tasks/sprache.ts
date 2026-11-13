// Sprache der Oberfläche für Datum, Uhrzeit und Geld im Bereich Startseite und Aufgaben.
import { de, enGB, nb, sv } from 'date-fns/locale';
import i18n from '@/i18n';
import { intlLocale, languageDef } from '@/i18n/languages';

/** Region für Intl (toLocaleDateString, toLocaleString). */
export const loc = () => intlLocale(i18n.language);
/** Locale für date-fns passend zur Sprache. */
export const dfLocale = () => ({ de, en: enGB, sv, nb })[languageDef(i18n.language).base];
/** Tag und Monat kurz, deutsch „13.10.“. */
export const dayMonth = (value: string | Date) => new Date(value).toLocaleDateString(loc(), { day: '2-digit', month: '2-digit' });
/** Uhrzeit „14:30“. */
export const clockTime = (value: string | Date | number, timeZone?: string) =>
  new Date(value).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit', ...(timeZone ? { timeZone } : {}) });
/** Wie `dayMonth`, ohne Punkt am Ende: für ein Datum direkt vor dem Satzende („am 13.10.“ + Punkt des Satzes). */
export const dayMonthBare = (value: string | Date) => dayMonth(value).replace(/\.$/, '');
