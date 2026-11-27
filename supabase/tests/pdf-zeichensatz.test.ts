import { PDFDocument, StandardFonts } from 'pdf-lib';
import { pdfSicher } from '../functions/_shared/pdf-zeichensatz.ts';

const assert = (v: unknown, m = 'Assertion failed') => { if (!v) throw Error(m); };

/** Der Zeichensatz der PDF-Standardschrift, mit der die Kundenverträge gesetzt werden. */
async function helvetica() {
  const font = (await PDFDocument.create()).embedStandardFont(StandardFonts.Helvetica);
  const set = new Set(font.getCharacterSet());
  return { font, t: (s: unknown) => pdfSicher(s, (cp) => set.has(cp)) };
}

Deno.test('what the font can print stays untouched', async () => {
  const { t } = await helvetica();
  const text = 'Bluewater & Bridge GmbH – „Köln“, 1.000 € · § 8 Abs. 2 ß';
  assert(t(text) === text, t(text));
  assert(t('Zeile 1\nZeile 2') === 'Zeile 1\nZeile 2', 'line breaks survive');
  assert(t(null) === '' && t(undefined) === '' && t(20) === '20');
});

Deno.test('a character outside the font no longer breaks the contract', async () => {
  const { font, t } = await helvetica();
  const faelle: [string, string][] = [
    ['GHQI\u202FGmbH', 'GHQI GmbH'],                    // geschütztes schmales Leerzeichen
    ['GHQI\u200B GmbH\tKG', 'GHQI GmbH KG'],             // Breite-Null-Zeichen, Tabulator
    ['\u0141ukasz Dvo\u0159\u00E1k-\u015Eahin', 'Lukasz Dvor\u00E1k-Sahin'],
    ['Mu\u0308nchen', 'M\u00FCnchen'],                   // zerlegtes ü
    ['Sales \u2192 Head \u2265 5', 'Sales -> Head >= 5'],
    ['\u041C\u043E\u0441\u043A\u0432\u0430 \u{1F680}', '?????? ?'],
  ];
  for (const [roh, soll] of faelle) {
    assert(t(roh) === soll, `${JSON.stringify(roh)} -> ${JSON.stringify(t(roh))}`);
    font.widthOfTextAtSize(t(roh), 10);   // wirft, wenn noch etwas Unkodierbares drin ist
  }
});
