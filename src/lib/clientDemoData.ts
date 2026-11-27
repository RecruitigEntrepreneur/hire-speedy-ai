/**
 * Beispieldaten für die ECHTEN Seiten im Kunden-Rundgang (Demo-Modus, 16.11.2026).
 *
 * Marko: „Die ganze Seite ausgefüllt sehen, wie es realistisch aussieht, damit der Kunde
 * später nicht sagt, jetzt sieht es anders aus.“ Darum zeigt die Bühne die echten Seiten
 * (Bewerberprofil, Anfrage-, Feedback-, Angebots- und Vertragsfenster, Interviews,
 * Besetzungen, Aufgaben), und dieses Modul beantwortet ihre Datenabfragen mit einem
 * Beispielkandidaten an der EIGENEN Stelle des Kunden (lib/clientDemo.ts).
 *
 * - Lesen: Tabellen, Sichten, Functions und RPCs der Bewerbung kommen von hier; alles andere
 *   (Konto, Team, Glocke, Nachrichten) liest weiter echt.
 * - Schreiben, Senden und jede unbekannte Aktion gehen nie raus (lib/demoBackend.ts).
 *
 * Der Stand der Geschichte heißt `DemoPhase`: vom anonymen Profil bis zum unterschriebenen
 * Vertrag. Texte kommen aus `clientGuide:demo.data.*` in der Sprache der Oberfläche.
 */
import type { DemoQuery, DemoRegistry } from './demoBackend';
import { DEMO, DEMO_IDS, type TourData } from './clientDemo';

export { DEMO_IDS };
import { fmtDate, fmtDayMonth, fmtMoney, fmtTime, fmtWeekdayDayMonth } from './localeFormat';
import { DEFAULT_INTERVIEW_HOURS } from './interviewScheduling';
import { PACKAGES, isPackageKey } from './pricing/packages';

/** `job`: nur die Stelle, noch ohne Kandidat (Meine Stellen ohne eigene Stelle). */
export type DemoPhase = 'job' | 'review' | 'scheduled' | 'interviewed' | 'recommended' | 'accepted' | 'signed';
/** Postfächer für alle: Dort hat die Firma keine eigene Domain, die Kollegin bekommt die Beispieladresse. */
const FREEMAIL = new Set(['gmail.com', 'googlemail.com', 'web.de', 'gmx.de', 'gmx.net', 'gmx.at', 'gmx.ch', 'gmx.com', 'outlook.com', 'outlook.de',
  'hotmail.com', 'hotmail.de', 'live.com', 'live.de', 'yahoo.com', 'yahoo.de', 'icloud.com', 'me.com', 'mac.com', 't-online.de', 'aol.com',
  'freenet.de', 'posteo.de', 'mailbox.org', 'proton.me', 'protonmail.com', 'mail.de', 'arcor.de', 'online.de']);

/**
 * Adresse der Beispiel-Kollegin beim Einladen: mit der Firmen-Domain des Kunden (Marko 18.11.: „näher am
 * Kunden“). Bei einem Postfach für alle oder ohne Adresse bleibt die Beispieladresse. Verschickt wird nichts.
 */
export function colleagueAddress(example: string, userEmail: string | null | undefined): string {
  const domain = userEmail?.split('@')[1]?.trim().toLowerCase();
  const local = example.split('@')[0];
  return domain && domain.includes('.') && !FREEMAIL.has(domain) ? `${local}@${domain}` : example;
}

export const DEMO_PHASES: DemoPhase[] = ['job', 'review', 'scheduled', 'interviewed', 'recommended', 'accepted', 'signed'];
const reached = (phase: DemoPhase, from: DemoPhase) => DEMO_PHASES.indexOf(phase) >= DEMO_PHASES.indexOf(from);

/** Die Spalten der echten Stelle, die das Beispiel nutzt (alles optional, `select('*')`). */
export interface DemoJobRow {
  id?: string;
  title?: string | null;
  location?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  employment_type?: string | null;
  remote_type?: string | null;
  onsite_days_required?: number | null;
  benefits?: unknown;
  skills?: unknown;
  must_haves?: unknown;
  industry?: string | null;
  company_name?: string | null;
  day_rate_min?: number | null;
  day_rate_max?: number | null;
  contract_duration_months?: number | null;
  utilization_days_per_week?: number | null;
  experience_level?: string | null;
}

export interface DemoInput {
  phase: DemoPhase;
  tour: TourData;
  job: DemoJobRow | null;
  user: { id: string; name: string; email: string };
  companyName: string | null;
  /** Honorar laut Rahmenvertrag; ohne Vertrag keine Zeile. */
  feePercent: number | null;
  /** Paket laut Rahmenvertrag (`package_key`); ohne Vertrag das öffentliche Core-Paket. */
  packageKey?: string | null;
  now: Date;
  lang: string;
  /** „Meine Stellen“, wie die Stelle läuft: live, drei Kandidaten, zwei Headhunter (Marko 17.11.). */
  liveJob?: boolean;
  /** Hat der Kunde schon ein Team (Organisation)? Sonst eine Beispiel-Firma für „Team“. */
  hasOrg?: boolean;
  /** Übersetzer mit `clientGuide` als Standard und `offers` für die Felder der Empfehlung. */
  t: (key: string, options?: Record<string, unknown>) => string;
}

type Row = Record<string, unknown>;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const iso = (d: Date | number) => new Date(d).toISOString();
/** YYYY-MM-DD in Ortszeit (Startdatum, Fristen). */
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x ?? '').trim()).filter(Boolean) : []);
/** „3–5“ → „3-5 Jahre“, „10+“ → „10+ Jahre“: das Format von anon_experience_band. */
const bandOfYears = (years: string) => (years.includes('+') ? `${years.replace('+', '')}+ Jahre` : `${years.replace('–', '-')} Jahre`);
/** Mitte der Jahresspanne als Zahl, für Werdegang und „Jahre Erfahrung“. */
const yearsNumber = (years: string) => {
  const [lo, hi] = years.replace('+', '').split('–').map(Number);
  return hi ? Math.round((lo + hi) / 2) : lo + 2;
};
const SENIORITY: Record<string, string> = { '1–3': 'Junior', '3–5': 'Mid-Level', '5–10': 'Senior', '10+': 'Lead' };

