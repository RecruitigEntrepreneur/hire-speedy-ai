// Fenster unter dem Hero der Headhunter-Seite (26.11.2026): die App aus Sicht des Headhunters als kurzer Film in vier
// Szenen – Stellen ansehen, Ich suche, Kandidat vorstellen, Honorar. Aufbau und Stil wie das Fenster des Kunden-Einstiegs
// (k1-einstieg/Fenster.tsx, dessen fenster.css hier mitbenutzt wird): oben vier Fortschrittsbalken, links die Seitenleiste.
// Alles ist klickbar wie in der App. Klickt der Besucher selbst, wartet der Film kurz und läuft dann von dort weiter.
// Texte und Felder folgen der App (JobActionCard, „Aktiv suchen“, Vorstellen, Verdienste). Stellen, Kandidaten und der
// Firmenname sind Beispiele. Der Verdienst rechnet wie die App im Grundpaket: 15 % vom Jahresgehalt (Mitte der Spanne),
// ganz bei Antritt (supabase/functions/_shared/konditionen.ts, Paket „core“).
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { MatchuntLogo } from "@/startseite/seite/Logo";
import { BEWERBEN_URL } from "@/startseite/nachbau/basis";
import "../k1-einstieg/fenster.css";
import "./h1f.css";

const SZENEN = [
  { lang: "Stellen ansehen", kurz: "Stellen" },
  { lang: "Ich suche", kurz: "Suchen" },
  { lang: "Kandidat vorstellen", kurz: "Vorstellen" },
  { lang: "Honorar", kurz: "Honorar" },
];
// Dauer der Teilschritte je Szene in ms (der letzte Wert = Stehenlassen, bevor die nächste Szene kommt).
const TAKTE = [
  [1300, 1900, 1300, 1500, 2000, 1100, 450],
  [1100, 900, 700, 1000, 1700, 900, 1000, 450],
  [800, 600, 600, 600, 1500, 1100, 1500, 1400],
  [900, 900, 900, 900, 1100, 1600, 1200, 3600],
];
// In diesen Teilschritten „klickt“ der Film: kleiner Kreis an der Zeigerspitze
const KLICK = [[3, 6], [2, 4, 7], [6], []];
const RUHE = 5000; // so lange wartet der Film nach einem Klick des Besuchers
const ZAHLEN = true; // false = keine Beträge, nur der Satz („15 % vom Jahresgehalt“)
const SATZ = 15;
const FIRMA = "Beispiel GmbH";

type Job = { titel: string; branche: string; ort: string; modell: string; von: number; bis: number; kann: string[]; dringend?: boolean; alt: string };
const JOBS: Job[] = [
  { titel: "Leitung Vertrieb", branche: "Anlagenbau", ort: "Köln", modell: "Vor Ort", von: 110000, bis: 130000, kann: ["Vertrieb Ausland", "Führung", "Englisch"], dringend: true, alt: "vor 2 Tagen" },
  { titel: "Leitung Konstruktion", branche: "Maschinenbau", ort: "Stuttgart", modell: "Hybrid", von: 100000, bis: 120000, kann: ["CAD", "Führung", "Sondermaschinen"], alt: "vor 5 Stunden" },
  { titel: "Leitung Einkauf", branche: "Elektrotechnik", ort: "Hamburg", modell: "Hybrid", von: 90000, bis: 110000, kann: ["Strategischer Einkauf", "SAP", "Verhandlung"], alt: "gestern" },
  { titel: "Leitung Controlling", branche: "Medizintechnik", ort: "München", modell: "Hybrid", von: 95000, bis: 115000, kann: ["Abschluss", "Planung", "Reporting"], alt: "vor 3 Tagen" },
  { titel: "Bilanzbuchhaltung", branche: "Großhandel", ort: "Leipzig", modell: "Vor Ort", von: 60000, bis: 70000, kann: ["HGB", "Abschluss", "DATEV"], alt: "vor 4 Tagen" },
];
const FILM_WAHL = 1; // diese Stelle öffnet der Film von selbst
const eur = (n: number) => `${Math.round(n).toLocaleString("de-DE")} €`;
const anteil = (j: Job) => (((j.von + j.bis) / 2) * SATZ) / 100;
const verdienst = (j: Job) => (ZAHLEN ? eur(anteil(j)) : `${SATZ} %`);
const gehalt = (j: Job) => `${j.von.toLocaleString("de-DE")} bis ${eur(j.bis)}`;
const SUMME = eur(JOBS.reduce((a, j) => a + anteil(j), 0));
// Kandidaten aus dem eigenen Pool (neutrale Beispiele, keine echten Personen)
const POOL = ["Konstruktionsleiter · 11 Jahre", "Teamleiter Entwicklung · 8 Jahre"];
const STUFEN = ["Vorgestellt", "Kunde prüft", "Interview", "Angebot", "Eingestellt"];

