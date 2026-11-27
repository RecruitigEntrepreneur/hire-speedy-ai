// Sektion 80 „Häufige Fragen“ (matchunt/s80-fragen): Überschrift, Unterzeile, sieben Fragen mit Antworten.
// Antworten nur sinngemäß aus dem Faktenblatt, keine neuen Zusagen. Die vier Schritte in der Antwort zum Ablauf wie in
// klammer.ts. „Grundpaket“ und „Zielgehalt“ wie in preis.ts (basic package / baspaket / grunnpakke; target salary /
// årslön / årslønn), „anfallen“ wie in karriere.ts (due / faller ut / forfaller). „Gespräch“ im Englischen
// „conversation“.
// Prozent: Englisch „20%“, Schwedisch und Norwegisch „20 %“ mit festem Leerzeichen (\u00A0) wie im Deutschen.
// Schwedisch und Norwegisch sind nicht muttersprachlich gegengelesen.
import type { Woerterbuch } from "./typ";

const W: Woerterbuch = {
  en: {
    "Häufige Fragen.": "Frequently asked questions.",
    "Zu Kosten, Rahmenvertrag und Ablauf.": "On costs, the framework agreement and the process.",
    "Was kostet es?": "What does it cost?",
    "Das Honorar ist erfolgsbasiert. Im Matchunt Grundpaket sind es 20\u00A0% vom Zielgehalt.":
      "The fee is success-based. In the Matchunt basic package, it is 20% of the target salary.",
    "Wann fällt das Honorar an?": "When is the fee due?",
    "Erst bei einer Einstellung. Während der Suche fällt kein Honorar an.":
      "Only when you make a hire. No fee is due during the search.",
    "Brauche ich mit jedem Headhunter einen eigenen Rahmenvertrag?":
      "Do I need a separate framework agreement with each headhunter?",
    "Nein. Sie unterschreiben einen Rahmenvertrag. Er gilt für alle Headhunter.":
      "No. You sign one framework agreement. It applies to all headhunters.",
    "Wie fange ich an?": "How do I get started?",
    "Sie beschreiben Ihre Stelle. Für den Anfang genügt es, Ihre Anzeige einzufügen.":
      "You describe your position. To get started, pasting your job ad is enough.",
    "Wie läuft es ab?": "How does it work?",
    "In vier Schritten: Stelle beschreiben, Headhunter suchen, Kandidaten kennenlernen, Einstellen.":
      "In four steps: describe the position, headhunters search, meet candidates, hire.",
    "Was sehe ich von einer Kandidatin oder einem Kandidaten?": "What do I see about a candidate?",
    "Die Eckdaten, die Notizen aus dem Gespräch und eine Einschätzung zur Stelle.":
      "The key facts, the notes from the conversation and an assessment of fit for the position.",
    "Hat der Headhunter mit der Person gesprochen?": "Has the headhunter spoken with the person?",
    "Ja. Jede Vorstellung kommt nach einem Gespräch des Headhunters mit der Person.":
      "Yes. Every introduction follows a conversation between the headhunter and the person.",
  },
  sv: {
    "Häufige Fragen.": "Vanliga frågor.",
    "Zu Kosten, Rahmenvertrag und Ablauf.": "Om kostnader, ramavtalet och processen.",
    "Was kostet es?": "Vad kostar det?",
    "Das Honorar ist erfolgsbasiert. Im Matchunt Grundpaket sind es 20\u00A0% vom Zielgehalt.":
      "Arvodet är resultatbaserat. I Matchunts baspaket är det 20\u00A0% av årslönen.",
    "Wann fällt das Honorar an?": "När faller arvodet ut?",
    "Erst bei einer Einstellung. Während der Suche fällt kein Honorar an.":
      "Först vid en anställning. Under sökningen faller inget arvode ut.",
    "Brauche ich mit jedem Headhunter einen eigenen Rahmenvertrag?":
      "Behöver jag ett eget ramavtal med varje headhunter?",
    "Nein. Sie unterschreiben einen Rahmenvertrag. Er gilt für alle Headhunter.":
      "Nej. Du skriver under ett enda ramavtal. Det gäller för alla headhunters.",
    "Wie fange ich an?": "Hur kommer jag igång?",
    "Sie beschreiben Ihre Stelle. Für den Anfang genügt es, Ihre Anzeige einzufügen.":
      "Du beskriver din tjänst. Till att börja med räcker det att klistra in din annons.",
    "Wie läuft es ab?": "Hur går det till?",
    "In vier Schritten: Stelle beschreiben, Headhunter suchen, Kandidaten kennenlernen, Einstellen.":
      "I fyra steg: beskriv tjänsten, headhunters söker, träffa kandidater, anställ.",
    "Was sehe ich von einer Kandidatin oder einem Kandidaten?": "Vad ser jag om en kandidat?",
    "Die Eckdaten, die Notizen aus dem Gespräch und eine Einschätzung zur Stelle.":
      "Nyckeldata, anteckningarna från samtalet och en bedömning i förhållande till tjänsten.",
    "Hat der Headhunter mit der Person gesprochen?": "Har headhuntern pratat med personen?",
    "Ja. Jede Vorstellung kommt nach einem Gespräch des Headhunters mit der Person.":
      "Ja. Varje presentation kommer efter ett samtal mellan headhuntern och personen.",
  },
  nb: {
    "Häufige Fragen.": "Vanlige spørsmål.",
    "Zu Kosten, Rahmenvertrag und Ablauf.": "Om kostnader, rammeavtalen og prosessen.",
    "Was kostet es?": "Hva koster det?",
    "Das Honorar ist erfolgsbasiert. Im Matchunt Grundpaket sind es 20\u00A0% vom Zielgehalt.":
      "Honoraret er resultatbasert. I Matchunts grunnpakke er det 20\u00A0% av årslønnen.",
    "Wann fällt das Honorar an?": "Når forfaller honoraret?",
    "Erst bei einer Einstellung. Während der Suche fällt kein Honorar an.":
      "Først ved en ansettelse. Mens søket pågår, forfaller det ikke noe honorar.",
    "Brauche ich mit jedem Headhunter einen eigenen Rahmenvertrag?":
      "Trenger jeg en egen rammeavtale med hver headhunter?",
    "Nein. Sie unterschreiben einen Rahmenvertrag. Er gilt für alle Headhunter.":
      "Nei. Du signerer én rammeavtale. Den gjelder for alle headhuntere.",
    "Wie fange ich an?": "Hvordan kommer jeg i gang?",
    "Sie beschreiben Ihre Stelle. Für den Anfang genügt es, Ihre Anzeige einzufügen.":
      "Du beskriver stillingen din. Til å begynne med holder det å lime inn annonsen din.",
    "Wie läuft es ab?": "Hvordan foregår det?",
    "In vier Schritten: Stelle beschreiben, Headhunter suchen, Kandidaten kennenlernen, Einstellen.":
      "I fire trinn: beskriv stillingen, headhuntere søker, møt kandidater, ansett.",
    "Was sehe ich von einer Kandidatin oder einem Kandidaten?": "Hva ser jeg om en kandidat?",
    "Die Eckdaten, die Notizen aus dem Gespräch und eine Einschätzung zur Stelle.":
      "Nøkkeldata, notatene fra samtalen og en vurdering opp mot stillingen.",
    "Hat der Headhunter mit der Person gesprochen?": "Har headhunteren snakket med personen?",
    "Ja. Jede Vorstellung kommt nach einem Gespräch des Headhunters mit der Person.":
      "Ja. Hver presentasjon kommer etter en samtale mellom headhunteren og personen.",
  },
};

export default W;
