import type de from './de';
import type { Messages } from '../../types';

// English. Address: you.
const en: Messages<typeof de> = {
  chapters: {
    welcome: 'Welcome',
    create: 'Create a position',
    after: 'After submitting',
    candidates: 'Candidates & team',
  },
  steps: {
    'c-welcome': {
      title: 'Welcome to Matchunt',
      body: 'In a few minutes we will show you how to hand a position to our headhunters and receive matching candidates. Along the way you create your first position. You click, we explain.',
    },
    'c-entry': {
      title: 'Every position starts here',
      body: '“Add position” is the most important button. Positions you have started appear here later under “Continue”.',
    },
    'c-decide': {
      title: 'What is waiting for you',
      body: '“Needs a decision” shows candidates and appointments where it is your move. The faster you respond, the better your chances.',
    },
    'c-start': {
      title: 'Let’s create your first position',
      body: 'Paste your job ad and click “Build profile”. No ad at hand? Then choose “Describe manually”.',
      narrowBody: 'Tap “Add position”.',
      action: 'Add position',
    },
    'c-kind': {
      title: 'Permanent hire or contracting?',
      body: 'This determines what we ask and what goes into the agreement. Choose the right type.',
      action: 'Next',
    },
    'c-ways': {
      title: 'The fastest way: your job ad',
      body: 'Paste the ad, a link or a PDF: we build the profile from it and you just review it. Without an ad, you describe the position manually.',
      action: 'Next',
    },
    'c-profile': {
      title: 'Review instead of typing',
      body: 'Your profile is ready. Everything taken from your ad is marked “from the ad”: “✓ correct” confirms it, otherwise simply change it. “Confirm all” accepts everything at once.',
      wait: 'The tour waits until your profile is ready.',
    },
    'c-criteria': {
      title: 'The most important input',
      body: 'Rate every requirement: essential, negotiable or learnable. Headhunters measure every candidate against this.',
    },
    'c-briefing': {
      title: 'The briefing: what no job ad says',
      body: 'Eight questions from real placement conversations, such as why the position is open and who succeeds with you. This is exactly what makes the headhunters’ outreach convincing.',
    },
    'c-save': {
      title: 'Nothing gets lost',
      body: 'Everything is saved as you go. With “Later” you can continue at any time under “Continue”. “Next” takes you to submitting once the briefing and requirements are complete.',
    },
    'c-submit': {
      title: 'Take your time',
      body: 'Answer the questions now and submit when you are ready. The tour waits and then continues under “My jobs”.',
    },
    'c-jobs': {
      title: 'Where is my position?',
      body: 'Under “My jobs” you see every position with its status: Submitted → Review by Matchunt (usually under 24 h) → Live → First candidates. Drafts are under “Drafts”.',
      hold: 'The tour continues as soon as you have submitted or chosen “Later”.',
    },
    'c-navCandidates': {
      title: 'Your candidates',
      body: 'Click “Applicants” in the menu on the left.',
      narrowBody: 'Tap “Open applicants”.',
      action: 'Open applicants',
    },
    'c-candidates': {
      title: 'Candidates arrive anonymously',
      body: 'You first see an anonymous profile with the headhunter’s assessment. If you want to meet someone, the headhunter asks the person. After that you see the name and CV.',
    },
    'c-navTeam': {
      title: 'Your team',
      body: 'Click “Team” in the menu on the left.',
      narrowBody: 'Tap “Open team”.',
      action: 'Open team',
    },
    'c-team': {
      title: 'Bring your team in',
      body: 'Invite colleagues: HR submits positions, the hiring department gives feedback on candidates.',
    },
    'c-done': {
      title: 'All done',
      body: 'You now know the most important paths. You can restart the tour at any time via “Tour” on the dashboard.',
    },
  },
};

export default en;
