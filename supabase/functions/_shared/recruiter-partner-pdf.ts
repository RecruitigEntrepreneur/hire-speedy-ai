import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import qrcode from 'qrcode-generator';
import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { CONTRACT_FONTS } from './recruiter-contract-fonts.ts';
import { markPathsYDown } from './matchunt-mark.ts';
import { must } from './recruiter-onboarding-service.ts';
import { ownStatus } from './recruiter-partner-service.ts';
import { checkLabel, checkUrl, dayDate, monthYear, TIER_LABEL, type PartnerTier } from './recruiter-partner.ts';

/**
 * Partnerurkunde (PDF, A4 quer) und QR-Code zur Prüfseite. Beides erzeugt der Server,
 * damit der Browser keine eigene QR-Bibliothek braucht. Schrift wie im Vertrag (Noto Sans).
 */

/** QR-Code als Raster; Fehlerkorrektur M reicht für Druck und Folien. */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/** QR-Code als SVG mit weißem Rand (vier Module, wie der Standard es verlangt). */
export function qrSvg(text: string): string {
  const m = qrMatrix(text);
  const n = m.length;
  const quiet = 4;
  let d = '';
  m.forEach((row, r) => row.forEach((dark, c) => { if (dark) d += `M${c + quiet} ${r + quiet}h1v1h-1z`; }));
  const size = n + quiet * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">`
    + `<rect width="${size}" height="${size}" fill="#ffffff"/><path d="${d}" fill="#0a0a0a"/></svg>`;
}

const INK = rgb(0.04, 0.04, 0.04);
const MUTED = rgb(0.42, 0.42, 0.42);
const LINE = rgb(0.894, 0.894, 0.906);
const GOLD = rgb(0.784, 0.635, 0.29);

/** Urkunde für den Headhunter. Gibt die PDF-Bytes zurück. */
export async function generatePartnerCertificate(p: { name: string; company: string; number: string; since: string; tier: PartnerTier; issuedAt: string }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`${TIER_LABEL[p.tier]} · ${p.name}`);
  doc.setAuthor('Matchunt');
  doc.setSubject(`Partnerzertifikat ${p.number}`);
  const fonts: PDFFont[] = [];
  for (const base64 of CONTRACT_FONTS) fonts.push(await doc.embedFont(Uint8Array.from(atob(base64), c => c.charCodeAt(0)), { subset: true }));
  const sets = fonts.map(f => new Set(f.getCharacterSet()));
  // Ein Zeichen, das keine Schrift kennt, wird zu „?“ statt die Urkunde scheitern zu lassen.
  const runs = (text: string) => {
    const out: { font: PDFFont; text: string }[] = [];
    for (const raw of text) {
      const i = sets.findIndex(s => s.has(raw.codePointAt(0)!));
      const font = fonts[i < 0 ? 0 : i];
      const char = i < 0 ? '?' : raw;
      const last = out[out.length - 1];
      if (last && last.font === font) last.text += char; else out.push({ font, text: char });
    }
    return out;
  };
  const width = (text: string, size: number) => runs(text).reduce((sum, r) => sum + r.font.widthOfTextAtSize(r.text, size), 0);
  const page: PDFPage = doc.addPage([841.89, 595.28]);
  const draw = (text: string, x: number, y: number, size: number, color: RGB = INK) => {
    for (const r of runs(text)) { page.drawText(r.text, { x, y, size, font: r.font, color }); x += r.font.widthOfTextAtSize(r.text, size); }
  };
  const W = 841.89, H = 595.28, M = 64;

  page.drawRectangle({ x: 28, y: 28, width: W - 56, height: H - 56, borderColor: LINE, borderWidth: 0.75 });
  // Zeichen oben links, 60 × 36 pt.
  for (const d of markPathsYDown()) page.drawSvgPath(d, { x: M, y: H - 58, scale: 0.06, color: INK });
  draw('Matchunt', M + 72, H - 84, 16);
  const label = 'Partnerzertifikat';
  draw(label, W - M - width(label, 10), H - 80, 10, MUTED);

  page.drawRectangle({ x: M, y: 438, width: 40, height: 2, color: p.tier === 'gold' ? GOLD : INK });
  draw('Matchunt bestätigt', M, 412, 13, MUTED);
  draw(p.name, M, 366, 36);
  if (p.company) draw(p.company, M, 338, 14, MUTED);
  draw(`ist ${TIER_LABEL[p.tier]} seit ${monthYear(p.since)}.`, M, 292, 18);

  draw(`Partnernummer ${p.number}`, M, 150, 10.5, MUTED);
  draw(`Status prüfen: ${checkLabel(p.number)}`, M, 134, 10.5, MUTED);

  // QR-Code unten rechts, 96 pt, auf die Prüfseite.
  const matrix = qrMatrix(checkUrl(p.number));
  const size = 96, cell = size / matrix.length, qx = W - M - size, qy = 118;
  matrix.forEach((row, r) => row.forEach((dark, c) => {
    if (dark) page.drawRectangle({ x: qx + c * cell, y: qy + size - (r + 1) * cell, width: cell + 0.02, height: cell + 0.02, color: INK });
  }));
  const caption = 'Status prüfen';
  draw(caption, qx + (size - width(caption, 9)) / 2, qy - 16, 9, MUTED);

  draw(`Der Status beschreibt eine Vertragsbeziehung. Er begründet keine Anstellung und keine Vertretung von Matchunt. Ausgestellt am ${dayDate(p.issuedAt)}.`, M, 56, 8, MUTED);
  return await doc.save();
}

async function personOf(db: SupabaseClient, userId: string) {
  const { data } = await db.from('profiles').select('full_name,company_name').eq('user_id', userId).maybeSingle();
  return { name: String(data?.full_name ?? '').trim(), company: String(data?.company_name ?? '').trim() };
}

/** Urkunde zum Herunterladen; wird jedes Mal frisch erzeugt und nicht gespeichert. */
export async function partnerCertificate(db: SupabaseClient, user: User, now = () => Date.now()) {
  const row = await ownStatus(db, user.id);
  must(!row.ended_at, 'Dein Partnerstatus ist beendet.', 'conflict');
  const person = await personOf(db, user.id);
  must(person.name, 'Bitte trag zuerst deinen Namen unter „Über dich“ ein.', 'conflict');
  const bytes = await generatePartnerCertificate({ ...person, number: row.partner_number, since: row.granted_at, tier: row.tier, issuedAt: new Date(now()).toISOString() });
  return { file_name: `Matchunt-Partner-${row.partner_number}.pdf`, base64: encodeBase64(bytes) };
}

/** QR-Code zur eigenen Prüfseite, etwa für Visitenkarte und Folien. */
export async function partnerQr(db: SupabaseClient, user: User) {
  const row = await ownStatus(db, user.id);
  must(!row.ended_at, 'Dein Partnerstatus ist beendet.', 'conflict');
  return { svg: qrSvg(checkUrl(row.partner_number)), file_name: `Matchunt-Partner-QR-${row.partner_number}.svg` };
}
