/**
 * Glocke und Server-Texte in der Sprache des Empfängers (Mehrsprachigkeit, 13.11.2026).
 *
 * Eine Benachrichtigung (Tabelle notifications) wird beim Schreiben einmal in der Sprache
 * dessen gespeichert, der sie liest: Profilsprache (languageOfUser), sonst Deutsch.
 * Titel und Text dürfen deshalb eine Funktion der Sprache sein:
 *
 *   notify(ctx, userId, 'job_paused', (l) => tx(l, m`Stelle ruht: ${title}`, m`Role paused: ${title}`, …), …)
 *
 * Ohne Profilsprache bleibt alles wortgleich deutsch wie bisher.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { baseLang, intlLocale, type Lang } from './i18n.ts';
import { pick, type Msg } from './mail-i18n.ts';
import { languageOfUser } from './recipient-language.ts';

export type { Lang, Msg };
export { m } from './mail-i18n.ts';

/** Text je Sprache (de, en, sv, nb); `m`-Vorlagen halten Namen aus der Schweizer Schreibweise heraus. */
export const tx = (lang: Lang | null | undefined, de: Msg | string, en: Msg | string, sv: Msg | string, nb: Msg | string): string =>
  pick(lang, { de, en, sv, nb });

/** Fester Text oder Text je Sprache des Empfängers. */
export type LangText = string | ((lang: Lang) => string);

/** Sprache des Empfängers einer Glocke: Profil, sonst Deutsch. */
export async function notifyLang(db: SupabaseClient, userId: string | null | undefined): Promise<Lang> {
  return (await languageOfUser(db, userId)) ?? 'de';
}

/** Titel und Text für einen Empfänger auflösen; Profil wird nur gelesen, wenn ein Text von der Sprache abhängt. */
export async function textsFor(db: SupabaseClient, userId: string | null | undefined, title: LangText, message: LangText): Promise<{ title: string; message: string }> {
  if (typeof title === 'string' && typeof message === 'string') return { title, message };
  const lang = await notifyLang(db, userId);
  return { title: typeof title === 'function' ? title(lang) : title, message: typeof message === 'function' ? message(lang) : message };
}

/** Datum aus einem Tagesschlüssel: deutsch „23.10.2026“, sonst nach Region (en-GB „23/10/2026“, sv „2026-10-23“). */
export function dateKeyIn(key: string | null | undefined, lang?: Lang | null): string {
  if (!key) return '';
  const k = String(key).slice(0, 10);
  const [y, mo, d] = k.split('-');
  if (baseLang(lang) === 'de') return `${d}.${mo}.${y}`;
  const ms = Date.UTC(Number(y), Number(mo) - 1, Number(d), 12);
  if (Number.isNaN(ms)) return `${d}.${mo}.${y}`;
  return new Intl.DateTimeFormat(intlLocale(lang), { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(ms));
}

/** Betrag aus Cent mit zwei Nachkommastellen nach der Sprache („1.234,50 €“, en „1,234.50 €“). */
export const eurCentsIn = (cents: number | null | undefined, lang?: Lang | null): string =>
  cents == null ? '' : `${new Intl.NumberFormat(intlLocale(lang), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)} €`;
