// Sektion 39 „Was in keinem Lebenslauf steht“ (Startseite, Kandidaten kennenlernen). Links ein Blatt, die
// Vorstellung. Daran ploppen nacheinander vier Markierungen auf; zu jeder kommt ein Notiz-Zettel mit einem Feld
// aus dem Gespräch des Headhunters, der sich weich füllt und abhakt. Läuft einmal, sobald die Sektion im Bild ist.
import { useEffect, useRef, useState } from "react";
import "./s39.css";

// Balken je Zeile in Prozent; „m“ = Nummer der Markierung, die an diesem Balken aufploppt.
const ZEILEN: { b: number; m?: number }[][] = [
  [{ b: 34 }, { b: 22, m: 0 }, { b: 28 }],
  [{ b: 48 }, { b: 30 }],
  [{ b: 20, m: 1 }, { b: 40 }, { b: 18 }],
  [{ b: 56 }, { b: 24 }],
  [{ b: 26 }, { b: 30 }, { b: 22, m: 2 }],
  [{ b: 18, m: 3 }, { b: 44 }],
];
const ZETTEL: [string, string | null][] = [
  ["Warum wechseln", null],
  ["Warum jetzt", null],
  ["Gehaltswunsch", "im Rahmen"],
  ["Verfügbar", "in 3 Monaten"],
];
const reihe = (i: number) => ({ ["--i" as string]: i });

export function Notizen() {
  const ref = useRef<HTMLElement>(null);
  const [an, setAn] = useState(false);

  useEffect(() => {
    const el = ref.current?.querySelector(".s39-buehne");
    if (!el) return;
    const b = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setAn(true); b.disconnect(); } }, { threshold: 0.4 });
    b.observe(el);
    return () => b.disconnect();
  }, []);

  return (
    <section className="s39" ref={ref} data-an={an}>
      <div className="mu-wrap s39-raster">
        <div className="s39-buehne">
          <div className="s39-blatt" aria-hidden="true">
            <div className="s39-kopf">
              <div className="s39-kreis">K1</div>
              <div className="s39-wer"><b>Kandidat 1</b><span className="mu-leise">für: Leitung Konstruktion</span></div>
            </div>
            <p className="s39-marke">Lebenslauf</p>
            <div className="s39-zeilen">
              {ZEILEN.map((z, i) => (
                <div key={i} className="s39-zeile">
                  {z.map((s, j) => (
                    <span key={j} style={{ width: `${s.b}%` }}>
                      {s.m !== undefined && <b className="s39-punkt" style={reihe(s.m)} />}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <p className="s39-von"><i>H1</i><span className="mu-leise">Vorgestellt von Headhunter 1 nach einem Gespräch</span></p>
          </div>

          <ul className="s39-zettel" aria-label="Notizen aus dem Gespräch">
            {ZETTEL.map(([feld, wert], i) => (
              <li key={feld} style={reihe(i)}>
                <span className="s39-feld">{feld}</span>
                {wert ? <span className="s39-wert">{wert}</span> : <span className="s39-grau" aria-hidden="true"><i /><i /></span>}
                <svg className="s39-haken" viewBox="0 0 28 28" aria-hidden="true" focusable="false"><circle cx="14" cy="14" r="13" /><path d="M8.5 14.5 L12.5 18.5 L20 10.5" pathLength={1} /></svg>
              </li>
            ))}
          </ul>
        </div>

        <div className="s39-text">
          <h2 className="mu-h2">Was in keinem Lebenslauf steht.</h2>
          <p className="mu-text">Zu jeder Vorstellung bekommen Sie die Notizen aus dem Gespräch.</p>
        </div>
      </div>
    </section>
  );
}
