// Sektion 18.4 „Satz am Weg“ (blau) mit allem, was sie nutzt: Linie und Stationen (s18-weg/Weg.tsx), die vier bewegten
// Bilder (s18-1-weg/WegVerwandlung.tsx) und die vier Satzteile an den Knoten (s18-2-satzbild/SatzTeil.tsx).
// Schlüssel = deutscher Text, genau wie im Code. Gleiche Schlüssel wie in einstieg.ts / klammer.ts sind gleich übersetzt.
//
// Satzteile: Jeder Teil wird als Ganzes übersetzt und dann neu in Worte zerlegt. *…* markiert das hervorgehobene
// (farbige) Wort; das Zeichen hängt immer am letzten Wort, ein Satzzeichen am Ende steht dahinter. Die vier Teile sind
// ein durchgehender Satz, darum klein weiter nach dem Komma.
// Nicht eingetragen, weil in allen Sprachen gleich: „Live“, „Head of Controlling“.
// Wege in Bild 1 im Wortlaut der App (intake: cardUrlTitle, cardFileTitle, pasteAd, manual).
// Schwedisch und Norwegisch sind nicht muttersprachlich gegengelesen.
import type { Woerterbuch } from "./typ";

const W: Woerterbuch = {
  en: {
    // Satzteile an den Knoten
    "Sie beschreiben die Stelle,": "You describe the *position*,",
    "Headhunter suchen,": "*headhunters* search,",
    "Sie lernen die Kandidaten kennen": "you get to know the *candidates*",
    "und stellen ein.": "and hire.",

    // Überschrift, Stationen, Knopf
    "Ein Weg von der Stelle": "One path from position",
    "bis zur Unterschrift.": "to signature.",
    "Stelle beschreiben": "Describe the position",
    "Headhunter suchen": "Headhunters search",
    "Kandidaten kennenlernen": "Meet candidates",
    "Einstellen": "Hire",
    "Sie fügen Ihre Anzeige ein, das genügt für den Anfang.": "You paste in your ad, and that's enough to get started.",
    "Ein Link, eine Datei oder ein paar Sätze genügen für den Anfang.": "A link, a file or a few sentences are enough to get started.",
    "Geprüfte Headhunter suchen für Ihre Stelle, alle unter einem Rahmenvertrag.": "Vetted headhunters search for your position, all under one framework agreement.",
    "Sie sehen jede Vorstellung und fragen ein Interview an.": "You see every introduction and request an interview.",
    "Sie machen das Angebot, und erst mit der Unterschrift fällt das Honorar an.": "You make the offer, and the fee is only due once the contract is signed.",
    "Stelle kostenlos ausschreiben": "Post a position for free",

    // Bilder (Grundfassung 18)
    "Ihre Anzeige": "Your ad",
    "Leitung Konstruktion (m/w/d)": "Head of Engineering",
    "Leitung Konstruktion": "Head of Engineering",
    "K{n}": "C{n}",
    "Kandidat {n}": "Candidate {n}",
    "für: {stelle}": "for: {stelle}",
    "Neu · heute": "New · today",
    "Interview anfragen": "Request interview",
    "Arbeitsvertrag": "Employment contract",
    "Vertrag unterschrieben": "Contract signed",

    // Bilder (Verwandlungen 18.1)
    "Link zur Anzeige": "Link to the ad",
    "PDF oder Word": "PDF or Word",
    "Anzeige einfügen": "Paste ad",
    "Von Hand beschreiben": "Describe it yourself",
    "Leitung Controlling": "Head of Controlling",
    "angelegt": "created",
    "In Prüfung": "In review",
    "Noch sucht kein Headhunter": "No headhunter searching yet",
    "{n} Headhunter suchen": "{n} headhunters searching",
    "{k} neu": "{k} new",
    "Leiter Controlling": "Head of Controlling",
    "Neu": "New",
    "Interview · Mi, 14:30": "Interview · Wed, 14:30",
    "Angebot angenommen": "Offer accepted",
    "Besetzt": "Filled",
  },

  sv: {
    "Sie beschreiben die Stelle,": "Du beskriver *tjänsten*,",
    "Headhunter suchen,": "*headhunters* söker,",
    "Sie lernen die Kandidaten kennen": "du lär känna *kandidaterna*",
    "und stellen ein.": "och anställer.",

    "Ein Weg von der Stelle": "En väg från tjänst",
    "bis zur Unterschrift.": "till underskrift.",
    "Stelle beschreiben": "Beskriv tjänsten",
    "Headhunter suchen": "Headhunters söker",
    "Kandidaten kennenlernen": "Träffa kandidater",
    "Einstellen": "Anställ",
    "Sie fügen Ihre Anzeige ein, das genügt für den Anfang.": "Du klistrar in din annons, det räcker för att komma igång.",
    "Ein Link, eine Datei oder ein paar Sätze genügen für den Anfang.": "En länk, en fil eller några meningar räcker för att komma igång.",
    // „söka till en tjänst“ hieße „sich bewerben“, darum „söker kandidater till“
    "Geprüfte Headhunter suchen für Ihre Stelle, alle unter einem Rahmenvertrag.": "Granskade headhunters söker kandidater till din tjänst, alla under ett ramavtal.",
    "Sie sehen jede Vorstellung und fragen ein Interview an.": "Du ser varje presentation och begär en intervju.",
    "Sie machen das Angebot, und erst mit der Unterschrift fällt das Honorar an.": "Du lämnar erbjudandet, och arvodet faller ut först när avtalet är undertecknat.",
    "Stelle kostenlos ausschreiben": "Publicera tjänsten gratis",

    "Ihre Anzeige": "Din annons",
    "Leitung Konstruktion (m/w/d)": "Konstruktionschef",
    "Leitung Konstruktion": "Konstruktionschef",
    "K{n}": "K{n}",
    "Kandidat {n}": "Kandidat {n}",
    "für: {stelle}": "för: {stelle}",
    "Neu · heute": "Ny · i dag",
    "Interview anfragen": "Begär intervju",
    "Arbeitsvertrag": "Anställningsavtal",
    "Vertrag unterschrieben": "Avtalet undertecknat",

    "Link zur Anzeige": "Länk till annonsen",
    "PDF oder Word": "PDF eller Word",
    "Anzeige einfügen": "Klistra in annons",
    "Von Hand beschreiben": "Beskriv själv",
    "Leitung Controlling": "Controllerchef",
    "angelegt": "skapad",
    "In Prüfung": "Granskas",
    "Noch sucht kein Headhunter": "Ingen headhunter söker än",
    "{n} Headhunter suchen": "{n} headhunters söker",
    "{k} neu": "{k} nya",
    "Leiter Controlling": "Controllerchef",
    "Neu": "Ny",
    "Interview · Mi, 14:30": "Intervju · ons kl. 14:30",
    "Angebot angenommen": "Erbjudandet accepterat",
    "Besetzt": "Tillsatt",
  },

  nb: {
    "Sie beschreiben die Stelle,": "Du beskriver *stillingen*,",
    "Headhunter suchen,": "*headhuntere* søker,",
    "Sie lernen die Kandidaten kennen": "du blir kjent med *kandidatene*",
    "und stellen ein.": "og ansetter.",

    "Ein Weg von der Stelle": "Én vei fra stilling",
    "bis zur Unterschrift.": "til signatur.",
    "Stelle beschreiben": "Beskriv stillingen",
    "Headhunter suchen": "Headhuntere søker",
    "Kandidaten kennenlernen": "Møt kandidater",
    "Einstellen": "Ansett",
    "Sie fügen Ihre Anzeige ein, das genügt für den Anfang.": "Du limer inn annonsen din, det holder for å komme i gang.",
    "Ein Link, eine Datei oder ein paar Sätze genügen für den Anfang.": "En lenke, en fil eller noen setninger holder for å komme i gang.",
    // „søke på/til en stilling“ hieße „sich bewerben“, darum „søker etter kandidater til“
    "Geprüfte Headhunter suchen für Ihre Stelle, alle unter einem Rahmenvertrag.": "Kvalitetssikrede headhuntere søker etter kandidater til stillingen din, alle under én rammeavtale.",
    "Sie sehen jede Vorstellung und fragen ein Interview an.": "Du ser hver presentasjon og ber om et intervju.",
    "Sie machen das Angebot, und erst mit der Unterschrift fällt das Honorar an.": "Du gir tilbudet, og honoraret forfaller først når kontrakten er signert.",
    "Stelle kostenlos ausschreiben": "Lys ut stillingen gratis",

    "Ihre Anzeige": "Din annonse",
    "Leitung Konstruktion (m/w/d)": "Konstruksjonssjef",
    "Leitung Konstruktion": "Konstruksjonssjef",
    "K{n}": "K{n}",
    "Kandidat {n}": "Kandidat {n}",
    "für: {stelle}": "for: {stelle}",
    "Neu · heute": "Ny · i dag",
    "Interview anfragen": "Be om intervju",
    "Arbeitsvertrag": "Arbeidskontrakt",
    "Vertrag unterschrieben": "Kontrakten signert",

    "Link zur Anzeige": "Lenke til annonsen",
    "PDF oder Word": "PDF eller Word",
    "Anzeige einfügen": "Lim inn annonse",
    "Von Hand beschreiben": "Beskriv selv",
    "Leitung Controlling": "Controllersjef",
    "angelegt": "opprettet",
    "In Prüfung": "Til vurdering",
    "Noch sucht kein Headhunter": "Ingen headhunter søker ennå",
    "{n} Headhunter suchen": "{n} headhuntere søker",
    "{k} neu": "{k} nye",
    "Leiter Controlling": "Controllersjef",
    "Neu": "Ny",
    "Interview · Mi, 14:30": "Intervju · ons. kl. 14:30",
    "Angebot angenommen": "Tilbudet akseptert",
    "Besetzt": "Besatt",
  },
};

export default W;
