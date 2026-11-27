// Neue Sektion „Fragen für Headhunter“ (Für Headhunter). Links die Überschrift, rechts Fragen zum Aufklappen.
// Immer nur eine Antwort ist offen; die Höhe fährt weich auf. Antworten enthalten nur, was heute feststeht.
// Anregung: Sektion 80 (häufige Fragen).
import { useState } from "react";
import "./h9.css";

const FRAGEN: [string, string][] = [
  ["Muss ich Kunden mitbringen?", "Nein. Die Stellen kommen von Firmen, die mit Matchunt einen Rahmenvertrag haben."],
  ["Was verdiene ich an einer Stelle?", "Das steht an jeder Stelle in Euro, bevor du die Suche übernimmst."],
  ["Bleiben meine Kandidaten meine?", "Ja. Matchunt spricht Personen, die du einreichst, 12 Monate nur über dich an."],
  ["Sieht die Firma, wer ich bin?", "Ja. Jede Vorstellung trägt deinen Namen."],
  ["Kann ich als Agentur mitmachen?", "Ja. Matchunt ist ein zusätzlicher Kanal, kein Ersatz für euer Geschäft."],
];

export function Fragen() {
  const [offen, setOffen] = useState(0);
  return (
    <section className="h9">
      <div className="mu-wrap h9-raster">
        <h2 className="mu-h2">Was Headhunter <span className="mu-leise">vorher wissen wollen.</span></h2>
        <ul className="h9-liste">
          {FRAGEN.map(([f, a], i) => {
            const auf = i === offen;
            return (
              <li key={f} data-auf={auf}>
                <h3>
                  <button type="button" aria-expanded={auf} aria-controls={`h9-a-${i}`} onClick={() => setOffen(auf ? -1 : i)}>
                    <span>{f}</span>
                    <i aria-hidden="true" />
                  </button>
                </h3>
                <div id={`h9-a-${i}`} className="h9-antwort" role="region" aria-hidden={!auf}><div><p>{a}</p></div></div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
