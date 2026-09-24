/**
 * Text aus einer Word-Datei (.docx) lesen -- ohne Bibliothek.
 *
 * Eine .docx ist ein ZIP-Archiv; der Text steht in `word/document.xml`.
 * Das Archiv wird ueber sein Zentralverzeichnis gelesen (die lokalen Kopfzeilen
 * duerfen die Groessen weglassen), der Eintrag mit dem Browser-eigenen
 * `DecompressionStream('deflate-raw')` entpackt, und aus dem XML bleiben nur
 * Absaetze und Tabulatoren uebrig. Formatierung braucht der Parser nicht --
 * er bekommt denselben Klartext wie beim Einfuegen.
 *
 * Alte .doc-Dateien (Binaerformat) werden bewusst nicht unterstuetzt.
 */

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

export class DocxError extends Error {}

export function isDocx(file: File): boolean {
  return (
    /\.docx$/i.test(file.name) ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}

export async function docxToText(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  // Ende des Zentralverzeichnisses: steht in den letzten 64 KB + 22 Bytes.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (view.getUint32(i, true) === SIG_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new DocxError('Die Datei ist keine gültige Word-Datei.');

  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);

  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== SIG_CENTRAL) break;
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen));

    if (name === 'word/document.xml') {
      if (view.getUint32(localOffset, true) !== SIG_LOCAL) {
        throw new DocxError('Die Word-Datei ist beschädigt.');
      }
      const lName = view.getUint16(localOffset + 26, true);
      const lExtra = view.getUint16(localOffset + 28, true);
      const start = localOffset + 30 + lName + lExtra;
      const raw = buf.subarray(start, start + compSize);
      const xml = method === 0 ? new TextDecoder().decode(raw) : await inflate(raw);
      return xmlToText(xml);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new DocxError('In der Word-Datei steht kein Text.');
}

async function inflate(data: Uint8Array): Promise<string> {
  if (typeof DecompressionStream === 'undefined') {
    throw new DocxError('Ihr Browser kann Word-Dateien nicht öffnen. Bitte als PDF oder Text.');
  }
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return await new Response(stream).text();
}

function xmlToText(xml: string): string {
  return xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
