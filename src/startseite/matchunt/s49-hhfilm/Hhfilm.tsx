// Sektion 49 „Film für Headhunter“ (Seite „Für Headhunter“): volles blaues Feld, darin ein Film-Rahmen.
// Sechs programmierte Szenen laufen nacheinander (reines CSS je Szene), darunter Pause-Knopf und sechs Reiter,
// deren Balken sich mit der Szene füllt.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BEWERBEN_URL } from "@/startseite/nachbau/basis";
import "./s49.css";


const SZENEN = [
  { name: "Offene Stellen", ms: 5000 },
  { name: "Deine Kandidaten", ms: 5000 },
  { name: "Gespräch", ms: 5600 },
  { name: "Vorstellen", ms: 4800 },
  { name: "Interview und Angebot", ms: 6000 },
  { name: "Honorar", ms: 5400 },
];
const WEG = ["Vorgestellt", "Interview", "Angebot", "Vertrag"];
const t = (s: number, mehr?: Record<string, string>) => ({ "--t": `${s}s`, ...mehr }) as CSSProperties;

const Haken = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.2l2.3 2.3 4.7-5" /></svg>
);

function Stellen() {
  const stellen = [["Leitung Konstruktion", "Maschinenbau"], ["Vertrieb Innendienst", "Großhandel"], ["Teamleitung Einkauf", "Elektrotechnik"]];
  return (
    <div className="s49-fenster">
      <div className="s49-titel"><b>Offene Stellen</b></div>
      <ul className="s49-liste">
        {stellen.map(([a, b], i) => (
          <li key={a} data-wahl={i === 0} style={t(2.4)}>
            <span className="s49-zeile"><b>{a}</b><small>{b}</small></span>
            {i === 0 ? (
              <span className="s49-tausch">
                <span className="s49-knopf s49-a" data-druck="true">Suche übernehmen</span>
                <span className="s49-marke s49-b"><Haken />Suche übernommen</span>
              </span>
            ) : <span className="s49-knopf">Suche übernehmen</span>}
          </li>
        ))}
      </ul>
      <span className="s49-zeiger" style={{ right: 70, top: 104, ...t(2.4) }} />
    </div>
  );
}

function Kandidaten() {
  const leute = [["Kandidat 1", "Konstruktion, führt ein Team"], ["Kandidat 2", "Konstruktion"], ["Kandidat 3", "Entwicklung"]];
  return (
    <div className="s49-fenster">
      <div className="s49-titel"><b>Deine Kandidaten</b><span className="s49-knopf">Person anlegen</span></div>
      <ul className="s49-liste">
        {leute.map(([a, b], i) => (
          <li key={a} data-wahl={i === 0} data-neu={i === 0} style={t(3)}>
            <span className="s49-kreis">K{i + 1}</span>
            <span className="s49-zeile"><b>{a}</b><small>{b}</small></span>
            <span className="s49-wahlkreis"><Haken /></span>
          </li>
        ))}
      </ul>
      <span className="s49-zeiger" style={{ right: 28, top: 110, ...t(3) }} />
    </div>
  );
}

function Gespraech() {
  const felder = [["Warum wechseln", "steht in den Notizen"], ["Gehaltswunsch", "im Rahmen der Stelle"], ["Verfügbar", "nach Absprache"]];
  return (
    <div className="s49-fenster">
      <div className="s49-titel"><b>Gespräch</b><span className="mu-leise">mit Kandidat 1</span></div>
      <dl className="s49-felder">
        {felder.map(([a, b], i) => (
          <div key={a}><dt>{a}</dt><dd style={t(0.9 + i * 1.4)}><span style={t(0.9 + i * 1.4)}>{b}</span></dd></div>
        ))}
      </dl>
    </div>
  );
}

/** Kopf der Vorstellung: wer, für welche Stelle, und der Stand, der bis zu dreimal wechselt. */
function Kopf({ staende, ab, dm = 2 }: { staende: string[]; ab: number; dm?: number }) {
  const [a, m, b] = staende.length === 3 ? staende : [staende[0], "", staende[1]];
  return (
    <div className="s49-wer-kopf">
      <div className="s49-kreis" data-voll="true">K1</div>
      <div className="s49-wer"><b>Kandidat 1</b><span className="mu-leise">für: Leitung Konstruktion</span></div>
      <span className="s49-tausch" style={t(ab, m ? { "--dm": `${dm}s` } : undefined)}>
        {a && <span className="s49-marke s49-a">{a}</span>}
        {m && <span className="s49-marke s49-m">{m}</span>}
        <span className="s49-marke s49-b">{b}</span>
      </span>
    </div>
  );
}
function Weg({ an, neu }: { an: number; neu: number[] }) {
  return (
    <ol className="s49-weg">
      {WEG.map((w, i) => <li key={w} data-an={i < an} data-neu={neu[i] !== undefined} style={neu[i] !== undefined ? t(neu[i]) : undefined}>{w}</li>)}
    </ol>
  );
}

