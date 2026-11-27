// Sektion 18.3 „Satz am Weg“ (24.11.2026): aus Sektion 7.3 und Sektion 18.1 wird eine. Die geschwungene Linie mit
// vier Knoten und die bewegten Bilder bleiben; statt Überschrift und Erklärsatz hängt an jedem Knoten ein Teil des
// großen Satzes – mit Zeichen und Tinten-Effekt wie in 7.3. Der Teil blendet ein, wenn die Linie den Knoten erreicht.
// Anfangs steht nur die Überschrift da; die Linie schießt beim Scrollen von Knoten zu Knoten (stufen).
import { Weg } from "../s18-weg/Weg";
import { BILDER } from "../s18-1-weg/WegVerwandlung";
import { Teil } from "../s18-2-satzbild/SatzTeil";
import "./s183.css";

const TITEL = [0, 1, 2, 3].map((n) => function titel(da: boolean) { return <Teil n={n} da={da} einzeln />; });
const OHNE = ["", "", "", ""];

// vonOben = Fassung 18.4: die Linie kommt aus der Sektion davor (dort endet eine blaue Fläche in derselben Farbe).
export function SatzWeg({ vonOben = false }: { vonOben?: boolean }) {
  return <Weg klasse={vonOben ? "s183 s184" : "s183"} vonOben={vonOben} bilder={BILDER} saetze={OHNE} titel={TITEL}
    knopf="Stelle kostenlos ausschreiben" spitze={vonOben ? 0.62 : 0.4} stufen />;
}