const kl = (...t: (string | false | null | undefined)[]) => t.filter(Boolean).join(" ");
const ziel = (an: boolean) => (an ? { "data-zeiger": "" } : {});
const Haken = () => (
  <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="m2.5 6.3 2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Person = ({ klasse }: { klasse?: string }) => (
  <span className={kl("k1f-person", klasse)}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9.2" r="4" /><path d="M4 22c0-4.6 3.6-7.4 8-7.4s8 2.8 8 7.4z" /></svg></span>
);
// kleine Symbole der Seitenleiste (Linien, wie in der App)
const SYM: Record<string, ReactNode> = {
  stellen: <path d="M4 8h16v11H4zM9 8V5h6v3M4 13h16" />,
  bewerber: <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.5a3 3 0 0 1 0 5.6M18 14.5c1.8.7 3 2.6 3 5.5" />,
  aufgaben: <path d="M4 4h16v16H4zM8 12l3 3 5-6" />,
  termine: <path d="M4 6h16v14H4zM4 10h16M8 3v5M16 3v5" />,
  geld: <path d="M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6.5 10v4M17.5 10v4" />,
  schloss: <path d="M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3" />,
};
const Symbol = ({ n, g = 20 }: { n: string; g?: number }) => (
  <svg viewBox="0 0 24 24" width={g} height={g} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{SYM[n]}</svg>
);
const NAV_AKTIV = ["stellen", "stellen", "bewerber", "geld"];

type Szene = { s: number; wahl: number; waehle: (n: number) => void; tippe: (f: () => void) => void; setS: (n: number) => void; weiterZu: (n: number) => void };

/* Eine Stelle in der Liste, wie die Karte in der App: Titel und Verdienst, dann Branche · Ort · Arbeitsmodell und der
   Satz, dann Gehalt und Fähigkeiten. Kein Firmenname, solange der Headhunter nicht sucht. */
function Karte({ j, gewaehlt, zeiger, onClick }: { j: Job; gewaehlt?: boolean; zeiger?: boolean; onClick?: () => void }) {
  return (
    <button type="button" className={kl("h1f-karte", gewaehlt && "gewaehlt")} onClick={onClick} tabIndex={onClick ? 0 : -1} {...ziel(!!zeiger)}>
      <span className="h1f-k1"><b>{j.titel}</b><b className="h1f-geld">{verdienst(j)}</b></span>
      <span className="h1f-k2"><span>{j.dringend && <em>Dringend</em>}{j.dringend && " · "}{j.branche} · {j.ort} · {j.modell}</span><span className="h1f-satz">{SATZ} % Honorar</span></span>
      <span className="h1f-k3">{gehalt(j)} · {j.kann.join(" · ")}</span>
    </button>
  );
}

/* 1 · Stellen ansehen: erst nur die Stellen übereinander, die Liste scrollt. Dann öffnet sich eine Stelle rechts
   daneben; ihre Angaben scrollen bis zur Stellenbeschreibung. Unten bleibt „Ich suche“ stehen.
   Teilschritte: 0 Liste · 1 gescrollt · 2 zurück, Zeiger an der Karte · 3 Stelle offen · 4 Angaben gescrollt
   · 5 Zeiger an „Ich suche“ · 6 Klick */
