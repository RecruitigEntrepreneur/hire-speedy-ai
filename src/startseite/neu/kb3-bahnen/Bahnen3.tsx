// Fassung 63.3 „Bahnen mit Bilderreihe“ (26.11.2026, Markos Wunsch): wie 63.1, dazu unter dem Text eine Reihe
// Headhunter-Bilder mit „Hunderte geprüfte Headhunter“ (Aussage von Marko, vor dem Livegang belegen) und mehr
// Headhunter auf den Bahnen: 20 statt 8 Plätze, Fotos und Personen-Zeichen gemischt, auch auf der vierten Bahn.
// Fotos sind die Beispiel-Gesichter aus matchunt/fotos.ts (keine echten Headhunter). 63.1 bleibt unverändert.
// Aus 63.1:
// Sektion 63 „Bahnen“ (Startseite, Headhunter suchen): angeheftete Bühne. Sie beginnt im Seiten-Grund; beim
// Scrollen wächst das blaue Feld aus der Mitte („Ihre Stelle“), bis es den Bildschirm füllt. Darin das große
// Netz aus Kreisbahnen, auf denen Headhunter ruhig kreisen; reihum leuchtet einer auf und schickt einen Punkt
// zur Mitte (eine Vorstellung). Das Bild liegt zweimal übereinander (Grund und Blau), das blaue ist ausgeschnitten.
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { TeMarke } from "@/startseite/nachbau3/te/Marke";
import { Zeichen } from "@/startseite/matchunt/s06-zeichen/Zeichen";
import "@/startseite/matchunt/s63-bahnen/s63.css";
import { hhFoto } from "@/startseite/matchunt/fotos";
import "@/startseite/matchunt/s63-1-bahnen/s631.css";
import "./kb3.css";

// je Knoten: Winkel und Foto-Nummer (null = Personen-Zeichen). Jedes der acht Beispiel-Fotos kommt nur einmal vor.
const BAHNEN: { r: number; dauer: number; klein?: boolean; knoten: [number, number | null][] }[] = [
  { r: 150, dauer: 80, knoten: [[300, 0], [110, 1], [200, null]] },
  { r: 250, dauer: 110, knoten: [[20, 2], [95, null], [150, 3], [215, null], [290, 4]] },
  { r: 360, dauer: 140, knoten: [[10, null], [62, 5], [130, null], [200, 6], [260, null], [318, 7]] },
  { r: 490, dauer: 170, klein: true, knoten: [[40, null], [100, null], [160, null], [220, null], [280, null], [340, null]] },
  { r: 640, dauer: 0, knoten: [] },
];
// Reihenfolge des Aufleuchtens: [Bahn, Knoten]
const FOLGE: [number, number][] = [[1, 0], [0, 1], [2, 3], [1, 2], [0, 0], [2, 1], [1, 4], [2, 5], [3, 2], [1, 1], [2, 0], [0, 2]];
const TAKT = 2600;

function Person() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="9" r="3.6" />
      <path d="M4.8 20.5c.7-4.2 3.5-6.300 7.200-6.300s6.500 2.100 7.200 6.300z" />
    </svg>
  );
}

// Lupe hinter der Überschrift (25.11.2026): das Zeichen für Schritt 2 „Headhunter suchen“, wie im Satz der Schlange.
// Im Wechsel wird es zu Tinte – die Geschichte „suche“: die Stelle in der Mitte, fünf Tropfen im Kreis darum, die
// zusammenkommen – und zeichnet sich danach neu. Fährt man darüber, zeigt es Tinte, solange die Maus darauf ist
// (am Handy: antippen). hell = die Lage auf dem blauen Feld: dort sind Zeichen und Tinte weiß.
// Beide Lagen (Grund und Blau) liegen deckungsgleich übereinander. Damit an der Kante des blauen Felds links und rechts
// dasselbe Bild steht, kommt der Zustand von außen (ein Takt für beide), und die Tinte läuft in beiden Lagen immer
// mit – auch in der, die gerade verdeckt ist. Dem Mauszeiger weichen die Tropfen aus, in beiden Lagen gleich.
const ZEICHEN_ZEIT = 4200, TINTE_ZEIT = 7000, TIPP_DAUER = 7000;
type LupeStand = { zeigt: boolean; neu: number; rein: (e: PointerEvent<HTMLSpanElement>) => void; raus: () => void };
function LupeTinte({ lauf, hell, stand }: { lauf: boolean; hell: boolean; stand: LupeStand }) {
  const [farbe, setFarbe] = useState(hell ? "#ffffff" : "#0071e3");
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const f = getComputedStyle(el).getPropertyValue(hell ? "--mu-feld-tx" : "--mu-ak").trim();
    if (f) setFarbe(f);
  }, [hell]);
  return (
    <span ref={ref} className="s631-feld" data-tinte={stand.zeigt} aria-hidden="true" onPointerEnter={stand.rein} onPointerLeave={(e) => { if (e.pointerType === "mouse") stand.raus(); }}>
      <Zeichen art="suche" an={lauf} verzug={500} neu={stand.neu} />
      {stand.zeigt && <span className="s631-tinte"><TeMarke art="suche" className="s631-leinwand" spanne={2.8} hoch={2.8} farbe={farbe} immer /></span>}
    </span>
  );
}

