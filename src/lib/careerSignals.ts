// Werdegang-Signale fürs Interview: was der Lebenslauf schon verrät, damit der
// Headhunter nicht fragt, was er wissen könnte, und gezielt nachhakt, wo der
// Werdegang einen Anlass gibt. Feste Regeln, keine KI, keine Bewertung der
// Person: es entstehen nur Fakten und Fragen für den Headhunter, nie ein Etikett
// („Jobhopper“) und nie etwas für den Kunden. Stationen älter als 10 Jahre
// zählen für Fragen nicht (Datensparsamkeit, DSGVO Art. 5).

import { isLeaderTitle } from '@/lib/roleFamily';

export interface CareerStation {
  id?: string;
  job_title: string | null;
  company_name: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean | null;
  location?: string | null;
  description?: string | null;
}

export interface SignalStation {
  id?: string;
  title: string;
  company: string;
  start: Date | null;
  end: Date | null; // null = bis heute
  current: boolean;
  location: string;
  /** Start nicht gespeichert, sondern abgeleitet (Lebenslauf-Text oder Vorstation). */
  startDerived: 'cv_text' | 'previous_end' | null;
}

export interface CareerHook {
  key: string;
  /** Feld im Interview, an dessen Frage der Hinweis steht. */
  field: string;
  /** Kurzer Hinweis aus dem Werdegang (nur für den Headhunter). */
  context: string;
  /** Zusätzliche Frage an den Kandidaten, wenn die vorhandene nicht passt. */
  question?: string;
  chips?: string[];
}

export interface CareerSignals {
  stations: SignalStation[];
  current: SignalStation | null;
  /** Jahre im aktuellen Unternehmen (gerundet), null wenn der Start unbekannt ist. */
  tenureYears: number | null;
  gaps: { from: Date; to: Date; months: number }[];
  shortStints: { company: string; title: string; months: number }[];
  promotions: { company: string; title: string; months: number }[];
  freelance: boolean;
  formerLeaderOnly: boolean;
  hooks: CareerHook[];
}

const EXCEPTION = /werkstudent|praktik|\bintern\b|trainee|azubi|ausbildung|befrist|vertretung|projektvertrag|interim|freelanc|freiberuf|selbstständig|selbständig|aushilfe|minijob/i;
const FREELANCE = /freelanc|freiberuf|selbstständig|selbständig|inhaber|gründer|interim/i;
const LEGAL = /\b(gmbh|ag|se|kg|kgaa|ohg|gbr|ug|mbh|co|inc|ltd|llc|plc|holding|group|gruppe)\b\.?/gi;

