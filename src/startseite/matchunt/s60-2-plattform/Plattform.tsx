// Sektion 60.2 „Plattform“ (dritte Fassung, 23.11.2026): Aufbau wie 60.1 (Überschrift, zwei Knöpfe, zwei große und
// drei kleinere Karten mit je einem kleinen Ablauf). Neu: Jede Karte zeigt ein Stück der echten App mit deren
// Wörtern (Stellen-Übersicht, Aufnahme in Etappen, Profil, Interview-Termin, Angebots-Stände), Beispielstelle
// „Leitung Controlling“. Überschriften nach dem Textbuch Startseite B (ein Satz je Karte). Keine Deko-Hintergründe.
// 27.11.2026: Texte laufen über tx() (Wörterbuch website/uebersetzung/plattform.ts); Schlüssel, Klassen bleiben deutsch.
import type { ReactNode, RefObject } from "react";
import { START_URL, useSichtbar } from "@/startseite/nachbau/basis";
import { kl, useSchritte } from "@/startseite/nachbau/rampTakt";
import { hhFoto } from "@/startseite/matchunt/fotos";
import { useTx } from "@/startseite/website/uebersetzen";
import "./s602.css";

const STELLE = "Leitung Controlling";

/** `titel` kommt schon übersetzt (tx beim Aufrufer). */
export function Karte({ gross, titel, children, innenRef, weg }: { gross?: boolean; titel: string; children: ReactNode; innenRef: RefObject<HTMLElement | null>; weg: boolean }) {
  return (
    <article className={kl("s602-k", gross ? "s602-gross" : "s602-klein")} ref={innenRef}>
      <h3 className="s602-kt">{titel}</h3>
      <div className={kl("s602-bild", weg && "weg")} aria-hidden="true">{children}</div>
    </article>
  );
}

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
function Aufnahme() {
  const tx = useTx();
  const [ref, da] = useSichtbar<HTMLElement>(0.35);
  const s = useSchritte(da, TAKT_1, 6);
  const weg = s === 7;
  return (
    <Karte gross titel={tx("Aufnahme aus Ihrer Anzeige")} innenRef={ref} weg={weg}>
      <div className="s602-app">
        <div className="s602-etappen">{ETAPPEN.map((e, i) => <span key={e} className={kl(i === 0 && "da")}>{tx(e)}</span>)}</div>
        <strong className="s602-titel">{tx(STELLE)}</strong>
        <p className={kl("s602-hinweis s602-ein", s >= 5 && "an")}>{tx("Aus Ihrer Anzeige übernommen")} · <b>{tx("3 noch zu prüfen")}</b></p>
        <dl className="s602-felder">
          {FELDER.map(([n, w], i) => (
            <div key={n}>
              <dt>{tx(n)} <span className={kl("s602-ein", s >= i + 1 && "an")}>· {tx("aus der Anzeige")}</span></dt>
              <dd className={kl("s602-ein", s >= i + 1 && "an")}>{tx(w)}</dd>
            </div>
          ))}
          <div>
            <dt>{tx("Gehalt")}</dt>
            <dd className={kl(s >= 6 ? "s602-voll" : "s602-fehlt")}>{s >= 6 ? tx("95.000 – 110.000 €") : tx("fehlt noch")}</dd>
          </div>
        </dl>
        <span className={kl("s602-knopf", s >= 6 && "bereit")}>{tx("Weiter")}</span>
      </div>
    </Karte>
  );
}

