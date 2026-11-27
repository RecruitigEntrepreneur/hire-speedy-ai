// Karriere-Seite (27.11.2026, Marko: „baue nur unsere Karriere-Seite in unserem Style wie die Startseite, Sektion 1–6“).
// Inhalt nach Entwurf A: nichts Erfundenes – was wir bauen, eine ehrliche Stellenliste (gerade leer), wie man sich
// bewirbt. Stil: blaue Tafel mit Kerbe wie der Einstieg K1, Karten wie Preis/Plattform, Weg mit Punkten wie Satz 18.
import type { CSSProperties } from "react";
import { useSichtbar } from "@/startseite/nachbau/basis";
import { Zeichen, type ZeichenArt } from "@/startseite/matchunt/s06-zeichen/Zeichen";
import { SEITEN } from "@/startseite/website/adressen";
import { useTx } from "@/startseite/website/uebersetzen";
import "./kr.css";

// OFFEN (Marko bestätigen): eigene Bewerbungsadresse? Bis dahin die allgemeine Adresse aus dem Impressum.
const BEWERBUNG_URL = "mailto:info@bluewater-bridge.de?subject=Initiativbewerbung%20Matchunt";

/** Offene Stellen von Matchunt selbst. Leer = ehrlicher Hinweis mit Initiativbewerbung. */
type Stelle = { titel: string; ort: string; art: string; url: string };
const STELLEN: Stelle[] = [];

const KACHELN: [ZeichenArt, string, string][] = [
  ["stelle", "Stelle", "kr-k1"], ["gespraech", "Gespräch", "kr-k2"], ["suche", "Suche", "kr-k3"], ["einstellen", "Einstellung", "kr-k4"],
];
const KARTEN: [ZeichenArt, string, string][] = [
  ["stelle", "Eine Stelle, viele Headhunter.", "Firmen beschreiben ihre Stelle einmal, geprüfte Headhunter suchen."],
  ["einstellen", "Bezahlt wird bei Erfolg.", "Das Honorar fällt erst an, wenn jemand eingestellt ist."],
  ["profil", "Erst das Können.", "Kandidaten werden zuerst nach dem beurteilt, was sie können."],
];
const SCHRITTE: [string, string][] = [
  ["Du schreibst uns.", "Ein paar Sätze zu dir und dein Lebenslauf."],
  ["Wir sprechen.", "Ein Gespräch, persönlich oder per Video."],
  ["Du hörst von uns.", "In jedem Fall eine Antwort."],
];

export function Karriere() {
  const tx = useTx();
  const [tafel, tafelDa] = useSichtbar<HTMLDivElement>(0.2);
  const [karten, kartenDa] = useSichtbar<HTMLDivElement>(0.2);
  const [weg, wegDa] = useSichtbar<HTMLOListElement>(0.3);
  return (
    // Die Kopfzeile bringt der Rahmen der Seite mit (Rahmen kopf={<Kopf />}).
    <div className="kr">

      <section className="kr-einstieg">
        <div ref={tafel} className={`kr-tafel mu-feld${tafelDa ? " kr-da" : ""}`}>
          <i className="kr-kerbe" aria-hidden="true" />
          <i className="kr-raster" aria-hidden="true" />
          {KACHELN.map(([art, name, ort], i) => (
            <span key={name} className={`kr-kachel ${ort}`} style={{ "--i": i } as CSSProperties} aria-hidden="true">
              <Zeichen art={art} an={tafelDa} verzug={300 + i * 180} />
              {tx(name)}
            </span>
          ))}
          <div className="kr-mitte">
            <p className="kr-marke">{tx("Karriere bei Matchunt")}</p>
            <h1 className="mu-h1">{tx("Bau mit uns, wie Stellen besetzt werden.")}</h1>
            <p className="mu-text">{tx("Eine Plattform für Firmen und Headhunter. Aus München.")}</p>
            <a className="mu-knopf kr-knopf-weiss" href="#bewerben">{tx("Initiativ bewerben")}</a>
          </div>
        </div>
      </section>

      <section className="kr-teil">
        <div className="mu-wrap">
          <div className="kr-kopfzeile">
            <h2 className="mu-h2">{tx("Was wir bauen.")}</h2>
            <p className="mu-text">{tx("Ein Werkzeug, mit dem Firmen und Headhunter gemeinsam besetzen.")}</p>
          </div>
          <div ref={karten} className={`kr-karten${kartenDa ? " kr-da" : ""}`}>
            {KARTEN.map(([art, titel, text], i) => (
              <article key={titel} className="kr-karte" style={{ "--i": i } as CSSProperties}>
                <Zeichen art={art} an={kartenDa} verzug={200 + i * 200} />
                <h3>{tx(titel)}</h3>
                <p>{tx(text)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="kr-teil kr-grau" id="stellen">
        <div className="mu-wrap">
          <div className="kr-kopfzeile">
            <h2 className="mu-h2">{tx("Offene Stellen.")}</h2>
          </div>
          {STELLEN.length ? (
            <ul className="kr-stellen">
              {STELLEN.map((s) => (
                <li key={s.titel}>
                  <a className="kr-stelle" href={s.url}><b>{s.titel}</b><span>{s.ort} · {s.art}</span></a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="kr-leer">
              <b>{tx("Gerade ist keine Stelle ausgeschrieben.")}</b>
              <p>{tx("Wenn du trotzdem zu uns passt, schreib uns.")}</p>
              <a className="mu-knopf" href={BEWERBUNG_URL}>{tx("Initiativ bewerben")}</a>
            </div>
          )}
        </div>
      </section>

      <section className="kr-teil" id="bewerben">
        <div className="mu-wrap">
          <div className="kr-kopfzeile">
            <h2 className="mu-h2">{tx("So bewirbst du dich.")}</h2>
          </div>
          <ol ref={weg} className={`kr-weg${wegDa ? " kr-da" : ""}`}>
            {SCHRITTE.map(([titel, text], i) => (
              <li key={titel} className="kr-schritt" style={{ "--i": i } as CSSProperties}>
                <span className="kr-punkt" aria-label={tx("Schritt {n}", { n: i + 1 })}>{i + 1}</span>
                <b>{tx(titel)}</b>
                <p>{tx(text)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="kr-ende mu-feld">
        <h2 className="mu-h2">{tx("Schreib uns.")}</h2>
        <a className="mu-knopf kr-knopf-weiss" href={BEWERBUNG_URL}>{tx("Initiativ bewerben")}</a>
        <p className="kr-hh">{tx("Du bist Headhunter?")} <a href={SEITEN.headhunter}>{tx("Zur Seite für Headhunter")}</a></p>
      </section>
    </div>
  );
}
