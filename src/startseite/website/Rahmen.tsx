// Rahmen einer Website-Seite: Sprache für alle Bausteine, Hinweisleiste oben, Fuß und Einwilligung unten.
// Jeder Klick auf einen Link bekommt die Herkunft mit (Kampagnen-Quelle, Sprache für die App) – ohne Speicher im Browser.
import { useEffect, useRef, type ReactNode } from "react";
import type { Code } from "./sprachen";
import { SeitenSprache } from "./kontext";
import { SprachHinweis } from "./SprachHinweis";
import { Fuss } from "./Fuss";
import { mitHerkunft } from "./herkunft";
import "./website.css";

export function Rahmen({ code, stil, modus, children }: { code: Code; stil: string; modus: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const klick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (a) a.setAttribute("href", mitHerkunft(a.getAttribute("href") ?? ""));
    };
    el.addEventListener("click", klick, true);
    return () => el.removeEventListener("click", klick, true);
  }, []);

  return (
    <SeitenSprache.Provider value={code}>
      <div ref={ref} className="mw" lang={code} data-mu-sprache={code}>
        <div className="mu" data-stil={stil} data-modus={modus}><SprachHinweis /></div>
        {/* Mindesthöhe: Im Labor laden die Sektionen nach, so springt der Fuß nicht nach oben */}
        <div className="mw-inhalt">{children}</div>
        <div className="mu" data-stil={stil} data-modus={modus}>
          <Fuss />
        </div>
      </div>
    </SeitenSprache.Provider>
  );
}
