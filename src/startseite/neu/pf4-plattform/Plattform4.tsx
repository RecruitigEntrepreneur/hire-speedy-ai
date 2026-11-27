// Fassung 60.4 „Plattform“ (26.11.2026, Markos Wunsch): wie 60.3 (blaues Feld, dritte Karte „Läuft mit Ihren
// Werkzeugen“), aber an der Stelle der fünften Karte „Vom Angebot zur Unterschrift“ steht jetzt die Geschichte aus
// Sektion 100 (neu/k14): Die passende Person hat einen Job und liest keine Anzeigen; ein Headhunter spricht sie an.
// Karten 1, 2 und 4 sind aus 60.2 übernommen (dort privat, darum hier kopiert); 60.2 und 60.3 bleiben unverändert.
import type { CSSProperties, ReactNode } from "react";
import { START_URL, useSichtbar } from "@/startseite/nachbau/basis";
import { kl, useSchritte } from "@/startseite/nachbau/rampTakt";
import { hhFoto } from "@/startseite/matchunt/fotos";
import { Karte } from "@/startseite/matchunt/s60-2-plattform/Plattform";
import { Werkzeuge } from "@/startseite/matchunt/s60-3-plattform/Werkzeuge";
import "./pf4.css";

const STELLE = "Leitung Controlling";

