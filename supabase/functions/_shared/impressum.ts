/**
 * Impressum prüfen statt glauben.
 *
 * Firecrawl liest die Impressum-Seite und schlägt Werte vor. Diese Werte landen
 * im Vertrag, deshalb zählt nur, was wörtlich auf der Seite steht und zum Format
 * passt: eine USt-IdNr. hat ihre Länge, eine Registernummer ihre Form, eine
 * Postleitzahl ihre Ziffern. Was nicht passt, fällt heraus und wird gemeldet,
 * statt still im Datenblatt zu landen. Bis zum 16.09.2026 stand im Schema als
 * Beispiel unsere eigene Registernummer; ohne Abgleich hätte eine Firma ohne
 * Eintrag sie übernehmen können.
 *
 * Reine Funktionen ohne Netz und ohne Deno, getestet in
 * supabase/tests/impressum.test.ts.
 */

export interface ImpressumFields {
  legal_name?: string; street?: string; postal_code?: string; city?: string; country?: string;
  registration_number?: string; register_court?: string; vat_id?: string; ceo_name?: string;
}
export type ImpressumField = keyof ImpressumFields;
export interface ImpressumCheck { fields: ImpressumFields; dropped: ImpressumField[] }

const INVISIBLE = /[\u00AD\u200B-\u200F\u2060\uFEFF]/g;
const LETTER = /\p{L}/u;

