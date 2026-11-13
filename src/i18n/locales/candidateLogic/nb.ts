import type de from './de';
import type { Messages } from '../../types';

const nb: Messages<typeof de> = {
  search: {
    error: 'Det gikk ikke. Prøv igjen om litt.',
    toSilver_one: '{{count}} kundeintervju til eller 1 ansettelse til Sølv',
    toSilver_other: '{{count}} kundeintervjuer til eller 1 ansettelse til Sølv',
    placements_one: '{{count}} ansettelse',
    placements_other: '{{count}} ansettelser',
    months_one: '{{count}} måned med',
    months_other: '{{count}} måneder med',
    toGold: '{{parts}} igjen til Gull',
    and: ' og ',
  },
  stage: {
    submitted: 'Presentert',
    in_review: 'Under vurdering',
    interview_requested: 'Intervju forespurt',
    candidate_opted_in: 'Opt-in gitt',
    interview_scheduled: 'Tid avtalt',
    interview_counter_proposed: 'Motforslag',
    interview_completed: 'Intervju gjennomført',
    offer: 'Tilbud',
    placed: 'Ansatt',
    interview_declined: 'Intervju avslått',
    client_rejected: 'Avslått av kunden',
    rejected: 'Avslått',
    withdrawn: 'Trukket',
  },
  match: {
    notDeployed: 'match-v41 er ikke tatt i bruk.',
    unavailable: 'Matchingen er ikke tilgjengelig akkurat nå.',
  },
  cv: {
    missing: 'Kandidaten kan ikke presenteres uten CV.',
    fileType: 'Last opp en PDF- eller Word-fil.',
    fileSize: 'Filen kan være maks 10 MB.',
    submitFailed: 'Presentasjonen mislyktes',
    uploadFailed: 'Opplastingen mislyktes: {{msg}}',
    saveFailed: 'CV-en kunne ikke lagres.',
    confirmFailed: 'Bekreftelsen kunne ikke lagres.',
  },
  import: {
    notPublished: 'Innlesingen er ikke publisert ennå (funksjonen extract-candidate-cv mangler).',
    unreachable: 'Innlesingen er ikke tilgjengelig nå (funksjonen extract-candidate-cv ikke publisert ennå?).',
    readFailed: 'CV-en kunne ikke leses inn. Prøv igjen om litt.',
    createFailed: 'Kandidaten kunne ikke opprettes: {{msg}}',
    updateFailed: 'Kandidaten kunne ikke oppdateres: {{msg}}',
    unknown: 'ukjent',
  },
  textCheck: {
    amountMismatch: 'Beløpet stemmer ikke lenger med mappen (lønnsønske {{amount}} €).',
    noticeMismatch: 'Oppsigelsestiden stemmer ikke lenger med opplysningene (nå {{notice}}).',
    startMismatch: 'Startdato stemmer ikke lenger med opplysningene (tilgjengelig fra {{date}}).',
    summarySalary: 'Lønnen i kortprofilen stemmer ikke lenger med mappen (lønnsønske {{amount}}).',
    summaryNotice: 'Oppsigelsestiden i kortprofilen stemmer ikke lenger med mappen (nå {{notice}}).',
  },
};

export default nb;
