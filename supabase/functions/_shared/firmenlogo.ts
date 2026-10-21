import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normalizeDomain } from './domain.ts';

/**
 * Firmenlogo von der Website (19.10.2026).
 *
 * Sobald wir die Website einer Firma kennen, holt die Function firmenlogo-holen
 * ein Logo und legt es in den Bucket company-logos. Gezeigt wird es in Kacheln
 * von 16 bis 40 Pixeln — deshalb gewinnt das quadratische App-Symbol, ein breiter
 * Schriftzug wäre dort unlesbar.
 *
 * Test an echten Seiten (19.10.): Bluewater hat ein schwarzes „BB" als App-Symbol
 * (256 px, passt) und oben ein weißes Logo, das auf hellem Grund verschwindet.
 * Deshalb wird jedes Bild geprüft: Größe, weiß auf durchsichtig, leer, bei SVG
 * zusätzlich Skripte und fremde Inhalte.
 *
 * Reihenfolge: erst die Startseite direkt lesen (kostet nichts), nur ohne
 * brauchbaren Treffer Firecrawl fragen (Format „branding", 1 Credit) — das liest
 * auch Seiten, die einfache Abrufe sperren oder sich erst im Browser aufbauen.
 */

export type LogoArt = 'app-symbol' | 'symbol' | 'schema' | 'logo' | 'favicon';
export interface LogoKandidat { url: string; art: LogoArt; groesse: number }
export interface LogoTreffer extends LogoKandidat {
  bytes: Uint8Array;
  contentType: string;
  ext: string;
  breite?: number;
  hoehe?: number;
}
export interface LogoSuche {
  website: string;
  treffer: LogoTreffer | null;
  geprueft: { url: string; art: LogoArt; grund: string }[];
  quellen: string[];
}
export interface LogoDeps {
  fetch: typeof fetch;
  firecrawlKey?: string;
  now?: () => number;
}

const RANG: Record<LogoArt, number> = { 'app-symbol': 0, symbol: 1, schema: 2, logo: 3, favicon: 4 };
const MAX_BYTES = 1_500_000;
const MAX_PRUEFUNGEN = 8;
const SEITE_MS = 10_000;
const BILD_MS = 6_000;
const FIRECRAWL_MS = 30_000;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

/** Standard-Symbole von Baukästen: zeigen den Baukasten, nicht die Firma. */
const STANDARD_SYMBOLE = [
  /website-files\.com\/img\/(favicon|webclip)/i,
  /daks2k3a4ib2z\.cloudfront\.net\/img\/(favicon|webclip)/i,
  /(^|\.)wix\.com\/favicon/i,
  /\/\/s\.w\.org\//i,
  /wordpress\.com\/i\/(webclip|favicon)/i,
  /squarespace\.com\/universal\/default-favicon/i,
];

// ----------------------------------------------------------------------------
// Kandidaten sammeln
// ----------------------------------------------------------------------------

const decodeEntities = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  if (!m) return null;
  return decodeEntities((m[1] ?? m[2] ?? m[3] ?? '').trim()) || null;
}

/** „180x180" → 180, „16x16 32x32" → 32, „any" → 512. */
function groesseAus(sizes: string | null): number {
  if (!sizes) return 0;
  if (/any/i.test(sizes)) return 512;
  return Math.max(0, ...[...sizes.matchAll(/(\d+)\s*x\s*(\d+)/gi)].map(m => Math.min(Number(m[1]), Number(m[2]))));
}

