// Sektion 18 „Weg“ (Startseite): der Weg einer Besetzung als eine gezeichnete, geschwungene Linie mit vier Knoten.
// Die Linie färbt sich beim Scrollen von oben nach unten ein; erreicht sie einen Knoten, erscheint dessen Station
// mit einem kleinen Bild aus dem Produkt. Am Handy läuft die Linie links, die Stationen stehen rechts daneben.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { START_URL } from "@/startseite/nachbau/basis";
import { useTx } from "@/startseite/website/uebersetzen";
import "./s18.css";

function BildAnzeige() {
  const tx = useTx();
  return (
    <div className="s18-b s18-b-anzeige">
      <div className="s18-blatt">
        <span className="s18-marke">{tx("Ihre Anzeige")}</span>
        <b>{tx("Leitung Konstruktion (m/w/d)")}</b>
        <i /><i /><i /><i />
      </div>
    </div>
  );
}

const PUNKTE: [number, number][] = [[40, 34], [112, 14], [204, 30], [280, 16], [70, 132], [160, 142], [252, 128]];
function BildHeadhunter() {
  const tx = useTx();
  return (
    <div className="s18-b s18-b-hh">
      <svg viewBox="0 0 320 156" fill="none">
        {PUNKTE.map(([x, y], i) => <path key={i} className="s18-faden" d={`M${x} ${y}L160 78`} />)}
        {PUNKTE.map(([x, y], i) => <circle key={i} className="s18-hh" style={{ ["--n" as string]: i }} cx={x} cy={y} r="9" />)}
      </svg>
      <span className="s18-stelle">{tx("Leitung Konstruktion")}</span>
    </div>
  );
}

function BildVorstellung() {
  const tx = useTx();
  return (
    <div className="s18-b s18-b-vor">
      <div className="s18-vor-kopf">
        <div className="s18-kreis">{tx("K{n}", { n: 1 })}</div>
        <div className="s18-wer"><b>{tx("Kandidat {n}", { n: 1 })}</b><span className="mu-leise">{tx("für: {stelle}", { stelle: tx("Leitung Konstruktion") })}</span></div>
      </div>
      <span className="s18-stand">{tx("Neu · heute")}</span>
      <span className="s18-knopf">{tx("Interview anfragen")}</span>
    </div>
  );
}

function BildUnterschrift() {
  const tx = useTx();
  return (
    <div className="s18-b s18-b-sign">
      <div className="s18-sign-kopf"><span className="s18-marke">{tx("Arbeitsvertrag")}</span><span className="s18-stand">{tx("Vertrag unterschrieben")}</span></div>
      <svg viewBox="0 0 180 44" fill="none"><path pathLength={100} d="M6 30c10-18 18-22 20-12s-6 18-2 16 12-22 18-20 0 18 6 16 10-14 16-12 2 10 8 8 12-8 22-6 20 4 40-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
    </div>
  );
}

const STATIONEN: { name: string; satz: string; bild: ReactNode }[] = [
  { name: "Stelle beschreiben", satz: "Sie fügen Ihre Anzeige ein, das genügt für den Anfang.", bild: <BildAnzeige /> },
  { name: "Headhunter suchen", satz: "Geprüfte Headhunter suchen für Ihre Stelle, alle unter einem Rahmenvertrag.", bild: <BildHeadhunter /> },
  { name: "Kandidaten kennenlernen", satz: "Sie sehen jede Vorstellung und fragen ein Interview an.", bild: <BildVorstellung /> },
  { name: "Einstellen", satz: "Sie machen das Angebot, und erst mit der Unterschrift fällt das Honorar an.", bild: <BildUnterschrift /> },
];

