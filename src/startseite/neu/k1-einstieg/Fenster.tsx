// Fenster unter dem Hero (23.11.2026): die echte App im Kleinen als kurzer Film in vier Szenen – Stelle ausschreiben
// (im Dashboard die Anzeige auf die Leiste ziehen), Headhunter suchen, Kandidaten kennenlernen, Einstellen.
// Oben vier Fortschrittsbalken wie bei Stories, links die Seitenleiste wie in der App.
// Der Film hält nie an: Ein Klick des Besuchers springt nur an die passende Stelle, von dort läuft er im normalen
// Tempo weiter. Nach TIEFE Klicks – oder bei „Ja, darum geht es“, dem Knopf am Ende oder einer echten Datei – geht es
// in die echte Aufnahme (START_URL).
// Der vorgeführte Zeiger sucht sein Ziel selbst: das Element, das im aktuellen Schritt data-zeiger trägt. Ziele sind nur
// Dinge, die man wirklich klickt oder zieht (24.11.: nicht mehr Stände, Gesichter, Glocke, Etiketten); ohne Ziel blendet er aus.
import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { START_URL } from "@/startseite/nachbau/basis";
import { mitHerkunft } from "@/startseite/website/herkunft";
import { MatchuntLogo } from "@/startseite/seite/Logo";
import { hhFoto } from "@/startseite/matchunt/fotos";
import "./fenster.css";

const SZENEN = [
  { lang: "Stelle ausschreiben", kurz: "Stelle" },
  { lang: "Headhunter suchen", kurz: "Suche" },
  { lang: "Kandidaten kennenlernen", kurz: "Kennenlernen" },
  { lang: "Einstellen", kurz: "Einstellen" },
];
// Dauer der Teilschritte je Szene in ms (der letzte Wert = Stehenlassen, bevor die nächste Szene kommt).
// An Entscheidungen (Rückfrage, Zeiten vorschlagen) wartet der Film länger, dann entscheidet er selbst.
// 24.11.: Szene 1 endet mit „Ja“ und geht direkt weiter (kein Zurück ins Dashboard), Szene 4 ohne Gehalts-Formular.
// 24.11. später: nach „Ja“ läuft die ganze Aufnahme (21 Schritte) im Zeitraffer durch, danach sofort „Headhunter suchen“.
const RAFFER_TAKT = 115;
const TAKTE = [
  [1200, 1100, 1000, 1500, 1300, 2600, 400, ...Array.from({ length: 21 }, () => RAFFER_TAKT), 1000],
  [1000, 900, 700, 700, 700, 850, 850, 850, 850, 1600, 500],
  [900, 1000, 1000, 1100, 600, 2200, 500, 1900, 2600],
  [1600, 500, 1200, 1300, 1700, 900, 1200, 3600],
];
// In diesen Teilschritten „klickt“ der Film: kleiner Kreis an der Zeigerspitze (am Handy ohne Zeiger sichtbar)
const KLICK = [[6], [10], [4, 6], [1]];
const TIEFE = 4; // so viele Klicks im Fenster, dann geht es in die echte Aufnahme
const STELLE = "Leitung Controlling";
const DATEI = "Stellenanzeige_Controlling.pdf";
// Eigene Stelle des Besuchers (Fassung mit Suchfeld, 26.11.2026): Tippt er oben im Einstieg einen Titel, zeigt der Film
// seine Stelle statt des Beispiels. Was am Beispiel hängt (Rolle des Kandidaten, Dateiname), wird dann neutral.
const Eigen = createContext("");
const Stelle = () => useContext(Eigen) || STELLE;
const Rolle = () => (useContext(Eigen) ? "Kandidat 1" : ROLLE);
const Datei = () => (useContext(Eigen) ? "Stellenanzeige.pdf" : DATEI);

