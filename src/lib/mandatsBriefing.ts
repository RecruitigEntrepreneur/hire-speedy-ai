import { ALL_SLOTS, frageNach } from './briefCatalog';
import { kiInhalt, kiSatz } from './kiInhalt';
import { nichtSchonGenannt, verguetung } from './jobPosting';
import { briefingText, fieldValue, getRecruiterCriteria, INTAKE_FIELDS, list, narrativeAnswer, type BriefingJob } from './recruiterBriefing';
import type { WorkspaceJob } from '@/components/recruiter/RecruiterJobWorkspace';

/**
 * Das Mandatsbriefing auf einer Seite (Wireframe „Endfassung“, freigegeben 21.10.2026).
 *
 * Neun Blöcke in der Reihenfolge, in der ein Headhunter arbeitet: Fakten,
 * Anruf, Rolle, Profil, Aufgaben, Angebot, Unternehmen, Auswahl, Lücken.
 * Jede Angabe trägt ihre Herkunft: Kunde (aus der Aufnahme) oder KI (von
 * Matchunt aufbereitet). Widersprüche entscheidet immer die Angabe des Kunden;
 * KI-Behauptungen ohne Grundlage erscheinen gar nicht (siehe kiInhalt).
 */

export type Herkunft = 'kunde' | 'ki';
export type FaktId = 'gehalt' | 'vorort' | 'level' | 'sprache' | 'zeit' | 'vertrag' | 'team' | 'besetzung' | 'laufzeit' | 'umfang';
export interface Fakt { id: FaktId; label: string; wert: string; zusatz?: string; tage?: number; dringend?: boolean }
export interface Fehlt { id: string; label: string; frage: string }

export interface MandatsBriefing {
  fakten: Fakt[];
  anruf: { einstieg: string | null; vorwissen: string[]; knockout: { text: string; fehlt?: boolean }[]; fragen: { frage: string; bezug: string | null }[] };
  rolle: { kurz: string | null; warumOffen: string; warumJetzt: string | null; schwerpunkt: string; wennOffen: string[] };
  profil: {
    muss: string[]; erlernbar: string[]; verhandelbar: string[]; nichtSchicken: string[]; soGelingt: string[];
    idealKi: string | null; empfehlungKi: string | null; zielfirmen: string[]; nogo: string[]; zeigtSuche: boolean;
    zertifikate: string[]; weitereSkills: string[];
  };
  aufgaben: { liste: string[]; herkunft: Herkunft | null; alltag: string; gewichtung: string[]; ergebnis90: string };
  angebot: {
    pitch: string[]; beleg: string; perspektive: string; benefits: string[]; gehalt: string; spielraum: string; ueberstunden: string;
    erfassung: string; vorab: string[]; einwaende: string[]; einwandAntwort: string;
  };
  unternehmen: {
    beschreibung: string; besonders: string[]; kultur: string; kulturKi: string[]; berichtetAn: string;
    abteilung: string; teamGroesse: string; chancen: string; herausforderungen: string;
  };
  auswahl: { schritte: string[]; schritteHerkunft: Herkunft | null; entscheider: string[]; vertragTage: string; digital: boolean; ablauf: string; visum: string; betriebsrat: string };
  fehlt: Fehlt[];
}

const LEVEL: Record<string, string> = { junior: 'Junior', mid: 'Mid-Level', 'mid-level': 'Mid-Level', senior: 'Senior', lead: 'Lead', principal: 'Principal', executive: 'Executive' };
const SPRACHE: Record<string, string> = { de: 'Deutsch', en: 'Englisch', fr: 'Französisch', es: 'Spanisch', it: 'Italienisch', nl: 'Niederländisch', pl: 'Polnisch' };
const tausend = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
const zahl = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : null);
/** „a · b · c“ aus Liste oder Text, ohne Leeres. */
const punkte = (v: unknown): string[] => list((Array.isArray(v) ? v : [v]).flatMap(x => briefingText(x).split(/\s·\s|\n|;/)).map(t => t.trim()).filter(Boolean));
const keyOf = (t: string) => t.trim().toLocaleLowerCase('de-DE');

