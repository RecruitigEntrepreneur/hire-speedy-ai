// Sektion „Plattform“ (60.2 / 60.3 / 60.4): blaues Feld mit Überschrift, zwei Knöpfen und Karten mit kleinen
// App-Fenstern (matchunt/s60-2-plattform/Plattform.tsx, matchunt/s60-3-plattform/Werkzeuge.tsx,
// neu/pf4-plattform/Plattform4.tsx). Schlüssel = deutscher Text, genau wie im Code.
// Schon in einstieg.ts (dort übersetzt, hier nicht wiederholt): „Leitung Controlling“, „Eckdaten“, „Vergütung“,
// „Anforderungen“, „Rahmendaten“, „Erfahrung“, „ab 8 Jahren“, „Team von 6“, „aus der Anzeige“, „1 neu“,
// „{k} im Rennen“, „Suche“, „Vorschläge“, „Interviews“, „Angebot“, „Besetzt“, „Neu:“, „Leiter Controlling · 12 Jahre“,
// „Headhunter suchen gerade.“, „Noch sucht kein Headhunter“, „1 Headhunter sucht“, „{n} Headhunter suchen“,
// „Bilanzbuchhaltung“, „Kandidat {n}“, „12 Jahre“, „im Rahmen“, „Verfügbar“, „in 3 Monaten“, „Interview anfragen“,
// „Di“, „Mi“, „Do“, „{z} Uhr“, „Angebot angenommen“, „Unterschrift“, „Honorar nur bei Einstellung, erst mit der
// Unterschrift.“, „Beispiel, keine echten Daten.“ – und in klammer.ts: „Stelle beschreiben“.
// Nicht eingetragen, weil in allen Sprachen gleich: „Hybrid“, „Headhunter“, „Gold Partner“, „Partner“, „Headhunter 1–3“,
// Markennamen (Outlook, Teams, DocuSign, Google Meet, Zoom, Matchunt, Personio …).
// Schwedisch und Norwegisch sind nicht muttersprachlich gegengelesen.
import type { Woerterbuch } from "./typ";

