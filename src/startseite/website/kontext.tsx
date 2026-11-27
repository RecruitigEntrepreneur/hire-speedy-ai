// Sprache der aktuellen Website-Seite. Außerhalb des Website-Rahmens (Labor-Ansichten) ist sie null,
// dann zeigen Sprachmenü und Hinweisleiste nichts an.
import { createContext, useContext } from "react";
import type { Code } from "./sprachen";

export const SeitenSprache = createContext<Code | null>(null);
export const useSeitenSprache = () => useContext(SeitenSprache);
