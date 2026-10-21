import type { IntakeDetails } from '@/components/recruiter/JobIntakeDetails';

export type BriefingJob = IntakeDetails & {
  must_haves?: string[] | null;
  nice_to_haves?: string[] | null;
  skills?: string[] | null;
  required_languages?: unknown;
  required_certifications?: unknown;
  screening_questions?: unknown;
  description?: string | null;
  requirements?: string | null;
  remote_policy?: string | null;
  deadline?: string | null;
  onsite_days_required?: number | null;
  hiring_urgency?: string | null;
  company_size_band?: string | null;
  candidates_in_pipeline?: number | null;
  candidates_dropped_reason?: string | null;
  recruiter_briefing_answers?: unknown;
  // Muss-Fragen der Aufnahme (20.10.2026). Zielfirmen, Abwerbeschutz und
  // Einwaende liefert die View erst nach dem Reveal.
  salary_flex?: string | null;
  max_notice_period?: string | null;
  visa_sponsorship?: boolean | null;
  interview_process?: string | null;
  target_companies?: string[] | null;
  nogo_companies?: string[] | null;
  candidate_concerns?: string[] | null;
  candidate_concerns_answer?: string | null;
};
export type BriefingRow = { id: string; label: string; value: string; source: 'intake' | 'listing' };
export type BriefingSection = { id: string; title: string; description: string; rows: BriefingRow[] };

const PLACEHOLDERS = new Set(['unbekannt', 'unklar', 'keine angabe', 'k.a.', 'k. a.', 'ka', 'n/a', 'na', 'nicht angegeben', 'nicht bekannt', 'tbd', '-', '--', '?']);
const TRANSLATIONS: Record<string, string> = { growth: 'Wachstum', succession: 'Nachfolge', new_position: 'Neu geschaffen', restructuring: 'Umstrukturierung', unbefristet: 'Unbefristet', befristet: 'Befristet', befristet_mit_aussicht: 'Befristet mit Aussicht auf Übernahme', projekt: 'Projektvertrag', hot: 'So schnell wie möglich', urgent: 'Dringend', standard: 'Regulär' };
const LANGUAGES: Record<string, string> = { de: 'Deutsch', en: 'Englisch', fr: 'Französisch', es: 'Spanisch', it: 'Italienisch' };
const keyOf = (value: string) => value.trim().toLocaleLowerCase('de-DE').replace(/\s+/g, ' ');

/**
 * Umlaute, die die Aufnahme-KI als ae/oe/ue geschrieben hat („Team ueberlastet“,
 * Befund 21.10.2026). Nur bekannte Wortstämme, damit „Steuer“, „neue“ oder
 * „aktuell“ unberührt bleiben. Die Quelle (parse-job-url) schreibt seitdem Umlaute.
 */
const UMLAUT_STAEMME: [RegExp, string][] = ([
  ['\\bueber', 'über'], ['\\bfuer\\b', 'für'], ['ueberlast', 'überlast'], ['verzoeger', 'verzöger'], ['pruef', 'prüf'],
  ['koenn', 'könn'], ['moeglich', 'möglich'], ['groess', 'größ'], ['aender', 'änder'], ['waehr', 'währ'], ['zusaetz', 'zusätz'],
  ['taeglich', 'täglich'], ['naechst', 'nächst'], ['spaet', 'spät'], ['fuehr', 'führ'], ['erfuell', 'erfüll'], ['wuensch', 'wünsch'],
  ['muess', 'müss'], ['zurueck', 'zurück'], ['frueh', 'früh'], ['schluess', 'schlüss'], ['buero', 'büro'], ['loesung', 'lösung'],
  ['hoeh', 'höh'], ['gehaelter', 'gehälter'], ['erwaehn', 'erwähn'], ['verguet', 'vergüt'], ['unterstuetz', 'unterstütz'],
  ['persoenlich', 'persönlich'], ['taetig', 'tätig'], ['faehig', 'fähig'], ['staerk', 'stärk'], ['kuerz', 'kürz'], ['verfueg', 'verfüg'],
  ['gemaess', 'gemäß'], ['regelmaess', 'regelmäß'], ['ueblich', 'üblich'], ['aussergewoehnlich', 'außergewöhnlich'], ['gewoehn', 'gewöhn'],
] as [string, string][]).map(([a, u]) => [new RegExp(a, 'gi'), u]);

export function umlaute(text: string): string {
  if (!/ae|oe|ue/i.test(text)) return text;
  // Platzhalter wie {VERGUETUNG} bleiben, wie sie sind: das System ersetzt sie später.
  return text.split(/(\{[A-Z_]+\})/).map(teil => {
    if (/^\{[A-Z_]+\}$/.test(teil)) return teil;
    let out = teil;
    for (const [re, ersatz] of UMLAUT_STAEMME) {
      out = out.replace(re, (m) => (m[0] === m[0].toUpperCase() && m[0] !== m[0].toLowerCase() ? ersatz.charAt(0).toUpperCase() + ersatz.slice(1) : ersatz));
    }
    return out;
  }).join('');
}

