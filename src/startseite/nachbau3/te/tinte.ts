// Die Tinte: schwarze Punkte, die sich wie Tropfen verhalten. Kommen sich zwei nahe, wächst ein Hals
// zwischen ihnen; trennen sie sich, wird er dünn und reißt. Ein Zeichen ist eine Folge von Stellungen,
// die Punkte federn von einer zur nächsten, überzählige laufen in den Nachbarn, fehlende knospen aus ihm.
// Einheiten: Bühne ungefähr −1 … 1, y zeigt nach unten, Standard-Radius 0,2.

export const TAU = Math.PI * 2;
export const D = 0.2;
export type P = { x: number; y: number; r?: number };
export type Pose = { dauer: number; f: (t: number) => P[] };
export type Zeichen = { posen: Pose[]; still: number };
export type Art = "stelle" | "suche" | "profil" | "gespraech" | "angebot" | "null" | "eins" | "paar";

const fest = (ps: P[]) => () => ps;
const reihe = (n: number, abstand: number, y = 0, r = D): P[] =>
  Array.from({ length: n }, (_, i) => ({ x: (i - (n - 1) / 2) * abstand, y, r }));
const ring = (n: number, R: number, dreh = 0, r = D): P[] =>
  Array.from({ length: n }, (_, i) => ({ x: Math.cos(dreh + (i / n) * TAU) * R, y: Math.sin(dreh + (i / n) * TAU) * R, r }));

export const ZEICHEN: Record<Art, Zeichen> = {
  // Stelle aufnehmen: ein Punkt → drei Textzeilen → ein Blatt
  stelle: {
    still: 1,
    posen: [
      { dauer: 1.3, f: fest([{ x: 0, y: 0, r: 0.22 }]) },
      { dauer: 2.6, f: fest([...reihe(4, 0.27, -0.34, 0.125), ...reihe(3, 0.27, 0, 0.125).map((p) => ({ ...p, x: p.x - 0.135 })), ...reihe(2, 0.27, 0.34, 0.125).map((p) => ({ ...p, x: p.x - 0.27 }))]) },
      { dauer: 2.2, f: (t) => { const a = 0.27 + Math.sin(t * 2.2) * 0.012; return [-1, 0, 1].flatMap((j) => reihe(3, a, j * a, 0.195)); } },
    ],
  },
  // Headhunter suchen: Stelle in der Mitte, fünf suchen im Kreis → sie kommen zusammen
  suche: {
    still: 0,
    posen: [
      { dauer: 3.2, f: (t) => [{ x: 0, y: 0, r: 0.2 }, ...ring(5, 0.6, t * 0.9 - 1.57, 0.115)] },
      { dauer: 2.2, f: (t) => [{ x: 0, y: 0, r: 0.24 }, ...ring(5, 0.3 + Math.sin(t * 3) * 0.02, 2.9 - 1.57 + t * 0.35, 0.17)] },
      { dauer: 1.2, f: fest([{ x: 0, y: 0, r: 0.3 }]) },
    ],
  },
  // Vorstellungen ohne Namen: drei Kandidaten → einer tritt vor → Umriss ohne Gesicht
  profil: {
    still: 2,
    posen: [
      { dauer: 1.8, f: (t) => reihe(3, 0.5).map((p, i) => ({ ...p, y: Math.sin(t * 3 - i * 0.9) * 0.05 })) },
      { dauer: 1.6, f: fest([{ x: -0.5, y: 0.04, r: 0.12 }, { x: 0, y: 0, r: 0.3 }, { x: 0.5, y: 0.04, r: 0.12 }]) },
      { dauer: 2.6, f: (t) => [{ x: 0, y: -0.36 + Math.sin(t * 2) * 0.012, r: 0.19 }, { x: -0.24, y: 0.24, r: 0.2 }, { x: 0, y: 0.2, r: 0.2 }, { x: 0.24, y: 0.24, r: 0.2 }] },
    ],
  },
  // Gespräche: zwei Punkte, sie kommen zusammen, reden, ein Wort springt hin und her
  gespraech: {
    still: 1,
    posen: [
      { dauer: 1.5, f: fest([{ x: -0.5, y: 0 }, { x: 0.5, y: 0 }]) },
      { dauer: 2.8, f: (t) => [{ x: -0.215, y: Math.sin(t * 5) * 0.07 }, { x: 0.215, y: Math.sin(t * 5 + 3.14) * 0.07 }] },
      { dauer: 3, f: (t) => { const u = (Math.sin(t * 2.6 - 1.57) + 1) / 2; return [{ x: -0.55, y: 0 }, { x: 0.55, y: 0 }, { x: -0.3 + u * 0.6, y: -Math.sin(u * Math.PI) * 0.3, r: 0.09 }]; } },
    ],
  },
  // Angebot und Unterschrift: Siegel → Schriftzug → Haken
  angebot: {
    still: 2,
    posen: [
      { dauer: 1.4, f: fest([{ x: 0, y: 0, r: 0.33 }]) },
      { dauer: 2.8, f: (t) => Array.from({ length: 7 }, (_, i) => ({ x: -0.6 + i * 0.2, y: Math.sin(i * 1.15 - t * 3.2) * 0.2, r: 0.115 })) },
      { dauer: 2.4, f: fest([{ x: -0.5, y: 0.02, r: 0.125 }, { x: -0.37, y: 0.16, r: 0.125 }, { x: -0.24, y: 0.3, r: 0.125 }, { x: -0.08, y: 0.15, r: 0.125 }, { x: 0.08, y: 0, r: 0.125 }, { x: 0.24, y: -0.15, r: 0.125 }, { x: 0.4, y: -0.3, r: 0.125 }]) },
    ],
  },
  // „0 €“: ein Ring, der atmet
  null: {
    still: 0,
    posen: [
      { dauer: 3.2, f: (t) => ring(9, 0.44 + Math.sin(t * 2) * 0.02, t * 0.25, 0.15).map((p) => ({ ...p, x: p.x * 0.78 })) },
      { dauer: 1.1, f: fest([{ x: 0, y: 0, r: 0.24 }]) },
    ],
  },
  // „1 Rahmenvertrag“: viele werden eins
  eins: {
    still: 1,
    posen: [
      { dauer: 2.4, f: (t) => [{ x: -0.6, y: -0.25 }, { x: -0.15, y: 0.32 }, { x: 0.1, y: -0.38 }, { x: 0.62, y: 0.2 }, { x: 0.3, y: 0 }].map((p, i) => ({ x: p.x + Math.sin(t * 1.7 + i * 2) * 0.05, y: p.y + Math.cos(t * 1.3 + i) * 0.05, r: 0.16 })) },
      { dauer: 2.6, f: (t) => [{ x: 0, y: 0, r: 0.42 + Math.sin(t * 2.4) * 0.012 }] },
    ],
  },
  // das Paar: zwei Punkte schräg
  paar: {
    still: 0,
    posen: [
      { dauer: 2.4, f: fest([{ x: -0.16, y: -0.16 }, { x: 0.16, y: 0.16 }]) },
      { dauer: 2, f: (t) => [{ x: -0.3 - Math.sin(t * 2) * 0.03, y: -0.3 }, { x: 0.3 + Math.sin(t * 2) * 0.03, y: 0.3 }] },
    ],
  },
};

