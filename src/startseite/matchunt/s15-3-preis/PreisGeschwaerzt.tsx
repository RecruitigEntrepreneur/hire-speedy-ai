// Sektion 15.3 „Geschwärzt, dann aufgedeckt“ (25.11.2026): Aufbau wie 15.1 (die unverändert bleibt), aber mit dem
// Sprichwort als Einstieg im selben Bild. Erst steht „Über Geld spricht man nicht.“ da, die Säulen wachsen, und die
// Zahlen darüber sind geschwärzt. Dann kommt „Wir schon: 20 % Honorar.“, die schwarzen Balken ziehen nacheinander weg,
// und die Zahlen zählen hoch. Danach wie in 15.1: wer sucht, und die zwei Sätze links.
// Ohne Zahl der Headhunter („alle Headhunter“), Fotos = Beispiel-Gesichter.
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { START_URL } from "@/startseite/nachbau/basis";
import { hhFoto } from "@/startseite/matchunt/fotos";
import { useTx } from "@/startseite/website/uebersetzen";
import "../s15-preis/s15.css";
import "../s15-1-preis/s151.css";
import "./s153.css";

const HOECHST = 27;
// d = Start der Säule (s) · auf = die Schwärzung zieht weg, die Zahl zählt hoch (s) · w = Start der Gesichter (s)
// · wt = Start des Satzes darunter (s)
const SAEULEN = [
  { wert: 27, name: "Personal­beratung im Schnitt", d: 0.2, auf: 2.2, w: 3.9, wt: 4.0, wer: "eine Beratung sucht", n: 1 },
  { wert: 24, name: "kleine Beratungen", d: 0.5, auf: 2.5, w: 3.9, wt: 4.0, wer: "eine Beratung sucht", n: 1 },
  { wert: 20, name: "Matchunt, Grundpaket", d: 0.8, auf: 2.8, w: 4.5, wt: 5.4, wer: "alle Headhunter suchen", n: 6, wir: true },
];
const Person = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9.2" r="4" /><path d="M4 22c0-4.6 3.6-7.4 8-7.4s8 2.8 8 7.4z" /></svg>;

/** Zahl, die hochzählt, sobald ihre Säule wächst (ab = Verzug in Sekunden). Ohne Bewegung steht sie sofort da. */
function Zahl({ ziel, ab, da }: { ziel: number; ab: number; da: boolean }) {
  const tx = useTx();
  const [n, setN] = useState(ziel);
  useEffect(() => {
    if (!da || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let bild = 0;
    const DAUER = 850;
    const uhr = setTimeout(() => {
      const t0 = performance.now();
      const lauf = (t: number) => {
        const p = Math.min(1, (t - t0) / DAUER);
        setN(Math.round(ziel * (1 - Math.pow(1 - p, 3))));
        if (p < 1) bild = requestAnimationFrame(lauf);
      };
      setN(0);
      bild = requestAnimationFrame(lauf);
    }, ab * 1000);
    return () => { clearTimeout(uhr); cancelAnimationFrame(bild); };
  }, [da, ziel, ab]);
  return <>{tx("{n}\u00a0%", { n })}</>;
}

/** `erfolg` = Fassung 15.4: die blaue Säule trägt das Wort „erfolgsbasiert“, der erste Satz nennt es (aus Sektion 68). */
export function PreisGeschwaerzt({ erfolg = false }: { erfolg?: boolean } = {}) {
  const tx = useTx();
  const ref = useRef<HTMLElement>(null);
  const [da, setDa] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const b = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setDa(true); b.disconnect(); } }, { threshold: 0.4 });
    b.observe(el);
    return () => b.disconnect();
  }, []);

  return (
    <section className={erfolg ? "s15 s151 s153 s154" : "s15 s151 s153"} data-da={da}>
      <div className="mu-wrap">
        <div className="s15-kasten">
          <div className="s15-links">
            <h2 className="mu-h2">
              <span className="mu-leise s151-z1">{tx("Über Geld spricht man nicht.")}</span>
              <span className="s151-z2">{tx("Wir schon: 20\u00a0% Honorar.")}</span>
            </h2>
            <div className="s15-unten">
              <ul className="s151-saetze">
                <li>{erfolg ? tx("Honorar erfolgsbasiert: fällig erst bei Einstellung.") : tx("Honorar als Anteil am Zielgehalt, fällig erst bei Einstellung.")}</li>
                <li>{tx("Ein Rahmenvertrag für alle Headhunter.")}</li>
              </ul>
              <p className="s15-quelle">{tx("Quelle für 27\u00a0% und 24\u00a0%: BDU, Studie Personalberatung 2023.")}</p>
              <a className="mu-knopf" href={START_URL}>{tx("Stelle beschreiben")}</a>
            </div>
          </div>
          <figure className="s15-bild" ref={ref} data-da={da}>
            <ol className="s15-saeulen">
              {SAEULEN.map((s) => (
                <li key={s.wert} className={s.wir ? "s15-wir" : undefined} style={{ "--h": s.wert / HOECHST, "--d": s.d, "--auf": `${s.auf}s`, "--w": `${s.w}s`, "--wt": `${s.wt}s` } as CSSProperties}>
                  <div className="s15-hoch">
                    <b className="s15-zahl"><span className="s153-zahl"><Zahl ziel={s.wert} ab={s.auf} da={da} /><i className="s153-schwarz" aria-hidden="true" /></span></b>
                    <div className="s15-saeule">{erfolg && s.wir && <span className="s154-wort">{tx("erfolgs\u00adbasiert")}</span>}</div>
                  </div>
                  <span className="s15-name">{tx(s.name)}</span>
                  <div className="s151-wer">
                    <span className="s151-gesichter" aria-hidden="true">
                      {Array.from({ length: s.n }, (_, i) => {
                        const foto = s.wir ? hhFoto(i) : null;
                        return <i key={i} style={{ "--i": i } as CSSProperties}>{foto ? <img src={foto} alt="" loading="lazy" /> : <Person />}</i>;
                      })}
                    </span>
                    <span className="s151-text">{tx(s.wer)}</span>
                  </div>
                </li>
              ))}
            </ol>
          </figure>
        </div>
      </div>
    </section>
  );
}
