import type de from './de';
import type { Messages } from '../../types';

const en: Messages<typeof de> = {
  search: {
    error: 'That didn\'t work. Please try again in a moment.',
    toSilver_one: '{{count}} more client interview or 1 hire to Silver',
    toSilver_other: '{{count}} more client interviews or 1 hire to Silver',
    placements_one: '{{count}} hire',
    placements_other: '{{count}} hires',
    months_one: '{{count}} month on board',
    months_other: '{{count}} months on board',
    toGold: '{{parts}} more to Gold',
    and: ' and ',
  },
  stage: {
    submitted: 'Submitted',
    in_review: 'In review',
    interview_requested: 'Interview requested',
    candidate_opted_in: 'Opt-in given',
    interview_scheduled: 'Interview scheduled',
    interview_counter_proposed: 'Counter-proposal',
    interview_completed: 'Interview held',
    offer: 'Offer',
    placed: 'Placed',
    interview_declined: 'Interview declined',
    client_rejected: 'Rejected by client',
    rejected: 'Rejected',
    withdrawn: 'Withdrawn',
  },
  match: {
    notDeployed: 'match-v41 is not deployed.',
    unavailable: 'Matching is not available right now.',
  },
  cv: {
    missing: 'The candidate cannot be submitted without a CV.',
    fileType: 'Please upload a PDF or Word file.',
    fileSize: 'The file may be at most 10 MB.',
    submitFailed: 'Submission failed',
    uploadFailed: 'Upload failed: {{msg}}',
    saveFailed: 'The CV could not be saved.',
    confirmFailed: 'The confirmation could not be saved.',
  },
  import: {
    notPublished: 'Reading is not published yet (function extract-candidate-cv missing).',
    unreachable: 'Reading is not reachable right now (function extract-candidate-cv not published yet?).',
    readFailed: 'The CV could not be read. Please try again in a moment.',
    createFailed: 'Candidate could not be created: {{msg}}',
    updateFailed: 'Candidate could not be updated: {{msg}}',
    unknown: 'unknown',
  },
  textCheck: {
    amountMismatch: 'Amount no longer matches the file (desired salary €{{amount}}).',
    noticeMismatch: 'Notice period no longer matches the details (now {{notice}}).',
    startMismatch: 'Start date no longer matches the details (available from {{date}}).',
    summarySalary: 'The salary in the short profile no longer matches the file (desired salary {{amount}}).',
    summaryNotice: 'The notice period in the short profile no longer matches the file (now {{notice}}).',
  },
};

export default en;
