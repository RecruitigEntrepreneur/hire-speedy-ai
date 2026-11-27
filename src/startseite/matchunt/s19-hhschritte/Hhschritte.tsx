// Sektion 19 „Schritte für Headhunter“ (Seite „Für Headhunter“): vier Kacheln, je Schritt eine. In jeder Kachel
// bewegt sich ständig und ruhig eine einfache geometrische Form. Eine Kachel ist das volle blaue Feld.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BEWERBEN_URL } from "@/startseite/nachbau/basis";
import "./s19.css";


/** Bogen, der sich füllt und wieder leert: die Prüfung. */
function FormBogen() {
  return (
    <svg className="s19-f s19-f-bogen" viewBox="0 0 180 92" aria-hidden="true">
      <path className="s19-spur" d="M17 92A73 73 0 0 1 163 92" />
      <path className="s19-lauf" d="M17 92A73 73 0 0 1 163 92" pathLength={1} />
    </svg>
  );
}
/** Schalter, dessen Knopf hin- und herwandert: die Suche übernehmen. Der Knopf ist die eine Akzentform. */
function FormSchalter() {
  return (
    <svg className="s19-f s19-f-schalter" viewBox="0 0 160 76" aria-hidden="true">
      <rect width="160" height="76" rx="38" />
      <circle className="s19-knauf" cx="38" cy="38" r="26" />
    </svg>
  );
}
/** Stäbe, die wie eine Stimme auf- und abgehen: sprechen. */
function FormWelle() {
  return (
    <svg className="s19-f s19-f-welle" viewBox="0 0 150 76" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={i * 32.5} width="20" height="76" rx="10" style={{ animationDelay: `${i * -0.42}s` }} />)}
    </svg>
  );
}
/** Zwei Hälften, die zu einem Kreis zusammenkommen: die Einstellung. */
function FormHaelften() {
  return (
    <svg className="s19-f s19-f-haelften" viewBox="0 0 160 84" aria-hidden="true">
      <path className="s19-h-l" d="M80 0A42 42 0 0 0 80 84Z" />
      <path className="s19-h-r" d="M80 0A42 42 0 0 1 80 84Z" />
    </svg>
  );
}

const KACHELN: { titel: string; satz: string; form: ReactNode; art: "fl" | "fl2" | "feld" }[] = [
  { titel: "Bewerben und geprüft werden", satz: "Matchunt prüft jede Bewerbung.", form: <FormBogen />, art: "fl" },
  { titel: "Suche übernehmen", satz: "Du wählst aus den offenen Stellen.", form: <FormSchalter />, art: "fl2" },
  { titel: "Sprechen und vorstellen", satz: "Erst das Gespräch mit der Person, dann die Vorstellung.", form: <FormWelle />, art: "fl" },
  { titel: "Honorar bei Einstellung", satz: "Dein Honorar fällt an, wenn die Firma einstellt.", form: <FormHaelften />, art: "feld" },
];

export function Hhschritte() {
  const ref = useRef<HTMLElement>(null);
  const [imBild, setImBild] = useState(false);
  const [da, setDa] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const b = new IntersectionObserver(([e]) => { setImBild(e.isIntersecting); if (e.isIntersecting) setDa(true); }, { threshold: 0.12 });
    b.observe(el);
    return () => b.disconnect();
  }, []);

  return (
    <section ref={ref} className={`s19${imBild ? "" : " s19-ruhe"}`} data-da={da}>
      <div className="mu-wrap">
        <div className="s19-kopf">
          <h2 className="mu-h2">So läuft eine Suche für dich.</h2>
          <a className="mu-knopf" href={BEWERBEN_URL}>Als Headhunter bewerben</a>
        </div>
        <ol className="s19-feld">
          {KACHELN.map((k, i) => (
            <li key={k.titel} className={`s19-kachel${k.art === "feld" ? " mu-feld" : ""}`} data-art={k.art} style={{ ["--n" as string]: i }}>
              <div className="s19-wort">
                <span className="s19-nr" aria-hidden="true">{i + 1}</span>
                <h3 className="mu-h3">{k.titel}</h3>
                <p>{k.satz}</p>
              </div>
              {k.form}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
