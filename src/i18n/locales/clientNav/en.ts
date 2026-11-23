import type de from './de';
import type { Messages } from '../../types';

const en: Messages<typeof de> = {
  items: {
    dashboard: 'Dashboard',
    tasks: 'Tasks',
    jobs: 'My positions',
    candidates: 'Candidates',
    interviews: 'Interviews',
    placements: 'Placements',
    invoices: 'Invoices',
    analytics: 'Analytics',
    team: 'Team',
    messages: 'Messages',
  },
  short: {
    dashboard: 'Dashboard',
    jobs: 'Positions',
  },
  settings: 'Settings',
  signOut: 'Sign out',
  theme: 'Theme',
};
export default en;
