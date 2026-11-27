// Sektion 12.1 „Durcheinander in der Klammer“ (24.11.2026): neue Sektion aus Sektion 11.1 (Problem) und Sektion 12
// (blaue Tafel). Rahmen, Klammern, Ablauf und Knopf sind wie in 12; zwischen den Klammern liegen aber statt der sechs
// Pillen die vier schiefen Karten aus 11.1 mit ihren kleinen bewegten Bildern (Kalender, Stapel, E-Mails, Verträge).
// Beim Scrollen springen sie nacheinander auf. In der Mitte des Wegs kommt der Umschwung aus 11.1: Die Karten richten
// sich gerade, bekommen Nummer und Zeichen und heißen jetzt wie die vier Schritte; oben wird aus „Eine offene Stelle kann viel Arbeit machen.“
// „… so einfach sein.“, unten aus „Anzeige, Lebensläufe, Termine, Verträge.“ „Ihnen bleibt eine Aufgabe: die Stelle
// beschreiben.“ (Texte von Marko, 24.11.2026). Danach ziehen sie zur Mitte zusammen, und
// die Klammern – hier groß, über die ganze Höhe der Karten – schließen sich um unser Logo. Der Knopf ist der markierte Teil des Satzes unten: „die Stelle beschreiben.“
// 11.1 und 12 bleiben unverändert; ihre Stile werden nur mitbenutzt.
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { TeMarke } from "@/startseite/nachbau3/te/Marke";
import type { Art } from "@/startseite/nachbau3/te/tinte";
import { Zeichen, type ZeichenArt } from "../s06-zeichen/Zeichen";
import { START_URL } from "@/startseite/nachbau/basis";
import { MatchuntLogo } from "@/startseite/seite/Logo";
import "../s12-nebenarbeit/s12.css";
import "../s11-1-problem/s111.css";
import "./s121.css";

// Die vier Karten aus 11.1 (Zustand „Bisher“), mit derselben Schieflage
const KARTEN: { text: string; neu: string; zeichen: ZeichenArt; bild: ReactNode; schief: number }[] = [
  { text: "Anzeige seit Wochen online", neu: "Stelle beschreiben", zeichen: "stelle", schief: 2, bild: <div className="s111-kal"><u /><b><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span></b><small>Wochen</small></div> },
  { text: "Lebensläufe ohne Gespräch", neu: "Headhunter suchen", zeichen: "suche", schief: -3, bild: <div className="s111-stapel">{[0, 1, 2, 3, 4, 5].map((i) => <i key={i} style={{ "--i": i } as CSSProperties} />)}</div> },
  { text: "Termine per E-Mail", neu: "Kandidaten kennenlernen", zeichen: "kennen", schief: -2, bild: <div className="s111-post">{["Re: Termin", "Re: Re: Termin", "Re: Re: Re: Termin"].map((t, i) => <span key={t} style={{ "--i": i } as CSSProperties}><u />{t}</span>)}</div> },
  { text: "Je Vermittler ein Vertrag", neu: "Einstellen", zeichen: "einstellen", schief: 4, bild: <div className="s111-faecher">{[0, 1, 2, 3].map((i) => <i key={i} style={{ "--i": i } as CSSProperties}><u /><u /></i>)}</div> },
];
// Tinte wie in 11.1: Nach dem Umschwung zeichnen sich die vier Zeichen, dann werden alle vier zu Tinte und spielen
// die kleine Geschichte ihres Schritts, dann wieder die Zeichen – in Schleife. Fährt man über eine Karte, zeigt sie
// Tinte, solange die Maus darauf ist (am Handy: antippen, einige Sekunden).
const TINTE: Art[] = ["stelle", "suche", "gespraech", "angebot"];
const TIPP_DAUER = 7000, ZEICHNEN_FERTIG = 1900, VORFUEHR_DAUER = 7700, ZEICHEN_PAUSE = 4200;
// Ablauf über den Scroll-Weg (0–1), seit 25.11.2026 nach vorn gezogen: Das Logo steht schon bei 0,66 da und die
// Sektion bleibt danach noch gut ein Viertel des Wegs stehen, damit man Drehung und Namen sieht, bevor es weitergeht.
const HALT = 2200; // so lange bleibt die Seite beim Logo stehen (ms)
const SCHRAEG = 1; // 26.11.: Marko will das Durcheinander wie zuvor (schräg) · 1 = Karten liegen anfangs schräg (unscharf auf normalen Bildschirmen), 0 = gerade
const UMSCHWUNG = 0.36; // an dieser Stelle des Wegs schlagen die Karten um
const KLEIN = 0.3; // Größe der Klammern am Anfang und am Ende, bezogen auf ihre volle Größe