export function briefingText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value.toLocaleString('de-DE') : '';
  if (Array.isArray(value)) return [...new Set(value.map(briefingText).filter(Boolean))].join(' · ');
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return !trimmed || PLACEHOLDERS.has(keyOf(trimmed)) ? '' : TRANSLATIONS[keyOf(trimmed)] ?? umlaute(trimmed);
}

export function list(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result = new Map<string, string>();
  for (const item of value) {
    const text = briefingText(item);
    if (text && !result.has(keyOf(text))) result.set(keyOf(text), text);
  }
  return [...result.values()];
}

export function getRecruiterCriteria(job: BriefingJob) {
  const requiredFromIntake = list(job.must_have_criteria);
  const trainable = list(job.trainable_skills);
  const negotiableFromIntake = list(job.nice_to_have_criteria);
  const flexible = new Set([...trainable, ...negotiableFromIntake].map(keyOf));
  // A lower-priority canonical criterion must never become mandatory again
  // through the older ad-derived list used by CandidateSubmitForm.
  const required = requiredFromIntake.length ? requiredFromIntake : list(job.must_haves).filter(value => !flexible.has(keyOf(value)));
  const occupied = new Set([...required, ...trainable].map(keyOf));
  const negotiable = (negotiableFromIntake.length ? negotiableFromIntake : list(job.nice_to_haves)).filter(value => !occupied.has(keyOf(value)));
  const sources = {
    required: requiredFromIntake.length ? 'intake' as const : 'listing' as const,
    trainable: 'intake' as const,
    negotiable: negotiableFromIntake.length ? 'intake' as const : 'listing' as const,
  };
  return { required, trainable: trainable.filter(value => !new Set(required.map(keyOf)).has(keyOf(value))), negotiable, source: sources.required, sources };
}

