/**
 * Impressum-Seiten, wie Firecrawl sie als Markdown liefert.
 *
 * BLUEWATER entspricht der echten Seite bluewater-bridge.de/impressum (Webflow,
 * Stand 16.09.2026): Zeilenumbrüche als Backslash, unsichtbare Verbinder U+200D
 * zwischen den Blöcken, Mailadresse als Link. Die anderen Seiten sind erfunden.
 */

export const BLUEWATER = [
  '# Impressum',
  '',
  'Angaben gemäß § 5 TMG:',
  '',
  'Bluewater & Bridge GmbH\\',
  'Adlzreiterstraße 2\\',
  '80337 München',
  '',
  '\u200D',
  '',
  'Handelsregister: HRB 288632\\',
  'Registergericht: Amtsgericht München, 80333 München\\',
  'USt-IdNr.: DE365690081',
  '',
  '\u200D',
  '',
  '**Vertreten durch den Geschäftsführer:**\\',
  'Marko Benko',
  '',
  'Kontakt:\\',
  'Telefon: +49 89 1234567\\',
  'E-Mail: [info@bluewater-bridge.de](mailto:info@bluewater-bridge.de)',
  '',
  '## Haftung für Inhalte',
  '',
  'Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten verantwortlich.',
].join('\n');

export const SOLO = [
  '# Impressum',
  'Angaben gemäß § 5 DDG',
  '',
  'Anna Weber Personalberatung e.K.  ',
  'Hauptstr. 5  ',
  '50667 Köln',
  '',
  'Inhaberin: Anna Weber',
  '',
  'Umsatzsteuer-Identifikationsnummer gemäß § 27 a UStG: DE 123 456 789',
  '',
  'Bankverbindung: IBAN DE89 3704 0044 0532 0130 00',
].join('\n');

export const ENGLISH = [
  '# Imprint',
  'Information according to § 5 DDG',
  '',
  'Acme Talent GmbH',
  'Hauptstraße 5',
  '50667 Cologne',
  '',
  'Commercial register: HRB 98765, Local court Cologne',
  'VAT ID: DE 987 654 321',
  'Managing directors: Max Beispiel and Erika Muster',
].join('\n');

export const NOT_FOUND = '# Seite nicht gefunden\n\nDiese Seite gibt es nicht.\n\n[Startseite](/) · [Impressum](/impressum) · [Datenschutz](/datenschutz)';

export const CULTURE = '# Werte & Unternehmenskultur\n\nWir leben Vertrauen, Offenheit und echte Partnerschaft mit unseren Kunden in München.';
