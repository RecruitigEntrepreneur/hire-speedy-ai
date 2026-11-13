import type de from './de';
import type { Messages } from '../../types';

const nb: Messages<typeof de> = {
  language: {
    label: 'Språk',
    settingsHintClient: 'Gjelder grensesnittet og e-post til deg. Stillinger, kandidatprofiler og avtaler beholder sitt eget språk.',
    settingsHintRecruiter: 'Gjelder grensesnittet og e-post til deg. Stillinger, kandidatprofiler og avtaler beholder sitt eget språk.',
  },
  search: {
    open: 'Søk...',
    ph: 'Søk i oppdrag, kandidater eller handlinger...',
    loading: 'Søker...',
    empty: 'Ingen treff.',
    results: 'Søkeresultater',
    quick: 'Hurtighandlinger',
    newJob: 'Opprett nytt oppdrag',
    allJobs: 'Alle oppdrag',
    applicants: 'Søkere',
    interviews: 'Intervjuer',
    analytics: 'Analyse',
    settings: 'Innstillinger',
  },
  candidateHero: {
    at: ' hos {{company}}',
    years: '{{count}} års erfaring',
  },
  ui: {
    close: 'Lukk',
  },
  publicShell: {
    privacy: 'Personvern',
    imprint: 'Om selskapet',
    germanTime: 'tysk tid ({{zones}})',
    yourHeadhunter: '{{name}} · din headhunter',
    questions: 'Spørsmål? Ta gjerne kontakt',
    call: 'Ring {{name}}: {{phone}}',
    mail: 'Send e-post til {{name}}',
    email: 'E-post',
    cet: 'CET',
    cest: 'CEST',
  },
};
export default nb;
