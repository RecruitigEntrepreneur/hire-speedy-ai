import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

export type PdfRow = { label: string; value: string };
export type PdfStation = { title: string; company: string; period: string; description?: string | null };

export interface ClientCandidatePdfInput {
  code: string;
  role: string;
  jobTitle: string;
  anonym: boolean;
  facts: PdfRow[];
  gespraech: PdfRow[];
  werdegang: PdfStation[];
  ausbildung: string[];
  skills: string[];
  sprachen: string[];
}

const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.42, 0.42, 0.42);
const LINE = rgb(0.85, 0.85, 0.85);
const M = 50;
const W = 595.28;
const H = 841.89;

/**
 * Lebenslauf für Kunden als PDF -- im Browser aus genau den Daten erzeugt, die der
 * Kunde auf der Seite sieht (anonymisierte Ansichten). Ohne KI-Einschätzung,
 * ohne Team-Notizen. Vor der Interview-Zusage ohne Namen und Firmen.
 */
export async function buildClientCandidatePdf(input: ClientCandidatePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle(`Kandidatenprofil ${input.code}`);
  doc.setCreator('Matchunt');

  let page = doc.addPage([W, H]);
  let y = H - M;

  // Zeichen ohne Glyphe in der Standardschrift (etwa Emojis) weglassen statt abzubrechen.
  const safe = (font: PDFFont, text: string) =>
    Array.from(text.replace(/\s+/g, ' ')).map((ch) => { try { font.widthOfTextAtSize(ch, 10); return ch; } catch { return ''; } }).join('').replace(/ +/g, ' ').trim();

  const ensure = (needed: number) => {
    if (y - needed < M) {
      page = doc.addPage([W, H]);
      y = H - M;
    }
  };

  const wrap = (text: string, font: PDFFont, size: number, width: number) => {
    const words = safe(font, text).split(' ');
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) > width && line) { lines.push(line); line = w; } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  };

  const text = (t: string, opts: { x?: number; size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; width?: number; gap?: number } = {}) => {
    const size = opts.size ?? 10;
    const font = opts.font ?? regular;
    const x = opts.x ?? M;
    for (const l of wrap(t, font, size, opts.width ?? W - M - x)) {
      ensure(size + 4);
      (page as PDFPage).drawText(l, { x, y: y - size, size, font, color: opts.color ?? INK });
      y -= size + (opts.gap ?? 4);
    }
  };

  // Überschrift nie allein am Seitenende: Platz für sie und die erste Zeile.
  const section = (title: string) => {
    ensure(70);
    y -= 14;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: LINE });
    y -= 14;
    text(title.toUpperCase(), { size: 8.5, font: bold, color: MUTED, gap: 8 });
  };

  const rows = (list: PdfRow[]) => {
    for (const r of list) {
      const start = y;
      text(r.label, { size: 9, color: MUTED, width: 120 });
      const afterLabel = y;
      y = start;
      text(r.value, { x: M + 135, size: 10 });
      y = Math.min(y, afterLabel) - 2;
    }
  };

  text('Matchunt · Kandidatenprofil', { size: 9, color: MUTED, gap: 10 });
  text(input.code, { size: 20, font: bold, gap: 6 });
  text(`${input.role} · für ${input.jobTitle}`, { size: 11, color: MUTED, gap: 6 });
  if (input.anonym) text('Anonymes Profil: Name, Kontakt und Firmen nach Interview-Zusage.', { size: 9, color: MUTED });

  if (input.facts.length) { section('Eckdaten'); rows(input.facts); }
  if (input.gespraech.length) { section('Aus dem Gespräch mit dem Headhunter'); rows(input.gespraech); }

  if (input.werdegang.length) {
    section('Werdegang');
    for (const s of input.werdegang) {
      ensure(30);
      text(s.title, { size: 10.5, font: bold, gap: 2 });
      text(`${s.company} · ${s.period}`, { size: 9, color: MUTED, gap: 4 });
      if (s.description) text(s.description, { size: 9.5, gap: 3 });
      y -= 6;
    }
  }

  if (input.ausbildung.length) { section('Ausbildung'); input.ausbildung.forEach((a) => text(a, { size: 10 })); }
  if (input.skills.length) { section('Skills'); text(input.skills.join(' · '), { size: 10 }); }
  if (input.sprachen.length) { section('Sprachen'); text(input.sprachen.join(' · '), { size: 10 }); }

  const stand = new Date().toLocaleDateString('de-DE');
  doc.getPages().forEach((p, i, all) => {
    p.drawText(safe(regular, `Stand ${stand} · Seite ${i + 1} von ${all.length} · vertraulich, nur zur internen Verwendung`), { x: M, y: 28, size: 8, font: regular, color: MUTED });
  });
  return doc.save();
}

export function downloadPdf(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
