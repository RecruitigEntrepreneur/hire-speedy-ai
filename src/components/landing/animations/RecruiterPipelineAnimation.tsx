import { useEffect, useRef } from 'react';
import { LOGO_PATH_A, LOGO_PATH_B } from './matchuntCanvasLogo';

/**
 * RecruiterPipelineAnimation
 *
 * Ruhiges, premium SaaS-Prozessbild aus Recruiter-Sicht (ein festes Bild, nur Zustaende
 * veraendern sich): gebriefte Mandate (mit Honorar) -> Recruiter Workspace mit Briefing ->
 * Kandidatenpipeline mit mehreren Bewerbern (Kandidat A wird platziert) -> Honorar-Verlauf
 * mit "+ Fee"-Payout. Dunkel, monochrom + gruener Akzent.
 *
 * State-of-the-Art-Patterns (siehe Research):
 *  - laeuft nur, wenn im Viewport (IntersectionObserver) + pausiert bei Tab-Wechsel  -> Performance
 *  - prefers-reduced-motion: statisches Endbild statt Bewegung
 *  - DPR-scharf + responsive (ResizeObserver)
 *  - 0 zusaetzliche Dependencies
 *
 * Alle Texte/Zahlen sind ueber Props injizierbar (DE/EN, echte Daten).
 */

export interface RecruiterMandate {
  role: string;
  /** z.B. "SaaS · München" */
  meta: string;
  /** formatiertes Honorar, z.B. "8.400 €" */
  fee: string;
  /** Mandats-Fit in Prozent (0-100) */
  match: number;
}

export interface RecruiterPipelineAnimationProps {
  className?: string;
  /** Headline ueber dem Dashboard */
  headline?: string;
  /** 3 Mandate (links). Das erste wird "angenommen". */
  mandates?: RecruiterMandate[];
  /** Honorar pro Monat (6 Werte, Jul–Dez) fuer das Verlaufs-Diagramm */
  monthlyHonorar?: number[];
  /** Monatslabels (6) */
  monthLabels?: string[];
  /** Honorar dieser Platzierung (fliesst am Ende in Verlauf + Summe) */
  placementFee?: number;
  /** Offener Pipeline-Wert (€) */
  pipelineValue?: number;
  /** Locale fuer Zahlformatierung */
  locale?: string;
}

const DEFAULT_MANDATES: RecruiterMandate[] = [
  { role: 'Head of Sales', meta: 'SaaS · München', fee: '8.400 €', match: 92 },
  { role: 'HR Business Partner', meta: 'Industrie · Köln', fee: '6.300 €', match: 86 },
  { role: 'Finance Manager', meta: 'Mittelstand · Frankfurt', fee: '7.100 €', match: 81 },
];