/* 2 · Sie sehen, wer für Ihre Stelle sucht (Jobkarte aus „Meine Stellen“) */
const WEG = ["Suche", "Vorschläge", "Interviews", "Angebot", "Besetzt"];
const TAKT_2 = [1000, 950, 950, 1300, 3200, 500] as const;
function Suche() {
  const tx = useTx();
  const [ref, da] = useSichtbar<HTMLElement>(0.35);
  const s = useSchritte(da, TAKT_2, 4);
  const weg = s === 5;
  const n = Math.min(s, 3);
  const stufe = s >= 4 ? 1 : 0;
  return (
    <Karte gross titel={tx("Sie sehen, wer für Ihre Stelle sucht")} innenRef={ref} weg={weg}>
      <div className="s602-app">
        <div className="s602-jobkopf">
          <span>
            <strong className="s602-titel">{tx(STELLE)}</strong>
            <small>{tx("Festanstellung · Hybrid · seit 3 Tagen")}</small>
          </span>
          <span className={kl("s602-rennen s602-ein", s >= 4 && "an")}>
            <Person klasse="neu" />
            <small><b>{tx("1 neu")}</b> · {tx("{k} im Rennen", { k: 1 })}</small>
          </span>
        </div>
        <div className="s602-weg">{WEG.map((w, i) => <i key={w} className={kl(i <= stufe && "an")} />)}</div>
        <div className="s602-wegnamen">{WEG.map((w, i) => <span key={w} className={kl(i === stufe && "da")}>{tx(w)}</span>)}</div>
        <div className="s602-fuss">
          <span className="s602-neues">
            {s >= 4 ? <><i className="s602-punkt" /><b>{tx("Neu:")}</b> {tx("Leiter Controlling · 12 Jahre")}</> : n > 0 ? tx("Headhunter suchen gerade.") : " "}
          </span>
          <span className="s602-sucher">
            <span className="s602-gesichter">{[0, 1, 2].map((i) => <Person key={i} foto={i} klasse={kl("s602-ein", n > i && "an")} />)}</span>
            {n === 0 ? tx("Noch sucht kein Headhunter") : n === 1 ? tx("1 Headhunter sucht") : tx("{n} Headhunter suchen", { n })}
          </span>
        </div>
      </div>
      <div className="s602-app s602-ruhig">
        <div className="s602-jobkopf"><span><strong className="s602-titel">{tx("Bilanzbuchhaltung")}</strong><small>{tx("Festanstellung · Vor Ort · seit heute")}</small></span></div>
        <div className="s602-fuss">
          <span className="s602-neues">{tx("Headhunter suchen gerade.")}</span>
          <span className="s602-sucher"><span className="s602-gesichter"><Person foto={3} /></span>{tx("1 Headhunter sucht")}</span>
        </div>
      </div>
    </Karte>
  );
}

/* 3 · Vorstellungen nach dem Gespräch (Profil) */
const ECK: [string, string][] = [["Rolle", "Leiter Controlling"], ["Erfahrung", "12 Jahre"], ["Gehalt", "im Rahmen"], ["Verfügbar", "in 3 Monaten"]];
const TAKT_3 = [800, 1100, 1100, 1100, 1300, 2800, 500] as const;
function Vorstellung() {
  const tx = useTx();
  const [ref, da] = useSichtbar<HTMLElement>(0.35);
  const s = useSchritte(da, TAKT_3, 5);
  const weg = s === 6;
  const angefragt = s >= 5;
  return (
    <Karte titel={tx("Vorstellungen nach dem Gespräch")} innenRef={ref} weg={weg}>
      <div className="s602-app">
        <div className="s602-jobkopf s602-mitte">
          <span className="s602-wer"><Person /><strong className="s602-titel">{tx("Kandidat {n}", { n: 1 })}</strong></span>
          <em className="s602-stand">{angefragt ? tx("Im Interviewprozess") : tx("Neu · heute")}</em>
        </div>
        <dl className={kl("s602-felder s602-ein", s >= 1 && "an")}>
          {ECK.map(([n, w]) => <div key={n}><dt>{tx(n)}</dt><dd>{tx(w)}</dd></div>)}
        </dl>
        <div className={kl("s602-block s602-ein", s >= 2 && "an")}><small>{tx("Notizen aus dem Gespräch")}</small><u /><u style={{ width: "72%" }} /></div>
        <div className={kl("s602-block s602-ein", s >= 3 && "an")}><small>{tx("Einschätzung zur Stelle")}</small><u style={{ width: "86%" }} /></div>
        <span className={kl("s602-knopf", s >= 3 && !angefragt && "bereit", s === 4 && "druck")}>{tx("Interview anfragen")}</span>
      </div>
    </Karte>
  );
}