function absolut(href: string, base: string): string | null {
  if (!href || href.startsWith('data:')) return null;
  try {
    const u = new URL(href, base);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

function logosAusJsonLd(wert: unknown, out: string[], tiefe = 0) {
  if (!wert || tiefe > 6 || out.length >= 3) return;
  if (Array.isArray(wert)) { wert.forEach(w => logosAusJsonLd(w, out, tiefe + 1)); return; }
  if (typeof wert !== 'object') return;
  const o = wert as Record<string, unknown>;
  const logo = o.logo;
  if (typeof logo === 'string') out.push(logo);
  else if (logo && typeof logo === 'object' && typeof (logo as Record<string, unknown>).url === 'string') out.push((logo as Record<string, string>).url);
  for (const k of ['@graph', 'publisher', 'brand', 'organization', 'author']) logosAusJsonLd(o[k], out, tiefe + 1);
}

export function kandidatenAusHtml(html: string, base: string): LogoKandidat[] {
  const out: LogoKandidat[] = [];
  const push = (href: string | null, art: LogoArt, groesse: number) => {
    const url = href ? absolut(href, base) : null;
    if (url) out.push({ url, art, groesse });
  };
  const text = html.slice(0, 800_000);

  for (const tag of text.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = (attr(tag, 'rel') ?? '').toLowerCase();
    if (!/\bicon\b|apple-touch-icon/.test(rel) || rel.includes('mask-icon')) continue;
    const href = attr(tag, 'href');
    if (!href) continue;
    const svg = /\.svg(\?|#|$)/i.test(href) || (attr(tag, 'type') ?? '').includes('svg');
    const groesse = svg ? 512 : groesseAus(attr(tag, 'sizes'));
    const art: LogoArt = rel.includes('apple-touch-icon') ? 'app-symbol' : svg || groesse >= 96 ? 'symbol' : 'favicon';
    push(href, art, groesse || (art === 'app-symbol' ? 180 : 0));
  }

  for (const m of text.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    const urls: string[] = [];
    try { logosAusJsonLd(JSON.parse(m[1]), urls); } catch { /* kaputtes JSON-LD: egal */ }
    urls.forEach(u => push(u, 'schema', 0));
  }

  let imgs = 0;
  for (const tag of text.match(/<img\b[^>]*>/gi) ?? []) {
    if (imgs >= 3) break;
    const merkmal = [attr(tag, 'src'), attr(tag, 'alt'), attr(tag, 'class'), attr(tag, 'id')].join(' ').toLowerCase();
    if (!merkmal.includes('logo')) continue;
    push(attr(tag, 'src') ?? attr(tag, 'data-src'), 'logo', 0);
    imgs++;
  }

  // Übliche Adressen, auch wenn die Seite sie nicht verlinkt.
  push('/apple-touch-icon.png', 'app-symbol', 1);
  push('/favicon.ico', 'favicon', 0);
  return out;
}

export function kandidatenAusBranding(branding: unknown, base: string): LogoKandidat[] {
  if (!branding || typeof branding !== 'object') return [];
  const b = branding as { logo?: unknown; images?: { logo?: unknown; favicon?: unknown } };
  const out: LogoKandidat[] = [];
  for (const [wert, art] of [[b.logo, 'logo'], [b.images?.logo, 'logo'], [b.images?.favicon, 'favicon']] as const) {
    const url = typeof wert === 'string' ? absolut(wert, base) : null;
    if (url) out.push({ url, art, groesse: 0 });
  }
  return out;
}

/** Doppelte raus (beste Art bleibt), Standard-Symbole raus, sortiert nach Rang und Größe. */
export function ordne(kandidaten: LogoKandidat[]): LogoKandidat[] {
  const beste = new Map<string, LogoKandidat>();
  for (const k of kandidaten) {
    if (STANDARD_SYMBOLE.some(r => r.test(k.url))) continue;
    const alt = beste.get(k.url);
    if (!alt || RANG[k.art] < RANG[alt.art] || (RANG[k.art] === RANG[alt.art] && k.groesse > alt.groesse)) beste.set(k.url, k);
  }
  return [...beste.values()].sort((a, b) => RANG[a.art] - RANG[b.art] || b.groesse - a.groesse);
}

// ----------------------------------------------------------------------------
// Bilder prüfen
// ----------------------------------------------------------------------------

type Typ = 'png' | 'jpeg' | 'gif' | 'webp' | 'ico' | 'svg';
const CONTENT_TYPE: Record<Typ, string> = {
  png: 'image/png', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', ico: 'image/x-icon', svg: 'image/svg+xml',
};
const EXT: Record<Typ, string> = { png: 'png', jpeg: 'jpg', gif: 'gif', webp: 'webp', ico: 'ico', svg: 'svg' };

export function bildTyp(b: Uint8Array): Typ | null {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpeg';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
  if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return 'ico';
  const kopf = new TextDecoder().decode(b.subarray(0, Math.min(b.length, 2048))).toLowerCase();
  if (kopf.includes('<svg')) return 'svg';
  return null;
}

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];

export function bildMasse(b: Uint8Array, typ: Typ): { w: number; h: number } | null {
  try {
    if (typ === 'png') return { w: u32be(b, 16), h: u32be(b, 20) };
    if (typ === 'gif') return { w: b[6] | (b[7] << 8), h: b[8] | (b[9] << 8) };
    if (typ === 'ico') {
      const anzahl = b[4] | (b[5] << 8);
      let w = 0, h = 0;
      for (let i = 0; i < anzahl && 6 + i * 16 + 1 < b.length; i++) {
        w = Math.max(w, b[6 + i * 16] || 256);
        h = Math.max(h, b[6 + i * 16 + 1] || 256);
      }
      return w ? { w, h } : null;
    }
    if (typ === 'webp') {
      const chunk = new TextDecoder().decode(b.subarray(12, 16));
      if (chunk === 'VP8 ') return { w: (b[26] | (b[27] << 8)) & 0x3fff, h: (b[28] | (b[29] << 8)) & 0x3fff };
      if (chunk === 'VP8L') {
        const [b0, b1, b2, b3] = [b[21], b[22], b[23], b[24]];
        return { w: 1 + (((b1 & 0x3f) << 8) | b0), h: 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) };
      }
      if (chunk === 'VP8X') return { w: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), h: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
      return null;
    }
    if (typ === 'jpeg') {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: u16be(b, i + 7), h: u16be(b, i + 5) };
        i += 2 + u16be(b, i + 2);
      }
    }
  } catch { /* unlesbar */ }
  return null;
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Wie hell ist ein PNG, und wie viel davon ist durchsichtig? Eigener kleiner
 * Decoder (alle Zeilen entfiltern, ein Raster von höchstens 256×256 Punkten
 * auswerten), damit keine Bildbibliothek in die Function muss.
 * null = nicht auswertbar (Interlace, zu groß) — dann entscheidet die Größe.
 */
