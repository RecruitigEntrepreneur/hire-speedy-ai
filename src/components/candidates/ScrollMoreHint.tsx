import { useEffect, useState, type RefObject } from 'react';

/**
 * Blättern in einer seitlich scrollenden Kartenreihe (14.10.2026, Aktive Prozesse
 * und Aufgaben nebeneinander im Kandidatenprofil):
 * - „‹ N“ links und „N ›“ rechts: wie viele Karten davor/dahinter liegen, Klick blättert kartengenau
 * - mit der Maus greifen und ziehen; ein Klick nach dem Ziehen öffnet keine Karte
 * - nach dem Ziehen rastet die Reihe an einer Kartenkante ein
 * Die Reihe braucht `snap-x snap-mandatory scroll-pl-10`, die Karten `snap-start`.
 */
export function ScrollMoreHint({ scrollRef, gap = 8 }: { scrollRef: RefObject<HTMLDivElement>; gap?: number }) {
  const [hiddenLeft, setHiddenLeft] = useState(0);
  const [hiddenRight, setHiddenRight] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const { step, width, viewLeft, viewRight } = geometry(el, gap);
      let left = 0;
      let right = 0;
      // Verdeckt ist eine Karte erst, wenn ihre Mitte außer Sicht ist
      for (let i = 0; step && i < el.children.length; i++) {
        const center = i * step + width / 2;
        if (center < viewLeft) left++;
        else if (center > viewRight) right++;
      }
      setHiddenLeft(left);
      setHiddenRight(right);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const mo = new MutationObserver(update);
    mo.observe(el, { childList: true });
    return () => { el.removeEventListener('scroll', update); ro.disconnect(); mo.disconnect(); };
  }, [scrollRef, gap]);

  // Ziehen mit der Maus (Touch scrollt ohnehin selbst)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let startX = 0;
    let startLeft = 0;
    let pressed = false;
    let dragging = false;

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || el.scrollWidth <= el.clientWidth) return;
      pressed = true;
      dragging = false;
      startX = e.clientX;
      startLeft = el.scrollLeft;
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp, { once: true });
    };
    const onMove = (e: PointerEvent) => {
      if (!pressed) return;
      const dx = e.clientX - startX;
      if (!dragging && Math.abs(dx) < 5) return;
      if (!dragging) {
        dragging = true;
        el.style.scrollSnapType = 'none';
        el.style.userSelect = 'none';
        el.classList.add('[&_*]:!cursor-grabbing', '!cursor-grabbing');
      }
      el.scrollLeft = startLeft - dx;
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      pressed = false;
      if (!dragging) return;
      dragging = false;
      el.style.userSelect = '';
      el.classList.remove('[&_*]:!cursor-grabbing', '!cursor-grabbing');
      // Der Klick nach dem Loslassen gehört zum Ziehen, nicht zur Karte
      const swallow = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
      el.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => el.removeEventListener('click', swallow, true), 0);
      const { step, pad } = geometry(el, gap);
      const index = step ? Math.round((el.scrollLeft + pad) / step) : 0;
      el.style.scrollSnapType = '';
      el.scrollTo({ left: snapLeft(index, step, pad), behavior: 'smooth' });
    };

    el.addEventListener('pointerdown', onDown);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [scrollRef, gap]);

  const page = (direction: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const { step, pad, width, viewLeft, viewRight } = geometry(el, gap);
    if (!step) return;
    const count = el.children.length;
    const indices = Array.from({ length: count }, (_, i) => i);
    let target: number;
    if (direction === 1) {
      // Die erste nicht ganz sichtbare Karte rückt nach links
      target = indices.find(i => i * step + width > viewRight + 1) ?? count - 1;
    } else {
      // Eine Seite zurück: die erste ganz sichtbare Karte rückt nach rechts
      const firstFull = indices.find(i => i * step >= viewLeft - 1) ?? count - 1;
      target = Math.max(0, firstFull - Math.max(1, Math.floor((el.clientWidth + gap) / step)));
    }
    el.scrollTo({ left: snapLeft(target, step, pad), behavior: 'smooth' });
  };

  return (
    <>
      {hiddenLeft > 0 && (
        <button
          type="button"
          onClick={() => page(-1)}
          className="absolute bottom-0 left-0 top-0 z-20 flex items-center bg-gradient-to-r from-card via-card/90 to-transparent pl-1 pr-4 text-xs font-medium text-muted-foreground hover:text-foreground"
          aria-label={`${hiddenLeft} vorherige anzeigen`}
        >
          ‹ {hiddenLeft}
        </button>
      )}
      {hiddenRight > 0 && (
        <button
          type="button"
          onClick={() => page(1)}
          className="absolute bottom-0 right-0 top-0 z-20 flex items-center bg-gradient-to-l from-card via-card/90 to-transparent pl-8 pr-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          aria-label={`${hiddenRight} weitere anzeigen`}
        >
          {hiddenRight} ›
        </button>
      )}
    </>
  );
}

/**
 * Kartenbreite, Schritt inkl. Abstand, linke Scroll-Polsterung (Platz für „‹ N“)
 * und der sichtbare Bereich der Reihe.
 */
function geometry(el: HTMLElement, gap: number) {
  const first = el.firstElementChild as HTMLElement | null;
  const width = first?.offsetWidth ?? 0;
  const pad = parseFloat(getComputedStyle(el).scrollPaddingLeft) || 0;
  return {
    width,
    step: width ? width + gap : 0,
    pad,
    viewLeft: el.scrollLeft < 2 ? 0 : el.scrollLeft + pad,
    viewRight: el.scrollLeft + el.clientWidth,
  };
}

/** Scroll-Position, an der Karte `index` links (hinter „‹ N“) einrastet. */
function snapLeft(index: number, step: number, pad: number) {
  return index <= 0 ? 0 : index * step - pad;
}
