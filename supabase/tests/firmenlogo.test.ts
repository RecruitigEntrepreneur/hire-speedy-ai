import {
  bildMasse, bildTyp, findeLogo, kandidatenAusBranding, kandidatenAusHtml, ordne, pngHelligkeit, pruefeBild, pruefeSvg,
} from '../functions/_shared/firmenlogo.ts';

const assert = (v: unknown, msg = 'Assertion failed') => { if (!v) throw Error(msg); };
const eq = (actual: unknown, expected: unknown, msg = '') => {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected);
  assert(a === e, `${msg}\n  ist:  ${a}\n  soll: ${e}`);
};

/** Kleines RGBA-PNG (Prüfsummen egal, der Decoder liest sie nicht). */
async function png(w: number, h: number, pixel: (x: number, y: number) => [number, number, number, number]): Promise<Uint8Array> {
  const zeilen = new Uint8Array(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    zeilen[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) zeilen.set(pixel(x, y), y * (w * 4 + 1) + 1 + x * 4);
  }
  const stream = new Blob([zeilen]).stream().pipeThrough(new CompressionStream('deflate'));
  const idat = new Uint8Array(await new Response(stream).arrayBuffer());
  const chunk = (typ: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    new DataView(out.buffer).setUint32(0, data.length);
    out.set([...typ].map(c => c.charCodeAt(0)), 4);
    out.set(data, 8);
    return out;
  };
  const ihdr = new Uint8Array(13);
  new DataView(ihdr.buffer).setUint32(0, w);
  new DataView(ihdr.buffer).setUint32(4, h);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const teile = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array())];
  const out = new Uint8Array(teile.reduce((s, t) => s + t.length, 0));
  let o = 0;
  for (const t of teile) { out.set(t, o); o += t.length; }
  return out;
}

const inKreis = (x: number, y: number, n: number) => (x - n / 2) ** 2 + (y - n / 2) ** 2 < (n / 3) ** 2;
const SCHWARZ_AUF_DURCHSICHTIG = (n: number) => png(n, n, (x, y) => inKreis(x, y, n) ? [10, 10, 10, 255] : [0, 0, 0, 0]);
const WEISS_AUF_DURCHSICHTIG = (n: number) => png(n, n, (x, y) => inKreis(x, y, n) ? [255, 255, 255, 255] : [0, 0, 0, 0]);
const ROT_MIT_WEISS = (n: number) => png(n, n, (x, y) => inKreis(x, y, n) ? [255, 255, 255, 255] : [180, 40, 40, 255]);

const bildFetch = (bilder: Record<string, Uint8Array | string>, seiten: Record<string, string> = {}) => {
  const aufrufe: string[] = [];
  const f = ((input: string | URL | Request) => {
    const url = String(input);
    aufrufe.push(url);
    if (seiten[url] !== undefined) return Promise.resolve(new Response(seiten[url], { status: 200, headers: { 'content-type': 'text/html' } }));
    const b = bilder[url];
    if (b === undefined) return Promise.resolve(new Response('nicht da', { status: 404 }));
    return Promise.resolve(new Response(typeof b === 'string' ? b : b, { status: 200 }));
  }) as typeof fetch;
  return { fetch: f, aufrufe };
};

Deno.test('kandidatenAusHtml: App-Symbol, SVG-Symbol, JSON-LD, Logo-Bild, Standardadressen; mask-icon nicht', () => {
  const html = `<html><head>
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-180.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/fav-32.png">
    <link rel="icon" href="https://cdn.example.com/icon.svg">
    <link rel="mask-icon" href="/safari.svg" color="#000">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","logo":{"@type":"ImageObject","url":"https://example.com/schema-logo.png"}}</script>
    </head><body><header><img class="site-logo" src="/img/logo-white.png" alt="Firma"></header></body></html>`;
  const k = kandidatenAusHtml(html, 'https://www.example.com/');
  eq(k.map(x => `${x.art}:${x.url}`), [
    'app-symbol:https://www.example.com/apple-180.png',
    'favicon:https://www.example.com/fav-32.png',
    'symbol:https://cdn.example.com/icon.svg',
    'schema:https://example.com/schema-logo.png',
    'logo:https://www.example.com/img/logo-white.png',
    'app-symbol:https://www.example.com/apple-touch-icon.png',
    'favicon:https://www.example.com/favicon.ico',
  ]);
});

