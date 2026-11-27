// Neue Sektion H4 „Was du einreichst, bleibt deins.“ (Für Headhunter). Volles blaues Feld. Eine Kette aus drei
// Stationen: Matchunt, du, deine Kandidatin. Ein Punkt läuft von Matchunt über dich zur Person; der direkte Weg
// darüber ist gestrichelt und unterbrochen. Darunter füllen sich zwölf Monate.
// Anregung: Sektion 59 (drei Ebenen, die nacheinander sichtbar werden).
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { MatchuntLogo } from "@/startseite/seite/Logo";
import "./h4.css";

const Person = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM5 20c.8-4 3.5-5.5 7-5.5s6.2 1.5 7 5.5" /></svg>;

export function Deins() {
  const ref = useRef<HTMLElement>(null);
  const [lauf, setLauf] = useState(false);
  const [da, setDa] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const b = new IntersectionObserver(([e]) => { setLauf(e.isIntersecting); if (e.isIntersecting) setDa(true); }, { threshold: 0.2 });
    b.observe(el);
    return () => b.disconnect();
  }, []);

  return (
    <section ref={ref} className="h4 mu-feld" data-lauf={lauf} data-da={da}>
      <div className="mu-wrap h4-in">
        <div className="h4-kopf">
          <h2 className="mu-h2">Was du einreichst, bleibt deins.</h2>
          <p className="mu-text h4-satz">Matchunt spricht eingereichte Personen 12 Monate nur über dich an.</p>
        </div>

        <div className="h4-bild" role="img" aria-label="Der Weg von Matchunt zu einer eingereichten Person führt über dich. Einen direkten Weg gibt es nicht.">
          <div className="h4-bogen" aria-hidden="true"><span>Kein direkter Weg</span></div>
          <div className="h4-kette" aria-hidden="true">
            <div className="h4-ort">
              <span className="h4-kreis"><MatchuntLogo size={34} /></span>
              <b>Matchunt</b>
            </div>
            <span className="h4-linie"><i /></span>
            <div className="h4-ort h4-du">
              <span className="h4-kreis"><Person /></span>
              <b>Du</b>
            </div>
            <span className="h4-linie" data-n="2"><i /></span>
            <div className="h4-ort">
              <span className="h4-kreis"><Person /></span>
              <b>Kandidat 1</b>
              <small>von dir eingereicht</small>
            </div>
          </div>
        </div>

        <div className="h4-monate">
          <ol aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <li key={i} style={{ "--i": i } as CSSProperties} />)}</ol>
          <p>12 Monate <span>So steht es in deinem Vertrag.</span></p>
        </div>
      </div>
    </section>
  );
}
