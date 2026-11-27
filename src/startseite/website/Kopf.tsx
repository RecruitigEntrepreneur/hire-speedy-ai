// Kopfzeile der Website (Kopf A, 27.11.2026): Logo, Navigation, „Anmelden ▾“ (Unternehmen / Headhunter), Sprache,
// Knopf. Unter 1100 px statt der Einträge ein Menü (☰), das alles enthält – auch den Knopf. Der Rahmen hält die
// Leiste beim Scrollen oben fest. `art`: Kunden-Seiten oder Headhunter-Seite (andere Einträge und anderer Knopf).
import { useEffect, useRef, useState, type RefObject } from "react";
import { MatchuntLogo } from "@/startseite/seite/Logo";
import { BEWERBEN_URL, START_URL } from "@/startseite/nachbau/basis";
import { texte } from "./texte";
import { useSeitenSprache } from "./kontext";
import { SprachMenue } from "./SprachMenue";
import { SEITEN } from "./adressen";

/** Schließt bei Klick daneben und bei Escape. */
function useAuf<T extends HTMLElement>(): [boolean, (v: boolean) => void, RefObject<T | null>] {
  const [auf, setAuf] = useState(false);
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!auf) return;
    const draussen = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAuf(false); };
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") setAuf(false); };
    document.addEventListener("mousedown", draussen);
    document.addEventListener("keydown", taste);
    return () => { document.removeEventListener("mousedown", draussen); document.removeEventListener("keydown", taste); };
  }, [auf]);
  return [auf, setAuf, ref];
}

const Pfeil = () => <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;

export function Kopf({ art = "kunde", aktiv }: { art?: "kunde" | "headhunter"; aktiv?: "headhunter" }) {
  const code = useSeitenSprache() ?? "de";
  const t = texte(code).kopf;
  const hh = art === "headhunter";
  const nav: [string, string][] = hh
    ? [[t.ablauf, "#ablauf"], [t.verdienst, "#verdienst"], [t.unternehmen, SEITEN.start]]
    : [[t.ablauf, SEITEN.ablauf], [t.honorar, SEITEN.honorar], [t.headhunter, SEITEN.headhunter]];
  const anmelden: [string, string][] = hh
    ? [[t.alsHeadhunter, SEITEN.anmeldenHeadhunter], [t.alsUnternehmen, SEITEN.anmeldenUnternehmen]]
    : [[t.alsUnternehmen, SEITEN.anmeldenUnternehmen], [t.alsHeadhunter, SEITEN.anmeldenHeadhunter]];
  const knopf: [string, string] = hh ? [t.bewerben, BEWERBEN_URL] : [t.knopf, START_URL];
  const [anmAuf, setAnmAuf, anmRef] = useAuf<HTMLDivElement>();
  const [menueAuf, setMenueAuf, menueRef] = useAuf<HTMLElement>();

  return (
    <header className="mw-kopf" ref={menueRef}>
      <div className="mu-wrap mw-kopf-innen">
        <a className="mw-kopf-logo" href={SEITEN.start} aria-label={t.startseite}><MatchuntLogo size={30} />Matchunt</a>
        <nav className="mw-kopf-nav" aria-label={t.navigation}>
          {nav.map(([n, h]) => (
            <a key={h} href={h} aria-current={!hh && aktiv === "headhunter" && h === SEITEN.headhunter ? "page" : undefined}>{n}</a>
          ))}
          <div className="mw-kopf-anm" ref={anmRef}>
            <button type="button" aria-expanded={anmAuf} onClick={() => setAnmAuf(!anmAuf)}>{t.anmelden}<Pfeil /></button>
            {anmAuf && (
              <ul className="mw-kopf-liste">
                {anmelden.map(([n, h]) => <li key={h}><a href={h}>{n}</a></li>)}
              </ul>
            )}
          </div>
        </nav>
        <SprachMenue art="kopf" />
        <a className="mu-knopf mw-kopf-knopf" href={knopf[1]}>{knopf[0]}</a>
        <button type="button" className="mw-kopf-menue" aria-expanded={menueAuf} aria-label={menueAuf ? t.menueZu : t.menueAuf} onClick={() => setMenueAuf(!menueAuf)}>
          <span /><span />
        </button>
      </div>
      {menueAuf && (
        <div className="mw-kopf-blatt">
          <nav className="mu-wrap" aria-label={t.navigation}>
            {nav.map(([n, h]) => <a key={h} href={h} onClick={() => setMenueAuf(false)}>{n}</a>)}
            <p className="mw-kopf-blatt-titel">{t.anmelden}</p>
            {anmelden.map(([n, h]) => <a key={h} className="mw-kopf-blatt-klein" href={h}>{n}</a>)}
            <a className="mu-knopf" href={knopf[1]}>{knopf[0]}</a>
          </nav>
        </div>
      )}
    </header>
  );
}
