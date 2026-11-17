import type de from './de';
import type { Messages } from '../../types';

const sv: Messages<typeof de> = {
  language: {
    label: 'Språk',
    settingsHintClient: 'Gäller gränssnittet och e-post till dig. Tjänster, kandidatprofiler och avtal behåller sitt eget språk.',
    settingsHintRecruiter: 'Gäller gränssnittet och e-post till dig. Tjänster, kandidatprofiler och avtal behåller sitt eget språk.',
  },
  search: {
    cPh: 'Tjänst, kandidat eller referens …',
    cHint: 'Sök på tjänst, ort, kandidat, roll eller referens.',
    cApplicants: 'Kandidater',
    forJob: 'för {{job}}',
    running_one: '{{count}} aktiv kandidat',
    running_other: '{{count}} aktiva kandidater',
    jobState: { published: 'aktiv', paused: 'pausad', pending_approval: 'granskas', draft: 'utkast', filled: 'tillsatt', closed: 'stängd', cancelled: 'stängd' },
    hhPh: 'Namn, telefonnummer, e-post eller tjänst …',
    hhHint: 'Sök på namn, telefonnummer, e-post eller tjänst.',
    myCandidates: 'Mina kandidater',
    jobs: 'Tjänster',
    call: 'Ring {{name}}',
    none: 'Inget hittades för ”{{q}}”.',
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
  mobileNav: {
    label: 'Huvudmeny',
    more: 'Meny',
    feedback: 'Ge feedback',
    light: 'Ljust',
    dark: 'Mörkt',
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
