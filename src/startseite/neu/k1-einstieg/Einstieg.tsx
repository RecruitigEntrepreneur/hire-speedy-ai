// Neue Sektion K1 „Einstieg für Kunden“ (23.11.2026): Aufbau wie Sektion 5 (blaue Tafel mit Kerbe und
// Linien-Zeichnung, unten überlappt ein Fenster), Überschrift aus Sektion 1, EIN Knopf ohne Eingabe:
// „Stelle kostenlos ausschreiben“. Das Fenster ist die echte App im Kleinen als klickbarer Rundgang (Fenster.tsx).
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import Link from "@/startseite/shims/link";
import { START_URL } from "@/startseite/nachbau/basis";
import { SprachMenue } from "@/startseite/website/SprachMenue";
import { mitHerkunft } from "@/startseite/website/herkunft";
import { MatchuntLogo } from "@/startseite/seite/Logo";
import { useRuhig } from "@/startseite/nachbau/rampTakt";
import { TeMarke } from "@/startseite/nachbau3/te/Marke";
import type { Art } from "@/startseite/nachbau3/te/tinte";
import { Zeichen, type ZeichenArt } from "@/startseite/matchunt/s06-zeichen/Zeichen";
import { Fenster } from "./Fenster";
import { hhFoto } from "@/startseite/matchunt/fotos";
import "./k1.css";

// OFFEN: Adressen der Kopfzeile und die Kennung für /start/<Kennung>.
/** Die eingetippte Stelle als ?stelle= an die Aufnahme (App: GuestIntake). */
const mitStelle = (u: string, s: string) => (s.trim() ? `${u}${u.includes("?") ? "&" : "?"}stelle=${encodeURIComponent(s.trim().slice(0, 120))}` : u);

const NAV: [string, string][] = [["Ablauf", "#ablauf"], ["Honorar", "#honorar"], ["Für Headhunter", "/recruiter/onboarding"], ["Anmelden", "/auth"]];
const KNOPF = "Stelle kostenlos ausschreiben";

const FUNKEL: [number, number][] = [[56, 56], [1176, 56], [224, 280], [1008, 280], [448, 112], [784, 112], [280, 456], [952, 456], [1176, 600], [56, 600]];
// Kacheln in der Reihenfolge des Wegs: x, y, Breite, Höhe, Beschriftung, Stelle auf dem Weg (0–1)
// Tinte statt Kreis in jeder Kachel (23.11.2026): dieselben Tropfen-Geschichten wie in Sektion 7.3 und 11.1
// Erst unser Zeichen (wie in Satz 7.3 und Sektion 11.1), dann – wenn das Licht kommt – die Tinte, die ihre Geschichte
// zeigt, danach wieder das Zeichen. Ohne Maus läuft das Licht von selbst und nimmt jede Kachel einmal mit.
const ZEICHEN_VON: Record<string, ZeichenArt> = { Stelle: "stelle", Suche: "suche", "Gespräch": "gespraech", Vorstellung: "profil", Interview: "termin", Einstellung: "einstellen" };
const TINTE_DAUER = 6600; // so lange zeigt eine Kachel ihre Tinte, wenn das Licht sie von selbst mitnimmt
const ERST_ZEICHEN = 2600; // so lange zeichnen sich am Anfang die Zeichen, bevor die erste Tinte kommt
const HALT = 3200; // ohne Maus hält das Licht an jeder Kachel so lange an, damit ihre Tinte Zeit hat
const TINTE_VON: Record<string, Art> = { Stelle: "stelle", Suche: "suche", "Gespräch": "gespraech", Vorstellung: "profil", Interview: "paar", Einstellung: "angebot" };
const KACHELN: [number, number, number, number, string, number][] = [
  [88, 64, 96, 96, "Stelle", 0], [64, 216, 120, 200, "Suche", 0.11], [88, 464, 96, 96, "Gespräch", 0.215],
  [1048, 464, 96, 96, "Vorstellung", 0.784], [1048, 216, 120, 200, "Interview", 0.889], [1048, 64, 96, 96, "Einstellung", 0.99],
];
// Der Weg einer Stelle durch die Zeichnung: links hinunter, unter der Überschrift entlang, rechts hinauf.
const WEG_D = "M136 112V512H264Q280 512 280 496V456H952V496Q952 512 968 512H1096V112";
const UMLAUF = 10; // Sekunden, die das Licht ohne Maus für den ganzen Weg braucht
// Handy (23.11.2026, Marko: „genau wie auf Desktop und bauen mobile draus“): dieselbe Zeichnung wie am Desktop –
// Raster, Linien, Kacheln mit Kreis, Weg mit Lichtstrich, Funkelpunkte –, nur fürs Hochformat zusammengeschoben:
// drei Kacheln über der Überschrift, drei darunter. Das Licht folgt dem Finger wie am Desktop der Maus; ohne
// Berührung läuft es von selbst.
// Kacheln: x, y, Breite, Höhe, Beschriftung (Feld 360 × 680). Wie am Desktop nicht alle gleich groß: die mittlere
// Kachel jeder Reihe ist größer.
const M_KACHELN: [number, number, number, number, string][] = [
  [16, 58, 84, 68, "Stelle"], [124, 46, 112, 92, "Suche"], [260, 58, 84, 68, "Gespräch"],
  [260, 478, 84, 68, "Vorstellung"], [124, 466, 112, 92, "Interview"], [16, 478, 84, 68, "Einstellung"],
];
// Weg: oben durch die Kachelmitten nach rechts, am rechten Rand hinunter, unten zurück nach links
const M_WEG = "M58 92H330Q348 92 348 110V494Q348 512 330 512H58";
const M_FUNKEL: [number, number][] = [[28, 152], [332, 152], [28, 452], [332, 452], [180, 152], [180, 452], [10, 20], [350, 660]];
const HANDY = "(max-width: 899px)";
const NAH = 0.045; // so nah (Anteil am Weg) muss das Licht einer Station kommen, damit sie aufleuchtet

