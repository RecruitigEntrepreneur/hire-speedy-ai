// Gemeinsame Grundlage für die Nachbauten der Vorbild-Sektionen.
import { Poppins, Source_Serif_4 } from "@/startseite/shims/schriften";
import { useEffect, useRef, useState, type RefObject } from "react";

export const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-poppins" });
export const serif = Source_Serif_4({ subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"], variable: "--font-serif" });
export const SCHRIFTEN = `${poppins.variable} ${serif.variable}`;
// Knopf-Ziele (26.11.2026, Marko). Kunden: öffentlicher Aufnahme-Link aus Admin → Aufnahme-Links (Typ „Öffentlich“,
// „Website“): ohne Konto, jeder Klick bekommt einen eigenen Entwurf. Headhunter: öffentliche Bewerbung in der App
// (E-Mail + Code, keine Einladung nötig). Ändert sich ein Link, nur hier ändern.
export const START_URL = "/start/Z6qSh0pPUfyjHWa8IIHLJ-8rlLPCByws6TVTkj-SL3Y";
export const BEWERBEN_URL = "/recruiter/onboarding";
export const HH_ANMELDEN_URL = "/recruiter/login";

/** true, sobald das Element einmal im Bild war (für Animationen, die beim Hineinscrollen starten). */
export function useSichtbar<T extends HTMLElement>(schwelle = 0.25): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [da, setDa] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const b = new IntersectionObserver(([e]) => e.isIntersecting && setDa(true), { threshold: schwelle });
    b.observe(el);
    return () => b.disconnect();
  }, [schwelle]);
  return [ref, da];
}

/** Scroll-Fortschritt eines Elements: 0 = Oberkante kommt unten ins Bild, 1 = Unterkante verlässt es oben.
 *  Schreibt zusätzlich --p auf das Element, damit CSS damit rechnen kann (calc(var(--p) * …)). */
export function useFortschritt<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let bild = 0;
    const mess = () => {
      bild = 0;
      const r = el.getBoundingClientRect();
      const wert = Math.max(0, Math.min(1, (window.innerHeight - r.top) / (window.innerHeight + r.height)));
      el.style.setProperty("--p", wert.toFixed(4));
      setP(wert);
    };
    const an = () => { if (!bild) bild = requestAnimationFrame(mess); };
    mess();
    window.addEventListener("scroll", an, { passive: true });
    window.addEventListener("resize", an);
    return () => { window.removeEventListener("scroll", an); window.removeEventListener("resize", an); cancelAnimationFrame(bild); };
  }, []);
  return [ref, p];
}
