import qrcode from 'qrcode-generator';

/**
 * Das Bild zum LinkedIn-Beitrag (21.10.2026): aus einer festen Vorlage gesetzt,
 * nicht von einer KI gemalt – nur Angaben des Kunden, scharf lesbar, mit dem
 * Buchungslink als QR-Code. Quadrat 1080 × 1080 oder quer 1200 × 627.
 */
export type Vorlage = 'klar' | 'dunkel' | 'akzent';
export type Format = 'quadrat' | 'quer';

export const VORLAGEN: { id: Vorlage; label: string }[] = [
  { id: 'klar', label: 'Klar' },
  { id: 'dunkel', label: 'Dunkel' },
  { id: 'akzent', label: 'Akzent' },
];
export const FORMATE: { id: Format; label: string; w: number; h: number }[] = [
  { id: 'quadrat', label: 'Quadrat', w: 1080, h: 1080 },
  { id: 'quer', label: 'Quer', w: 1200, h: 627 },
];

export interface BildDaten {
  region: string;
  titel: string;
  /** „80.000 – 95.000 € × 13“ oder null */
  gehalt: string | null;
  /** „3 Tage vor Ort“ o. ä. */
  zusatz: string | null;
  vorteile: string[];
  name: string;
  link: string | null;
  partner: boolean;
}

const FARBEN: Record<Vorlage, { grund: string; text: string; leise: string; haken: string; qr: string; linie: string }> = {
  klar: { grund: '#FFFFFF', text: '#0A0A0A', leise: '#6B6B6B', haken: '#059669', qr: '#0A0A0A', linie: '#E5E5E5' },
  dunkel: { grund: '#0A0A0A', text: '#FFFFFF', leise: '#A3A3A3', haken: '#34D399', qr: '#FFFFFF', linie: '#262626' },
  akzent: { grund: '#0A66C2', text: '#FFFFFF', leise: '#CFE3F7', haken: '#FFFFFF', qr: '#FFFFFF', linie: '#3B86D1' },
};

const FONT = 'Inter, "Helvetica Neue", Arial, sans-serif';

/** Bricht Text in Zeilen um, die in `breite` passen (höchstens `max` Zeilen, letzte mit …). */
export function umbrechen(ctx: Pick<CanvasRenderingContext2D, 'measureText'>, text: string, breite: number, max: number): string[] {
  const worte = text.split(/\s+/).filter(Boolean);
  const zeilen: string[] = [];
  let zeile = '';
  for (const w of worte) {
    const probe = zeile ? `${zeile} ${w}` : w;
    if (ctx.measureText(probe).width <= breite || !zeile) zeile = probe;
    else { zeilen.push(zeile); zeile = w; }
  }
  if (zeile) zeilen.push(zeile);
  if (zeilen.length > max) {
    const rest = zeilen.slice(0, max);
    let letzte = rest[max - 1];
    while (letzte.length > 1 && ctx.measureText(`${letzte} …`).width > breite) letzte = letzte.slice(0, -1).trimEnd();
    rest[max - 1] = `${letzte} …`;
    return rest;
  }
  return zeilen;
}

/** Titel ohne „(m/w/d)“ für das Bild; zweite Hälfte nach „–“ in eine eigene Zeile. */
export function bildTitel(titel: string): string[] {
  const ohne = titel.replace(/\s*\((?:m\/w\/d|w\/m\/d|m\/f\/d|d\/m\/w)\)\s*/i, ' ').replace(/\s+/g, ' ').trim();
  return ohne.split(/\s[–-]\s/).map(t => t.trim()).filter(Boolean).slice(0, 2);
}

function zeichneQr(ctx: CanvasRenderingContext2D, link: string, x: number, y: number, groesse: number, farbe: string) {
  const qr = qrcode(0, 'M');
  qr.addData(link);
  qr.make();
  const n = qr.getModuleCount();
  const m = groesse / n;
  ctx.fillStyle = farbe;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(Math.floor(x + c * m), Math.floor(y + r * m), Math.ceil(m), Math.ceil(m));
}

function haken(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, farbe: string) {
  ctx.strokeStyle = farbe;
  ctx.lineWidth = Math.max(3, s / 7);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.55);
  ctx.lineTo(x + s * 0.38, y + s * 0.9);
  ctx.lineTo(x + s, y + s * 0.15);
  ctx.stroke();
}

