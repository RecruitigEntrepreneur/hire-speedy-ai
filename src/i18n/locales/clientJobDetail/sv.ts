import type de from './de';
import type { Messages } from '../../types';

// Svenska. Tilltal: du.
const sv: Messages<typeof de> = {
  toast: {
    submitError: 'Det gick inte att skicka in',
    submittedInternal: 'Inskickad för internt godkännande – admin/HR i ditt team har fått besked.',
    submitted: 'Inskickad för granskning – vi hör av oss så snart tjänsten är publicerad.',
    withdrawn: 'Tillbakadragen – tjänsten är ett utkast igen.',
    approveError: 'Godkännandet misslyckades',
    approved: 'Godkänd – tjänsten går nu till Matchunt för granskning.',
    returnError: 'Det gick inte att skicka tillbaka',
    returned: 'Tillbakaskickad – den rekryterande chefen har fått besked.',
  },
  draft: {
    package: 'Paket {{name}}',
    packageFee: 'Paket {{name}} {{pct}} %',
    returnedReview: 'Tillbakaskickad från granskningen',
    returnedTeam: 'Tillbakaskickad av teamet',
    reason: 'Skäl: {{reason}}',
    badge: 'Utkast',
    submittedOn: 'Inskickad {{date}}',
    submitted: 'Inskickad',
    lastEdited_one: 'senast redigerad för {{count}} dag sedan',
    lastEdited_other: 'senast redigerad för {{count}} dagar sedan',
    reviewInfo: 'Vi granskar dina uppgifter och skriver utifrån dem den anonyma annonsen för headhunters. Saknas något skickar vi tillbaka tjänsten med en kommentar. Så snart den är publicerad får du besked.',
    approveSend: 'Godkänn och skicka till Matchunt',
    returnWithComment: 'Skicka tillbaka med kommentar',
    approversNotified: 'Admin/HR i ditt team har fått besked och godkänner underlaget.',
    withdraw: 'Dra tillbaka',
    continueIntake: 'Fortsätt med underlaget och skicka in',
    supportHint: 'Stämmer något inte, eller behövs tjänsten inte längre?',
    supportLink: 'Mejla Matchunt',
  },
  returnDialog: {
    title: 'Skicka tillbaka till den rekryterande chefen',
    description: 'Underlaget går tillbaka som utkast. Din kommentar visas för den som skapade det.',
    placeholder: 'Vad ska ändras? (obligatoriskt)',
    cancel: 'Avbryt',
    submit: 'Skicka tillbaka',
  },
  live: {
    pausedUntil: 'Pausad till {{date}}',
  },
};
export default sv;
