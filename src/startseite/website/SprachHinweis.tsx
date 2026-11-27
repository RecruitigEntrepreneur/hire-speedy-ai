// Hinweisleiste wie bei Apple: Passt die Seite nicht zur Browsersprache, steht oben einmal ein Hinweis
// in der Sprache des Browsers – mit Auswahl, Knopf und ×. Mit × verschwindet sie für immer (Cookie).
import { useState, useSyncExternalStore } from "react";
import { COOKIE_HINWEIS, COOKIE_SPRACHE, SPRACHEN, ausBrowser, sprache as def, type Code } from "./sprachen";
import { texte } from "./texte";
import { useSeitenSprache } from "./kontext";
import { Flagge, wechseln } from "./SprachMenue";

const keinAbo = () => () => {};

/** Browsersprache, falls wir sie anbieten, der Besucher noch nicht selbst gewählt und den Hinweis nicht weggeklickt hat; sonst "". */
function vorschlag(): string {
  if (typeof navigator === "undefined" || typeof document === "undefined") return "";
  const cookies = document.cookie.split("; ");
  if (cookies.some((c) => c.startsWith(`${COOKIE_HINWEIS}=`) || c.startsWith(`${COOKIE_SPRACHE}=`))) return "";
  const liste = navigator.languages?.length ? navigator.languages : [navigator.language];
  return ausBrowser(liste) ?? "";
}

export function SprachHinweis() {
  const code = useSeitenSprache();
  const browser = useSyncExternalStore(keinAbo, vorschlag, () => "") as Code | "";
  const [weg, setWeg] = useState(false);
  const [wahl, setWahl] = useState<Code | "">("");
  if (!code || !browser || weg || def(browser).basis === def(code).basis) return null;

  const ziel = def(wahl || browser);
  const zu = () => {
    document.cookie = `${COOKIE_HINWEIS}=1; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    setWeg(true);
  };
  return (
    <div className="mw-hinweis" lang={browser} role="region" aria-label={def(browser).hinweis.text}>
      <div className="mu-wrap mw-hinweis-innen">
        <span className="mw-hinweis-text">{def(browser).hinweis.text}</span>
        <label className="mw-hinweis-wahl">
          <Flagge f={ziel.flagge} />
          <select value={ziel.code} onChange={(e) => setWahl(e.target.value as Code)} aria-label={texte(browser).menue}>
            {SPRACHEN.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
          </select>
        </label>
        <button type="button" className="mw-knopf voll klein" onClick={() => wechseln(ziel.code)}>{ziel.hinweis.aktion}</button>
        <button type="button" className="mw-zu" aria-label={texte(browser).hinweisSchliessen} onClick={zu}>
          <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
      </div>
    </div>
  );
}
