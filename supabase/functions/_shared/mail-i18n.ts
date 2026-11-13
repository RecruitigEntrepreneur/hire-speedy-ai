/**
 * Bausteine für mehrsprachige Mailtexte (13.11.2026): Termine, Interviews,
 * Angebote, Verträge.
 *
 * Texte stehen als Vorlage je Sprache direkt in der Mail-Funktion:
 *
 *   pick(lang, { de: m`Hallo ${name},`, en: m`Hi ${name},`, sv: m`Hej ${name},`, nb: m`Hei ${name},` })
 *
 * `m` hält festen Text und eingesetzte Werte getrennt. So trifft die Schweizer
 * Schreibweise (ß → ss) nur den Text und nie Namen, Firmen oder Freitext.
 * Ohne Sprache gilt Deutsch, wortgleich wie vor der Mehrsprachigkeit.
 */
import { baseLang, intlLocale, swiss, type Lang } from './i18n.ts';

export type { Lang };

export interface Msg { s: readonly string[]; v: readonly unknown[] }

/** Vorlage: fester Text plus eingesetzte Werte. */
export const m = (s: TemplateStringsArray, ...v: unknown[]): Msg => ({ s, v });

export interface Variants { de: Msg | string; en: Msg | string; sv: Msg | string; nb: Msg | string }

/** Text in der Sprache des Empfängers; für de-CH ohne ß (nur im festen Text). */
export function pick(lang: Lang | null | undefined, t: Variants): string {
  const base = baseLang(lang);
  const x = t[base];
  const ch = lang === 'de-CH';
  if (typeof x === 'string') return ch ? swiss(x) : x;
  return x.s.map((part, i) => (ch ? swiss(part) : part) + (i < x.v.length ? String(x.v[i]) : '')).join('');
}

/** Kurzform für eine Mail-Funktion: `const L = lang(o.lang)`, dann `L({ de: …, en: …, sv: …, nb: … })`. */
export const lang = (l: Lang | null | undefined) => (t: Variants) => pick(l, t);

/**
 * Sprache an einen Link auf eine öffentliche Seite hängen (`?lang=sv` bzw. `&lang=sv`),
 * damit die Seite in derselben Sprache öffnet. Deutsch bleibt der Link wie bisher.
 */
export function withLang(url: string, l: Lang | null | undefined): string {
  if (!url || !l || l === 'de') return url;
  const hashAt = url.indexOf('#');
  const base = hashAt >= 0 ? url.slice(0, hashAt) : url;
  const hash = hashAt >= 0 ? url.slice(hashAt) : '';
  if (/[?&]lang=/.test(base)) return url;
  return `${base}${base.includes('?') ? '&' : '?'}lang=${encodeURIComponent(l)}${hash}`;
}

/** Betrag in Euro nach der Sprache: „140.000 €“, en „140,000 €“, sv „140 000 €“. */
export function euroIn(l: Lang | null | undefined, n: number | null | undefined): string {
  if (n == null) return '';
  return `${new Intl.NumberFormat(intlLocale(l)).format(n)} €`;
}

/** Absendername „Sandra Weiß über Matchunt“; außer Deutsch „… via Matchunt“. */
export const viaMatchunt = (name: string, l: Lang | null | undefined): string =>
  `${name} ${baseLang(l) === 'de' ? 'über' : 'via'} Matchunt`;

/** Anführungszeichen der Sprache: „…“, “…”, ”…”, «…». */
export function quoteMarks(l: Lang | null | undefined): [string, string] {
  switch (baseLang(l)) {
    case 'en': return ['“', '”'];
    case 'sv': return ['”', '”'];
    case 'nb': return ['«', '»'];
    default: return ['„', '“'];
  }
}

/** Kurzes Datum für Mails: „Mo., 09.11.“, in einem anderen Jahr mit Jahr; en „Mon 09/11“. */
export function shortDay(iso: string | null | undefined, l: Lang | null | undefined, nowMs = Date.now()): string {
  if (!iso) return '';
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  const other = d.getUTCFullYear() !== new Date(nowMs).getUTCFullYear();
  return d.toLocaleDateString(intlLocale(l), { weekday: 'short', day: '2-digit', month: '2-digit', ...(other ? { year: 'numeric' as const } : {}), timeZone: 'Europe/Berlin' });
}
