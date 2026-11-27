// Sektion 39 „Was in keinem Lebenslauf steht“ (matchunt/s39-notizen): Blatt mit der Vorstellung, Notiz-Zettel aus dem
// Gespräch, Überschrift und Satz. „Gespräch“ = Headhunter mit der Person: conversation / samtal / samtale
// („Notizen aus dem Gespräch“ gleich wie in plattform.ts).
// Gleiche Schlüssel wie in einstieg.ts (Kandidat {n}, Leitung Konstruktion, Gehaltswunsch, im Rahmen, Verfügbar,
// in 3 Monaten) stehen hier wortgleich, damit die Datei für sich vollständig ist.
// Nicht eingetragen, weil in allen Sprachen gleich: „H1“ (Headhunter 1); „K1“ nur im Englischen (Candidate 1 = C1).
// Schwedisch und Norwegisch sind nicht muttersprachlich gegengelesen.
import type { Woerterbuch } from "./typ";

const W: Woerterbuch = {
  en: {
    // Blatt
    "K1": "C1",
    "Kandidat {n}": "Candidate {n}",
    "für: {stelle}": "for: {stelle}",
    "Leitung Konstruktion": "Head of Engineering",
    "Lebenslauf": "CV",
    "Vorgestellt von Headhunter 1 nach einem Gespräch": "Introduced by Headhunter 1 after a conversation",
    // Zettel
    "Notizen aus dem Gespräch": "Notes from the conversation",
    "Warum wechseln": "Why switch",
    "Warum jetzt": "Why now",
    "Gehaltswunsch": "Salary expectation",
    "im Rahmen": "within range",
    "Verfügbar": "Available",
    "in 3 Monaten": "in 3 months",
    // Überschrift und Satz
    "Was in keinem Lebenslauf steht.": "What no CV tells you.",
    "Zu jeder Vorstellung bekommen Sie die Notizen aus dem Gespräch.": "With every introduction, you get the notes from the conversation.",
  },
  sv: {
    "Kandidat {n}": "Kandidat {n}",
    "für: {stelle}": "för: {stelle}",
    "Leitung Konstruktion": "Konstruktionschef",
    "Lebenslauf": "CV",
    "Vorgestellt von Headhunter 1 nach einem Gespräch": "Presenterad av Headhunter 1 efter ett samtal",
    "Notizen aus dem Gespräch": "Anteckningar från samtalet",
    "Warum wechseln": "Varför byta",
    "Warum jetzt": "Varför nu",
    "Gehaltswunsch": "Löneanspråk",
    "im Rahmen": "inom ramen",
    "Verfügbar": "Tillgänglig",
    "in 3 Monaten": "om 3 månader",
    "Was in keinem Lebenslauf steht.": "Det som inte står i något CV.",
    "Zu jeder Vorstellung bekommen Sie die Notizen aus dem Gespräch.": "Med varje presentation får du anteckningarna från samtalet.",
  },
  nb: {
    "Kandidat {n}": "Kandidat {n}",
    "für: {stelle}": "for: {stelle}",
    "Leitung Konstruktion": "Konstruksjonssjef",
    "Lebenslauf": "CV",
    "Vorgestellt von Headhunter 1 nach einem Gespräch": "Presentert av Headhunter 1 etter en samtale",
    "Notizen aus dem Gespräch": "Notater fra samtalen",
    "Warum wechseln": "Hvorfor bytte",
    "Warum jetzt": "Hvorfor nå",
    "Gehaltswunsch": "Lønnsønske",
    "im Rahmen": "innenfor rammen",
    "Verfügbar": "Tilgjengelig",
    "in 3 Monaten": "om 3 måneder",
    "Was in keinem Lebenslauf steht.": "Det som ikke står i noen CV.",
    "Zu jeder Vorstellung bekommen Sie die Notizen aus dem Gespräch.": "Med hver presentasjon får du notatene fra samtalen.",
  },
};

export default W;
