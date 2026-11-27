// Blauer Abschluss-Aufruf vor dem Fuß (Fuß A, 27.11.2026): ein Satz, der Knopf, darunter eine kleine Zeile.
// Startseite: für Kunden („Stelle kostenlos ausschreiben“), Headhunter-Seite: „Als Headhunter bewerben“.
import { BEWERBEN_URL, START_URL } from "@/startseite/nachbau/basis";
import { texte } from "./texte";
import { useSeitenSprache } from "./kontext";

export function Abschluss({ art = "kunde" }: { art?: "kunde" | "headhunter" }) {
  const alle = texte(useSeitenSprache() ?? "de");
  const t = alle.abschluss;
  const hh = art === "headhunter";
  return (
    <section className="mw-abschluss mu-feld">
      <h2 className="mu-h2">{hh ? t.headhunter : t.kunde}</h2>
      <a className="mu-knopf mw-abschluss-knopf" href={hh ? BEWERBEN_URL : START_URL}>{hh ? alle.kopf.bewerben : alle.kopf.knopf}</a>
      <p>{hh ? t.headhunterKlein : t.kundeKlein}</p>
    </section>
  );
}
