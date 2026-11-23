import type de from './de';
import type { Messages } from '../../types';

const nb: Messages<typeof de> = {
  title: 'Varsler',
  markAllRead: 'Merk alle som lest',
  newCount: '{{count}} nye',
  group: { today: 'I dag', week: 'Siste 7 dager', earlier: 'Tidligere' },
  empty: 'Ingen varsler',
  showAll: 'Vis alle',
  justNow: 'Akkurat nå',
  minutesAgo: 'for {{count}} min siden',
  hoursAgo: 'for {{count}} t siden',
  daysAgo: 'for {{count}} dager siden',
  // Sprechblase oben neben der Glocke (Posteingang)
  inbox: 'Innboks',
  inboxWaiting: 'Innboks, {{count}} venter på deg',
  inboxWaitingClient: 'Innboks, {{count}} venter på deg',
  bundle: {
    searchStartedBy_one: '{{name}} søker nå for {{count}} stilling',
    searchStartedBy_other: '{{name}} søker nå for {{count}} stillinger',
    searchStarted_one: 'Headhuntere søker nå for {{count}} stilling',
    searchStarted_other: 'Headhuntere søker nå for {{count}} stillinger',
    pauseEnded_one: '{{count}} stilling er i gang igjen',
    pauseEnded_other: '{{count}} stillinger er i gang igjen',
    pauseEnding_one: 'Pausen slutter snart for {{count}} stilling',
    pauseEnding_other: 'Pausen slutter snart for {{count}} stillinger',
    expand: 'Vis hver for seg',
    collapse: 'Fell sammen',
  },
};
export default nb;
