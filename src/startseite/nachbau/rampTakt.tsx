// Kleine Helfer für die Ramp-Nachbauten: Schritt-Takt für Schleifen-Animationen und tickende Ziffern.
import { Fragment, useEffect, useState, useSyncExternalStore } from "react";

const RUHIG = "(prefers-reduced-motion: reduce)";
const ruhigAbo = (melde: () => void) => {
  const m = window.matchMedia(RUHIG);
  m.addEventListener("change", melde);
  return () => m.removeEventListener("change", melde);
};

/** true, wenn der Besucher weniger Bewegung wünscht. */
export function useRuhig(): boolean {
  return useSyncExternalStore(ruhigAbo, () => window.matchMedia(RUHIG).matches, () => false);
}

/** Zählt in Schleife durch die Schritte; `dauern[i]` = Verweildauer von Schritt i in ms.
 *  Bei „weniger Bewegung“ bleibt der Endzustand `ende` stehen. */
export function useSchritte(aktiv: boolean, dauern: readonly number[], ende: number): number {
  const ruhig = useRuhig();
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!aktiv || ruhig) return;
    const t = setTimeout(() => setS((s + 1) % dauern.length), dauern[s]);
    return () => clearTimeout(t);
  }, [aktiv, ruhig, s, dauern]);
  return ruhig ? ende : s;
}

/** Klassen zusammensetzen. */
export const kl = (...teile: (string | false | null | undefined)[]) => teile.filter(Boolean).join(" ");

const ZIFFERN = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Vierstellige Zahl, deren Ziffern wie ein Zählwerk rollen. Reiner Platzhalter – zählt von `start` einfach hoch. */
export function Zaehlwerk({ start = 0, takt = 900, laeuft = true }: { start?: number; takt?: number; laeuft?: boolean }) {
  const ruhig = useRuhig();
  const [n, setN] = useState(start);
  useEffect(() => {
    if (ruhig || !laeuft) return;
    const t = setInterval(() => setN((v) => (v + 1 + Math.floor(Math.random() * 6)) % 10000), takt);
    return () => clearInterval(t);
  }, [ruhig, laeuft, takt]);
  const z = String(n).padStart(4, "0");
  return (
    <span className="rp-zahl" aria-hidden="true">
      {[...z].map((c, i) => (
        <Fragment key={i}>
          {i === 1 && <span className="rp-zahl-punkt">.</span>}
          <span className="rp-zif">
            <span className="rp-zif-rolle" style={{ transform: `translateY(-${Number(c) * 10}%)` }}>
              {ZIFFERN.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        </Fragment>
      ))}
    </span>
  );
}