/** Markdown der Seite als schlichter Text: Links auf ihren Text, ohne Auszeichnung und unsichtbare Zeichen. */
export function pageText(markdown: unknown): string {
  return String(markdown ?? '')
    .normalize('NFC')
    .replace(INVISIBLE, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\\\r?\n/g, '\n')
    .replace(/\\([\\`*_{}[\]()#+\-.!|>~&])/g, '$1')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[*_`#>|~]+/g, ' ')
    .replace(/[ \t\u00A0]+/g, ' ')
    .replace(/ *\r?\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** Vergleichsform: klein, Umlaute ausgeschrieben, „Str.“ wie „Straße“, nur Buchstaben und Ziffern. */
export function canon(value: unknown): string {
  return String(value ?? '')
    .normalize('NFC')
    .replace(INVISIBLE, '')
    .toLowerCase()
    .replace(/ß/g, 'ss').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/str\.(?=[\s\d,;]|$)/g, 'strasse')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Steht der Wert als ganze Wortfolge auf der Seite? */
const onPage = (value: string, page: string): boolean => {
  const v = canon(value);
  return v.length >= 2 && ` ${page} `.includes(` ${v} `);
};

const escapeRegExp = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Kennungen wie USt-IdNr. oder Registernummer: Trennzeichen egal, aber keine Ziffer mehr dahinter. */
function tokenOnPage(value: string, text: string): boolean {
  const chars = value.toUpperCase().replace(/[^A-Z0-9]/g, '').split('');
  if (chars.length < 4) return false;
  return new RegExp(`(?<![A-Z0-9])${chars.map(escapeRegExp).join('[\\s.:/-]*')}(?![0-9])`, 'i').test(text);
}

const EU_VAT = /^(?:BE|BG|CY|CZ|DK|EE|EL|ES|FI|FR|HR|HU|IE|IT|LT|LU|LV|MT|NL|PL|PT|RO|SE|SI|SK|XI|GB)[0-9A-Z]{8,12}$/;
/** USt-IdNr. in fester Form: DE und neun Ziffern, ATU und acht, CHE-123.456.789; andere EU-Länder nach Grundmuster. */
export function cleanVatId(raw: unknown): string | null {
  const v = String(raw ?? '').replace(INVISIBLE, '').toUpperCase().replace(/[\s.\-/:]/g, '');
  const dach = /(DE\d{9}|ATU\d{8}|CHE\d{9})(?!\d)/.exec(v);
  if (dach) {
    const id = dach[1];
    return id.startsWith('CHE') ? `CHE-${id.slice(3, 6)}.${id.slice(6, 9)}.${id.slice(9, 12)}` : id;
  }
  return EU_VAT.test(v) ? v : null;
}

const REGISTER_TYPES: Record<string, string> = { HRA: 'HRA', HRB: 'HRB', GNR: 'GnR', GSR: 'GsR', PR: 'PR', VR: 'VR' };
/** Registernummer ohne Gericht: „HRB 288632“, „HRB 12345 B“, „FN 123456a“, „CHE-123.456.789“. */
export function cleanRegistration(raw: unknown): string | null {
  const t = String(raw ?? '').replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();
  const de = /\b(HRA|HRB|GnR|GsR|PR|VR) ?(?:Nr\.? ?)?(\d{1,7})(?!\d)/i.exec(t);
  if (de) {
    // Manche Gerichte hängen ein Kürzel an, etwa „HRB 12345 B“ in Berlin. „AG“ ist das Amtsgericht.
    const suffix = /^ ?([A-Z]{1,2})(?![\p{L}\d])/u.exec(t.slice(de.index + de[0].length));
    const tail = suffix && suffix[1] !== 'AG' ? ` ${suffix[1]}` : '';
    return `${REGISTER_TYPES[de[1].toUpperCase()]} ${de[2]}${tail}`;
  }
  const at = /\bFN ?(\d{1,7}) ?([a-z])(?![\p{L}\d])/iu.exec(t);
  if (at) return `FN ${at[1]}${at[2].toLowerCase()}`;
  const ch = /\bCHE[- ]?(\d{3})[. ]?(\d{3})[. ]?(\d{3})(?!\d)/i.exec(t);
  if (ch) return `CHE-${ch[1]}.${ch[2]}.${ch[3]}`;
  return null;
}

const ROLE = /vertreten|vertretungsberechtigt|gesch(?:ä|ae)ftsf(?:ü|ue)hr|inhaber|vorstand|managing director|ceo|owner|prokur/i;
/** Namen der Vertretung, jeder einzeln auf der Seite geprüft; Rollenbezeichnungen fallen weg. */
function verifiedNames(raw: string, page: string): string | null {
  const colon = raw.indexOf(':');
  const value = (colon > 0 && colon < 60 && ROLE.test(raw.slice(0, colon)) ? raw.slice(colon + 1) : raw)
    .replace(/^\s*(?:gesch(?:ä|ae)ftsf(?:ü|ue)hrer(?:in)?|inhaber(?:in)?|vorstand|ceo)\s+/i, '');
  const names = value
    .split(/\s*(?:,|;|\/|&|\bund\b|\band\b)\s*/i)
    .map(n => n.trim())
    .filter(n => n.length >= 3 && LETTER.test(n) && onPage(n, page));
  return names.length ? [...new Set(names)].slice(0, 4).join(', ') : null;
}

const unique = (values: (string | null)[]): string | null => {
  const found = new Set(values.filter((v): v is string => !!v));
  return found.size === 1 ? [...found][0] : null;
};
const VAT_IN_TEXT = /\b(?:DE ?\d{3} ?\d{3} ?\d{3}|ATU ?\d{8}|CHE[- ]?\d{3}[. ]?\d{3}[. ]?\d{3})(?!\d)/g;
const REGISTER_IN_TEXT = /\b(?:HRA|HRB) ?(?:Nr\.? ?)?\d{1,7}(?!\d)/g;

/**
 * Vorschläge der Extraktion gegen den Seitentext prüfen. Übrig bleibt, was
 * wörtlich dasteht und zum Format passt; `dropped` nennt, was verworfen wurde.
 * USt-IdNr. und Registernummer werden zusätzlich direkt im Text gesucht, weil
 * ihre Form eindeutig ist, aber nur wenn genau ein Kandidat dasteht.
 */
export function validateImpressum(extracted: unknown, markdown: unknown): ImpressumCheck {
  const text = pageText(markdown);
  const page = canon(text);
  const source = (extracted && typeof extracted === 'object' ? extracted : {}) as Record<string, unknown>;
  const raw = (key: ImpressumField) => typeof source[key] === 'string'
    ? (source[key] as string).replace(INVISIBLE, '').replace(/\s+/g, ' ').trim() : '';
  const fields: ImpressumFields = {};
  const dropped: ImpressumField[] = [];
  const take = (key: ImpressumField, value: string | null) => {
    if (!raw(key)) return;
    if (value) fields[key] = value; else dropped.push(key);
  };
  const plain = (value: string, max: number) => value && value.length <= max && LETTER.test(value) && onPage(value, page) ? value : null;

  take('legal_name', plain(raw('legal_name'), 160));
  take('street', plain(raw('street'), 120));
  const zip = raw('postal_code').replace(/^(?:D|DE|A|AT|CH) ?- ?/i, '');
  take('postal_code', /^\d{4,5}$/.test(zip) && onPage(zip, page) ? zip : null);
  take('city', plain(raw('city').replace(/^(?:[A-Z]{1,2} ?- ?)?\d{4,5} +/i, ''), 80));
  take('country', plain(raw('country'), 60));
  const registration = cleanRegistration(raw('registration_number'));
  take('registration_number', registration && tokenOnPage(registration, text) ? registration : null);
  // Das Gericht ohne seine Anschrift: „Amtsgericht München, 80333 München“ wird „Amtsgericht München“.
  take('register_court', plain(raw('register_court').split(',')[0].trim(), 80));
  const vat = cleanVatId(raw('vat_id'));
  take('vat_id', vat && tokenOnPage(vat, text) ? vat : null);
  take('ceo_name', verifiedNames(raw('ceo_name'), page));

  if (!fields.vat_id) {
    const found = unique([...text.matchAll(VAT_IN_TEXT)].map(m => cleanVatId(m[0])));
    if (found) fields.vat_id = found;
  }
  if (!fields.registration_number) {
    const found = unique([...text.matchAll(REGISTER_IN_TEXT)].map(m => cleanRegistration(m[0])));
    if (found) fields.registration_number = found;
  }
  return { fields, dropped };
}

const MARKERS = [
  /impressum|imprint/i,
  /angaben\s+gem(?:ä|ae)(?:ß|ss)|§\s*5\s*(?:tmg|ddg|ecg)|§\s*25\s*mediengesetz|legal\s+notice|site\s+notice/i,
  /handelsregister|registergericht|registernummer|firmenbuch|commercial\s+regist/i,
  /ust\.?[-\s]*id|umsatzsteuer[-\s]*identifikation|\buid\b|vat\s*(?:id|no|number|reg)/i,
  /vertreten\s+durch|gesch(?:ä|ae)ftsf(?:ü|ue)hr|inhaber(?:in)?\b|managing\s+director|vorstand/i,
];
/** Mindestens zwei typische Impressum-Merkmale. Eine Fehlerseite mit Impressum-Link im Fuß reicht nicht. */
export const looksLikeImpressum = (markdown: unknown): boolean => {
  const text = pageText(markdown);
  return MARKERS.filter(marker => marker.test(text)).length >= 2;
};

/** Vergleichsschlüssel einer Adresse: ohne Protokoll, www, Fragment und Schrägstrich am Ende. */
export function urlKey(href: string): string {
  try {
    const u = new URL(href);
    return `${u.hostname.toLowerCase().replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '').toLowerCase()}`;
  } catch {
    return String(href).toLowerCase();
  }
}

const IMPRESSUM_PATHS = [/impressum/, /imprint/, /legal[-_ ]?notice/, /site[-_ ]?notice/, /anbieterkennzeichnung/, /rechtliche[-_ ]?hinweise/, /legal[-_ ]?info/, /mentions[-_ ]?legales/, /colofon|colophon/];

/**
 * Impressum-Kandidaten aus einer Linkliste, beste zuerst. Nur Pfade, die nach
 * Impressum heißen; „Über uns“ oder „Unternehmen“ sind kein Impressum (auf
 * bluewater-bridge.de hätte sonst /werte-unternehmenskultur gewinnen können).
 * Nimmt Strings (Links einer Seite) und Objekte mit `url` (Firecrawl-Seitenkarte).
 */
export function rankImpressumLinks(links: unknown, domain: string, max = 2): string[] {
  const best = new Map<string, { url: string; score: number }>();
  for (const link of Array.isArray(links) ? links : []) {
    const href = typeof link === 'string' ? link
      : typeof (link as { url?: unknown } | null)?.url === 'string' ? (link as { url: string }).url : '';
    let url: URL;
    try { url = new URL(href); } catch { continue; }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== domain && !host.endsWith(`.${domain}`)) continue;
    let path: string;
    try { path = decodeURIComponent(url.pathname).toLowerCase(); } catch { path = url.pathname.toLowerCase(); }
    if (/\.(pdf|jpe?g|png|gif|svg|webp|zip|docx?|xlsx?)$/.test(path)) continue;
    const rank = IMPRESSUM_PATHS.findIndex(p => p.test(path));
    if (rank < 0) continue;
    const segments = path.split('/').filter(Boolean);
    let score = 100 - rank * 5 - segments.length * 2;
    if (/^(impressum|imprint)(\.html?|\.php)?$/.test(segments[segments.length - 1] ?? '')) score += 6;
    if (segments.some(s => /^(en|en-[a-z]{2}|english|fr|it|es|nl|pl)$/.test(s))) score -= 8;
    if (host !== domain) score -= 10;
    if (url.search) score -= 3;
    url.hash = '';
    const key = urlKey(url.href);
    const known = best.get(key);
    if (!known || known.score < score) best.set(key, { url: url.href, score });
  }
  return [...best.values()].sort((a, b) => b.score - a.score).map(v => v.url).slice(0, max);
}