/** Zeichnet das Bild auf eine Fläche in Originalgröße (Breite × Höhe des Formats). */
export function zeichneBeitragsBild(canvas: HTMLCanvasElement, d: BildDaten, vorlage: Vorlage, format: Format) {
  const f = FORMATE.find(x => x.id === format)!;
  canvas.width = f.w;
  canvas.height = f.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const c = FARBEN[vorlage];
  const quer = format === 'quer';
  const rand = quer ? 64 : 84;
  const breite = f.w - rand * 2;
  ctx.fillStyle = c.grund;
  ctx.fillRect(0, 0, f.w, f.h);
  ctx.textBaseline = 'top';

  // Kopfzeile
  ctx.fillStyle = c.leise;
  ctx.font = `500 ${quer ? 26 : 30}px ${FONT}`;
  ctx.fillText(vorlage === 'akzent' ? `Wir suchen · vertraulich · ${d.region}` : `Vertrauliche Suche · ${d.region}`, rand, rand);

  // Titel
  const titel = bildTitel(d.titel);
  let y = rand + (quer ? 70 : 110);
  ctx.fillStyle = c.text;
  const gross = vorlage === 'akzent' ? (quer ? 76 : 100) : (quer ? 62 : 84);
  ctx.font = `600 ${gross}px ${FONT}`;
  const titelZeilen = umbrechen(ctx, titel[0] ?? d.titel, quer ? breite * 0.62 : breite, 2);
  for (const z of titelZeilen) { ctx.fillText(z, rand, y); y += gross * 1.12; }
  if (titel[1]) {
    ctx.font = `500 ${Math.round(gross * 0.62)}px ${FONT}`;
    for (const z of umbrechen(ctx, titel[1], quer ? breite * 0.62 : breite, 1)) { ctx.fillText(z, rand, y + 4); y += gross * 0.75; }
  }

  // Gehalt und Zusatz
  const unter = [d.gehalt, d.zusatz].filter(Boolean).join(' · ');
  if (unter) {
    y += quer ? 18 : 28;
    ctx.fillStyle = vorlage === 'klar' ? c.text : c.text;
    ctx.globalAlpha = vorlage === 'klar' ? 1 : 0.9;
    ctx.font = `500 ${quer ? 30 : 38}px ${FONT}`;
    ctx.fillText(unter, rand, y);
    ctx.globalAlpha = 1;
    y += quer ? 40 : 50;
  }

  // Vorteile (beim Akzent nur zwei, quer neben dem QR-Code)
  const punkte = d.vorteile.slice(0, vorlage === 'akzent' ? 2 : 3);
  const groessePunkt = quer ? 26 : 34;
  y += quer ? 22 : 46;
  ctx.font = `400 ${groessePunkt}px ${FONT}`;
  for (const p of punkte) {
    const zeilen = umbrechen(ctx, p, (quer ? breite * 0.62 : breite) - groessePunkt * 1.5, 2);
    haken(ctx, rand, y + groessePunkt * 0.12, groessePunkt * 0.7, c.haken);
    ctx.fillStyle = c.text;
    for (const z of zeilen) { ctx.fillText(z, rand + groessePunkt * 1.25, y); y += groessePunkt * 1.3; }
    y += groessePunkt * 0.35;
  }

  // Fuß: Name links, QR-Code rechts
  const qrGroesse = quer ? 170 : 190;
  const fussY = f.h - rand - qrGroesse;
  ctx.strokeStyle = c.linie;
  ctx.lineWidth = 2;
  if (!quer) { ctx.beginPath(); ctx.moveTo(rand, fussY - 36); ctx.lineTo(f.w - rand, fussY - 36); ctx.stroke(); }
  ctx.fillStyle = c.text;
  ctx.font = `600 ${quer ? 32 : 38}px ${FONT}`;
  ctx.fillText(d.name, rand, f.h - rand - (quer ? 92 : 104));
  ctx.fillStyle = c.leise;
  ctx.font = `400 ${quer ? 24 : 28}px ${FONT}`;
  ctx.fillText(d.link ? 'Headhunter · Termin buchen: QR-Code scannen' : 'Headhunter · schreib mir auf LinkedIn', rand, f.h - rand - (quer ? 48 : 54));
  if (d.partner) {
    ctx.font = `500 ${quer ? 20 : 24}px ${FONT}`;
    ctx.fillText('Matchunt Partner', rand, f.h - rand - (quer ? 16 : 18));
  }
  if (d.link) zeichneQr(ctx, d.link, f.w - rand - qrGroesse, quer ? (f.h - qrGroesse) / 2 : fussY, qrGroesse, c.qr);
}

/** Erzeugt das Bild als PNG (für LinkedIn oder zum Herunterladen). */
export async function beitragsBildPng(d: BildDaten, vorlage: Vorlage, format: Format): Promise<Blob> {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try { await (document as Document & { fonts: FontFaceSet }).fonts.load(`600 40px Inter`); } catch { /* System-Schrift reicht */ }
  }
  const canvas = document.createElement('canvas');
  zeichneBeitragsBild(canvas, d, vorlage, format);
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Bild konnte nicht erzeugt werden'))), 'image/png'));
}
