import type de from './de';
import type { Messages } from '../../types';

// Norsk bokmål. Tiltale: du.
const nb: Messages<typeof de> = {
  toast: {
    submitError: 'Innsending mislyktes',
    submittedInternal: 'Sendt inn for intern godkjenning – admin/HR i teamet ditt har fått beskjed.',
    submitted: 'Sendt inn til vurdering – vi gir beskjed så snart stillingen er publisert.',
    withdrawn: 'Trukket tilbake – stillingen er et utkast igjen.',
    approveError: 'Godkjenningen mislyktes',
    approved: 'Godkjent – stillingen går nå til Matchunt for vurdering.',
    returnError: 'Kunne ikke sende tilbake',
    returned: 'Sendt tilbake – den ansettende lederen har fått beskjed.',
  },
  draft: {
    package: 'Pakke {{name}}',
    packageFee: 'Pakke {{name}} {{pct}} %',
    returnedReview: 'Sendt tilbake fra vurderingen',
    returnedTeam: 'Sendt tilbake av teamet',
    reason: 'Årsak: {{reason}}',
    badge: 'Utkast',
    submittedOn: 'Sendt inn {{date}}',
    submitted: 'Sendt inn',
    lastEdited_one: 'sist redigert for {{count}} dag siden',
    lastEdited_other: 'sist redigert for {{count}} dager siden',
    reviewInfo: 'Vi går gjennom opplysningene dine og skriver ut fra dem den anonyme annonsen for headhuntere. Mangler noe, sender vi stillingen tilbake med en merknad. Så snart den er publisert, får du beskjed.',
    approveSend: 'Godkjenn og send til Matchunt',
    returnWithComment: 'Send tilbake med kommentar',
    approversNotified: 'Admin/HR i teamet ditt har fått beskjed og godkjenner underlaget.',
    withdraw: 'Trekk tilbake',
    continueIntake: 'Fortsett underlaget og send inn',
    supportHint: 'Stemmer noe ikke, eller trengs ikke stillingen lenger?',
    supportLink: 'Send e-post til Matchunt',
  },
  returnDialog: {
    title: 'Send tilbake til den ansettende lederen',
    description: 'Underlaget går tilbake som utkast. Kommentaren din vises for den som opprettet det.',
    placeholder: 'Hva skal endres? (obligatorisk)',
    cancel: 'Avbryt',
    submit: 'Send tilbake',
  },
  live: {
    pausedUntil: 'På pause til {{date}}',
  },
};
export default nb;