function spracheListe(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap(item => {
    if (typeof item === 'string') return [item];
    if (!item || typeof item !== 'object') return [];
    const o = item as Record<string, unknown>;
    const name = (typeof o.name === 'string' && o.name) || SPRACHE[String(o.code ?? '').toLowerCase()] || String(o.code ?? '');
    return name ? [[name, o.minLevel ?? o.level].filter(Boolean).join(' ')] : [];
  });
}

/** Ohne Doppelungen (Entwicklungsperspektive und Karrierebeispiel sind oft wortgleich). */
function ohneDoppelte(werte: string[]): string[] {
  const gesehen = new Set<string>();
  return werte.filter(w => (gesehen.has(keyOf(w)) ? false : (gesehen.add(keyOf(w)), true)));
}

type Job = BriefingJob & Record<string, unknown>;
const roh = (job: Job) => job as unknown as Record<string, unknown>;

function fakten(job: Job): Fakt[] {
  const freelance = job.employment_type === 'freelance';
  const out: Fakt[] = [];
  if (freelance) {
    const satz = verguetung(job as unknown as WorkspaceJob);
    if (satz) out.push({ id: 'gehalt', label: 'Tagessatz', wert: satz, zusatz: 'zzgl. USt' });
    const laufzeit = zahl(job.contract_duration_months);
    if (laufzeit) out.push({ id: 'laufzeit', label: 'Laufzeit', wert: `${laufzeit} Monate`, zusatz: job.extension_possible === true ? 'Verlängerung möglich' : undefined });
    const umfang = zahl(job.utilization_days_per_week);
    if (umfang) out.push({ id: 'umfang', label: 'Umfang', wert: `${umfang} Tage / Woche` });
  }
  const min = zahl(job.salary_min), max = zahl(job.salary_max);
  if (!freelance && (min || max)) {
    const spanne = min && max ? `${tausend(min).replace('k', '')}–${tausend(max)} €` : `${tausend((min ?? max)!)} €`;
    const monate = briefingText(job.salary_months);
    const bonus = briefingText(job.bonus_structure);
    const ohneBonus = !bonus || /^(nein|kein|keiner|keine)\b/i.test(bonus);
    out.push({ id: 'gehalt', label: 'Gehalt fix', wert: spanne, zusatz: [monate ? `× ${monate}` : null, bonus ? (ohneBonus ? 'kein Bonus' : `Bonus: ${bonus}`) : null].filter(Boolean).join(' · ') || undefined });
  }
  const tage = zahl(job.onsite_days_required);
  if (job.remote_type === 'remote' || tage === 0) out.push({ id: 'vorort', label: 'Vor Ort', wert: 'remote', tage: 0 });
  else if (tage != null && tage > 0) out.push({ id: 'vorort', label: 'Vor Ort', wert: `${tage} von 5 Tagen`, tage: Math.min(5, tage) });
  const level = job.experience_level ? LEVEL[String(job.experience_level).toLowerCase()] ?? String(job.experience_level) : '';
  const jahre = getRecruiterCriteria(job).required.map(k => k.match(/(\d+)\s*(\+\s*)?Jahre/i)?.[1]).find(Boolean) ?? (zahl(job.experience_min) ? String(job.experience_min) : null);
  if (level || jahre) out.push({ id: 'level', label: 'Level', wert: level || `${jahre}+ Jahre`, zusatz: level && jahre ? `${jahre}+ Jahre` : undefined });
  const sprachen = spracheListe(job.required_languages);
  if (sprachen.length) out.push({ id: 'sprache', label: 'Sprache', wert: sprachen.join(', ') });
  const zeit = briefingText(job.core_hours);
  if (zeit) {
    const [kopf, ...rest] = zeit.split(/\s+(?=ohne|mit)\b/);
    const detail = briefingText(job.core_hours_detail);
    out.push({ id: 'zeit', label: 'Arbeitszeit', wert: kopf, zusatz: [rest.join(' '), detail].filter(Boolean).join(', ') || undefined });
  }
  const vertrag = briefingText(job.contract_limitation);
  if (vertrag) out.push({ id: 'vertrag', label: 'Vertrag', wert: vertrag.charAt(0).toLowerCase() + vertrag.slice(1) });
  const team = zahl(job.team_size);
  if (team) out.push({ id: 'team', label: 'Team', wert: `${team} Personen` });
  const dringlichkeit = briefingText(job.hiring_urgency);
  const stand = zahl(job.candidates_in_pipeline);
  if (dringlichkeit || stand != null) {
    out.push({
      id: 'besetzung', label: 'Besetzung', wert: dringlichkeit ? dringlichkeit.charAt(0).toLowerCase() + dringlichkeit.slice(1) : 'offen',
      zusatz: stand != null ? `${stand} ${stand === 1 ? 'Kandidat' : 'Kandidaten'} bei Aufnahme` : undefined,
      dringend: ['urgent', 'hot'].includes(String(job.hiring_urgency)),
    });
  }
  return out;
}

