// Der Satz aus Sektion 7.3 in vier Teilen (24.11.2026) – für die Sektionen 18.2 und 18.3, die Satz und Weg verbinden.
// Wortlaut, Lesetempo, Zeichen und der Tinten-Effekt (Zeichen wird beim Überfahren zu Tropfen) sind wie in 7.3;
// 7.3 selbst bleibt unverändert. Jeder Teil ist ein Schritt des Wegs.
// Übersetzt (27.11.2026) wird jeder Teil als Ganzes (Schlüssel = TEXT[n]) und neu in Worte zerlegt, siehe inSprache.
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { TeMarke } from "@/startseite/nachbau3/te/Marke";
import type { Art } from "@/startseite/nachbau3/te/tinte";
import { useTx, type Tx } from "@/startseite/website/uebersetzen";
import { Zeichen, type ZeichenArt } from "../s06-zeichen/Zeichen";
import "./satzteil.css";

type Wort = { w: string; teil: number; hell?: boolean; nach?: ZeichenArt; satz?: string; halt?: number };
const WORTE: Wort[] = [
  { w: "Sie", teil: 0 }, { w: "beschreiben", teil: 0 }, { w: "die", teil: 0 }, { w: "Stelle", teil: 0, hell: true, nach: "stelle", satz: ",", halt: 420 },
  { w: "Headhunter", teil: 1, hell: true }, { w: "suchen", teil: 1, nach: "suche", satz: ",", halt: 420 },
  { w: "Sie", teil: 2 }, { w: "lernen", teil: 2 }, { w: "die", teil: 2 }, { w: "Kandidaten", teil: 2, hell: true }, { w: "kennen", teil: 2, nach: "kennen", halt: 260 },
  { w: "und", teil: 3 }, { w: "stellen", teil: 3 }, { w: "ein", teil: 3, nach: "einstellen", satz: "." },
];
const TINTE: Partial<Record<ZeichenArt, Art>> = { stelle: "stelle", suche: "suche", kennen: "gespraech", einstellen: "angebot" };
const START = 250, JE_WORT = 150, JE_BUCHSTABE = 22;
/** Einblendzeit jedes Worts ab Satzbeginn und Beginn jedes Teils (Lesetempo: je Wort, je Buchstabe, Pausen). */
function zeitplan(worte: Wort[]) {
  let t = START;
  const zeiten = worte.map((x) => { const ab = t; t += JE_WORT + x.w.length * JE_BUCHSTABE + (x.halt ?? 0); return ab; });
  return { zeiten, teilAb: [0, 1, 2, 3].map((n) => zeiten[worte.findIndex((x) => x.teil === n)]) };
}
const DEUTSCH = zeitplan(WORTE);
const TIPP_DAUER = 7000;

export const SATZ = "Sie beschreiben die Stelle, Headhunter suchen, Sie lernen die Kandidaten kennen und stellen ein.";
export const SATZ_ENDE = DEUTSCH.zeiten[DEUTSCH.zeiten.length - 1] + 900;
// Die vier Teile im Ganzen – zugleich die Schlüssel der Übersetzung (website/uebersetzung/satzweg.ts).
const TEXT = [0, 1, 2, 3].map((n) => WORTE.filter((x) => x.teil === n).map((x) => x.w + (x.satz ?? "")).join(" "));

/** Die Worte in der Seitensprache. Deutsch (oder ohne Übersetzung): WORTE wie oben. Sonst wird jeder Teil als Ganzes
 *  übersetzt und neu in Worte zerlegt: *…* markiert das hervorgehobene Wort; Zeichen, Pause und ein Satzzeichen am
 *  Ende hängen wie im Deutschen am letzten Wort des Teils. */
function inSprache(tx: Tx): Wort[] {
  return [0, 1, 2, 3].flatMap((n) => {
    const de = WORTE.filter((x) => x.teil === n);
    const satz = tx(TEXT[n]);
    if (satz === TEXT[n]) return de;
    const ende = de[de.length - 1];
    const teile = satz.split(/\s+/).filter(Boolean);
    return teile.map((roh, i): Wort => {
      const letztes = i === teile.length - 1;
      const m = letztes ? /^(.+?)([,.;:!?…]+)$/.exec(roh) : null;
      const w = m ? m[1] : roh;
      const wort: Wort = { w: w.replace(/\*/g, ""), teil: n, hell: w.includes("*") };
      return letztes ? { ...wort, nach: ende.nach, halt: ende.halt, satz: m?.[2] } : wort;
    });
  });
}

/** Ein Teil des Satzes. einzeln: der Teil blendet für sich ein (ohne auf die Teile davor zu warten). */
export function Teil({ n, da, einzeln }: { n: number; da: boolean; einzeln?: boolean }) {
  const tx = useTx();
  const [aktiv, setAktiv] = useState(-1);
  const [neu, setNeu] = useState<Record<number, number>>({});
  const [farbe, setFarbe] = useState("#0071e3");
  const uhr = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (uhr.current) clearTimeout(uhr.current); }, []);
  const worte = inSprache(tx);
  const { zeiten, teilAb } = zeitplan(worte);
  const ab = einzeln ? teilAb[n] - 150 : 0;

  const raus = (i: number) => {
    setAktiv((a) => (a === i ? -1 : a));
    setNeu((a) => ({ ...a, [i]: (a[i] ?? 0) + 1 }));
  };
  const rein = (i: number, e: PointerEvent<HTMLSpanElement>) => {
    if (!da || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ak = getComputedStyle(e.currentTarget).getPropertyValue("--mu-ak").trim();
    if (ak) setFarbe(ak);
    setAktiv(i);
    if (uhr.current) clearTimeout(uhr.current);
    if (e.pointerType !== "mouse") uhr.current = setTimeout(() => raus(i), TIPP_DAUER);
  };

  return (
    <span className="sw-teil" data-da={da}>
      <span className="sw-nur-leser">{tx(TEXT[n]).replace(/\*/g, "")}</span>
      {worte.map((x, i) => x.teil !== n ? null : (
        <span key={i} aria-hidden="true">
          <span className="sw-fest" data-tinte={x.nach ? aktiv === i : undefined}
            onPointerEnter={x.nach ? (e) => rein(i, e) : undefined}
            onPointerLeave={x.nach ? (e) => { if (e.pointerType === "mouse") raus(i); } : undefined}>
            <span className="sw-wort" data-hell={!!x.hell} style={{ "--t": `${zeiten[i] - ab}ms` } as CSSProperties}><span>{x.w}</span></span>
            {x.nach && (
              <span className="sw-feld">
                <Zeichen art={x.nach} an={da} verzug={zeiten[i] - ab + 120} neu={neu[i] ?? 0} />
                {aktiv === i && <span className="sw-tinte"><TeMarke art={TINTE[x.nach] ?? "stelle"} className="sw-leinwand" spanne={2.8} hoch={2.8} farbe={farbe} /></span>}
              </span>
            )}
            {x.satz && <span className="sw-wort" style={{ "--t": `${zeiten[i] - ab + 200}ms` } as CSSProperties}><span>{x.satz}</span></span>}
          </span>{" "}
        </span>
      ))}
    </span>
  );
}
