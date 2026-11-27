// Sektion 18.1 „Weg“ (24.11.2026): Aufbau, Linie und Texte wie Sektion 18, aber die vier Bilder zeigen je eine
// Verwandlung derselben Stellenkarte – dieselbe Beispielstelle wie im Fenster unter dem Hero (Leitung Controlling):
// 1 vier Wege fallen in eine Stellenkarte · 2 die Stelle geht als Welle hinaus, Headhunter leuchten auf · 3 Kandidaten kommen, einer
// bekommt den Termin · 4 Unterschrift, Karte wird „Besetzt“.
// Jede Animation startet, wenn die Linie den Knoten erreicht (data-da am Listenpunkt), läuft einmal und bleibt stehen.
// Reines CSS (s181.css). Beispielwerte, keine echten Daten.
/* eslint-disable @next/next/no-img-element */
import type { CSSProperties, ReactNode } from "react";
import { hhFoto } from "@/startseite/matchunt/fotos";
import { Weg } from "../s18-weg/Weg";
import "./s181.css";

const STELLE = "Leitung Controlling";
const Haken = () => <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="m2.5 6.3 2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
/** Zwei Texte an derselben Stelle: der erste weicht zum Zeitpunkt t (Sekunden) dem zweiten. */
const Wechsel = ({ von, zu, t, klasse }: { von: ReactNode; zu: ReactNode; t: number; klasse?: string }) => (
  <span className={`s181-wechsel ${klasse ?? ""}`} style={{ "--t": `${t}s` } as CSSProperties}><span>{von}</span><span>{zu}</span></span>
);

// 1 · „Viele Wege, eine Stelle“: die vier Wege der Aufnahme (Wortlaut wie in der App) leuchten nacheinander auf,
// von jedem fällt ein Tropfen in dieselbe Stellenkarte. „Aus Personio“ fehlt bewusst, solange es nicht angeschlossen ist.
const WEGE: [string, string][] = [
  ["Link zur Anzeige", "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"],
  ["PDF oder Word", "M6 3h9l4 4v14H6zM15 3v4h4M9 13h6M9 17h4"],
  ["Anzeige einfügen", "M8 5h8v3H8zM8 6H6v15h12V6h-2M9 13h6M9 17h4"],
  ["Von Hand beschreiben", "M4 20l1-4L16 5l3 3L8 19zM14 7l3 3"],
];
function BildAnzeige() {
  return (
    <div className="s18-b s181 s181-1">
      <span className="s181-wege">
        {WEGE.map(([name, d], i) => (
          <span key={name} style={{ "--n": i } as CSSProperties}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
            {name}
          </span>
        ))}
      </span>
      <span className="s181-fall">{WEGE.map(([name], i) => <i key={name} style={{ "--n": i } as CSSProperties} />)}</span>
      <div className="s181-karte s181-ziel">
        <span className="s181-kopf"><b>{STELLE}</b><em className="s18-stand s181-gelesen"><Haken />angelegt</em></span>
      </div>
    </div>
  );
}

