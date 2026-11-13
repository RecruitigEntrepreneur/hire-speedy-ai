import type de from './de';
import type { Messages } from '../../types';

const en: Messages<typeof de> = {
  list: {
    title: 'My candidates',
    subtitle: 'Manage your candidate database',
    manageTags: 'Manage tags',
    updated: 'Candidate updated',
    added: 'Candidate added',
    saveFailed: 'Could not save',
    confirmDelete: 'Do you really want to delete this candidate?',
    deleteFailed: 'Could not delete',
    deleted: 'Candidate deleted',
    csvHeader: 'Name,Email,Phone,Experience,Salary,Skills',
    csvFile: 'candidates.csv',
    exported_one: '{{count}} candidate exported',
    exported_other: '{{count}} candidates exported',
    confirmBulkDelete_one: 'Really delete {{count}} candidate?',
    confirmBulkDelete_other: 'Really delete {{count}} candidates?',
    bulkDeleted_one: '{{count}} candidate deleted',
    bulkDeleted_other: '{{count}} candidates deleted',
    tagAssigned: 'Tag assigned',
    tagRemoved: 'Tag removed',
    emptyTitle: 'No candidates yet',
    emptyText: 'The best way to add your first one is with a CV. Without a CV you cannot submit them later.',
    noneFound: 'No candidates found',
    poolFeature: 'Talent pool feature',
    imported: 'Candidates imported',
    createdFromCv: 'Candidate created from CV',
  },
  detail: {
    status: {
      new: 'New',
      contacted: 'Contacted',
      interview: 'Interview',
      offer: 'Offer',
      placed: 'Placed',
      rejected: 'Rejected',
    },
    notFound: 'Candidate not found',
    activityAdded: 'Activity added',
    backToList: 'Back to overview',
    back: 'Back',
    interviewWith: 'Interview with {{name}}',
  },
  pool: {
    title: 'Talent pool',
    subtitle: 'Manage your candidate pool for future positions',
  },
};

export default en;