const kl = (...t: (string | false | null | undefined)[]) => t.filter(Boolean).join(" ");
const ziel = (an: boolean) => (an ? { "data-zeiger": "" } : {});
const Haken = () => (
  <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="m2.5 6.3 2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Pdf = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M6 3h9l4 4v14H6zM15 3v4h4M9 12h6M9 16h4" /></svg>
);
const DateiKarte = () => <span className="k1f-dateikarte"><Pdf /><Datei /></span>;
const Person = ({ foto, klasse }: { foto?: number; klasse?: string }) => {
  const bild = foto == null ? null : hhFoto(foto);
  return (
    <span className={kl("k1f-person", klasse)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {bild ? <img src={bild} alt="" /> : <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9.2" r="4" /><path d="M4 22c0-4.6 3.6-7.4 8-7.4s8 2.8 8 7.4z" /></svg>}
    </span>
  );
};
// kleine Symbole der Seitenleiste (Linien, wie in der App)
const SYM: Record<string, ReactNode> = {
  start: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />,
  stellen: <path d="M4 8h16v11H4zM9 8V5h6v3M4 13h16" />,
  bewerber: <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.5a3 3 0 0 1 0 5.6M18 14.5c1.8.7 3 2.6 3 5.5" />,
  termine: <path d="M4 6h16v14H4zM4 10h16M8 3v5M16 3v5" />,
  angebot: <path d="M6 3h9l4 4v14H6zM15 3v4h4M9 14l2 2 4-4" />,
  glocke: <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />,
  aufgaben: <path d="M4 4h16v16H4zM8 12l3 3 5-6" />,
  // Eckdaten im Bewerberprofil (wie die Symbole in der App)
  hut: <path d="M2.5 9 12 5l9.5 4-9.5 4zM6.5 10.8V15c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3v-4.2" />,
  geld: <path d="M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6.5 10v4M17.5 10v4" />,
  uhr: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5V12l3 2" />,
  ort: <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 1 1 13 0c0 5.4-6.5 11-6.5 11zM12 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />,
  schloss: <path d="M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3" />,
  weg: <path d="M7 7l10 10M17 7 7 17" />,
  datei: <path d="M6 3h9l4 4v14H6zM15 3v4h4M9 12h6M9 16h4" />,
  pfeil: <path d="M5 12h14M13 6l6 6-6 6" />,
};
const Symbol = ({ n }: { n: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{SYM[n]}</svg>
);
const NAV_AKTIV = ["start", "stellen", "bewerber", "angebot"];

type Szene = { s: number; tippe: (f: () => void, tief?: boolean) => void; setS: (n: number) => void; weiterZu: (n: number) => void };

// Die anderen Stellen in „Meine Stellen“ (neutrale Beispiele)
const LISTE = [
  { titel: "Vertriebsleitung", unter: "München · seit 12 Tagen", fotos: [3, 4], hh: "2 Headhunter suchen" },
  { titel: "Bilanzbuchhaltung", unter: "Stuttgart · seit 4 Tagen", fotos: [1], hh: "1 Headhunter sucht" },
];
const Reihe = ({ j, tippe, weiterZu }: { j: (typeof LISTE)[number]; tippe: Szene["tippe"]; weiterZu: Szene["weiterZu"] }) => (
  <button type="button" className="k1f-reihe" onClick={() => tippe(() => weiterZu(1))}>
    <span><b>{j.titel}</b><small>{j.unter}</small></span>
    <span className="k1f-sucher"><span className="k1f-gesichter">{j.fotos.map((f) => <Person key={f} foto={f} klasse="da" />)}</span>{j.hh}</span>
  </button>
);

/* 1 · Stelle ausschreiben: die erste Seite im Dashboard wie in der App – oben die Leiste „Neue Position aufnehmen“,
   darunter die vier Kacheln. Die Anzeige wird von außen auf die Leiste gezogen, die Leiste klappt auf (gelesen,
   Kärtchen, Rückfrage). Nach „Ja“ läuft die ganze Aufnahme im Zeitraffer durch – Etappen und Schritte wie in der App
   (EtappenAnsicht) –, danach geht es sofort weiter zu „Headhunter suchen“.
   Teilschritte: 0 Dashboard · 1 Datei kommt von außen · 2 Datei auf die Leiste · 3 gelesen · 4 Kärtchen · 5 Rückfrage
   · 6 Ja · 7–27 die 21 Schritte der Aufnahme · 28 fertig */
const KAERTCHEN = [STELLE, "Stuttgart", "Hybrid", "ab 8 Jahren", "Team von 6"];
const ETAPPEN = ["Eckdaten", "Vergütung", "Anforderungen", "Rahmendaten"];
// Schritte der Aufnahme (Festanstellung) in der Reihenfolge der App. Welche aus der Anzeige kommen, ist ein Beispiel.
const AUFNAHME: [number, string, boolean][] = [
  [0, "Worum geht es", true], [0, "Warum offen", false], [0, "Arbeitsalltag", true], [0, "Abteilung", true],
  [0, "Berichtet an und Entscheidung", false], [0, "Homeoffice und Vertrag", true],
  [1, "Vergütung", false], [1, "Förderung", false],
  [2, "Kriterien", true], [2, "Wer passt", false], [2, "Woher gute Kandidaten", false],
  [3, "Ihr Unternehmen", true], [3, "Benefits", true], [3, "Alleinstellung", false], [3, "Kultur", false], [3, "Branche", true],
  [3, "Arbeitszeit", true], [3, "Auswahlprozess", false], [3, "Betriebsrat und Vertragsdauer", false],
  [3, "Arbeitserlaubnis und Abwerben", false], [3, "Einwände", false],
];
const RAFFER = 7; // erster Teilschritt des Zeitraffers
const Kachel = ({ sym, titel, zahl, onClick, kinder }: { sym: string; titel: string; zahl: number; onClick: () => void; kinder: ReactNode }) => (
  <button type="button" className="k1f-kachel" onClick={onClick}>
    <span className="k1f-kachel-kopf"><Symbol n={sym} /><span>{titel}</span><b>{zahl}</b></span>
    {kinder}
  </button>
);
function Aufnahme({ s, tippe, setS, weiterZu }: Szene) {
  const offen = s >= 3;
  const raffer = s >= RAFFER;
  const n = Math.max(1, Math.min(AUFNAHME.length, s - RAFFER + 1)); // so viele Schritte sind durch
  const fertig = s >= RAFFER + AUFNAHME.length;
  const [etappe, titel, ausAnzeige] = AUFNAHME[n - 1];
  return (
    <div className="k1f-szene">
      <span className="k1f-kopf"><b>Guten Morgen</b><span>Ihr Command Center für alle Kandidaten-Aktivitäten.</span></span>
      {offen ? (
        <div className="k1f-leiste offen">
          <span className="k1f-dateizeile"><Pdf /><b><Datei /></b><em key={s === 3 ? "l" : fertig ? "f" : raffer ? "r" : "g"}>{s === 3 ? "wird gelesen …" : fertig ? <><Haken />Aufnahme fertig</> : raffer ? `Zeitraffer · Schritt ${n} von ${AUFNAHME.length}` : <><Haken />gelesen</>}</em></span>
          {s === 3 ? (
            <span className="k1f-zeilen">{[100, 84, 93, 58].map((w, i) => <u key={i} style={{ width: `${w}%`, "--i": i } as CSSProperties} />)}</span>
          ) : (
            <span className="k1f-kaertchen">{KAERTCHEN.map((k, i) => <span key={k} style={{ "--i": i } as CSSProperties}><Haken />{i === 0 ? <Stelle /> : k}</span>)}</span>
          )}
          {s >= 5 && !raffer && (
            <div className="k1f-frage">
              <span>Sie suchen eine <b><Stelle /></b> in Stuttgart, richtig?</span>
              <button type="button" className={kl("k1f-knopf", s === 6 && "druck")} {...ziel(true)} onClick={() => tippe(() => setS(7), true)}>Ja, darum geht es</button>
            </div>
          )}
          {raffer && (
            <button type="button" className="k1f-frage k1f-raffer k1f-schnell" onClick={() => tippe(() => weiterZu(1))}>
              <span className="k1f-etappen">
                {ETAPPEN.map((e, i) => {
                  const alle = AUFNAHME.filter(([et]) => et === i).length;
                  const durch = AUFNAHME.slice(0, n).filter(([et]) => et === i).length;
                  return <span key={e} className={kl(!fertig && etappe === i && "da")}><i style={{ "--f": durch / alle } as CSSProperties} />{e}</span>;
                })}
              </span>
              <span className="k1f-raffer-zeile">
                {fertig ? (
                  <><b key="f">Aufnahme vollständig</b><em className="k1f-raffer-tag">an Matchunt übergeben</em></>
                ) : (
                  <><b key={n}>{titel}</b><em className={kl("k1f-raffer-tag", !ausAnzeige && "klick")}><Haken />{ausAnzeige ? "aus der Anzeige" : "angeklickt"}</em></>
                )}
              </span>
            </button>
          )}
        </div>
      ) : (
        <div className={kl("k1f-leiste", s === 2 && "drueber")} {...ziel(s === 2)}>
          <span className="k1f-leiste-text">
            <b>{s === 2 ? "Loslassen zum Ausschreiben" : "Neue Position aufnehmen"}</b>
            <span>Anzeige einfügen, hochladen oder von Hand beschreiben</span>
          </span>
          <button type="button" className="k1f-knopf k1f-plus" onClick={() => tippe(() => setS(3))}>+ Position aufnehmen</button>
        </div>
      )}
      <div className="k1f-kacheln">
        <Kachel sym="bewerber" titel="Bewerbungen" zahl={7} onClick={() => tippe(() => weiterZu(2))} kinder={
          <span className="k1f-kachel-zeile"><span className="k1f-kandidaten"><Person klasse="neu" /><Person klasse="neu" /></span><span className="k1f-leise">2 neu</span></span>
        } />
        <Kachel sym="stellen" titel="Aktive Jobs" zahl={2} onClick={() => tippe(() => weiterZu(1))} kinder={
          <span className="k1f-kachel-zeile"><span>Vertriebsleitung</span><span className="k1f-leise">2 Headhunter</span></span>
        } />
        <Kachel sym="aufgaben" titel="Ihre Aufgaben" zahl={3} onClick={() => tippe(() => weiterZu(2))} kinder={
          <span className="k1f-kachel-zeile"><span>Interview-Feedback geben</span></span>
        } />
        <Kachel sym="termine" titel="Anstehende Interviews" zahl={2} onClick={() => tippe(() => weiterZu(2))} kinder={
          <span className="k1f-kachel-zeile"><span>Do, 10:00</span><span className="k1f-leise">Vertriebsleitung</span></span>
        } />
      </div>
      {s === 1 && <span className="k1f-zieh" {...ziel(true)}><DateiKarte /></span>}
    </div>
  );
}

/* 2 · Headhunter suchen: dieselbe Stelle geht live, Headhunter kommen dazu, Kandidaten gehen ein, die Glocke meldet sich.
   Teilschritte: 0 in Prüfung · 1 live · 2–4 Headhunter · 5–8 Kandidaten · 9 Zeiger auf „Ansehen“ · 10 Klick */
const STATIONEN = ["Suche", "Vorschläge", "Interviews", "Angebot", "Besetzt"];
// Kandidaten, die nacheinander eingehen (neutrale Beispiele, keine echten Personen)
const EINGANG = ["Leiter Controlling · 12 Jahre", "Head of Controlling · 9 Jahre", "Kaufmännische Leitung · 15 Jahre", "Senior Controller · 8 Jahre"];
const EINGANG_NEUTRAL = ["12 Jahre Erfahrung", "9 Jahre Erfahrung", "15 Jahre Erfahrung", "8 Jahre Erfahrung"];
function Suche({ s, tippe, setS, weiterZu }: Szene) {
  const eingang = useContext(Eigen) ? EINGANG_NEUTRAL : EINGANG;
  const live = s >= 1;
  const n = Math.max(0, Math.min(3, s - 1)); // Headhunter, die suchen
  const k = Math.max(0, Math.min(eingang.length, s - 4)); // eingegangene Kandidaten
  return (
    <div className="k1f-szene">
      <div className="k1f-zeile">
        <span className="k1f-kopf"><b>Meine Stellen</b><span>3 aktive Stellen</span></span>
        <span className="k1f-glocke"><Symbol n="glocke" />{k > 0 && <i key={k}>{k}</i>}</span>
      </div>
      <button type="button" className="k1f-job" onClick={() => tippe(() => setS(Math.max(s, 5)))}>
        <span className="k1f-job-kopf">
          <span>
            <span className="k1f-titel"><b><Stelle /></b><em key={live ? "l" : "p"} className={kl("k1f-stand", live && "live")}>{live ? "Live" : "In Prüfung"}</em></span>
            <small>Festanstellung · Stuttgart · seit heute</small>
          </span>
          <span className="k1f-rennen">
            {k > 0 && <>
              <span className="k1f-kandidaten">{eingang.slice(0, k).map((e) => <Person key={e} klasse="neu" />)}</span>
              <small><em>{k} neu</em> · {k} im Rennen</small>
            </>}
          </span>
        </span>
        <span className="k1f-stufen">{STATIONEN.map((w, i) => <i key={w} className={kl(i <= (k > 0 ? 1 : 0) && live && "an")} />)}</span>
        <span className="k1f-stufen-namen">{STATIONEN.map((w, i) => <span key={w} className={kl(i === (k > 0 ? 1 : 0) && "da")}>{w}</span>)}</span>
        <span className="k1f-job-fuss">
          <span key={`${live}${n > 0}${k}`} className="k1f-neu">
            {k > 0 ? <><i className="k1f-punkt" /><b>Neu:</b> {eingang[k - 1]}</> : n > 0 ? "Headhunter suchen gerade." : live ? "Ihre Stelle ist jetzt für Headhunter sichtbar." : "In Prüfung bei Matchunt"}
          </span>
          <span className="k1f-sucher">
            <span className="k1f-gesichter">{[0, 1, 2].map((i) => <Person key={i} foto={i} klasse={kl(n > i && "da")} />)}</span>
            {n === 0 ? "Noch sucht kein Headhunter" : n === 1 ? "1 Headhunter sucht" : `${n} Headhunter suchen`}
          </span>
        </span>
      </button>
      <Reihe j={LISTE[0]} tippe={tippe} weiterZu={weiterZu} />
      {k > 0 && (
        <div className="k1f-eingang">
          {eingang.slice(0, k).reverse().slice(0, 2).map((e, i) => (
            <button key={e} type="button" className={kl("k1f-meldung", i > 0 && "hinten", i === 0 && s === 10 && "druck")} onClick={() => tippe(() => weiterZu(2))}>
              <Person klasse="neu" /><span><b>Kandidat {k - i}</b> · {e}</span><em {...ziel(i === 0 && s >= 9)}>Ansehen</em>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* Kopf des Bewerberprofils wie in der App (CandidateDetail): ohne Freigabe steht die Rolle als Überschrift, daneben
   Schloss und Stand, darunter Kürzel und „für: Stelle“ und der Hinweis zum anonymen Profil. Darunter die Eckdaten mit
   Symbolen und „Eingereicht von“. Kürzel und Werte sind Beispiele. */
const ROLLE = "Leiter Controlling";
const Antritt = () => { const eigen = useContext(Eigen); return <>{eigen ? `Ihre Stelle „${eigen}“ ist besetzt.` : `Ihr neuer ${ROLLE} fängt an.`}</>; };
const KUERZEL = "PR-7F3A21";
const FAKTEN: [string, string, string][] = [["hut", "Seniorität", "Leitung"], ["stellen", "Erfahrung", "12 Jahre"], ["geld", "Gehaltswunsch", "im Rahmen"], ["uhr", "Verfügbar", "in 3 Monaten"], ["ort", "Region", "Stuttgart"]];
const ProfilKopf = ({ stand, fakten, von }: { stand: string; fakten?: boolean; von?: boolean }) => (
  <div className="k1f-pkarte">
    <div className="k1f-pkopf">
      <span className="k1f-avatar"><Person /><i><Symbol n="schloss" /></i></span>
      <span className="k1f-pname">
        <span className="k1f-titel"><b><Rolle /></b><Symbol n="schloss" /><em key={stand} className="k1f-stand">{stand}</em></span>
        <small>{KUERZEL} · für: <Stelle /></small>
        <small className="k1f-hinweis">Anonymes Profil — Name, Kontakt und Lebenslauf nach Interview-Zusage</small>
      </span>
    </div>
    {fakten !== undefined && (
      <div className="k1f-fakten">
        {FAKTEN.map(([sym, n, w], i) => (
          <span key={n} className={kl("k1f-ein", fakten && "an")} style={{ transitionDelay: `${i * 80}ms` }}><Symbol n={sym} />{n} <b>{w}</b></span>
        ))}
      </div>
    )}
    {von !== undefined && (
      <div className={kl("k1f-eingereicht k1f-ein", von && "an")}>
        <Person foto={0} />
        <span>Eingereicht von <b>Headhunter</b> · Gold Partner</span>
        <span className="k1f-knopf k1f-zweit k1f-klein">Frage stellen</span>
      </div>
    )}
  </div>
);

/* 3 · Kandidaten kennenlernen: das Bewerberprofil wie in der App. „Interview anfragen“ öffnet das Fenster wie in der
   App: Zeiten aus dem eigenen Kalender vorschlagen, Anfrage senden – danach sagt der Kandidat zu.
   Teilschritte: 0 Kopf · 1 Eckdaten · 2 Eingereicht von · 3 Zeiger auf „Interview anfragen“ · 4 Klick · 5 Fenster mit
   drei Vorschlägen · 6 „Anfrage senden“ · 7 Anfrage gesendet · 8 Kandidat hat zugesagt */
const TERMINE = [["Di", "10:00"], ["Mi", "14:30"], ["Do", "09:00"]];
function Profil({ s, tippe, setS }: Szene) {
  const stand = s >= 8 ? "Interview geplant" : s >= 7 ? "Interview angefragt" : "Neu";
  return (
    <div className="k1f-szene">
      <ProfilKopf stand={stand} fakten={s >= 1} von={s >= 2} />
      <div className="k1f-knopfzeile">
        <button type="button" className={kl("k1f-knopf", s === 4 && "druck")} {...ziel(s === 3 || s === 4)} onClick={() => tippe(() => setS(5))}>
          <Symbol n="termine" />Interview anfragen
        </button>
        <span className="k1f-knopf k1f-zweit"><Symbol n="weg" />Ablehnen</span>
        <span className="k1f-werkzeuge"><span><Symbol n="datei" />Lebenslauf (PDF)</span><span><Symbol n="bewerber" />Kollegen fragen</span></span>
      </div>
      {(s === 5 || s === 6) && (
        <div className="k1f-dialog-grund">
          <div className="k1f-dialog" role="dialog" aria-label="Interview anfragen">
            <span className="k1f-dialog-kopf"><b>Interview anfragen</b><small>Termine aus Ihrem Kalender vorschlagen</small></span>
            <span className="k1f-slots">
              {TERMINE.map(([t, z], i) => <span key={t} style={{ "--i": i } as CSSProperties}><Haken /><b>{t}</b>{z} Uhr</span>)}
            </span>
            <small>Teilnehmer: Sie · Kandidat · Headhunter</small>
            <button type="button" className={kl("k1f-knopf", s === 6 && "druck")} {...ziel(true)} onClick={() => tippe(() => setS(7))}>Anfrage senden</button>
          </div>
        </div>
      )}
      {s >= 7 && (
        <div className="k1f-eingang">
          <span key={s} className="k1f-meldung">
            <Haken />{s >= 8 ? <span><b>Kandidat hat zugesagt</b> · Mi, 14:30 Uhr</span> : <span>Anfrage gesendet. Kandidat und Headhunter sind informiert.</span>}
          </span>
        </div>
      )}
    </div>
  );
}

/* 4 · Einstellen: Angebot machen, dann die Besetzung wie auf der Seite „Besetzungen“ der App – Zeitleiste Angebot →
   Zusage → Vertrag → Unterschrift → Start, dazu „Start laut Angebot“, Arbeitsvertrag und „Rechnung · nach der
   Unterschrift“. Zum Schluss der erste Arbeitstag und der Knopf. Startdatum ist ein Beispiel.
   Teilschritte: 0–1 Profil und Klick · 2 Angebot · 3 Zusage · 4 Unterschrift läuft · 5 unterschrieben · 6 Start
   · 7 erster Arbeitstag */
const BESETZUNG = ["Angebot V1", "Zusage", "Vertrag", "Unterschrift", "Start 01.03."];
const BESETZUNG_STAND = ["", "", "Kandidat überlegt", "Angebot angenommen", "Unterschrift läuft", "unterschrieben", "unterschrieben"];
function Angebot({ s, tippe, setS }: Szene) {
  const ansicht = s <= 1 ? "profil" : s <= 6 ? "besetzung" : "start";
  const erreicht = s - 1; // Stationen der Zeitleiste, die erreicht sind (2 → 1 … 6 → 5)
  return (
    <div className="k1f-szene">
      {ansicht === "profil" && (
        <div key="p" className="k1f-teil">
          <ProfilKopf stand="Interview geführt" />
          <div className="k1f-notiz"><small>Interview am Mi, 14:30 · Ihr Eindruck</small><u /><u style={{ width: "58%" }} /></div>
          <div className="k1f-knopfzeile k1f-unten-links">
            <button type="button" className={kl("k1f-knopf", s === 1 && "druck")} {...ziel(true)} onClick={() => tippe(() => setS(2))}>Angebot machen</button>
            <span className="k1f-knopf k1f-zweit"><Symbol n="weg" />Ablehnen</span>
          </div>
        </div>
      )}
      {ansicht === "besetzung" && (
        <div key="b" className="k1f-teil">
          <div className="k1f-pkarte k1f-besetzung">
            <div className="k1f-pkopf">
              <span className="k1f-avatar"><Person /></span>
              <span className="k1f-pname">
                <span className="k1f-titel"><b><Rolle /></b><em key={BESETZUNG_STAND[s]} className="k1f-stand">{BESETZUNG_STAND[s]}</em></span>
                <small>für: <Stelle /> · über Headhunter</small>
              </span>
            </div>
            <ol className="k1f-zeitleiste">
              {BESETZUNG.map((w, i) => <li key={w} className={kl(i < erreicht && "an", i === erreicht - 1 && "jetzt")}><i />{w}</li>)}
            </ol>
            <div className="k1f-fakten2">
              <span className={kl(s >= 6 && "leuchtet")}><small>Start laut Angebot</small><b>01.03.2027</b></span>
              <span>
                <small>Arbeitsvertrag</small>
                <svg viewBox="0 0 200 50" aria-hidden="true">
                  {s >= 4 && <path className="k1f-unterschrift" d="M10 38C16 22 22 6 30 6C38 6 30 38 38 38C45 38 44 22 51 22C57 22 53 34 60 34C66 34 66 26 72 26C77 26 78 30 86 28C96 26 104 18 116 20" pathLength={1} />}
                  <path d="M8 45H190" className="k1f-linie" />
                </svg>
              </span>
              <span><small>Rechnung</small><b>nach der Unterschrift</b></span>
            </div>
          </div>
        </div>
      )}
      {ansicht === "start" && (
        <div key="s" className="k1f-teil k1f-antritt">
          <span className="k1f-antritt-reihe">
            <Person />
            <span className="k1f-pfeil"><Symbol n="pfeil" /></span>
            <span className="k1f-kalender"><Symbol n="termine" /><b>Mo, 01.03.</b>Erster Arbeitstag</span>
          </span>
          <b className="k1f-antritt-satz"><Antritt /></b>
          <span className="k1f-antritt-klein">Honorar nur bei Einstellung, erst mit der Unterschrift.</span>
          <a className="k1f-knopf" href={START_URL} {...ziel(true)} onClick={(e) => { e.preventDefault(); tippe(() => {}, true); }}>Stelle kostenlos ausschreiben</a>
        </div>
      )}
    </div>
  );
}

const SZENE = [Aufnahme, Suche, Profil, Angebot];

export function Fenster({ aktiv, ruhig, stelle = "" }: { aktiv: boolean; ruhig: boolean; stelle?: string }) {
  const [szene, setSzene] = useState(0);
  const [s, setS] = useState(0);
  const [klicks, setKlicks] = useState(0);
  const [weiter, setWeiter] = useState(false);
  const [ziehen, setZiehen] = useState(false);
  const [maus, setMaus] = useState(false); // echte Maus im Fenster → vorgeführter Pfeil tritt zurück
  const leibRef = useRef<HTMLDivElement>(null);
  const zeigerRef = useRef<HTMLSpanElement>(null);
  const zeigen = !ruhig && !weiter;

  // Der Film: Teilschritt für Teilschritt, dann die nächste Szene. Ein Klick setzt nur Szene/Schritt neu – der Film läuft weiter.
  useEffect(() => {
    if (!aktiv || ruhig || weiter) return;
    const takte = TAKTE[szene];
    const t = setTimeout(() => {
      if (s < takte.length - 1) setS(s + 1);
      else { setSzene((szene + 1) % SZENEN.length); setS(0); }
    }, takte[Math.min(s, takte.length - 1)]);
    return () => clearTimeout(t);
  }, [aktiv, ruhig, weiter, szene, s]);

  // Zeiger zum Ziel des Schritts schicken (Mitte des Elements mit data-zeiger)
  useEffect(() => {
    const leib = leibRef.current, zeiger = zeigerRef.current;
    if (!leib || !zeiger) return;
    // Kein Ziel im Schritt → der Zeiger tritt zurück (blendet aus), statt über Dingen zu schweben, die man nicht klicken kann
    const setze = () => {
      const el = leib.querySelector<HTMLElement>("[data-zeiger]");
      if (!el) { zeiger.dataset.ruht = ""; return; }
      delete zeiger.dataset.ruht;
      const a = leib.getBoundingClientRect(), b = el.getBoundingClientRect();
      zeiger.style.left = `${Math.round(b.left - a.left + b.width / 2)}px`;
      zeiger.style.top = `${Math.round(b.top - a.top + b.height / 2)}px`;
    };
    const f = requestAnimationFrame(setze);
    window.addEventListener("resize", setze);
    return () => { cancelAnimationFrame(f); window.removeEventListener("resize", setze); };
  }, [szene, s, zeigen]);

  // mitHerkunft: auf der Website (/w/…) gehen Kampagnen-Quelle und Sprache mit in die Aufnahme
  const starteAufnahme = () => { setWeiter(true); setTimeout(() => { window.location.href = mitHerkunft(START_URL); }, 1300); };
  const tippe = (f: () => void, tief = false) => {
    f();
    const n = klicks + 1;
    setKlicks(n);
    if (tief || n >= TIEFE) starteAufnahme();
  };
  const weiterZu = (n: number) => { setSzene(n); setS(0); };
  const waehle = (n: number) => tippe(() => weiterZu(n));

  const Bild = SZENE[szene];
  const gesamt = TAKTE[szene].length;
  const schritt = ruhig ? gesamt - 1 : s;
  // Fortschrittsbalken nach Zeit, nicht nach Zahl der Teilschritte (der Zeitraffer hat viele kurze Schritte)
  const dauer = TAKTE[szene].reduce((a, b) => a + b, 0);
  const anteil = TAKTE[szene].slice(0, s + 1).reduce((a, b) => a + b, 0) / dauer;

  return (
    <Eigen.Provider value={stelle.trim()}>
    <div
      className="k1f"
      onPointerEnter={(e) => { if (e.pointerType === "mouse") setMaus(true); }}
      onPointerLeave={() => setMaus(false)}
      onDragOver={(e) => { e.preventDefault(); setZiehen(true); }}
      onDragLeave={() => setZiehen(false)}
      onDrop={(e) => { e.preventDefault(); setZiehen(false); starteAufnahme(); }}
    >
      <div className="k1f-story" role="tablist" aria-label="Die vier Schritte">
        {SZENEN.map((z, i) => (
          <button key={z.lang} type="button" role="tab" aria-selected={i === szene} onClick={() => waehle(i)}>
            <i style={{ "--f": i < szene ? 1 : i > szene ? 0 : (ruhig ? 1 : anteil), "--d": `${TAKTE[szene][s]}ms` } as CSSProperties} />
            <span className="k1f-lang">{z.lang}</span><span className="k1f-kurz">{z.kurz}</span>
          </button>
        ))}
      </div>
      <div className="k1f-app">
        <aside className="k1f-nav" aria-hidden="true">
          <MatchuntLogo size={24} className="k1f-marke" />
          {["start", "stellen", "bewerber", "termine", "angebot"].map((n) => <span key={n} className={kl(NAV_AKTIV[szene] === n && "an")}><Symbol n={n} /></span>)}
        </aside>
        <div ref={leibRef} className="k1f-leib" role="tabpanel" aria-label={SZENEN[szene].lang}>
          <Bild key={szene} s={schritt} tippe={tippe} setS={setS} weiterZu={weiterZu} />
          {zeigen && (
            <span ref={zeigerRef} className={kl("k1f-zeiger", maus && "weg", KLICK[szene].includes(s) && "klick")} aria-hidden="true">
              {szene === 0 && s === 2 && <span className="k1f-trage"><DateiKarte /></span>}
            </span>
          )}
          {ziehen && <div className="k1f-ablage">Anzeige hier ablegen<small>Wir gehen gleich in Ihre Aufnahme.</small></div>}
          {weiter && <div className="k1f-ablage k1f-weiter">Weiter zu Ihrer Stelle …<small>Die Aufnahme öffnet sich.</small></div>}
        </div>
      </div>
    </div>
    </Eigen.Provider>
  );
}
