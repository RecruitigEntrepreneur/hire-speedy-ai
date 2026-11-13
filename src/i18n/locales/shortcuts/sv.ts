import type de from './de';
import type { Messages } from '../../types';

const sv: Messages<typeof de> = {
  title: 'Kortkommandon',
  category: { navigation: 'Navigering', actions: 'Åtgärder', list: 'Listor' },
  then: 'sedan',
  or: 'eller',
  general: 'Allmänt',
  openSearch: 'Öppna sökning',
  closeDialog: 'Stäng dialogrutan',
  listDown: 'Lista: nedåt',
  listUp: 'Lista: uppåt',
  openSelection: 'Öppna markerad',
  pressBefore: 'Tryck på',
  pressAfter: 'för att öppna den här menyn när som helst',
  item: { dashboard: 'Översikt', jobs: 'Uppdrag', talent: 'Talent Hub', interviews: 'Intervjuer', messages: 'Meddelanden', settings: 'Inställningar', newJob: 'Nytt uppdrag', help: 'Visa kortkommandon' },
};
export default sv;