/**
 * Was beim Kunden noch offen ist: Fragen aus dem Katalog (Wortlaut der Aufnahme),
 * deren Spalte leer ist. Ohne Folgefragen und ohne Zielfirmen, Abwerbeschutz und
 * Einwände, solange die Firma nicht freigegeben ist (die View liefert sie dann leer).
 */
export function fehlendeAngaben(job: BriefingJob, revealed: boolean): Fehlt[] {
  const freelance = job.employment_type === 'freelance';
  const gesperrt = revealed ? new Set<string>() : new Set(['target_companies', 'nogo_companies', 'candidate_concerns', 'candidate_concerns_answer']);
  const out: Fehlt[] = [];
  for (const feld of INTAKE_FIELDS) {
    if ((feld.only === 'employee' && freelance) || (feld.only === 'freelance' && !freelance)) continue;
    const id = String(feld.id);
    if (gesperrt.has(id) || id.startsWith('works_council')) continue;
    const slot = ALL_SLOTS.find(s => s.column === id && s.place !== 'dashboard');
    if (!slot || slot.askIf || slot.askIfNot || slot.askIfLeer) continue;
    if (slot.only && slot.only !== (freelance ? 'freelance' : 'full-time')) continue;
    if (fieldValue(job, feld.id)) continue;
    // Wortlaut der Aufnahme: die Zeile, wenn sie selbst eine Frage ist, sonst die ganze Frage.
    const frage = slot.label.trim().endsWith('?') ? slot.label.trim() : frageNach(slot.question)?.text ?? slot.label;
    out.push({ id, label: feld.label, frage });
  }
  return out;
}

