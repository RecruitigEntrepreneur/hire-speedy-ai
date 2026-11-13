import type de from './de';
import type { Messages } from '../../types';

const nb: Messages<typeof de> = {
  matchCalc: 'Beregningen mislyktes',
  fitCredit: 'AI-kredittgrensen er nådd. Kontakt brukerstøtte.',
  fitRate: 'For mange forespørsler. Vent litt.',
  fitCreated: 'Matchanalyse opprettet',
  fitCreatedText: 'Matchanalysen er generert.',
  fitUnknown: 'Ukjent feil under genereringen',
  fitFailed: 'Analysen mislyktes',
  generic: 'Noe gikk galt',
  activities: 'Aktivitetene kunne ikke lastes',
  notSignedIn: 'Ikke innlogget',
  saveFailed: 'Lagring mislyktes',
  feedbackSaved: 'Tilbakemelding lagret',
  feedbackFailed: 'Tilbakemeldingen kunne ikke lagres',
  sendFailed: 'Sending mislyktes.',
  notDeployed: 'Kan ikke sende: funksjonen «{{fn}}» er ikke publisert ennå.',
  docxInvalid: 'Filen er ikke en gyldig Word-fil.',
  docxBroken: 'Word-filen er skadet.',
  docxEmpty: 'Word-filen inneholder ingen tekst.',
  docxBrowser: 'Nettleseren din kan ikke åpne Word-filer. Bruk PDF eller tekst.',
  score: {
    excellent: 'Utmerket',
    veryGood: 'Svært god',
    good: 'God',
    satisfactory: 'Tilfredsstillende',
    sufficient: 'Tilstrekkelig',
    low: 'Lav',
  },
  multiplier: {
    none: 'Ingen begrensninger',
    light: 'Små begrensninger',
    clear: 'Tydelige begrensninger',
    severe: 'Alvorlige begrensninger',
  },
  coverage: {
    complete: 'Fullstendig',
    sufficient: 'Tilstrekkelig',
    partial: 'Delvis',
    insufficient: 'Utilstrekkelig',
  },
};
export default nb;
