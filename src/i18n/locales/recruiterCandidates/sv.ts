import type de from './de';
import type { Messages } from '../../types';

const sv: Messages<typeof de> = {
  list: {
    title: 'Mina kandidater',
    subtitle: 'Hantera din kandidatdatabas',
    manageTags: 'Hantera taggar',
    updated: 'Kandidaten har uppdaterats',
    added: 'Kandidaten har lagts till',
    saveFailed: 'Det gick inte att spara',
    confirmDelete: 'Vill du verkligen ta bort den här kandidaten?',
    deleteFailed: 'Det gick inte att ta bort',
    deleted: 'Kandidaten har tagits bort',
    csvHeader: 'Namn,E-post,Telefon,Erfarenhet,Lön,Kompetenser',
    csvFile: 'kandidater.csv',
    exported_one: '{{count}} kandidat exporterad',
    exported_other: '{{count}} kandidater exporterade',
    confirmBulkDelete_one: 'Vill du verkligen ta bort {{count}} kandidat?',
    confirmBulkDelete_other: 'Vill du verkligen ta bort {{count}} kandidater?',
    bulkDeleted_one: '{{count}} kandidat borttagen',
    bulkDeleted_other: '{{count}} kandidater borttagna',
    tagAssigned: 'Taggen har lagts till',
    tagRemoved: 'Taggen har tagits bort',
    emptyTitle: 'Inga kandidater ännu',
    emptyText: 'Lägg helst upp din första med ett CV. Utan CV kan du inte presentera kandidaten senare.',
    noneFound: 'Inga kandidater hittades',
    poolFeature: 'Funktionen talangpool',
    imported: 'Kandidaterna har importerats',
    createdFromCv: 'Kandidaten har skapats från CV:t',
  },
  detail: {
    status: {
      new: 'Ny',
      contacted: 'Kontaktad',
      interview: 'Intervju',
      offer: 'Erbjudande',
      placed: 'Tillsatt',
      rejected: 'Avböjd',
    },
    notFound: 'Kandidaten hittades inte',
    activityAdded: 'Aktiviteten har lagts till',
    backToList: 'Tillbaka till översikten',
    back: 'Tillbaka',
    interviewWith: 'Intervju med {{name}}',
  },
  pool: {
    title: 'Talangpool',
    subtitle: 'Hantera din kandidatpool för kommande tjänster',
  },
};

export default sv;
