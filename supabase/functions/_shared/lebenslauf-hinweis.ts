/**
 * Texte zum Hochladen eines Lebenslaufs (12.11.2026), ohne Abhängigkeiten: Die Mail
 * (termin-mails.ts) und das Fenster in der App (Vorschau, Mustertext) nutzen dieselben Sätze.
 * Mehrsprachig seit 16.11.2026: Der Kandidat bekommt die Sprache seines Headhunters.
 */

export type HinweisSprache = 'de' | 'en' | 'sv' | 'nb';

export interface HinweisTexte {
  /** Die drei Zusagen an den Kandidaten, in Mail und Vorschau gleich. */
  punkte: readonly string[];
  betreff: (hhName: string) => string;
  einleitung: (hhName: string) => string;
  /** Zum Selbstverschicken, wenn der Headhunter es dem Kandidaten selbst sagt oder keine E-Mail im Lebenslauf steht. */
  muster: string;
  hallo: (vorname: string) => string;
  halloOhneName: string;
  ueberschrift: string;
  wasHeisst: string;
  fragen: string;
  nichtGewollt: string;
  loeschen: string;
  datenschutz: string;
}

const TEXTE: Record<HinweisSprache, HinweisTexte> = {
  de: {
    punkte: [
      'Ohne deine Zustimmung wirst du keinem Unternehmen vorgeschlagen.',
      'Ein Vorschlag geht zuerst ohne Namen, Kontaktdaten und Arbeitgeber raus.',
      'Möchte ein Unternehmen dich kennenlernen, fragen wir dich vorher.',
    ],
    betreff: (hh) => `${hh} hat deinen Lebenslauf bei Matchunt hinterlegt`,
    einleitung: (hh) => `${hh} hat deinen Lebenslauf heute bei Matchunt hinterlegt. Matchunt ist die Plattform, über die ${hh} mit Unternehmen arbeitet.`,
    muster: 'Kurz zur Info: Deinen Lebenslauf habe ich bei Matchunt hinterlegt, darüber arbeite ich mit Unternehmen. '
      + 'Vorgeschlagen wirst du nur, wenn du zustimmst, und zuerst ohne Namen. '
      + 'Was mit deinen Daten passiert: matchunt.ai/datenschutz',
    hallo: (v) => `Hallo ${v},`,
    halloOhneName: 'Hallo,',
    ueberschrift: 'Dein Lebenslauf bei Matchunt',
    wasHeisst: 'Was das für dich heißt:',
    fragen: 'Fragen? Antworte einfach auf diese Mail.',
    nichtGewollt: 'Möchtest du das nicht?',
    loeschen: 'Lebenslauf löschen lassen',
    datenschutz: 'Datenschutz-Info',
  },
  en: {
    punkte: [
      'You will not be proposed to any company without your consent.',
      'A proposal first goes out without your name, contact details or employer.',
      'If a company would like to meet you, we ask you first.',
    ],
    betreff: (hh) => `${hh} has added your CV to Matchunt`,
    einleitung: (hh) => `${hh} added your CV to Matchunt today. Matchunt is the platform ${hh} uses to work with companies.`,
    muster: 'Quick note: I have added your CV to Matchunt, the platform I use to work with companies. '
      + 'You will only be proposed if you agree, and first without your name. '
      + 'What happens to your data: matchunt.ai/datenschutz',
    hallo: (v) => `Hi ${v},`,
    halloOhneName: 'Hi,',
    ueberschrift: 'Your CV on Matchunt',
    wasHeisst: 'What this means for you:',
    fragen: 'Questions? Just reply to this email.',
    nichtGewollt: 'Don’t want this?',
    loeschen: 'Have your CV deleted',
    datenschutz: 'Privacy information',
  },
  sv: {
    punkte: [
      'Du föreslås inte för något företag utan ditt samtycke.',
      'Ett förslag skickas först utan namn, kontaktuppgifter och arbetsgivare.',
      'Om ett företag vill träffa dig frågar vi dig först.',
    ],
    betreff: (hh) => `${hh} har lagt in ditt CV hos Matchunt`,
    einleitung: (hh) => `${hh} lade in ditt CV hos Matchunt i dag. Matchunt är plattformen som ${hh} använder för att arbeta med företag.`,
    muster: 'Kort info: Jag har lagt in ditt CV hos Matchunt, plattformen jag använder för att arbeta med företag. '
      + 'Du föreslås bara om du samtycker, och först utan namn. '
      + 'Vad som händer med dina uppgifter: matchunt.ai/datenschutz',
    hallo: (v) => `Hej ${v},`,
    halloOhneName: 'Hej,',
    ueberschrift: 'Ditt CV hos Matchunt',
    wasHeisst: 'Vad det betyder för dig:',
    fragen: 'Frågor? Svara bara på det här mejlet.',
    nichtGewollt: 'Vill du inte det?',
    loeschen: 'Låt radera ditt CV',
    datenschutz: 'Information om dataskydd',
  },
  nb: {
    punkte: [
      'Du blir ikke foreslått for noen bedrift uten ditt samtykke.',
      'Et forslag sendes først uten navn, kontaktopplysninger og arbeidsgiver.',
      'Hvis en bedrift vil møte deg, spør vi deg først.',
    ],
    betreff: (hh) => `${hh} har lagt inn CV-en din hos Matchunt`,
    einleitung: (hh) => `${hh} la inn CV-en din hos Matchunt i dag. Matchunt er plattformen ${hh} bruker for å jobbe med bedrifter.`,
    muster: 'Kort info: Jeg har lagt inn CV-en din hos Matchunt, plattformen jeg bruker for å jobbe med bedrifter. '
      + 'Du blir bare foreslått hvis du samtykker, og først uten navn. '
      + 'Hva som skjer med opplysningene dine: matchunt.ai/datenschutz',
    hallo: (v) => `Hei ${v},`,
    halloOhneName: 'Hei,',
    ueberschrift: 'CV-en din hos Matchunt',
    wasHeisst: 'Hva det betyr for deg:',
    fragen: 'Spørsmål? Bare svar på denne e-posten.',
    nichtGewollt: 'Vil du ikke det?',
    loeschen: 'Få CV-en slettet',
    datenschutz: 'Personverninformasjon',
  },
};

/** Texte in der Sprache des Kandidaten; de-AT, de-CH lesen Deutsch, Unbekanntes Deutsch. */
export function hinweisTexte(lang?: string | null): HinweisTexte {
  const basis = String(lang ?? 'de').slice(0, 2).toLowerCase();
  return basis in TEXTE ? TEXTE[basis as HinweisSprache] : TEXTE.de;
}
