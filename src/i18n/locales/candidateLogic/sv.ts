import type de from './de';
import type { Messages } from '../../types';

const sv: Messages<typeof de> = {
  search: {
    error: 'Det gick inte. Försök igen om en stund.',
    toSilver_one: '{{count}} kundintervju till eller 1 anställning till Silver',
    toSilver_other: '{{count}} kundintervjuer till eller 1 anställning till Silver',
    placements_one: '{{count}} anställning',
    placements_other: '{{count}} anställningar',
    months_one: '{{count}} månad med',
    months_other: '{{count}} månader med',
    toGold: '{{parts}} kvar till Guld',
    and: ' och ',
  },
  stage: {
    submitted: 'Presenterad',
    in_review: 'Granskas',
    interview_requested: 'Intervju efterfrågad',
    candidate_opted_in: 'Opt-in lämnat',
    interview_scheduled: 'Tid bokad',
    interview_counter_proposed: 'Motförslag',
    interview_completed: 'Intervju genomförd',
    offer: 'Erbjudande',
    placed: 'Tillsatt',
    interview_declined: 'Intervju avböjd',
    client_rejected: 'Avböjd av kunden',
    rejected: 'Avböjd',
    withdrawn: 'Återkallad',
  },
  match: {
    notDeployed: 'match-v41 är inte driftsatt.',
    unavailable: 'Matchningen går inte att nå just nu.',
  },
  cv: {
    missing: 'Kandidaten kan inte presenteras utan CV.',
    fileType: 'Ladda upp en PDF- eller Word-fil.',
    fileSize: 'Filen får vara högst 10 MB.',
    submitFailed: 'Det gick inte att presentera',
    uploadFailed: 'Uppladdningen misslyckades: {{msg}}',
    saveFailed: 'CV:t kunde inte sparas.',
    confirmFailed: 'Bekräftelsen kunde inte sparas.',
  },
  import: {
    notPublished: 'Inläsningen är inte publicerad än (funktionen extract-candidate-cv saknas).',
    unreachable: 'Inläsningen går inte att nå just nu (funktionen extract-candidate-cv inte publicerad än?).',
    readFailed: 'CV:t kunde inte läsas in. Försök igen om en stund.',
    createFailed: 'Kandidaten kunde inte skapas: {{msg}}',
    updateFailed: 'Kandidaten kunde inte uppdateras: {{msg}}',
    unknown: 'okänt',
  },
  textCheck: {
    amountMismatch: 'Beloppet stämmer inte längre med akten (löneanspråk {{amount}} €).',
    noticeMismatch: 'Uppsägningstiden stämmer inte längre med uppgifterna (nu {{notice}}).',
    startMismatch: 'Startdatum stämmer inte längre med uppgifterna (tillgänglig från {{date}}).',
    summarySalary: 'Lönen i den korta profilen stämmer inte längre med akten (löneanspråk {{amount}}).',
    summaryNotice: 'Uppsägningstiden i den korta profilen stämmer inte längre med akten (nu {{notice}}).',
  },
};

export default sv;
