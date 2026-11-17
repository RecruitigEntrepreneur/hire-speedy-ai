import { useEffect, useState } from 'react';
import type { TourRect } from '@/lib/recruiterGuide';

/** So lange wartet der Rundgang auf ein Ziel, das die Seite erst nach dem Laden zeigt. */
const WAIT_MS = 4000;
const TICK_MS = 120;
/** Unterhalb davon verdeckt die feste Kopfzeile das Ziel. */
/** Kopfzeile (64 px) plus mitlaufende Leiste im Bewerberprofil (52 px): Ziele darunter werden hergeholt. */
const HEADER = 124;
/** So lange muss das Ziel still stehen, bevor die Karte erscheint (Laden, Scrollen, Fenster öffnet). */
const SETTLE_MS = 250;
/** Spätestens dann erscheint die Karte, auch wenn sich das Ziel noch bewegt. */
const SETTLE_MAX_MS = 1500;

export interface GuideTarget {
  el: HTMLElement | null;
  rect: TourRect | null;
  waiting: boolean;
  /**
   * Das Ziel steht still (oder es gibt keins mehr zu suchen). Erst dann zeigt sich die Karte,
   * direkt an ihrem Platz: Sonst stünde sie kurz in der Mitte und glitte jeder Verschiebung nach.
   * Einmal erreicht, bleibt es für den Schritt; danach folgt die Karte dem Ziel ohne Verzögerung.
   */
  settled: boolean;
  /** Für welchen Schritt dieser Stand gilt: Beim Schrittwechsel zählt der alte nicht. */
  key: string;
}

const visible = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
const same = (a: TourRect | null, b: DOMRect) => !!a && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;

/**
 * Findet das Ziel eines Schritts und verfolgt seine Lage. Seiten laden ihre Daten
 * nach; deshalb wird kurz gewartet, solange das Ziel noch gar nicht im DOM ist.
 * Ein vorhandenes, aber verstecktes Ziel (Seitenmenü am Handy) gilt sofort als fehlend.
 */
export function useGuideTarget(selector: string | undefined, stepKey: string): GuideTarget {
  const [target, setTarget] = useState<GuideTarget>({ el: null, rect: null, waiting: !!selector, settled: !selector, key: stepKey });

  useEffect(() => {
    if (!selector) { setTarget({ el: null, rect: null, waiting: false, settled: true, key: stepKey }); return; }
    let started = performance.now();
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let el: HTMLElement | null = null;
    let scrolled = false;
    let foundAt = 0;
    let changedAt = 0;
    let last: TourRect | null = null;
    let settled = false;
    /** Musste gescrollt werden, wartet die Karte das Ende ab; sonst reicht ein ruhiger Takt. */
    let moved = false;
    setTarget({ el: null, rect: null, waiting: true, settled: false, key: stepKey });

    const tick = () => {
      if (!el || !el.isConnected || !visible(el)) {
        // Das Ziel war da und ist weg (Seitenwechsel, Fenster schließt): wieder warten, nicht „fehlt“
        // melden. Sonst setzte sich die Karte für einen Augenblick in die Bildmitte.
        if (foundAt) { foundAt = 0; settled = false; last = null; started = performance.now(); }
        const all = Array.from(document.querySelectorAll<HTMLElement>(selector));
        el = all.find(visible) ?? null;
        if (!el) {
          const waiting = !all.length && performance.now() - started < WAIT_MS;
          // Ohne Ziel nach der Wartezeit: Die Karte erscheint in der Mitte.
          const ready = settled || !waiting;
          setTarget(prev => (prev.el === null && prev.rect === null && prev.waiting === waiting && prev.settled === ready && prev.key === stepKey ? prev : { el: null, rect: null, waiting, settled: ready, key: stepKey }));
          return;
        }
      }
      if (!scrolled) {
        scrolled = true;
        const r = el.getBoundingClientRect();
        if (r.top < HEADER || r.bottom > window.innerHeight - 16) {
          moved = true;
          el.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
        }
      }
      const r = el.getBoundingClientRect();
      const found = el;
      const now = performance.now();
      if (!foundAt) foundAt = now;
      if (!same(last, r)) { changedAt = now; last = { top: r.top, left: r.left, width: r.width, height: r.height }; }
      if (!settled && (now - changedAt >= (moved ? SETTLE_MS : TICK_MS - 10) || now - foundAt >= SETTLE_MAX_MS)) settled = true;
      const ready = settled;
      setTarget(prev => (prev.el === found && same(prev.rect, r) && prev.settled === ready && prev.key === stepKey ? prev : { el: found, rect: { top: r.top, left: r.left, width: r.width, height: r.height }, waiting: false, settled: ready, key: stepKey }));
    };

    tick();
    const interval = window.setInterval(tick, TICK_MS);
    window.addEventListener('resize', tick);
    window.addEventListener('scroll', tick, true);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('resize', tick);
      window.removeEventListener('scroll', tick, true);
    };
  }, [selector, stepKey]);

  return target;
}
