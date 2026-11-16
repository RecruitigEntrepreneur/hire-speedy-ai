import type de from './de';
import type { Messages } from '../../types';

const sv: Messages<typeof de> = {
  title: 'Aviseringar',
  markAllRead: 'Markera alla som lästa',
  empty: 'Inga aviseringar',
  showAll: 'Visa alla',
  justNow: 'Nyss',
  minutesAgo: 'för {{count}} min sedan',
  hoursAgo: 'för {{count}} tim sedan',
  daysAgo: 'för {{count}} dagar sedan',
  // Sprechblase oben neben der Glocke (Posteingang)
  inbox: 'Inkorg',
  inboxWaiting: 'Inkorg, {{count}} väntar på dig',
  inboxWaitingClient: 'Inkorg, {{count}} väntar på dig',
};
export default sv;