export function RecruiterPipelineAnimation({
  className,
  headline = 'Passende Mandate. Klare Briefings. Honorar bei Platzierung.',
  mandates = DEFAULT_MANDATES,
  monthlyHonorar = [4200, 5600, 4800, 6300, 5400, 3600],
  monthLabels = ['Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
  placementFee = 8400,
  pipelineValue = 31200,
  locale = 'de-DE',
}: RecruiterPipelineAnimationProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const cv = canvasRef.current;
    if (!wrap || !cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const LOGO_A = new Path2D(LOGO_PATH_A);
    const LOGO_B = new Path2D(LOGO_PATH_B);

    let W = 760;
    let H = 480;
    let s = 1;
    let dpr = 1;

    // ---- helpers --------------------------------------------------------------
    const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
    const ease = (p: number) => 1 - Math.pow(1 - clamp(p, 0, 1), 3);
    const eback = (p: number) => {
      p = clamp(p, 0, 1);
      const c = 1.7;
      return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
    };
    const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
    const env = (t: number, a: number, b: number, fi: number, fo: number) => {
      if (t <= a || t >= b) return 0;
      let x = 1;
      if (t < a + fi) x = (t - a) / fi;
      if (t > b - fo) x = Math.min(x, (b - t) / fo);
      return clamp(x, 0, 1);
    };
    const shade = (c: number[], f: number) =>
      'rgb(' +
      Math.round(clamp(c[0] * f, 0, 255)) +
      ',' +
      Math.round(clamp(c[1] * f, 0, 255)) +
      ',' +
      Math.round(clamp(c[2] * f, 0, 255)) +
      ')';
    const rr = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };
    const fmt = (n: number) => Math.round(n).toLocaleString(locale);
    const drawLogo = (cx: number, cy: number, maxW: number, maxH: number, color: string) => {
      const sc2 = Math.min(maxW / 1000, maxH / 600);
      const dw = 1000 * sc2;
      const dh = 600 * sc2;
      ctx.save();
      ctx.translate(cx - dw / 2, cy - dh / 2);
      ctx.scale(sc2, sc2);
      ctx.translate(-400, -300);
      ctx.translate(0, 1200);
      ctx.scale(0.1, -0.1);
      ctx.fillStyle = color;
      ctx.fill(LOGO_A);
      ctx.fill(LOGO_B);
      ctx.restore();
    };
    const glow = (cx: number, cy: number, r: number, col: string) => {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, col);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 6.2832);
      ctx.fill();
      ctx.restore();
    };
    const cardBox = (x: number, y: number, w: number, h: number, active: number, al: number) => {
      ctx.globalAlpha = al;
      if (active > 0.01) glow(x + w / 2, y + h / 2, w * 0.7, 'rgba(52,211,153,' + 0.06 * active + ')');
      rr(x, y, w, h, 9 * s);
      ctx.fillStyle = '#111317';
      ctx.fill();
      ctx.strokeStyle =
        'rgba(' +
        Math.round(lerp(38, 52, active)) +
        ',' +
        Math.round(lerp(40, 211, active)) +
        ',' +
        Math.round(lerp(46, 153, active)) +
        ',' +
        (0.5 + 0.3 * active) +
        ')';
      ctx.lineWidth = 1.2 * s;
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    const gcheck = (cx: number, cy: number, r: number, done: boolean, al: number) => {
      ctx.globalAlpha = al;
      if (done) {
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 6.2832);
        ctx.fill();
        ctx.strokeStyle = '#eafff5';
        ctx.lineWidth = 1.4 * s;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.42, cy + r * 0.02);
        ctx.lineTo(cx - r * 0.08, cy + r * 0.38);
        ctx.lineTo(cx + r * 0.48, cy - r * 0.38);
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#3a3d44';
        ctx.lineWidth = 1.3 * s;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 6.2832);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
    const avatar = (cx: number, cy: number, r: number, ini: string, hero: boolean, al: number) => {
      ctx.globalAlpha = al;
      ctx.fillStyle = hero ? '#10b981' : '#16221c';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 6.2832);
      ctx.fill();
      ctx.strokeStyle = hero ? '#aef5d2' : 'rgba(52,211,153,0.5)';
      ctx.lineWidth = 1.1 * s;
      ctx.stroke();
      ctx.fillStyle = hero ? '#eafff5' : '#9fe8c8';
      ctx.font = '700 ' + r * 0.92 + 'px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ini, cx, cy + 0.5 * s);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = 1;
    };

    // ---- content --------------------------------------------------------------
    const BRIEF = [
      ['Position', 'Head of Sales'],
      ['Branche', 'SaaS / B2B'],
      ['Gehaltsrahmen', '90–110k'],
      ['Standort', 'München / Remote'],
      ['Must-haves', 'B2B Sales · Führung'],
      ['Entscheidung', '2 Stufen'],
    ];
    const CHIP3 = ['Mandat aktiv', 'Suche gestartet', 'Einreichung möglich'];
    const STAGES = ['Eingereicht', 'In Prüfung', 'Interview', 'Angebot', 'Platziert'];
    const HINTS = [
      'Einreichung gespeichert',
      'Kunde prüft Profil',
      'Interview angefragt',
      'Angebot vorbereitet',
      'Platzierung erfolgreich',
    ];
    const OTHERS = [
      { i: 'B', st: 0 },
      { i: 'G', st: 0 },
      { i: 'C', st: 1 },
      { i: 'F', st: 1 },
      { i: 'D', st: 2 },
      { i: 'E', st: 3 },
    ];
    const KT = [9.4, 10.7, 12.0, 13.1, 14.0];
    const stageFloat = (t: number) => {
      if (t < KT[0]) return -1;
      for (let i = 0; i < 4; i++) {
        if (t < KT[i + 1]) return i + (t - KT[i]) / (KT[i + 1] - KT[i]);
      }
      return 4;
    };

    // ---- the single frame -----------------------------------------------------
    const draw = (now: number) => {
      const P = 15.8;
      const t = now % P;
      const gf = clamp((P - t) / 0.5, 0, 1) * clamp(t / 0.3, 0, 1);
      const dynA = (t < 15.0 ? 1 : 1 - clamp((t - 15.0) / 0.6, 0, 1)) * gf;

      ctx.fillStyle = '#0a0b0d';
      ctx.fillRect(0, 0, W, H);
      glow(W * 0.5, 130 * s, 250 * s, 'rgba(52,211,153,0.05)');

      ctx.globalAlpha = gf;
      ctx.fillStyle = '#f3f4f6';
      ctx.font = '800 ' + 15.5 * s + 'px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(headline, W * 0.5, 28 * s);

      const caps: [number, number, string][] = [
        [0.3, 2.0, 'Passende Mandate — mit Honorar auf einen Blick.'],
        [2.1, 5.0, 'Klare Briefings statt unvollständiger Kundeninfos.'],
        [5.0, 7.0, 'Mandat annehmen. Suche starten. Kandidaten einreichen.'],
        [7.0, 9.5, 'Kandidaten strukturiert einreichen.'],
        [9.5, 13.0, 'Mehrere Kandidaten — Status transparent verfolgen.'],
        [13.0, 15.3, 'Platzierung erfolgreich — Honorar gutgeschrieben.'],
      ];
      for (const cap of caps) {
        const ca = env(t, cap[0], cap[1], 0.5, 0.5) * gf;
        if (ca > 0.01) {
          ctx.globalAlpha = ca;
          ctx.fillStyle = '#8a8c93';
          ctx.font = '600 ' + 10.5 * s + 'px Inter, system-ui, sans-serif';
          ctx.fillText(cap[2], W * 0.5, 45 * s);
        }
      }
      ctx.globalAlpha = gf;

      const mX = 22 * s, mY = 56 * s, mW = 186 * s, mH = 216 * s;
      const wX = 220 * s, wY = 56 * s, wW = 222 * s, wH = 216 * s;
      const pX = 454 * s, pY = 56 * s, pW = 284 * s, pH = 216 * s;

      // --- LEFT: Neue Mandate ---
      cardBox(mX, mY, mW, mH, env(t, 0.3, 15.5, 0.5, 0.4) * dynA, gf);
      ctx.globalAlpha = gf;
      ctx.fillStyle = '#6a6d75';
      ctx.font = '600 ' + 8.5 * s + 'px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('NEUE MANDATE', mX + 14 * s, mY + 17 * s);
      ctx.fillStyle = '#34d399';
      ctx.font = '700 ' + 7.5 * s + 'px Inter, system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(clamp((t - 0.5) / 2, 0, 1) * 12) + ' für dich offen', mX + mW - 14 * s, mY + 17 * s);
      ctx.textAlign = 'left';
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1 * s;
      ctx.beginPath();
      ctx.moveTo(mX + 14 * s, mY + 24 * s);
      ctx.lineTo(mX + mW - 14 * s, mY + 24 * s);
      ctx.stroke();
      for (let m = 0; m < 3; m++) {
        const md = mandates[m] ?? DEFAULT_MANDATES[m];
        const myy = mY + 32 * s + m * 60 * s;
        const acc = m === 0;
        const actM = acc && t > 1.6;
        const app = clamp((t - 0.4 - m * 0.25) / 0.5, 0, 1) * dynA;
        const dim = acc ? 1 : t > 1.6 ? 0.55 : 1;
        ctx.globalAlpha = app * dim;
        rr(mX + 12 * s, myy, mW - 24 * s, 52 * s, 7 * s);
        ctx.fillStyle = actM ? '#13211b' : '#15171b';
        ctx.fill();
        ctx.strokeStyle = actM ? 'rgba(52,211,153,0.55)' : 'rgba(40,42,48,0.8)';
        ctx.lineWidth = actM ? 1.3 * s : 1 * s;
        ctx.stroke();
        if (actM && t < 5) glow(mX + mW / 2, myy + 26 * s, mW * 0.5, 'rgba(52,211,153,0.07)');
        ctx.fillStyle = '#e7e8ea';
        ctx.font = '700 ' + 9.5 * s + 'px Inter, system-ui, sans-serif';
        ctx.fillText(md.role, mX + 20 * s, myy + 16 * s);
        ctx.fillStyle = acc ? '#34d399' : '#7a7d84';
        ctx.font = '700 ' + 7 * s + 'px Inter, system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(md.match + '% Match', mX + mW - 20 * s, myy + 16 * s);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#8a8c93';
        ctx.font = '500 ' + 7 * s + 'px Inter, system-ui, sans-serif';
        ctx.fillText(md.meta, mX + 20 * s, myy + 28 * s);
        ctx.fillStyle = '#6a6d75';
        ctx.font = '600 ' + 7 * s + 'px Inter, system-ui, sans-serif';
        ctx.fillText('Honorar', mX + 20 * s, myy + 43 * s);
        ctx.fillStyle = '#34d399';
        ctx.font = '800 ' + 11 * s + 'px Inter, system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(md.fee, mX + mW - 20 * s, myy + 44 * s);
        ctx.textAlign = 'left';
      }
      ctx.globalAlpha = gf;

      // --- CENTER: Recruiter Workspace ---
      cardBox(wX, wY, wW, wH, env(t, 1.8, 15.5, 0.5, 0.4) * dynA, gf);
      ctx.globalAlpha = gf;
      drawLogo(wX + 22 * s, wY + 16 * s, 24 * s, 14 * s, '#34d399');
      ctx.fillStyle = '#eafff5';
      ctx.font = '700 ' + 10 * s + 'px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Recruiter Workspace', wX + 39 * s, wY + 15 * s);
      ctx.fillStyle = '#6a6d75';
      ctx.font = '600 ' + 7 * s + 'px Inter, system-ui, sans-serif';
      ctx.fillText('Du · Sales-Recruiter', wX + 39 * s, wY + 25 * s);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1 * s;
      ctx.beginPath();
      ctx.moveTo(wX + 14 * s, wY + 32 * s);
      ctx.lineTo(wX + wW - 14 * s, wY + 32 * s);
      ctx.stroke();
      const brAl = env(t, 2.6, 15.5, 0.4, 0.4) * dynA;
      if (brAl > 0.01) {
        ctx.globalAlpha = brAl;
        ctx.fillStyle = '#e7e8ea';
        ctx.font = '700 ' + 9.5 * s + 'px Inter, system-ui, sans-serif';
        ctx.fillText(mandates[0]?.role ?? 'Head of Sales', wX + 16 * s, wY + 48 * s);
        ctx.fillStyle = '#34d399';
        ctx.font = '700 ' + 8 * s + 'px Inter, system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText((mandates[0]?.fee ?? '8.400 €') + ' Honorar', wX + wW - 16 * s, wY + 48 * s);
        ctx.textAlign = 'left';
        for (let b = 0; b < 6; b++) {
          const col = b % 2;
          const row = Math.floor(b / 2);
          const bx = wX + (col ? 108 * s : 16 * s);
          const by = wY + 62 * s + row * 19 * s;
          const bd = t > 2.8 + b * 0.3;
          gcheck(bx + 5 * s, by + 4 * s, 4 * s, bd, brAl);
          ctx.globalAlpha = brAl;
          ctx.fillStyle = '#7a7d84';
          ctx.font = '600 ' + 6.5 * s + 'px Inter, system-ui, sans-serif';
          ctx.fillText(BRIEF[b][0], bx + 13 * s, by + 1 * s);
          ctx.fillStyle = '#d6d8dc';
          ctx.font = '600 ' + 8 * s + 'px Inter, system-ui, sans-serif';
          ctx.fillText(BRIEF[b][1], bx + 13 * s, by + 11 * s);
        }
      }
      ctx.globalAlpha = gf;
      const accepted = t > 5.6;
      rr(wX + 16 * s, wY + 128 * s, wW - 32 * s, 19 * s, 6 * s);
      ctx.fillStyle = accepted ? '#10b981' : 'rgba(16,40,30,0.6)';
      ctx.fill();
      ctx.strokeStyle = accepted ? '#10b981' : 'rgba(52,211,153,0.5)';
      ctx.lineWidth = 1 * s;
      ctx.stroke();
      ctx.fillStyle = accepted ? '#eafff5' : '#9fe8c8';
      ctx.font = '700 ' + 8.5 * s + 'px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(accepted ? '✓ Mandat angenommen' : 'Mandat annehmen', wX + wW / 2, wY + 137.5 * s);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      const chAl = env(t, 6.0, 15.5, 0.4, 0.4) * dynA;
      if (chAl > 0.01) {
        ctx.globalAlpha = chAl;
        let cxp = wX + 16 * s;
        for (let ch = 0; ch < 3; ch++) {
          ctx.font = '600 ' + 6.8 * s + 'px Inter, system-ui, sans-serif';
          const cw = ctx.measureText(CHIP3[ch]).width + 12 * s;
          rr(cxp, wY + 153 * s, cw, 13 * s, 6 * s);
          ctx.fillStyle = 'rgba(16,40,30,0.9)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(52,211,153,0.4)';
          ctx.lineWidth = 1 * s;
          ctx.stroke();
          ctx.fillStyle = '#34d399';
          ctx.textBaseline = 'middle';
          ctx.fillText(CHIP3[ch], cxp + 6 * s, wY + 159.5 * s);
          ctx.textBaseline = 'alphabetic';
          cxp += cw + 5 * s;
        }
        ctx.globalAlpha = gf;
      }
      const subAl = env(t, 7.0, 15.5, 0.4, 0.4) * dynA;
      if (subAl > 0.01) {
        ctx.globalAlpha = subAl;
        const subm = t > 7.8;
        rr(wX + 16 * s, wY + 174 * s, wW - 32 * s, 19 * s, 6 * s);
        ctx.fillStyle = subm ? '#10b981' : 'rgba(16,40,30,0.6)';
        ctx.fill();
        ctx.strokeStyle = subm ? '#10b981' : 'rgba(52,211,153,0.5)';
        ctx.lineWidth = 1 * s;
        ctx.stroke();
        ctx.fillStyle = subm ? '#eafff5' : '#9fe8c8';
        ctx.font = '700 ' + 8.5 * s + 'px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(subm ? '✓ Kandidat A eingereicht' : 'Kandidat einreichen', wX + wW / 2, wY + 183.5 * s);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.globalAlpha = gf;
      }

      // --- RIGHT: Kandidatenpipeline (mehrere Bewerber) ---
      cardBox(pX, pY, pW, pH, env(t, 4.4, 15.5, 0.5, 0.4) * dynA, gf);
      ctx.globalAlpha = gf;
      ctx.fillStyle = '#e7e8ea';
      ctx.font = '700 ' + 10 * s + 'px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Kandidatenpipeline', pX + 14 * s, pY + 17 * s);
      ctx.fillStyle = '#34d399';
      ctx.font = '600 ' + 7 * s + 'px Inter, system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('● Ø 2 Tage Feedback', pX + pW - 14 * s, pY + 17 * s);
      ctx.textAlign = 'left';
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1 * s;
      ctx.beginPath();
      ctx.moveTo(pX + 14 * s, pY + 24 * s);
      ctx.lineTo(pX + pW - 14 * s, pY + 24 * s);
      ctx.stroke();
      const sf = stageFloat(t);
      const aIn = sf >= 0;
      const curA = clamp(Math.round(sf), 0, 4);
      const stepX = pX + 26 * s;
      const stepY0 = pY + 42 * s;
      const gap = 33 * s;
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(stepX, stepY0);
      ctx.lineTo(stepX, stepY0 + 4 * gap);
      ctx.stroke();
      if (aIn) {
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.moveTo(stepX, stepY0);
        ctx.lineTo(stepX, stepY0 + clamp(sf, 0, 4) * gap);
        ctx.stroke();
      }
      for (let st = 0; st < 5; st++) {
        const sy = stepY0 + st * gap;
        const passed = aIn && (st < curA || (st === 4 && sf >= 3.99));
        gcheck(stepX, sy, 5 * s, passed, dynA);
        if (aIn && !passed && sf >= st - 0.1 && st <= Math.ceil(sf)) {
          ctx.globalAlpha = dynA;
          ctx.fillStyle = '#34d399';
          ctx.beginPath();
          ctx.arc(stepX, sy, 4 * s, 0, 6.2832);
          ctx.fill();
        }
        ctx.globalAlpha = gf;
        ctx.fillStyle = passed || (st <= Math.ceil(sf) && aIn) ? '#e3e4e7' : '#9a9ca2';
        ctx.font = '600 ' + 8.5 * s + 'px Inter, system-ui, sans-serif';
        ctx.fillText(STAGES[st], stepX + 14 * s, sy + 3 * s);
        const here: string[] = [];
        for (const o of OTHERS) if (o.st === st) here.push(o.i);
        const axr = pX + pW - 22 * s;
        for (let hh = 0; hh < here.length; hh++) avatar(axr - hh * 15 * s, sy, 6.5 * s, here[hh], false, dynA * 0.9);
      }
      if (aIn) {
        const aY = stepY0 + clamp(sf, 0, 4) * gap;
        const offset = OTHERS.filter((o) => o.st === curA).length * 15 * s;
        glow(pX + pW - 22 * s - offset, aY, 16 * s, 'rgba(52,211,153,0.18)');
        avatar(pX + pW - 22 * s - offset, aY, 8 * s, 'A', true, dynA);
      }
      ctx.globalAlpha = gf;
      ctx.fillStyle = sf >= 3.99 ? '#34d399' : '#7fb9a4';
      ctx.font = '600 ' + 7.5 * s + 'px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      if (aIn) ctx.fillText('Kandidat A · ' + HINTS[curA], pX + 16 * s, pY + pH - 12 * s);
      if (t >= 8.6 && t <= 9.4) {
        const fp = ease(clamp((t - 8.6) / 0.8, 0, 1));
        const fx = lerp(wX + wW / 2, pX + pW - 22 * s, fp);
        const fy = lerp(wY + 183 * s, stepY0, fp);
        avatar(fx, fy, 8 * s, 'A', true, dynA);
      }

      // --- BOTTOM: Honorar-Verlauf + Payout ---
      cardBox(20 * s, 282 * s, 720 * s, 172 * s, env(t, 0.3, 15.5, 0.5, 0.4) * dynA, gf);
      ctx.globalAlpha = gf;
      ctx.fillStyle = '#e7e8ea';
      ctx.font = '700 ' + 10.5 * s + 'px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Deine Performance bei MatchHunt', 36 * s, 304 * s);
      const placedNow = t > 13.9;
      const payP = clamp((t - 13.9) / 0.8, 0, 1);
      const boost = placedNow ? placementFee * payP : 0;
      const chartX = 40 * s, baseY = 430 * s, chartHpx = 92 * s, maxV = 14000, bw = 30 * s, gapb = 22 * s;
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1 * s;
      ctx.beginPath();
      ctx.moveTo(chartX - 6 * s, baseY + 0.5 * s);
      ctx.lineTo(chartX + 6 * (bw + gapb) - gapb + 6 * s, baseY + 0.5 * s);
      ctx.stroke();
      for (let bi = 0; bi < 6; bi++) {
        const bx = chartX + bi * (bw + gapb);
        const val = monthlyHonorar[bi] + (bi === 5 ? boost : 0);
        const gw = clamp((t - 0.6 - bi * 0.12) / 0.6, 0, 1);
        const bh = (val / maxV) * chartHpx * ease(gw);
        const last = bi === 5;
        ctx.globalAlpha = gf;
        rr(bx, baseY - chartHpx, bw, chartHpx, 3 * s);
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fill();
        const bg = ctx.createLinearGradient(0, baseY - bh, 0, baseY);
        bg.addColorStop(0, last ? '#34d399' : '#1f9d63');
        bg.addColorStop(1, last ? '#1f9d63' : '#136b45');
        rr(bx, baseY - bh, bw, bh, 3 * s);
        ctx.fillStyle = bg;
        ctx.fill();
        if (last && placedNow) glow(bx + bw / 2, baseY - bh, 28 * s, 'rgba(52,211,153,0.22)');
        ctx.fillStyle = last ? '#34d399' : '#6a6d75';
        ctx.font = '600 ' + 7.5 * s + 'px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(monthLabels[bi], bx + bw / 2, baseY + 12 * s);
        ctx.textAlign = 'left';
      }
      ctx.fillStyle = '#6a6d75';
      ctx.font = '600 ' + 8 * s + 'px Inter, system-ui, sans-serif';
      ctx.fillText('Honorar / Monat', chartX, 324 * s);

      const rX = 400 * s;
      let total = 0;
      for (let ti = 0; ti < 6; ti++) total += monthlyHonorar[ti];
      total = Math.round(total * ease(clamp((t - 0.6) / 2.5, 0, 1)) + boost);
      ctx.fillStyle = '#7a7d84';
      ctx.font = '600 ' + 9 * s + 'px Inter, system-ui, sans-serif';
      ctx.fillText('Honorar · letzte 6 Monate', rX, 312 * s);
      ctx.fillStyle = '#34d399';
      ctx.font = '800 ' + 30 * s + 'px Inter, system-ui, sans-serif';
      ctx.fillText(fmt(total) + ' €', rX, 348 * s);
      ctx.fillStyle = '#7a7d84';
      ctx.font = '600 ' + 9 * s + 'px Inter, system-ui, sans-serif';
      ctx.fillText('Pipeline-Wert (offen)', rX, 376 * s);
      ctx.fillStyle = '#e3e4e7';
      ctx.font = '800 ' + 18 * s + 'px Inter, system-ui, sans-serif';
      ctx.fillText(fmt(pipelineValue * ease(clamp((t - 9) / 2.5, 0, 1))) + ' €', rX, 398 * s);
      ctx.fillStyle = '#7a7d84';
      ctx.font = '600 ' + 9 * s + 'px Inter, system-ui, sans-serif';
      ctx.fillText('Dieses Mandat', rX + 150 * s, 376 * s);
      ctx.fillStyle = placedNow ? '#34d399' : '#5a8c75';
      ctx.font = '800 ' + 18 * s + 'px Inter, system-ui, sans-serif';
      ctx.fillText(fmt(placementFee) + ' €', rX + 150 * s, 398 * s);
      if (placedNow) {
        const pop = eback(clamp((t - 13.9) / 0.5, 0, 1));
        const rise = clamp((t - 13.9) / 1.1, 0, 1);
        ctx.globalAlpha = gf * (1 - rise * 0.3) * pop;
        ctx.save();
        ctx.translate(rX + 62 * s, 332 * s - rise * 14 * s);
        ctx.scale(pop, pop);
        rr(-46 * s, -12 * s, 92 * s, 23 * s, 11 * s);
        ctx.fillStyle = '#10b981';
        ctx.fill();
        ctx.fillStyle = '#eafff5';
        ctx.font = '800 ' + 11 * s + 'px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+ ' + fmt(placementFee) + ' €', 0, 0.5 * s);
        ctx.restore();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.globalAlpha = gf;
      }
      ctx.globalAlpha = 1;
    };

    // ---- sizing ---------------------------------------------------------------
    const fit = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = wrap.clientWidth || 760;
      H = wrap.clientHeight || 480;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s = W / 760;
      if (reduce || !running) draw(14.2); // statisches Poster-Bild
    };

    // ---- loop, gated by visibility -------------------------------------------
    let raf = 0;
    let startTs = 0;
    let running = false;
    let inView = false;

    const frame = (ts: number) => {
      if (!running) return;
      if (!startTs) startTs = ts;
      draw((ts - startTs) / 1000);
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (running || reduce) return;
      running = true;
      startTs = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const ro = new ResizeObserver(() => fit());
    ro.observe(wrap);
    fit();

    const io = new IntersectionObserver(
      (entries) => {
        inView = entries[0]?.isIntersecting ?? false;
        if (inView && !document.hidden) start();
        else stop();
      },
      { threshold: 0.15 }
    );
    io.observe(wrap);

    const onVis = () => {
      if (document.hidden) stop();
      else if (inView) start();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [headline, mandates, monthlyHonorar, monthLabels, placementFee, pipelineValue, locale]);

  return (
    <div
      ref={wrapRef}
      className={
        'relative w-full aspect-[760/480] overflow-hidden rounded-[18px] border border-[#1c1d22] bg-[#0a0b0d] ' +
        (className ?? '')
      }
      role="img"
      aria-label="Animiertes Recruiter-Dashboard: gebriefte Mandate, Briefing, Kandidatenpipeline und Honorar-Verlauf bis zur Platzierung."
    >
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
    </div>
  );
}

export default RecruiterPipelineAnimation;