/* 4 · Interviews mit Terminvorschlag */
const TERMINE = [["Di", "10:00"], ["Mi", "14:30"], ["Do", "09:00"]];
const TAKT_4 = [1000, 1100, 1000, 900, 2800, 500] as const;
function Interview() {
  const tx = useTx();
  const [ref, da] = useSichtbar<HTMLElement>(0.35);
  const s = useSchritte(da, TAKT_4, 4);
  const weg = s === 5;
  const gewaehlt = s >= 1;
  const fest = s >= 4;
  return (
    <Karte titel={tx("Interviews mit Terminvorschlag")} innenRef={ref} weg={weg}>
      <div className="s602-app">
        <div className="s602-jobkopf s602-mitte">
          <span className="s602-wer"><Person /><strong className="s602-titel">{tx("Interview · Kandidat {n}", { n: 1 })}</strong></span>
        </div>
        <em className="s602-stand s602-links">{tx("Im Interviewprozess")}</em>
        <div className="s602-termine">
          {TERMINE.map(([tag, zeit], i) => (
            <div key={tag} className={kl(gewaehlt && i === 1 && "wahl", fest && i !== 1 && "blass")}>
              <b>{tx(tag)}</b><span>{tx("{z} Uhr", { z: zeit })}</span>
              {i === 1 && <i className={kl("s602-ein", fest && "an")}><Haken /></i>}
            </div>
          ))}
        </div>
        <span className={kl("s602-knopf", gewaehlt && "bereit", s === 3 && "druck", fest && "fest")}>{fest ? tx("Termin steht") : tx("Termin bestätigen")}</span>
      </div>
    </Karte>
  );
}

/* 5 · Vom Angebot zur Unterschrift */
const STAENDE = ["Angebot gesendet", "Angebot angenommen", "Vertrag unterschrieben"];
const TAKT_5 = [900, 1200, 1200, 1300, 3000, 500] as const;
function Angebot() {
  const tx = useTx();
  const [ref, da] = useSichtbar<HTMLElement>(0.35);
  const s = useSchritte(da, TAKT_5, 4);
  const weg = s === 5;
  return (
    <Karte titel={tx("Vom Angebot zur Unterschrift")} innenRef={ref} weg={weg}>
      <div className="s602-app">
        <div className="s602-jobkopf s602-mitte">
          <span className="s602-wer"><Person /><span><strong className="s602-titel">{tx("Kandidat {n}", { n: 1 })}</strong><small>{tx(STELLE)}</small></span></span>
        </div>
        <ol className="s602-staende">
          {STAENDE.map((t, i) => (
            <li key={t} className={kl(s >= i + 1 && "ok", s === i + 1 && s < 4 && "dran")}><i><Haken /></i>{tx(t)}</li>
          ))}
        </ol>
        <p className={kl("s602-schluss s602-ein", s >= 4 && "an")}>{tx("Honorar nur bei Einstellung, erst mit der Unterschrift.")}</p>
      </div>
    </Karte>
  );
}

/** `dritte` = eine andere dritte Karte an der Stelle von „Vorstellungen nach dem Gespräch“ (Fassung 60.3). */
export function Plattform({ dritte }: { dritte?: ReactNode } = {}) {
  const tx = useTx();
  return (
    <section className={dritte ? "s602 s603-quer" : "s602"}>
      <div className="mu-wrap">
        <h2 className="mu-h2 s602-h2">{tx("Die Headhunter-Plattform für die ganze Besetzung.")}</h2>
        <div className="s602-knoepfe">
          <a className="mu-knopf" href={START_URL}>{tx("Stelle beschreiben")}</a>
          <a className="mu-knopf s602-zweit" href="#s602-ablauf">{tx("Ablauf ansehen")}</a>
        </div>
        <div className="s602-raster" id="s602-ablauf">
          <Aufnahme />
          <Suche />
          {dritte ?? <Vorstellung />}
          <Interview />
          <Angebot />
        </div>
        <p className="mu-klein s602-note">{tx("Beispiel, keine echten Daten.")}</p>
      </div>
    </section>
  );
}
