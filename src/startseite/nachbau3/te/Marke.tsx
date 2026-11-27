import { useEffect, useRef } from "react";
import { Tinte, ZEICHEN, imTakt, ruhig, type Art } from "./tinte";

/** Ein Zeichen aus Tinte auf einer eigenen Leinwand. Läuft nur, solange es im Bild ist.
 *  `spanne` = wie viele Bühnen-Einheiten in die Breite passen (2,2 ≈ das Zeichen füllt die Leinwand).
 *  `immer` = läuft, solange es eingehängt ist, auch wenn es gerade verdeckt oder ausgeschnitten ist (für Stellen, an
 *  denen zwei Fassungen deckungsgleich übereinanderliegen und im Gleichschritt bleiben müssen, z. B. Sektion 63.1). */
export function TeMarke({ art, className = "", spanne = 2.2, hoch = 1.58, farbe = "#000", hand = true, immer = false }: { art: Art; className?: string; spanne?: number; hoch?: number; farbe?: string; hand?: boolean; immer?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const tinte = useRef<Tinte | null>(null);
  const farbeRef = useRef(farbe);
  farbeRef.current = farbe;

  useEffect(() => {
    tinte.current?.wechsle(ZEICHEN[art]);
  }, [art]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const c = cv.getContext("2d");
    if (!c) return;
    const still = ruhig();
    const t = (tinte.current = new Tinte(ZEICHEN[art], still));
    let w = 0, h = 0, s = 1;
    const male = () => {
      const k = Math.min(2, devicePixelRatio || 1);
      const nw = cv.offsetWidth, nh = cv.offsetHeight;
      if (!nw || !nh) return;
      if (nw !== w || nh !== h || cv.width !== Math.round(nw * k)) {
        w = nw; h = nh;
        cv.width = Math.round(w * k); cv.height = Math.round(h * k);
        s = Math.min(w / spanne, h / hoch);
      }
      c.setTransform(k, 0, 0, k, 0, 0);
      c.clearRect(0, 0, w, h);
      t.male(c, w / 2, h / 2, s, farbeRef.current);
    };
    male();
    let ab: (() => void) | null = null;
    const zeiger = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) / s, y = (e.clientY - r.top - r.height / 2) / s;
      t.hand = Math.abs(x) < 2 && Math.abs(y) < 2 ? { x, y } : null;
    };
    const beob = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !ab) {
        ab = imTakt((dt) => { t.vor(dt); male(); });
        if (hand && !still) addEventListener("pointermove", zeiger, { passive: true });
      } else if (!e.isIntersecting && ab) {
        ab(); ab = null;
        removeEventListener("pointermove", zeiger);
      }
    });
    if (immer) {
      ab = imTakt((dt) => { t.vor(dt); male(); });
      if (hand && !still) addEventListener("pointermove", zeiger, { passive: true });
    } else beob.observe(cv);
    const gr = new ResizeObserver(male);
    gr.observe(cv);
    return () => { beob.disconnect(); gr.disconnect(); ab?.(); removeEventListener("pointermove", zeiger); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={ref} className={`te-marke ${className}`} aria-hidden="true" />;
}