export function buildMandatsBriefing(job: Job, revealed: boolean): MandatsBriefing {
  const fc = kiInhalt<{
    role_summary?: string; ideal_candidate?: string; urgency_note?: string | null;
    quick_facts?: { culture_keywords?: string[] };
    ansprache?: { telefon?: { einstieg?: string; fragen?: string[] } };
    anzeige?: { aufgaben?: string[]; ablauf?: string[] } | null;
  }>(roh(job));
  const insights = (() => {
    const js = roh(job).job_summary;
    const obj = typeof js === 'string' ? (() => { try { return JSON.parse(js); } catch { return null; } })() : js;
    return (obj as { ai_insights?: { ideal_profile?: string; hiring_recommendation?: string } } | null)?.ai_insights ?? null;
  })();
  const kriterien = getRecruiterCriteria(job);
  const sprachen = spracheListe(job.required_languages);
  const f = fakten(job);
  const gehalt = f.find(x => x.id === 'gehalt');
  const vorOrt = f.find(x => x.id === 'vorort');

  // Knock-out: was im ersten Anruf geklärt sein muss, fest aus den Angaben.
  const knockout: { text: string; fehlt?: boolean }[] = [];
  if (vorOrt && vorOrt.tage) knockout.push({ text: `${vorOrt.tage} ${vorOrt.tage === 1 ? 'Tag' : 'Tage'} pro Woche${job.location ? ` in ${job.location}` : ''}` });
  for (const s of sprachen) knockout.push({ text: `${s.replace(/\s([A-C][12])$/, ' mindestens $1')}` });
  if (gehalt) knockout.push({ text: [gehalt.wert, gehalt.zusatz].filter(Boolean).join(' ') });
  for (const t of punkte(job.contract_sensitive_topics)) knockout.push({ text: t });
  if (job.employment_type !== 'freelance') {
    const frist = briefingText(job.max_notice_period);
    knockout.push(frist ? { text: `Kündigungsfrist höchstens ${frist}` } : { text: 'Kündigungsfrist: Grenze des Kunden fehlt', fehlt: true });
  }

  // Vorher wissen (Befund 10.09.2026): laufen schon Profile, arbeitet er auf Platz drei;
  // ein Gegenangebot muss er vorbereiten, BEVOR er anruft.
  const vorwissen: string[] = [];
  const imProzess = zahl(job.candidates_in_pipeline);
  if (imProzess && imProzess > 0) vorwissen.push(`Beim Kunden ${imProzess === 1 ? 'ist schon 1 Kandidat' : `sind schon ${imProzess} Kandidaten`} im Prozess.`);
  const absage = briefingText(job.candidates_dropped_reason);
  if (absage) vorwissen.push(`Bisherige Absagegründe: ${absage}`);

  // Fachfragen der KI, mit dem Muss-Kriterium, auf das sie zielen.
  const fragen = (fc?.ansprache?.telefon?.fragen ?? []).map(frage => {
    const bezug = kriterien.required.find(k => frage.toLocaleLowerCase('de-DE').includes(k.split(/\s+/)[0].toLocaleLowerCase('de-DE').slice(0, 6))) ?? null;
    return { frage, bezug };
  });

  const muss = kriterien.required;
  const verhandelbar = kriterien.negotiable.map(v => v.replace(/\s*\b(von vorteil|wünschenswert)\b.*$/i, '').trim()).filter(Boolean);
  const pitch = ohneDoppelte(punkte(job.position_advantages));
  const karriere = briefingText(job.career_example) || briefingText(job.career_path);
  const perspektive = briefingText(job.career_path) && keyOf(briefingText(job.career_path)) !== keyOf(karriere) ? briefingText(job.career_path) : '';
  // Zertifikate nur, wenn sie nicht schon bei Muss oder Plus stehen (sonst wirkt „von Vorteil“ wie Pflicht).
  const genannt = [...muss, ...kriterien.trainable, ...kriterien.negotiable].map(keyOf);
  const zertifikate = spracheListe(job.required_certifications).filter(z => !genannt.some(g => g.includes(keyOf(z))));
  const weitereSkills = list(job.skills).filter(k => !genannt.some(g => g.includes(keyOf(k)) || keyOf(k).includes(g)));
  const benefits = nichtSchonGenannt(ohneDoppelte(list(job.benefits)), pitch);
  const besonders = ohneDoppelte(punkte(job.unique_selling_points));

  const branche = briefingText(job.industry);
  const groesse = [zahl(job.company_headcount) ? `${zahl(job.company_headcount)!.toLocaleString('de-DE')} Mitarbeitende` : null, briefingText(job.company_size_band) || null].filter(Boolean);
  const beschreibung = [branche, job.location, groesse.length ? groesse.join(' · ') : null].filter(Boolean).join(' · ');

  // Ablauf: die Antwort des Kunden; fehlt sie, die Schritte aus der Anzeige (KI).
  const ablaufKunde = punkte(job.interview_process);
  const ablaufKi = ablaufKunde.length ? [] : (fc?.anzeige?.ablauf ?? []).filter(Boolean);
  const schritte = ['Gespräch mit dir', ...(ablaufKunde.length ? ablaufKunde : ablaufKi)];
  // Aufgaben: die Aufgabenverteilung des Kunden; sonst die Aufgaben, die die KI aus seiner Beschreibung gezogen hat.
  const verteilung = job.task_breakdown && typeof job.task_breakdown === 'object' && !Array.isArray(job.task_breakdown)
    ? Object.entries(job.task_breakdown as Record<string, unknown>) : [];
  const aufgabenKi = (fc?.anzeige?.aufgaben ?? []).filter(Boolean);
  const entscheider = list(job.decision_makers);
  const kulturKi = (fc?.quick_facts?.culture_keywords ?? []).filter(k => typeof k === 'string' && k.trim());

  return {
    fakten: f,
    anruf: { einstieg: fc?.ansprache?.telefon?.einstieg?.trim() || null, vorwissen, knockout, fragen },
    rolle: {
      kurz: fc?.role_summary?.trim() || null,
      warumOffen: briefingText(job.vacancy_reason).replace(/\s*\/\s*/g, ', '),
      warumJetzt: (typeof fc?.urgency_note === 'string' && fc.urgency_note.trim()) || null,
      schwerpunkt: briefingText(job.task_focus),
      wennOffen: punkte(job.negative_impact_if_unfilled),
    },
    profil: {
      muss, erlernbar: kriterien.trainable, verhandelbar,
      nichtSchicken: punkte(job.failure_profile),
      soGelingt: punkte(job.success_profile),
      idealKi: kiSatz(roh(job), fc?.ideal_candidate) ?? kiSatz(roh(job), insights?.ideal_profile),
      empfehlungKi: kiSatz(roh(job), insights?.hiring_recommendation),
      zielfirmen: list(job.target_companies), nogo: list(job.nogo_companies), zeigtSuche: revealed,
      zertifikate, weitereSkills,
    },
    aufgaben: {
      liste: verteilung.length ? verteilung.map(([k]) => k) : aufgabenKi,
      herkunft: verteilung.length ? 'kunde' : aufgabenKi.length ? 'ki' : null,
      alltag: briefingText(job.daily_routine),
      gewichtung: verteilung.map(([k, v]) => `${k}: ${briefingText(v)}${typeof v === 'number' ? ' %' : ''}`),
      ergebnis90: narrativeAnswer(job, 'deliverable_90d'),
    },
    angebot: {
      pitch, beleg: karriere, perspektive, benefits,
      gehalt: gehalt ? [gehalt.wert, gehalt.zusatz].filter(Boolean).join(' ') : '',
      spielraum: briefingText(job.salary_flex),
      ueberstunden: briefingText(job.overtime_policy),
      erfassung: briefingText(job.time_tracking_method),
      vorab: punkte(job.contract_sensitive_topics),
      einwaende: list(job.candidate_concerns),
      einwandAntwort: briefingText(job.candidate_concerns_answer),
    },
    unternehmen: {
      beschreibung, besonders,
      kultur: briefingText(job.company_culture), kulturKi,
      berichtetAn: briefingText(job.reports_to),
      abteilung: briefingText(job.department_structure),
      teamGroesse: zahl(job.team_size) ? String(zahl(job.team_size)) : '',
      chancen: briefingText(job.industry_opportunities),
      herausforderungen: briefingText(job.industry_challenges),
    },
    auswahl: {
      schritte, schritteHerkunft: ablaufKunde.length ? 'kunde' : ablaufKi.length ? 'ki' : null, entscheider,
      vertragTage: briefingText(job.contract_creation_days),
      digital: job.contract_sent_digitally === true,
      ablauf: briefingText(job.interview_process),
      visum: typeof job.visa_sponsorship === 'boolean' ? (job.visa_sponsorship ? 'Visum unterstützt der Kunde' : 'Arbeitserlaubnis für Deutschland nötig') : '',
      // Die Spalte steht ab Werk auf false, auch wenn nie gefragt -- nur „Ja“ sagt etwas.
      betriebsrat: job.works_council === true ? ['Ja', briefingText(job.works_council_meeting_schedule)].filter(Boolean).join(', tagt ') : '',
    },
    fehlt: fehlendeAngaben(job, revealed),
  };
}

/** Eine Frage an den Kunden je Wortlaut: Chancen und Herausforderungen der Branche sind eine Frage. */
export function fragenAnKunden(fehlt: Fehlt[]): { frage: string; ids: string[]; labels: string[] }[] {
  const map = new Map<string, { frage: string; ids: string[]; labels: string[] }>();
  for (const f of fehlt) {
    const g = map.get(f.frage) ?? { frage: f.frage, ids: [], labels: [] };
    g.ids.push(f.id);
    g.labels.push(f.label);
    map.set(f.frage, g);
  }
  return [...map.values()];
}
