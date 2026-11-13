import type de from './de';
import type { Messages } from '../../types';

const en: Messages<typeof de> = {
  toast: {
    submitError: 'Submission failed',
    submittedInternal: 'Submitted for internal approval — admin/HR on your team have been notified.',
    submitted: 'Submitted for review — we will let you know as soon as the job is live.',
    withdrawn: 'Withdrawn — the job is a draft again.',
    approveError: 'Approval failed',
    approved: 'Approved — the job now goes to Matchunt for review.',
    returnError: 'Returning failed',
    returned: 'Returned — the hiring manager has been notified.',
  },
  draft: {
    package: '{{name}} package',
    packageFee: '{{name}} package {{pct}} %',
    returnedReview: 'Returned from review',
    returnedTeam: 'Returned by the team',
    reason: 'Reason: {{reason}}',
    badge: 'Draft',
    submittedOn: 'Submitted on {{date}}',
    submitted: 'Submitted',
    lastEdited_one: 'last edited {{count}} day ago',
    lastEdited_other: 'last edited {{count}} days ago',
    reviewInfo: 'We are reviewing your details and turning them into the anonymous posting for headhunters. If anything is missing, we will return the job to you with a note. You will hear from us as soon as it is live.',
    approveSend: 'Approve & send to Matchunt',
    returnWithComment: 'Return with comment',
    approversNotified: 'Admin/HR on your team have been notified and will approve the intake.',
    withdraw: 'Withdraw',
    continueIntake: 'Continue the intake and submit',
    supportHint: 'Something is wrong or the job is no longer needed?',
    supportLink: 'Email Matchunt',
  },
  returnDialog: {
    title: 'Return to the hiring manager',
    description: 'The intake goes back as a draft. Your comment will be shown to its creator.',
    placeholder: 'What needs to be changed? (required)',
    cancel: 'Cancel',
    submit: 'Return',
  },
  live: {
    pausedUntil: 'Paused until {{date}}',
  },
};
export default en;