type Field = { id: keyof BriefingJob; label: string; section: string; only?: 'employee' | 'freelance' };
export const INTAKE_FIELDS: Field[] = [
  { id: 'must_have_criteria', label: 'Unverzichtbar', section: 'profil' },
  { id: 'trainable_skills', label: 'Erlernbar', section: 'profil' },
  { id: 'nice_to_have_criteria', label: 'Verhandelbar', section: 'profil' },
  // K.-o.-Fragen zuerst: sie stehen im Abschnitt vor „Weitere Angaben“ (20.10.2026)
  { id: 'max_notice_period', label: 'Längste Kündigungsfrist, die der Kunde abwartet', section: 'profil', only: 'employee' },
  { id: 'visa_sponsorship', label: 'Arbeitserlaubnis', section: 'profil' },
  { id: 'success_profile', label: 'So gelingt die Aufgabe', section: 'profil' },
  { id: 'failure_profile', label: 'Erfahrungen mit bisheriger Besetzung', section: 'profil' },
  { id: 'target_companies', label: 'Gute Kandidaten kommen aus', section: 'profil' },
  { id: 'nogo_companies', label: 'Nicht abwerben bei', section: 'profil' },
  { id: 'vacancy_reason', label: 'Warum die Stelle offen ist', section: 'aufgabe' },
  { id: 'task_breakdown', label: 'Aufgabenverteilung', section: 'aufgabe' },
  { id: 'daily_routine', label: 'Der Arbeitsalltag', section: 'aufgabe' },
  { id: 'task_focus', label: 'Schwerpunkt der Aufgabe', section: 'aufgabe' },
  { id: 'negative_impact_if_unfilled', label: 'Wenn die Stelle offen bleibt', section: 'aufgabe' },
  { id: 'position_advantages', label: 'Was diese Position attraktiv macht', section: 'angebot' },
  { id: 'career_path', label: 'Entwicklungsperspektive', section: 'angebot', only: 'employee' },
  { id: 'benefits', label: 'Benefits und Ausstattung', section: 'angebot' },
  { id: 'salary_months', label: 'Monatsgehälter', section: 'angebot', only: 'employee' },
  { id: 'bonus_structure', label: 'Variable Vergütung', section: 'angebot', only: 'employee' },
  { id: 'salary_flex', label: 'Spielraum beim Gehalt', section: 'angebot', only: 'employee' },
  { id: 'contract_limitation', label: 'Vertragsform', section: 'angebot', only: 'employee' },
  { id: 'career_example', label: 'Ein konkretes Karrierebeispiel', section: 'angebot', only: 'employee' },
  { id: 'day_rate_min', label: 'Tagessatz Spezialist ab', section: 'angebot', only: 'freelance' },
  { id: 'day_rate_max', label: 'Tagessatz Spezialist bis', section: 'angebot', only: 'freelance' },
  { id: 'contract_duration_months', label: 'Vertragslaufzeit', section: 'angebot' },
  { id: 'utilization_days_per_week', label: 'Auslastung', section: 'angebot', only: 'freelance' },
  { id: 'extension_possible', label: 'Verlängerung möglich', section: 'angebot', only: 'freelance' },
  { id: 'onsite_days_required', label: 'Präsenz vor Ort', section: 'angebot' },
  { id: 'core_hours', label: 'Arbeitszeitmodell', section: 'angebot' },
  { id: 'core_hours_detail', label: 'Kernzeiten im Detail', section: 'angebot' },
  { id: 'overtime_policy', label: 'Umgang mit Überstunden', section: 'angebot', only: 'employee' },
  { id: 'time_tracking_method', label: 'Zeit- / Leistungserfassung', section: 'angebot' },
  { id: 'contract_sensitive_topics', label: 'Vertragsthemen vorab besprechen', section: 'angebot' },
  { id: 'candidate_concerns', label: 'Was Kandidaten kritisch sehen könnten', section: 'angebot' },
  { id: 'candidate_concerns_answer', label: 'Antwort des Kunden darauf', section: 'angebot' },
  { id: 'team_size', label: 'Teamgröße', section: 'unternehmen' },
  { id: 'reports_to', label: 'Berichtet an / fachliche Führung', section: 'unternehmen' },
  { id: 'company_culture', label: 'Zusammenarbeit und Kultur', section: 'unternehmen' },
  { id: 'department_structure', label: 'Aufbau der Abteilung', section: 'unternehmen' },
  { id: 'company_size_band', label: 'Unternehmensgröße', section: 'unternehmen' },
  { id: 'company_headcount', label: 'Mitarbeitende gesamt', section: 'unternehmen' },
  { id: 'unique_selling_points', label: 'Was das Unternehmen besonders macht', section: 'unternehmen' },
  { id: 'industry_opportunities', label: 'Chancen der Branche', section: 'unternehmen' },
  { id: 'industry_challenges', label: 'Herausforderungen der Branche', section: 'unternehmen' },
  { id: 'interview_process', label: 'Auswahlprozess', section: 'prozess' },
  { id: 'decision_makers', label: 'An der Entscheidung beteiligt', section: 'prozess' },
  { id: 'contract_creation_days', label: 'Von der Zusage bis zum Vertrag', section: 'prozess' },
  { id: 'contract_sent_digitally', label: 'Digitaler Vertragsversand', section: 'prozess' },
  { id: 'hiring_urgency', label: 'Besetzungsdringlichkeit', section: 'prozess' },
  { id: 'works_council', label: 'Betriebsrat', section: 'prozess', only: 'employee' },
  { id: 'works_council_meeting_schedule', label: 'Betriebsrat tagt', section: 'prozess', only: 'employee' },
  { id: 'candidates_in_pipeline', label: 'Kandidatenstand bei Aufnahme', section: 'prozess' },
  { id: 'candidates_dropped_reason', label: 'Bisherige Absagegründe laut Aufnahme', section: 'prozess' },
];
export const INTAKE_FIELD_KEYS = INTAKE_FIELDS.map(field => field.id);

/** The view supplies an allowlist, not the private intake payload. */
export function narrativeAnswer(job: BriefingJob, key: 'deliverable_90d' | 'interview_process'): string {
  const payload = job.recruiter_briefing_answers;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return '';
  const answer = (payload as Record<string, unknown>)[key];
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return '';
  const { unknown, value } = answer as { unknown?: boolean; value?: unknown };
  return unknown === true ? '' : briefingText(value);
}

export function fieldValue(job: BriefingJob, id: keyof BriefingJob): string {
  const value = job[id];
  // This boolean is defaulted by the DB even for jobs that were never asked.
  if (id === 'works_council' && value === false) return '';
  if (id === 'task_breakdown' && value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([name, amount]) => {
      const text = briefingText(amount);
      return text ? [`${name}: ${text}${typeof amount === 'number' ? ' %' : ''}`] : [];
    }).join('\n');
  }
  if (id === 'onsite_days_required' && value === 0) return 'Vollständig remote (0 Präsenztage)';
  // Ja/Nein sagt hier nichts: die Frage war „Arbeitserlaubnis oder Visum?“
  if (id === 'visa_sponsorship' && typeof value === 'boolean') return value ? 'Visum unterstützt der Kunde' : 'Arbeitserlaubnis für Deutschland nötig';
  const text = Array.isArray(value) ? list(value).join(' · ') : briefingText(value);
  if (!text) return '';
  const suffix: Partial<Record<keyof BriefingJob, string>> = { contract_creation_days: ' Tage', contract_duration_months: ' Monate', utilization_days_per_week: ' Tage pro Woche', onsite_days_required: ' Tage pro Woche', day_rate_min: ' € pro Tag', day_rate_max: ' € pro Tag' };
  return text + (suffix[id] ?? '');
}

