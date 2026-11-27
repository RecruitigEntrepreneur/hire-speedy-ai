// Sektion 80 „Häufige Fragen“ (Preise und Vertrag): wie in der Vorlage links die große Überschrift, rechts Zeilen
// mit Trennlinien, die aufklappen (der Pfeil dreht sich, die offene Zeile bekommt eine Fläche). Antworten nur aus
// dem Faktenblatt (TEXTE.md); die 20 % und „Zielgehalt“ wie in Sektion 75.
import { useState } from "react";
import { useTx } from "@/startseite/website/uebersetzen";
import "./s80.css";

// Frage und Antwort sind die deutschen Schlüssel für tx(); die Antwort zu den Kosten mit festem Leerzeichen vor „%“.
const FRAGEN: { f: string; a: string }[] = [
  { f: "Was kostet es?", a: "Das Honorar ist erfolgsbasiert. Im Matchunt Grundpaket sind es 20\u00A0% vom Zielgehalt." },
  { f: "Wann fällt das Honorar an?", a: "Erst bei einer Einstellung. Während der Suche fällt kein Honorar an." },
  { f: "Brauche ich mit jedem Headhunter einen eigenen Rahmenvertrag?", a: "Nein. Sie unterschreiben einen Rahmenvertrag. Er gilt für alle Headhunter." },
  { f: "Wie fange ich an?", a: "Sie beschreiben Ihre Stelle. Für den Anfang genügt es, Ihre Anzeige einzufügen." },
  { f: "Wie läuft es ab?", a: "In vier Schritten: Stelle beschreiben, Headhunter suchen, Kandidaten kennenlernen, Einstellen." },
  { f: "Was sehe ich von einer Kandidatin oder einem Kandidaten?", a: "Die Eckdaten, die Notizen aus dem Gespräch und eine Einschätzung zur Stelle." },
  { f: "Hat der Headhunter mit der Person gesprochen?", a: "Ja. Jede Vorstellung kommt nach einem Gespräch des Headhunters mit der Person." },
];

export function Fragen() {
  const tx = useTx();
  const [auf, setAuf] = useState(0);
  return (
    <section className="s80">
      <div className="mu-wrap s80-innen">
        <div className="s80-kopf">
          <h2 className="mu-h2">{tx("Häufige Fragen.")}</h2>
          <p className="mu-text mu-leise">{tx("Zu Kosten, Rahmenvertrag und Ablauf.")}</p>
        </div>
        <div className="s80-liste">
          {FRAGEN.map((x, i) => {
            const offen = auf === i;
            return (
              <div key={x.f} className="s80-frage" data-auf={offen}>
                <h3>
                  <button type="button" id={`s80-f-${i}`} aria-expanded={offen} aria-controls={`s80-a-${i}`} onClick={() => setAuf(offen ? -1 : i)}>
                    <span>{tx(x.f)}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6" /></svg>
                  </button>
                </h3>
                <div className="s80-antwort" id={`s80-a-${i}`} role="region" aria-labelledby={`s80-f-${i}`} {...((!offen) ? { inert: '' } : {})}>
                  <div><p>{tx(x.a)}</p></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
