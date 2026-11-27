// Sektion 42 „Sie sehen immer, was als Nächstes ansteht“ (matchunt/s42-aufgaben): Karte mit der Aufgabenliste des
// Kunden, Überschrift und Knopf. Gleiche Schlüssel wie in einstieg.ts / klammer.ts (Ihre Aufgaben, Leitung Konstruktion,
// Kandidat {n}, Interview anfragen, Angebot machen, Stelle beschreiben) stehen hier wortgleich.
// Am Handy stehen Aufgabe und „Jetzt“ in einer Zeile ohne Umbruch: Übersetzungen der Aufgaben bewusst kurz.
// Schwedisch und Norwegisch sind nicht muttersprachlich gegengelesen.
import type { Woerterbuch } from "./typ";

const W: Woerterbuch = {
  en: {
    // Karte
    "Ihre Aufgaben": "Your tasks",
    "Leitung Konstruktion": "Head of Engineering",
    "Vorstellung prüfen": "Review introduction",
    "Feedback geben": "Give feedback",
    "Angebot machen": "Make an offer",
    "Kandidat {n}": "Candidate {n}",
    "Interview anfragen": "Request interview",
    "Jetzt": "Now",
    "Läuft bei anderen": "Handled by others",
    "Headhunter stimmt den Termin ab": "Headhunter is scheduling the meeting",
    // Überschrift und Knopf
    "Sie sehen immer, was als Nächstes ansteht.": "You always see what's next.",
    "Stelle beschreiben": "Describe the position",
  },
  sv: {
    "Ihre Aufgaben": "Dina uppgifter",
    "Leitung Konstruktion": "Konstruktionschef",
    "Vorstellung prüfen": "Granska presentation",
    "Feedback geben": "Ge feedback",
    "Angebot machen": "Lämna erbjudande",
    "Kandidat {n}": "Kandidat {n}",
    "Interview anfragen": "Begär intervju",
    "Jetzt": "Nu",
    "Läuft bei anderen": "Hanteras av andra",
    "Headhunter stimmt den Termin ab": "Headhuntern stämmer av tiden",
    "Sie sehen immer, was als Nächstes ansteht.": "Du ser alltid vad som står på tur.",
    "Stelle beschreiben": "Beskriv tjänsten",
  },
  nb: {
    "Ihre Aufgaben": "Dine oppgaver",
    "Leitung Konstruktion": "Konstruksjonssjef",
    "Vorstellung prüfen": "Vurder presentasjon",
    "Feedback geben": "Gi tilbakemelding",
    "Angebot machen": "Gi tilbud",
    "Kandidat {n}": "Kandidat {n}",
    "Interview anfragen": "Be om intervju",
    "Jetzt": "Nå",
    "Läuft bei anderen": "Håndteres av andre",
    "Headhunter stimmt den Termin ab": "Headhunteren avtaler tidspunktet",
    "Sie sehen immer, was als Nächstes ansteht.": "Du ser alltid hva som står for tur.",
    "Stelle beschreiben": "Beskriv stillingen",
  },
};

export default W;
