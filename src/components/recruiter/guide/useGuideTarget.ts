import { useEffect, useState } from 'react';
import type { TourRect } from '@/lib/recruiterGuide';

/** So lange wartet der Rundgang auf ein Ziel, das die Seite erst nach dem Laden zeigt. */
const WAIT_MS = 4000;
const TICK_MS = 120;
/** Unterhalb davon verdeckt die feste Kopfzeile das Ziel. */
const HEADER = 72;

export interface GuideTarget { el: HTMLElement | null; rect: TourRect | null; waiting: boolean }

const visible = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
const same = (a: TourRect | null, b: DOMRect) => !!a && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;

/**
 * Findet das Ziel eines Schritts und verfolgt seine Lage. Seiten laden ihre Daten
 * nach; deshalb wird kurz gewartet, solange das Ziel noch gar nicht im DOM ist.
 * Ein vorhandenes, aber verstecktes Ziel (Seitenmenü am Handy) gilt sofort als fehlend.
 */
export function useGuideTarget(selector: string | undefined, stepKey: string): GuideTarget {
  const [target, setTarget] = useState<GuideTarget>({ el: null, rect: null, waiting: !!selector });

  useEffect(() => {
    if (!selector) { setTarget({ el: null, rect: null, waiting: false }); return; }
    const started = performance.now();
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let el: HTMLElement | null = null;
    let scrolled = false;
    setTarget({ el: null, rect: null, waiting: true });

    const tick = () => {
      if (!el || !el.isConnected || !visible(el)) {
        const all = Array.from(document.querySelectorAll<HTMLElement>(selector));
        el = all.find(visible) ?? null;
        if (!el) {
          const waiting = !all.length && performance.now() - started < WAIT_MS;
          setTarget(prev => (prev.el === null && prev.rect === null && prev.waiting === waiting ? prev : { el: null, rect: null, waiting }));
          return;
        }
      }
      if (!scrolled) {
        scrolled = true;
        const r = el.getBoundingClientRect();
        if (r.top < HEADER || r.bottom > window.innerHeight - 16) el.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
      }
      const r = el.getBoundingClientRect();
      const found = el;
      setTarget(prev => (prev.el === found && same(prev.rect, r) ? prev : { el: found, rect: { top: r.top, left: r.left, width: r.width, height: r.height }, waiting: false }));
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
