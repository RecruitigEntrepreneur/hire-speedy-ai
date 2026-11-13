import { fehlendeAngaben, type Fehlt } from './mandatsBriefing';
import { nichtSchonGenannt, verguetung } from './jobPosting';
import { briefingText, getRecruiterCriteria, list, type BriefingJob } from './recruiterBriefing';
import { mitarbeitende } from './stellenKopf';
import type { WorkspaceJob } from '@/components/recruiter/RecruiterJobWorkspace';
import i18n from '@/i18n';

// Texte werden beim Aufruf gelesen (Namespace recruiterJobDetail, brief.*), nie beim Laden des Moduls.
// Sicherheitsnetz: den Namespace schon beim Import anfordern, falls eine Seite ihn nicht selbst lädt.
void i18n.loadNamespaces('recruiterJobDetail');
const tr = (key: string, options?: Record<string, unknown>) => i18n.t(`recruiterJobDetail:brief.${key}`, options) as string;

/**
 * Das Briefing nach den Arbeitsschritten des Headhunters (Konzept 21.10.2026):
 * Lohnt sich der Auftrag? Wen suche ich, und wo? Womit überzeuge ich? Was
 * kläre ich im ersten Gespräch? Wie bringe ich es ins Ziel?
 *
 * Nur Angaben des Kunden aus der Aufnahme, jede genau einmal, im Schritt, in
 * dem sie gebraucht wird. KI-Texte gehören in die Werkzeuge am Schritt.
 * Vertrauliches ist markiert und gehört nie in Anzeige oder Ansprache.
 */
export type SchrittId = 'lohnt' | 'suche' | 'ueberzeugen' | 'gespraech' | 'abschluss';
export interface Zeile { label: string; wert?: string; chips?: string[]; vertraulich?: boolean }
export interface Schritt { id: SchrittId; frage: string; zeilen: Zeile[]; benefits?: string[]; beleg?: string; offen: Fehlt[] }

/** Frage und Kurzform werden bei jedem Zugriff in der aktuellen Sprache gelesen. */
export const SCHRITTE: { id: SchrittId; readonly frage: string; readonly kurz: string }[] =
  (['lohnt', 'suche', 'ueberzeugen', 'gespraech', 'abschluss'] as SchrittId[]).map(id => ({
    id,
    get frage() { return tr(`steps.${id}.frage`); },
    get kurz() { return tr(`steps.${id}.kurz`); },
  }));

/** Welche Frage der Aufnahme in welchen Schritt gehört (für die Lücken je Schritt). */
const FELDER: Record<SchrittId, string[]> = {
  lohnt: ['salary_months', 'bonus_structure', 'salary_flex', 'contract_limitation', 'onsite_days_required', 'vacancy_reason',
    'hiring_urgency', 'candidates_in_pipeline', 'negative_impact_if_unfilled', 'day_rate_min', 'day_rate_max',
    'contract_duration_months', 'utilization_days_per_week', 'extension_possible'],
  suche: ['must_have_criteria', 'trainable_skills', 'nice_to_have_criteria', 'success_profile', 'failure_profile', 'target_companies', 'nogo_companies'],
  ueberzeugen: ['position_advantages', 'benefits', 'career_path', 'career_example', 'unique_selling_points', 'company_culture', 'team_size',
    'department_structure', 'reports_to', 'daily_routine', 'task_focus', 'task_breakdown', 'core_hours', 'core_hours_detail', 'overtime_policy',
    'time_tracking_method', 'industry_opportunities', 'industry_challenges', 'company_headcount', 'company_size_band'],
  gespraech: ['max_notice_period', 'visa_sponsorship', 'contract_sensitive_topics', 'candidate_concerns', 'candidate_concerns_answer'],
  abschluss: ['interview_process', 'decision_makers', 'contract_creation_days', 'contract_sent_digitally', 'works_council',
    'works_council_meeting_schedule', 'candidates_dropped_reason'],
};

const LEVEL: Record<string, string> = { junior: 'Junior', mid: 'Mid-Level', 'mid-level': 'Mid-Level', senior: 'Senior', lead: 'Lead', principal: 'Principal', executive: 'Executive' };
const zahl = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : null);
const klein = (t: string) => (t ? t.charAt(0).toLowerCase() + t.slice(1) : t);
/** Vor „ · “ kein Satzpunkt. */
const ohneSchlusspunkt = (t: string) => t.replace(/\.\s*$/, '');
/** Liste oder „a · b“-Text als Punkte. */
const punkte = (v: unknown): string[] => list((Array.isArray(v) ? v : [v]).flatMap(x => briefingText(x).split(/\s·\s|\n|;/)).map(t => t.trim()).filter(Boolean));
const keyOf = (t: string) => t.trim().toLocaleLowerCase('de-DE');
const ohneVorteil = (t: string) => t.replace(/\s*\b(von vorteil|wünschenswert)\b.*$/i, '').replace(/,\s*aber kein muss\b.*$/i, '').trim();

