// Neue Sektion H1 „Einstieg für Headhunter“ (26.11.2026): derselbe Aufbau wie der Einstieg für Kunden (K1) – blaue
// Tafel mit Weg, sechs Kacheln mit Zeichen und Tinte, darunter ein klickbares Fenster –, aus Sicht des Headhunters.
// Sektion 5 (bisheriger Einstieg der Headhunter-Seite) bleibt unverändert.
import { Einstieg } from "../k1-einstieg/Einstieg";
import { BEWERBEN_URL } from "@/startseite/nachbau/basis";
import { FensterH } from "./FensterH";

// Dieselben sechs Zeichen und Tinten wie beim Kunden; zwei Kacheln heißen aus Sicht des Headhunters anders.
const NAMEN = { Suche: "Ich suche", Einstellung: "Honorar" };
// OFFEN: Adressen der Kopfzeile
const NAV: [string, string][] = [["Ablauf", "#ablauf"], ["Verdienst", "#verdienst"], ["Für Unternehmen", "/"], ["Anmelden", "/recruiter/login"]];

export default function EinstiegHeadhunter() {
  return (
    <Einstieg
      namen={NAMEN}
      h1="Besetzen statt akquirieren."
      satz="Die Kunden bringen wir. Du machst, was du am besten kannst."
      knopf="Als Headhunter bewerben"
      knopfUrl={BEWERBEN_URL}
      nav={NAV}
      fenster={(aktiv, ruhig) => <FensterH aktiv={aktiv} ruhig={ruhig} />}
    />
  );
}
