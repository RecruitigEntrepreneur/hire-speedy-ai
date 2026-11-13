import type de from './de';
import type { Messages } from '../../types';

const sv: Messages<typeof de> = {
  language: {
    label: 'Språk',
    settingsHintClient: 'Gäller gränssnittet och e-post till dig. Tjänster, kandidatprofiler och avtal behåller sitt eget språk.',
    settingsHintRecruiter: 'Gäller gränssnittet och e-post till dig. Tjänster, kandidatprofiler och avtal behåller sitt eget språk.',
  },
  search: {
    open: 'Sök...',
    ph: 'Sök uppdrag, kandidater eller åtgärder...',
    loading: 'Söker...',
    empty: 'Inga resultat hittades.',
    results: 'Sökresultat',
    quick: 'Snabbåtgärder',
    newJob: 'Skapa nytt uppdrag',
    allJobs: 'Alla uppdrag',
    applicants: 'Sökande',
    interviews: 'Intervjuer',
    analytics: 'Analys',
    settings: 'Inställningar',
  },
  candidateHero: {
    at: ' på {{company}}',
    years: '{{count}} års erfarenhet',
  },
  ui: {
    close: 'Stäng',
  },
  publicShell: {
    privacy: 'Integritetspolicy',
    imprint: 'Företagsuppgifter',
    germanTime: 'tysk tid ({{zones}})',
    yourHeadhunter: '{{name}} · din headhunter',
    questions: 'Frågor? Hör gärna av dig',
    call: 'Ring {{name}}: {{phone}}',
    mail: 'Mejla {{name}}',
    email: 'E-post',
    cet: 'CET',
    cest: 'CEST',
  },
};
export default sv;