Deno.test('ordne: App-Symbol zuerst, größtes zuerst, Baukasten-Standard raus, Doppelte raus', () => {
  const o = ordne([
    { url: 'https://a.de/logo.png', art: 'logo', groesse: 0 },
    { url: 'https://a.de/fav.ico', art: 'favicon', groesse: 0 },
    { url: 'https://a.de/apple.png', art: 'app-symbol', groesse: 1 },
    { url: 'https://a.de/apple-512.png', art: 'app-symbol', groesse: 512 },
    { url: 'https://assets.website-files.com/img/webclip.png', art: 'app-symbol', groesse: 256 },
    { url: 'https://a.de/logo.png', art: 'schema', groesse: 0 },
  ]);
  eq(o.map(x => x.url), ['https://a.de/apple-512.png', 'https://a.de/apple.png', 'https://a.de/logo.png', 'https://a.de/fav.ico']);
  eq(o[2].art, 'schema', 'Doppelt: die bessere Art bleibt');
});

Deno.test('kandidatenAusBranding liest Firecrawl-Felder', () => {
  const k = kandidatenAusBranding({ logo: '/logo.svg', images: { logo: 'https://x.de/l.png', favicon: '/f.ico' } }, 'https://x.de/');
  eq(k.map(x => `${x.art}:${x.url}`), ['logo:https://x.de/logo.svg', 'logo:https://x.de/l.png', 'favicon:https://x.de/f.ico']);
});

Deno.test('PNG: Maße und Helligkeit', async () => {
  const schwarz = await SCHWARZ_AUF_DURCHSICHTIG(128);
  eq(bildTyp(schwarz), 'png');
  eq(bildMasse(schwarz, 'png'), { w: 128, h: 128 });
  const hs = await pngHelligkeit(schwarz);
  assert(hs && hs.durchsichtig > 0.4 && hs.hell < 0.05, `schwarz: ${JSON.stringify(hs)}`);
  const hw = await pngHelligkeit(await WEISS_AUF_DURCHSICHTIG(128));
  assert(hw && hw.durchsichtig > 0.4 && hw.hell > 0.95, `weiß: ${JSON.stringify(hw)}`);
});

Deno.test('pruefeBild: weiß auf durchsichtig raus, zu klein raus, schwarz und rot mit weiß rein', async () => {
  const { fetch } = bildFetch({
    'https://a.de/weiss.png': await WEISS_AUF_DURCHSICHTIG(180),
    'https://a.de/klein.png': await SCHWARZ_AUF_DURCHSICHTIG(32),
    'https://a.de/schwarz.png': await SCHWARZ_AUF_DURCHSICHTIG(180),
    'https://a.de/rot.png': await ROT_MIT_WEISS(192),
    'https://a.de/text.png': 'kein bild',
  });
  eq(await pruefeBild({ url: 'https://a.de/weiss.png', art: 'app-symbol', groesse: 180 }, { fetch }), 'weiß auf durchsichtig');
  eq(await pruefeBild({ url: 'https://a.de/klein.png', art: 'favicon', groesse: 32 }, { fetch }), 'zu klein (32×32)');
  eq(await pruefeBild({ url: 'https://a.de/text.png', art: 'favicon', groesse: 0 }, { fetch }), 'kein Bild');
  eq(await pruefeBild({ url: 'https://a.de/fehlt.png', art: 'favicon', groesse: 0 }, { fetch }), 'HTTP 404');
  const ok = await pruefeBild({ url: 'https://a.de/schwarz.png', art: 'app-symbol', groesse: 180 }, { fetch });
  assert(typeof ok !== 'string' && ok.ext === 'png' && ok.breite === 180, `schwarz: ${typeof ok === 'string' ? ok : ok.ext}`);
  const rot = await pruefeBild({ url: 'https://a.de/rot.png', art: 'symbol', groesse: 192 }, { fetch });
  assert(typeof rot !== 'string', `rot: ${rot}`);
});

