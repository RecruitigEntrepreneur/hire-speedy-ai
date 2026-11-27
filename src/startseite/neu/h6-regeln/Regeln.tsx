// Neue Sektion H6 „Drei Regeln, die für jeden gelten.“ (Für Headhunter). Links die Überschrift, rechts drei
// große Zeilen. Kommt eine Zeile ins Bild, zieht sich ihre Linie von links nach rechts und der Text rückt nach.
// Keine Nummern, weil es keine Reihenfolge ist. Anregung: Sektion 79 (klare Regeln, nur Belegtes).
import { useEffect, useRef, useState, type CSSProperties } from "react";
import "./h6.css";

const REGELN: [string, string][] = [
  ["Erst das Gespräch, dann die Vorstellung.", "Du stellst nur vor, mit wem du gesprochen hast."],
  ["Die Person weiß Bescheid.", "Du stellst niemanden vor, der nicht zugestimmt hat."],
  // „Höchstens zehn offene Suchen“ gestrichen (27.11.2026, Marko): Plätze werden nicht begrenzt (Entscheidung 01.10.).
];

export function Regeln() {
  const ref = useRef<HTMLOListElement>(null);
  const [da, setDa] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const b = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setDa(true); b.disconnect(); } }, { threshold: 0.25 });
    b.observe(el);
    return () => b.disconnect();
  }, []);
  return (
    <section className="h6">
      <div className="mu-wrap h6-raster">
        <div className="h6-kopf">
          <h2 className="mu-h2">Zwei Regeln, <span className="mu-leise">die für jeden gelten.</span></h2>
          <p className="mu-text mu-leise">Sie stehen in deinem Vertrag, bevor du unterschreibst.</p>
        </div>
        <ol ref={ref} className="h6-liste" data-da={da}>
          {REGELN.map(([r, s], i) => (
            <li key={r} style={{ "--i": i } as CSSProperties}>
              <h3 className="h6-regel">{r}</h3>
              <p>{s}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
