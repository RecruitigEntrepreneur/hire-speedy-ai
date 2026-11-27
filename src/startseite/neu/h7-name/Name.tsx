// Neue Sektion H7 „Die Firma sieht deinen Namen.“ (Für Headhunter). Links die Aussage und die drei Stufen als
// Treppe, rechts eine Vorstellung aus Sicht der Firma: unter „Vorgestellt von“ steht dein Name mit deiner Stufe.
// Die Stufe an der Karte wechselt reihum mit der Treppe; ein Klick auf eine Stufe wählt sie fest.
// Anregung: Sektion 74 (drei Karten nebeneinander).
import { useEffect, useRef, useState } from "react";
import "./h7.css";

const STUFEN = ["Partner", "Silber Partner", "Gold Partner"];
const TAKT_MS = 2600;
const Person = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM5 20c.8-4 3.5-5.5 7-5.5s6.2 1.5 7 5.5" /></svg>;

export function Name() {
  const ref = useRef<HTMLElement>(null);
  const [an, setAn] = useState(0);
  const [imBild, setImBild] = useState(false);
  const [selbst, setSelbst] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const b = new IntersectionObserver(([e]) => setImBild(e.isIntersecting), { threshold: 0.25 });
    b.observe(el);
    return () => b.disconnect();
  }, []);
  useEffect(() => {
    if (!imBild || !selbst || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setAn((n) => (n + 1) % STUFEN.length), TAKT_MS);
    return () => clearInterval(t);
  }, [imBild, selbst]);

  return (
    <section ref={ref} className="h7">
      <div className="mu-wrap h7-raster">
        <div className="h7-kopf">
          <h2 className="mu-h2">Die Firma sieht deinen Namen.</h2>
          <p className="mu-text mu-leise">Jede Vorstellung trägt ihn. Mit deiner Arbeit wächst deine Stufe.</p>
          <div className="h7-treppe" role="tablist" aria-label="Die drei Stufen">
            {STUFEN.map((s, i) => (
              <button key={s} type="button" role="tab" className="h7-stufe" data-n={i} aria-selected={i === an} aria-controls="h7-karte" onClick={() => { setSelbst(false); setAn(i); }}>
                <span>{s}</span>
              </button>
            ))}
          </div>
        </div>

        <div id="h7-karte" className="h7-buehne mu-karte" role="tabpanel">
          <div className="h7-f">
            <header><b>Kandidat 1</b><span>Neu · heute</span></header>
            <dl>
              <div><dt>Erfahrung</dt><dd>12 Jahre</dd></div>
              <div><dt>Gehaltswunsch</dt><dd>im Rahmen</dd></div>
              <div><dt>Verfügbar</dt><dd>in 3 Monaten</dd></div>
            </dl>
            <div className="h7-von">
              <small>Vorgestellt von</small>
              <div className="h7-wer">
                <span className="h7-bild"><Person /></span>
                <span className="h7-name"><b>Dein Name</b><em>Deine Firma</em></span>
                <span className="h7-marken" aria-live="polite">
                  {STUFEN.map((s, i) => <span key={s} className="h7-marke" data-an={i === an} aria-hidden={i !== an}>{s}</span>)}
                </span>
              </div>
            </div>
          </div>
          <p className="h7-fuss">So sieht die Firma eine Vorstellung von dir.</p>
        </div>
      </div>
    </section>
  );
}
