// Neue Sektion H2 „Die Stelle kommt fertig zu dir.“ (Für Headhunter). Links Überschrift und vier Reiter,
// rechts ein Stapel aus vier Unterlagen. Der gewählte Reiter holt sein Blatt nach vorn; solange niemand
// klickt, wechselt der Stapel von selbst. Anregung: Sektion 55 (vier Karten mit je einer kleinen Bühne).
import { useEffect, useRef, useState, type ReactNode } from "react";
import "./h2.css";

const TAKT_MS = 3200;
const Grau = ({ n = 3 }: { n?: number }) => <span className="h2-grau" aria-hidden="true">{Array.from({ length: n }, (_, i) => <i key={i} />)}</span>;

function Briefing() {
  return (
    <>
      <header><b>Briefing</b><span>Leitung Konstruktion</span></header>
      <dl className="h2-dl">
        <div><dt>Branche</dt><dd>Maschinenbau</dd></div>
        <div><dt>Gehalt</dt><dd><Grau n={1} /></dd></div>
        <div><dt>Berichtet an</dt><dd><Grau n={1} /></dd></div>
      </dl>
      <p className="h2-zw">Muss mitbringen</p>
      <ul className="h2-muss">{[0, 1, 2].map((i) => <li key={i}><i aria-hidden="true" /><Grau n={1} /></li>)}</ul>
    </>
  );
}
function Anzeige() {
  return (
    <>
      <header><b>Anzeige</b><span>ohne Firmennamen</span></header>
      <p className="h2-gross">Leitung Konstruktion (m/w/d)</p>
      <dl className="h2-dl">
        <div><dt>Firma</dt><dd><span className="mu-name-verdeckt" /></dd></div>
        <div><dt>Branche</dt><dd>Maschinenbau</dd></div>
      </dl>
      <Grau n={4} />
    </>
  );
}
function Ansprache() {
  return (
    <>
      <header><b>Ansprache</b><span>Entwurf</span></header>
      <p className="h2-anrede">Guten Tag,</p>
      <Grau n={4} />
      <p className="h2-anrede h2-ab">Viele Grüße</p>
      <Grau n={1} />
    </>
  );
}
function Leitfaden() {
  return (
    <>
      <header><b>Gesprächsleitfaden</b><span>Kandidat 1</span></header>
      <ol className="h2-fragen">
        {["Erfahrung", "Warum wechseln", "Gehaltswunsch", "Verfügbar ab"].map((f) => <li key={f}><span>{f}</span><Grau n={1} /></li>)}
      </ol>
    </>
  );
}

const UNTERLAGEN: { k: string; titel: string; satz: string; blatt: ReactNode }[] = [
  { k: "briefing", titel: "Briefing", satz: "Was die Firma sucht, von ihr selbst beschrieben.", blatt: <Briefing /> },
  { k: "anzeige", titel: "Anzeige ohne Firmennamen", satz: "Zum Weitergeben an deine Kandidaten.", blatt: <Anzeige /> },
  { k: "ansprache", titel: "Ansprache-Texte", satz: "Entwürfe für deine erste Nachricht.", blatt: <Ansprache /> },
  { k: "leitfaden", titel: "Gesprächsleitfaden", satz: "Die Fragen für dein Gespräch.", blatt: <Leitfaden /> },
];

export function Fertig() {
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
    const t = setInterval(() => setAn((n) => (n + 1) % UNTERLAGEN.length), TAKT_MS);
    return () => clearInterval(t);
  }, [imBild, selbst]);

  const waehle = (i: number) => { setSelbst(false); setAn(i); };
  const taste = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const z = (i + d + UNTERLAGEN.length) % UNTERLAGEN.length;
    waehle(z);
    document.getElementById(`h2-tab-${z}`)?.focus();
  };

  return (
    <section ref={ref} className="h2" data-lauf={imBild && selbst}>
      <div className="mu-wrap h2-raster">
        <div className="h2-kopf">
          <h2 className="mu-h2">Die Stelle kommt fertig zu dir.</h2>
          <p className="mu-text mu-leise">Vier Unterlagen liegen bereit, wenn du eine Suche übernimmst.</p>
        </div>
        <div className="h2-tabs" role="tablist" aria-label="Unterlagen je Stelle" aria-orientation="vertical">
          {UNTERLAGEN.map((u, i) => (
            <button key={u.k} id={`h2-tab-${i}`} className="h2-tab" role="tab" type="button" aria-selected={i === an} aria-controls="h2-buehne" tabIndex={i === an ? 0 : -1} onClick={() => waehle(i)} onKeyDown={(e) => taste(e, i)}>
              <span className="h2-tab-t">{u.titel}</span>
              <span className="h2-tab-s">{u.satz}</span>
              <i className="h2-lauf" aria-hidden="true" />
            </button>
          ))}
        </div>
        <div id="h2-buehne" className="h2-buehne" role="tabpanel" aria-labelledby={`h2-tab-${an}`}>
          {UNTERLAGEN.map((u, i) => (
            <div key={u.k} className="h2-blatt" data-pos={(i - an + UNTERLAGEN.length) % UNTERLAGEN.length} aria-hidden={i !== an}>{u.blatt}</div>
          ))}
        </div>
      </div>
    </section>
  );
}
