/**
 * Beispiel-Geschichte des Headhunter-Rundgangs (17.11.2026): Die Bühne zeigt die echten Seiten,
 * ihre Abfragen beantwortet dieses Register (lib/demoBackend.ts). Stelle „Senior Controller“ bei
 * der fiktiven Nordwerk Medizintechnik GmbH, Kandidat Daniel Roth; je Stand (`phase`) andere Daten.
 *
 * Sicherheit vor Vollständigkeit: Auf der Bühne geht nichts an die echte Datenbank. Schreiben,
 * Functions und RPCs werden immer abgefangen; Tabellen, die das Beispiel nicht kennt, sind leer.
 * Nur das eigene Profil und die Liga liest die Bühne echt (Kopfzeile, Seitenleiste).
 *
 * demoBackend wendet eq/in/is … NACH dem Register an, ignoriert aber not/or/filter/ilike und
 * löst keine Verknüpfungen auf: Verknüpfte Zeilen stehen hier schon eingebettet.
 */
import type { DemoQuery, DemoRegistry } from './demoBackend';
import { HH_DEMO_IDS, type HhDemoPhase } from './recruiterTour';
import type { HhFillValues } from '@/components/recruiter/tour/hhAutofill';

type T = (key: string, options?: Record<string, unknown>) => string;
type Row = Record<string, unknown>;

export interface HhDemoInput {
  phase: HhDemoPhase;
  user: { id: string; email: string; name: string };
  now: Date;
  lang: string;
  t: T;
}

export interface HhDemoWorld {
  phase: HhDemoPhase;
  ids: typeof HH_DEMO_IDS;
  user: HhDemoInput['user'];
  now: Date;
  companyName: string;
  candidateName: string;
  jobTitle: string;
  /** Termin des Interviews, kurz (Meldung „Interview steht“). */
  interviewLabel: string;
  fill: HhFillValues;
  tables: Record<string, Row[] | ((q: DemoQuery) => Row[])>;
  rpcs: Record<string, (args: Record<string, unknown> | undefined) => unknown>;
  fns: Record<string, (body: Record<string, unknown> | undefined) => unknown>;
}

const ORDER: HhDemoPhase[] = ['market', 'searching', 'candidate', 'ready', 'requested', 'scheduled', 'interviewed', 'offerWanted', 'offer', 'placed'];
/** Ist die Geschichte schon bei `phase` angekommen? */
const from = (now: HhDemoPhase, phase: HhDemoPhase) => ORDER.indexOf(now) >= ORDER.indexOf(phase);

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString();
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Tag `days` nach `base` um `hour` Uhr (Ortszeit). */
const at = (base: Date, days: number, hour: number, minute = 0) => {
  const d = new Date(base.getTime() + days * DAY);
  d.setHours(hour, minute, 0, 0);
  return d;
};

/** Gilt für alle Beispielstellen: Honorar in zwei Teilen (Konditionen v2). */
const terms = (jobId: string) => ({
  jobId, packageKey: 'core', version: 1, standard: false, initialPct: 10, retentionPct: 10, continuityDays: 90,
  v2Active: false, activatedAt: null, research: null, reportedAt: null,
});

