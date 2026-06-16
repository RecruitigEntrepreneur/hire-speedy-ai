import { useEffect, useRef } from "react";
import fallbackHands from "@/assets/creation-hands.png";

// Interactive halftone "Creation of Adam" hands.
//
// The source (public/hands.png, white halftone dots on black) is decomposed at
// load time into its ~2.9k individual halftone dots via connected-component
// labeling — every particle IS one original dot, at its true position with its
// true size. No grid resampling, no moiré: the artwork stays pixel-faithful.
//
// Each dot is a spring-physics particle: it evades the cursor and brightens,
// then settles back home; displacement is clamped so the hands never lose
// their shape. The two hands periodically reach toward each other, with the
// spark at the fingertip gap flaring as they get closest.
//
// Rendered additively so the black source background drops out over the hero.
// 60fps; pauses off-screen / hidden tab; static frame under reduced motion.

const PRIMARY_SRC = "/hands.png";

// physics (tuned for "high-end, not playful"; parameters validated by research)
const SPRING = 0.085;
const DAMP = 0.86;
const REPEL_F = 3.2;
const SPEED_REF = 30; // px/frame of pointer speed for full repel force
const MAX_OFFSET = 26; // px: particles can never stray further from home
const RETREAT_PX = 14; // how far each hand pulls back before reaching again
const TOUCH_GAP = 1.5; // px left between the fingertips at full reach
const APPROACH_PERIOD = 8; // seconds per reach-and-return cycle

// extraction is deterministic per image URL — cache across (re)mounts
const extractionCache = new Map<
  string,
  {
    dots: { x: number; y: number; r: number }[];
    iw: number;
    ih: number;
    handOf: Uint8Array;
    gapX: number;
    gapY: number;
    gapDist: number; // fingertip distance (image space)
    gapUx: number; // unit vector left tip → right tip
    gapUy: number;
  }
>();

