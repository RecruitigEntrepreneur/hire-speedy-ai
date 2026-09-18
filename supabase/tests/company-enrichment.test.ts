import { BUDGET_MS, enrichDomain } from '../functions/_shared/company-enrichment.ts';
import { BLUEWATER, ENGLISH, NOT_FOUND, SOLO } from './fixtures/impressum-pages.ts';

const assert = (v: unknown, msg = 'Assertion failed') => { if (!v) throw Error(msg); };
const eq = (actual: unknown, expected: unknown, msg = '') => {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected);
  assert(a === e, `${msg}\n  ist:  ${a}\n  soll: ${e}`);
};
const ok = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
const page = (markdown: string, json: Record<string, unknown> = {}, statusCode = 200) =>
  ok({ success: true, data: { markdown, json, metadata: { statusCode } } });

type Body = Record<string, unknown>;
function firecrawl(handler: (endpoint: 'map' | 'scrape' | 'ai', body: Body) => Promise<Response>) {
  const calls: { url: string; body: Body }[] = [];
  const fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) as Body : {};
    calls.push({ url, body });
    return handler(url.endsWith('/map') ? 'map' : url.endsWith('/scrape') ? 'scrape' : 'ai', body);
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

Deno.test('reads the impressum via Firecrawl v2, prefers the impressum link and keeps only values printed on the page', async () => {
  const f = firecrawl((endpoint, body) => {
    if (endpoint === 'map') return ok({ success: true, links: [
      { url: 'https://www.bluewater-bridge.de/werte-unternehmenskultur' }, { url: 'https://www.bluewater-bridge.de/about' },
      { url: 'https://www.bluewater-bridge.de/impressum', title: 'Impressum' },
    ] });
    if (body.url === 'https://bluewater-bridge.de') return ok({ success: true, data: {
      markdown: '# Bluewater & Bridge\nPersonalberatung für Finance', links: [],
      json: { company_name: 'Bluewater & Bridge', description: 'Personalberatung für Finance', industry: 'Personalberatung', headquarters: 'Hamburg' },
    } });
    if (body.url === 'https://www.bluewater-bridge.de/impressum') return page(BLUEWATER, {
      legal_name: 'Bluewater & Bridge GmbH', street: 'Adlzreiterstraße 2', postal_code: '80337', city: 'München', country: 'Deutschland',
      registration_number: 'HRB 288632', register_court: 'Amtsgericht München, 80333 München', vat_id: 'DE365690081', ceo_name: 'Marko Benko',
    });
    return page(NOT_FOUND, {}, 404);
  });
  const r = (await enrichDomain('https://www.Bluewater-Bridge.de/kontakt', { fetch: f.fetch, firecrawlKey: 'fc' }))!;
  eq(r.domain, 'bluewater-bridge.de');
  eq(r.impressum, { found: true, url: 'https://www.bluewater-bridge.de/impressum', tried: ['https://www.bluewater-bridge.de/impressum'], dropped: ['country'] });
  // Der Ort kommt aus dem Impressum, nicht aus dem Werbetext der Startseite.
  eq(r.data, {
    name: 'Bluewater & Bridge', description: 'Personalberatung für Finance', industry: 'Personalberatung',
    legal_name: 'Bluewater & Bridge GmbH', street: 'Adlzreiterstraße 2', postal_code: '80337', city: 'München',
    registration_number: 'HRB 288632', register_court: 'Amtsgericht München', vat_id: 'DE365690081', ceo_name: 'Marko Benko',
  });
  eq(r.warnings, []);
  assert(f.calls.every(c => c.url.startsWith('https://api.firecrawl.dev/v2/')), 'nur v2');
  const scrapes = f.calls.filter(c => c.url.endsWith('/scrape'));
  assert(scrapes.length === 2 && scrapes.every(c => (c.body.formats as { type?: string }[]).some(x => x?.type === 'json')), 'JSON-Extraktion als Objekt in formats');
  assert(scrapes.find(c => c.body.url === 'https://www.bluewater-bridge.de/impressum')?.body.onlyMainContent === false, 'Impressum mit ganzer Seite');
  assert(!f.calls.some(c => /werte|about/.test(String(c.body.url))), 'keine Kultur- oder Über-uns-Seite');
  assert(!JSON.stringify(f.calls).includes('288632'), 'keine echte Registernummer in der Anfrage');
});

