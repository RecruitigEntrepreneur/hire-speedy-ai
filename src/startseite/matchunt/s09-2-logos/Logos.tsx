// Sektion 9.2 (24.11.2026): wie 9.1, aber mit acht echten Firmenlogos statt der Platzhalter – als Vorschau.
// Die Logos stammen von den offiziellen Websites der Firmen (public/logos/kunden). OFFEN: Jede Firma muss der
// Nutzung zustimmen, bevor diese Fassung live geht. Alle Logos einfarbig (CSS-Filter), damit die Reihe ruhig bleibt
// und auch weiße Logos auf hellem Grund sichtbar sind. h = Höhe in px, je Logo abgestimmt auf gleiche optische Größe.
/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from "react";
import { useTx } from "@/startseite/website/uebersetzen";
import "./s092.css";

// flaeche = Logo mit gefüllter Fläche und heller Schrift darin: wird grau statt schwarz gezeigt, sonst wäre es ein Block.
// url = Startseite der Firma (am 25.11.2026 einzeln aufgerufen und geprüft). Bewusst NICHT verlinkt (Entscheidung
// Marko, 25.11.): die Reihe steht direkt unter dem Hero und soll niemanden wegführen. Die Adressen liegen bereit,
// falls ein Logo später zu einer Kundengeschichte führt.
const LOGOS: { name: string; datei: string; h: number; url: string; flaeche?: boolean }[] = [
  { name: "Aon", datei: "aon.svg", h: 30, url: "https://www.aon.com/de-de/" },
  { name: "Eye-Able", datei: "eye-able.svg", h: 26, url: "https://eye-able.com/" },
  { name: "Possehl Electronics", datei: "possehl-electronics.png", h: 66, url: "https://www.possehlelectronics.de/" },
  { name: "FITSEVENELEVEN", datei: "fitseveneleven.svg", h: 32, url: "https://fitseveneleven.de/" },
  { name: "advastore", datei: "advastore.png", h: 40, url: "https://www.advastore.com/" },
  { name: "Trivium eSolutions", datei: "trivium-esolutions.svg", h: 34, url: "https://www.trivium-esolutions.com/de" },
  { name: "EuWe Eugen Wexler", datei: "euwe-zeichen.png", h: 44, url: "https://www.euwe.com/de/", flaeche: true },
  { name: "Mytheresa", datei: "mytheresa.svg", h: 18, url: "https://www.mytheresa.com/" },
];

export function Logos() {
  const tx = useTx();
  return (
    <section className="s09 s092">
      <div className="mu-wrap">
        <div className="s09-kopf">
          <h2 className="mu-h2">{tx("Wo die richtige Person den Unterschied macht.")}</h2>
          <p className="mu-text mu-leise">{tx("Unternehmen, die in ihrem Feld Maßstäbe setzen.")}</p>
        </div>
        <div className="s09-reihe">
          <i className="s09-eck" data-wo="ol" aria-hidden="true" />
          <i className="s09-eck" data-wo="or" aria-hidden="true" />
          <i className="s09-eck" data-wo="ul" aria-hidden="true" />
          <i className="s09-eck" data-wo="ur" aria-hidden="true" />
          <ul className="s092-liste">
            {LOGOS.map((l, i) => (
              <li key={l.datei} className="s092-platz" style={{ "--s09-i": i } as CSSProperties}>
                <img src={`/logos/kunden/${l.datei}`} alt={l.name} data-flaeche={l.flaeche || undefined} style={{ height: l.h }} loading="lazy" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
