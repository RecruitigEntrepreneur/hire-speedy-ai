import type de from './de';
import type { Messages } from '../../types';

const en: Messages<typeof de> = {
  matchCalc: 'The calculation failed',
  fitCredit: 'AI credit limit reached. Please contact support.',
  fitRate: 'Too many requests. Please wait a moment.',
  fitCreated: 'Fit analysis created',
  fitCreatedText: 'The fit analysis has been generated.',
  fitUnknown: 'Unknown error while generating',
  fitFailed: 'Analysis failed',
  generic: 'Something went wrong',
  activities: 'The activities could not be loaded',
  notSignedIn: 'Not signed in',
  saveFailed: 'Saving failed',
  feedbackSaved: 'Feedback saved',
  feedbackFailed: 'The feedback could not be saved',
  sendFailed: 'Sending failed.',
  notDeployed: 'Cannot send: the function “{{fn}}” has not been deployed yet.',
  docxInvalid: 'The file is not a valid Word file.',
  docxBroken: 'The Word file is damaged.',
  docxEmpty: 'The Word file contains no text.',
  docxBrowser: 'Your browser cannot open Word files. Please use PDF or text.',
  score: {
    excellent: 'Excellent',
    veryGood: 'Very good',
    good: 'Good',
    satisfactory: 'Satisfactory',
    sufficient: 'Sufficient',
    low: 'Low',
  },
  multiplier: {
    none: 'No restrictions',
    light: 'Minor restrictions',
    clear: 'Clear restrictions',
    severe: 'Severe restrictions',
  },
  coverage: {
    complete: 'Complete',
    sufficient: 'Sufficient',
    partial: 'Partial',
    insufficient: 'Insufficient',
  },
};
export default en;