Deno.test('without an impressum link the page /impressum is read directly and the VAT id is found in the text', async () => {
  const f = firecrawl((endpoint, body) => {
    if (endpoint === 'map') return ok({ success: true, links: [{ url: 'https://weber-personal.de/' }, { url: 'https://weber-personal.de/leistungen' }] });
    if (body.url === 'https://weber-personal.de') return ok({ success: true, data: { markdown: '# Weber Personal', links: ['https://weber-personal.de/kontakt'], json: {} } });
    if (body.url === 'https://weber-personal.de/impressum') return page(SOLO, { legal_name: 'Anna Weber Personalberatung e.K.', street: 'Hauptstraße 5', postal_code: '50667', city: 'Köln', ceo_name: 'Inhaberin: Anna Weber' });
    return page(NOT_FOUND, {}, 404);
  });
  const r = (await enrichDomain('weber-personal.de', { fetch: f.fetch, firecrawlKey: 'fc' }))!;
  eq(r.impressum, { found: true, url: 'https://weber-personal.de/impressum', tried: ['https://weber-personal.de/impressum'], dropped: [] });
  eq([r.data.name, r.data.street, r.data.city, r.data.vat_id, r.data.ceo_name, r.data.registration_number],
    ['Anna Weber Personalberatung e.K.', 'Hauptstraße 5', 'Köln', 'DE123456789', 'Anna Weber', undefined]);
});

Deno.test('Firecrawl errors are reported as warnings and never dressed up as company data', async () => {
  const f = firecrawl(() => Promise.resolve(new Response('{"success":false,"code":"BAD_REQUEST","error":"Bad Request"}', { status: 400 })));
  const r = (await enrichDomain('acme-recruiting.de', { fetch: f.fetch, firecrawlKey: 'fc' }))!;
  eq(r.data, { name: 'Acme-recruiting' });
  eq(r.impressum, { found: false, url: null, tried: ['https://acme-recruiting.de/impressum'], dropped: [] });
  eq(r.warnings.map(w => `${w.step}:${w.status}`).sort(), ['impressum:400', 'seitenkarte:400', 'startseite:400']);
  assert(r.warnings.every(w => (w.detail ?? '').includes('BAD_REQUEST')), 'Grund bleibt sichtbar');
});

Deno.test('a candidate that is no impressum is skipped and the next one is read, at most two pages', async () => {
  const f = firecrawl((endpoint, body) => {
    if (endpoint === 'map') return ok({ success: true, links: ['https://acme-talent.de/de/impressum', 'https://acme-talent.de/en/imprint', 'https://acme-talent.de/legal-notice'].map(url => ({ url })) });
    if (body.url === 'https://acme-talent.de/de/impressum') return page(NOT_FOUND, {}, 404);
    if (body.url === 'https://acme-talent.de/en/imprint') return page(ENGLISH, {
      legal_name: 'Acme Talent GmbH', street: 'Hauptstraße 5', postal_code: '50667', city: 'Cologne',
      registration_number: 'HRB 98765', register_court: 'Local court Cologne', vat_id: 'DE 987 654 321', ceo_name: 'Max Beispiel and Erika Muster',
    });
    return ok({ success: true, data: { markdown: '# Acme Talent', json: {} } });
  });
  const r = (await enrichDomain('acme-talent.de', { fetch: f.fetch, firecrawlKey: 'fc' }))!;
  eq(r.impressum, { found: true, url: 'https://acme-talent.de/en/imprint', tried: ['https://acme-talent.de/de/impressum', 'https://acme-talent.de/en/imprint'], dropped: [] });
  eq([r.data.name, r.data.registration_number, r.data.register_court, r.data.vat_id, r.data.ceo_name],
    ['Acme Talent GmbH', 'HRB 98765', 'Local court Cologne', 'DE987654321', 'Max Beispiel, Erika Muster']);
  assert(!f.calls.some(c => String(c.body.url).includes('legal-notice')), 'höchstens zwei Seiten');
});

