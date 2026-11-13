import type de from './de';
import type { Messages } from '../../types';

const sv: Messages<typeof de> = {
  escrow: {
    pending: 'Väntande',
    held: 'I escrow',
    released: 'Frigiven',
    disputed: 'Tvist',
    refunded: 'Återbetald',
  },
  request: {
    pending: 'Väntande',
    approved: 'Godkänd',
    processing: 'Behandlas',
    completed: 'Slutförd',
    failed: 'Misslyckades',
    cancelled: 'Avslagen',
  },
  releaseIn: 'Frigörs om {{count}} dagar',
  releasePossible: 'Kan frigöras',
  created: 'Begäran om utbetalning skapad',
  createFailed: 'Begäran kunde inte skapas',
  title: 'Utbetalning',
  amount: 'Belopp',
  requestedOn: 'Begärd den {{date}}',
  creating: 'Skapas...',
  requestPayout: 'Begär utbetalning',
  waitingClient: 'Väntar på kundens betalning',
  escrowEnds: 'Escrow-perioden slutar den {{date}}',
  unavailable: 'Utbetalning inte tillgänglig',
};
export default sv;
