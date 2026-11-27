// Sprache der aktuellen Website-Seite. Außerhalb des Website-Rahmens (Labor-Ansichten) ist sie null,
// dann zeigen Sprachmenü und Hinweisleiste nichts an.
import { createContext, useContext } from "react";
import type { Code } from "./sprachen";

export const SeitenSprache = createContext<Code | null>(null);
export const useSeitenSprache = () => useContext(SeitenSprache);

/** true, wenn der Rahmen die Kopfzeile selbst oben festhält – dann lassen Sektionen ihre eigene Leiste weg. */
export const KopfImRahmen = createContext(false);
export const useKopfImRahmen = () => useContext(KopfImRahmen);