/** Plus n Werktage (Mo–Fr). */
function plusWorkdays(from: Date, n: number): Date {
  const d = new Date(from);
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) left -= 1;
  }
  return d;
}

/** Letzter Werktag vor heute, zur vollen Stunde. */
function lastWorkday(from: Date, hour: number): Date {
  const d = new Date(from);
  do d.setDate(d.getDate() - 1); while (d.getDay() === 0 || d.getDay() === 6);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/**
 * Alles, was die echten Seiten im Beispiel lesen, für einen Stand der Geschichte.
 * Rein und vorhersagbar: dieselben Eingaben ergeben dieselben Zeilen (Tests in clientDemoData.test.ts).
 */
export function demoWorld(input: DemoInput) {
  const { phase, tour, job, user, now, lang, t } = input;
  const unlocked = reached(phase, 'scheduled');
  const contracting = tour.contracting;
  const jobId = tour.jobId ?? DEMO_IDS.job;
  const hh = DEMO.headhunter;
  const hhFirst = hh.split(' ')[0];
  const name = DEMO.name;
  const first = name.split(' ')[0];
  const label = unlocked ? name : DEMO.code;
  const company = input.companyName?.trim() || job?.company_name?.trim() || t('demo.data.yourCompany');

  // ---- Zeitachse. Jeder Stand ist in sich stimmig und liegt nie in der Zukunft, außer dem
  // anstehenden Interview: Bis zur Zusage steht es am nächsten Werktag; ab dem Feedback liegt es
  // am letzten Werktag zurück (sonst zeigte das echte Feedback-Fenster „erst nach dem Gespräch“).
  const past = reached(phase, 'interviewed');
  const ivAt = past ? lastWorkday(now, 14) : tour.interviewAt;
  const ivMinutes = 45;
  const submittedAt = past ? new Date(ivAt.getTime() - 3 * DAY) : phase === 'scheduled' ? new Date(now.getTime() - DAY) : new Date(now.getTime() - 2 * HOUR);
  const requestedAt = past ? new Date(ivAt.getTime() - 2 * DAY) : new Date(now.getTime() - 3 * HOUR);
  const feedbackAt = new Date(ivAt.getTime() + 2 * HOUR);
  const recAt = new Date(Math.min(ivAt.getTime() + 20 * HOUR, now.getTime() - 30 * 60_000));
  const offerAt = new Date(Math.min(recAt.getTime() + HOUR, now.getTime() - 20 * 60_000));
  // Die Zusage ist frisch: Der Rundgang feiert sie als Meldung (Schritt c-accepted), die Glocke sagt dann nicht „vor 2 Tagen“.
  const acceptedAt = new Date(now.getTime() - 10 * 60_000);
  const signedAt = new Date(now.getTime() - 5 * 60_000);
  const start = tour.startAt;
  const responseDue = plusWorkdays(offerAt, 5);
  const talkAt = new Date(submittedAt.getTime() - 3 * DAY);

  const when = (d: Date) => `${fmtWeekdayDayMonth(d, lang)}, ${fmtTime(d, lang)}`;
  const euro = (n: number) => fmtMoney(n, lang);
  const tsd = (n: number) => Math.round(n / 1000);
  const wish = tour.wish ? t('demo.data.band', { from: tsd(tour.wish.min), to: tsd(tour.wish.max) }) : null;
  const offerSalary = tour.offer ?? 0;
  const years = yearsNumber(tour.years);
  const city = tour.region ?? tour.location ?? null;
  const benefits = list(job?.benefits);
  const workModel = (() => {
    const remote = job?.remote_type ?? tour.remote;
    const days = job?.onsite_days_required;
    const model = remote === 'remote' ? t('demo.data.model.remote')
      : remote === 'hybrid' ? t('demo.data.model.hybrid', { n: days && days < 5 ? days : 3 })
        : t('demo.data.model.onsite');
    return [tour.location, model].filter(Boolean).join(' · ');
  })();
  const criteria = tour.criteria;
  // Fähigkeiten: aus der Stelle; fehlen sie, kurze Stichworte aus den Muss-Kriterien und die Branche.
  const tag = (c: string) => {
    const head = c.split(' (')[0].trim();
    if (head.length <= 40) return head;
    const words = head.split(/\s+/);
    let out = '';
    for (const w of words) { if (`${out} ${w}`.trim().length > 36) break; out = `${out} ${w}`.trim(); }
    return out;
  };
  const skills = [...new Set([
    ...list(job?.skills),
    ...list(job?.must_haves).filter((c) => !/verfügbar|available|tillgänglig|tilgjengelig|sofort/i.test(c)).map(tag),
    ...(job?.industry ? [job.industry] : []),
  ].filter(Boolean))].slice(0, 7);

  // ---- Bewerbung und Kandidat ------------------------------------------------------------------
  const stage = reached(phase, 'accepted') ? 'offer' : unlocked ? 'interview' : 'submitted';
  const view: Row = {
    submission_id: DEMO_IDS.submission,
    candidate_id: DEMO_IDS.candidate,
    job_id: jobId,
    client_id: user.id,
    status: stage,
    stage,
    match_score: null,
    identity_unlocked: unlocked,
    recruiter_notes: t('demo.data.hhNote'),
    job_title: tour.title,
    job_industry: job?.industry ?? null,
    job_company_name: company,
    candidate_role: tour.role,
    seniority: SENIORITY[tour.years] ?? 'Mid-Level',
    skills: skills.length ? skills : [t('demo.data.skillFallback')],
    certifications: [],
    language_skills: [{ language: 'Deutsch', level: 'Muttersprache' }, { language: 'Englisch', level: 'C1' }],
    industry_experience: job?.industry ? [job.industry] : [],
    target_roles: [tour.role],
    notice_period: '3_months_eom',
    availability_date: null,
    remote_preference: tour.remote ?? 'onsite',
    relocation_willing: false,
    remote_days_preferred: null,
    region_broad: city ? t('demo.data.region', { city }) : 'DACH',
    experience_band: bandOfYears(tour.years),
    salary_band: contracting ? null : wish,
    full_name: unlocked ? name : null,
    email: unlocked ? 'daniel.roth@beispiel.de' : null,
    phone: unlocked ? '+49 151 0000 0000' : null,
    cv_url: null,
    linkedin_url: null,
    city: unlocked ? city : null,
    experience_years: unlocked ? years : null,
    cv_ai_summary: null,
    submitted_at: iso(submittedAt),
    organization_id: null,
  };

  const summary: Row = {
    submission_id: DEMO_IDS.submission,
    recommendation: null,
    key_selling_points: [],
    change_motivation_status: 'aktiv',
    career_goals: t('demo.data.careerGoals', { role: tour.role }),
    role_archetype: null,
    fit_assessment: null,
    executive_summary: null,
    deal_probability: null,
  };

  const talk: Row = {
    submission_id: DEMO_IDS.submission,
    interview_date: iso(talkAt),
    interview_type: 'phone',
    change_motivation: t('demo.data.whyChange'),
    change_motivation_tags: [],
    why_now: city ? t('demo.data.whyNowRegion') : t('demo.data.whyNow'),
    offer_requirements: ['Weiterbildung', 'Kurzer Arbeitsweg'],
    notice_period: '3_months_eom',
    earliest_start_date: ymd(start),
    leadership_scope: 'none',
    leadership_team_size: null,
    other_applications: 'early',
    salary_wish: contracting ? null : wish,
  };

  const [c1, c2] = criteria;
  const fit: Row = {
    id: `${DEMO_IDS.submission}-fit`,
    submission_id: DEMO_IDS.submission,
    candidate_id: DEMO_IDS.candidate,
    job_id: jobId,
    overall_verdict: 'good_fit',
    overall_score: 0,
    executive_summary: t('demo.data.fitSummary', { role: tour.role, n: years }),
    verdict_confidence: 'medium',
    requirement_assessments: [
      c1 && { requirement: c1, requirement_type: 'must_have', verdict: 'fulfilled', evidence: [t('demo.data.mustMet')], reasoning: '', score: 80 },
      c2 && { requirement: c2, requirement_type: 'must_have', verdict: 'partially_fulfilled', evidence: [t('demo.data.mustOpen')], reasoning: '', score: 60 },
    ].filter(Boolean),
    bonus_qualifications: [
      { qualification: t('demo.data.bonus1'), relevance: 'high', evidence: '', potential_value: '' },
      { qualification: t('demo.data.bonus2'), relevance: 'medium', evidence: '', potential_value: '' },
    ],
    gap_analysis: [{ requirement: c2 ? t('demo.data.gapCriterion', { criterion: c2 }) : t('demo.data.gapGeneric'), gap_severity: 'minor', mitigation_suggestion: '' }],
    career_trajectory: { trajectory_type: 'ascending', trajectory_summary: '', growth_velocity: 'normal' },
    implicit_competencies: [],
    motivation_fit: null,
    dimension_scores: { technical: 0, experience: 0, leadership: 0, cultural: 0, growth_potential: 0 },
    rejection_reasoning: null,
    model_used: 'beispiel',
    prompt_version: 'beispiel',
    generation_time_ms: null,
    generated_at: iso(submittedAt),
    created_at: iso(submittedAt),
  };

  const currentSince = new Date(now.getFullYear() - Math.min(years, 4), 2, 1);
  const earlierSince = new Date(currentSince.getFullYear() - Math.max(2, years - 4), 8, 1);
  const experiences: Row[] = [
    {
      id: `${DEMO_IDS.submission}-exp1`, submission_id: DEMO_IDS.submission, candidate_id: DEMO_IDS.candidate,
      job_title: tour.role, start_date: ymd(currentSince), end_date: null, is_current: true, sort_order: 0,
      identity_unlocked: unlocked, company_name: unlocked ? t('demo.data.company1') : null,
      description: [c1 ? t('demo.data.exp1LineCriterion', { criterion: c1 }) : t('demo.data.exp1Line1'), t('demo.data.exp1Line2'), t('demo.data.exp1Line3')].join('\n'),
    },
    {
      id: `${DEMO_IDS.submission}-exp2`, submission_id: DEMO_IDS.submission, candidate_id: DEMO_IDS.candidate,
      job_title: tour.role, start_date: ymd(earlierSince), end_date: ymd(new Date(currentSince.getFullYear(), 1, 28)), is_current: false, sort_order: 1,
      identity_unlocked: unlocked, company_name: unlocked ? t('demo.data.company2') : null,
      description: [t('demo.data.exp2Line1'), t('demo.data.exp2Line2')].join('\n'),
    },
  ];

  const submission: Row = {
    id: DEMO_IDS.submission, recruiter_id: DEMO_IDS.recruiter, job_id: jobId, candidate_id: DEMO_IDS.candidate,
    status: stage, stage, submitted_at: iso(submittedAt), identity_unlocked: unlocked,
  };

  // ---- Interview -------------------------------------------------------------------------------
  const slots = [ivAt, new Date(ivAt.getTime() + DAY - 4 * HOUR), new Date(ivAt.getTime() + 2 * DAY)].map(iso);
  const feedbackJson = reached(phase, 'recommended')
    ? JSON.stringify({ recommendation: 'offer', impression: t('demo.data.fbImpression'), submitted_at: iso(feedbackAt) })
    : null;
  const interview: Row | null = unlocked ? {
    id: DEMO_IDS.interview, submission_id: DEMO_IDS.submission, status: phase === 'scheduled' ? 'scheduled' : 'completed',
    scheduled_at: iso(ivAt), duration_minutes: ivMinutes, meeting_type: 'video', meeting_format: 'teams',
    meeting_link: 'https://teams.microsoft.com/l/meetup-join/beispiel', teams_join_url: 'https://teams.microsoft.com/l/meetup-join/beispiel',
    google_meet_link: null, onsite_address: null, call_phone: null, notes: null, feedback: feedbackJson,
    proposed_slots: slots, counter_slots: null, candidate_message: null, created_at: iso(requestedAt), cancelled_at: null,
    requested_by: user.id, round: 1, reschedules_interview_id: null,
  } : null;

  // ---- Empfehlung, Angebot, Vertrag ----------------------------------------------------------
  const startText = t('offers:rec.value.from', { value: fmtDate(start, lang) });
  const recommendation = reached(phase, 'recommended') ? {
    intro: contracting ? t('demo.data.recIntroContracting', { first }) : t('demo.data.recIntro', { salary: euro(offerSalary), date: fmtDate(start, lang) }),
    items: [
      ...(contracting ? [] : [{ key: 'fix', label: t('offers:rec.rows.fix'), value: euro(offerSalary) }]),
      { key: 'start', label: t('offers:rec.rows.start'), value: startText },
      { key: 'homeoffice', label: t('offers:rec.rows.homeoffice'), value: t('demo.data.recHomeoffice') },
      { key: 'wichtig', label: t('offers:rec.rows.wichtig'), value: [benefits[0], t('demo.data.recImportant')].filter(Boolean).join(' · ') },
      { key: 'gut_zu_wissen', label: t('offers:rec.rows.gut_zu_wissen'), value: t('demo.data.recGoodToKnow') },
      { key: 'bedenken', label: t('offers:rec.rows.bedenken'), value: t('demo.data.recConcerns') },
    ],
    createdAt: iso(recAt),
  } : null;

  const extras = benefits.slice(0, 3);
  const offerView = reached(phase, 'accepted') ? {
    id: DEMO_IDS.offer, status: 'accepted', version: 1, salary: offerSalary, variable: null, startDate: ymd(start), responseDue: ymd(responseDue),
    contractType: 'permanent', probationMonths: 6, workModel, extras, message: null, sentAt: iso(offerAt),
    response: { way: 'accepted', at: iso(acceptedAt), by: 'candidate' }, respondedAt: iso(acceptedAt), candidateMessage: null,
    candidate: {
      mailDueAt: null, mailSent: true, mailSentAt: iso(offerAt), talkedAt: iso(offerAt), callbackAt: null, callbackTopic: null, callbackDueAt: null,
      reminderDueAt: null, acceptReportedAt: iso(acceptedAt), confirmedAt: iso(acceptedAt), answeredByCandidate: true, notConfirmedAt: null,
    },
  } : null;

  const budget = contracting && (job?.day_rate_min || job?.day_rate_max)
    ? t('demo.data.budget', { range: [job.day_rate_min, job.day_rate_max].filter(Boolean).map((n) => euro(Number(n))).join(' – ') })
    : null;
  const offerContext = {
    submissionId: DEMO_IDS.submission,
    candidateName: unlocked ? name : null,
    identityUnlocked: unlocked,
    recruiterName: hh,
    jobTitle: tour.title,
    companyName: company,
    salaryMin: job?.salary_min ?? tour.band?.min ?? null,
    salaryMax: job?.salary_max ?? tour.band?.max ?? null,
    feePercent: input.feePercent,
    defaults: { workModel, extras: benefits, probationMonths: 6, contractType: 'permanent' },
    recommendation,
    currentOffer: offerView,
    otherOpenOffers: 0,
    contracting: contracting ? {
      budget,
      defaults: { months: job?.contract_duration_months ?? 6, daysPerWeek: job?.utilization_days_per_week ?? 4 },
      request: null,
    } : null,
  };

  const contractStatus = phase === 'signed' ? 'signed' : 'preparing';
  const contractRow: Row | null = reached(phase, 'accepted') ? { status: contractStatus, reported_role: phase === 'signed' ? 'client' : null, created_at: iso(acceptedAt) } : null;
  const contractContext = {
    role: 'client',
    submissionId: DEMO_IDS.submission,
    candidateId: DEMO_IDS.candidate,
    candidateName: name,
    candidateEmail: 'daniel.roth@beispiel.de',
    candidatePhone: '+49 151 0000 0000',
    candidateNotice: t('demo.data.notice'),
    jobTitle: tour.title,
    companyName: company,
    recruiterName: hh,
    reporterName: null,
    feePercent: input.feePercent,
    digitalAvailable: true,
    offer: offerView ? {
      id: DEMO_IDS.offer, salary: offerSalary, variable: null, startDate: ymd(start), contractType: 'permanent',
      probationMonths: 6, workModel, extras, acceptedAt: iso(acceptedAt),
    } : null,
    contract: reached(phase, 'accepted') ? {
      id: DEMO_IDS.contract, way: phase === 'signed' ? 'self' : null, status: contractStatus, sentAt: phase === 'signed' ? iso(acceptedAt) : null,
      companySignerName: null, companySignedAt: null, candidateSignedAt: null, reportedRole: phase === 'signed' ? 'client' : null,
      reportedAt: phase === 'signed' ? iso(signedAt) : null, reportNote: null, signedOn: phase === 'signed' ? ymd(signedAt) : null,
      salary: offerSalary, variable: null, startDate: ymd(start), closeJob: true, undoUntil: null, confirmedAt: null,
      recruiterCheck: null, recruiterCheckNote: null, declineReason: null, dropReason: null, finalAt: null, hasSignedDocument: false,
    } : null,
    signing: null,
    events: [],
  };

  // ---- Aufgaben des Kunden (Texte wie in supabase/functions/_shared/client-tasks.ts) -------------
  const line = [view.experience_band ? t('demo.data.taskYears', { years: tour.years }) : null, contracting ? null : wish, t('demo.data.taskFrom', { date: fmtDayMonth(start, lang) })]
    .filter(Boolean) as string[];
  const context = (over: Row) => ({ ask: null, facts: [], line: [], chip: null, quote: null, compare: null, timeline: null, why: null, foot: null, ...over });
  const task = (over: Row) => ({
    submissionId: DEMO_IDS.submission, jobId, jobTitle: tour.title, who: label, urgent: true, waitingWho: hh, note: null, ref: {}, ...over,
  });
  const tasks: Row[] = [];
  const waiting: Row[] = [];
  if (phase === 'job') {
    // Noch kein Kandidat: keine Aufgabe.
  } else if (phase === 'review') {
    tasks.push(task({
      key: `review:${DEMO_IDS.submission}`, kind: 'review', since: iso(submittedAt), urgent: false,
      title: t('demo.data.tasks.review'), detail: t('demo.data.tasks.reviewDetail', { hh, date: fmtDayMonth(submittedAt, lang) }),
      context: context({
        ask: t('demo.data.tasks.reviewAsk', { who: DEMO.code }),
        facts: [{ key: 'submitted', label: t('demo.data.tasks.submitted'), value: t('demo.data.tasks.submittedBy', { date: fmtDayMonth(submittedAt, lang), hh }), chip: null }],
        line, quote: { by: hh, text: t('demo.data.hhNote') },
      }),
    }));
  } else if (phase === 'scheduled') {
    waiting.push({ key: `iv-date:${DEMO_IDS.interview}`, submissionId: DEMO_IDS.submission, jobId, jobTitle: tour.title, who: label, by: 'date',
      title: t('demo.data.tasks.ivDate', { at: when(ivAt) }), detail: t('demo.data.tasks.ivDateDetail') });
  } else if (phase === 'interviewed') {
    tasks.push(task({
      key: `feedback:${DEMO_IDS.interview}`, kind: 'feedback', since: iso(new Date(Math.min(ivAt.getTime() + ivMinutes * 60_000, now.getTime()))),
      waitingWho: t('demo.data.tasks.feedbackWho', { name, hh: hhFirst }), ref: { interviewId: DEMO_IDS.interview },
      title: t('demo.data.tasks.feedback'), detail: t('demo.data.tasks.feedbackDetail', { at: when(ivAt) }),
      context: context({
        ask: t('demo.data.tasks.feedbackAsk', { name }),
        facts: [{ key: 'meeting', label: t('demo.data.tasks.meeting'), value: `${when(ivAt)} – ${fmtTime(new Date(ivAt.getTime() + ivMinutes * 60_000), lang)} · Teams`, chip: null }],
        line: [t('demo.data.tasks.interviewRound'), when(ivAt), 'Teams'],
        foot: t('demo.data.tasks.feedbackFoot', { name, hh: hhFirst }),
      }),
    }));
  } else if (phase === 'recommended') {
    tasks.push(task({
      key: `offer:${DEMO_IDS.submission}:${DEMO_IDS.recommendation}`, kind: 'make_offer', since: iso(recAt), waitingWho: name, ref: { interviewId: DEMO_IDS.interview },
      title: contracting ? t('demo.data.tasks.einsatz') : t('demo.data.tasks.offer'), detail: t('demo.data.tasks.offerDetail', { hh }),
      context: context({
        ask: t('demo.data.tasks.offerAsk', { name }),
        line: recommendation ? recommendation.items.filter((i) => ['fix', 'start'].includes(i.key)).map((i) => `${i.label} ${i.value}`) : [],
        quote: recommendation ? { by: hh, text: recommendation.intro } : null,
      }),
    }));
  } else if (phase === 'accepted') {
    tasks.push(task({
      key: `contract-send:${DEMO_IDS.contract}`, kind: 'send_contract', since: iso(acceptedAt), waitingWho: name, ref: { contractId: DEMO_IDS.contract },
      title: t('demo.data.tasks.contract'), detail: t('demo.data.tasks.contractDetail', { salary: euro(offerSalary), date: fmtDate(start, lang) }),
      context: context({
        ask: t('demo.data.tasks.contractAsk', { name }),
        line: [euro(offerSalary), t('demo.data.tasks.contractStart', { date: fmtDate(start, lang) })],
        why: t('demo.data.tasks.contractWhy', { name, date: fmtDayMonth(acceptedAt, lang), hh: hhFirst }),
      }),
    }));
  }
  const taskList = { tasks, waiting, done: [], counts: { urgent: tasks.filter((x) => x.urgent).length, total: tasks.length }, news: [], reminder: null };

  // ---- Anfrage-Fenster -------------------------------------------------------------------------
  const me = { userId: user.id, name: user.name, email: user.email, title: null, role: 'owner' };
  const requestContext = {
    submissionId: DEMO_IDS.submission, jobId, jobTitle: tour.title, companyName: company, candidateLabel: DEMO.code,
    candidateName: unlocked ? name : null, identityUnlocked: unlocked, recruiterName: hh, round: 1, me, team: [me], previousAttendees: [],
    calendar: { state: 'not_connected', provider: null, accountEmail: null, itRequest: null },
    hours: DEFAULT_INTERVIEW_HOURS, defaultMessage: t('demo.data.requestMessage'), openRequest: null,
    onsiteDefault: tour.location ?? null, teamsLink: 'auto', invite: { allowed: true, adminNames: [] },
  };
  const availability = (body: Row) => {
    const weekStart = String(body.weekStart ?? ymd(now));
    const [y, m, d] = weekStart.split('-').map(Number);
    const earliest = now.getTime() + 24 * HOUR;
    const days = [0, 1, 2, 3, 4].map((offset) => {
      const day = new Date(y, m - 1, d + offset);
      const hours = day.getDay() === 5 ? [9, 10, 11] : [9, 10, 11, 14, 15, 16];
      return {
        date: ymd(day),
        label: fmtWeekdayDayMonth(day, lang),
        slots: hours.map((h) => new Date(y, m - 1, d + offset, h)).filter((s) => s.getTime() >= earliest)
          .map((s) => ({ start: iso(s), status: 'all', missing: [], unknown: [] })),
      };
    });
    return { connected: false, selfVisible: false, stepMinutes: 60, days, people: [{ key: user.id, name: user.name, required: true, visible: false }] };
  };
  const interviewDetails = {
    id: DEMO_IDS.interview, status: phase === 'scheduled' ? 'scheduled' : 'completed', round: 1, scheduledAt: iso(ivAt), durationMinutes: ivMinutes,
    format: 'teams', joinUrl: 'https://teams.microsoft.com/l/meetup-join/beispiel', onsite: null, callPhone: null, feedback: feedbackJson,
    inOutlook: false, proposedSlots: slots, counterSlot: null, candidateMessage: null, clientMessage: t('demo.data.requestMessage'),
    jobTitle: tour.title, companyName: company, candidateLabel: label, identityUnlocked: unlocked,
    attendees: [{ userId: user.id, email: user.email, name: user.name, title: null, required: true, organizer: true, decisionMaker: true, external: false }],
    recruiterName: hh, reschedule: null, movedFrom: null, guide: null, guideGeneratedAt: null, timeline: [],
  };

  // ---- Besetzungen -----------------------------------------------------------------------------
  const pkg = PACKAGES[isPackageKey(input.packageKey) ? input.packageKey : 'core'];
  const pct = input.feePercent ?? pkg.clientFeePct;
  const besetzung = phase === 'signed' ? {
    items: [{
      submissionId: DEMO_IDS.submission, group: 'start', name, unlocked: true, jobId, jobTitle: tour.title, recruiterName: hh, dran: null,
      offer: { id: DEMO_IDS.offer, version: 1, status: 'accepted', salary: offerSalary, variable: null, startDate: ymd(start), responseDue: ymd(responseDue), overdue: false, probationMonths: 6, wish: null },
      contract: { id: DEMO_IDS.contract, status: 'signed', way: 'self', signingMode: 'email', sentAt: iso(acceptedAt), companySignedAt: null, signedOn: ymd(signedAt) },
      placement: {
        id: DEMO_IDS.placement, state: 'pending_start', startDate: ymd(start), startConfirmedAt: null, startMovedAt: null, startFixedAt: null, startFixedHow: null,
        startReport: null, nonStartReportedAt: null, nonStartReason: null, nonStartDocument: false, continuityEnd: null, reportUntil: null, coreUntil: null,
        departure: null, end: null, claim: null, research: null, offer: null, researchInvoice: null, replaces: null, jobStatus: 'filled', jobPaused: false,
        purchaseOrder: null, costCenter: null,
      },
      package: { key: pkg.key, name: pkg.publicName, pct, continuityDays: pkg.continuityDays },
      grossCents: offerSalary * 100,
      feeCents: Math.round(offerSalary * pct),
      invoice: null,
      can: null,
      events: [
        { at: iso(signedAt), text: t('demo.data.events.signed') },
        { at: iso(acceptedAt), text: t('demo.data.events.accepted', { name: first }) },
        { at: iso(offerAt), text: t('demo.data.events.offer', { hh: hhFirst }) },
      ],
    }],
    counts: { angebot: 0, start: 1, haus: 0, ab: 0 },
    kpis: { placedThisYear: 1, openInvoiceCents: 0, nextStart: { date: ymd(start), name } },
  } : { items: [], counts: { angebot: 0, start: 0, haus: 0, ab: 0 }, kpis: { placedThisYear: 0, openInvoiceCents: 0, nextStart: null } };

  const searcher = {
    activation_id: `${DEMO_IDS.recruiter}-a`, recruiter_id: DEMO_IDS.recruiter, full_name: hh, company_name: t('demo.data.hhCompany'),
    // Fiktive Beispielporträts (KI, 17.11.2026), offen unter public/tour; keine echten Personen.
    avatar_path: '/tour/hh-julia.jpg', partner_number: null, tier: 'gold', is_new: false, status: 'active', started_at: iso(new Date(now.getTime() - 7 * DAY)),
    ended_at: null, candidates: 1, last_submission_at: iso(submittedAt),
  };
  const searchers = input.liveJob ? [searcher, {
    ...searcher, activation_id: `${DEMO_IDS.recruiter2}-a`, recruiter_id: DEMO_IDS.recruiter2, full_name: t('demo.data.hh2'),
    company_name: t('demo.data.hh2Company'), tier: 'silver', avatar_path: '/tour/hh-tobias.jpg', started_at: iso(new Date(now.getTime() - 5 * DAY)), candidates: 1,
  }] : [searcher];
  // Dritter Headhunter, nur auf den Beispielstellen
  const searcher3 = { ...searcher, activation_id: `${DEMO_IDS.recruiter3}-a`, recruiter_id: DEMO_IDS.recruiter3, full_name: t('demo.data.hh3'),
    company_name: t('demo.data.hh3Company'), tier: 'silver', avatar_path: '/tour/hh-lukas.jpg', started_at: iso(new Date(now.getTime() - 20 * DAY)), candidates: 2 };

  // Stelle auf „Meine Stellen“: nur die Stelle des Rundgangs (Marko 17.11.: „bisschen viele
  // Teststellen“ -- weitere Stellen des Kontos stören das Beispiel). Ohne eigene die Beispielstelle
  // in der Prüfung, mit eigener ihr echter Stand; auf der vollen Karte seit neun Tagen live.
  const exampleRow: Row = {
    id: DEMO_IDS.job, title: tour.title, status: 'pending_approval', location: tour.location, salary_min: tour.band?.min ?? null, salary_max: tour.band?.max ?? null,
    employment_type: contracting ? 'freelance' : 'full_time', experience_level: 'mid', remote_type: tour.remote, must_haves: criteria, nice_to_haves: [],
    skills, onsite_required: tour.remote === 'onsite', client_id: user.id, closed_at: null, company_name: company, benefits,
    created_at: iso(new Date(now.getTime() - 3 * HOUR)), updated_at: iso(new Date(now.getTime() - 2 * HOUR)), submitted_at: iso(new Date(now.getTime() - 2 * HOUR)),
    approved_at: null, client_approved_at: null, paused_at: null,
  };
  const baseRow: Row | null = tour.jobId ? (job ? { ...(job as Row) } : null) : exampleRow;
  // Zwei weitere laufende Stellen mit Kandidaten und Suchenden, nur auf „Meine Stellen“ (live).
  const examples = input.liveJob ? [
    { id: DEMO_IDS.exampleJob1, title: t('demo.data.exampleJob1'), location: 'Hamburg', region: t('demo.data.region', { city: 'Hamburg' }), days: 42,
      people: [['dace', 'new', '5-10 Jahre', 2], ['bc4f', 'interview_completed', '3-5 Jahre', 11], ['ea9d', 'in_review', '5-10 Jahre', 6], ['fb2c', 'interview_scheduled', '10-15 Jahre', 15]] as const },
    { id: DEMO_IDS.exampleJob2, title: t('demo.data.exampleJob2'), location: 'München', region: t('demo.data.region', { city: 'München' }), days: 41,
      people: [['cd8a', 'new', '10-15 Jahre', 1], ['ab3e', 'new', '5-10 Jahre', 3], ['df61', 'interview_completed', '10-15 Jahre', 9], ['be07', 'in_review', '5-10 Jahre', 5], ['ac52', 'interview', '3-5 Jahre', 12]] as const },
  ] : [];
  const exampleRows: Row[] = examples.map((x) => ({
    ...exampleRow, id: x.id, title: x.title, location: x.location, status: 'published', employment_type: 'full_time', remote_type: 'hybrid',
    created_at: iso(new Date(now.getTime() - (x.days + 1) * DAY)), approved_at: iso(new Date(now.getTime() - x.days * DAY)),
    client_approved_at: iso(new Date(now.getTime() - x.days * DAY)), submitted_at: iso(new Date(now.getTime() - (x.days + 1) * DAY)),
  }));
  const exampleViews: Row[] = examples.flatMap((x, j) => x.people.map(([hex, st, band, days], i) => {
    const n = `${j + 1}${i}`;
    return {
      ...view, submission_id: `de300000-0000-4000-8000-0000000b00${n}`, candidate_id: `${hex}${n}00-0000-4000-8000-0000000000${n}`, job_id: x.id,
      job_title: x.title, candidate_role: x.title.replace(/\s*\([^)]*\)\s*$/, ''), status: st, stage: st, identity_unlocked: false, full_name: null,
      email: null, phone: null, city: null, experience_years: null, experience_band: band, region_broad: x.region, recruiter_notes: null,
      salary_band: null, submitted_at: iso(new Date(now.getTime() - days * DAY)),
    };
  }));
  const jobRow: Row | null = input.liveJob && baseRow
    ? { ...baseRow, status: 'published', paused_at: null, closed_at: null, created_at: iso(new Date(now.getTime() - 10 * DAY)),
      approved_at: iso(new Date(now.getTime() - 9 * DAY)), client_approved_at: iso(new Date(now.getTime() - 9 * DAY)) }
    : baseRow;

  // Nur die Stelle (Meine Stellen ohne eigene Stelle): noch keine Bewerbung.
  const noCandidate = phase === 'job';
  // Volle Karte: zwei weitere anonyme Kandidaten im Rennen (Interview, Prüfung), nur auf „Meine Stellen“.
  const crowd: Row[] = input.liveJob ? [
    { id: 2, stage: 'interview_completed', years: '5-10 Jahre', days: 6 },
    { id: 3, stage: 'in_review', years: '3-5 Jahre', days: 3 },
  ].map(({ id, stage: st, years: band, days }) => ({
    ...view, submission_id: id === 2 ? DEMO_IDS.submission2 : DEMO_IDS.submission3, candidate_id: id === 2 ? DEMO_IDS.candidate2 : DEMO_IDS.candidate3,
    status: st, stage: st, identity_unlocked: false, full_name: null, email: null, phone: null, city: null, experience_years: null,
    experience_band: band, recruiter_notes: null, submitted_at: iso(new Date(now.getTime() - days * DAY)),
  })) : [];
  const tables: Record<string, Row[]> = {
    client_candidate_view: noCandidate ? [] : [view, ...crowd, ...exampleViews],
    candidate_client_summary: [summary],
    deal_health: [],
    client_fit_assessment_view: [fit],
    client_candidate_interview_view: [talk],
    client_candidate_education_view: [],
    client_candidate_experiences_view: experiences,
    candidate_experiences: experiences,
    candidate_comments: [],
    submissions: noCandidate ? [] : [submission, ...[...crowd, ...exampleViews].map((c) => ({ ...submission, id: c.submission_id, job_id: c.job_id, candidate_id: c.candidate_id, status: c.status, stage: c.stage, submitted_at: c.submitted_at }))],
    interviews: interview ? [interview] : [],
    offers: reached(phase, 'accepted') ? [{ id: DEMO_IDS.offer, submission_id: DEMO_IDS.submission, status: 'accepted', created_at: iso(offerAt), sent_at: iso(offerAt), response_due: ymd(responseDue) }] : [],
    rejections: [],
    employment_contracts: contractRow ? [{ ...contractRow, submission_id: DEMO_IDS.submission }] : [],
    candidate_activity_log: [],
    offer_recommendations: [],
  };
  // Zusage: die Meldung in der Glocke, wie sie live kommt (offer-candidate.ts, Typ offer_answer).
  const notifications: Row[] | null = phase === 'accepted' ? [{
    id: `${DEMO_IDS.submission}-n1`, user_id: user.id, type: 'offer_answer', title: t('demo.data.notifyAccepted', { name }),
    message: t('demo.data.notifyAcceptedBody', { job: tour.title }), is_read: false, related_type: 'submission', related_id: DEMO_IDS.submission,
    created_at: iso(acceptedAt),
  }]
    // Nach dem Gespräch: Julia meldet den Eindruck des Kandidaten aus dem Nachgespräch
    // (recruiter-notify client_nudge, Anlass interview_feedback, Text nachgespraech.ts kundenText).
    : phase === 'interviewed' ? [{
      id: `${DEMO_IDS.submission}-n0`, user_id: user.id, type: 'recruiter_nudge', title: t('demo.data.notifyImpression', { name }),
      message: t('demo.data.notifyImpressionBody', { job: tour.title }), is_read: false, related_type: 'submission', related_id: DEMO_IDS.submission,
      created_at: iso(feedbackAt),
    }] : null;

  // Ohne eigenes Team: eine Firma, in der der Kunde Inhaber ist (nur Lesen, nichts wird angelegt).
  const demoOrg: Row | null = input.hasOrg === false ? {
    id: DEMO_IDS.organization, name: company, owner_id: user.id, type: 'client', created_at: iso(new Date(now.getTime() - 30 * DAY)),
    logo_url: null, website: null,
  } : null;
  const teamData = demoOrg ? {
    members: [{ id: `${DEMO_IDS.organization}-m1`, user_id: user.id, role: 'owner', status: 'active', invited_by: null, joined_at: demoOrg.created_at,
      created_at: demoOrg.created_at, full_name: user.name, email: user.email, avatar_url: null, last_sign_in_at: iso(now), assigned_jobs: [] }],
    caller_role: 'owner', is_admin: true,
  } : null;


  return {
    tables, notifications, taskList, offerContext, contractContext, requestContext, availability, interviewDetails, besetzung, searcher, searchers,
    demoOrg, teamData, jobRow, exampleRows, searcher3,
    mailPreview: {
      subject: t('demo.data.mailSubject', { company }),
      html: `<p>${t('demo.data.mailHello')}</p><p>${t('demo.data.requestMessage')}</p><p>${t('demo.data.mailBody', { company, hh })}</p>`,
      fromName: 'Matchunt',
    },
  };
}