export function hhDemoWorld(input: HhDemoInput): HhDemoWorld {
  const { phase, user, now, t } = input;
  const ids = HH_DEMO_IDS;
  const uid = user.id;
  const company = t('demo.data.company');
  const searching = from(phase, 'searching');

  // ---- Stellen ---------------------------------------------------------------------------
  const jobBase = (id: string, o: Row): Row => ({
    id, status: 'published', employment_type: 'full-time', experience_level: 'senior', remote_type: 'hybrid',
    recruiter_fee_percentage: 20, company_logo_url: null, company_name: null, company_revealed: false,
    funding_stage: null, tech_environment: null, paused_at: null, pause_until: null, day_rate_min: null, day_rate_max: null,
    onsite_days_required: 2, required_languages: ['Deutsch'], hiring_urgency: 'standard', company_size_band: '250–1.000',
    ...o,
  });
  const ad = {
    einleitung: t('demo.data.ad.intro'),
    unternehmen: t('demo.data.ad.company'),
    aufgaben: [t('demo.data.ad.task1'), t('demo.data.ad.task2'), t('demo.data.ad.task3')],
    arbeitsalltag: t('demo.data.ad.day'),
    profil_zwingend: [t('demo.data.ad.must1'), t('demo.data.ad.must2'), t('demo.data.ad.must3')],
    profil_vorteil: [t('demo.data.ad.nice1')],
    angebot: [t('demo.data.ad.offer1'), t('demo.data.ad.offer2'), t('demo.data.ad.offer3')],
    team: t('demo.data.ad.team'),
    ablauf: [t('demo.data.ad.step1'), t('demo.data.ad.step2')],
  };
  const job = jobBase(ids.job, {
    title: t('demo.data.job1'), location: 'München', salary_min: 80000, salary_max: 95000, hiring_urgency: 'urgent',
    industry: t('demo.data.industryMedtech'), skills: ['SAP CO', 'Konzernreporting', 'IFRS', 'Power BI'],
    required_languages: ['Deutsch', 'Englisch'], description: t('demo.data.ad.intro'),
    created_at: iso(new Date(now.getTime() - 2 * DAY)), updated_at: iso(new Date(now.getTime() - 2 * DAY)),
    formatted_content: { anzeige: ad, ansprache: { linkedin: t('demo.data.linkedin') } },
    ...(searching ? { company_name: company, company_revealed: true } : {}),
  });
  const otherJobs = [
    jobBase(ids.job2, {
      title: t('demo.data.job2'), location: 'München', salary_min: 120000, salary_max: 140000, industry: t('demo.data.industryMachines'),
      skills: ['B2B-Vertrieb', 'Führung', 'DACH'], description: '', created_at: iso(new Date(now.getTime() - 20 * DAY)), updated_at: iso(new Date(now.getTime() - 6 * DAY)),
    }),
    jobBase(ids.job3, {
      title: t('demo.data.job3'), location: 'Hamburg', salary_min: 50000, salary_max: 60000, remote_type: 'onsite', onsite_days_required: 5,
      industry: t('demo.data.industryLogistics'), skills: ['DATEV', 'Lohn', 'SV-Recht'], description: '', experience_level: 'mid',
      created_at: iso(new Date(now.getTime() - 5 * DAY)), updated_at: iso(new Date(now.getTime() - 5 * DAY)),
    }),
    jobBase(ids.job4, {
      title: t('demo.data.job4'), location: 'Stuttgart', salary_min: 50000, salary_max: 60000, industry: t('demo.data.industryMedtech'),
      skills: ['Service', 'Medizintechnik', 'Reisebereitschaft'], description: '', experience_level: 'mid',
      created_at: iso(new Date(now.getTime() - 31 * DAY)), updated_at: iso(new Date(now.getTime() - 9 * DAY)),
    }),
  ];
  const jobs = [job, ...otherJobs];

  // ---- Suche („Ich suche“) ---------------------------------------------------------------
  const startedAt = new Date(now.getTime() - (phase === 'searching' ? 0 : 5) * DAY);
  const endsAt = new Date(startedAt.getTime() + 30 * DAY);
  const submitted = from(phase, 'requested');
  const activation: Row = {
    id: ids.activation, recruiter_id: uid, job_id: ids.job, status: 'active', activated_at: iso(startedAt), ends_at: iso(endsAt),
    paused_at: null, review_hold: false, has_submitted: submitted, first_submission_at: submitted ? iso(new Date(now.getTime() - 3 * DAY)) : null,
    ended_at: null, end_reason: null, slot_until: null, company_revealed_at: iso(startedAt),
  };
  const mySearch: Row = {
    job_id: ids.job, title: job.title, company_name: company, location: 'München', status: 'active', started_at: iso(startedAt),
    ends_at: iso(endsAt), ended_at: null, end_reason: null, slot_until: null, review_hold: false, job_status: 'published',
    job_paused_until: null, job_pause_reason: null, submissions: submitted ? 1 : 0, in_process: submitted ? 1 : 0,
    last_submission_at: submitted ? iso(new Date(now.getTime() - 3 * DAY)) : null, client_declaration: 'no:none',
    client_declaration_id: null, direct_declaration: null, direct_declaration_id: null,
  };

  // ---- Kandidaten ------------------------------------------------------------------------
  const hasCandidate = from(phase, 'candidate');
  const interviewDone = from(phase, 'ready');
  const daniel: Row = {
    id: ids.candidate, recruiter_id: uid, full_name: 'Daniel Roth', email: 'daniel.roth@example.com', phone: '+49 151 2345 6789',
    linkedin_url: null, job_title: t('demo.data.candidateTitle'), target_roles: [t('demo.data.job1Short')], company: t('demo.data.candidateEmployer'),
    candidate_status: 'new', experience_years: 9, expected_salary: 88000, salary_expectation_min: 82000, current_salary: 79000,
    notice_period: '3_months', remote_preference: 'hybrid', city: 'München', max_commute_minutes: 45, relocation_willing: false,
    residence_status: 'citizen', skills: ['SAP CO', 'Konzernreporting', 'IFRS', 'Power BI'], availability_date: null,
    summary: t('demo.data.candidateSummary'), created_at: iso(new Date(now.getTime() - 4 * DAY)), updated_at: iso(new Date(now.getTime() - 1 * DAY)),
  };
  const others: Row[] = [
    { id: ids.candidate2, recruiter_id: uid, full_name: 'Laura Martens', email: 'laura.martens@example.com', phone: null, linkedin_url: null,
      job_title: t('demo.data.candidate2Title'), company: null, candidate_status: 'interview', experience_years: 14, expected_salary: 135000,
      skills: ['B2B-Vertrieb', 'Führung'], created_at: iso(new Date(now.getTime() - 12 * DAY)), availability_date: null },
    { id: ids.candidate3, recruiter_id: uid, full_name: 'Jonas Weber', email: 'jonas.weber@example.com', phone: null, linkedin_url: null,
      job_title: t('demo.data.candidate3Title'), company: null, candidate_status: 'new', experience_years: 6, expected_salary: 56000,
      skills: ['DATEV', 'Lohn'], created_at: iso(new Date(now.getTime() - 9 * DAY)), availability_date: null },
  ];
  const candidates = hasCandidate ? [daniel, ...others] : [];
  const cvDoc: Row = {
    id: '00000000-0000-4000-a000-0000000b0090', candidate_id: ids.candidate, document_type: 'cv', is_current: true, version: 1,
    file_name: 'Lebenslauf_Daniel_Roth.pdf', file_url: '/tour/lebenslauf-daniel-roth.pdf', created_at: iso(new Date(now.getTime() - 4 * DAY)),
    confirmed_current_at: null,
  };
  const interviewDate = new Date(now.getTime() - 1 * DAY);
  const notes: Row = {
    id: '00000000-0000-4000-a000-0000000b0091', candidate_id: ids.candidate, recruiter_id: uid, updated_at: iso(new Date(now.getTime() - 1 * DAY)),
    created_at: iso(new Date(now.getTime() - 3 * DAY)), change_motivation: t('demo.data.motivation'), recommendation_level: 'yes',
    ...(interviewDone ? {
      status: 'completed', interview_date: ymd(interviewDate), interview_type: 'video', why_now: t('demo.data.whyNow'),
      summary_motivation: t('demo.data.motivation'), presentation_consent: true, presentation_consent_at: iso(interviewDate),
      offer_requirements: [t('demo.data.requirement1'), t('demo.data.requirement2')],
    } : { status: 'draft', interview_date: null }),
  };
  const booking: Row = {
    id: '00000000-0000-4000-a000-0000000b0092', recruiter_id: uid, candidate_id: ids.candidate, job_id: null, status: 'booked',
    starts_at: iso(at(now, 1, 10)), ends_at: iso(at(now, 1, 10, 30)), mode: 'teams', join_url: 'https://teams.microsoft.com/l/meetup-join/beispiel',
    phone: null, first_name: 'Daniel', last_name: 'Roth', email: 'daniel.roth@example.com', source: 'einladung', note: null,
  };
  const experiences: Row[] = [
    { id: '00000000-0000-4000-a000-0000000b0093', candidate_id: ids.candidate, company_name: t('demo.data.candidateEmployer'), title: t('demo.data.candidateTitle'),
      start_date: '2020-04-01', end_date: null, is_current: true, sort_order: 0, description: t('demo.data.career1') },
    { id: '00000000-0000-4000-a000-0000000b0094', candidate_id: ids.candidate, company_name: t('demo.data.candidateEmployer2'), title: t('demo.data.candidateTitle2'),
      start_date: '2016-01-01', end_date: '2020-03-31', is_current: false, sort_order: 1, description: t('demo.data.career2') },
  ];

  // ---- Matching (match-v41) --------------------------------------------------------------
  const requirements = [1, 2, 3].map((n) => ({ id: `r${n}`, text: t(`demo.data.req${n}`), class: 'must', status: 'met', evidence: t(`demo.data.req${n}Evidence`), note: '' }));
  const matchItem = {
    job_id: ids.job, version: '4.1', tier: 'sehr_passend', label: t('demo.data.matchLabel'), sort_score: 0.9, confidence: 0.85, exclusion: null, caps: [],
    requirements, frame: [{ key: 'blocked', status: 'ok', text: '' }], summary: t('demo.data.matchSummary'), reasons: [], gaps: [], talking_points: [], override: null,
  };
  const matchResponse = {
    version: '4.1', candidate_id: ids.candidate, pending: [],
    stats: { jobs: 1, cached: 1, judged_now: 0, without_ai: 0, pending: 0, candidate_understood_by_ai: true, ms: 0 }, results: [matchItem],
  };

  // ---- Vorgang ab der Vorstellung --------------------------------------------------------
  // Daniel bei Nordwerk; dazu zwei laufende Vorgänge, damit „Aufgaben“ lebhaft aussieht:
  // Laura Martens (Nachgespräch fällig) und Jonas Weber (Kunde prüft seit 6 Tagen).
  const scheduled = from(phase, 'scheduled');
  const talkedDone = from(phase, 'interviewed');
  const danielStage = phase === 'requested' ? 'interview_requested' : phase === 'scheduled' ? 'interview_scheduled'
    : phase === 'interviewed' || phase === 'offerWanted' ? 'interview_completed' : phase === 'offer' ? 'offer' : 'placed';
  const embedCandidate = (id: string, name: string, email: string) => ({ full_name: name, phone: '+49 151 2345 6789', email, id });
  const subDaniel: Row = {
    id: ids.submission, recruiter_id: uid, candidate_id: ids.candidate, job_id: ids.job, stage: danielStage,
    status: phase === 'placed' ? 'placed' : phase === 'offer' ? 'offer' : 'interview', identity_unlocked: scheduled, company_revealed: true,
    full_access_granted: false, opt_in_requested_at: iso(new Date(now.getTime() - 3 * 3600_000)), submitted_at: iso(new Date(now.getTime() - 3 * DAY)),
    updated_at: iso(new Date(now.getTime() - 3 * 3600_000)), match_score: null, consent_confirmed: true,
    candidates: embedCandidate(ids.candidate, 'Daniel Roth', 'daniel.roth@example.com'),
  };
  const subLaura: Row = {
    id: ids.submission2, recruiter_id: uid, candidate_id: ids.candidate2, job_id: ids.job2, stage: 'interview_completed', status: 'interview',
    identity_unlocked: true, company_revealed: true, submitted_at: iso(new Date(now.getTime() - 14 * DAY)), updated_at: iso(new Date(now.getTime() - 1 * DAY)),
    candidates: embedCandidate(ids.candidate2, 'Laura Martens', 'laura.martens@example.com'),
  };
  const subJonas: Row = {
    id: ids.submission3, recruiter_id: uid, candidate_id: ids.candidate3, job_id: ids.job3, stage: 'submitted', status: 'submitted',
    identity_unlocked: false, company_revealed: false, submitted_at: iso(new Date(now.getTime() - 6 * DAY - 2 * 3600_000)),
    updated_at: iso(new Date(now.getTime() - 6 * DAY - 2 * 3600_000)),
    candidates: embedCandidate(ids.candidate3, 'Jonas Weber', 'jonas.weber@example.com'),
  };
  const submissions = submitted ? [subDaniel, subLaura, subJonas] : [];
  // Interview-Zeilen tragen den Vorgang eingebettet (die Seiten lesen `submissions!inner(...)`).
  const embedSub = (sub: Row) => ({ id: sub.id, recruiter_id: uid, candidate_id: sub.candidate_id, job_id: sub.job_id, company_revealed: true,
    status: sub.status, stage: sub.stage, candidates: sub.candidates });
  // Termin heute in gut zwei Stunden (zur vollen Stunde); außerhalb der Bürozeit (abends, nachts,
  // Wochenende) am nächsten Werktag um 10 Uhr. Gleich nach dem Gespräch (Nachgespräch fällig) ist es
  // seit einer Stunde vorbei, später war es gestern um 14 Uhr.
  const soon = (() => {
    const day = now.getDay();
    if (day !== 0 && day !== 6 && now.getHours() >= 7 && now.getHours() <= 15) {
      const d = new Date(now.getTime() + 2 * 3600_000); d.setMinutes(0, 0, 0); return d;
    }
    let d = at(now, now.getHours() > 15 ? 1 : 0, 10);
    while (d.getDay() === 0 || d.getDay() === 6) d = at(d, 1, 10);
    return d;
  })();
  const justNow = new Date(now.getTime() - 2 * 3600_000); justNow.setMinutes(0, 0, 0);
  const talkedAt = phase === 'interviewed' ? justNow : at(now, -1, 14);
  const ivDaniel: Row = {
    id: ids.interview, submission_id: ids.submission, scheduled_at: phase === 'requested' ? null : iso(talkedDone ? talkedAt : soon),
    duration_minutes: 60, status: phase === 'requested' ? 'pending_response' : talkedDone ? 'completed' : 'scheduled', meeting_type: 'video',
    meeting_format: 'video', meeting_link: 'https://meet.google.com/abc-defg-hij', teams_join_url: null, google_meet_link: null, round: 1,
    proposed_slots: phase === 'requested' ? [iso(at(now, 2, 10)), iso(at(now, 2, 14)), iso(at(now, 3, 11))] : [], counter_slots: null,
    feedback: from(phase, 'offerWanted') ? JSON.stringify({ recommendation: 'offer', impression: t('demo.data.clientImpression') }) : null,
    created_at: iso(new Date(now.getTime() - 3 * 3600_000)), allow_alternative: true, submissions: embedSub(subDaniel),
  };
  const ivLaura: Row = {
    id: ids.interview2, submission_id: ids.submission2, scheduled_at: iso(at(now, -1, 15)), duration_minutes: 60, status: 'completed',
    meeting_type: 'video', meeting_format: 'video', meeting_link: null, teams_join_url: null, google_meet_link: null, round: 2,
    proposed_slots: [], counter_slots: null, feedback: null, created_at: iso(new Date(now.getTime() - 6 * DAY)), submissions: embedSub(subLaura),
  };
  const interviews = submitted ? [ivDaniel, ivLaura] : [];
  const notifications: Row[] = submitted ? [{
    id: '00000000-0000-4000-a000-0000000b00a0', user_id: uid, type: 'interview_requested',
    title: t('demo.data.notifyRequested', { company, name: 'Daniel Roth' }), message: t('demo.data.notifyRequestedBody', { job: job.title, name: 'Daniel Roth' }),
    is_read: phase !== 'requested', related_type: 'interview', related_id: ids.interview,
    created_at: iso(new Date(now.getTime() - (phase === 'requested' ? 60_000 : 3 * 3600_000))),
  }] : [];

  // Nachgespräch (für Empfehlung und Angebot schon geführt).
  const startDate = (() => { const d = new Date(now.getFullYear(), now.getMonth() + 4, 1); return ymd(d); })();
  const nachgespraech = from(phase, 'offerWanted') ? {
    created_at: iso(new Date(now.getTime() - 20 * 3600_000)), gehalt_besprochen: true, gehalt_kandidat: 88000, angebot_fix_min: 85000,
    angebot_punkte: ['bonus'], angebot_text: '', start_art: 'fester_tag', start_datum: startDate, bedenken: '', will_weiter: 'ja', bauchgefuehl: 'gut',
  } : null;

  // Angebot: Mail an Daniel geht in gut anderthalb Stunden von selbst raus, solange nicht angerufen.
  const state = { talked: false };
  const offerRow: Row = {
    id: ids.offer, submission_id: ids.submission, recruiter_id: uid, status: 'with_recruiter', sent_at: iso(new Date(now.getTime() - 20 * 60_000)),
    created_at: iso(new Date(now.getTime() - 20 * 60_000)), response_due: ymd(new Date(now.getTime() + 5 * DAY)), candidate_response: null,
    candidate_mail_due_at: iso(new Date(now.getTime() + 100 * 60_000)), candidate_mail_sent_at: null, salary_offered: 88000,
    submissions: { ...embedSub(subDaniel) },
  };
  const currentOffer = () => ({
    id: ids.offer, status: 'with_recruiter', version: 1, salary: 88000, variable: 8000, startDate, responseDue: ymd(new Date(now.getTime() + 5 * DAY)),
    contractType: 'permanent', probationMonths: 6, workModel: t('demo.data.workModel'), extras: [t('demo.data.extraBonus')], message: null,
    sentAt: offerRow.sent_at, response: null, respondedAt: null, candidateMessage: null,
    candidate: {
      mailDueAt: iso(new Date(Date.now() + 100 * 60_000)), mailSent: state.talked, mailSentAt: state.talked ? iso(new Date()) : null,
      talkedAt: state.talked ? iso(new Date()) : null, callbackAt: null, callbackTopic: null, callbackDueAt: null, reminderDueAt: null,
      acceptReportedAt: null, confirmedAt: null, answeredByCandidate: false, notConfirmedAt: null,
    },
  });
  const recruiterContext = () => ({
    submissionId: ids.submission, candidateId: ids.candidate, candidateName: 'Daniel Roth', candidatePhone: '+49 151 2345 6789',
    companyName: company, jobTitle: job.title, salaryMin: 80000, salaryMax: 95000,
    akte: { expectedSalary: 88000, noticePeriod: '3_months', availabilityDate: null }, nachgespraech,
    recommendation: null, currentOffer: phase === 'offer' ? currentOffer() : null,
    lastInterview: { id: ids.interview, scheduledAt: ivDaniel.scheduled_at },
    clientFeedback: { way: 'offer', impression: t('demo.data.clientImpression'), question: null, at: iso(new Date(now.getTime() - 22 * 3600_000)) },
  });

  // Besetzung: angetreten, Rechnung bezahlt, 1. Teil fällig (Beispiel, Zeit gerafft).
  const started = new Date(now.getTime() - 14 * DAY);
  const guaranteeUntil = new Date(started.getTime() + 90 * DAY);
  const de = (d: Date) => d.toLocaleDateString(input.lang === 'de' ? 'de-DE' : input.lang, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const latest = new Date(now.getFullYear(), now.getMonth() + 1, 14);
  const part = 880000;
  const chain = [
    { label: t('demo.data.chainContract'), state: 'done' }, { label: t('demo.data.chainInvoice'), state: 'done' },
    { label: t('demo.data.chainPaid'), state: 'done' }, { label: t('demo.data.chainStarted'), state: 'done' },
    { label: t('demo.data.chainPart1'), state: 'current' }, { label: t('demo.data.chainGuarantee'), state: 'todo' }, { label: t('demo.data.chainPart2'), state: 'todo' },
  ];
  const slot = { period: ymd(now).slice(0, 7), runMonth: ymd(nextMonth).slice(0, 7), label: t('demo.data.slotLabel', { date: de(nextMonth) }),
    short: de(nextMonth), latest: ymd(latest) };
  const overview = {
    today: ymd(now), year: String(now.getFullYear()), taxMode: 'standard', creditNoteCount: 0, payoutGaps: [],
    totals: { receivedYearCents: 0, waitingStartCents: 0, waitingPaymentCents: 0, waitingGuaranteeCents: part },
    next: { slot, netCents: part, vatCents: Math.round(part * 0.19), lines: [{ placementId: ids.placement, trancheId: 't1', label: t('demo.data.part1Line'), cents: part }] },
    upcoming: [] as unknown[],
    rows: [{ placementId: ids.placement, candidateName: 'Daniel Roth', companyName: company, jobTitle: job.title, packageLabel: 'Core',
      status: null, amountCents: part, amountSub: t('demo.data.part2Sub', { date: de(guaranteeUntil) }), active: true, createdAt: iso(started), chain }],
  };
  overview.upcoming = [overview.next];
  const placementView = {
    placementId: ids.placement, submissionId: ids.submission, candidateName: 'Daniel Roth', firstName: 'Daniel', jobTitle: job.title, companyName: company,
    subtitle: t('demo.data.placementSubtitle', { company, date: de(started) }),
    figures: [
      { key: 'basis', label: t('demo.data.figureBasis'), value: '88.000 €', note: t('demo.data.figureBasisNote') },
      { key: 'part1', label: t('demo.data.figurePart1'), value: '8.800 €' },
      { key: 'part2', label: t('demo.data.figurePart2'), value: '8.800 €' },
    ],
    caseTitle: null, box: null, footer: null, jobLink: null, canStatement: false, statement: null,
    steps: [
      { state: 'done', text: t('demo.data.stepContract'), date: de(new Date(started.getTime() - 60 * DAY)) },
      { state: 'done', text: t('demo.data.stepInvoice'), date: de(new Date(started.getTime() - 30 * DAY)) },
      { state: 'done', text: t('demo.data.stepPaid', { company }), date: de(new Date(started.getTime() - 16 * DAY)) },
      { state: 'done', text: t('demo.data.stepStarted'), date: de(started) },
      { state: 'current', text: t('demo.data.stepPart1', { date: de(latest) }), date: de(latest) },
      { state: 'todo', text: t('demo.data.stepGuarantee', { date: de(guaranteeUntil) }) },
      { state: 'todo', text: t('demo.data.stepPart2') },
    ],
    start: { canReport: false, planned: ymd(started), fixed: true, fixedText: null, box: '' },
    halfway: { possible: false, status: null, at: null, guaranteeUntil: ymd(guaranteeUntil) },
  };

  // ---- Register-Tabellen -----------------------------------------------------------------
  const tables: HhDemoWorld['tables'] = {
    recruiter_jobs_view: jobs,
    jobs,
    recruiter_job_activations: searching ? [activation] : [],
    candidates,
    candidate_documents: hasCandidate ? [cvDoc] : [],
    candidate_interview_notes: hasCandidate ? [notes] : [],
    candidate_languages: hasCandidate ? [
      { candidate_id: ids.candidate, language: 'Deutsch', proficiency: 'Muttersprache' },
      { candidate_id: ids.candidate, language: 'Englisch', proficiency: 'C1' },
    ] : [],
    candidate_experiences: hasCandidate ? experiences : [],
    recruiter_bookings: hasCandidate && !interviewDone ? [booking] : [],
    match_v41_results: hasCandidate ? [{ job_id: ids.job, candidate_id: ids.candidate, tier: 'sehr_passend' }] : [],
    submissions,
    interviews,
    notifications,
    // Lauras Nachgespräch ist schon geführt: Oben unter „Aufgaben“ steht Daniels, nicht ihres.
    interview_nachgespraeche: submitted ? [{ interview_id: ids.interview2, submission_id: ids.submission2, recruiter_id: uid, will_weiter: 'ja' }] : [],
    offers: phase === 'offer' ? [offerRow] : [],
    recruiter_placements_view: phase === 'placed' ? [{ submission_id: ids.submission, retention_release_date: ymd(guaranteeUntil), start_date: ymd(started) }] : [],
  };

  const rpcs: HhDemoWorld['rpcs'] = {
    my_search_capacity: () => ({ used: searching && !submitted ? 1 : 0, limit: 10 }),
    my_searches: () => (searching ? [mySearch] : []),
    my_partner_progress: () => null,
    my_job_post_status: () => [],
    my_contract_tasks: () => [],
    my_submission_jobs: (args) => {
      const wanted = (args?.p_submission_ids as string[] | undefined) ?? [];
      return submissions.filter((sub) => !wanted.length || wanted.includes(sub.id as string)).map((sub) => {
        const j = jobs.find((x) => x.id === sub.job_id)!;
        return { submission_id: sub.id, job_status: 'published', job_title: j.title, job_industry: j.industry, company_name: sub.id === ids.submission3 ? null : company,
          closed_at: null, paused_at: null, pause_until: null, client_view_count: sub.id === ids.submission3 ? 2 : 1, client_last_viewed_at: iso(new Date(now.getTime() - 2 * DAY)) };
      });
    },
    recruiter_interview_attendee_roles: () => [{ title: 'CFO', is_decision_maker: true }],
    start_job_search: () => ({
      activation_id: ids.activation, status: 'active', company_name: company, location: 'München', ends_at: iso(new Date(now.getTime() + 30 * DAY)),
      needs_client_answer: false, slots_used: 1, slot_limit: 10, over_limit: false,
    }),
    end_job_search: () => ({ ok: true }),
    answer_client_question: () => ({ client_declaration_id: null, direct_declaration_id: null }),
  };

  const fns: HhDemoWorld['fns'] = {
    abrechnung: (body) => {
      if (body?.action === 'job_terms') return { terms: ((body.jobIds as string[] | undefined) ?? jobs.map((j) => j.id as string)).map(terms) };
      if (body?.action === 'overview') return phase === 'placed' ? overview : { ...overview, next: null, upcoming: [], rows: [], totals: { receivedYearCents: 0, waitingStartCents: 0, waitingPaymentCents: 0, waitingGuaranteeCents: 0 } };
      if (body?.action === 'placement') return { view: placementView, taxMode: 'standard' };
      if (body?.action === 'credit_notes') return { notes: [], upcoming: phase === 'placed' ? [overview.next] : [], taxMode: 'standard', years: [String(now.getFullYear())] };
      return { ok: true };
    },
    offer: (body) => {
      if (body?.action === 'recruiter_context') return recruiterContext();
      if (body?.action === 'talked') { state.talked = true; return { ok: true }; }
      if (body?.action === 'respond') return { ok: true, offer: { ...currentOffer(), status: 'accept_reported' }, awaitingConfirmation: true };
      return { ok: true };
    },
    'match-v41': () => matchResponse,
    'calendar-connect': () => ({ state: 'disconnected', provider: null, accountEmail: null, itRequest: null }),
  };

  return {
    phase, ids, user, now, companyName: company, candidateName: 'Daniel Roth', jobTitle: String(job.title),
    interviewLabel: soon.toLocaleString(input.lang === 'de' ? 'de-DE' : input.lang, { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
    fill: { salary: 88000, homeoffice: t('demo.data.requirement1'), whyNow: t('demo.data.whyNow'), cvFile: 'Lebenslauf_Daniel_Roth.pdf' }, tables, rpcs, fns,
  };
}

/** Echt gelesen: das eigene Profil (Kopfzeile, Kontakt in der Anzeige) und die Rollen. */
const REAL_READS = new Set(['profiles', 'user_roles']);
/** Im Beispiel bewusst leer (keine Meldung in der Konsole). */
const EMPTY = new Set(['candidate_activity_log', 'candidate_invites', 'messages', 'influence_alerts', 'recruiter_tasks', 'cv_requests',
  'interview_feedback', 'interview_nachgespraeche', 'offer_recommendations', 'candidate_tags', 'candidate_tag_assignments',
  'candidate_capture_sources', 'match_v41_overrides', 'recruiter_booking_pages', 'recruiter_client_declarations', 'consents', 'talent_pool']);
/** Echt gelesen: die Liga in der Seitenleiste. */
const REAL_RPCS = new Set(['liga_me']);
/**
 * Echt: Prüfungen außerhalb der Bühne, die zufällig laufen, während sie offen ist. Die
 * Zugangsprüfung (RecruiterAccessGate) schickte sonst beim Neuladen ins Onboarding.
 */
const realFunction = (name: string, body: Record<string, unknown> | undefined) =>
  name === 'recruiter-onboarding' && body?.action === 'access';

/** Im Entwicklungsmodus: Abfragen ohne Beispieldaten in der Konsole melden. */
const debug = import.meta.env.DEV;

export function hhDemoRegistry(world: HhDemoWorld): DemoRegistry {
  return {
    table: (q) => {
      if (q.kind !== 'select') return [];
      // Filter auf verknüpfte Spalten (`submissions.recruiter_id`) kann demoBackend nicht prüfen; die
      // Zeilen hier gehören ohnehin dem Headhunter. like/contains werden ignoriert: lieber leer als alles.
      q.filters = q.filters.filter((f) => !f.col.includes('.'));
      if (q.filters.some((f) => f.op === 'like' || f.op === 'contains')) return [];
      const entry = world.tables[q.table];
      if (entry) return typeof entry === 'function' ? entry(q) : entry;
      if (REAL_READS.has(q.table)) return null;
      if (debug && !EMPTY.has(q.table)) console.debug('[hh-demo] Tabelle ohne Beispiel', q.table, q.columns, q.filters);
      return [];
    },
    rpc: (name, args) => {
      const fn = world.rpcs[name];
      if (fn) return fn(args as Record<string, unknown> | undefined);
      if (REAL_RPCS.has(name)) return undefined;
      if (debug) console.debug('[hh-demo] RPC ohne Beispiel', name, args);
      return null;
    },
    fn: (name, body) => {
      if (realFunction(name, body as Record<string, unknown> | undefined)) return null;
      const fn = world.fns[name];
      if (fn) return fn(body as Record<string, unknown> | undefined) ?? { ok: true };
      if (debug) console.debug('[hh-demo] Function ohne Beispiel', name, body);
      return { ok: true };
    },
  };
}