// Das Licht auf dem Weg folgt der Maus (23.11.2026): Es gleitet zu der Stelle des Wegs, die dem Mauszeiger am
// nächsten ist, und die Station dort leuchtet auf. Ohne Maus (Handy, Maus außerhalb) läuft es langsam von selbst.
type Bilder = { an: Record<string, boolean>; runde: Record<string, number> };

/** Bild in einer Kachel (foreignObject im SVG, mittig um cx/cy, Kantenlänge s): unser Zeichen oder – solange `an` –
 *  die Tinte. Kehrt das Zeichen zurück, zeichnet es sich neu (runde). */
function Bild({ name, cx, cy, s, farbe, bilder, verzug }: { name: string; cx: number; cy: number; s: number; farbe: string; bilder: Bilder; verzug: number }) {
  const tinte = !!bilder.an[name];
  return (
    <foreignObject className="k1-tinte" x={cx - s / 2} y={cy - s / 2} width={s} height={s}>
      <div className="k1-bild">
        {tinte
          ? <TeMarke art={TINTE_VON[name]} className="k1-leinwand" spanne={2.3} hoch={2.3} farbe={farbe} />
          : <Zeichen art={ZEICHEN_VON[name]} verzug={verzug} neu={bilder.runde[name] ?? 0} />}
      </div>
    </foreignObject>
  );
}

function Plan({ svgRef, farbe, bilder, namen }: { svgRef: RefObject<SVGSVGElement | null>; farbe: string; bilder: Bilder; namen?: Record<string, string> }) {
  return (
    <svg ref={svgRef} className="k1-plan" viewBox="0 0 1232 688" aria-hidden="true">
      <defs>
        <pattern id="k1-raster" width="56" height="56" patternUnits="userSpaceOnUse"><path className="k1-rl" d="M56 0H0V56" /></pattern>
        <filter id="k1-weich" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5" /></filter>
      </defs>
      <rect width="1232" height="688" fill="url(#k1-raster)" />
      <path className="k1-bahn" d="M0 56H420Q448 56 448 84V112M1232 56H812Q784 56 784 84V112M240 112H992Q1008 112 1008 128V440Q1008 456 992 456H240Q224 456 224 440V128Q224 112 240 112Z" />
      <path className="k1-bahn" d="M184 280H224M1048 280H1008M56 0V688M1176 0V688M0 600H400Q448 600 448 648V688M1232 600H832Q784 600 784 648V688" />
      <path className="k1-weg" d={WEG_D} />
      <path className="k1-puls k1-puls-weich" d={WEG_D} pathLength={1} filter="url(#k1-weich)" />
      <path className="k1-puls" d={WEG_D} pathLength={1} />
      {KACHELN.map(([x, y, b, h, t, f], i) => {
        const gross = h > 100;
        return (
          <g key={t} className="k1-station" data-f={f} data-name={t} data-an="false">
            <rect className="k1-kachel" x={x} y={y} width={b} height={h} rx="18" />
            <Bild name={t} cx={x + b / 2} cy={y + h / 2 - (gross ? 20 : 8)} s={gross ? 92 : 60} farbe={farbe} bilder={bilder} verzug={300 + i * 260} />
            <text className="k1-marke" x={x + b / 2} y={y + h - 14}>{namen?.[t] ?? t}</text>
          </g>
        );
      })}
      {FUNKEL.map(([x, y], i) => <rect key={i} className="k1-fp" x={x - 3} y={y - 3} width="6" height="6" style={{ animationDelay: `${-i * 0.37}s` }} />)}
    </svg>
  );
}

