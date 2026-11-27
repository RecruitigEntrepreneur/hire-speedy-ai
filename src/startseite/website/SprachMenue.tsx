// Sprachmenü mit Fahnen – dieselben sechs Einträge wie in der App. In der Kopfzeile Fahne + Kürzel
// (am Handy als Auswahl von unten), im Fuß und in der Einwilligung Fahne + Name.
// Die Einträge sind echte Links mit hreflang; beim Klick wird die Wahl gemerkt (Cookie, ohne Einwilligung erlaubt).
import { useEffect, useRef, useState } from "react";
import { COOKIE_SPRACHE, SPRACHEN, WURZEL, adresse, sprache as def, type Code } from "./sprachen";
import { texte } from "./texte";
import { useSeitenSprache } from "./kontext";

// Fahnen als SVG auf festem 20×14-Raster: Streifen und Kreuze liegen auf ganzen Pixeln (crispEdges), dadurch scharf.
const FAHNE: Record<string, React.ReactNode> = {
  de: <><rect width="20" height="14" fill="#000" /><rect y="4.67" width="20" height="4.67" fill="#dd0000" /><rect y="9.33" width="20" height="4.67" fill="#ffce00" /></>,
  at: <><rect width="20" height="14" fill="#ed2939" /><rect y="4.67" width="20" height="4.67" fill="#fff" /></>,
  // Schweiz, Version C (24.11.2026): kräftiges Kreuz, 3 dick und 9 lang, genau mittig. Die Kanten liegen auf halben
  // Pixeln – auf Retina-Bildschirmen sind das ganze Gerätepixel, deshalb hier ohne crispEdges.
  ch: <g shapeRendering="geometricPrecision"><rect width="20" height="14" fill="#da291c" /><rect x="8.5" y="2.5" width="3" height="9" fill="#fff" /><rect x="5.5" y="5.5" width="9" height="3" fill="#fff" /></g>,
  gb: <>
    <rect width="20" height="14" fill="#012169" />
    <path d="M0 0l20 14M20 0L0 14" stroke="#fff" strokeWidth="2.8" shapeRendering="geometricPrecision" />
    <path d="M0 0l20 14M20 0L0 14" stroke="#c8102e" strokeWidth="1" shapeRendering="geometricPrecision" />
    <rect x="7" width="6" height="14" fill="#fff" /><rect y="4" width="20" height="6" fill="#fff" />
    <rect x="8" width="4" height="14" fill="#c8102e" /><rect y="5" width="20" height="4" fill="#c8102e" />
  </>,
  se: <><rect width="20" height="14" fill="#006aa7" /><rect x="6" width="3" height="14" fill="#fecc00" /><rect y="5.5" width="20" height="3" fill="#fecc00" /></>,
  no: <><rect width="20" height="14" fill="#ba0c2f" /><rect x="5" width="4" height="14" fill="#fff" /><rect y="5" width="20" height="4" fill="#fff" /><rect x="6" width="2" height="14" fill="#00205b" /><rect y="6" width="20" height="2" fill="#00205b" /></>,
};
export const Flagge = ({ f }: { f: string }) => (
  <svg className="mw-flagge" viewBox="0 0 20 14" width="20" height="14" shapeRendering="crispEdges" aria-hidden="true">{FAHNE[f]}</svg>
);

export function merken(code: Code) {
  document.cookie = `${COOKIE_SPRACHE}=${def(code).slug}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/** Zur selben Seite in einer anderen Sprache (Quelle und Anker bleiben). */
export function wechseln(code: Code) {
  merken(code);
  const pfad = window.location.pathname;
  // Startseite mit Sprache in der Adresse (/w/…): zur Adresse der anderen Sprache. Unterseiten (Rechtstexte,
  // Headhunter) und die App-Startseite „/“ bleiben, wo sie sind; die Sprache kommt dort aus dem gemerkten Cookie.
  if (pfad === WURZEL || pfad.startsWith(`${WURZEL}/`)) window.location.assign(adresse(def(code)) + window.location.search + window.location.hash);
  else window.location.reload();
}

const Pfeil = () => <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const Haken = () => <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="m2.5 6.3 2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;

export function SprachMenue({ art }: { art: "kopf" | "fuss" | "dialog" }) {
  const code = useSeitenSprache();
  const [offen, setOffen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!offen) return;
    const draussen = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOffen(false); };
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOffen(false); } };
    document.addEventListener("mousedown", draussen);
    document.addEventListener("keydown", taste, true);
    return () => { document.removeEventListener("mousedown", draussen); document.removeEventListener("keydown", taste, true); };
  }, [offen]);

  if (!code) return null;
  const s = def(code);
  const t = texte(code);
  return (
    <div ref={ref} className="mw-sprache" data-art={art}>
      <button type="button" className="mw-sprache-knopf" aria-expanded={offen} aria-label={`${t.menue}: ${s.name}`} onClick={() => setOffen(!offen)}>
        <Flagge f={s.flagge} /><span>{art === "kopf" ? s.kurz : s.name}</span><Pfeil />
      </button>
      {offen && (
        <>
          <div className="mw-sprache-grund" aria-hidden="true" onClick={() => setOffen(false)} />
          <ul className="mw-sprache-liste" aria-label={t.menue}>
            <li className="mw-sprache-titel" aria-hidden="true">{t.menue}</li>
            {SPRACHEN.map((x) => (
              <li key={x.code}>
                <a href={adresse(x)} hrefLang={x.code} lang={x.code} aria-current={x.code === code ? "true" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    if (x.code === code) setOffen(false); else wechseln(x.code);
                  }}>
                  <Flagge f={x.flagge} />{x.name}{x.code === code && <Haken />}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
