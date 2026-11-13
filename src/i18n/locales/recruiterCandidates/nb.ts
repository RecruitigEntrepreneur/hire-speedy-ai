import type de from './de';
import type { Messages } from '../../types';

const nb: Messages<typeof de> = {
  list: {
    title: 'Mine kandidater',
    subtitle: 'Administrer kandidatdatabasen din',
    manageTags: 'Administrer tagger',
    updated: 'Kandidaten er oppdatert',
    added: 'Kandidaten er lagt til',
    saveFailed: 'Kunne ikke lagre',
    confirmDelete: 'Vil du virkelig slette denne kandidaten?',
    deleteFailed: 'Kunne ikke slette',
    deleted: 'Kandidaten er slettet',
    csvHeader: 'Navn,E-post,Telefon,Erfaring,Lønn,Kompetanse',
    csvFile: 'kandidater.csv',
    exported_one: '{{count}} kandidat eksportert',
    exported_other: '{{count}} kandidater eksportert',
    confirmBulkDelete_one: 'Vil du virkelig slette {{count}} kandidat?',
    confirmBulkDelete_other: 'Vil du virkelig slette {{count}} kandidater?',
    bulkDeleted_one: '{{count}} kandidat slettet',
    bulkDeleted_other: '{{count}} kandidater slettet',
    tagAssigned: 'Taggen er lagt til',
    tagRemoved: 'Taggen er fjernet',
    emptyTitle: 'Ingen kandidater ennå',
    emptyText: 'Legg helst inn den første med en CV. Uten CV kan du ikke presentere kandidaten senere.',
    noneFound: 'Fant ingen kandidater',
    poolFeature: 'Funksjonen talentpool',
    imported: 'Kandidatene er importert',
    createdFromCv: 'Kandidaten er opprettet fra CV-en',
  },
  detail: {
    status: {
      new: 'Ny',
      contacted: 'Kontaktet',
      interview: 'Intervju',
      offer: 'Tilbud',
      placed: 'Plassert',
      rejected: 'Avslag',
    },
    notFound: 'Fant ikke kandidaten',
    activityAdded: 'Aktiviteten er lagt til',
    backToList: 'Tilbake til oversikten',
    back: 'Tilbake',
    interviewWith: 'Intervju med {{name}}',
  },
  pool: {
    title: 'Talentpool',
    subtitle: 'Administrer kandidatpoolen din for fremtidige stillinger',
  },
};

export default nb;