type Punkt = { x: number; y: number };
/** Geschwungene Linie durch alle Punkte: zwischen zwei Punkten ein S-Bogen mit senkrechtem Ein- und Auslauf. */
function bahn(p: Punkt[]) {
  let d = `M${p[0].x.toFixed(1)} ${p[0].y.toFixed(1)}`;
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i], m = ((a.y + b.y) / 2).toFixed(1);
    d += `C${a.x.toFixed(1)} ${m} ${b.x.toFixed(1)} ${m} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }
  return d;
}

// bilder/saetze: Fassung 18.1 gibt eigene, bewegte Bilder und einzelne Sätze mit; ohne Angabe bleibt alles wie bisher.
// titel/kopf/knopf/klasse: Fassung 18.3 setzt je Station einen Satzteil als Überschrift (bekommt mit, ob die Station da ist).
// saetze und knopf kommen deutsch herein und werden hier übersetzt (tx); kopf und titel übersetzen sich selbst.
type WegProps = { bilder?: ReactNode[]; saetze?: (string | undefined)[]; titel?: ((da: boolean) => ReactNode)[]; kopf?: ReactNode; knopf?: string; klasse?: string; spitze?: number; stufen?: boolean; vonOben?: boolean };
// vonOben: die Linie kommt schon an der Oberkante der Sektion heraus (aus der Sektion davor) und läuft links neben der
// Überschrift gerade herunter, dann zum ersten Knoten.
// stufen: die Linie läuft nicht stufenlos mit, sondern schießt von Knoten zu Knoten und bleibt dort stehen.
// spitze: auf welcher Bildschirmhöhe (0–1) die Spitze der farbigen Linie mitläuft; ohne Angabe 0,6 wie bisher.
export function Weg({ bilder, saetze, titel, kopf, knopf, klasse, spitze = 0.6, stufen = false, vonOben = false }: WegProps = {}) {
  const tx = useTx();
  const buehne = useRef<HTMLDivElement>(null);
  const spur = useRef<SVGPathElement>(null);
  const ende = useRef<HTMLDivElement>(null);
  const quelle = useRef<SVGPathElement>(null);
  const [start, setStart] = useState<Punkt | null>(null);
  const [knoten, setKnoten] = useState<Punkt[]>([]);
  const [d, setD] = useState("");
  const [aktiv, setAktiv] = useState(-1);
  const [bereit, setBereit] = useState(false);

  // Knoten aus der Lage der Stationen messen (Desktop: abwechselnd links und rechts der Mitte; Handy: links).
  useEffect(() => {
    const st = buehne.current;
    if (!st) return;
    const mess = () => {
      const w = st.clientWidth, mobil = window.matchMedia("(max-width: 899px)").matches;
      const aus = Math.min(110, w * 0.1);
      const k = Array.from(st.querySelectorAll<HTMLElement>(".s18-station")).map((el, i) => {
        const oben = el.offsetTop + (el.offsetParent === st ? 0 : (el.offsetParent as HTMLElement).offsetTop); // Lage in der Bühne
        return mobil ? { x: i % 2 ? 30 : 16, y: oben + 16 } : { x: w / 2 + (i % 2 ? aus : -aus), y: oben + el.offsetHeight / 2 };
      });
      const unten = ende.current ? ende.current.offsetTop - (mobil ? 4 : 14) : st.clientHeight;
      setKnoten(k);
      const sr = st.getBoundingClientRect();
      const los: Punkt = { x: mobil ? 16 : w / 2, y: vonOben ? (st.closest("section")?.getBoundingClientRect().top ?? sr.top) - sr.top : 0 };
      const vorbei: Punkt[] = [];
      const h2 = vonOben && !mobil ? st.parentElement?.querySelector(".s18-h2") : null;
      if (h2) {
        const b = document.createRange();
        b.selectNodeContents(h2);
        const hr = b.getBoundingClientRect();
        // gerade neben der Überschrift herunter, erst darunter schwingt die Linie zum ersten Knoten
        los.x = Math.max(34, hr.left - sr.left - 48);
        vorbei.push({ x: los.x, y: hr.bottom - sr.top });
      }
      setStart(vonOben ? los : null);
      setD(bahn([los, ...vorbei, ...k, { x: mobil ? 16 : w / 2, y: unten }]));
      setBereit(true);
    };
    mess();
    const b = new ResizeObserver(mess);
    b.observe(st);
    document.fonts?.ready.then(mess);
    return () => b.disconnect();
  }, [vonOben]);

  // Die Spitze der farbigen Linie folgt der Bildschirmhöhe (weich nachgezogen).
  useEffect(() => {
    const st = buehne.current, pf = spur.current;
    if (!st || !pf || !d || !knoten.length) return;
    const laenge = pf.getTotalLength();
    pf.style.strokeDasharray = `${laenge} ${laenge}`;
    const N = 400;
    const tafel: number[] = [];
    for (let i = 0; i <= N; i++) tafel.push(pf.getPointAtLength((laenge * i) / N).y);
    const zuLaenge = (y: number) => {
      if (y <= tafel[0]) return 0;
      for (let i = 1; i <= N; i++) if (tafel[i] >= y) return (laenge * (i - (tafel[i] - y) / Math.max(0.001, tafel[i] - tafel[i - 1]))) / N;
      return laenge;
    };
    const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let ist = ruhig ? laenge : Math.max(0, laenge - parseFloat(pf.style.strokeDashoffset || String(laenge)));
    if (!isFinite(ist) || ist > laenge) ist = 0;
    let soll = 0, bild = 0, letzter = -2;
    const zeichne = () => {
      bild = 0;
      ist += (soll - ist) * (ruhig ? 1 : stufen ? 0.07 : 0.14);
      if (Math.abs(soll - ist) < 0.5) ist = soll;
      pf.style.strokeDashoffset = String(laenge - ist);
      if (quelle.current) quelle.current.style.opacity = ist > 1 ? "1" : "0";
      const y = ist <= 0 ? -1 : pf.getPointAtLength(ist).y;
      let n = -1;
      knoten.forEach((k, i) => { if (y >= k.y - 4) n = i; });
      if (n !== letzter) { letzter = n; setAktiv(n); }
      if (ist !== soll) bild = requestAnimationFrame(zeichne);
    };
    const mess = () => {
      const r = st.getBoundingClientRect();
      // steht das Ende der Bühne schon im Bild, läuft die Linie ganz durch
      const y = window.innerHeight * spitze - r.top;
      if (ruhig || r.bottom <= window.innerHeight) soll = laenge;
      else if (stufen) {
        // zum nächsten Knoten geht es, sobald die Spitze die Hälfte des Stücks davor hinter sich hat (beim ersten: drei Viertel)
        // vonOben: bis kurz vor den ersten Knoten läuft die Linie stufenlos mit (sie kommt sichtbar aus der Sektion davor)
        let z = vonOben ? Math.min(zuLaenge(y), zuLaenge(knoten[0].y)) : 0;
        knoten.forEach((k, i) => { if (y >= (i ? (knoten[i - 1].y + k.y) / 2 : k.y * 0.75)) z = zuLaenge(k.y); });
        if (y >= (knoten[knoten.length - 1].y + tafel[N]) / 2) z = laenge;
        soll = z;
      } else soll = zuLaenge(y);
      if (!bild) bild = requestAnimationFrame(zeichne);
    };
    mess();
    window.addEventListener("scroll", mess, { passive: true });
    window.addEventListener("resize", mess);
    return () => { window.removeEventListener("scroll", mess); window.removeEventListener("resize", mess); cancelAnimationFrame(bild); };
  }, [d, knoten, spitze, stufen, vonOben]);

  return (
    <section className={klasse ? `s18 ${klasse}` : "s18"} data-bereit={bereit}>
      <div className="mu-wrap">
        {kopf ?? <h2 className="mu-h2 s18-h2">{tx("Ein Weg von der Stelle")} <span className="mu-leise">{tx("bis zur Unterschrift.")}</span></h2>}

        <div className="s18-buehne" ref={buehne}>
          <svg className="s18-linie" aria-hidden="true">
            <path className="s18-linie-grund" d={d || undefined} />
            <path className="s18-linie-farbe" d={d || undefined} ref={spur} />
            {start && <path className="s18-quelle" ref={quelle} d={`M${start.x - 30} ${start.y}C${start.x - 9} ${start.y} ${start.x - 2} ${start.y + 10} ${start.x - 2} ${start.y + 30}L${start.x + 2} ${start.y + 30}C${start.x + 2} ${start.y + 10} ${start.x + 9} ${start.y} ${start.x + 30} ${start.y}Z`} />}
          </svg>
          <ol className="s18-stationen">
            {STATIONEN.map((s, i) => (
              <li key={s.name} className="s18-station" data-da={i <= aktiv} data-seite={i % 2 ? "rechts" : "links"}>
                <div className="s18-text">
                  <h3 className="mu-h3">{titel?.[i] ? titel[i](i <= aktiv) : tx(s.name)}</h3>
                  {(saetze?.[i] ?? s.satz) && <p>{tx(saetze?.[i] ?? s.satz)}</p>}
                </div>
                <div className="s18-bild mu-karte" aria-hidden="true">{bilder?.[i] ?? s.bild}</div>
              </li>
            ))}
          </ol>
          <div className="s18-knoten" aria-hidden="true">
            {knoten.map((k, i) => (
              <span key={i} data-an={i <= aktiv} data-jetzt={i === aktiv} style={{ left: k.x, top: k.y }}>{i + 1}</span>
            ))}
          </div>
          <div className="s18-ende" ref={ende}>
            <a className="mu-knopf" href={START_URL}>{tx(knopf ?? "Stelle beschreiben")}</a>
          </div>
        </div>
      </div>
    </section>
  );
}