function PlanHandy({ svgRef, farbe, bilder, namen }: { svgRef: RefObject<SVGSVGElement | null>; farbe: string; bilder: Bilder; namen?: Record<string, string> }) {
  return (
    <svg ref={svgRef} className="k1-plan-m" viewBox="0 0 360 680" preserveAspectRatio="xMidYMin meet" aria-hidden="true">
      <defs>
        <pattern id="k1-raster-m" width="28" height="28" patternUnits="userSpaceOnUse"><path className="k1-rl" d="M28 0H0V28" /></pattern>
        <filter id="k1-weich-m" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>
      <rect x="-200" y="-40" width="760" height="760" fill="url(#k1-raster-m)" />
      <path className="k1-bahn" d="M40 152H320Q332 152 332 164V440Q332 452 320 452H40Q28 452 28 440V164Q28 152 40 152Z" />
      <path className="k1-bahn" d="M180 138V152M180 452V466M100 92H124M236 92H260M100 512H124M236 512H260M10 -40V720M350 -40V720M-200 640H120Q140 640 140 660V720M560 640H240Q220 640 220 660V720" />
      <path className="k1-weg" d={M_WEG} />
      <path className="k1-puls k1-puls-weich" d={M_WEG} pathLength={1} filter="url(#k1-weich-m)" />
      <path className="k1-puls" d={M_WEG} pathLength={1} />
      {M_KACHELN.map(([x, y, b, h, t], i) => {
        const gross = b > 100;
        return (
          <g key={t} className="k1-station" data-cx={x + b / 2} data-cy={y + h / 2} data-name={t} data-an="false">
            <rect className="k1-kachel" x={x} y={y} width={b} height={h} rx="16" />
            <Bild name={t} cx={x + b / 2} cy={y + h / 2 - (gross ? 10 : 8)} s={gross ? 62 : 44} farbe={farbe} bilder={bilder} verzug={300 + i * 260} />
            <text className="k1-marke" x={x + b / 2} y={y + h - 10}>{namen?.[t] ?? t}</text>
          </g>
        );
      })}
      {M_FUNKEL.map(([x, y], i) => <rect key={i} className="k1-fp" x={x - 3} y={y - 3} width="6" height="6" style={{ animationDelay: `${-i * 0.37}s` }} />)}
    </svg>
  );
}

const kl = (...t: (string | false | null | undefined)[]) => t.filter(Boolean).join(" ");

/** Ohne Angaben: der Einstieg für Kunden (K1), unverändert. Mit Angaben derselbe Aufbau für eine andere Zielgruppe
 *  (H1, Einstieg für Headhunter, 26.11.2026): andere Beschriftung der Kacheln, andere Texte, anderes Fenster. */
// Beispiele, die sich im leeren Suchfeld von selbst tippen (Fassung mit Suchfeld, 26.11.2026)
const BEISPIELE = ["Leitung Controlling", "Vertriebsleitung", "Bilanzbuchhaltung", "Leitung Konstruktion"];

export type EinstiegProps = { eingabe?: boolean; namen?: Record<string, string>; h1?: string; satz?: string; knopf?: string; knopfUrl?: string; nav?: [string, string][]; fenster?: (aktiv: boolean, ruhig: boolean) => ReactNode };

