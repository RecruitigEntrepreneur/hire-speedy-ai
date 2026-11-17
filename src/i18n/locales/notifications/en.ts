import type de from './de';
import type { Messages } from '../../types';

const en: Messages<typeof de> = {
  title: 'Notifications',
  markAllRead: 'Mark all read',
  empty: 'No notifications',
  showAll: 'Show all',
  justNow: 'Just now',
  minutesAgo: '{{count}} min ago',
  hoursAgo: '{{count}} h ago',
  daysAgo: '{{count}} days ago',
  // Sprechblase oben neben der Glocke (Posteingang)
  inbox: 'Inbox',
  inboxWaiting: 'Inbox, {{count}} waiting for you',
  inboxWaitingClient: 'Inbox, {{count}} waiting for you',
  bundle: {
    searchStartedBy_one: '{{name}} is now searching for {{count}} position',
    searchStartedBy_other: '{{name}} is now searching for {{count}} positions',
    searchStarted_one: 'Headhunters are now searching for {{count}} position',
    searchStarted_other: 'Headhunters are now searching for {{count}} positions',
    pauseEnded_one: '{{count}} position is running again',
    pauseEnded_other: '{{count}} positions are running again',
    pauseEnding_one: 'The pause ends soon for {{count}} position',
    pauseEnding_other: 'The pause ends soon for {{count}} positions',
    expand: 'Show each',
    collapse: 'Collapse',
  },
};
export default en;
