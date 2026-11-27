// Neue Sektion H8 „Bewerben, Vertrag, erste Stelle.“ (Für Headhunter, Abschluss der Seite). Volles blaues Feld.
// Drei Schritte an einer Linie; ein Punkt läuft die Linie entlang und der jeweilige Schritt wird hell.
// Darunter der eine Knopf der Seite. Anregung: Sektion 16 (Schritte) und 82 (Abschluss).
import { useEffect, useRef, useState } from "react";
import { BEWERBEN_URL } from "@/startseite/nachbau/basis";
import "./h8.css";

const SCHRITTE: [string, string][] = [
  ["Bewerben", "Du sagst, wer du bist und welche Stellen du besetzt."],
  ["Vertrag unterschreiben", "Honorar, Schutz und Regeln liest du vorher."],
  ["Erste Suche übernehmen", "Ein Rundgang zeigt dir, wo alles liegt."],
];
const TAKT_MS = 2400;

export function Start() {
  const ref = useRef<HTMLElement>(null);
  const [an, setAn] = useState(0);
  const [imBild, setImBild] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const b = new IntersectionObserver(([e]) => setImBild(e.isIntersecting), { threshold: 0.3 });
    b.observe(el);
    return () => b.disconnect();
  }, []);
  useEffect(() => {
    if (!imBild || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setAn((n) => (n + 1) % SCHRITTE.length), TAKT_MS);
    return () => clearInterval(t);
  }, [imBild]);

  return (
    <section ref={ref} className="h8 mu-feld">
      <div className="mu-wrap h8-in">
        <h2 className="mu-h2 h8-h2">Bewerben, Vertrag, erste Stelle.</h2>
        <ol className="h8-reihe" data-an={an}>
          {SCHRITTE.map(([t, s], i) => (
            <li key={t} data-an={i === an} data-war={i < an}>
              <span className="h8-nr" aria-hidden="true">{i + 1}</span>
              <h3 className="mu-h3">{t}</h3>
              <p>{s}</p>
            </li>
          ))}
        </ol>
        <div className="h8-fuss">
          <a className="mu-knopf h8-knopf" href={BEWERBEN_URL}>Als Headhunter bewerben</a>
          <p>Du entscheidest selbst, wie viele Suchen du übernimmst.</p>
        </div>
      </div>
    </section>
  );
}