type Punkt = { x: number; y: number; vx: number; vy: number; r: number; vr: number; k: number; in: Punkt | null; warte: number; alt: P | null; saat: number };

const rausch = (t: number, s: number) => Math.sin(t * 1.3 + s * 12.9) * 0.6 + Math.sin(t * 2.9 + s * 78.2) * 0.4;

export class Tinte {
  punkte: Punkt[] = [];
  pi = -1;
  pt = 0;
  t = 0;
  rest = 0;
  hand: { x: number; y: number } | null = null;
  constructor(public zeichen: Zeichen, public stillstand = false) {
    this.punkte.push({ x: 0, y: 0, vx: 0, vy: 0, r: D * 0.9, vr: 0, k: 0, in: null, warte: 0, alt: null, saat: 0.3 });
    this.zeige(stillstand ? zeichen.still : 0, stillstand);
  }
  wechsle(z: Zeichen) {
    if (z === this.zeichen) return;
    this.zeichen = z;
    this.zeige(this.stillstand ? z.still : 0, this.stillstand);
  }
  zeige(i: number, sofort = false) {
    const posen = this.zeichen.posen;
    const altPose = this.pi >= 0 && this.pi < posen.length ? posen[this.pi] : null;
    const altT = this.pt;
    this.pi = ((i % posen.length) + posen.length) % posen.length;
    this.pt = 0;
    const ziele = posen[this.pi].f(0);
    const leb = this.punkte.filter((p) => !p.in);
    if (sofort) {
      this.punkte = ziele.map((z, k) => ({ x: z.x, y: z.y, vx: 0, vy: 0, r: z.r ?? D, vr: 0, k, in: null, warte: 0, alt: null, saat: k * 0.37 + 0.1 }));
      return;
    }
    const paare: [number, number, number][] = [];
    leb.forEach((p, a) => ziele.forEach((z, b) => paare.push([Math.hypot(p.x - z.x, p.y - z.y), a, b])));
    paare.sort((u, v) => u[0] - v[0]);
    const hatZ = new Array<Punkt | null>(ziele.length).fill(null);
    const vergeben = new Set<number>();
    for (const [, a, b] of paare) {
      if (vergeben.has(a) || hatZ[b]) continue;
      vergeben.add(a);
      hatZ[b] = leb[a];
    }
    // behalten: mit kleiner Verzögerung, damit nicht alle zugleich losgehen
    hatZ.forEach((p, b) => {
      if (!p) return;
      const alt = altPose ? altPose.f(altT)[p.k] : null;
      p.alt = alt ? { ...alt } : null;
      p.k = b;
      p.warte = b * 0.045;
    });
    // fehlende knospen aus dem nächsten Punkt
    ziele.forEach((z, b) => {
      if (hatZ[b]) return;
      let nah = leb[0] ?? this.punkte[0];
      for (const p of leb) if (Math.hypot(p.x - z.x, p.y - z.y) < Math.hypot(nah.x - z.x, nah.y - z.y)) nah = p;
      const neu: Punkt = { x: nah?.x ?? 0, y: nah?.y ?? 0, vx: 0, vy: 0, r: 0.03, vr: 0, k: b, in: null, warte: b * 0.045, alt: null, saat: b * 0.37 + this.t };
      hatZ[b] = neu;
      this.punkte.push(neu);
    });
    // überzählige laufen in den nächsten
    leb.forEach((p, a) => {
      if (vergeben.has(a)) return;
      let nah: Punkt | null = null;
      for (const q of hatZ) if (q && (!nah || Math.hypot(q.x - p.x, q.y - p.y) < Math.hypot(nah.x - p.x, nah.y - p.y))) nah = q;
      p.in = nah;
    });
  }
  vor(dt: number) {
    if (this.stillstand) return;
    this.rest += Math.min(dt, 0.05);
    const h = 1 / 120;
    while (this.rest >= h) {
      this.schritt(h);
      this.rest -= h;
    }
  }
  private schritt(dt: number) {
    this.t += dt;
    this.pt += dt;
    const pose = this.zeichen.posen[this.pi];
    if (this.pt > pose.dauer && this.zeichen.posen.length > 1) {
      this.zeige(this.pi + 1);
      return;
    }
    const ziele = pose.f(this.pt);
    const w = TAU * 2.3, zeta = 0.46, wr = TAU * 3, zr = 0.62;
    for (const p of this.punkte) {
      let tx: number, ty: number, tr: number;
      if (p.in) {
        tx = p.in.x; ty = p.in.y; tr = 0;
      } else {
        const z = this.pt < p.warte && p.alt ? p.alt : ziele[p.k] ?? ziele[0];
        tx = z.x + rausch(this.t, p.saat) * 0.012;
        ty = z.y + rausch(this.t + 40, p.saat + 3) * 0.012;
        tr = z.r ?? D;
      }
      let ax = w * w * (tx - p.x) - 2 * zeta * w * p.vx;
      let ay = w * w * (ty - p.y) - 2 * zeta * w * p.vy;
      if (this.hand) {
        const dx = p.x - this.hand.x, dy = p.y - this.hand.y, d = Math.hypot(dx, dy) || 1e-3, R = 0.6;
        if (d < R) {
          const k = 150 * (1 - d / R) ** 2;
          ax += (dx / d) * k;
          ay += (dy / d) * k;
        }
      }
      p.vx += ax * dt; p.vy += ay * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vr += (wr * wr * (tr - p.r) - 2 * zr * wr * p.vr) * dt;
      p.r = Math.max(0, p.r + p.vr * dt);
    }
    this.punkte = this.punkte.filter((p) => !(p.in && p.r < 0.02 && Math.hypot(p.in.x - p.x, p.in.y - p.y) < 0.12));
  }
  male(c: CanvasRenderingContext2D, cx: number, cy: number, s: number, farbe: string) {
    c.fillStyle = farbe;
    const ps = this.punkte;
    for (const p of ps) {
      if (p.r <= 0.004) continue;
      const v = Math.hypot(p.vx, p.vy), st = Math.min(0.2, v * 0.03);
      c.beginPath();
      c.ellipse(cx + p.x * s, cy + p.y * s, p.r * s * (1 + st), p.r * s * (1 - st * 0.6), Math.atan2(p.vy, p.vx), 0, TAU);
      c.fill();
    }
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) hals(c, cx + ps[i].x * s, cy + ps[i].y * s, ps[i].r * s, cx + ps[j].x * s, cy + ps[j].y * s, ps[j].r * s);
  }
}

