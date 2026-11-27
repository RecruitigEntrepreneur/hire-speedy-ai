// Sektion 42 „Was als Nächstes ansteht“ (Startseite): EINE ruhige, große Karte mit der Aufgabenliste des Kunden.
// Die Zeilen erscheinen nacheinander. Dann drückt ein Zeiger den Knopf der obersten Aufgabe: sie hakt sich ab,
// rutscht weg, die nächste rückt nach und wird zu „Jetzt“. Ruhige Schleife.
import { useEffect, useRef, useState } from "react";
import { START_URL } from "@/startseite/nachbau/basis";
import "./s42.css";

const AUFGABEN = [
  { name: "Vorstellung prüfen", wer: "Kandidat 2", knopf: "Interview anfragen" },
  { name: "Feedback geben", wer: "Kandidat 1", knopf: "Feedback geben" },
  { name: "Angebot machen", wer: "Kandidat 1", knopf: "Angebot machen" },
];
type Zeile = { id: number; art: number; neu: boolean };
const Haken = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.2l2.3 2.3 4.7-5" /></svg>
);

export function Aufgaben() {
  const ref = useRef<HTMLDivElement>(null);
  const [imBild, setImBild] = useState(false);
  const [gesehen, setGesehen] = useState(false);
  const [zeilen, setZeilen] = useState<Zeile[]>(() => AUFGABEN.map((_, i) => ({ id: i, art: i, neu: false })));
  const [zeiger, setZeiger] = useState(false);
  const [druck, setDruck] = useState(false);
  const [erledigt, setErledigt] = useState(false);
  const [geht, setGeht] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const b = new IntersectionObserver(([e]) => { setImBild(e.isIntersecting); if (e.isIntersecting) setGesehen(true); }, { threshold: 0.4 });
    b.observe(el);
    return () => b.disconnect();
  }, []);

  useEffect(() => {
    if (!imBild || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const uhren: ReturnType<typeof setTimeout>[] = [];
    const spaeter = (f: () => void, ms: number) => uhren.push(setTimeout(f, ms));
    const runde = (start: number) => {
      spaeter(() => setZeiger(true), start);
      spaeter(() => setDruck(true), start + 950);
      spaeter(() => { setDruck(false); setErledigt(true); }, start + 1130);
      spaeter(() => setZeiger(false), start + 1500);
      spaeter(() => {
        setGeht(true);
        setZeilen((z) => [...z, { id: z[z.length - 1].id + 1, art: z[0].art, neu: true }]);
      }, start + 2100);
      spaeter(() => { setGeht(false); setErledigt(false); setZeilen((z) => z.slice(1)); }, start + 2850);
      spaeter(() => runde(0), start + 5200);
    };
    runde(2200);
    return () => {
      uhren.forEach(clearTimeout);
      setZeiger(false); setDruck(false); setErledigt(false); setGeht(false);
      setZeilen((z) => (z.length > AUFGABEN.length ? z.slice(1) : z));
    };
  }, [imBild]);

  const jetzt = geht ? 1 : 0;
  return (
    <section className="s42">
      <div className="mu-wrap">
        <div className="s42-karte" ref={ref} data-da={gesehen} aria-hidden="true">
          <div className="s42-titel"><b>Ihre Aufgaben</b><span className="mu-leise">Leitung Konstruktion</span></div>
          <div className="s42-liste">
            {zeilen.map((z, i) => {
              const a = AUFGABEN[z.art];
              const weg = geht && i === 0;
              return (
                <div key={z.id} className="s42-zeile" data-jetzt={i === jetzt} data-erledigt={erledigt && i === 0} data-weg={weg} data-neu={z.neu} style={{ ["--n" as string]: i }}>
                  <div className="s42-huelle"><div className="s42-innen">
                    <i className="s42-kreis"><Haken /></i>
                    <div className="s42-was">
                      <b>{a.name}<em>Jetzt</em></b>
                      <span>{a.wer}</span>
                    </div>
                    <span className="s42-knopf" data-druck={druck && i === 0}>{a.knopf}</span>
                  </div></div>
                </div>
              );
            })}
            <span className="s42-zeiger" data-da={zeiger} data-druck={druck} />
          </div>
          <div className="s42-andere">
            <span className="s42-andere-titel">Läuft bei anderen</span>
            <p><i />Headhunter stimmt den Termin ab</p>
          </div>
        </div>

        <div className="s42-kopf">
          <h2 className="mu-h2">Sie sehen immer, was als Nächstes ansteht.</h2>
          <a className="mu-knopf" href={START_URL}>Stelle beschreiben</a>
        </div>
      </div>
    </section>
  );
}