export function Einstieg({ namen, h1 = "Die beste Person für Ihre Stelle hat schon einen Job.", satz = "Geprüfte Headhunter sprechen sie an. Erfolgsbasiert.", knopf = KNOPF, knopfUrl = START_URL, nav = NAV, fenster, eingabe = false }: EinstiegProps = {}) {
  // Suchfeld (nur mit `eingabe`): der getippte Titel erscheint unten im Fenster. Leer tippen sich Beispiele als Platzhalter.
  const [stelle, setStelle] = useState("");
  const [platz, setPlatz] = useState("Welche Stelle wollen Sie besetzen?");
  const ref = useRef<HTMLElement>(null);
  const [imBild, setImBild] = useState(false);
  const ruhig = useRuhig();
  const [tintenFarbe, setTintenFarbe] = useState("#ffffff");
  const [bilder, setBilder] = useState<Bilder>({ an: {}, runde: {} });
  /** Steuerung je Bild-Takt: welche Kachel zeigt gerade Tinte? `nah` = Kacheln, bei denen das Licht ist; `folgt` =
   *  das Licht folgt gerade Maus oder Finger (dann bleibt die Tinte, solange das Licht da ist). Gibt eine Funktion
   *  zurück, die im Takt aufgerufen wird; React wird nur bei einer Änderung benachrichtigt. */
  const neueSteuerung = () => {
    const bis: Record<string, number> = {};
    let an: Record<string, boolean> = {};
    const anfang = performance.now();
    return (nah: string[], folgt: boolean, jetzt: number) => {
      if (jetzt - anfang > ERST_ZEICHEN) {
        for (const n of nah) {
          if (folgt) bis[n] = Math.max(bis[n] ?? 0, jetzt + 900);
          else if (!((bis[n] ?? 0) > jetzt)) bis[n] = jetzt + TINTE_DAUER;
        }
      }
      const neu: Record<string, boolean> = {};
      let anders = false;
      for (const n of Object.keys(ZEICHEN_VON)) { neu[n] = (bis[n] ?? 0) > jetzt; if (neu[n] !== !!an[n]) anders = true; }
      if (!anders) return;
      const zurueck = Object.keys(neu).filter((n) => an[n] && !neu[n]);
      an = neu;
      setBilder((b) => ({ an: neu, runde: zurueck.length ? { ...b.runde, ...Object.fromEntries(zurueck.map((n) => [n, (b.runde[n] ?? 0) + 1])) } : b.runde }));
    };
  };
  const [handyAnsicht, setHandyAnsicht] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(HANDY);
    const pruefe = () => {
      setHandyAnsicht(m.matches);
      const f = tafel.current ? getComputedStyle(tafel.current).getPropertyValue("--mu-feld-tx").trim() : "";
      if (f) setTintenFarbe(f);
    };
    const t0 = setTimeout(pruefe, 0);
    m.addEventListener("change", pruefe);
    return () => { clearTimeout(t0); m.removeEventListener("change", pruefe); };
  }, []);

  // Licht auf dem Weg: folgt der Maus, sonst läuft es von selbst (siehe Plan). Läuft nur, solange der Hero im Bild ist.
  const plan = useRef<SVGSVGElement>(null);
  const tafel = useRef<HTMLDivElement>(null);
  const licht = useRef(0);
  useEffect(() => {
    const svg = plan.current, t = tafel.current;
    if (!imBild || ruhig || handyAnsicht || !svg || !t) return;
    const weg = svg.querySelector<SVGPathElement>(".k1-weg");
    if (!weg) return;
    const pulse = [...svg.querySelectorAll<SVGPathElement>(".k1-puls")];
    const stationen = [...svg.querySelectorAll<SVGGElement>(".k1-station")];
    const L = weg.getTotalLength();
    const proben = Array.from({ length: 401 }, (_, i) => { const q = weg.getPointAtLength((L * i) / 400); return [q.x, q.y, i / 400]; });
    const steuere = neueSteuerung();
    let cur = licht.current, ziel = cur, maus = false, bewegt = -1e9, zuletzt = performance.now(), bild = 0, halt = 0;
    const besucht = new Set<SVGGElement>();
    const bewege = (e: PointerEvent) => {
      const m = svg.getScreenCTM();
      if (!m) return;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      let best = 0, d = Infinity;
      for (const [x, y, f] of proben) { const e2 = (x - p.x) ** 2 + (y - p.y) ** 2; if (e2 < d) { d = e2; best = f; } }
      ziel = best; maus = true; bewegt = performance.now();
    };
    const weg2 = () => { maus = false; };
    t.addEventListener("pointermove", bewege);
    t.addEventListener("pointerleave", weg2);
    const takt = (jetzt: number) => {
      const dt = Math.min(64, jetzt - zuletzt); zuletzt = jetzt;
      // ruht die Maus länger, läuft das Licht wieder von selbst (auch falls das Verlassen nicht gemeldet wurde)
      if (maus && jetzt - bewegt > 2500) maus = false;
      if (maus) cur += (ziel - cur) * (1 - Math.pow(0.02, dt / 1000));
      else if (jetzt > halt) {
        const vor = cur;
        cur = (cur + dt / (UMLAUF * 1000)) % 1;
        if (cur < vor) besucht.clear();
        // erreicht das Licht eine Kachel, die es in dieser Runde noch nicht hatte, hält es kurz an
        const g = stationen.find((s) => !besucht.has(s) && Math.abs(Number(s.dataset.f) - cur) < NAH * 0.5);
        if (g) { besucht.add(g); halt = jetzt + HALT; }
      }
      licht.current = cur;
      for (const p of pulse) p.style.strokeDashoffset = String(-(cur - 0.035));
      const nah: string[] = [];
      for (const g of stationen) { const da = Math.abs(Number(g.dataset.f) - cur) < NAH; g.dataset.an = String(da); if (da) nah.push(g.dataset.name ?? ""); }
      steuere(nah, maus, jetzt);
      bild = requestAnimationFrame(takt);
    };
    bild = requestAnimationFrame(takt);
    return () => { cancelAnimationFrame(bild); t.removeEventListener("pointermove", bewege); t.removeEventListener("pointerleave", weg2); };
  }, [imBild, ruhig, handyAnsicht]);

  // Licht am Handy: auf dem Weg der Handy-Zeichnung, Lage als Anteil 0–1 (wie am Desktop über den Lichtstrich).
  // Folgt dem Finger wie am Desktop der Maus; ohne Berührung läuft es von selbst.
  const planHandy = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = planHandy.current, t = tafel.current;
    if (!imBild || ruhig || !handyAnsicht || !svg || !t) return;
    const weg = svg.querySelector<SVGPathElement>(".k1-weg");
    if (!weg) return;
    const pulse = [...svg.querySelectorAll<SVGPathElement>(".k1-puls")];
    const L = weg.getTotalLength();
    const proben = Array.from({ length: 401 }, (_, i) => { const q = weg.getPointAtLength((L * i) / 400); return [q.x, q.y, i / 400]; });
    const naechste = (x: number, y: number) => { let best = 0, d = Infinity; for (const [px, py, f] of proben) { const e2 = (px - x) ** 2 + (py - y) ** 2; if (e2 < d) { d = e2; best = f; } } return best; };
    const stationen = [...svg.querySelectorAll<SVGGElement>(".k1-station")].map((g) => ({ g, f: naechste(Number(g.dataset.cx), Number(g.dataset.cy)) }));
    const steuere = neueSteuerung();
    let cur = 0, ziel = 0, zuletzt = performance.now(), gehalten = -1e9, bild = 0, halt = 0;
    const besucht = new Set<(typeof stationen)[number]>();
    // Finger wie Maus: Beim Berühren und Wischen über der Tafel gleitet das Licht zur nächsten Stelle des Wegs.
    // touchmove läuft auch weiter, während die Seite scrollt.
    const hin = (x: number, y: number) => {
      const m = svg.getScreenCTM();
      if (!m) return;
      const p = new DOMPoint(x, y).matrixTransform(m.inverse());
      ziel = naechste(p.x, p.y); gehalten = performance.now();
    };
    const finger = (e: TouchEvent) => { const f = e.touches[0]; if (f) hin(f.clientX, f.clientY); };
    // dazu Zeiger-Ereignisse: Maus in der schmalen Ansicht am Rechner, Stift, und der Finger, bevor die Seite scrollt
    const zeiger = (e: PointerEvent) => hin(e.clientX, e.clientY);
    t.addEventListener("touchstart", finger, { passive: true });
    t.addEventListener("touchmove", finger, { passive: true });
    t.addEventListener("pointermove", zeiger);
    t.addEventListener("pointerdown", zeiger);
    const takt = (jetzt: number) => {
      const dt = Math.min(64, jetzt - zuletzt); zuletzt = jetzt;
      if (jetzt - gehalten > 2200 && jetzt > halt) {
        ziel += dt / (UMLAUF * 1000);
        if (ziel > 1) { ziel = 0; cur = 0; besucht.clear(); }
        const s = stationen.find((x) => !besucht.has(x) && Math.abs(x.f - ziel) < 0.025);
        if (s) { besucht.add(s); halt = jetzt + HALT; }
      }
      cur += (ziel - cur) * (1 - Math.pow(0.01, dt / 1000));
      for (const p of pulse) p.style.strokeDashoffset = String(-(cur - 0.035));
      const nah: string[] = [];
      for (const s of stationen) { const da = Math.abs(s.f - cur) < 0.05; s.g.dataset.an = String(da); if (da) nah.push(s.g.dataset.name ?? ""); }
      steuere(nah, jetzt - gehalten < 2200, jetzt);
      bild = requestAnimationFrame(takt);
    };
    bild = requestAnimationFrame(takt);
    return () => { cancelAnimationFrame(bild); t.removeEventListener("touchstart", finger); t.removeEventListener("touchmove", finger); t.removeEventListener("pointermove", zeiger); t.removeEventListener("pointerdown", zeiger); };
  }, [imBild, ruhig, handyAnsicht]);

  // Platzhalter des Suchfelds: Beispiele tippen sich, bleiben kurz stehen, verschwinden wieder
  useEffect(() => {
    if (!eingabe || !imBild || ruhig || stelle) return;
    let wort = 0, n = 0, hin = true, uhr = 0;
    const takt = () => {
      const w = BEISPIELE[wort];
      n += hin ? 1 : -1;
      setPlatz(n > 0 ? w.slice(0, n) : " ");
      if (hin && n === w.length) { hin = false; uhr = window.setTimeout(takt, 1700); return; }
      if (!hin && n === 0) { hin = true; wort = (wort + 1) % BEISPIELE.length; uhr = window.setTimeout(takt, 400); return; }
      uhr = window.setTimeout(takt, hin ? 75 : 30);
    };
    uhr = window.setTimeout(takt, 2200);
    return () => clearTimeout(uhr);
  }, [eingabe, imBild, ruhig, stelle]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const b = new IntersectionObserver(([e]) => setImBild(e.isIntersecting), { threshold: 0.1 });
    b.observe(el);
    return () => b.disconnect();
  }, []);

  return (
    <section ref={ref} className={kl("k1", !imBild && "k1-ruhe")}>
      <div className="mu-wrap">
        <header className="k1-leiste">
          <Link className="k1-logo" href="/" aria-label="Matchunt, Startseite"><MatchuntLogo size={38} />Matchunt</Link>
          <nav className="k1-nav" aria-label="Hauptnavigation">{nav.map(([n, h]) => <a key={n} href={h}>{n}</a>)}</nav>
          {/* Sprachmenü nur auf der Website (/w/…); in den Labor-Ansichten bleibt es weg */}
          <SprachMenue art="kopf" />
          <a className="mu-knopf k1-knopf-klein" href={knopfUrl}>{knopf}</a>
        </header>
      </div>

      <div ref={tafel} className="k1-tafel mu-feld">
        <Plan svgRef={plan} farbe={tintenFarbe} bilder={bilder} namen={namen} />
        <PlanHandy svgRef={planHandy} farbe={tintenFarbe} bilder={bilder} namen={namen} />
        <i className="k1-kerbe" aria-hidden="true" />
        <div className="k1-mitte">
          <h1 className="mu-h1 k1-h1">{h1}</h1>
          <p className="mu-text k1-satz">{satz}</p>
          {eingabe ? (
            <form className="k1-such" onSubmit={(e) => { e.preventDefault(); window.location.href = mitHerkunft(mitStelle(knopfUrl, stelle)); }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
              <input type="text" value={stelle} onChange={(e) => setStelle(e.target.value)} placeholder={platz} maxLength={40} aria-label="Welche Stelle wollen Sie besetzen?" autoComplete="off" enterKeyHint="go" />
              <button type="submit" className="k1-such-knopf">{knopf}</button>
            </form>
          ) : <a className="mu-knopf k1-knopf" href={knopfUrl}>{knopf}</a>}
          {/* Idee 3 (27.11.2026, Marko): unter dem Suchfeld fünf Gesichter und ein Satz – wer gleich sucht. */}
          {eingabe && (
            <div className="k1-koepfe">
              <span className="k1-koepfe-reihe" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((i) => { const f = hhFoto(i); return f ? <img key={i} src={f} alt="" loading="eager" /> : <i key={i} />; })}
              </span>
              <span className="k1-koepfe-satz">Hunderte geprüfte Headhunter warten auf Ihre Stelle</span>
            </div>
          )}
        </div>
      </div>

      {fenster ? fenster(imBild, ruhig) : <Fenster aktiv={imBild} ruhig={ruhig} stelle={stelle} />}
      <p className="mu-klein k1-note">Beispiel, keine echten Daten.</p>
    </section>
  );
}