// 2 · „Die Welle“: von der Stelle läuft ein Kreis nach außen; wo er einen Headhunter erreicht, leuchtet dessen Gesicht auf.
const PLAETZE: { x: number; y: number; foto?: number; n: number }[] = [
  { x: 10, y: 17, foto: 0, n: 0 }, { x: 91, y: 22, foto: 1, n: 1 }, { x: 16, y: 88, foto: 2, n: 2 },
  { x: 84, y: 88, n: 3 }, { x: 52, y: 10, n: 4 },
];
// Danach reichen die drei Headhunter je einen Kandidaten ein: ein Kandidaten-Zeichen löst sich vom Headhunter, fliegt
// in die Stellenkarte und reiht sich dort rechts ein (Zeichen wie in Sektion 60.2). Ohne Foto und ohne Namen – so sieht der Kunde eine Vorstellung zuerst.
const Person = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9.2" r="4" /><path d="M4 22c0-4.6 3.6-7.4 8-7.4s8 2.8 8 7.4z" /></svg>;
const KANDIDATEN = 3;
function BildHeadhunter() {
  return (
    <div className="s18-b s181 s181-2">
      {[0, 1, 2].map((i) => <span key={i} className="s181-ring" style={{ "--n": i } as CSSProperties} />)}
      {PLAETZE.map((p) => {
        const bild = p.foto == null ? null : hhFoto(p.foto);
        return (
          <span key={p.n} className="s181-platz" data-an={p.foto != null || undefined} style={{ left: `${p.x}%`, top: `${p.y}%`, "--n": p.n } as CSSProperties}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9.2" r="4" /><path d="M4 22c0-4.6 3.6-7.4 8-7.4s8 2.8 8 7.4z" /></svg>
            {bild && <img src={bild} alt="" />}
          </span>
        );
      })}
      {PLAETZE.filter((p) => p.foto != null).map((p, i) => (
        <span key={p.n} className="s181-flug" style={{ "--x": `${p.x}%`, "--y": `${p.y}%`, "--n": i } as CSSProperties}><Person /></span>
      ))}
      <div className="s181-karte s181-mitte">
        <span className="s181-kopf"><b>{STELLE}</b><Wechsel von={<em className="s18-stand s181-leise">In Prüfung</em>} zu={<em className="s18-stand">Live</em>} t={0.4} /></span>
        <Wechsel von="Noch sucht kein Headhunter" zu="3 Headhunter suchen" t={2.7} klasse="s181-klein s181-links" />
        <span className="s181-profile">
          <span className="s181-kandidaten">{Array.from({ length: KANDIDATEN }, (_, i) => <i key={i} style={{ "--n": i } as CSSProperties}><Person /></i>)}</span>
          <small><b>{KANDIDATEN} neu</b></small>
        </span>
      </div>
    </div>
  );
}

// 3 · Kandidaten gehen ein, einer bekommt den Interview-Termin
function BildVorstellung() {
  return (
    <div className="s18-b s181 s181-3">
      <div className="s181-karte">
        <span className="s181-kopf"><b>{STELLE}</b></span>
        <span className="s181-reihe s181-wahl" style={{ "--n": 0 } as CSSProperties}>
          <span className="s181-kreis">K1</span>
          <span className="s181-wer"><b>Kandidat 1</b><small>Leiter Controlling</small></span>
          <Wechsel von={<em className="s18-stand s181-leise">Neu</em>} zu={<em className="s18-stand">Interview · Mi, 14:30</em>} t={2.1} />
        </span>
        <span className="s181-reihe s181-rest" style={{ "--n": 1 } as CSSProperties}>
          <span className="s181-kreis">K2</span>
          <span className="s181-wer"><b>Kandidat 2</b><small>Head of Controlling</small></span>
          <em className="s18-stand s181-leise">Neu</em>
        </span>
      </div>
    </div>
  );
}

// 4 · Der Vertrag wird unterschrieben, die Karte wird „Besetzt“
function BildUnterschrift() {
  return (
    <div className="s18-b s181 s181-4">
      <div className="s181-karte">
        <span className="s181-kopf"><b>{STELLE}</b><Wechsel von={<em className="s18-stand s181-leise">Angebot angenommen</em>} zu={<em className="s18-stand s181-voll">Besetzt</em>} t={2.4} /></span>
        <span className="s18-marke">Arbeitsvertrag</span>
        <svg className="s181-sign" viewBox="0 0 180 44" fill="none"><path pathLength={100} d="M6 30c10-18 18-22 20-12s-6 18-2 16 12-22 18-20 0 18 6 16 10-14 16-12 2 10 8 8 12-8 22-6 20 4 40-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
      </div>
    </div>
  );
}

// Station 1 nennt alle Wege, nicht nur das Einfügen
const SAETZE = ["Ein Link, eine Datei oder ein paar Sätze genügen für den Anfang."];
export const BILDER = [<BildAnzeige key="1" />, <BildHeadhunter key="2" />, <BildVorstellung key="3" />, <BildUnterschrift key="4" />];

export function WegVerwandlung() {
  return <Weg bilder={BILDER} saetze={SAETZE} />;
}