function Stellen({ s, wahl, waehle, tippe, setS, weiterZu }: Szene) {
  const offen = s >= 3;
  const j = JOBS[wahl];
  return (
    <div className="k1f-szene">
      <span className="k1f-kopf"><b>Offene Stellen</b><span>{JOBS.length} offene Stellen · 1 dringend{ZAHLEN && <> · <b className="h1f-summe">{SUMME}</b> mögliches Honorar</>}</span></span>
      <div className={kl("h1f-teil", offen && "offen")}>
        <div className="h1f-liste">
          <div className="h1f-rolle" style={{ "--hoch": s === 1 ? 1 : 0 } as CSSProperties}>
            {JOBS.map((job, i) => (
              <Karte key={job.titel} j={job} gewaehlt={offen && i === wahl} zeiger={(s === 2 || s === 3) && i === wahl} onClick={() => tippe(() => { waehle(i); setS(3); })} />
            ))}
          </div>
        </div>
        {offen && (
          <div key={wahl} className="h1f-vorschau">
            <div className="h1f-vrolle" style={{ "--hoch": s >= 4 ? 1 : 0 } as CSSProperties}>
              <span className="h1f-vkopf"><b>{j.titel}</b><small><Symbol n="schloss" g={13} />{j.branche} · Firma anonym</small></span>
              <span className="h1f-verdienst"><small>Dein Verdienst</small><b>{verdienst(j)}</b><small>{SATZ} % vom Jahresgehalt · ganz bei Antritt</small></span>
              <dl className="h1f-daten">
                <div><dt>Gehalt</dt><dd>{gehalt(j)}</dd></div>
                <div><dt>Ort</dt><dd>{j.ort} · {j.modell}</dd></div>
                <div><dt>Fähigkeiten</dt><dd>{j.kann.join(" · ")}</dd></div>
              </dl>
              <span className="h1f-vtitel">Stellenbeschreibung</span>
              <span className="k1f-zeilen">{[92, 100, 84, 96, 60].map((b, i) => <u key={i} style={{ width: `${b}%`, "--i": i } as CSSProperties} />)}</span>
              <span className="h1f-vtitel">Unternehmen</span>
              <dl className="h1f-daten"><div><dt>Branche</dt><dd>{j.branche}</dd></div></dl>
            </div>
            <span className="h1f-vfuss">
              <small>{j.alt} aktualisiert</small>
              <button type="button" className={kl("k1f-knopf k1f-klein", s === 6 && "druck")} onClick={() => tippe(() => weiterZu(1))} {...ziel(s >= 5)}>Ich suche</button>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* 2 · Ich suche: das Fenster „Aktiv suchen“ mit den Hinweisen der App und dem Häkchen. Nach „Ich suche aktiv“ steht
   der Firmenname da, darunter passende Kandidaten aus dem eigenen Pool.
   Teilschritte: 0 Fenster · 1 Zeiger am Häkchen · 2 gesetzt · 3 Zeiger am Knopf · 4 „Du suchst jetzt für …“
   · 5 stehen lassen · 6 Zeiger an „Einreichen“ · 7 Klick */
function Suchen({ s, wahl, tippe, setS, weiterZu }: Szene) {
  const j = JOBS[wahl];
  const gesetzt = s >= 2, sucht = s >= 4;
  return (
    <div className="k1f-szene">
      <span className="k1f-kopf"><b>Offene Stellen</b><span>{JOBS.length} offene Stellen · 1 dringend</span></span>
      <div className="h1f-liste"><div className="h1f-rolle">{JOBS.slice(0, 3).map((job) => <Karte key={job.titel} j={job} />)}</div></div>
      <div className="k1f-dialog-grund">
        {!sucht ? (
          <div className="k1f-dialog h1f-dialog">
            <span className="k1f-dialog-kopf"><b>Aktiv suchen</b><small>{j.titel} · dein Verdienst {verdienst(j)}</small></span>
            <ul className="h1f-hinweise">
              <li>Der Kunde sieht, dass du für ihn suchst.</li>
              <li>Kontakt zum Kunden nur über Matchunt.</li>
              <li>Du hast 30 Tage für deine erste Einreichung.</li>
              <li><b>Danach siehst du den Firmennamen.</b></li>
            </ul>
            <button type="button" className="h1f-haken" onClick={() => tippe(() => setS(Math.max(s, 2)))} {...ziel(s === 1 || s === 2)}>
              <i className={kl(gesetzt && "an")}>{gesetzt && <Haken />}</i>Ich suche aktiv passende Kandidaten für diese Stelle.
            </button>
            <button type="button" className={kl("k1f-knopf", !gesetzt && "h1f-aus")} onClick={() => tippe(() => setS(4))} {...ziel(s === 3)}>Ich suche aktiv</button>
          </div>
        ) : (
          <div key="sucht" className="k1f-dialog h1f-dialog">
            <span className="k1f-dialog-kopf"><b>Du suchst jetzt für <span className="h1f-firma">{FIRMA}</span></b><small>{j.titel} · {j.ort}</small></span>
            <small>Passend aus deinem Pool:</small>
            {POOL.map((p, i) => (
              <span key={p} className="h1f-pool">
                <Person /><span><b>Kandidat {i + 1}</b> · {p}</span>
                <button type="button" className={kl("k1f-knopf k1f-klein", i > 0 && "h1f-hell", i === 0 && s === 7 && "druck")} onClick={() => tippe(() => weiterZu(2))} {...ziel(i === 0 && s >= 6)}>Einreichen</button>
              </span>
            ))}
            <span className="k1f-leise">Später einreichen</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* 3 · Kandidat vorstellen: kurz prüfen, ob der Kandidat passt, dann sehen, was der Kunde bekommt, dann vorstellen.
   Teilschritte: 0 Kopf · 1–3 die Kriterien · 4 „Das bekommt …“ · 5 Zeiger am Knopf · 6 vorgestellt · 7 stehen lassen */
function Vorstellen({ s, wahl, tippe, setS }: Szene) {
  const j = JOBS[wahl];
  const pruefung: [string, string][] = [[j.kann[0], "erfüllt"], [j.kann[1], "erfüllt"], ["Gehalt", "passt"]];
  const fertig = s >= 6;
  return (
    <div className="k1f-szene">
      <span className="k1f-kopf"><b>Kandidat 1 bei {FIRMA} vorstellen</b><span>Kurz prüfen, dann geht das Profil raus.</span></span>
      <div className="h1f-zwei">
        <div className="k1f-pkarte h1f-pruefung">
          <b>Passt Kandidat 1?</b>
          {pruefung.map(([was, wie], i) => (
            <span key={was} className={kl("h1f-kriterium k1f-ein", s >= i + 1 && "an")}><span>{was}</span><em><Haken />{wie}</em></span>
          ))}
        </div>
        <div className={kl("k1f-pkarte h1f-bekommt k1f-ein", s >= 4 && "an")}>
          <b>Das bekommt {FIRMA}</b>
          <small>Anonym. Name und Original-Lebenslauf sieht der Kunde erst nach seiner Interview-Zusage.</small>
          <span className="h1f-teile"><span>Profil</span><span>Notizen aus dem Gespräch</span><span>Gehaltswunsch</span></span>
        </div>
      </div>
      {fertig
        ? <span key="f" className="h1f-fertig"><i><Haken /></i>Kandidat 1 ist bei {FIRMA} vorgestellt</span>
        : <button type="button" className={kl("k1f-knopf", s < 4 && "h1f-aus")} onClick={() => tippe(() => setS(6))} {...ziel(s === 5)}>Kandidat 1 vorstellen</button>}
    </div>
  );
}

/* 4 · Honorar: der Stand des Kandidaten läuft bis „Eingestellt“, dann steht die nächste Gutschrift da.
   Teilschritte: 0–4 die Stufen · 5 Gutschrift · 6 Knopf zur Bewerbung · 7 stehen lassen */
function Honorar({ s, wahl, tippe, setS }: Szene) {
  const j = JOBS[wahl];
  const st = Math.min(STUFEN.length - 1, s);
  return (
    <div className="k1f-szene">
      <span className="k1f-kopf"><b>Meine Kandidaten</b><span>{j.titel} · {FIRMA}</span></span>
      <button type="button" className="k1f-job" onClick={() => tippe(() => setS(Math.min(STUFEN.length, s + 1)))}>
        <span className="k1f-job-kopf">
          <span className="h1f-wer"><Person /><span><b>Kandidat 1</b><small>{POOL[0]}</small></span></span>
          <em key={st} className="k1f-stand h1f-stufe">{STUFEN[st]}</em>
        </span>
        <span className="k1f-stufen">{STUFEN.map((w, i) => <i key={w} className={kl(i <= st && "an")} />)}</span>
        <span className="k1f-stufen-namen">{STUFEN.map((w, i) => <span key={w} className={kl(i === st && "da")}>{w}</span>)}</span>
      </button>
      <div className={kl("h1f-gutschrift k1f-ein", s >= 5 && "an")}>
        <span><small>Nächste Gutschrift</small><b>{verdienst(j)}</b></span>
        <small>{SATZ} % vom Jahresgehalt, ganz bei Antritt. Fällig, wenn dein Kandidat angefangen und der Kunde bezahlt hat.</small>
        <a className={kl("k1f-knopf", s < 6 && "h1f-aus")} href={BEWERBEN_URL} {...ziel(s >= 6)}>Als Headhunter bewerben</a>
      </div>
    </div>
  );
}

const SZENE = [Stellen, Suchen, Vorstellen, Honorar];

export function FensterH({ aktiv, ruhig }: { aktiv: boolean; ruhig: boolean }) {
  const [szene, setSzene] = useState(0);
  const [s, setS] = useState(0);
  const [wahl, setWahl] = useState(FILM_WAHL);
  const [pause, setPause] = useState(0); // zählt die Klicks des Besuchers
  const gesehen = useRef({ p: 0, ort: "" });
  const [maus, setMaus] = useState(false); // echte Maus im Fenster → vorgeführter Pfeil tritt zurück
  const leibRef = useRef<HTMLDivElement>(null);
  const zeigerRef = useRef<HTMLSpanElement>(null);
  const zeigen = !ruhig;

  // Der Film: Teilschritt für Teilschritt, dann die nächste Szene. Nach einem Klick des Besuchers wartet er kurz.
  useEffect(() => {
    if (!aktiv || ruhig) return;
    const takte = TAKTE[szene];
    // der Teilschritt, in dem der Besucher zuletzt geklickt hat, bleibt länger stehen
    const ort = `${szene}:${s}`;
    if (pause !== gesehen.current.p) gesehen.current = { p: pause, ort };
    const takt = takte[Math.min(s, takte.length - 1)];
    const warte = gesehen.current.ort === ort ? Math.max(takt, RUHE) : takt;
    const t = setTimeout(() => {
      gesehen.current.ort = "";
      if (s < takte.length - 1) setS(s + 1);
      else {
        const n = (szene + 1) % SZENEN.length;
        if (n === 0) setWahl(FILM_WAHL);
        setSzene(n); setS(0);
      }
    }, warte);
    return () => clearTimeout(t);
  }, [aktiv, ruhig, szene, s, pause]);

  // Zeiger zum Ziel des Schritts schicken (Mitte des Elements mit data-zeiger); ohne Ziel blendet er aus
  useEffect(() => {
    const leib = leibRef.current, zeiger = zeigerRef.current;
    if (!leib || !zeiger) return;
    const setze = () => {
      const el = leib.querySelector<HTMLElement>("[data-zeiger]");
      if (!el) { zeiger.dataset.ruht = ""; return; }
      delete zeiger.dataset.ruht;
      const a = leib.getBoundingClientRect(), b = el.getBoundingClientRect();
      zeiger.style.left = `${Math.round(b.left - a.left + b.width / 2)}px`;
      zeiger.style.top = `${Math.round(b.top - a.top + Math.min(b.height / 2, 30))}px`;
    };
    const f = requestAnimationFrame(setze);
    window.addEventListener("resize", setze);
    return () => { cancelAnimationFrame(f); window.removeEventListener("resize", setze); };
  }, [szene, s, zeigen, wahl]);

  const tippe = (f: () => void) => { f(); setPause((p) => p + 1); };
  const weiterZu = (n: number) => { setSzene(n); setS(0); };

  const Bild = SZENE[szene];
  const gesamt = TAKTE[szene].length;
  const schritt = ruhig ? gesamt - 1 : s;
  const dauer = TAKTE[szene].reduce((a, b) => a + b, 0);
  const stand = TAKTE[szene].slice(0, s + 1).reduce((a, b) => a + b, 0) / dauer;

  return (
    <div className="k1f h1f" onPointerEnter={(e) => { if (e.pointerType === "mouse") setMaus(true); }} onPointerLeave={() => setMaus(false)}>
      <div className="k1f-story" role="tablist" aria-label="Die vier Schritte">
        {SZENEN.map((z, i) => (
          <button key={z.lang} type="button" role="tab" aria-selected={i === szene} onClick={() => tippe(() => weiterZu(i))}>
            <i style={{ "--f": i < szene ? 1 : i > szene ? 0 : (ruhig ? 1 : stand), "--d": `${TAKTE[szene][s]}ms` } as CSSProperties} />
            <span className="k1f-lang">{z.lang}</span><span className="k1f-kurz">{z.kurz}</span>
          </button>
        ))}
      </div>
      <div className="k1f-app">
        <aside className="k1f-nav" aria-hidden="true">
          <MatchuntLogo size={24} className="k1f-marke" />
          {["stellen", "bewerber", "aufgaben", "termine", "geld"].map((n) => <span key={n} className={kl(NAV_AKTIV[szene] === n && "an")}><Symbol n={n} /></span>)}
        </aside>
        <div ref={leibRef} className="k1f-leib" role="tabpanel" aria-label={SZENEN[szene].lang}>
          <Bild key={szene} s={schritt} wahl={wahl} waehle={setWahl} tippe={tippe} setS={setS} weiterZu={weiterZu} />
          {zeigen && <span ref={zeigerRef} className={kl("k1f-zeiger", maus && "weg", KLICK[szene].includes(s) && "klick")} aria-hidden="true" />}
        </div>
      </div>
    </div>
  );
}
