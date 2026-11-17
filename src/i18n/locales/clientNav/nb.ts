import type de from './de';
import type { Messages } from '../../types';

const nb: Messages<typeof de> = {
  items: {
    dashboard: 'Oversikt',
    tasks: 'Oppgaver',
    jobs: 'Mine stillinger',
    candidates: 'Kandidater',
    interviews: 'Intervjuer',
    placements: 'Ansettelser',
    invoices: 'Fakturaer',
    analytics: 'Analyse',
    team: 'Team',
    messages: 'Meldinger',
  },
  short: {
    dashboard: 'Oversikt',
    jobs: 'Stillinger',
  },
  settings: 'Innstillinger',
  signOut: 'Logg ut',
  theme: 'Tema',
};
export default nb;