const Haken = () => (
  <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
    <path d="m2.5 6.3 2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Person = ({ klasse, foto }: { klasse?: string; foto?: number }) => {
  const bild = foto == null ? null : hhFoto(foto);
  return (
    <span className={kl("s602-person", klasse)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {bild ? <img src={bild} alt="" /> : <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9.2" r="4" /><path d="M4 22c0-4.6 3.6-7.4 8-7.4s8 2.8 8 7.4z" /></svg>}
    </span>
  );
};

/* 1 · Aufnahme aus Ihrer Anzeige */
const ETAPPEN = ["Eckdaten", "Vergütung", "Konditionen", "Anforderungen", "Rahmendaten"];
const FELDER: [string, string][] = [["Arbeitsmodell", "Hybrid"], ["Erfahrung", "ab 8 Jahren"], ["Führung", "Team von 6"], ["Aufgaben", "Abschluss, Planung, Reporting"]];
const TAKT_1 = [900, 750, 750, 750, 750, 1500, 2800, 500] as const;
export function Aufnahme() {
  const [ref, da] = useSichtbar<HTMLElement>(0.35);
  const s = useSchritte(da, TAKT_1, 6);
  const weg = s === 7;
  return (
    <Karte gross titel="Aufnahme aus Ihrer Anzeige" innenRef={ref} weg={weg}>
      <div className="s602-app">
        <div className="s602-etappen">{ETAPPEN.map((e, i) => <span key={e} className={kl(i === 0 && "da")}>{e}</span>)}</div>
        <strong className="s602-titel">{STELLE}</strong>
        <p className={kl("s602-hinweis s602-ein", s >= 5 && "an")}>Aus Ihrer Anzeige übernommen · <b>3 noch zu prüfen</b></p>
        <dl className="s602-felder">
          {FELDER.map(([n, w], i) => (
            <div key={n}>
              <dt>{n} <span className={kl("s602-ein", s >= i + 1 && "an")}>· aus der Anzeige</span></dt>
              <dd className={kl("s602-ein", s >= i + 1 && "an")}>{w}</dd>
            </div>
          ))}
          <div>
            <dt>Gehalt</dt>
            <dd className={kl(s >= 6 ? "s602-voll" : "s602-fehlt")}>{s >= 6 ? "95.000 – 110.000 €" : "fehlt noch"}</dd>
          </div>
        </dl>
        <span className={kl("s602-knopf", s >= 6 && "bereit")}>Weiter</span>
      </div>
    </Karte>
  );
}

/* 2 · Sie sehen, wer für Ihre Stelle sucht (Jobkarte aus „Meine Stellen“) */
const STAPEL: { name: string; stufe: string; note: string }[] = [
  { name: "Headhunter 1", stufe: "Gold Partner", note: "4,9" },
  { name: "Headhunter 2", stufe: "Silber Partner", note: "4,8" },
  { name: "Headhunter 3", stufe: "Partner", note: "4,7" },
];
const WEG = ["Suche", "Vorschläge", "Interviews", "Angebot", "Besetzt"];
// 0–4 wie 60.2 · 5–7 je eine Headhunter-Karte auf den Stapel · 8 stehen lassen · 9 blasser, dann von vorn
const TAKT_2 = [1000, 950, 950, 1300, 3200, 1000, 1000, 1000, 2600, 500] as const;
export function Suche() {
  const [ref, da] = useSichtbar<HTMLElement>(0.35);
  const s = useSchritte(da, TAKT_2, 8);
  const weg = s === 9;
  const k = Math.max(0, s - 4); // angehängt: so viele Headhunter-Karten liegen schon auf dem Stapel
  const n = Math.min(s, 3);
  const stufe = s >= 4 ? 1 : 0;
  return (
    <Karte gross titel="Sie sehen, wer für Ihre Stelle sucht" innenRef={ref} weg={weg}>
      <div className="s602-app pf4-mit-stapel" data-stapel={k > 0}>
        <div className="s602-jobkopf">
          <span>
            <strong className="s602-titel">{STELLE}</strong>
            <small>Festanstellung · Hybrid · seit 3 Tagen</small>
          </span>
          <span className={kl("s602-rennen s602-ein", s >= 4 && "an")}>
            <Person klasse="neu" />
            <small><b>1 neu</b> · 1 im Rennen</small>
          </span>
        </div>
        <div className="s602-weg">{WEG.map((w, i) => <i key={w} className={kl(i <= stufe && "an")} />)}</div>
        <div className="s602-wegnamen">{WEG.map((w, i) => <span key={w} className={kl(i === stufe && "da")}>{w}</span>)}</div>
        <div className="s602-fuss">
          <span className="s602-neues">
            {s >= 4 ? <><i className="s602-punkt" /><b>Neu:</b> Leiter Controlling · 12 Jahre</> : n > 0 ? "Headhunter suchen gerade." : " "}
          </span>
          <span className="s602-sucher">
            <span className="s602-gesichter">{[0, 1, 2].map((i) => <Person key={i} foto={i} klasse={kl("s602-ein", n > i && "an")} />)}</span>
            {n === 0 ? "Noch sucht kein Headhunter" : n === 1 ? "1 Headhunter sucht" : `${n} Headhunter suchen`}
          </span>
        </div>
        {/* 26.11.2026 (Markos Wunsch): erst läuft alles wie in 60.2; danach schieben sich die Headhunter als Karten
            übereinander, mit Stufe und Bewertung. ACHTUNG: Eine Bewertung von Headhuntern für Kunden gibt es in der
            App noch nicht; die Werte sind Beispiele. */}
        <div className="pf4-stapel" data-an={k > 0} aria-hidden="true">
          {STAPEL.map((h, i) => {
            const da = k > i;
            return (
              <div key={h.name} className="pf4-sh" data-da={da} style={{ "--pos": da ? k - 1 - i : 0 } as CSSProperties}>
                <Person foto={i} />
                <span className="pf4-sh-wer"><b>{h.name}</b><small><em data-stufe={h.stufe}>{h.stufe}</em><span className="pf4-note"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z" /></svg>{h.note}</span></small></span>
                <span className="pf4-sh-neu">sucht</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="s602-app s602-ruhig">
        <div className="s602-jobkopf"><span><strong className="s602-titel">Bilanzbuchhaltung</strong><small>Festanstellung · Vor Ort · seit heute</small></span></div>
        <div className="s602-fuss">
          <span className="s602-neues">Headhunter suchen gerade.</span>
          <span className="s602-sucher"><span className="s602-gesichter"><Person foto={3} /></span>1 Headhunter sucht</span>
        </div>
      </div>
    </Karte>
  );
}

/* 4 · Interviews mit Terminvorschlag */
const TERMINE = [["Di", "10:00 Uhr"], ["Mi", "14:30 Uhr"], ["Do", "09:00 Uhr"]];
const TAKT_4 = [1000, 1100, 1000, 900, 2800, 500] as const;
export function Interview() {
  const [ref, da] = useSichtbar<HTMLElement>(0.35);
  const s = useSchritte(da, TAKT_4, 4);
  const weg = s === 5;
  const gewaehlt = s >= 1;
  const fest = s >= 4;
  return (
    <Karte titel="Interviews mit Terminvorschlag" innenRef={ref} weg={weg}>
      <div className="s602-app">
        <div className="s602-jobkopf s602-mitte">
          <span className="s602-wer"><Person /><strong className="s602-titel">Interview · Kandidat 1</strong></span>
        </div>
        <em className="s602-stand s602-links">Im Interviewprozess</em>
        <div className="s602-termine">
          {TERMINE.map(([tag, zeit], i) => (
            <div key={tag} className={kl(gewaehlt && i === 1 && "wahl", fest && i !== 1 && "blass")}>
              <b>{tag}</b><span>{zeit}</span>
              {i === 1 && <i className={kl("s602-ein", fest && "an")}><Haken /></i>}
            </div>
          ))}
        </div>
        <span className={kl("s602-knopf", gewaehlt && "bereit", s === 3 && "druck", fest && "fest")}>{fest ? "Termin steht" : "Termin bestätigen"}</span>
      </div>
    </Karte>
  );
}

/* 5 · Die passende Person liest keine Anzeigen (aus Sektion 100) */
// 0 Person bei der Arbeit · 1 Anzeige zieht ungelesen vorbei · 2 Headhunter schreibt · 3 Antwort · 4 stehen lassen · 5 blasser, von vorn
const TAKT_5 = [1000, 1800, 1400, 1200, 3200, 500] as const;
const STAND = ["Bei der Arbeit", "Liest keine Anzeigen", "Liest keine Anzeigen", "Gespräch vereinbart", "Gespräch vereinbart", "Gespräch vereinbart"];
export function SuchtNicht() {
  const [ref, da] = useSichtbar<HTMLElement>(0.35);
  const s = useSchritte(da, TAKT_5, 4);
  const weg = s === 5;
  return (
    <Karte titel="Die passende Person liest keine Anzeigen." innenRef={ref} weg={weg}>
      <div className="s602-app pf4-app">
        <div className="s602-jobkopf s602-mitte">
          <span className="s602-wer"><Person /><span><strong className="s602-titel">{STELLE}</strong><small>Hat einen Job · Beispiel</small></span></span>
          <span className={kl("pf4-stand", s >= 3 && "gut")} key={STAND[s]}>{STAND[s]}</span>
        </div>
        <div className={kl("pf4-anzeige", s === 1 && "vorbei", s >= 2 && "fort")}><small>Stellenanzeige</small><i /><i /><em>ungelesen</em></div>
        <div className="pf4-chat">
          <p className={kl("pf4-hh s602-ein", s >= 2 && "an")}><small>Headhunter</small>Darf ich Ihnen eine Stelle zeigen?</p>
          <p className={kl("pf4-antwort s602-ein", s >= 3 && "an")}>Gern, rufen Sie mich an.</p>
        </div>
      </div>
    </Karte>
  );
}

/** wie 60.3, fünfte Karte aus Sektion 100 */
export function Plattform4({ fuenfte }: { fuenfte?: ReactNode } = {}) {
  return (
    <section className="s602 s603-quer">
      <div className="mu-wrap">
        <h2 className="mu-h2 s602-h2">Die Headhunter-Plattform für die ganze Besetzung.</h2>
        <div className="s602-knoepfe">
          <a className="mu-knopf" href={START_URL}>Stelle beschreiben</a>
          <a className="mu-knopf s602-zweit" href="#s602-ablauf">Ablauf ansehen</a>
        </div>
        <div className="s602-raster" id="s602-ablauf">
          <Aufnahme />
          <Suche />
          <Werkzeuge />
          <Interview />
          {fuenfte ?? <SuchtNicht />}
        </div>
        <p className="mu-klein s602-note">Beispiel, keine echten Daten.</p>
      </div>
    </section>
  );
}
