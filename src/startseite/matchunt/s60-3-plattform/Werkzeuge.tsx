// Karte „Läuft mit Ihren Werkzeugen“ für Sektion 60.3 (26.11.2026): Matchunt in der Mitte, darüber die drei verbundenen
// Werkzeuge mit ihren echten Logos, darunter blasser, was in Arbeit ist. Stände wie in der Sektion „Verbindungen“
// (neu/v1): „Verbunden“ nur Outlook-Kalender, Microsoft Teams und DocuSign. Logos unverändert aus public/logos/werkzeuge.
// 27.11.2026: Texte laufen über tx() (Wörterbuch website/uebersetzung/plattform.ts); Markennamen in KOMMT bleiben stehen.
/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from "react";
import { useSichtbar } from "@/startseite/nachbau/basis";
import { kl, useSchritte } from "@/startseite/nachbau/rampTakt";
import { MatchuntLogo } from "@/startseite/seite/Logo";
import { Karte } from "../s60-2-plattform/Plattform";
import { useTx } from "@/startseite/website/uebersetzen";
import "./s603.css";

const DA: [string, string, string, boolean?][] = [["Outlook", "outlook", "Termin im Kalender"], ["Teams", "teams", "Link zum Gespräch"], ["DocuSign", "docusign", "Unterschrift", true]];
// VORSCHAU (26.11.2026, Markos Wunsch „dass wir sehen, wie es aussieht“): Google Kalender, Google Meet und Zoom stehen
// hier als verbunden, sind es in der App aber noch NICHT. Vor dem Livegang zurück nach KOMMT, falls bis dahin nicht verbunden.
const DA_UNTEN: [string, string, string, boolean?][] = [["Google Kalender", "google-kalender", "Termin im Kalender"], ["Google Meet", "google-meet", "Link zum Gespräch"], ["Zoom", "zoom", "Link zum Gespräch", true]];
const KOMMT: [string, string, boolean?][] = [
  ["Personio", "personio", true], ["Workday", "workday", true],
  ["LinkedIn", "linkedin", true], ["XING", "xing", true], ["StepStone", "stepstone", true], ["Indeed", "indeed", true], ["DATEV", "datev"], ["Lexware", "lexware", true],
];
// 0 Matchunt · 1–3 die drei Werkzeuge oben · 4–6 die drei unten · 7 was in Arbeit ist · 8 stehen lassen · 9 blasser, dann von vorn
const TAKT = [800, 600, 600, 600, 600, 600, 800, 1200, 3600, 500] as const;

export function Werkzeuge() {
  const tx = useTx();
  const [ref, da] = useSichtbar<HTMLElement>(0.35);
  const s = useSchritte(da, TAKT, 8);
  return (
    <Karte titel={tx("Läuft mit Ihren Werkzeugen")} innenRef={ref} weg={s === 9}>
      <div className="s602-app s603">
        <small className="s603-marke"><i />{tx("Verbunden")}</small>
        <ul className="s603-da">
          {DA.map(([name, logo, was, breit], i) => (
            <li key={name} className={kl(s >= i + 1 && "an")}>
              <span className="s603-kachel" data-breit={!!breit}><img src={`/logos/werkzeuge/${logo}.svg`} alt="" /></span>
              <b>{tx(name)}</b><small>{tx(was)}</small>
              <u />
            </li>
          ))}
        </ul>
        <span className="s603-mitte"><MatchuntLogo size={26} />Matchunt</span>
        <ul className="s603-da s603-unten">
          {DA_UNTEN.map(([name, logo, was, breit], i) => (
            <li key={name} className={kl(s >= i + 4 && "an")}>
              <u />
              <span className="s603-kachel" data-breit={!!breit}><img src={`/logos/werkzeuge/${logo}.svg`} alt="" /></span>
              <b>{tx(name)}</b><small>{tx(was)}</small>
            </li>
          ))}
        </ul>
        <div className={kl("s603-kommt s602-ein", s >= 7 && "an")}>
          <small className="s603-marke leise">{tx("In Arbeit")}</small>
          <ul>
            {KOMMT.map(([name, logo, breit], i) => (
              <li key={name} title={name} data-breit={!!breit} style={{ "--i": i } as CSSProperties}><img src={`/logos/werkzeuge/${logo}.svg`} alt={name} /></li>
            ))}
          </ul>
        </div>
      </div>
    </Karte>
  );
}