const W: Woerterbuch = {
  en: {
    // Überschrift und Knöpfe
    "Die Headhunter-Plattform für die ganze Besetzung.": "The headhunter platform for the whole hiring process.",
    "Ablauf ansehen": "See how it works",

    // 1 · Aufnahme aus Ihrer Anzeige
    "Aufnahme aus Ihrer Anzeige": "Intake from your ad",
    "Konditionen": "Terms",
    "Aus Ihrer Anzeige übernommen": "Taken from your ad",
    "3 noch zu prüfen": "3 left to check",
    "Arbeitsmodell": "Work model",
    "Führung": "Leadership",
    "Aufgaben": "Tasks",
    "Abschluss, Planung, Reporting": "Closing, planning, reporting",
    "Gehalt": "Salary",
    "95.000 – 110.000 €": "€95,000 – 110,000",
    "fehlt noch": "still missing",
    "Weiter": "Next",

    // 2 · Sie sehen, wer für Ihre Stelle sucht
    "Sie sehen, wer für Ihre Stelle sucht": "See who's searching for your position",
    "Festanstellung · Hybrid · seit 3 Tagen": "Permanent · Hybrid · open for 3 days",
    "Festanstellung · Vor Ort · seit heute": "Permanent · On-site · added today",
    "Silber Partner": "Silver Partner",
    "4,9": "4.9",
    "4,8": "4.8",
    "4,7": "4.7",
    "sucht": "searching",

    // 3 · Läuft mit Ihren Werkzeugen
    "Läuft mit Ihren Werkzeugen": "Works with your tools",
    "Verbunden": "Connected",
    "Google Kalender": "Google Calendar",
    "Termin im Kalender": "Calendar entry",
    "Link zum Gespräch": "Link to the call",
    "In Arbeit": "In the works",

    // 3 (60.2) · Vorstellungen nach dem Gespräch
    "Vorstellungen nach dem Gespräch": "Introductions after the call",
    "Im Interviewprozess": "Interviewing",
    "Neu · heute": "New · today",
    "Rolle": "Role",
    "Notizen aus dem Gespräch": "Notes from the conversation", // wie notizen.ts
    "Einschätzung zur Stelle": "Assessment for the position",

    // 4 · Interviews mit Terminvorschlag
    "Interviews mit Terminvorschlag": "Interviews with suggested times",
    "Interview · Kandidat {n}": "Interview · Candidate {n}",
    "Termin bestätigen": "Confirm time",
    "Termin steht": "Time confirmed",

    // 5 (60.2) · Vom Angebot zur Unterschrift
    "Vom Angebot zur Unterschrift": "From offer to signature",
    "Angebot gesendet": "Offer sent",
    "Vertrag unterschrieben": "Contract signed",

    // 5 (60.4) · Die passende Person liest keine Anzeigen
    "Die passende Person liest keine Anzeigen.": "The right person doesn't read job ads.",
    "Bei der Arbeit": "At work",
    "Liest keine Anzeigen": "Doesn't read ads",
    "Gespräch vereinbart": "Call arranged",
    "Hat einen Job · Beispiel": "Has a job · Example",
    "Stellenanzeige": "Job ad",
    "ungelesen": "unread",
    "Darf ich Ihnen eine Stelle zeigen?": "May I show you a position?",
    "Gern, rufen Sie mich an.": "Sure, give me a call.",
  },

  sv: {
    "Die Headhunter-Plattform für die ganze Besetzung.": "Headhunterplattformen för hela rekryteringen.",
    "Ablauf ansehen": "Se hur det fungerar",

    "Aufnahme aus Ihrer Anzeige": "Tjänsteprofil från din annons",
    "Konditionen": "Villkor",
    "Aus Ihrer Anzeige übernommen": "Hämtat från din annons",
    "3 noch zu prüfen": "3 kvar att granska",
    "Arbeitsmodell": "Arbetsmodell",
    "Führung": "Personalansvar",
    "Aufgaben": "Arbetsuppgifter",
    "Abschluss, Planung, Reporting": "Bokslut, planering, rapportering",
    "Gehalt": "Lön",
    "95.000 – 110.000 €": "95 000 – 110 000 €",
    "fehlt noch": "saknas än",
    "Weiter": "Nästa",

    "Sie sehen, wer für Ihre Stelle sucht": "Du ser vem som söker kandidater till din tjänst",
    "Festanstellung · Hybrid · seit 3 Tagen": "Fast anställning · Hybrid · öppen i 3 dagar",
    "Festanstellung · Vor Ort · seit heute": "Fast anställning · På plats · tillagd i dag",
    "Silber Partner": "Silver Partner",
    "sucht": "söker",

    "Läuft mit Ihren Werkzeugen": "Fungerar med dina verktyg",
    "Verbunden": "Ansluten",
    "Termin im Kalender": "Möte i kalendern",
    "Link zum Gespräch": "Länk till samtalet",
    "In Arbeit": "På gång",

    "Vorstellungen nach dem Gespräch": "Presentationer efter samtalet",
    "Im Interviewprozess": "I intervjuprocessen",
    "Neu · heute": "Ny · i dag",
    "Rolle": "Roll",
    "Notizen aus dem Gespräch": "Anteckningar från samtalet",
    "Einschätzung zur Stelle": "Bedömning mot tjänsten",

    "Interviews mit Terminvorschlag": "Intervjuer med tidsförslag",
    "Interview · Kandidat {n}": "Intervju · Kandidat {n}",
    "Termin bestätigen": "Bekräfta tid",
    "Termin steht": "Tid bekräftad",

    "Vom Angebot zur Unterschrift": "Från erbjudande till underskrift",
    "Angebot gesendet": "Erbjudandet skickat",
    "Vertrag unterschrieben": "Avtalet undertecknat",

    "Die passende Person liest keine Anzeigen.": "Rätt person läser inga platsannonser.",
    "Bei der Arbeit": "På jobbet",
    "Liest keine Anzeigen": "Läser inga annonser",
    "Gespräch vereinbart": "Samtal bokat",
    "Hat einen Job · Beispiel": "Har ett jobb · Exempel",
    "Stellenanzeige": "Platsannons",
    "ungelesen": "oläst",
    "Darf ich Ihnen eine Stelle zeigen?": "Får jag visa dig en tjänst?",
    "Gern, rufen Sie mich an.": "Gärna, ring mig.",
  },

  nb: {
    "Die Headhunter-Plattform für die ganze Besetzung.": "Headhunterplattformen for hele rekrutteringen.",
    "Ablauf ansehen": "Se hvordan det fungerer",

    "Aufnahme aus Ihrer Anzeige": "Stillingsprofil fra annonsen din",
    "Konditionen": "Betingelser",
    "Aus Ihrer Anzeige übernommen": "Hentet fra annonsen din",
    "3 noch zu prüfen": "3 må sjekkes",
    "Arbeitsmodell": "Arbeidsmodell",
    "Führung": "Personalansvar",
    "Aufgaben": "Arbeidsoppgaver",
    "Abschluss, Planung, Reporting": "Årsoppgjør, planlegging, rapportering",
    "Gehalt": "Lønn",
    "95.000 – 110.000 €": "95 000 – 110 000 €",
    "fehlt noch": "mangler ennå",
    "Weiter": "Neste",

    "Sie sehen, wer für Ihre Stelle sucht": "Du ser hvem som søker etter kandidater til stillingen din",
    "Festanstellung · Hybrid · seit 3 Tagen": "Fast stilling · Hybrid · åpen i 3 dager",
    "Festanstellung · Vor Ort · seit heute": "Fast stilling · På kontoret · lagt inn i dag",
    "Silber Partner": "Silver Partner",
    "sucht": "søker",

    "Läuft mit Ihren Werkzeugen": "Fungerer med verktøyene dine",
    "Verbunden": "Tilkoblet",
    "Termin im Kalender": "Avtale i kalenderen",
    "Link zum Gespräch": "Lenke til samtalen",
    "In Arbeit": "Under arbeid",

    "Vorstellungen nach dem Gespräch": "Presentasjoner etter samtalen",
    "Im Interviewprozess": "I intervjuprosessen",
    "Neu · heute": "Ny · i dag",
    "Rolle": "Rolle",
    "Notizen aus dem Gespräch": "Notater fra samtalen",
    "Einschätzung zur Stelle": "Vurdering opp mot stillingen",

    "Interviews mit Terminvorschlag": "Intervjuer med forslag til tidspunkt",
    "Interview · Kandidat {n}": "Intervju · Kandidat {n}",
    "Termin bestätigen": "Bekreft tidspunkt",
    "Termin steht": "Tidspunkt bekreftet",

    "Vom Angebot zur Unterschrift": "Fra tilbud til signering",
    "Angebot gesendet": "Tilbudet sendt",
    "Vertrag unterschrieben": "Kontrakten signert",

    "Die passende Person liest keine Anzeigen.": "Den rette personen leser ikke stillingsannonser.",
    "Bei der Arbeit": "På jobb",
    "Liest keine Anzeigen": "Leser ikke annonser",
    "Gespräch vereinbart": "Samtale avtalt",
    "Hat einen Job · Beispiel": "Har en jobb · Eksempel",
    "Stellenanzeige": "Stillingsannonse",
    "ungelesen": "ulest",
    "Darf ich Ihnen eine Stelle zeigen?": "Kan jeg vise deg en stilling?",
    "Gern, rufen Sie mich an.": "Gjerne, ring meg.",
  },
};

export default W;