export type DemoWorld = ReturnType<typeof demoWorld>;

/** Functions, die auf der Bühne echt lesen dürfen (Konto, Team, Rechnungen der Seitenleiste). */
const REAL_FUNCTIONS: Record<string, string[] | null> = {
  'team-data': null,
  'calendar-connect': ['status'],
  placement: ['client_invoices'],
};
/** Tabellen der Bewerbung: Sie kommen immer aus dem Beispiel, auch ohne passenden Filter. */
const DEMO_TABLES = new Set([
  'client_candidate_view', 'candidate_client_summary', 'deal_health', 'client_fit_assessment_view', 'client_candidate_interview_view',
  'client_candidate_education_view', 'client_candidate_experiences_view', 'candidate_experiences', 'candidate_comments', 'submissions',
  'interviews', 'offers', 'rejections', 'employment_contracts', 'candidate_activity_log', 'offer_recommendations',
]);

/**
 * Das Register für lib/demoBackend.ts: Was zur Bewerbung gehört, kommt aus `world`;
 * Schreiben, Senden und unbekannte Aktionen werden verschluckt; Konto-Daten lesen echt.
 */
export function demoRegistry(world: DemoWorld, opts: { log?: DemoRegistry['log'] } = {}): DemoRegistry {
  const ok = { ok: true };
  return {
    log: opts.log,
    table: (q: DemoQuery) => {
      if (q.kind !== 'select') return [];
      if (DEMO_TABLES.has(q.table)) return world.tables[q.table] ?? [];
      // Glocke bei der Zusage: die Meldung „hat zugesagt“; sonst echte Hinweise.
      // Die Uhr der Bühne steht still; die Meldung in der Glocke soll aber wie eben gekommen wirken.
      if (q.table === 'notifications' && world.notifications) return world.notifications.map((n) => ({ ...n, created_at: new Date(Date.now() - 60_000).toISOString() }));
      // Fragen an den Headhunter zu diesem Kandidaten: noch keine; die übrigen Nachrichten sind echt.
      if (q.table === 'messages' && q.filters.some((f) => f.col === 'candidate_id')) return [];
      // Ohne eigene Stelle: die Beispielstelle, für „Meine Stellen“ (alle Spalten) und Abfragen nach ihr.
      // Zählungen und die Stellensuche des Rundgangs selbst lesen weiter echt.
      // Stellen der Firma (Einladen: „Welche Stellen?“): die Stelle des Rundgangs.
      const orgFilter = q.filters.find((f) => f.col === 'organization_id');
      if (q.table === 'jobs' && world.jobRow && orgFilter) return [{ ...world.jobRow, organization_id: orgFilter.val }];
      if (q.table === 'jobs' && world.jobRow) {
        const all = [world.jobRow, ...world.exampleRows];
        if (q.columns === '*') return all;
        const ids = q.filters.filter((f) => f.col === 'id').flatMap((f) => (Array.isArray(f.val) ? f.val : [f.val]));
        if (ids.length) {
          const hit = all.filter((r) => ids.includes(r.id));
          if (hit.length) return hit;
        }
      }
      // Ohne eigenes Team: die Beispiel-Firma (Inhaber ist der Kunde), noch keine weiteren Mitglieder.
      if (world.demoOrg && q.kind === 'select' && q.table === 'organizations') return [world.demoOrg];
      if (world.demoOrg && q.kind === 'select' && q.table === 'organization_members') return [];
      return null;
    },
    rpc: (name: string, args?: unknown) => {
      // Volle Karte: Julia und ein zweiter Headhunter suchen; auf den Beispielstellen einer bzw. beide.
      const jobArg = String((args as { p_job_id?: string } | undefined)?.p_job_id ?? '');
      if (name === 'get_job_searchers') {
        if (jobArg === DEMO_IDS.exampleJob1) return [world.searcher3];
        if (jobArg === DEMO_IDS.exampleJob2) return [world.searchers[1] ?? world.searcher, world.searcher3];
        return world.searchers;
      }
      if (name === 'get_jobs_searcher_counts') {
        if (!world.jobRow || world.searchers.length < 2) return undefined;
        return [{ job_id: world.jobRow.id, searching: 2 }, ...world.exampleRows.map((r) => ({ job_id: r.id, searching: r.id === DEMO_IDS.exampleJob1 ? 1 : 2 }))];
      }
      // Alles andere (Zugriffs-Log, Erwähnungen …) schreibt: im Rundgang nicht.
      return null;
    },
    fn: (name: string, raw: unknown) => {
      const body = (raw ?? {}) as Row;
      const action = String(body.action ?? '');
      // Team der Beispiel-Firma; mit eigenem Team liest „Team“ echt.
      if (name === 'team-data' && world.teamData) return world.teamData;
      const real = REAL_FUNCTIONS[name];
      if (real === null || (real && real.includes(action))) return null;
      switch (name) {
        case 'client-tasks':
          return action === 'list' ? world.taskList : ok;
        case 'offer':
          if (action === 'context') return world.offerContext;
          if (action === 'create') return { offerId: DEMO_IDS.offer, offer: world.offerContext.currentOffer, candidateMailAt: null };
          if (action === 'einsatz_anfragen') return { ok: true, requestedAt: new Date().toISOString(), einsatz: { startDate: body.startDate, months: body.months, daysPerWeek: body.daysPerWeek } };
          return ok;
        case 'interview-request':
          if (action === 'context') return world.requestContext;
          if (action === 'availability') return world.availability(body);
          if (action === 'check_time') return { start: body.start, status: 'all', missing: [], unknown: [], inHours: true, shortNotice: false, connected: false, selfVisible: false };
          if (action === 'details') return world.interviewDetails;
          if (action === 'send') return { interviewId: DEMO_IDS.interview, candidateMailSent: true, recruiterMailSent: true, warning: null };
          if (action === 'preview') return world.mailPreview;
          if (action === 'feedback' || action === 'decide_unsure') return { ok: true, way: body.way ?? 'offer', round: 1, nextRound: 2 };
          if (action === 'guide') return { guide: { sections: [] }, generatedAt: null, source: 'fallback' };
          return ok;
        case 'employment-contract':
          return action === 'context' ? world.contractContext : { ok: true, contract: world.contractContext.contract };
        case 'placement':
          return action === 'client_overview' ? world.besetzung : ok;
        default:
          return ok;
      }
    },
  };
}
