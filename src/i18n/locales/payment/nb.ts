import type de from './de';
import type { Messages } from '../../types';

const nb: Messages<typeof de> = {
  escrow: {
    pending: 'Venter',
    held: 'I escrow',
    released: 'Frigitt',
    disputed: 'Tvist',
    refunded: 'Refundert',
  },
  request: {
    pending: 'Venter',
    approved: 'Godkjent',
    processing: 'Behandles',
    completed: 'Fullført',
    failed: 'Mislyktes',
    cancelled: 'Avslått',
  },
  releaseIn: 'Frigis om {{count}} dager',
  releasePossible: 'Kan frigis',
  created: 'Utbetalingsforespørsel opprettet',
  createFailed: 'Forespørselen kunne ikke opprettes',
  title: 'Utbetaling',
  amount: 'Beløp',
  requestedOn: 'Forespurt {{date}}',
  creating: 'Opprettes...',
  requestPayout: 'Be om utbetaling',
  waitingClient: 'Venter på kundens betaling',
  escrowEnds: 'Escrow-perioden slutter {{date}}',
  unavailable: 'Utbetaling ikke tilgjengelig',
};
export default nb;
