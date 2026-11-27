// Übersetzung der Sektions-Inhalte (27.11.2026). Der deutsche Satz ist der Schlüssel: Im Code steht weiter der
// deutsche Text, umschlossen von tx("…"). Für Englisch, Schwedisch und Norwegisch schlägt tx im Wörterbuch nach
// (website/uebersetzung/*), fehlt ein Eintrag, bleibt der deutsche Text stehen. Österreich liest Deutsch,
// die Schweiz Deutsch mit „ss“ statt „ß“. Außerhalb des Website-Rahmens (Labor-Ansichten) bleibt alles deutsch.
//
//   const tx = useTx();
//   <h2>{tx("Ein Weg von der Stelle bis zur Einstellung.")}</h2>
//   tx("{n} Headhunter suchen", { n: 3 })      → Platzhalter in geschweiften Klammern
import { schweiz, sprache, type Code } from "./sprachen";
import { useSeitenSprache } from "./kontext";
import { WOERTER } from "./uebersetzung";

export type Werte = Record<string, string | number>;
export type Tx = (deutsch: string, werte?: Werte) => string;

const einsetzen = (text: string, werte?: Werte) =>
  werte ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in werte ? String(werte[k]) : m)) : text;

export function uebersetzer(code: Code | null): Tx {
  if (!code) return einsetzen;
  const s = sprache(code);
  if (s.basis === "de") return code === "de-CH" ? (de, w) => schweiz(einsetzen(de, w)) : einsetzen;
  const buch = WOERTER[s.basis];
  return (de, w) => einsetzen(buch[de] ?? de, w);
}

export const useTx = (): Tx => uebersetzer(useSeitenSprache());