Deno.test('an error page or a plain contact page is no impressum, even when the address on it is real', async () => {
  const footer = 'Kontakt-Only GmbH · Beispielweg 1 · 10115 Berlin';
  const json = { legal_name: 'Kontakt-Only GmbH', street: 'Beispielweg 1', postal_code: '10115', city: 'Berlin' };
  const f = firecrawl((endpoint, body) => {
    if (endpoint === 'map') return ok({ success: true, links: [{ url: 'https://kontakt-only.de/impressum' }, { url: 'https://kontakt-only.de/imprint' }] });
    if (body.url === 'https://kontakt-only.de/impressum') return page(`# Seite nicht gefunden\n\n${footer} · Geschäftsführer: Max Kontakt\n\n[Impressum](/impressum)`, json, 404);
    if (body.url === 'https://kontakt-only.de/imprint') return page(`# Über uns\n\nWir sind ein Team aus Berlin.\n\n${footer}`, json, 200);
    return ok({ success: true, data: { markdown: '# Kontakt-Only', json: {} } });
  });
  const r = (await enrichDomain('kontakt-only.de', { fetch: f.fetch, firecrawlKey: 'fc' }))!;
  eq(r.impressum, { found: false, url: null, tried: ['https://kontakt-only.de/impressum', 'https://kontakt-only.de/imprint'], dropped: [] });
  eq([r.data.legal_name, r.data.street], [undefined, undefined]);
});

Deno.test('no impressum page is started when the time budget is nearly used up', async () => {
  let clock = 0;
  const f = firecrawl(endpoint => {
    if (endpoint === 'map') { clock += BUDGET_MS - 5_000; return ok({ success: true, links: [{ url: 'https://slow-site.de/impressum' }] }); }
    return ok({ success: true, data: { markdown: '# Slow', json: {} } });
  });
  const r = (await enrichDomain('slow-site.de', { fetch: f.fetch, firecrawlKey: 'fc', now: () => clock }))!;
  eq(r.impressum.tried, []);
  assert(r.warnings.some(w => w.step === 'impressum' && /Zeitbudget/.test(w.detail ?? '')), JSON.stringify(r.warnings));
  assert(!f.calls.some(c => c.body.url === 'https://slow-site.de/impressum'));
});

Deno.test('industry and description may come from the AI, the impressum never does', async () => {
  const f = firecrawl((endpoint) => {
    if (endpoint === 'ai') return ok({ choices: [{ message: { content: '{"industry":"Personalberatung","description":"Findet Finanzprofis.","technologies":["ATS",3]}' } }] });
    if (endpoint === 'map') return ok({ success: true, links: [] });
    return ok({ success: true, data: { markdown: '# Finanzprofis finden', json: { company_name: 'Finance Hunters' }, metadata: { statusCode: 404 } } });
  });
  const r = (await enrichDomain('finance-hunters.de', { fetch: f.fetch, firecrawlKey: 'fc', lovableKey: 'lk' }))!;
  eq(r.data, { name: 'Finance Hunters', industry: 'Personalberatung', description: 'Findet Finanzprofis.', technologies: ['ATS'] });
  eq(r.impressum.found, false);
});

Deno.test('an unusable domain returns nothing and calls nobody', async () => {
  const f = firecrawl(() => ok({}));
  eq(await enrichDomain('localhost', { fetch: f.fetch, firecrawlKey: 'fc' }), null);
  eq(f.calls.length, 0);
});