const klemme = (x: number) => Math.max(0, Math.min(1, x));
const stueck = (x: number, von: number, bis: number) => klemme((x - von) / (bis - von));
const weich = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function KlammerKarten() {
  const ref = useRef<HTMLElement>(null);
  const block = useRef<HTMLDivElement>(null);
  const auf = useRef<HTMLSpanElement>(null);
  const zu = useRef<HTMLSpanElement>(null);
  const ende = useRef<HTMLDivElement>(null);
  const [neu, setNeu] = useState(false);
  const [logoDa, setLogoDa] = useState(false); // das Zeichen steht zwischen den Klammern: Stoß von unten, Münzdrehung, Name rollt aus
  const [schluss, setSchluss] = useState(false); // kurz vor dem Ende: der Balken unten kommt
  const [tinte, setTinte] = useState(-1);
  const [alle, setAlle] = useState(false);
  const [farbe, setFarbe] = useState("#0071e3");
  const [zeichenNeu, setZeichenNeu] = useState([0, 0, 0, 0]);
  const uhr = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (uhr.current) clearTimeout(uhr.current); }, []);
  const neuZeichnen = (i: number) => setZeichenNeu((z) => z.map((n, j) => (j === i ? n + 1 : n)));
  const raus = (i: number) => { setTinte((a) => (a === i ? -1 : a)); neuZeichnen(i); };
  const rein = (i: number, e: PointerEvent<HTMLLIElement>) => {
    if (!neu || tinte === i || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ak = getComputedStyle(e.currentTarget).getPropertyValue("--mu-ak").trim();
    if (ak) setFarbe(ak);
    if (tinte !== -1 && !alle) neuZeichnen(tinte);
    setTinte(i);
    if (uhr.current) clearTimeout(uhr.current);
    if (e.pointerType !== "mouse") uhr.current = setTimeout(() => raus(i), TIPP_DAUER);
  };
  // Während der Name neben dem Logo ausrollt, wird der Block breiter: die Klammern sollen mitgehen. Ihre Lage
  // wird sonst nur beim Scrollen berechnet, deshalb hier für die Dauer der Bewegung in jedem Bild neu.
  useEffect(() => {
    let bild = 0;
    const bis = performance.now() + 3600;
    const lauf = () => { window.dispatchEvent(new Event("resize")); if (performance.now() < bis) bild = requestAnimationFrame(lauf); };
    bild = requestAnimationFrame(lauf);
    return () => cancelAnimationFrame(bild);
  }, [logoDa]);
  // Kurzes Anhalten (25.11.2026, Markos Wunsch): Kommt man beim Herunterscrollen zum ersten Mal beim Logo an, bleibt
  // die Seite gut zwei Sekunden stehen, bis Stoß, Münzdrehung und Name durch sind. Danach geht es normal weiter.
  // Nur einmal je Seitenaufruf, nur abwärts, nicht bei „Bewegung reduzieren“.
  const gehalten = useRef(false);
  const runter = useRef(true);
  useEffect(() => {
    let y0 = window.scrollY;
    const merk = () => { const y = window.scrollY; if (y !== y0) runter.current = y > y0; y0 = y; };
    window.addEventListener("scroll", merk, { passive: true });
    return () => window.removeEventListener("scroll", merk);
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!logoDa || gehalten.current || !runter.current || !el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const q = -r.top / Math.max(1, r.height - window.innerHeight);
    if (q < 0.6 || q > 0.85) return; // nur wenn die Sektion gerade wirklich im Bild klebt
    gehalten.current = true;
    const y = window.scrollY, bis = performance.now() + HALT;
    const stopp = (e: Event) => e.preventDefault();
    const taste = (e: KeyboardEvent) => { if ([" ", "PageDown", "PageUp", "ArrowDown", "ArrowUp", "End", "Home"].includes(e.key)) e.preventDefault(); };
    let bild = 0;
    // festhalten: sofort bei jedem Scroll-Ereignis (auch Scrollbalken), dazu je Bild als Sicherung
    const fest = () => { if (performance.now() < bis && Math.abs(window.scrollY - y) > 1) window.scrollTo({ top: y, behavior: "instant" }); };
    const frei = () => { window.removeEventListener("wheel", stopp); window.removeEventListener("touchmove", stopp); window.removeEventListener("keydown", taste); window.removeEventListener("scroll", fest); cancelAnimationFrame(bild); clearTimeout(uhrHalt); };
    const halte = () => { if (performance.now() >= bis) { frei(); return; } fest(); bild = requestAnimationFrame(halte); };
    const uhrHalt = setTimeout(frei, HALT + 50);
    window.addEventListener("scroll", fest);
    window.addEventListener("wheel", stopp, { passive: false });
    window.addEventListener("touchmove", stopp, { passive: false });
    window.addEventListener("keydown", taste);
    bild = requestAnimationFrame(halte);
    return frei;
  }, [logoDa]);
  // Vorführung in Schleife, solange „Mit Matchunt“ gilt
  useEffect(() => {
    if (!neu || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ak = block.current ? getComputedStyle(block.current.querySelector(".s121-karten") ?? block.current).getPropertyValue("--mu-ak").trim() : "";
    let schleife: ReturnType<typeof setTimeout>;
    const tinteAn = () => { if (ak) setFarbe(ak); setAlle(true); schleife = setTimeout(zeichenAn, VORFUEHR_DAUER); };
    const zeichenAn = () => { setAlle(false); setZeichenNeu((z) => z.map((n) => n + 1)); schleife = setTimeout(tinteAn, ZEICHEN_PAUSE); };
    schleife = setTimeout(tinteAn, ZEICHNEN_FERTIG);
    return () => { clearTimeout(schleife); setAlle(false); setTinte(-1); };
  }, [neu]);

  useEffect(() => {
    const el = ref.current, bl = block.current, e = ende.current;
    if (!el || !bl || !e) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pillen = Array.from(bl.querySelectorAll<HTMLElement>(".s121-pk"));
    let bild = 0;
    const mess = () => {
      bild = 0;
      const ruhig = mq.matches;
      el.classList.toggle("s12-still", ruhig);
      if (ruhig) { setNeu(true); setSchluss(true); }
      if (ruhig) {
        for (const x of [...pillen, e, auf.current, zu.current]) x?.removeAttribute("style");
        return;
      }
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const weg = r.height - vh;
      const q = weg <= 0 ? 0 : klemme(-r.top / weg);
      el.style.setProperty("--rein", weich(klemme(1 - r.top / (vh * 0.9))).toFixed(4));
      el.style.setProperty("--a", weich(stueck(q, 0, 0.22)).toFixed(4));

      // Umschwung: ab hier gilt „Mit Matchunt“ (zurück erst etwas früher, damit es an der Grenze nicht flackert)
      setNeu((war) => (war ? q > UMSCHWUNG - 0.03 : q >= UMSCHWUNG));
      setSchluss(q >= 0.57);
      setLogoDa(q >= 0.66);
      const gerade = weich(stueck(q, UMSCHWUNG - 0.01, UMSCHWUNG + 0.05));

      // Karten springen nacheinander auf und treten später nacheinander zurück.
      const b = stueck(q, 0.1, 0.3);
      const n = pillen.length;
      pillen.forEach((p, i) => {
        const s = stueck(b, (i / n) * 0.82, (i / n) * 0.82 + 0.18);
        const rein = 1 - Math.pow(1 - s, 3);
        const raus = weich(stueck(q, 0.55 + i * 0.01, 0.63 + i * 0.01));
        // beim Zurücktreten zieht jede Karte zur Mitte des Blocks und richtet sich gerade
        const dx = (bl.offsetWidth / 2 - (p.offsetLeft + p.offsetWidth / 2)) * raus;
        const dy = (bl.offsetHeight / 2 - (p.offsetTop + p.offsetHeight / 2)) * raus;
        // 26.11.: Karten liegen gerade (SCHRAEG = 0). Schräg gestellte Karten zeichnet der Browser weich, Schrift und Linien
        // wirkten unscharf. In Ruhe (kein Weg, volle Größe) ganz ohne transform, damit nichts zwischen Bildpunkten liegt.
        const dreh = KARTEN[i].schief * SCHRAEG * (1 - gerade);
        const gr = (0.35 + 0.65 * rein) * (1 - 0.55 * raus);
        p.style.transform = raus === 0 && dreh === 0 && gr > 0.999 ? "none" : `translate(${Math.round(dx)}px, ${Math.round(dy)}px) rotate(${dreh.toFixed(2)}deg) scale(${gr.toFixed(3)})`;
        p.style.opacity = (Math.min(1, s * 2.4) * (1 - raus)).toFixed(3);
      });

      // Klammern: erst eng in der Mitte, dann an den Ecken des Blocks, am Ende eng um die eine Zeile.
      const offen = weich(stueck(q, 0.08, 0.24));
      const sichtbar = stueck(q, 0.07, 0.13).toFixed(3);
      const schluss = weich(stueck(q, 0.58, 0.69));
      const bw = bl.offsetWidth;
      const ew = e.offsetWidth;
      // die Klammern sind groß (so hoch wie die Karten) und stehen mittig; am Anfang und am Ende schrumpfen sie
      const gross = (KLEIN + (1 - KLEIN) * offen) * (1 - schluss) + KLEIN * schluss;
      for (const [k, seite] of [[auf.current, -1], [zu.current, 1]] as const) {
        if (!k) continue;
        const kw = k.offsetWidth;
        const x0 = seite * kw * KLEIN * 0.7, x1 = seite * (bw / 2 + kw * 0.42), x2 = seite * (ew / 2 + kw * KLEIN * 0.8);
        const x = (x0 + (x1 - x0) * offen) * (1 - schluss) + x2 * schluss;
        k.style.opacity = sichtbar;
        k.style.transform = `translate(calc(-50% + ${x.toFixed(1)}px), -50%) scale(${gross.toFixed(3)})`;
      }

      // voll da, bevor die Münzdrehung startet (q 0,66) – sonst hält der Scroll-Halt das Zeichen halb blass fest
      const da = stueck(q, 0.615, 0.655);
      const fed = 1 - Math.pow(1 - da, 3);
      e.style.opacity = da.toFixed(3);
      e.style.transform = `translate(-50%, -50%) scale(${(0.8 + 0.2 * fed).toFixed(3)})`;
      e.style.visibility = da > 0.01 ? "visible" : "hidden";
    };
    const an = () => { if (!bild) bild = requestAnimationFrame(mess); };
    mess();
    window.addEventListener("scroll", an, { passive: true });
    window.addEventListener("resize", an);
    mq.addEventListener("change", an);
    const spaet = window.setTimeout(mess, 400);
    return () => {
      window.removeEventListener("scroll", an);
      window.removeEventListener("resize", an);
      mq.removeEventListener("change", an);
      window.clearTimeout(spaet);
      cancelAnimationFrame(bild);
    };
  }, []);

  return (
    <section className="s12 s121" ref={ref} data-neu={neu} data-schluss={schluss} data-logo={logoDa}>
      <div className="s12-klebt">
        <div className="s12-tafel mu-feld">
          <div className="s12-rahmen" aria-hidden="true">
            <i className="s12-l s12-l-o" /><i className="s12-l s12-l-u" /><i className="s12-l s12-l-l" /><i className="s12-l s12-l-r" />
            <i className="s12-p s12-p-ol" /><i className="s12-p s12-p-or" /><i className="s12-p s12-p-ul" /><i className="s12-p s12-p-ur" />
          </div>
          <div className="s12-inhalt">
            {/* Der Satzanfang bleibt stehen, nur das Ende schlägt mit den Karten um */}
            <h2 className="mu-h2 s12-h2 s121-h2">
              <span className="s121-leise">Eine offene Stelle kann</span>{" "}
              <span className="s121-kipp">
                <span className="s121-t0" aria-hidden={neu}>viel Arbeit machen.</span>
                <span className="s121-t1" aria-hidden={!neu}>so einfach sein.</span>
              </span>
            </h2>
            <div className="s12-block" ref={block}>
              <span className="s12-klammer" ref={auf} aria-hidden="true">(</span>
              <ul className="s111 s121-karten" data-neu={neu} data-lauf="true" aria-label={neu ? "Die vier Schritte mit Matchunt" : "Was eine offene Stelle heute bedeutet"}>
                {KARTEN.map((k, i) => (
                  <li className="s121-pk" key={k.text} data-tinte={neu && (alle || tinte === i)} onPointerMove={(e) => rein(i, e)} onPointerDown={(e) => rein(i, e)} onPointerLeave={(e) => { if (e.pointerType === "mouse" && tinte === i) raus(i); }}>
                    <div className="s111-karte">
                      <div className="s111-bild" aria-hidden="true">
                        <div className="s111-b0">{k.bild}</div>
                        <div className="s111-b1"><Zeichen art={k.zeichen} an={neu} verzug={200 + i * 220} neu={zeichenNeu[i]} /></div>
                        {neu && (alle || tinte === i) && <span className="s111-tinte"><TeMarke art={TINTE[i]} className="s111-leinwand" spanne={3.4} hoch={2.1} farbe={farbe} /></span>}
                      </div>
                      <div className="s111-fuss">
                        <b aria-hidden="true">{i + 1}</b>
                        <div className="s111-worte"><p className="s111-w0" aria-hidden={neu}>{k.text}</p><p className="s111-w1" aria-hidden={!neu}>{k.neu}</p></div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <span className="s12-klammer" ref={zu} aria-hidden="true">)</span>
              {/* Am Ende steht zwischen den Klammern unser Logo; der Knopf ist der markierte Teil des Satzes unten (25.11.2026) */}
              <div className="s12-ende s121-logo" ref={ende} aria-hidden="true"><span className="s121-zeichen"><MatchuntLogo size={44} /></span><b>Matchunt</b></div>
            </div>
            <p className="s12-satz s121-kipp">
              <span className="s121-t0" aria-hidden={neu}>Anzeige, Lebensläufe, Termine, Verträge.</span>
              <span className="s121-t1" aria-hidden={!neu}>Ihnen bleibt eine Aufgabe: <a className="s121-marke" href={START_URL} tabIndex={neu ? 0 : -1}>
                  die Stelle beschreiben.
                  {/* Zeiger, der auf den Knopf kommt und klickt: zeigt, dass man hier klicken kann */}
                  <span className="s121-zeiger" aria-hidden="true">
                    <i />
                    <svg viewBox="0 0 24 24" width="26" height="26"><path d="M5 3l14 8-6 1.6L10.5 19z" /></svg>
                  </span>
                </a></span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