const parseDate = (v: string | null | undefined): Date | null => {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(v);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, 1) : null;
};
const monthsBetween = (a: Date, b: Date) => (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
export const companyCore = (name: string) => name.replace(LEGAL, ' ').replace(/[^\p{L}\p{N}& ]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const mmYYYY = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

/**
 * Startjahr der aktuellen Station aus dem gespeicherten Lebenslauf-Text, z. B.
 * „Geschäftsführer & CEO – Global Strategy Group GmbH (2008 – heute)“ oder
 * „seit 03/2019 bei …“. Der alte Leser hat solche Angaben verloren.
 */
export function startYearFromCvText(cvText: string | null | undefined, company: string): number | null {
  if (!cvText || !company.trim()) return null;
  const core = companyCore(company).split(' ').filter((w) => w.length >= 4)[0] ?? companyCore(company);
  if (!core) return null;
  const lines = cvText.split(/\n/).filter((l) => l.toLowerCase().includes(core));
  for (const line of lines) {
    const range = /((?:19|20)\d{2})\s*(?:[–—-]|bis)\s*(?:heute|jetzt|aktuell|present|today|now|dato)/i.exec(line);
    if (range) return Number(range[1]);
    const seit = /seit\s+(?:\d{1,2}\s*[./]\s*)?((?:19|20)\d{2})/i.exec(line);
    if (seit) return Number(seit[1]);
  }
  return null;
}

export function careerSignals(input: CareerStation[], opts: { cvText?: string | null; today?: Date } = {}): CareerSignals {
  const today = opts.today ?? new Date();
  const stations: SignalStation[] = input
    .filter((s) => (s.company_name ?? '').trim() || (s.job_title ?? '').trim())
    .map((s) => ({
      id: s.id,
      title: (s.job_title ?? '').trim(),
      company: (s.company_name ?? '').trim(),
      start: parseDate(s.start_date),
      end: parseDate(s.end_date),
      current: s.is_current === true || (!s.end_date && s.is_current !== false),
      location: (s.location ?? '').trim(),
      startDerived: null,
    }));

  // Aktuelle Station: ausdrücklich „aktuell“, sonst die ohne Ende mit dem spätesten Start.
  const currentCandidates = stations.filter((s) => s.current && !s.end);
  const current = currentCandidates.sort((a, b) => (b.start?.getTime() ?? Infinity) - (a.start?.getTime() ?? Infinity))[0] ?? null;
  for (const s of stations) if (s !== current) s.current = false;

  // Fehlender Start der aktuellen Station: erst aus dem Lebenslauf-Text, sonst Ende der Vorstation.
  if (current && !current.start) {
    const year = startYearFromCvText(opts.cvText, current.company);
    if (year) {
      current.start = new Date(year, 0, 1);
      current.startDerived = 'cv_text';
    } else {
      const prevEnd = stations.filter((s) => s !== current && s.end).map((s) => s.end!).sort((a, b) => b.getTime() - a.getTime())[0];
      if (prevEnd) {
        current.start = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1);
        current.startDerived = 'previous_end';
      }
    }
  }

  const sorted = [...stations].sort((a, b) => (b.start?.getTime() ?? 0) - (a.start?.getTime() ?? 0));
  const tenureYears = current?.start ? Math.max(0, Math.floor(monthsBetween(current.start, today) / 12)) : null;
  const tenMonths = current?.start ? monthsBetween(current.start, today) : null;
  const tenYearsAgo = new Date(today.getFullYear() - 10, today.getMonth(), 1);

  // Lücken über 6 Monate zwischen zwei Stationen (nur mit echten Daten, letzte 10 Jahre).
  const dated = sorted.filter((s) => s.start).sort((a, b) => a.start!.getTime() - b.start!.getTime());
  const gaps: CareerSignals['gaps'] = [];
  let coveredUntil: Date | null = null;
  for (const s of dated) {
    if (coveredUntil && s.start! > coveredUntil) {
      const months = monthsBetween(coveredUntil, s.start!);
      if (months > 6 && s.start! > tenYearsAgo) gaps.push({ from: coveredUntil, to: s.start!, months });
    }
    const end = s.end ?? today;
    if (!coveredUntil || end > coveredUntil) coveredUntil = end;
  }
  const lastEnd = dated.length && !current ? coveredUntil : null;
  if (lastEnd && monthsBetween(lastEnd, today) > 3) gaps.push({ from: lastEnd, to: today, months: monthsBetween(lastEnd, today) });

  const shortStints = sorted
    .filter((s) => s !== current && s.start && s.end && s.end > tenYearsAgo && monthsBetween(s.start, s.end) < 18 && !EXCEPTION.test(`${s.title} ${s.company}`))
    .map((s) => ({ company: s.company, title: s.title, months: Math.max(1, monthsBetween(s.start!, s.end!)) }));

  const promotions: CareerSignals['promotions'] = [];
  for (let i = 0; i < dated.length - 1; i++) {
    const a = dated[i], b = dated[i + 1];
    if (a.company && companyCore(a.company) === companyCore(b.company) && a.title !== b.title) {
      const months = monthsBetween(a.start!, b.start!);
      if (months >= 0 && months < 12 && b.start! > tenYearsAgo) promotions.push({ company: b.company, title: b.title, months });
    }
  }

  const freelance = sorted.some((s) => FREELANCE.test(`${s.title} ${s.company}`) && (s.end ?? today) > new Date(today.getFullYear() - 5, today.getMonth(), 1));
  const formerLeaderOnly = !!current && !isLeaderTitle(current.title) && sorted.some((s) => s !== current && isLeaderTitle(s.title) && (s.end ?? today) > tenYearsAgo);

  const hooks: CareerHook[] = [];
  if (current && tenureYears != null && tenureYears >= 5) {
    hooks.push({ key: 'tenure', field: 'why_now', context: `Aus dem Werdegang: seit ${current.start!.getFullYear()}, also ${tenureYears} Jahre bei ${current.company || 'derselben Firma'}` });
  }
  if (current && tenMonths != null && tenMonths < 12) {
    hooks.push({ key: 'new_job', field: 'specific_incident', context: `Aus dem Werdegang: erst seit ${mmYYYY(current.start!)} bei ${current.company || 'der Firma'}. Was passt nicht?` });
  }
  for (const s of shortStints.slice(0, 1)) {
    hooks.push({
      key: `short:${s.company}`,
      field: 'career_what_didnt_work',
      context: `Aus dem Werdegang: bei ${s.company} nur ${s.months} Monate`,
      question: `Warum endete es bei ${s.company} nach ${s.months} Monaten?`,
      chips: [`${s.company}: Stelle anders als beschrieben`, `${s.company}: Firma umstrukturiert`, `${s.company}: bessere Chance`, `${s.company}: Probezeit beendet`, 'Privat (kein Thema)'],
    });
  }
  for (const g of gaps.slice(0, 1)) {
    hooks.push({
      key: 'gap',
      // Intern (Begründung), nie für den Kunden; Gründe wie Krankheit oder Elternzeit
      // werden nicht erfasst, dafür gibt es „privat (kein Thema)“.
      field: 'recommendation_notes',
      context: `Aus dem Werdegang: Lücke ${mmYYYY(g.from)} bis ${mmYYYY(g.to)}`,
      question: `Was haben Sie von ${mmYYYY(g.from)} bis ${mmYYYY(g.to)} gemacht?`,
      chips: ['Lücke: Weiterbildung', 'Lücke: Auszeit', 'Lücke: selbstständig', 'Lücke: Stellensuche', 'Lücke: privat (kein Thema)'],
    });
  }
  for (const p of promotions.slice(0, 1)) {
    hooks.push({ key: 'promotion', field: 'career_what_worked', context: `Aus dem Werdegang: nach ${p.months} Monaten zu „${p.title}“ bei ${p.company}` });
  }
  if (freelance) hooks.push({ key: 'freelance', field: 'change_motivation', context: 'Aus dem Werdegang: freiberufliche Phase in den letzten Jahren. Was spricht jetzt für die Festanstellung?' });
  if (formerLeaderOnly) hooks.push({ key: 'lead_again', field: 'career_ultimate_goal', context: 'Aus dem Werdegang: früher mit Führung, heute ohne. Möchte die Person wieder führen?' });

  return { stations: sorted, current, tenureYears, gaps, shortStints, promotions, freelance, formerLeaderOnly, hooks };
}

export const yearsLabel = (s: SignalStation) => {
  const from = s.start ? s.start.getFullYear() : '?';
  const to = s.end ? s.end.getFullYear() : 'heute';
  return from === to ? `${from}` : `${from} – ${to}`;
};
