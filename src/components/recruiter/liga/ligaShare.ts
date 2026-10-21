import { AWARD_CRITERIA, AWARD_LABEL, quotePct, type LigaAwardKind } from '@/lib/liga';
import { checkUrl } from '../../../../supabase/functions/_shared/recruiter-partner';

/**
 * Saisonrückblick (Zusatz 5) und LinkedIn-Text zur Auszeichnung. Das Bild entsteht
 * im Browser und wird nirgends gespeichert. Keine Kunden, keine Kandidaten, nur
 * eigene Zahlen mit Saison und Kriterien.
 */
export interface Rueckblick {
  season: string;
  placements: number;
  interviews: number;
  quote: number | null;
  rank: number | null;
  participants: number;
  award: LigaAwardKind | null;
  name: string;
}

const GOLD = '#C8A24A';
const INK = '#0A0A0A';
const FONT = 'Inter, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif';

/** Quadratisches Bild, 1200 × 1200, wie LinkedIn es im Feed ganz zeigt. */
export function drawRueckblick(r: Rueckblick): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 1200; c.height = 1200;
  const g = c.getContext('2d')!;
  g.fillStyle = INK; g.fillRect(0, 0, 1200, 1200);
  g.strokeStyle = '#27272A'; g.lineWidth = 2; g.strokeRect(40, 40, 1120, 1120);

  g.fillStyle = '#A1A1AA'; g.font = `500 34px ${FONT}`;
  g.fillText('Matchunt Liga', 100, 150);
  g.fillStyle = '#FFFFFF'; g.font = `700 64px ${FONT}`;
  g.fillText(`Mein ${r.season} bei Matchunt`, 100, 240);

  g.fillStyle = GOLD; g.font = `800 220px ${FONT}`;
  g.fillText(String(r.placements), 100, 520);
  const w = g.measureText(String(r.placements)).width;
  g.fillStyle = '#FFFFFF'; g.font = `600 56px ${FONT}`;
  g.fillText(r.placements === 1 ? 'Einstellung' : 'Einstellungen', 100 + w + 30, 510);

  g.fillStyle = '#D4D4D8'; g.font = `400 44px ${FONT}`;
  const facts = [`${r.interviews} ${r.interviews === 1 ? 'Kunden-Interview' : 'Kunden-Interviews'}`, `Quote ${quotePct(r.quote)}`];
  if (r.rank) facts.push(`Platz ${r.rank} von ${r.participants}`);
  g.fillText(facts.join(' · '), 100, 620);

  if (r.award) {
    g.fillStyle = '#18181B'; roundRect(g, 100, 700, 1000, 150, 24); g.fill();
    g.fillStyle = GOLD; g.font = `400 80px ${FONT}`; g.fillText('✦', 140, 805);
    g.fillStyle = '#FFFFFF'; g.font = `700 54px ${FONT}`; g.fillText(AWARD_LABEL[r.award], 240, 780);
    g.fillStyle = GOLD; g.font = `500 34px ${FONT}`; g.fillText(`Matchunt Liga · ${r.season}`, 240, 828);
  }

  g.fillStyle = '#FFFFFF'; g.font = `600 40px ${FONT}`;
  if (r.name) g.fillText(r.name, 100, 960);
  g.fillStyle = '#71717A'; g.font = `400 26px ${FONT}`;
  wrap(g, AWARD_CRITERIA, 100, 1030, 1000, 36);
  g.fillText('matchunt.ai', 100, 1110);
  return c;
}

export function downloadRueckblick(r: Rueckblick) {
  const canvas = drawRueckblick(r);
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `Matchunt-Liga-${r.season.replace(/\s+/g, '-')}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** LinkedIn-Text zur Auszeichnung: Saison, Platz und Kriterien, Prüflink. */
export function awardPostText(p: { award: LigaAwardKind; season: string; rank: number; participants: number; number?: string | null }) {
  const head = `${AWARD_LABEL[p.award]} ${p.season} in der Matchunt Liga: Platz ${p.rank} von ${p.participants}.`;
  return [head, AWARD_CRITERIA, 'Danke an meine Kandidatinnen, Kandidaten und Kunden.', p.number ? `Status prüfen: ${checkUrl(p.number)}` : '']
    .filter(Boolean).join('\n\n');
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number) {
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > max && line) { g.fillText(line, x, y); y += lh; line = word; } else line = next;
  }
  if (line) g.fillText(line, x, y);
}