export async function pngHelligkeit(b: Uint8Array): Promise<{ durchsichtig: number; hell: number } | null> {
  let p = 8, w = 0, h = 0, tiefe = 0, art = 0, interlace = 0;
  let palette: Uint8Array | null = null, trns: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  while (p + 8 <= b.length) {
    const len = u32be(b, p);
    const typ = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]);
    const data = b.subarray(p + 8, p + 8 + len);
    if (typ === 'IHDR') { w = u32be(data, 0); h = u32be(data, 4); tiefe = data[8]; art = data[9]; interlace = data[12]; }
    else if (typ === 'PLTE') palette = data;
    else if (typ === 'tRNS') trns = data;
    else if (typ === 'IDAT') idat.push(data);
    else if (typ === 'IEND') break;
    p += 12 + len;
  }
  const kanaele = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[art];
  if (!w || !h || interlace !== 0 || !kanaele || w * h > 6_000_000) return null;
  const gesamt = idat.reduce((s, d) => s + d.length, 0);
  const zusammen = new Uint8Array(gesamt);
  let o = 0;
  for (const d of idat) { zusammen.set(d, o); o += d.length; }
  const roh = await inflate(zusammen);
  const bitsPP = kanaele * tiefe;
  const stride = Math.ceil((w * bitsPP) / 8);
  const bpp = Math.max(1, Math.ceil(bitsPP / 8));
  if (roh.length < h * (stride + 1)) return null;

  const zeileSchritt = Math.max(1, Math.floor(h / 256));
  const spalteSchritt = Math.max(1, Math.floor(w / 256));
  let prev = new Uint8Array(stride), cur = new Uint8Array(stride);
  let punkte = 0, deckend = 0, hell = 0;
  const max = (1 << tiefe) - 1;

  const wert = (x: number, kanal: number): number => {
    if (tiefe === 8) return cur[x * kanaele + kanal];
    if (tiefe === 16) return cur[(x * kanaele + kanal) * 2];
    const bit = x * tiefe;
    return (cur[bit >> 3] >> (8 - tiefe - (bit & 7))) & max;
  };

  for (let y = 0; y < h; y++) {
    const start = y * (stride + 1);
    const filter = roh[start];
    for (let i = 0; i < stride; i++) {
      const x = roh[start + 1 + i];
      const a = i >= bpp ? cur[i - bpp] : 0;
      const bb = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = x;
      if (filter === 1) v = x + a;
      else if (filter === 2) v = x + bb;
      else if (filter === 3) v = x + ((a + bb) >> 1);
      else if (filter === 4) {
        const pp = a + bb - c, pa = Math.abs(pp - a), pb = Math.abs(pp - bb), pc = Math.abs(pp - c);
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? bb : c);
      }
      cur[i] = v & 0xff;
    }
    if (y % zeileSchritt === 0) {
      for (let px = 0; px < w; px += spalteSchritt) {
        let r: number, g: number, bl: number, al = 255;
        if (art === 3) {
          const idx = wert(px, 0);
          r = palette?.[idx * 3] ?? 0; g = palette?.[idx * 3 + 1] ?? 0; bl = palette?.[idx * 3 + 2] ?? 0;
          al = trns && idx < trns.length ? trns[idx] : 255;
        } else if (art === 0 || art === 4) {
          const grau = tiefe < 8 ? Math.round((wert(px, 0) * 255) / max) : wert(px, 0);
          r = g = bl = grau;
          if (art === 4) al = wert(px, 1);
        } else {
          r = wert(px, 0); g = wert(px, 1); bl = wert(px, 2);
          if (art === 6) al = wert(px, 3);
        }
        punkte++;
        if (al > 40) {
          deckend++;
          if (Math.min(r, g, bl) > 225) hell++;
        }
      }
    }
    [prev, cur] = [cur, prev];
  }
  if (!punkte) return null;
  return { durchsichtig: 1 - deckend / punkte, hell: deckend ? hell / deckend : 1 };
}

