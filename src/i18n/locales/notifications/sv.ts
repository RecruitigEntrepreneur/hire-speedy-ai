import type de from './de';
import type { Messages } from '../../types';

const sv: Messages<typeof de> = {
  title: 'Aviseringar',
  markAllRead: 'Markera alla som lästa',
  newCount: '{{count}} nya',
  group: { today: 'I dag', week: 'Senaste 7 dagarna', earlier: 'Tidigare' },
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
  bundle: {
    searchStartedBy_one: '{{name}} söker nu för {{count}} tjänst',
    searchStartedBy_other: '{{name}} söker nu för {{count}} tjänster',
    searchStarted_one: 'Headhunters söker nu för {{count}} tjänst',
    searchStarted_other: 'Headhunters söker nu för {{count}} tjänster',
    pauseEnded_one: '{{count}} tjänst är igång igen',
    pauseEnded_other: '{{count}} tjänster är igång igen',
    pauseEnding_one: 'Pausen slutar snart för {{count}} tjänst',
    pauseEnding_other: 'Pausen slutar snart för {{count}} tjänster',
    expand: 'Visa var för sig',
    collapse: 'Fäll ihop',
  },
};
export default sv;
