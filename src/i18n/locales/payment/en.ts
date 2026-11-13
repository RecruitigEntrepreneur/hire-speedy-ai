import type de from './de';
import type { Messages } from '../../types';

const en: Messages<typeof de> = {
  escrow: {
    pending: 'Pending',
    held: 'In escrow',
    released: 'Released',
    disputed: 'Disputed',
    refunded: 'Refunded',
  },
  request: {
    pending: 'Pending',
    approved: 'Approved',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Rejected',
  },
  releaseIn: 'Release in {{count}} days',
  releasePossible: 'Release possible',
  created: 'Payout request created',
  createFailed: 'The request could not be created',
  title: 'Payout',
  amount: 'Amount',
  requestedOn: 'Requested on {{date}}',
  creating: 'Creating...',
  requestPayout: 'Request payout',
  waitingClient: 'Waiting for the client\'s payment',
  escrowEnds: 'Escrow period ends on {{date}}',
  unavailable: 'Payout not available',
};
export default en;
