// Neue Sektion H3 „Du siehst je Stelle, was du verdienst.“ (Für Headhunter). Links die Aussage, rechts die
// Liste „Offene Stellen“ aus Sicht des Headhunters: an jeder Stelle steht der Betrag. Kommt die Liste ins
// Bild, werden die Beträge Zeile für Zeile aufgedeckt; das Auge im Kopf verdeckt sie wieder (wie in der App).
// Bewusst ohne Zahl: der Betrag ist ein grauer Platzhalter. Darunter drei Feststellungen mit laufender Linie.
// Anregung: Sektion 22 (Reihe gleich großer Karten, eine Linie läuft einmal durch).
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BEWERBEN_URL } from "@/startseite/nachbau/basis";
import "./h3.css";

const STELLEN: [string, string][] = [["Leitung Konstruktion", "Maschinenbau"], ["Leitung Vertrieb", "Anlagenbau"], ["Leitung Einkauf", "Elektrotechnik"]];
const FEST = ["Steht an jeder Stelle", "Sichtbar, bevor du übernimmst", "Konditionen 12 Monate fest"];

const Auge = ({ zu }: { zu: boolean }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
    {zu && <path d="M4 4l16 16" />}
  </svg>
);

export function Verdienst() {
  const ref = useRef<HTMLDivElement>(null);
  const [da, setDa] = useState(false);
  const [offen, setOffen] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const b = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setDa(true); b.disconnect(); } }, { threshold: 0.3 });
    b.observe(el);
    return () => b.disconnect();
  }, []);

  return (
    <section className="h3">
      <div className="mu-wrap">
        <div className="h3-raster">
          <div className="h3-kopf">
            <h2 className="mu-h2">Du siehst je Stelle, was du verdienst.</h2>
            <p className="mu-text mu-leise">In Euro, bevor du die Suche übernimmst.</p>
            <a className="mu-knopf h3-knopf" href={BEWERBEN_URL}>Als Headhunter bewerben</a>
          </div>

          <div ref={ref} className="h3-fen mu-karte" data-da={da} data-offen={offen}>
            <div className="h3-fen-kopf">
              <b>Offene Stellen</b>
              <button type="button" className="h3-auge" aria-pressed={!offen} onClick={() => setOffen((x) => !x)}>
                <Auge zu={!offen} />
                <span>{offen ? "Beträge verbergen" : "Beträge zeigen"}</span>
              </button>
            </div>
            <ul className="h3-liste">
              {STELLEN.map(([titel, fach], i) => (
                <li key={titel} className="h3-zeile" style={{ "--i": i } as CSSProperties}>
                  <span className="h3-stelle"><b>{titel}</b><em>{fach}</em></span>
                  <span className="h3-betrag">
                    <small>Dein Honorar</small>
                    <span className="h3-summe" role="img" aria-label="Betrag in Euro, hier als Platzhalter"><i>€</i><u /><u /></span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="h3-fuss">Beispielansicht. Die Beträge sind hier Platzhalter.</p>
          </div>
        </div>

        <ol className="h3-fest" data-da={da}>
          {FEST.map((f, i) => (
            <li key={f} style={{ "--i": i } as CSSProperties}>
              <span className="h3-haken" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5.5 12.5l4.2 4.2 8.8-9.4" pathLength="1" /></svg></span>
              <h3 className="mu-h3">{f}</h3>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
