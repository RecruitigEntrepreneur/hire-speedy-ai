/**
 * Bild fürs Ticket: Schwärzungen einbrennen, Ausschnitte der Rahmen schneiden.
 *
 * Alles passiert im Browser, bevor etwas gesendet wird — geschwärzte Stellen
 * verlassen den Rechner des Nutzers nie. Die Ausschnitte bekommt die KI
 * (Entscheidung 19.10.: nur markierte Stellen, nie das ganze Bild).
 */
import type { Screenshot } from './capture';

/** Anteil am Bild (0..1). */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const CROP_PADDING_CSS = 16;
const CROP_MAX_WIDTH = 1000;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Bild konnte nicht geladen werden.'));
    img.src = src;
  });
}

export async function composeImages(
  shot: Screenshot,
  blackouts: Box[],
  marks: Box[],
): Promise<{ image: string; crops: string[] }> {
  const img = await loadImage(shot.dataUrl);
  const W = img.naturalWidth;
  const H = img.naturalHeight;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { image: shot.dataUrl, crops: [] };
  ctx.drawImage(img, 0, 0);
  ctx.fillStyle = '#000';
  for (const b of blackouts) ctx.fillRect(b.x * W, b.y * H, b.w * W, b.h * H);
  const image = blackouts.length ? canvas.toDataURL('image/jpeg', 0.82) : shot.dataUrl;

  const pad = (CROP_PADDING_CSS / shot.width) * W;
  const crops = marks.map((m) => {
    const sx = Math.max(0, m.x * W - pad);
    const sy = Math.max(0, m.y * H - pad);
    const sw = Math.min(W - sx, m.w * W + pad * 2);
    const sh = Math.min(H - sy, m.h * H + pad * 2);
    const scale = Math.min(1, CROP_MAX_WIDTH / sw);
    const crop = document.createElement('canvas');
    crop.width = Math.max(1, Math.round(sw * scale));
    crop.height = Math.max(1, Math.round(sh * scale));
    crop.getContext('2d')?.drawImage(canvas, sx, sy, sw, sh, 0, 0, crop.width, crop.height);
    return crop.toDataURL('image/jpeg', 0.85);
  });

  return { image, crops };
}
