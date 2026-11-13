import type de from './de';
import type { Messages } from '../../types';

const en: Messages<typeof de> = {
  language: {
    label: 'Language',
    settingsHintClient: 'Applies to the interface and to emails we send you. Positions, candidate profiles and contracts stay in their own language.',
    settingsHintRecruiter: 'Applies to the interface and to emails we send you. Positions, candidate profiles and contracts stay in their own language.',
  },
  search: {
    open: 'Search...',
    ph: 'Search jobs, candidates or actions...',
    loading: 'Searching...',
    empty: 'No results found.',
    results: 'Search results',
    quick: 'Quick actions',
    newJob: 'Create new job',
    allJobs: 'All jobs',
    applicants: 'Applicants',
    interviews: 'Interviews',
    analytics: 'Analytics',
    settings: 'Settings',
  },
  candidateHero: {
    at: ' at {{company}}',
    years: '{{count}} yrs experience',
  },
  ui: {
    close: 'Close',
  },
  publicShell: {
    privacy: 'Privacy',
    imprint: 'Legal notice',
    germanTime: 'German time ({{zones}})',
    yourHeadhunter: '{{name}} · your headhunter',
    questions: 'Questions? I’m here to help',
    call: 'Call {{name}}: {{phone}}',
    mail: 'Email {{name}}',
    email: 'Email',
    cet: 'CET',
    cest: 'CEST',
  },
};
export default en;