/** Der Hals zwischen zwei Kreisen: zwei Bögen, die beide Kreise berühren; wird mit dem Abstand dünner und reißt. */
export function hals(c: CanvasRenderingContext2D, x1: number, y1: number, r1: number, x2: number, y2: number, r2: number, weit = 1.5) {
  if (r1 < 0.5 || r2 < 0.5) return;
  if (r1 < r2) { [x1, y1, r1, x2, y2, r2] = [x2, y2, r2, x1, y1, r1]; }
  const d = Math.hypot(x2 - x1, y2 - y1), sum = r1 + r2;
  if (d > sum * weit || d <= r1 - r2 + 0.01) return;
  const nah = Math.max(0, Math.min(1, (sum * weit - d) / (sum * (weit - 0.92))));
  if (nah < 0.14) return;
  const v = 0.5 * nah;
  let u1 = 0, u2 = 0;
  if (d < sum) {
    u1 = Math.acos(Math.max(-1, Math.min(1, (r1 * r1 + d * d - r2 * r2) / (2 * r1 * d))));
    u2 = Math.acos(Math.max(-1, Math.min(1, (r2 * r2 + d * d - r1 * r1) / (2 * r2 * d))));
  }
  const w = Math.atan2(y2 - y1, x2 - x1), spreiz = Math.acos((r1 - r2) / d);
  const a1 = w + u1 + (spreiz - u1) * v, a2 = w - u1 - (spreiz - u1) * v;
  const a3 = w + Math.PI - u2 - (Math.PI - u2 - spreiz) * v, a4 = w - Math.PI + u2 + (Math.PI - u2 - spreiz) * v;
  const p1x = x1 + r1 * Math.cos(a1), p1y = y1 + r1 * Math.sin(a1), p2x = x1 + r1 * Math.cos(a2), p2y = y1 + r1 * Math.sin(a2);
  const p3x = x2 + r2 * Math.cos(a3), p3y = y2 + r2 * Math.sin(a3), p4x = x2 + r2 * Math.cos(a4), p4y = y2 + r2 * Math.sin(a4);
  const griff = Math.min(v * 2.4, Math.hypot(p1x - p3x, p1y - p3y) / sum) * Math.min(1, (d * 2) / sum);
  const g1 = r1 * griff, g2 = r2 * griff, q = Math.PI / 2;
  c.beginPath();
  c.moveTo(p1x, p1y);
  c.bezierCurveTo(p1x + g1 * Math.cos(a1 - q), p1y + g1 * Math.sin(a1 - q), p3x + g2 * Math.cos(a3 + q), p3y + g2 * Math.sin(a3 + q), p3x, p3y);
  c.lineTo(p4x, p4y);
  c.bezierCurveTo(p4x + g2 * Math.cos(a4 - q), p4y + g2 * Math.sin(a4 - q), p2x + g1 * Math.cos(a2 + q), p2y + g1 * Math.sin(a2 + q), p2x, p2y);
  c.closePath();
  c.fill();
}

// Ein gemeinsamer Takt für alles, was sich bewegt.
const hoerer = new Set<(dt: number, jetzt: number) => void>();
let bild = 0, zuletzt = 0;
function takt(jetzt: number) {
  bild = 0;
  const dt = Math.min(0.05, (jetzt - zuletzt) / 1000 || 1 / 60);
  zuletzt = jetzt;
  for (const f of hoerer) f(dt, jetzt / 1000);
  if (hoerer.size) bild = requestAnimationFrame(takt);
}
export function imTakt(f: (dt: number, jetzt: number) => void) {
  hoerer.add(f);
  if (!bild) { zuletzt = performance.now(); bild = requestAnimationFrame(takt); }
  return () => { hoerer.delete(f); };
}
export const ruhig = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
