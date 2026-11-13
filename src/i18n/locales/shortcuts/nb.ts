import type de from './de';
import type { Messages } from '../../types';

const nb: Messages<typeof de> = {
  title: 'Hurtigtaster',
  category: { navigation: 'Navigasjon', actions: 'Handlinger', list: 'Lister' },
  then: 'deretter',
  or: 'eller',
  general: 'Generelt',
  openSearch: 'Åpne søk',
  closeDialog: 'Lukk dialogen',
  listDown: 'Liste: ned',
  listUp: 'Liste: opp',
  openSelection: 'Åpne valgt',
  pressBefore: 'Trykk',
  pressAfter: 'for å åpne denne menyen når som helst',
  item: { dashboard: 'Oversikt', jobs: 'Oppdrag', talent: 'Talent Hub', interviews: 'Intervjuer', messages: 'Meldinger', settings: 'Innstillinger', newJob: 'Nytt oppdrag', help: 'Vis hurtigtaster' },
};
export default nb;
