import type de from './de';
import type { Messages } from '../../types';

const en: Messages<typeof de> = {
  ui: {
    chapter: 'Chapter {{current}} of {{total}} · {{name}}',
    close: 'End tour',
    progress: 'Progress in the tour',
    back: 'Back',
    next: 'Next',
    example: 'Example',
    titleWithName: '{{title}}, {{name}}',
    contents: 'Contents',
  },
  texts: {
    yourTurn: 'Your turn: click the highlighted area.',
    lookOnly: 'Just have a look: continue with “Next”.',
    showing: 'We\'ll show you once, then it\'s your turn.',
    welcomeNamed: '{{title}}, {{name}}',
    start: "Let's go",
    skip: 'Skip',
    finish: 'Done',
    paused: 'Tour paused',
    resume: 'Resume',
    finalCta: 'View open jobs',
  },
  clientTexts: {
    yourTurn: 'Your turn: click the highlighted area.',
    lookOnly: 'Just have a look here. Continue with “Next”.',
    showing: 'We\'ll show you once, then it\'s your turn.',
    welcomeNamed: 'Hello {{name}}, welcome to Matchunt',
    start: "Let's go",
    skip: 'Skip',
    later: 'Later',
    finish: 'Done',
    paused: 'Tour paused',
    resume: 'Resume',
    finalCta: 'Go to dashboard',
  },
  chapters: {
    overview: 'Overview',
    jobs: 'Open jobs',
    briefing: 'Briefing',
    candidates: 'My candidates',
    pipeline: 'Pipeline',
    tasks: 'Tasks & interviews',
  },
  menu: {
    body: 'Click “{{label}}” in the menu on the left.',
    narrowBody: 'Tap “Open {{label}}”.',
    open: 'Open {{label}}',
    items: {
      jobs: 'Open jobs',
      candidates: 'My candidates',
      pipeline: 'Pipeline',
      tasks: 'Tasks',
      interviews: 'Interviews',
    },
  },
  steps: {
    welcome: {
      title: 'Welcome to Matchunt',
      body: 'Let us walk through the platform together once. It takes about three minutes. You do the clicking, and we show you how to get to your first placement here.',
    },
    cockpit: {
      title: 'Your cockpit',
      body: 'This is where you start each day. At the top you see what is coming up. With “Add candidates” you can take on new candidates at any time.',
    },
    topJobs: {
      title: 'Top jobs',
      body: 'A selection of open positions. You find all positions, with filters and sorting, under “Open jobs”.',
    },
    navJobs: { title: 'On to the positions' },
    filters: {
      title: 'Find what suits you',
      body: 'Search by keyword and filter by remote, level or industry. Sort by “Highest fee” or “Little competition” to see the best chances first. The tabs “Urgent”, “New” and “Top” take you straight to the hottest positions.',
    },
    card: {
      title: 'How to read a position',
      body: 'At the top are the role and your fee in euros. Below that the company, anonymous as industry, size and region, plus location, salary band and the key skills. At the bottom you see how many headhunters are already searching and submitting.',
    },
    activate: {
      title: '“I’m searching” means: I’m in',
      body: 'With this you take on a position bindingly. It uses one of your slots and currently cannot be undone. The goal is a first submission within 14 days. So only commit if you have suitable candidates in mind.',
    },
    openPreview: {
      title: 'Take a closer look',
      body: 'Click the position. A preview opens on the right.',
      action: 'Open preview',
    },
    preview: {
      title: 'The preview',
      body: 'Here you find the key requirements and facts. You can propose a candidate from here as soon as you have chosen “I’m searching”.',
    },
    openBriefing: {
      title: 'To the full briefing',
      body: 'Click the position once more. The complete briefing then opens.',
      narrowBody: 'Tap “Open briefing”. You then see the complete briefing for this position.',
      action: 'Open briefing',
    },
    jobHeader: {
      title: 'Your mandate briefing',
      body: 'Everything the client said during intake, in one place. It lets you approach candidates in a targeted way without naming the company.',
    },
    jobTabs: {
      title: 'Three angles',
      body: '“Briefing” for the details, “My candidates” for your submissions to this position and “From the ad” for the original text.',
    },
    jobSubmit: {
      title: 'How to present someone',
      body: 'With “Prepare submission” you pick a candidate, write your assessment and confirm their consent. After a review screen the submission goes to the client, anonymous at first.',
    },
    navCandidates: { title: 'Your candidates' },
    candidatesAdd: {
      title: 'Adding candidates',
      body: 'Via “Add candidates” you upload a CV, paste text or a LinkedIn profile, or add candidates with just a name and email. They then appear in your list, like this:',
    },
    navPipeline: { title: 'Your pipeline' },
    pipeline: {
      title: 'Every submission at a glance',
      body: 'Here you follow each submission through the stages up to the placement. “Open fee” shows you what is in your pipeline.',
    },
    optin: {
      title: 'The most important moment: the opt-in',
      body: 'If the client wants to meet your candidate, the submission moves to “Interview requested”. You then get your candidate’s consent. Only after that do you see which company it is.',
    },
    navTasks: { title: 'Your tasks' },
    tasks: {
      title: 'What is up next',
      body: 'Here Matchunt collects your next steps, sorted by impact: get the opt-in, follow up, prepare interviews. It is best to start every day here.',
    },
    navInterviews: { title: 'Your appointments' },
    interviews: {
      title: 'Interviews under control',
      body: 'All appointments of your candidates: today, this week and not yet scheduled. After each interview you briefly record how it went (debrief).',
    },
    done: {
      title: 'Ready for your first submission?',
      body: 'Pick a position for which a candidate comes to mind. You can restart the tour at any time in the dashboard via “Tour”.',
    },
  },
  examples: {
    job: {
      title: 'Senior Controller (m/f/d)',
      fee: '€12,400',
      feeNote: '15% fee',
      company: 'Industrial company · 250–500 employees',
      place: 'Munich · hybrid · €75,000–90,000',
      activity: '2 recruiters · 1 submission',
      searching: 'I’m searching',
    },
    submit: {
      step1: 'Pick a candidate or add a new one',
      step2: 'Your assessment: why is this a fit?',
      step3: 'Confirm the candidate’s consent',
      step4: 'Review and send to the client',
    },
    candidate: {
      initials: 'LM',
      name: 'Laura M.',
      role: 'Senior Controller · 8 years of experience',
      place: 'Munich · available from 1 Jan',
    },
    pipeline: {
      submitted: 'Submitted',
      inReview: 'In review',
      interviewRequested: 'Interview requested',
      optIn: 'Opt-in given',
      scheduled: 'Date set',
      interviewed: 'Interview held',
      offer: 'Offer',
      placed: 'Placed',
    },
    optin: {
      step1: 'The client would like to meet Laura M.',
      step2: 'You ask Laura whether she agrees.',
      step3: 'Laura says yes: now you see the company.',
      step4: 'You agree on the interview date.',
    },
    task: {
      pill: 'Opt-in',
      urgent: 'urgent',
      title: 'Client would like to interview Laura M.',
      text: 'Senior Controller (m/f/d) · Get her consent today.',
    },
    interview: {
      when: 'Thu, 14:00 · Laura M.',
      kind: 'Video interview · date confirmed',
      after: 'Afterwards: a short debrief on how it went.',
    },
  },
};

export default en;