function zeile(label: string, wert: string | null | undefined, vertraulich = false): Zeile | null {
  const w = (wert ?? '').trim();
  return w ? { label, wert: w, ...(vertraulich ? { vertraulich } : {}) } : null;
}
const nurZeilen = (z: (Zeile | null)[]) => z.filter((x): x is Zeile => Boolean(x));

export function buildArbeitsBriefing(job: BriefingJob & Record<string, unknown>, revealed: boolean): Schritt[] {
  const freelance = job.employment_type === 'freelance';
  const fehlt = fehlendeAngaben(job, revealed);
  const offen = (id: SchrittId) => fehlt.filter(f => FELDER[id].includes(f.id));
  const wj = job as unknown as WorkspaceJob;

  // 1 · Lohnt sich der Auftrag?
  const geld = verguetung(wj);
  const monate = briefingText(job.salary_months);
  const bonus = briefingText(job.bonus_structure);
  const ohneBonus = bonus && /^(nein|kein|keiner|keine)\b/i.test(bonus);
  const gehalt = geld ? [freelance ? tr('v.plusVat', { amount: geld }) : monate ? tr('v.fixedTimes', { amount: geld, months: monate }) : tr('v.fixed', { amount: geld }), bonus ? (ohneBonus ? tr('v.noBonus') : tr('v.bonus', { bonus })) : null].filter(Boolean).join(', ') : '';
  const tage = zahl(job.onsite_days_required);
  const ort = [briefingText(job.location), job.remote_type === 'remote' || tage === 0 ? tr('v.remote') : tage ? tr('v.daysOnsite', { count: tage }) : job.remote_type === 'hybrid' ? tr('v.hybrid') : null].filter(Boolean).join(' · ');
  const level = job.experience_level ? LEVEL[String(job.experience_level).toLowerCase()] ?? String(job.experience_level) : '';
  const laufzeit = freelance ? [zahl(job.contract_duration_months) ? tr('v.months', { n: zahl(job.contract_duration_months) }) : null,
    zahl(job.utilization_days_per_week) ? tr('v.daysPerWeek', { n: zahl(job.utilization_days_per_week) }) : null,
    job.extension_possible === true ? tr('v.extensionPossible') : null].filter(Boolean).join(' · ') : '';
  const imProzess = zahl(job.candidates_in_pipeline);
  const dringlich = [klein(briefingText(job.hiring_urgency)), imProzess != null ? (imProzess === 0 ? tr('v.pipelineNone') : tr('v.pipeline', { count: imProzess })) : null].filter(Boolean).join(' · ');
  const lohnt: Schritt = {
    id: 'lohnt', frage: SCHRITTE[0].frage, offen: offen('lohnt'),
    zeilen: nurZeilen([
      zeile(freelance ? tr('label.dayRate') : tr('label.salary'), gehalt),
      zeile(tr('label.flex'), briefingText(job.salary_flex), true),
      zeile(tr('label.duration'), laufzeit),
      zeile(tr('label.workplace'), ort),
      zeile(tr('label.levelContract'), [level, freelance ? '' : klein(briefingText(job.contract_limitation))].filter(Boolean).join(' · ')),
      zeile(tr('label.whyOpen'), briefingText(job.vacancy_reason).replace(/\s*\/\s*/g, ', ')),
      zeile(tr('label.urgency'), dringlich, imProzess != null),
      zeile(tr('label.ifUnfilled'), punkte(job.negative_impact_if_unfilled).join(' · ')),
    ]),
  };

  // 2 · Wen suche ich, und wo?
  const k = getRecruiterCriteria(job);
  const vorteil = k.negotiable.map(ohneVorteil).filter(Boolean);
  const genannt = [...k.required, ...k.trainable, ...vorteil].map(keyOf);
  const zertifikate = list(job.required_certifications).filter(z => !genannt.some(g => g.includes(keyOf(z))));
  const suche: Schritt = {
    id: 'suche', frage: SCHRITTE[1].frage, offen: offen('suche'),
    zeilen: nurZeilen([
      k.required.length ? { label: tr('label.must'), chips: k.required } : null,
      zeile(tr('label.trainable'), k.trainable.join(' · ')),
      zeile(tr('label.niceToHave'), [...vorteil, ...zertifikate].join(' · ')),
      zeile(tr('label.success'), punkte(job.success_profile).map(klein).join(', ')),
      zeile(tr('label.dontSend'), punkte(job.failure_profile).map(klein).join(' · '), true),
      zeile(tr('label.industry'), briefingText(job.industry)),
      revealed ? zeile(tr('label.targetCompanies'), list(job.target_companies).join(' · ')) : null,
      revealed ? zeile(tr('label.nogoCompanies'), list(job.nogo_companies).join(' · '), true) : null,
    ]),
  };

  // 3 · Womit überzeuge ich? Alle Benefits an einer Stelle.
  const vorteile = punkte(job.position_advantages);
  const benefits = [...vorteile, ...nichtSchonGenannt(list(job.benefits), vorteile)];
  const beleg = briefingText(job.career_example) || briefingText(job.career_path);
  const entwicklung = briefingText(job.career_path) && keyOf(briefingText(job.career_path)) !== keyOf(beleg) ? briefingText(job.career_path) : '';
  // Besonderheiten ohne das, was bei den Benefits schon steht (Head of Tax, Examen).
  const usps = nichtSchonGenannt(punkte(job.unique_selling_points), benefits);
  const firma = [mitarbeitende(job as never), ...usps].filter(Boolean).join(' · ');
  const struktur = briefingText(job.department_structure);
  const groesse = zahl(job.team_size);
  // „Team 4“ nur, wenn die Beschreibung die Größe nicht schon nennt.
  const team = [groesse && !new RegExp(`\\b${groesse}\\b`).test(struktur) ? tr('v.team', { n: groesse }) : null, struktur || null,
    briefingText(job.reports_to) ? tr('v.reportsTo', { name: briefingText(job.reports_to) }) : null].filter(Boolean).map(t => ohneSchlusspunkt(t as string)).join(' · ');
  const alltag = [briefingText(job.daily_routine), briefingText(job.task_focus) ? tr('v.focus', { focus: klein(briefingText(job.task_focus)) }) : null].filter(Boolean).map(t => ohneSchlusspunkt(t as string)).join(' · ');
  const gewichtung = job.task_breakdown && typeof job.task_breakdown === 'object' && !Array.isArray(job.task_breakdown)
    ? Object.entries(job.task_breakdown as Record<string, unknown>).map(([n, v]) => `${n} ${briefingText(v)}${typeof v === 'number' ? ' %' : ''}`).join(' · ') : '';
  const arbeitszeit = [...nichtSchonGenannt([briefingText(job.core_hours), briefingText(job.core_hours_detail)].filter(Boolean), benefits), briefingText(job.overtime_policy) ? tr('v.overtime', { text: briefingText(job.overtime_policy) }) : null,
    briefingText(job.time_tracking_method) ? tr('v.timeTracking', { text: briefingText(job.time_tracking_method) }) : null].filter(Boolean).join(' · ');
  const ueberzeugen: Schritt = {
    id: 'ueberzeugen', frage: SCHRITTE[2].frage, offen: offen('ueberzeugen'), benefits, beleg,
    zeilen: nurZeilen([
      zeile(tr('label.development'), entwicklung),
      zeile(tr('label.company'), firma),
      zeile(tr('label.culture'), briefingText(job.company_culture)),
      zeile(tr('label.team'), team),
      zeile(tr('label.daily'), alltag),
      zeile(tr('label.breakdown'), gewichtung),
      zeile(tr('label.workingHours'), arbeitszeit),
      zeile(tr('label.industryChances'), briefingText(job.industry_opportunities)),
      zeile(tr('label.industryChallenges'), briefingText(job.industry_challenges)),
    ]),
  };

  // 4 · Was kläre ich im ersten Gespräch?
  const gespraech: Schritt = {
    id: 'gespraech', frage: SCHRITTE[3].frage, offen: offen('gespraech'),
    zeilen: nurZeilen([
      freelance ? null : zeile(tr('label.noticePeriod'), briefingText(job.max_notice_period)),
      zeile(tr('label.workPermit'), typeof job.visa_sponsorship === 'boolean' ? (job.visa_sponsorship ? tr('v.visaSupported') : tr('v.permitNeeded')) : ''),
      zeile(tr('label.contractTopics'), punkte(job.contract_sensitive_topics).join(' · ')),
      revealed ? zeile(tr('label.concerns'), list(job.candidate_concerns).join(' · '), true) : null,
      revealed ? zeile(tr('label.clientAnswer'), briefingText(job.candidate_concerns_answer)) : null,
    ]),
  };

  // 5 · Wie bringe ich es ins Ziel?
  const vertrag = [briefingText(job.contract_creation_days) ? tr('v.days', { n: briefingText(job.contract_creation_days) }) : null, job.contract_sent_digitally === true ? tr('v.digital') : null].filter(Boolean).join(', ');
  const abschluss: Schritt = {
    id: 'abschluss', frage: SCHRITTE[4].frage, offen: offen('abschluss'),
    zeilen: nurZeilen([
      zeile(tr('label.process'), briefingText(job.interview_process)),
      zeile(tr('label.deciders'), list(job.decision_makers).join(', ')),
      zeile(tr('label.yesToContract'), vertrag),
      job.works_council === true ? zeile(tr('label.worksCouncil'), briefingText(job.works_council_meeting_schedule) ? tr('v.worksCouncilMeets', { schedule: briefingText(job.works_council_meeting_schedule) }) : tr('v.yes')) : null,
      zeile(tr('label.rejectionReasons'), briefingText(job.candidates_dropped_reason), true),
    ]),
  };

  return [lohnt, suche, ueberzeugen, gespraech, abschluss];
}
