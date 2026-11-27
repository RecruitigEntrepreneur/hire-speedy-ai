// Neue Sektion H5 „Dein Büro ist schon eingerichtet.“ (Für Headhunter). Drei Zellen: links groß die Terminseite
// (ein freier Termin wird gebucht), rechts das geführte Interview (Fragen haken sich ab) und die Aufgaben
// (die oberste Aufgabe wird erledigt, die nächste rückt nach). Bewegung nur in CSS, läuft nur im Bild.
// Anregung: Sektion 52 (Zellen mit je einer kleinen Ansicht).
import { useEffect, useRef, useState } from "react";
import "./h5.css";

const TAGE = ["Mo", "Di", "Mi", "Do", "Fr"];
// freie Zeiten je Tag; [Tag, Zeit] mit Stern wird in der Bewegung gebucht
const ZEITEN: string[][] = [["09:00", "14:00"], ["10:30"], ["09:00", "11:00", "15:30"], ["13:00"], ["10:00", "14:30"]];
const BUCHT: [number, number] = [2, 1];
const FRAGEN = ["Erfahrung", "Warum wechseln", "Gehaltswunsch", "Verfügbar ab"];
const AUFGABEN = ["Kandidat einladen", "Lebenslauf anfragen", "Kandidat vorstellen"];
const Haken = () => <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2l2.3 2.3 4.7-5" /></svg>;

export function Werkzeug() {
  const ref = useRef<HTMLElement>(null);
  const [lauf, setLauf] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const b = new IntersectionObserver(([e]) => setLauf(e.isIntersecting), { threshold: 0.1 });
    b.observe(el);
    return () => b.disconnect();
  }, []);

  return (
    <section ref={ref} className="h5" data-lauf={lauf}>
      <div className="mu-wrap">
        <h2 className="mu-h2 h5-h2">Dein Büro ist schon eingerichtet.</h2>
        <div className="h5-gitter">
          <article className="h5-zelle h5-termin mu-karte">
            <div className="h5-text">
              <h3 className="mu-h3">Deine Terminseite</h3>
              <p>Kandidaten buchen direkt bei dir, passend zu deinem Outlook-Kalender.</p>
            </div>
            <div className="h5-bild" aria-hidden="true">
              <div className="h5-f">
                <header><b>Termin buchen</b><span>diese Woche</span></header>
                <ol className="h5-woche">
                  {TAGE.map((t, i) => (
                    <li key={t}>
                      <small>{t}</small>
                      {ZEITEN[i].map((z, j) => <span key={z} className={i === BUCHT[0] && j === BUCHT[1] ? "h5-zeit h5-bucht" : "h5-zeit"}>{z}</span>)}
                    </li>
                  ))}
                </ol>
                <p className="h5-stand"><span className="h5-st-a">Freie Zeiten</span><span className="h5-st-b">Gebucht · Mi 11:00</span></p>
              </div>
            </div>
          </article>

          <article className="h5-zelle mu-karte">
            <div className="h5-text">
              <h3 className="mu-h3">Geführtes Interview</h3>
              <p>Frage für Frage. Am Ende steht die Vorstellung fast fertig.</p>
            </div>
            <div className="h5-bild" aria-hidden="true">
              <ul className="h5-f h5-fragen">
                {FRAGEN.map((f, i) => <li key={f} data-n={i}><i><Haken /></i><span>{f}</span><u /></li>)}
              </ul>
            </div>
          </article>

          <article className="h5-zelle mu-karte">
            <div className="h5-text">
              <h3 className="mu-h3">Deine Aufgaben</h3>
              <p>Du siehst jeden Morgen, was heute ansteht.</p>
            </div>
            <div className="h5-bild" aria-hidden="true">
              <ul className="h5-f h5-aufgaben">
                {AUFGABEN.map((a, i) => <li key={a} data-n={i}><i><Haken /></i><span>{a}</span><small>Kandidat {i + 1}</small></li>)}
              </ul>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
