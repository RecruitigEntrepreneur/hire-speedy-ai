import type de from './de';
import type { Messages } from '../../types';

const en: Messages<typeof de> = {
  recommendation: {
    strong_yes: 'Strong recommendation',
    yes: 'Recommendation',
    maybe: 'Undecided',
    no: 'Not recommended',
    strong_no: 'Rejection',
  },
  score: {
    excellent: 'Excellent',
    veryGood: 'Very good',
    good: 'Good',
    satisfactory: 'Satisfactory',
    improve: 'Needs improvement',
  },
  title: 'AI assessment',
  overall: 'Overall rating',
  technical: 'Technical fit',
  culture: 'Culture fit',
  communication: 'Communication',
  risk: 'Risk assessment',
  risks: 'Identified risks',
  mitigations: 'Recommended actions',
};
export default en;
