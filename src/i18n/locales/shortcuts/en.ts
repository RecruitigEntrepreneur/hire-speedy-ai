import type de from './de';
import type { Messages } from '../../types';

const en: Messages<typeof de> = {
  title: 'Keyboard shortcuts',
  category: { navigation: 'Navigation', actions: 'Actions', list: 'Lists' },
  then: 'then',
  or: 'or',
  general: 'General',
  openSearch: 'Open search',
  closeDialog: 'Close dialog',
  listDown: 'List: down',
  listUp: 'List: up',
  openSelection: 'Open selection',
  pressBefore: 'Press',
  pressAfter: 'to open this menu at any time',
  item: { dashboard: 'Dashboard', jobs: 'Jobs', talent: 'Talent Hub', interviews: 'Interviews', messages: 'Messages', settings: 'Settings', newJob: 'New job', help: 'Show shortcuts' },
};
export default en;
