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
};
export default en;
