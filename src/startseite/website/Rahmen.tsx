// Rahmen einer Website-Seite: Sprache für alle Bausteine, Hinweisleiste oben, Fuß und Einwilligung unten.
// Jeder Klick auf einen Link bekommt die Herkunft mit (Kampagnen-Quelle, Sprache für die App) – ohne Speicher im Browser.
import { useEffect, useRef, type ReactNode } from "react";
import type { Code } from "./sprachen";
import { KopfImRahmen, SeitenSprache } from "./kontext";
import { SprachHinweis } from "./SprachHinweis";
import { Fuss } from "./Fuss";
import { mitHerkunft } from "./herkunft";
import "./website.css";

/** `kopf`: Kopfzeile der Seite (website/Kopf). Der Rahmen hält sie beim Scrollen oben fest; Sektionen mit eigener
 *  Leiste (Einstieg K1) lassen ihre dann weg. */
export function Rahmen({ code, stil, modus, kopf, children }: { code: Code; stil: string; modus: string; kopf?: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  // Sprache der ganzen Seite (für Google und Vorlesen), nicht nur des Rahmens.
  useEffect(() => { document.documentElement.lang = code; }, [code]);

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
        {kopf && <div className="mu mw-kopf-halter" data-stil={stil} data-modus={modus}>{kopf}</div>}
        {/* Mindesthöhe: Im Labor laden die Sektionen nach, so springt der Fuß nicht nach oben */}
        <KopfImRahmen.Provider value={!!kopf}><div className="mw-inhalt">{children}</div></KopfImRahmen.Provider>
        <div className="mu" data-stil={stil} data-modus={modus}>
          <Fuss />
        </div>
      </div>
    </SeitenSprache.Provider>
  );
}
