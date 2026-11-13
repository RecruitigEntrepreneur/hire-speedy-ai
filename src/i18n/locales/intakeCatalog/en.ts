import type de from './de';
import type { Messages } from '../../types';

// English. Address: you.
const en: Messages<typeof de> = {
  q: {
    firmengroesse: {
      text: 'How many people do you currently employ?',
      why: 'Candidates ask this in the first conversation, and the recruiter needs it for the approach.',
      chapter: 'Company',
    },
    verguetung: {
      text: 'What is the range for the fixed salary?',
      why: 'Without a range no recruiter can approach anyone — it is every candidate’s first question.',
      chapter: 'Compensation',
    },
    kriterien: {
      text: 'Which 3 criteria must the candidate meet so that you can put them to productive use straight away and definitely want to meet them?',
      kurz: 'How firm is each of these criteria?',
      intro: 'Based on what we have just discussed about the day-to-day work and its challenges:',
      why: 'Turns a wish list into a search brief. Everything else is negotiable.',
      chapter: 'Skills',
    },
    team: {
      text: 'How is the department around this position structured?',
      textFreelance: 'How is the project team set up, and who else is working on it externally?',
      why: 'A lone-fighter job needs a different person than a role in a team of 15.',
      chapter: 'Key facts',
    },
    arbeitszeit: {
      text: 'What are the working hours (core hours) in your company? How do you handle working from home and overtime?',
      textFreelance: 'How freely can the person organise their time — and how is the work documented?',
      why: 'The most common reason for a late withdrawal — candidates ask about it early.',
      chapter: 'Working hours & process',
    },
    gremien: {
      text: 'Does your company have a works council? (If so, when does it meet?)',
      why: 'Determines the time to an offer more than any other step in the process.',
      chapter: 'Working hours & process',
    },
    vertragstempo: {
      text: 'How long does it take you to draw up the contract? (Is it sent digitally?)',
      why: 'Between the verbal offer and the contract, candidates are lost to faster competitors.',
      chapter: 'Working hours & process',
    },
    arbeitserlaubnis: {
      text: 'Does the candidate need a work permit, or do you sponsor a visa?',
      why: 'A knock-out criterion: without the answer, the recruiter approaches candidates who are not allowed to start.',
      chapter: 'Working hours & process',
    },
    abwerbeschutz: {
      text: 'Which companies must we under no circumstances recruit from?',
      why: 'Recruiting from a client’s own client damages the business relationship. Only the recruiter sees this, and only once they are searching.',
      chapter: 'Working hours & process',
    },
    vakanz: {
      text: 'Why is the position vacant? By when must it be filled, and what negative effects could it have if it stays open longer?',
      textFreelance: 'Why do you need outside capacity? From when — and what happens if no one is there?',
      why: 'Defines the story, the urgency and the risk — and is never in a job ad.',
      chapter: 'Timing & contract',
    },
    alltag: {
      text: 'Can you paint me a picture of the candidate’s working day?',
      why: 'The recruiter describes this working day when talking to candidates. Without it the role stays abstract.',
      chapter: 'Role & scope',
    },
    entscheidung: {
      text: 'Who does the candidate report to, and is anyone besides you involved in the final decision?',
      why: 'Knowing this, the recruiter can gear the conversation towards the right person.',
      chapter: 'Process & decision-makers',
    },
    auswahlprozess: {
      text: 'How does your selection process work: how many interviews, with whom, is there a case study or a trial day?',
      why: 'Candidates ask this in the first conversation. Those who know the process drop out less often.',
      chapter: 'Process & decision-makers',
    },
    passung: {
      text: 'What kind of person succeeds in your company in the long term — or, put more simply: who has not succeeded in the past?',
      textFreelance: 'What makes an external specialist successful with you — and what has one already failed at?',
      why: 'Describes the person being sought — and saves interviews that can lead nowhere.',
      chapter: 'Work model & culture',
    },
    sourcing: {
      text: 'Which companies do good candidates for this role typically come from?',
      why: 'This is where your headhunter looks first. Only they see this, and only once they are searching for you.',
      chapter: 'Sourcing',
    },
    usp: {
      text: 'What unique selling points can you offer as a company, and what advantages does the position itself have that perhaps only an expert would appreciate — for example no cold calling in a sales role?',
      textFreelance: 'What makes this project attractive — the technology, the reference, or the prospect of follow-on work?',
      why: 'The argument the recruiter uses to win over someone who is not even looking.',
      chapter: 'Sell & story (EVP)',
    },
    kultur: {
      text: 'How would you describe your company culture?',
      textFreelance: 'How do people work together at your company — what should an external specialist be prepared for?',
      why: 'The recruiter has to describe it credibly without naming the company.',
      chapter: 'Work model & culture',
    },
    foerderung: {
      text: 'What specific steps does your company take to develop employees, particularly with regard to salary progression and career opportunities?',
      why: 'Without an answer the position looks like a dead end.',
      chapter: 'Sell & story (EVP)',
    },
    vertrag: {
      text: 'How is the employment contract set up? Are there any points in it that are sensitive or could put candidates off?',
      textFreelance: 'How is the service contract set up? Are there clauses that put freelancers off?',
      why: 'Better the recruiter knows beforehand than the candidate backs out at signing.',
      chapter: 'Timing & contract',
    },
    einwaende: {
      text: 'What would a candidate be critical of in this position, and what is your answer to that?',
      why: 'Knowing the objections in advance means not losing candidates at the offer stage.',
      chapter: 'Timing & contract',
    },
    branche: {
      text: 'What is currently going well in your industry? What challenges is your industry currently facing?',
      why: 'The argument that lets the recruiter reach a contented candidate in the first place.',
      chapter: 'Sell & story (EVP)',
    },
    pipeline: {
      text: 'How many candidates do you currently have, or have you had, in the process? Have candidates ever dropped out at the offer stage? If so, why?',
      why: 'Tells the recruiter who they are up against and which objection to pre-empt.',
      chapter: 'Risks & candour',
    },
  },
  slot: {
    company_headcount: {
      label: 'Employees',
    },
    company_size_band: {
      label: 'Size band',
    },
    salary_range: {
      label: 'Salary from / to (€)',
    },
    day_rate_range: {
      label: 'Budget per day, all-inclusive (€)',
    },
    contract_duration_months: {
      label: 'Duration (months)',
    },
    utilization_days_per_week: {
      label: 'Workload (days per week)',
    },
    extension_possible: {
      label: 'Extension possible',
    },
    salary_months: {
      label: 'How many monthly salaries are paid per year?',
    },
    bonus_structure: {
      label: 'Is there a bonus?',
    },
    bonus_basis: {
      label: 'What does it depend on?',
    },
    salary_flex: {
      label: 'How much leeway do you have on salary for the right candidate?',
    },
    must_have_criteria: {
      label: 'The three you cannot do without',
    },
    trainable_skills: {
      label: 'What can be trained on the job?',
    },
    department_structure: {
      label: 'Structure of the department',
    },
    team_size: {
      label: 'Team size',
      placeholder: 'Number of people',
    },
    remote_days: {
      label: 'Days working from home per week',
      labelFreelance: 'Remote days per week',
    },
    contract_limitation: {
      label: 'Is the contract permanent?',
    },
    core_hours: {
      label: 'Core hours',
      labelFreelance: 'Attendance',
    },
    core_hours_detail: {
      label: 'From when to when?',
      labelFreelance: 'Which times exactly?',
      placeholder: 'e.g. 09:00–15:00',
    },
    overtime_policy: {
      label: 'Overtime is …',
    },
    time_tracking_method: {
      label: 'How is working time recorded in your company?',
      labelFreelance: 'How is the work documented?',
    },
    works_council: {
      label: 'Works council',
    },
    works_council_meeting_schedule: {
      label: 'When does it meet?',
    },
    contract_creation_days: {
      label: 'From the yes to the contract (days)',
      placeholder: 'e.g. 7',
    },
    contract_sent_digitally: {
      label: 'Is it sent digitally?',
    },
    visa_sponsorship: {
      label: 'Work permit or visa',
    },
    nogo_companies: {
      label: 'Do not recruit from',
      placeholder: 'Enter company name',
    },
    vacancy_reason: {
      label: 'Why vacant',
      labelFreelance: 'Why external',
    },
    hiring_deadline: {
      label: 'To be filled by',
    },
    negative_impact_if_unfilled: {
      label: 'Negative effects of a delay',
    },
    max_notice_period: {
      label: 'What is the longest notice period you can wait for?',
    },
    daily_routine: {
      label: 'The working day',
    },
    task_focus: {
      label: 'What is the main focus of the position?',
    },
    task_breakdown: {
      label: 'How are the tasks weighted in percent?',
    },
    reports_to: {
      label: 'Reports to',
    },
    decision_makers: {
      label: 'Also involved in the final decision',
    },
    interview_process: {
      label: 'The selection process',
    },
    success_profile: {
      label: 'Succeeds in the long term',
      labelFreelance: 'Delivers with us',
    },
    failure_profile: {
      label: 'Did not succeed',
      labelFreelance: 'Did not work out with us',
    },
    target_companies: {
      label: 'Good candidates come from',
      placeholder: 'Enter company name',
    },
    unique_selling_points: {
      label: 'The company’s unique selling points',
      labelFreelance: 'What makes the project attractive',
    },
    position_advantages: {
      label: 'Advantages of the position that only an expert appreciates',
      labelFreelance: 'What only a specialist would appreciate',
    },
    company_culture: {
      label: 'Company culture',
      labelFreelance: 'Collaboration in the project',
    },
    career_path: {
      label: 'Specific steps',
    },
    career_example: {
      label: 'Please give me a specific example of this!',
    },
    contract_sensitive_topics: {
      label: 'Sensitive points',
    },
    candidate_concerns: {
      label: 'What candidates are critical of',
      placeholder: 'Enter your own point',
    },
    candidate_concerns_answer: {
      label: 'Your answer to that',
      placeholder: 'e.g. flexitime without core hours makes up for the on-site days',
    },
    industry_opportunities: {
      label: 'What is going well',
    },
    industry_challenges: {
      label: 'Challenges',
    },
    candidates_in_pipeline: {
      label: 'Currently in the process',
    },
    candidates_dropped_reason: {
      label: 'Dropouts at the offer stage',
    },
  },
  chips: {
    company_size_band: {
      c0: 'up to 50',
      c1: '50–250',
      c2: '250–1,000',
      c3: '1,000–5,000',
      c4: 'more than 5,000',
    },
    extension_possible: {
      c0: 'Yes',
      c1: 'No',
    },
    salary_months: {
      c0: '12',
      c1: '12 + holiday pay',
      c2: '13',
      c3: '13.5',
      c4: '14',
    },
    bonus_structure: {
      c0: 'No',
      c1: 'up to 10%',
      c2: 'up to 20%',
      c3: 'more than 20%',
    },
    bonus_basis: {
      c0: 'Company results',
      c1: 'Personal targets',
      c2: 'Team targets',
      c3: 'Revenue',
    },
    salary_flex: {
      c0: 'None, the range is fixed',
      c1: 'up to 5% above',
      c2: 'up to 10% above',
      c3: 'negotiable',
    },
    remote_days: {
      c0: '0',
      c1: '1',
      c2: '2',
      c3: '3',
      c4: '4',
      c5: '5',
      c6: 'free choice',
    },
    contract_limitation: {
      c0: 'Permanent',
      c1: 'Fixed-term with prospect of permanence',
      c2: 'Fixed-term',
      c3: 'Project contract',
    },
    core_hours: {
      c0: 'Flexitime without core hours',
      c1: 'Flexitime with core hours',
      c2: 'Fixed working hours',
      c3: 'Trust-based working hours',
      c4: 'Shift work',
    },
    overtime_policy: {
      c0: 'compensated with time off',
      c1: 'paid out',
      c2: 'covered by the salary',
      c3: 'hardly ever occurs',
    },
    time_tracking_method: {
      c0: 'digitally',
      c1: 'noted by the employee',
      c2: 'Time clock',
      c3: 'not at all',
    },
    works_council: {
      c0: 'Yes',
      c1: 'No',
    },
    works_council_meeting_schedule: {
      c0: 'Weekly',
      c1: 'Every two weeks',
      c2: 'Monthly',
      c3: 'As needed',
    },
    contract_sent_digitally: {
      c0: 'Yes',
      c1: 'No',
    },
    visa_sponsorship: {
      c0: 'Work permit for Germany required',
      c1: 'We sponsor a visa',
    },
    nogo_companies: {
      c0: 'Our customers',
      c1: 'Our suppliers',
      c2: 'Group companies',
      c3: 'No restriction',
    },
    vacancy_reason: {
      c0: 'Growth / newly created',
      c1: 'Replacement',
      c2: 'Replacing the current holder',
      c3: 'Parental leave cover',
      c4: 'Succession / retirement',
    },
    hiring_deadline: {
      c0: 'As soon as possible',
      c1: 'In 1–3 months',
      c2: 'In 3–6 months',
      c3: 'Flexible on timing',
    },
    negative_impact_if_unfilled: {
      c0: 'The work falls to the team',
      c1: 'We pay for external support',
      c2: 'Projects are delayed',
      c3: 'The team has no lead',
      c4: 'Closings fall behind',
    },
    max_notice_period: {
      c0: '1 month',
      c1: '3 months',
      c2: '6 months',
      c3: 'does not matter',
    },
    daily_routine: {
      c0: 'Fixed routine in the morning',
      c1: 'Switching between project and day-to-day business',
      c2: 'A lot of coordination within the team',
      c3: 'Off-site appointments',
      c4: 'Incidents dictate the day',
    },
    task_focus: {
      c0: 'Operational / hands-on',
      c1: 'Steering / coordinating',
      c2: 'Building / transforming',
      c3: 'Leading / developing',
    },
    task_breakdown: {
      c0: 'Mostly operational',
      c1: 'Mostly steering',
      c2: 'Half project, half day-to-day business',
      c3: 'One third coordination',
    },
    reports_to: {
      c0: 'Managing director / executive board',
      c1: 'Head of division',
      c2: 'Head of department',
      c3: 'Team lead',
    },
    decision_makers: {
      c0: 'No one — I decide',
      c1: 'Managing director / executive board',
      c2: 'HR',
      c3: 'Specialist department',
      c4: 'The team',
    },
    interview_process: {
      c0: 'First interview with HR',
      c1: 'Second interview with the specialist department',
      c2: 'Second interview with the managing director',
      c3: 'Case study',
      c4: 'Trial day',
    },
    success_profile: {
      c0: 'Rolls up their sleeves',
      c1: 'Comes from a mid-sized company',
      c2: 'Likes to work independently',
      c3: 'Prefers short lines of communication to process',
    },
    failure_profile: {
      c0: 'Waits for instructions',
      c1: 'Came from a large corporation and missed having support staff',
      c2: 'Not hands-on enough',
      c3: 'Was not a personal fit for the team',
    },
    target_companies: {
      c0: 'Competitors',
      c1: 'Consultancies',
      c2: 'Large corporations in the industry',
      c3: 'Mid-sized companies in the industry',
      c4: 'Suppliers',
    },
    unique_selling_points: {
      c0: 'Owner-managed, no investors',
      c1: 'Own product, own manufacturing',
      c2: 'Market leader in a niche',
      c3: 'Short lines to the managing director',
      c4: 'Secure job, low staff turnover',
    },
    position_advantages: {
      c0: 'Full responsibility rather than a supporting role',
      c1: 'Direct line to the managing director',
      c2: 'Building up rather than administering',
      c3: 'Modern systems in use',
    },
    company_culture: {
      c0: 'We are on first-name terms',
      c1: 'We address each other formally',
      c2: 'Short lines, little coordination',
      c3: 'Fixed responsibilities, clear processes',
      c4: 'Family-like, low staff turnover',
    },
    career_path: {
      c0: 'Annual development review',
      c1: 'Salary is set in that review, not on request',
      c2: 'Annual training budget',
      c3: 'Specialist career path possible',
      c4: 'Management career path possible',
    },
    career_example: {
      c0: 'Someone has been promoted internally',
      c1: 'Someone has taken on specialist responsibility',
      c2: 'Someone has moved to another division',
    },
    contract_sensitive_topics: {
      c0: 'None of these',
      c1: 'Non-compete clause',
      c2: 'Repayment clause (training)',
      c3: 'Confidentiality / NDA',
      c4: 'On-call duty',
      c5: 'Travel required',
    },
    candidate_concerns: {
      c0: 'Mandatory on-site presence',
      c1: 'Commute',
      c2: 'Salary',
      c3: 'No bonus',
      c4: 'Repayment clause',
      c5: 'Travel',
    },
    industry_opportunities: {
      c0: 'The order situation is good',
      c1: 'Investment is picking up',
      c2: 'Funding programmes help',
      c3: 'We are gaining market share',
    },
    industry_challenges: {
      c0: 'Skilled staff are hard to find',
      c1: 'Delivery times are long',
      c2: 'Price pressure is increasing',
      c3: 'Regulation is becoming more demanding',
    },
  },
  chipsFreelance: {
    core_hours: {
      c0: 'Freely schedulable',
      c1: 'Fixed appointments, otherwise free',
      c2: 'Core hours to be observed',
      c3: 'Shift plan or duty roster',
    },
    time_tracking_method: {
      c0: 'Digital timesheet',
      c1: 'Paper timesheet',
      c2: 'Monthly report',
      c3: 'No recording',
    },
    vacancy_reason: {
      c0: 'New project',
      c1: 'Peak workload',
      c2: 'Bridging an absence',
      c3: 'Know-how is missing in-house',
      c4: 'Until a permanent hire is made',
    },
    negative_impact_if_unfilled: {
      c0: 'The customer deadline is at risk',
      c1: 'We pay more for external support',
      c2: 'The project is delayed',
      c3: 'The plant goes into operation later',
      c4: 'In-house staff are pulled off other work',
    },
    daily_routine: {
      c0: 'A fixed place in the project team',
      c1: 'Coordination with the specialist department',
      c2: 'Independent, little coordination',
      c3: 'On site at the plant',
    },
    reports_to: {
      c0: 'Project management',
      c1: 'Head of the specialist department',
      c2: 'Head of division',
      c3: 'Managing director / executive board',
    },
    success_profile: {
      c0: 'Delivers from day one without onboarding',
      c1: 'Gets the specialist departments on board',
      c2: 'Documents for the handover',
      c3: 'Works independently without queries',
    },
    failure_profile: {
      c0: 'Took too long to become productive',
      c1: 'Advised instead of implementing',
      c2: 'Left no documentation behind',
      c3: 'Could not cope with our processes',
    },
    unique_selling_points: {
      c0: 'Modern technology rather than legacy systems',
      c1: 'A project that works as a reference',
      c2: 'Clear assignment, no politics',
      c3: 'Prospect of follow-on projects',
    },
    position_advantages: {
      c0: 'Decisions without committee loops',
      c1: 'Access to the systems from day one',
      c2: 'A professionally well set-up project',
      c3: 'A contact person with decision-making authority',
    },
    company_culture: {
      c0: 'Short lines, little coordination',
      c1: 'Fixed appointments, clear responsibilities',
      c2: 'Corporate processes, many people involved',
      c3: 'We address each other formally',
      c4: 'We are on first-name terms',
    },
    contract_sensitive_topics: {
      c0: 'None of these',
      c1: 'Non-compete clause',
      c2: 'Liability / proof of insurance',
      c3: 'Confidentiality / NDA',
      c4: 'On-site requirement without exception',
      c5: 'Travel required',
    },
  },
  benefits: {
    c0: '30 days of annual leave',
    c1: 'More than 30 days of annual leave',
    c2: 'Working from home possible',
    c3: 'Flexitime without core hours',
    c4: 'Part-time possible',
    c5: 'Workation / working from abroad',
    c6: 'Sabbatical',
    c7: 'Bonus / incentive payments',
    c8: 'Company pension scheme',
    c9: 'Employer savings contributions',
    c10: 'Employee share scheme',
    c11: 'Relocation support',
    c12: 'Company bike / bike leasing',
    c13: 'Public transport pass / travel allowance',
    c14: 'Company car',
    c15: 'Parking space or charging point',
    c16: 'Training budget',
    c17: 'Conferences and certifications',
    c18: 'Coaching / mentoring',
    c19: 'Meal allowance or canteen',
    c20: 'Fitness membership (Wellpass, Urban Sports)',
    c21: 'Preventive healthcare / company doctor',
    c22: 'Childcare or nursery allowance',
    c23: 'Modern hardware, choice of device',
    c24: 'Employee discounts',
  },
  benefitsContracting: {
    c0: 'Travel expenses are reimbursed',
    c1: 'Accommodation is provided',
    c2: 'Partly remote possible',
    c3: 'Flexible on-site days',
    c4: 'No mandatory core hours',
    c5: 'Own time management',
    c6: 'Own workstation',
    c7: 'Hardware is provided',
    c8: 'Parking space or charging point',
    c9: 'Canteen can be used',
    c10: 'Reference promised',
    c11: 'Follow-on projects in prospect',
    c12: 'Access to training and certifications',
  },
  benefitGroups: {
    c0: 'Time & place',
    c1: 'Money',
    c2: 'Mobility',
    c3: 'Development',
    c4: 'Everyday life',
  },
  benefitGroupsContracting: {
    c0: 'Terms',
    c1: 'Scheduling',
    c2: 'On site',
    c3: 'After the project',
  },
  value: {
    yes: 'Yes',
    no: 'No',
    given: 'provided',
  },
};

export default en;