function languageList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (typeof item === 'string') return list([item]);
    if (!item || typeof item !== 'object') return [];
    const name = item.name ?? LANGUAGES[String(item.code).toLowerCase()] ?? item.code;
    return list([[name, item.minLevel ?? item.level].filter(Boolean).join(' ')]);
  });
}

export function buildBriefingSections(job: BriefingJob): BriefingSection[] {
  const sections: BriefingSection[] = [
    { id: 'profil', title: 'Wen du suchst', description: 'Prioritäten, Erfahrung und die Zusammenarbeit, die zur Rolle passt.', rows: [] },
    { id: 'aufgabe', title: 'Aufgabe & Erwartungen', description: 'Verstehe den Auftrag und den tatsächlichen Arbeitsalltag.', rows: [] },
    { id: 'angebot', title: 'Warum sich der Wechsel lohnt', description: 'Argumente für das Gespräch – und die Rahmenbedingungen dazu.', rows: [] },
    { id: 'unternehmen', title: 'Unternehmen & Zusammenarbeit', description: 'Das Umfeld, in dem deine Kandidaten erfolgreich sein sollen.', rows: [] },
    { id: 'prozess', title: 'Auswahlprozess & Vorstellung', description: 'Entscheidung, Vertragstempo und bisherige Erfahrungen.', rows: [] },
  ];
  const freelance = job.employment_type === 'freelance';
  for (const field of INTAKE_FIELDS) {
    if ((field.only === 'employee' && freelance) || (field.only === 'freelance' && !freelance)) continue;
    const value = fieldValue(job, field.id);
    if (value) sections.find(section => section.id === field.section)!.rows.push({ id: field.id, label: field.label, value, source: 'intake' });
  }
  const extra: Array<[string, string, string, string]> = [
    ['profil', 'required_languages', 'Sprachanforderungen laut Stellendaten', languageList(job.required_languages).join(' · ')],
    ['profil', 'required_certifications', 'Zertifikate laut Stellendaten', languageList(job.required_certifications).join(' · ')],
    ['profil', 'skills', 'Weitere Skills aus den Stellendaten', list(job.skills).filter(skill => !new Set(Object.values(getRecruiterCriteria(job)).filter(Array.isArray).flat().map(keyOf)).has(keyOf(skill))).join(' · ')],
    ['angebot', 'remote_policy', 'Regelung zum Arbeitsort', briefingText(job.remote_policy)],
  ];
  for (const [section, id, label, value] of extra) if (value) sections.find(item => item.id === section)!.rows.push({ id, label, value, source: 'listing' });
  /**
   * Der Kandidatenstand gehoert nach vorn, nicht hinter "Weitere N Angaben".
   *
   * BEFUND (10.09.2026, an der echten Stelle gesehen): "2 Kandidaten bereits
   * beim Kunden" und "die letzte Kandidatin ist wegen eines Gegenangebots
   * abgesprungen" standen eingeklappt im letzten Abschnitt der Seite.
   *
   * Fuer einen Headhunter ist beides kein Zusatz, sondern ein
   * Abbruchkriterium: laufen schon zwei Profile, arbeitet er auf Platz drei.
   * Und ein Gegenangebot muss er vorbereiten, BEVOR er anruft -- danach ist
   * die Information wertlos. Die Reihenfolge innerhalb des Abschnitts
   * entscheidet hier darueber, ob er es ueberhaupt liest.
   */
  const prozess = sections.find(section => section.id === 'prozess')!;
  const zuerst = ['candidates_in_pipeline', 'candidates_dropped_reason'];
  // Alles Uebrige behaelt seine Reihenfolge -- sort ist stabil.
  const rang = (id: string) => (zuerst.indexOf(id) + 1 || zuerst.length + 1) - 1;
  prozess.rows.sort((a, b) => rang(a.id) - rang(b.id));

  for (const [section, id, label] of [['aufgabe', 'deliverable_90d', 'Erwartetes Ergebnis nach 90 Tagen'], ['prozess', 'interview_process', 'Interviewablauf']] as const) {
    const value = narrativeAnswer(job, id);
    const ziel = sections.find(item => item.id === section)!;
    // Seit 20.10.2026 fragt der Katalog den Auswahlprozess als eigene Spalte -- die gewinnt.
    if (value && !ziel.rows.some(row => row.id === id)) ziel.rows.unshift({ id, label, value, source: 'intake' });
  }
  return sections;
}