function Lage({ an, echt, lauf, lupe }: { an: number; echt: boolean; lauf: boolean; lupe: LupeStand }) {
  const [ab, ak] = an < 0 ? [-1, -1] : FOLGE[an % FOLGE.length];
  return (
    <div className="s63-lage" aria-hidden={echt ? undefined : true}>
      <div className="s63-netz" role={echt ? "img" : undefined} aria-label={echt ? "Kreisbahnen um Ihre Stelle. Darauf die Headhunter, die Ihre Stelle sehen und Kandidaten vorstellen." : undefined}>
        <div className="s63-halt">
          {BAHNEN.map((b, bi) => (
            <div key={b.r} className={`s63-bahn${bi % 2 ? " s63-gegenlauf" : ""}${b.klein ? " kb3-klein" : ""}`} style={{ "--r": b.r, "--t": `${b.dauer}s` } as CSSProperties}>
              {b.knoten.map(([w, foto], ki) => {
                const aktiv = bi === ab && ki === ak;
                return (
                  <div key={ki} className="s63-arm" style={{ transform: `rotate(${w}deg)` }}>
                    {aktiv && <i key={an} className="s63-punkt" />}
                    <div className="s63-sitz" style={{ transform: `rotate(${-w}deg)` }}>
                      <div className="s63-aufrecht">
                        {/* 24.11.2026: Außerhalb des blauen Felds stehen anonyme Zeichen. Das Foto liegt nur in der blauen Lage –
                            wächst das Blau beim Scrollen über einen Headhunter, erscheint dort sein Bild. */}
                        <div className="s63-knoten" data-an={aktiv} data-foto={foto !== null}>{echt && foto !== null && hhFoto(foto) ? <img src={hhFoto(foto)!} alt="" /> : <Person />}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div className="s63-mitte">
            {an >= 0 && <i key={an} className="s63-welle" />}
            <span>Ihre Stelle</span>
          </div>
        </div>
      </div>
      <div className="mu-wrap s63-innen">
        <div className="s63-kopf">
          <h2 className="mu-h2">Ihre Stelle geht an alle <span className="s631-fest">Headhunter.<LupeTinte lauf={lauf} hell={echt} stand={lupe} /></span></h2>
          <p className="mu-text">Sie müssen keinen einzeln suchen, briefen oder verhandeln.</p>
          {/* 26.11.2026 (63.3): Reihe aus Headhunter-Bildern und die Zahl in Worten */}
          <div className="kb3-reihe" data-da={lauf}>
            <span className="kb3-gesichter" aria-hidden="true">
              {Array.from({ length: 8 }, (_, i) => (
                <i key={i} style={{ "--i": i } as CSSProperties}>{echt && hhFoto(i) ? <img src={hhFoto(i)!} alt="" /> : <Person />}</i>
              ))}
              <i className="kb3-mehr" style={{ "--i": 8 } as CSSProperties}>+</i>
            </span>
            <span className="kb3-zahl"><b>Hunderte geprüfte Headhunter</b><small>sehen Ihre Stelle, ohne Firmennamen.</small></span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Bahnen3() {
  const ref = useRef<HTMLElement>(null);
  const [an, setAn] = useState(-1);
  const [imBild, setImBild] = useState(false);

  // Fortschritt des Farbübergangs: 0 = Seiten-Grund, 1 = volles blaues Feld
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let bild = 0;
    const mess = () => {
      bild = 0;
      const r = el.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height - window.innerHeight)));
      const x = Math.min(1, t / 0.72);
      el.style.setProperty("--f", (x * x * (3 - 2 * x) * 0.6 + x * 0.4).toFixed(4));
    };
    const los = () => { if (!bild) bild = requestAnimationFrame(mess); };
    mess();
    window.addEventListener("scroll", los, { passive: true });
    window.addEventListener("resize", los);
    const wache = new IntersectionObserver(([e]) => setImBild(e.isIntersecting), { threshold: 0.05 });
    wache.observe(el);
    return () => {
      window.removeEventListener("scroll", los);
      window.removeEventListener("resize", los);
      cancelAnimationFrame(bild);
      wache.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!imBild || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setAn((n) => n + 1), TAKT);
    const s = setTimeout(() => setAn((n) => (n < 0 ? 0 : n)), 600);
    return () => { clearInterval(t); clearTimeout(s); };
  }, [imBild]);

  // Lupe und Tinte: ein Takt für beide Lagen. Im Wechsel Zeichen und Tinte, solange die Sektion im Bild ist;
  // beim Drüberfahren Tinte, solange die Maus darauf ist (am Handy antippen, einige Sekunden).
  const [tinte, setTinte] = useState(false);
  const [drauf, setDrauf] = useState(false);
  const [lupeNeu, setLupeNeu] = useState(0);
  const uhr = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (uhr.current) clearTimeout(uhr.current); }, []);
  useEffect(() => {
    if (!imBild || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let schleife: ReturnType<typeof setTimeout>;
    const anT = () => { setTinte(true); schleife = setTimeout(ausT, TINTE_ZEIT); };
    const ausT = () => { setTinte(false); setLupeNeu((n) => n + 1); schleife = setTimeout(anT, ZEICHEN_ZEIT); };
    schleife = setTimeout(anT, ZEICHEN_ZEIT);
    return () => { clearTimeout(schleife); setTinte(false); };
  }, [imBild]);
  const lupeRaus = () => { setDrauf(false); setLupeNeu((n) => n + 1); };
  const lupe: LupeStand = {
    zeigt: tinte || drauf, neu: lupeNeu, raus: lupeRaus,
    rein: (e) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      setDrauf(true);
      if (uhr.current) clearTimeout(uhr.current);
      if (e.pointerType !== "mouse") uhr.current = setTimeout(lupeRaus, TIPP_DAUER);
    },
  };

  return (
    <section ref={ref} className="s63" data-ruht={!imBild}>
      <div className="s63-buehne">
        <Lage an={an} echt={false} lauf={imBild} lupe={lupe} />
        <div className="s63-blau mu-feld">
          <Lage an={an} echt lauf={imBild} lupe={lupe} />
        </div>
      </div>
    </section>
  );
}
