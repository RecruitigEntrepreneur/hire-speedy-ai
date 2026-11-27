// Fuß der Website (Fuß A, 27.11.2026): Marke mit Kontakt, drei Spalten (Plattform, Unternehmen, Rechtliches) – nur
// Seiten, die es gibt –, darunter die Firmenzeile mit © und die Sprache. „Cookie-Einstellungen“ öffnet die Zentrale.
import { MatchuntLogo } from "@/startseite/seite/Logo";
import { RECHT, texte } from "./texte";
import { useSeitenSprache } from "./kontext";
import { SprachMenue } from "./SprachMenue";
import { zentraleOeffnen } from "./einwilligung";
import { KONTAKT, SEITEN } from "./adressen";

export function Fuss() {
  const code = useSeitenSprache() ?? "de";
  const alle = texte(code);
  const t = alle.fuss;
  const k = alle.kopf;
  return (
    <footer className="mw-fuss">
      <div className="mu-wrap">
        <div className="mw-fuss-raster">
          <div className="mw-fuss-spalte mw-fuss-erste">
            <a className="mw-fuss-marke" href={SEITEN.start} aria-label={k.startseite}><MatchuntLogo size={24} />Matchunt</a>
            <p>{t.satz}</p>
            <a href={`mailto:${KONTAKT.email}`}>{KONTAKT.email}</a>
            <a href={KONTAKT.telefonLink}>{KONTAKT.telefon}</a>
          </div>
          <nav className="mw-fuss-spalte" aria-label={t.plattform}>
            <b>{t.plattform}</b>
            <a href={SEITEN.ablauf}>{k.ablauf}</a>
            <a href={SEITEN.honorar}>{k.honorar}</a>
            <a href={SEITEN.headhunter}>{k.headhunter}</a>
          </nav>
          <nav className="mw-fuss-spalte" aria-label={t.firma}>
            <b>{t.firma}</b>
            <a href={SEITEN.karriere}>{t.karriere}</a>
            <a href={SEITEN.anmeldenUnternehmen}>{t.anmeldenUnternehmen}</a>
            <a href={SEITEN.anmeldenHeadhunter}>{t.anmeldenHeadhunter}</a>
          </nav>
          <nav className="mw-fuss-spalte" aria-label={t.rechtliches}>
            <b>{t.rechtliches}</b>
            <a href={RECHT.impressum}>{t.impressum}</a>
            <a href={RECHT.datenschutz}>{t.datenschutz}</a>
            <a href={RECHT.agb}>{t.agb}</a>
            <button type="button" onClick={zentraleOeffnen}>{t.cookies}</button>
          </nav>
        </div>
        <div className="mw-fuss-unten">
          <span>{t.zeile.replace("{jahr}", String(new Date().getFullYear()))}</span>
          <SprachMenue art="fuss" />
        </div>
      </div>
    </footer>
  );
}