Deno.test('pruefeSvg: Skript, fremde Inhalte und nur Weiß raus', () => {
  eq(pruefeSvg('<svg viewBox="0 0 10 10"><path fill="#1e3a5f" d="M0 0h10v10z"/></svg>'), null);
  eq(pruefeSvg('<svg><path d="M0 0h10v10z"/></svg>'), null, 'ohne Farbe ist schwarz');
  eq(pruefeSvg('<svg><path fill="#FFF" d="M0"/><path style="fill:white" d="M1"/></svg>'), 'weiß');
  eq(pruefeSvg('<svg onload="alert(1)"><path d="M0"/></svg>'), 'SVG mit Skript');
  eq(pruefeSvg('<svg><script>alert(1)</script></svg>'), 'SVG mit Skript');
  eq(pruefeSvg('<svg><image href="https://evil.example/x.png"/></svg>'), 'SVG lädt fremde Inhalte');
});

Deno.test('findeLogo: nimmt das App-Symbol, überspringt das weiße Kopf-Logo, fragt Firecrawl nicht', async () => {
  const seite = `<head><link rel="apple-touch-icon" href="https://cdn.x.de/BB256.png"></head>
    <body><img src="https://cdn.x.de/logo-white.png" class="logo"></body>`;
  const { fetch, aufrufe } = bildFetch({
    'https://cdn.x.de/BB256.png': await SCHWARZ_AUF_DURCHSICHTIG(256),
    'https://cdn.x.de/logo-white.png': await WEISS_AUF_DURCHSICHTIG(400),
  }, { 'https://bluewater.example': seite });
  const s = await findeLogo('www.bluewater.example', { fetch, firecrawlKey: 'fc' });
  eq(s.treffer?.url, 'https://cdn.x.de/BB256.png');
  eq(s.quellen, ['seite']);
  assert(!aufrufe.some(u => u.includes('firecrawl')), 'Firecrawl wurde trotzdem gefragt');
});

Deno.test('findeLogo: ohne brauchbares Bild auf der Seite hilft Firecrawl', async () => {
  const seite = `<head><link rel="icon" sizes="16x16" href="/f16.png"></head><body><img class="logo" src="/weiss.png"></body>`;
  const bilder: Record<string, Uint8Array | string> = {
    'https://x.de/f16.png': await SCHWARZ_AUF_DURCHSICHTIG(16),
    'https://x.de/weiss.png': await WEISS_AUF_DURCHSICHTIG(300),
    'https://cdn.x.de/brand-logo.png': await png(240, 60, (x) => x < 120 ? [20, 60, 120, 255] : [0, 0, 0, 0]),
  };
  const basis = bildFetch(bilder, { 'https://x.de': seite });
  const firecrawlBodies: unknown[] = [];
  const fetch = ((input: string | URL | Request, init?: RequestInit) => {
    if (String(input).includes('api.firecrawl.dev')) {
      firecrawlBodies.push(JSON.parse(String(init?.body)));
      return Promise.resolve(new Response(JSON.stringify({ success: true, data: { branding: { logo: 'https://cdn.x.de/brand-logo.png' }, metadata: { url: 'https://x.de/' } } })));
    }
    return basis.fetch(input as string);
  }) as typeof globalThis.fetch;
  const s = await findeLogo('x.de', { fetch, firecrawlKey: 'fc' });
  eq(s.treffer?.url, 'https://cdn.x.de/brand-logo.png');
  eq(s.quellen, ['seite', 'firecrawl']);
  eq((firecrawlBodies[0] as { formats: string[] }).formats, ['branding', 'rawHtml']);
  eq(s.geprueft.map(g => g.grund).includes('weiß auf durchsichtig'), true);
});

Deno.test('findeLogo: ungültige Website ohne Abruf', async () => {
  const { fetch, aufrufe } = bildFetch({});
  const s = await findeLogo('kein domain', { fetch });
  eq(s.treffer, null);
  eq(aufrufe.length, 0);
});