function Vorstellen() {
  return (
    <div className="s49-fenster">
      <Kopf staende={["", "Vorgestellt"]} ab={2.2} />
      <dl className="s49-fakten">
        <div><dt>Warum wechseln</dt><dd>steht in den Notizen</dd></div>
        <div><dt>Gehaltswunsch</dt><dd>im Rahmen</dd></div>
        <div><dt>Verfügbar</dt><dd>nach Absprache</dd></div>
      </dl>
      <div className="s49-tat" style={t(2.2)}>
        <span className="s49-tausch">
          <span className="s49-knopf s49-a" data-voll="true" data-druck="true">Vorstellen</span>
          <span className="s49-marke s49-b"><Haken />Für die Stelle vorgestellt</span>
        </span>
      </div>
      <Weg an={1} neu={[2.3]} />
      <span className="s49-zeiger" style={{ right: "34%", bottom: 78, ...t(2.2) }} />
    </div>
  );
}

function Interview() {
  return (
    <div className="s49-fenster">
      <Kopf staende={["Vorgestellt", "Im Interviewprozess", "Angebot angenommen"]} ab={1.2} dm={2.2} />
      <ul className="s49-schritte">
        <li style={t(1.4)}><i><Haken /></i>Die Firma fragt ein Interview an.</li>
        <li style={t(3.6)}><i><Haken /></i>Die Firma macht ein Angebot.</li>
      </ul>
      <Weg an={3} neu={[, 1.4, 3.6] as number[]} />
    </div>
  );
}

function Honorar() {
  return (
    <div className="s49-fenster">
      <Kopf staende={["Angebot angenommen", "Vertrag unterschrieben"]} ab={1.4} />
      <Weg an={4} neu={[, , , 1.5] as number[]} />
      <p className="s49-honorar" style={t(2.6)}>Dein Honorar wird fällig.</p>
    </div>
  );
}

const SZENE = [Stellen, Kandidaten, Gespraech, Vorstellen, Interview, Honorar];

export function Hhfilm() {
  const ref = useRef<HTMLDivElement>(null);
  const [szene, setSzene] = useState(0);
  const [imBild, setImBild] = useState(false);
  const [pause, setPause] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const b = new IntersectionObserver(([e]) => setImBild(e.isIntersecting), { threshold: 0.35 });
    b.observe(el);
    return () => b.disconnect();
  }, []);

  const laeuft = imBild && !pause;
  const taste = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + SZENEN.length) % SZENEN.length;
    setSzene(n);
    document.getElementById(`s49-reiter-${n}`)?.focus();
  };
  const Szene = SZENE[szene];

  return (
    <section className="s49 mu-feld">
      <div className="mu-wrap">
        <div className="s49-kopf">
          <h2 className="mu-h2">So arbeitest du mit Matchunt.</h2>
          <a className="mu-knopf" href={BEWERBEN_URL}>Als Headhunter bewerben</a>
        </div>
        <div ref={ref} className="s49-film" id="s49-film" data-lauf={laeuft} role="tabpanel" aria-labelledby={`s49-reiter-${szene}`}>
          <div key={szene} className="s49-szene" aria-hidden="true"><Szene /></div>
        </div>
        <div className="s49-leiste">
          <button type="button" className="s49-pause" aria-label={pause ? "Film fortsetzen" : "Film anhalten"} aria-pressed={pause} onClick={() => setPause((p) => !p)}>
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              {pause ? <path d="M4.5 2.5v11l9-5.5z" /> : <path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z" />}
            </svg>
          </button>
          <div className="s49-reiter" role="tablist" aria-label="Szenen des Films">
            {SZENEN.map((s, i) => (
              <button key={s.name} type="button" role="tab" id={`s49-reiter-${i}`} aria-selected={i === szene} aria-controls="s49-film" aria-label={s.name} tabIndex={i === szene ? 0 : -1} onClick={() => setSzene(i)} onKeyDown={(e) => taste(e, i)}>
                <span className="s49-spur" aria-hidden="true">
                  {i === szene
                    ? <i key={szene} data-lauf={laeuft} style={{ animationDuration: `${s.ms}ms` }} onAnimationEnd={() => setSzene((a) => (a + 1) % SZENEN.length)} />
                    : <i data-voll={i < szene} />}
                </span>
                {s.name}
              </button>
            ))}
          </div>
          <p className="s49-jetzt" aria-hidden="true">{SZENEN[szene].name}</p>
        </div>
      </div>
    </section>
  );
}
