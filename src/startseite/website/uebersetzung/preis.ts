// Sektion 15.4 „Preis“ (matchunt/s15-3-preis/PreisGeschwaerzt.tsx, über s15-4-preis): „Über Geld spricht man nicht.
// Wir schon: 20 % Honorar.“, Sätze links, Quelle, Knopf, Säulen mit Zahl, Name, „wer sucht“ und dem Wort in der
// blauen Säule.   = geschütztes Leerzeichen (im Code &nbsp;), ­ = weiches Trennzeichen (Trennstelle in
// den schmalen Säulen). „{n} %“ (die hochzählende Zahl) und „BDU“ bleiben in Schwedisch und Norwegisch wie im
// Deutschen und sind dort nicht eingetragen. „Stelle beschreiben“ wie in klammer.ts.
// Schwedisch und Norwegisch sind nicht muttersprachlich gegengelesen.
import type { Woerterbuch } from "./typ";

const W: Woerterbuch = {
  en: {
    // Überschrift
    "Über Geld spricht man nicht.": "Nobody talks about money.",
    "Wir schon: 20 % Honorar.": "We do: a 20% fee.",
    // Sätze links, Quelle, Knopf
    "Honorar erfolgsbasiert: fällig erst bei Einstellung.": "Success-based fee: due only on hire.",
    "Honorar als Anteil am Zielgehalt, fällig erst bei Einstellung.": "Fee as a share of the target salary, due only on hire.",
    "Ein Rahmenvertrag für alle Headhunter.": "One framework agreement for all headhunters.",
    "Quelle für 27 % und 24 %: BDU, Studie Personalberatung 2023.": "Source for 27% and 24%: BDU, recruitment consultancy study 2023.",
    "Stelle beschreiben": "Describe the position",
    // Säulen
    "{n} %": "{n}%",
    "erfolgs­basiert": "success-based",
    "Personal­beratung im Schnitt": "Recruit­ment consul­tancies on average",
    "kleine Beratungen": "Small consul­tancies",
    "Matchunt, Grundpaket": "Matchunt, basic package",
    "eine Beratung sucht": "one consultancy searches",
    "alle Headhunter suchen": "all headhunters search",
  },
  sv: {
    "Über Geld spricht man nicht.": "Man pratar inte om pengar.",
    "Wir schon: 20 % Honorar.": "Det gör vi: 20 % i arvode.",
    "Honorar erfolgsbasiert: fällig erst bei Einstellung.": "Resultatbaserat arvode: betalas först vid anställning.",
    "Honorar als Anteil am Zielgehalt, fällig erst bei Einstellung.": "Arvode som andel av årslönen, betalas först vid anställning.",
    "Ein Rahmenvertrag für alle Headhunter.": "Ett ramavtal för alla headhunters.",
    "Quelle für 27 % und 24 %: BDU, Studie Personalberatung 2023.": "Källa till 27 % och 24 %: BDU, studie om rekryteringsbyråer 2023.",
    "Stelle beschreiben": "Beskriv tjänsten",
    "erfolgs­basiert": "resultat­baserat",
    "Personal­beratung im Schnitt": "Rekryterings­byråer i snitt",
    "kleine Beratungen": "Små byråer",
    "Matchunt, Grundpaket": "Matchunt, baspaket",
    "eine Beratung sucht": "en byrå söker",
    "alle Headhunter suchen": "alla headhunters söker",
  },
  nb: {
    "Über Geld spricht man nicht.": "Man snakker ikke om penger.",
    "Wir schon: 20 % Honorar.": "Det gjør vi: 20 % i honorar.",
    "Honorar erfolgsbasiert: fällig erst bei Einstellung.": "Resultatbasert honorar: forfaller først ved ansettelse.",
    "Honorar als Anteil am Zielgehalt, fällig erst bei Einstellung.": "Honorar som andel av årslønnen, forfaller først ved ansettelse.",
    "Ein Rahmenvertrag für alle Headhunter.": "Én rammeavtale for alle headhuntere.",
    "Quelle für 27 % und 24 %: BDU, Studie Personalberatung 2023.": "Kilde for 27 % og 24 %: BDU, studie om rekrutteringsbyråer 2023.",
    "Stelle beschreiben": "Beskriv stillingen",
    "erfolgs­basiert": "resultat­basert",
    "Personal­beratung im Schnitt": "Rekrutterings­byråer i snitt",
    "kleine Beratungen": "Små byråer",
    "Matchunt, Grundpaket": "Matchunt, grunnpakke",
    "eine Beratung sucht": "ett byrå søker",
    "alle Headhunter suchen": "alle headhuntere søker",
  },
};

export default W;