export const AsciiHandsArt = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = 0;
    let H = 0;
    let dpr = 1;
    let rafId = 0;
    let inView = true;

    // particle state — one entry per original halftone dot
    let n = 0;
    let hx!: Float32Array; // home x/y (layout space)
    let hy!: Float32Array;
    let px!: Float32Array; // current position
    let py!: Float32Array;
    let vx!: Float32Array; // velocity
    let vy!: Float32Array;
    let rad!: Float32Array; // dot radius (layout space)
    let tw!: Float32Array; // twinkle phase
    let hand!: Uint8Array; // 0 = left of gap, 1 = right

    let sparkX = 0;
    let sparkY = 0;
    let repelR = 110;
    const mouse = { x: -9999, y: -9999, active: false, speed: 0, px: -9999, py: -9999 };

    // a crisp white dot sprite, drawn scaled per particle (faster than arc+fill)
    const SPRITE = 64;
    const sprite = document.createElement("canvas");
    sprite.width = SPRITE;
    sprite.height = SPRITE;
    {
      const sc = sprite.getContext("2d");
      if (sc) {
        const g = sc.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(0.82, "rgba(255,255,255,1)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        sc.fillStyle = g;
        sc.fillRect(0, 0, SPRITE, SPRITE);
      }
    }

    // Decompose the halftone into its individual dots (runs in ~5ms).
    const extractDots = (img: HTMLImageElement) => {
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const off = document.createElement("canvas");
      off.width = iw;
      off.height = ih;
      const oc = off.getContext("2d", { willReadFrequently: true });
      if (!oc) return null;
      oc.drawImage(img, 0, 0);
      const d = oc.getImageData(0, 0, iw, ih).data;

      const mask = new Uint8Array(iw * ih);
      for (let i = 0; i < iw * ih; i++) {
        const l = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3;
        if (l > 50) mask[i] = 1;
      }

      const label = new Int32Array(iw * ih).fill(-1);
      const stack: number[] = [];
      const pixels: number[] = [];
      const dots: { x: number; y: number; r: number }[] = [];
      // blobs larger than a single halftone dot (merged dots / solid patches)
      // get split back into a dot grid so they keep the halftone texture
      const SPLIT_AREA = 64;
      const CELL = 6; // ≈ source halftone pitch in px
      for (let i = 0; i < iw * ih; i++) {
        if (!mask[i] || label[i] !== -1) continue;
        let area = 0;
        let sumX = 0;
        let sumY = 0;
        pixels.length = 0;
        stack.push(i);
        label[i] = 1;
        while (stack.length) {
          const k = stack.pop()!;
          const x = k % iw;
          const y = (k / iw) | 0;
          area++;
          sumX += x;
          sumY += y;
          pixels.push(k);
          if (x + 1 < iw && mask[k + 1] && label[k + 1] === -1) { label[k + 1] = 1; stack.push(k + 1); }
          if (x - 1 >= 0 && mask[k - 1] && label[k - 1] === -1) { label[k - 1] = 1; stack.push(k - 1); }
          if (y + 1 < ih && mask[k + iw] && label[k + iw] === -1) { label[k + iw] = 1; stack.push(k + iw); }
          if (y - 1 >= 0 && mask[k - iw] && label[k - iw] === -1) { label[k - iw] = 1; stack.push(k - iw); }
        }
        if (area < 2) continue;
        if (area <= SPLIT_AREA) {
          dots.push({ x: sumX / area, y: sumY / area, r: Math.sqrt(area / Math.PI) });
        } else {
          // bucket the blob's pixels into CELL×CELL groups → one dot per group
          const groups = new Map<number, { a: number; sx: number; sy: number }>();
          for (const k of pixels) {
            const x = k % iw;
            const y = (k / iw) | 0;
            const gk = ((y / CELL) | 0) * 65536 + ((x / CELL) | 0);
            let g = groups.get(gk);
            if (!g) {
              g = { a: 0, sx: 0, sy: 0 };
              groups.set(gk, g);
            }
            g.a++;
            g.sx += x;
            g.sy += y;
          }
          for (const g of groups.values()) {
            if (g.a >= 3) {
              dots.push({ x: g.sx / g.a, y: g.sy / g.a, r: Math.min(Math.sqrt(g.a / Math.PI), CELL * 0.52) });
            }
          }
        }
      }
      return { dots, iw, ih };
    };

    // Assign every dot to its hand via connectivity (union-find over dots
    // within LINK px of each other — measured: the two hands form exactly two
    // clusters at 14px while the fingertip gap stays open). The closest pair
    // across the clusters marks the true fingertip gap for the spark.
    const classifyHands = (dots: { x: number; y: number; r: number }[]) => {
      const count = dots.length;
      const parent = new Int32Array(count);
      for (let i = 0; i < count; i++) parent[i] = i;
      const find = (a: number) => {
        while (parent[a] !== a) {
          parent[a] = parent[parent[a]];
          a = parent[a];
        }
        return a;
      };
      const LINK = 14;
      const grid = new Map<number, number[]>();
      for (let i = 0; i < count; i++) {
        const key = ((dots[i].y / LINK) | 0) * 100000 + ((dots[i].x / LINK) | 0);
        let arr = grid.get(key);
        if (!arr) {
          arr = [];
          grid.set(key, arr);
        }
        arr.push(i);
      }
      const L2 = LINK * LINK;
      for (let i = 0; i < count; i++) {
        const gc = (dots[i].x / LINK) | 0;
        const gr = (dots[i].y / LINK) | 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const arr = grid.get((gr + dr) * 100000 + (gc + dc));
            if (!arr) continue;
            for (const j of arr) {
              if (j <= i) continue;
              const dx = dots[i].x - dots[j].x;
              const dy = dots[i].y - dots[j].y;
              if (dx * dx + dy * dy < L2) {
                const ra = find(i);
                const rb = find(j);
                if (ra !== rb) parent[ra] = rb;
              }
            }
          }
        }
      }
      const sizes = new Map<number, number>();
      for (let i = 0; i < count; i++) {
        const r = find(i);
        sizes.set(r, (sizes.get(r) || 0) + 1);
      }
      const roots = [...sizes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map((e) => e[0]);

      const handOf = new Uint8Array(count);
      let gapX = 0;
      let gapY = 0;
      let gapDist = 40;
      let gapUx = 1;
      let gapUy = 0;
      if (roots.length < 2 || (sizes.get(roots[1]) || 0) < count * 0.15) {
        // degenerate source (single mass): fall back to a median x split
        const xs = dots.map((p) => p.x).sort((a, b) => a - b);
        const mid = xs[count >> 1];
        for (let i = 0; i < count; i++) handOf[i] = dots[i].x < mid ? 0 : 1;
        gapX = mid;
        gapY = dots.reduce((s, p) => s + p.y, 0) / count;
      } else {
        let mx0 = 0;
        let c0 = 0;
        let mx1 = 0;
        let c1 = 0;
        for (let i = 0; i < count; i++) {
          const r = find(i);
          if (r === roots[0]) {
            mx0 += dots[i].x;
            c0++;
          } else if (r === roots[1]) {
            mx1 += dots[i].x;
            c1++;
          }
        }
        mx0 /= c0;
        mx1 /= c1;
        const leftRoot = mx0 < mx1 ? roots[0] : roots[1];
        const leftIdx: number[] = [];
        const rightIdx: number[] = [];
        for (let i = 0; i < count; i++) {
          const r = find(i);
          let hd: number;
          if (r === roots[0]) hd = roots[0] === leftRoot ? 0 : 1;
          else if (r === roots[1]) hd = roots[1] === leftRoot ? 0 : 1;
          else hd = Math.abs(dots[i].x - Math.min(mx0, mx1)) < Math.abs(dots[i].x - Math.max(mx0, mx1)) ? 0 : 1;
          handOf[i] = hd;
          (hd === 0 ? leftIdx : rightIdx).push(i);
        }
        // fingertip gap = the closest left↔right pair; its distance and
        // direction define how far and along which line the hands may close
        let best = Infinity;
        let lxT = 0;
        let lyT = 0;
        let rxT = 0;
        let ryT = 0;
        for (const i of leftIdx) {
          for (const j of rightIdx) {
            const dx = dots[i].x - dots[j].x;
            const dy = dots[i].y - dots[j].y;
            const d2 = dx * dx + dy * dy;
            if (d2 < best) {
              best = d2;
              lxT = dots[i].x;
              lyT = dots[i].y;
              rxT = dots[j].x;
              ryT = dots[j].y;
            }
          }
        }
        gapX = (lxT + rxT) / 2;
        gapY = (lyT + ryT) / 2;
        gapDist = Math.sqrt(best);
        if (gapDist > 0.5) {
          gapUx = (rxT - lxT) / gapDist;
          gapUy = (ryT - lyT) / gapDist;
        }
      }
      return { handOf, gapX, gapY, gapDist, gapUx, gapUy };
    };

    let extracted: {
      dots: { x: number; y: number; r: number }[];
      iw: number;
      ih: number;
      handOf: Uint8Array;
      gapX: number;
      gapY: number;
      gapDist: number;
      gapUx: number;
      gapUy: number;
    } | null = null;

    // layout-space approach geometry (set in layoutParticles)
    let closePx = 0; // per-hand travel until the fingertips touch
    let dirX = 1; // closing direction (left hand moves +dir, right hand −dir)
    let dirY = 0;

    const layoutParticles = () => {
      if (!extracted) return;
      const rect = container.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      if (!W || !H) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;

      const { dots, iw, ih, handOf, gapX, gapY, gapDist, gapUx, gapUy } = extracted;
      const aspect = ih / iw;
      let imgW = Math.min(W * 0.98, 1340);
      let imgH = imgW * aspect;
      const maxH = H * 0.94;
      if (imgH > maxH) {
        imgH = maxH;
        imgW = imgH / aspect;
      }
      const imgX = (W - imgW) / 2;
      const imgY = (H - imgH) / 2;
      const s = imgW / iw;
      // spark sits exactly at the measured fingertip gap
      sparkX = imgX + gapX * s;
      sparkY = imgY + gapY * s;
      repelR = W < 768 ? 70 : 110;
      // each hand may close exactly half the gap (minus the touch margin) —
      // the fingertips meet, they never cross over each other
      closePx = Math.max(0, (gapDist * s - TOUCH_GAP) / 2);
      dirX = gapUx;
      dirY = gapUy;

      n = dots.length;
      hx = new Float32Array(n);
      hy = new Float32Array(n);
      px = new Float32Array(n);
      py = new Float32Array(n);
      vx = new Float32Array(n);
      vy = new Float32Array(n);
      rad = new Float32Array(n);
      tw = new Float32Array(n);
      hand = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const x = imgX + dots[i].x * s;
        const y = imgY + dots[i].y * s;
        hx[i] = x;
        hy[i] = y;
        px[i] = x;
        py[i] = y;
        rad[i] = Math.max(0.8, dots[i].r * s);
        tw[i] = Math.random() * Math.PI * 2;
        hand[i] = handOf[i];
      }
    };

    let lastTime = 0;

    const frame = (now: number) => {
      const time = now / 1000;
      // normalize physics to a 60Hz step so 120Hz displays and post-tab-switch
      // frames behave identically; cap dt so the spring can never explode
      const dtMs = lastTime ? Math.min(now - lastTime, 33) : 16.7;
      lastTime = now;
      const dt = dtMs / 16.7;
      const damp = Math.pow(DAMP, dt);
      const spring = SPRING * dt;

      // pointer speed decays between events; scales repel so a parked cursor
      // only makes dots glow instead of burning a hole into the artwork
      mouse.speed *= 0.9;
      const speedScale = Math.min(1, Math.max(0.15, mouse.speed / SPEED_REF));

      // hands reach toward each other and ease back (smoothstepped sine):
      // travel runs from −RETREAT_PX (pulled apart) to +closePx (touching),
      // along the fingertip line — so the tips meet but never cross
      const t = Math.sin((time * 2 * Math.PI) / APPROACH_PERIOD) * 0.5 + 0.5;
      const approach = t * t * (3 - 2 * t);
      const travel = approach * (closePx + RETREAT_PX) - RETREAT_PX;
      const offLx = travel * dirX;
      const offLy = travel * dirY;
      const offRx = -travel * dirX;
      const offRy = -travel * dirY;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";

      const mActive = mouse.active && !reducedMotion;
      const mx = mouse.x;
      const my = mouse.y;
      const r2 = repelR * repelR;

      for (let i = 0; i < n; i++) {
        const left = hand[i] === 0;
        const tx = hx[i] + (left ? offLx : offRx);
        const ty = hy[i] + (left ? offLy : offRy);

        if (!reducedMotion) {
          // spring toward (drifting) home
          vx[i] += (tx - px[i]) * spring;
          vy[i] += (ty - py[i]) * spring;

          let glow = 0;
          if (mActive) {
            const dx = px[i] - mx;
            const dy = py[i] - my;
            const d2 = dx * dx + dy * dy;
            if (d2 < r2) {
              const d = Math.sqrt(d2) || 1;
              const k = 1 - d / repelR;
              vx[i] += (dx / d) * k * REPEL_F * speedScale * dt;
              vy[i] += (dy / d) * k * REPEL_F * speedScale * dt;
              glow = k;
            }
          }

          vx[i] *= damp;
          vy[i] *= damp;
          px[i] += vx[i] * dt;
          py[i] += vy[i] * dt;

          // hard clamp: a particle may never stray far enough to break the form
          const ox = px[i] - tx;
          const oy = py[i] - ty;
          const od2 = ox * ox + oy * oy;
          if (od2 > MAX_OFFSET * MAX_OFFSET) {
            const od = Math.sqrt(od2);
            px[i] = tx + (ox / od) * MAX_OFFSET;
            py[i] = ty + (oy / od) * MAX_OFFSET;
          }

          // subtle twinkle + cursor glow
          const twinkle = Math.sin(tw[i] + time * 1.6) * 0.06;
          let a = 0.78 + twinkle + glow * 0.25;
          let r = rad[i] * (1 + glow * 0.5);
          ctx.globalAlpha = a > 1 ? 1 : a;
          ctx.drawImage(sprite, px[i] - r, py[i] - r, r * 2, r * 2);
        } else {
          ctx.globalAlpha = 0.82;
          const r = rad[i];
          ctx.drawImage(sprite, hx[i] - r, hy[i] - r, r * 2, r * 2);
        }
      }

      // spark at the fingertip gap — flares as the hands get closest
      ctx.globalAlpha = 1;
      const pulse = reducedMotion ? 0.5 : Math.sin((time * 2 * Math.PI) / 2.6) * 0.5 + 0.5;
      const sparkA = 0.04 + pulse * 0.05 + approach * 0.2;
      const sr = 55 + approach * 45;
      const glow = ctx.createRadialGradient(sparkX, sparkY, 0, sparkX, sparkY, sr);
      glow.addColorStop(0, `rgba(255,255,255,${sparkA})`);
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, sr, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      rafId = requestAnimationFrame(loop);
      if (!inView || document.hidden || n === 0) return;
      frame(now);
    };

    const begin = (img: HTMLImageElement) => {
      const cached = extractionCache.get(img.src);
      if (cached) {
        extracted = cached;
      } else {
        const base = extractDots(img);
        if (!base) return;
        const { handOf, gapX, gapY, gapDist, gapUx, gapUy } = classifyHands(base.dots);
        extracted = { ...base, handOf, gapX, gapY, gapDist, gapUx, gapUy };
        extractionCache.set(img.src, extracted);
      }
      layoutParticles();
      if (reducedMotion) {
        frame(0);
      } else {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(loop);
      }
    };

    const primary = new Image();
    primary.onload = () => begin(primary);
    primary.onerror = () => {
      const fb = new Image();
      fb.onload = () => begin(fb);
      fb.src = fallbackHands;
    };
    primary.src = PRIMARY_SRC;

    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (mouse.px > -9000) {
        const dx = x - mouse.px;
        const dy = y - mouse.py;
        mouse.speed = Math.min(120, Math.sqrt(dx * dx + dy * dy) + mouse.speed * 0.5);
      }
      mouse.px = x;
      mouse.py = y;
      mouse.x = x;
      mouse.y = y;
      mouse.active = y >= 0 && y <= H && x >= 0 && x <= W;
    };
    const onPointerLeave = () => {
      mouse.active = false;
      mouse.px = -9999;
      mouse.py = -9999;
    };

    const resizeObserver = new ResizeObserver(() => {
      layoutParticles();
      if (reducedMotion) frame(0);
    });
    resizeObserver.observe(container);

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
    });
    intersectionObserver.observe(container);

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointercancel", onPointerLeave, { passive: true });
    document.documentElement.addEventListener("mouseleave", onPointerLeave);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointercancel", onPointerLeave);
      document.documentElement.removeEventListener("mouseleave", onPointerLeave);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-x-0 top-0 overflow-hidden pointer-events-none z-[5]"
      style={{ height: "75vh" }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" aria-hidden="true" />

      {/* Fade edges into the hero background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-background to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-background to-transparent" />
        <div className="absolute top-0 left-0 bottom-0 w-16 bg-gradient-to-r from-background to-transparent" />
        <div className="absolute top-0 right-0 bottom-0 w-16 bg-gradient-to-l from-background to-transparent" />
      </div>
    </div>
  );
};
