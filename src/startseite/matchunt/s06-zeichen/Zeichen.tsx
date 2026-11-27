// Die vier Zeichen der vier Schritte, selbst gezeichnet. Jedes baut sich Strich für Strich auf, wie mit Tinte.
// Benutzt von Sektion 6 (groß, in einer Reihe) und Sektion 7 (klein, im Satz).
import { useState, type CSSProperties } from "react";
import "./s06.css";

export type ZeichenArt = "stelle" | "suche" | "kennen" | "einstellen" | "gespraech" | "profil" | "termin";

type Teil = { d: string; b: number; dauer: number } | { punkt: [number, number, number]; b: number };

// Feld 96 × 96. b = Beginn in ms, dauer = Zeichendauer in ms.
const FORMEN: Record<ZeichenArt, Teil[]> = {
  // Ein Blatt mit zwei Zeilen: die Anzeige.
  stelle: [
    { d: "M54 13H25V83H72V31Z", b: 0, dauer: 800 },
    { d: "M37 47H60", b: 700, dauer: 260 },
    { d: "M37 63H52", b: 900, dauer: 220 },
  ],
  // Eine Lupe, in der jemand gefunden ist.
  suche: [
    { d: "M59 59A25 25 0 1 1 59.5 58.5", b: 0, dauer: 700 },
    { d: "M60 60L82 82", b: 640, dauer: 280 },
    { punkt: [41, 41, 6], b: 900 },
  ],
  // Zwei Personen einander gegenüber.
  kennen: [
    { punkt: [28, 30, 10], b: 0 },
    { d: "M13 80C13 64 18 54 28 54S43 64 43 80", b: 180, dauer: 420 },
    { punkt: [68, 30, 10], b: 520 },
    { d: "M53 80C53 64 58 54 68 54S83 64 83 80", b: 700, dauer: 420 },
  ],
  // Für den Kunden-Einstieg (23.11.2026): eine Sprechblase mit drei Punkten – das Gespräch des Headhunters.
  gespraech: [
    { d: "M22 22H74Q84 22 84 32V58Q84 68 74 68H46L28 82V68H22Q12 68 12 58V32Q12 22 22 22Z", b: 0, dauer: 900 },
    { punkt: [34, 45, 5], b: 820 },
    { punkt: [48, 45, 5], b: 920 },
    { punkt: [62, 45, 5], b: 1020 },
  ],
  // Eine Karte mit Person und zwei Zeilen – die Vorstellung.
  profil: [
    { d: "M16 20H80V76H16Z", b: 0, dauer: 820 },
    { punkt: [36, 40, 7], b: 680 },
    { d: "M25 64C25 56 30 52 36 52S47 56 47 64", b: 780, dauer: 300 },
    { d: "M57 40H70", b: 960, dauer: 200 },
    { d: "M57 56H67", b: 1060, dauer: 180 },
  ],
  // Ein Kalenderblatt mit Haken – der Interview-Termin.
  termin: [
    { d: "M16 26H80V80H16Z", b: 0, dauer: 820 },
    { d: "M16 42H80", b: 680, dauer: 260 },
    { d: "M34 16V32", b: 820, dauer: 160 },
    { d: "M62 16V32", b: 900, dauer: 160 },
    { d: "M36 61L45 70L61 53", b: 1040, dauer: 320 },
  ],
  // Eine Unterschrift auf der Linie.
  einstellen: [
    { d: "M12 62C16 44 22 16 30 16C38 16 30 62 38 62C45 62 44 40 51 40C57 40 53 58 60 58C66 58 66 46 72 46C77 46 78 52 84 48", b: 0, dauer: 900 },
    { d: "M14 80H82", b: 860, dauer: 300 },
  ],
};

/** Ein Zeichen. `an` = darf sich zeichnen, `verzug` = Wartezeit davor in ms, `neu` = Zähler von außen: jede
 *  Erhöhung zeichnet neu. Mit `selbst` zeichnet es sich beim Überfahren von allein neu. */
export function Zeichen({ art, an = true, verzug = 0, neu = 0, selbst = false, className = "" }: { art: ZeichenArt; an?: boolean; verzug?: number; neu?: number; selbst?: boolean; className?: string }) {
  const [eigen, setEigen] = useState(0);
  const runde = neu + eigen;
  return (
    <span
      className={`s06-z ${className}`}
      data-an={an}
      style={{ "--s06-v": `${runde ? 0 : verzug}ms` } as CSSProperties}
      onPointerEnter={selbst && an ? () => setEigen((n) => n + 1) : undefined}
      aria-hidden="true"
    >
      <svg key={runde} viewBox="0 0 96 96" focusable="false">
        {FORMEN[art].map((t, i) =>
          "d" in t ? (
            <path key={i} className="s06-zug" d={t.d} pathLength={1} style={{ "--b": `${t.b}ms`, "--d": `${t.dauer}ms` } as CSSProperties} />
          ) : (
            <circle key={i} className="s06-tupf" cx={t.punkt[0]} cy={t.punkt[1]} r={t.punkt[2]} style={{ "--b": `${t.b}ms` } as CSSProperties} />
          ),
        )}
      </svg>
    </span>
  );
}
