// Neue Sektion K12 „Einstieg für Kunden mit Suchfeld“ (26.11.2026): wie K1, aber statt des einen Knopfs ein Feld, in
// das der Kunde seine Stelle tippt. Der Titel erscheint sofort unten im Fenster. K1 bleibt unverändert.
// OFFEN: Die Aufnahme übernimmt den getippten Titel noch nicht; der Knopf führt wie bisher in die Aufnahme.
import { Einstieg } from "../k1-einstieg/Einstieg";

export default function EinstiegMitSuche() { return <Einstieg eingabe />; }