const istWeiss = (farbe: string): boolean => {
  const f = farbe.trim().toLowerCase();
  if (f === 'white') return true;
  const hex = f.match(/^#([0-9a-f]{3,8})$/)?.[1];
  if (hex) {
    const voll = hex.length <= 4 ? hex.split('').map(c => c + c).join('') : hex;
    return [0, 2, 4].every(i => parseInt(voll.slice(i, i + 2), 16) >= 0xf0);
  }
  const rgb = f.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  return !!rgb && [rgb[1], rgb[2], rgb[3]].every(v => Number(v) >= 240);
};

export function pruefeSvg(text: string): string | null {
  if (!/<svg[\s>]/i.test(text)) return 'kein SVG';
  if (/<script|\son[a-z]+\s*=|javascript:|<foreignobject/i.test(text)) return 'SVG mit Skript';
  if (/(?:xlink:)?href\s*=\s*["']\s*(https?:)?\/\//i.test(text)) return 'SVG lädt fremde Inhalte';
  const farben = [...text.matchAll(/(?:fill|stroke|stop-color)\s*[:=]\s*["']?\s*([^"';\s>)]+\)?)/gi)]
    .map(m => m[1].toLowerCase())
    .filter(f => !['none', 'transparent', 'currentcolor', 'inherit'].includes(f) && !f.startsWith('url('));
  if (farben.length > 0 && farben.every(istWeiss)) return 'weiß';
  return null;
}

async function mitZeit(deps: LogoDeps, url: string, ms: number, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await deps.fetch(url, { ...init, redirect: 'follow', signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function pruefeBild(k: LogoKandidat, deps: LogoDeps): Promise<LogoTreffer | string> {
  let res: Response;
  try {
    res = await mitZeit(deps, k.url, BILD_MS, { headers: { 'User-Agent': UA, Accept: 'image/*,*/*;q=0.5' } });
  } catch {
    return 'nicht erreichbar';
  }
  if (!res.ok) return `HTTP ${res.status}`;
  if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) return 'zu groß';
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > MAX_BYTES) return 'zu groß';
  const typ = bildTyp(bytes);
  if (!typ) return 'kein Bild';

  const treffer = (breite?: number, hoehe?: number): LogoTreffer =>
    ({ ...k, bytes, contentType: CONTENT_TYPE[typ], ext: EXT[typ], breite, hoehe });

  if (typ === 'svg') {
    const grund = pruefeSvg(new TextDecoder().decode(bytes));
    return grund ?? treffer();
  }
  const masse = bildMasse(bytes, typ);
  if (!masse || !masse.w || !masse.h) return 'Maße unbekannt';
  const breit = k.art === 'logo' || k.art === 'schema';
  if (breit ? masse.w < 100 || masse.h < 24 : Math.min(masse.w, masse.h) < 64) return `zu klein (${masse.w}×${masse.h})`;
  if (typ === 'png') {
    const h = await pngHelligkeit(bytes).catch(() => null);
    if (h && h.durchsichtig > 0.15 && h.hell > 0.85) return 'weiß auf durchsichtig';
    if (h && (h.durchsichtig > 0.995 || (h.durchsichtig < 0.02 && h.hell > 0.985))) return 'leer';
  }
  return treffer(masse.w, masse.h);
}

// ----------------------------------------------------------------------------
// Suchen
// ----------------------------------------------------------------------------

async function direkteSeite(site: string, deps: LogoDeps): Promise<{ html: string; base: string } | null> {
  try {
    const res = await mitZeit(deps, site, SEITE_MS, { headers: { 'User-Agent': UA, 'Accept-Language': 'de,en;q=0.8', Accept: 'text/html' } });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 2_000_000);
    return { html, base: res.url || site };
  } catch {
    return null;
  }
}

async function firecrawlSeite(site: string, deps: LogoDeps): Promise<{ html: string | null; branding: unknown; base: string } | null> {
  if (!deps.firecrawlKey) return null;
  try {
    const res = await mitZeit(deps, 'https://api.firecrawl.dev/v2/scrape', FIRECRAWL_MS, {
      method: 'POST',
      headers: { Authorization: `Bearer ${deps.firecrawlKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: site, formats: ['branding', 'rawHtml'], onlyMainContent: false, timeout: 25_000 }),
    });
    if (!res.ok) return null;
    const json = await res.json() as { data?: { rawHtml?: unknown; branding?: unknown; metadata?: { sourceURL?: unknown; url?: unknown } } };
    const d = json.data ?? {};
    const base = typeof d.metadata?.url === 'string' ? d.metadata.url : typeof d.metadata?.sourceURL === 'string' ? d.metadata.sourceURL : site;
    return { html: typeof d.rawHtml === 'string' ? d.rawHtml : null, branding: d.branding, base };
  } catch {
    return null;
  }
}

export async function findeLogo(website: string, deps: LogoDeps): Promise<LogoSuche> {
  const domain = normalizeDomain(website);
  const suche: LogoSuche = { website: domain ?? website, treffer: null, geprueft: [], quellen: [] };
  if (!domain) return suche;
  const site = `https://${domain}`;
  const schonGeprueft = new Set<string>();

  const versuche = async (kandidaten: LogoKandidat[]) => {
    for (const k of ordne(kandidaten)) {
      if (suche.treffer || suche.geprueft.length >= MAX_PRUEFUNGEN) return;
      if (schonGeprueft.has(k.url)) continue;
      schonGeprueft.add(k.url);
      const ergebnis = await pruefeBild(k, deps);
      if (typeof ergebnis === 'string') suche.geprueft.push({ url: k.url, art: k.art, grund: ergebnis });
      else suche.treffer = ergebnis;
    }
  };

  const seite = await direkteSeite(site, deps);
  if (seite) {
    suche.quellen.push('seite');
    await versuche(kandidatenAusHtml(seite.html, seite.base));
  }
  if (!suche.treffer) {
    const fc = await firecrawlSeite(site, deps);
    if (fc) {
      suche.quellen.push('firecrawl');
      await versuche([
        ...kandidatenAusBranding(fc.branding, fc.base),
        ...(fc.html ? kandidatenAusHtml(fc.html, fc.base) : []),
      ]);
    }
  }
  return suche;
}

// ----------------------------------------------------------------------------
// Holen und speichern
// ----------------------------------------------------------------------------

export type HolStatus = 'geholt' | 'nichts_gefunden' | 'keine_website' | 'eigenes' | 'aktuell' | 'nicht_gefunden' | 'fehler';
export interface HolErgebnis { status: HolStatus; logo_url?: string | null; check?: Record<string, unknown>; fehler?: string }

type Firma = {
  id: string; owner_id: string; organization_id: string | null; role: string;
  website: string | null; logo_url: string | null; logo_source: string | null; logo_check: { website?: string } | null;
};

/** Spiegel für die Hauptfirma: nur wo noch nichts steht oder unser altes Website-Logo. */
async function spiegeln(db: SupabaseClient, firma: Firma, url: string) {
  if (firma.role !== 'main') return;
  const ziele: [string, string, string][] = [['company_profiles', 'user_id', firma.owner_id]];
  if (firma.organization_id) ziele.push(['organizations', 'id', firma.organization_id]);
  for (const [tabelle, spalte, wert] of ziele) {
    const { data } = await db.from(tabelle).select('logo_url').eq(spalte, wert).maybeSingle();
    if (!data) continue;
    const jetzt = (data as { logo_url: string | null }).logo_url;
    if (jetzt && jetzt !== firma.logo_url) continue;
    await db.from(tabelle).update({ logo_url: url }).eq(spalte, wert);
  }
}

/**
 * Logo einer Firma holen, wenn es noch keins gibt (oder die Website sich
 * geändert hat). `neu` (nur Matchunt) holt immer neu, auch über ein
 * hochgeladenes Logo hinweg.
 */
export async function holeFirmenlogo(
  db: SupabaseClient, companyId: string, deps: LogoDeps & { neu?: boolean },
): Promise<HolErgebnis> {
  const now = deps.now ?? (() => Date.now());
  const { data, error } = await db.from('client_companies')
    .select('id, owner_id, organization_id, role, website, logo_url, logo_source, logo_check')
    .eq('id', companyId).maybeSingle();
  if (error) return { status: 'fehler', fehler: error.message };
  if (!data) return { status: 'nicht_gefunden' };
  const firma = data as Firma;
  const stempel = (check: Record<string, unknown>) =>
    db.from('client_companies').update({ logo_checked_at: new Date(now()).toISOString(), logo_check: check }).eq('id', companyId);

  if (!deps.neu && (firma.logo_source === 'upload' || firma.logo_source === 'removed')) return { status: 'eigenes', logo_url: firma.logo_url };

  let website = firma.website;
  if (!website && firma.role === 'main') {
    const { data: profil } = await db.from('company_profiles').select('website').eq('user_id', firma.owner_id).maybeSingle();
    website = (profil as { website: string | null } | null)?.website ?? null;
  }
  const domain = normalizeDomain(website);
  if (!domain) {
    await stempel({ gefunden: false, grund: 'keine Website' });
    return { status: 'keine_website' };
  }
  if (!deps.neu && firma.logo_source === 'website' && firma.logo_url && normalizeDomain(firma.logo_check?.website) === domain) {
    return { status: 'aktuell', logo_url: firma.logo_url };
  }

  const suche = await findeLogo(domain, deps);
  const check: Record<string, unknown> = {
    website: domain,
    at: new Date(now()).toISOString(),
    quellen: suche.quellen,
    verworfen: suche.geprueft.slice(0, MAX_PRUEFUNGEN),
  };
  if (!suche.treffer) {
    await stempel({ ...check, gefunden: false });
    return { status: 'nichts_gefunden', check };
  }

  const t = suche.treffer;
  const pfad = `firmen/${companyId}/website-${now()}.${t.ext}`;
  const up = await db.storage.from('company-logos').upload(pfad, t.bytes, { contentType: t.contentType, upsert: false });
  if (up.error) {
    await stempel({ ...check, gefunden: false, grund: `Speichern: ${up.error.message}` });
    return { status: 'fehler', fehler: up.error.message, check };
  }
  const url = db.storage.from('company-logos').getPublicUrl(pfad).data.publicUrl;
  Object.assign(check, { gefunden: true, quelle: t.url, art: t.art, breite: t.breite ?? null, hoehe: t.hoehe ?? null });

  let update = db.from('client_companies').update({
    logo_url: url, logo_source: 'website', logo_checked_at: new Date(now()).toISOString(), logo_check: check,
  }).eq('id', companyId);
  // Lädt der Kunde gleichzeitig hoch, gewinnt sein Logo.
  if (!deps.neu) update = update.or('logo_source.is.null,logo_source.eq.website');
  const res = await update.select('id');
  if (res.error) return { status: 'fehler', fehler: res.error.message, check };
  if (!res.data?.length) return { status: 'eigenes' };

  await spiegeln(db, firma, url);
  return { status: 'geholt', logo_url: url, check };
}
