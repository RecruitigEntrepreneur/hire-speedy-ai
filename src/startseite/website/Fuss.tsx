// Fuß der Website: Impressum, Datenschutz, AGB, „Cookie-Einstellungen“ (öffnet die Zentrale) und die Sprache.
import { MatchuntLogo } from "@/startseite/seite/Logo";
import { RECHT, texte } from "./texte";
import { useSeitenSprache } from "./kontext";
import { SprachMenue } from "./SprachMenue";
import { zentraleOeffnen } from "./einwilligung";

export function Fuss() {
  const code = useSeitenSprache() ?? "de";
  const t = texte(code).fuss;
  return (
    <footer className="mw-fuss">
      <div className="mu-wrap mw-fuss-innen">
        <span className="mw-fuss-marke"><MatchuntLogo size={22} />Matchunt</span>
        <nav className="mw-fuss-links" aria-label={t.impressum}>
          <a href={RECHT.impressum}>{t.impressum}</a>
          <a href={RECHT.datenschutz}>{t.datenschutz}</a>
          <a href={RECHT.agb}>{t.agb}</a>
          <button type="button" onClick={zentraleOeffnen}>{t.cookies}</button>
        </nav>
        <SprachMenue art="fuss" />
      </div>
    </footer>
  );
}
