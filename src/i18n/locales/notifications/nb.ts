import type de from './de';
import type { Messages } from '../../types';

const nb: Messages<typeof de> = {
  title: 'Varsler',
  markAllRead: 'Merk alle som lest',
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
};
export default nb;
