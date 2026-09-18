import { canon, cleanRegistration, cleanVatId, looksLikeImpressum, pageText, rankImpressumLinks, urlKey, validateImpressum } from '../functions/_shared/impressum.ts';
import { BLUEWATER, CULTURE, ENGLISH, NOT_FOUND, SOLO } from './fixtures/impressum-pages.ts';

const assert = (v: unknown, msg = 'Assertion failed') => { if (!v) throw Error(msg); };
const eq = (actual: unknown, expected: unknown, msg = '') => {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected);
  assert(a === e, `${msg}\n  ist:  ${a}\n  soll: ${e}`);
};

Deno.test('page text drops markdown, invisible joiners and link targets', () => {
  const text = pageText(BLUEWATER);
  assert(text.includes('Bluewater & Bridge GmbH\nAdlzreiterstraße 2\n80337 München\nHandelsregister: HRB 288632'), text);
  assert(text.includes('E-Mail: info@bluewater-bridge.de') && !/[\u200D*\\]/.test(text), text);
  eq(canon('Musterstr. 1'), canon('Musterstraße 1'));
  eq(canon('München'), 'muenchen');
});

Deno.test('identifiers get their fixed form or nothing', () => {
  eq(['DE 365 690 081', 'USt-IdNr.: DE365690081', 'ATU 12345678', 'CHE-123.456.789 MWST', 'FR12345678901', 'DE12345678', '143/123/12345', ''].map(cleanVatId),
    ['DE365690081', 'DE365690081', 'ATU12345678', 'CHE-123.456.789', 'FR12345678901', null, null, null]);
  eq(['HRB 288632', 'Handelsregister: HRB 288632, Amtsgericht München', 'HRB 12345 B', 'HRB 288632 Amtsgericht München', 'HRB 288632 AG München', 'hrb 5', 'FN 123456 a', 'CHE-123.456.789', 'Amtsgericht München'].map(cleanRegistration),
    ['HRB 288632', 'HRB 288632', 'HRB 12345 B', 'HRB 288632', 'HRB 288632', 'HRB 5', 'FN 123456a', 'CHE-123.456.789', null]);
});

Deno.test('the bluewater impressum yields exactly what is printed, also when the extraction reformats', () => {
  const exact = validateImpressum({
    legal_name: 'Bluewater & Bridge GmbH', street: 'Adlzreiterstraße 2', postal_code: '80337', city: 'München',
    registration_number: 'HRB 288632', register_court: 'Amtsgericht München, 80333 München', vat_id: 'DE365690081', ceo_name: 'Geschäftsführer: Marko Benko',
  }, BLUEWATER);
  eq(exact, { fields: {
    legal_name: 'Bluewater & Bridge GmbH', street: 'Adlzreiterstraße 2', postal_code: '80337', city: 'München',
    registration_number: 'HRB 288632', register_court: 'Amtsgericht München', vat_id: 'DE365690081', ceo_name: 'Marko Benko',
  }, dropped: [] });
  const reformatted = validateImpressum({ street: 'Adlzreiterstr. 2', postal_code: 'D-80337', city: '80337 München', vat_id: 'DE 365 690 081' }, BLUEWATER);
  eq(reformatted.fields, { street: 'Adlzreiterstr. 2', postal_code: '80337', city: 'München', vat_id: 'DE365690081', registration_number: 'HRB 288632' });
  eq(reformatted.dropped, []);
});

Deno.test('invented, foreign or truncated values are dropped and reported; unique identifiers come from the text', () => {
  const invented = validateImpressum({
    legal_name: 'Muster GmbH', street: 'Musterstraße 1', postal_code: '12345', city: 'Hamburg', country: 'Deutschland',
    registration_number: 'HRB 12345', register_court: 'Amtsgericht Hamburg', vat_id: 'DE123456789', ceo_name: 'Max Mustermann',
  }, BLUEWATER);
  eq(invented.dropped, ['legal_name', 'street', 'postal_code', 'city', 'country', 'registration_number', 'register_court', 'vat_id', 'ceo_name']);
  eq(invented.fields, { vat_id: 'DE365690081', registration_number: 'HRB 288632' });
  const truncated = validateImpressum({ registration_number: 'HRB 2886', vat_id: 'DE36569008' }, BLUEWATER);
  eq(truncated, { fields: { vat_id: 'DE365690081', registration_number: 'HRB 288632' }, dropped: ['registration_number', 'vat_id'] });
  // Zwei Registernummern oder nur eine IBAN: dann lieber nichts.
  eq(validateImpressum({}, 'Impressum\nHandelsregister: HRB 111\nSchwesterfirma: HRB 222\nIBAN DE89 3704 0044 0532 0130 00'), { fields: {}, dropped: [] });
});

Deno.test('sole traders and english pages: owner and several directors are checked one by one', () => {
  const solo = validateImpressum({ legal_name: 'Anna Weber Personalberatung e.K.', street: 'Hauptstraße 5', postal_code: '50667', city: 'Köln', ceo_name: 'Inhaberin: Anna Weber' }, SOLO);
  eq(solo, { fields: { legal_name: 'Anna Weber Personalberatung e.K.', street: 'Hauptstraße 5', postal_code: '50667', city: 'Köln', ceo_name: 'Anna Weber', vat_id: 'DE123456789' }, dropped: [] });
  const english = validateImpressum({ legal_name: 'Acme Talent GmbH', ceo_name: 'Max Beispiel and Erika Muster and Hans Erfunden', vat_id: 'DE987654321' }, ENGLISH);
  eq(english.fields, { legal_name: 'Acme Talent GmbH', vat_id: 'DE987654321', ceo_name: 'Max Beispiel, Erika Muster', registration_number: 'HRB 98765' });
});

Deno.test('an impressum needs at least two typical markers', () => {
  eq([BLUEWATER, SOLO, ENGLISH, NOT_FOUND, CULTURE, ''].map(looksLikeImpressum), [true, true, true, false, false, false]);
});

Deno.test('impressum links win over about and culture pages; foreign hosts and files are ignored', () => {
  const links = [
    'https://www.bluewater-bridge.de/werte-unternehmenskultur', 'https://www.bluewater-bridge.de/about',
    { url: 'https://www.bluewater-bridge.de/impressum', title: 'Impressum' }, 'https://www.bluewater-bridge.de/en/imprint',
    'https://evil.example/impressum', 'https://www.bluewater-bridge.de/files/impressum.pdf', 'https://karriere.bluewater-bridge.de/impressum',
    'https://bluewater-bridge.de/impressum/', 'mailto:info@bluewater-bridge.de', 'kein link', null, { url: 42 },
  ];
  eq(rankImpressumLinks(links, 'bluewater-bridge.de', 5), ['https://www.bluewater-bridge.de/impressum', 'https://karriere.bluewater-bridge.de/impressum', 'https://www.bluewater-bridge.de/en/imprint']);
  eq(rankImpressumLinks(links, 'bluewater-bridge.de').length, 2);
  eq(rankImpressumLinks(['https://www.bluewater-bridge.de/werte-unternehmenskultur'], 'bluewater-bridge.de'), []);
  eq(rankImpressumLinks(undefined, 'bluewater-bridge.de'), []);
  eq(urlKey('https://www.Bluewater-Bridge.de/impressum/'), urlKey('https://bluewater-bridge.de/impressum'));
});
