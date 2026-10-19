// Prüfung aller Texte, die zum Kunden gehen (Kundenprofil, Kurzprofil,
// Highlights) – auch wenn der Headhunter sie von Hand bearbeitet hat. Bisher
// wirkte die Sperre nur beim automatischen Entwurf; im Testkandidaten stand so
// „Aktuell 220k … Minimum 185k“ im Gehaltstext (Durchklicken 15.10.2026).
// Rot = darf nie zum Kunden (sperrt das Einreichen), gelb = passt nicht mehr zu
// den Angaben (veraltet).

import { NOTICE_OPTIONS, optionLabel, parseMoney, type DossierForm } from '@/lib/candidateDossier';

export type ClientTextField = 'summary_motivation' | 'summary_salary' | 'summary_notice' | 'summary_key_requirements' | 'summary_cultural_fit' | 'expose_summary' | 'expose_highlights';

export interface ClientTextIssue {
  field: ClientTextField;
  level: 'danger' | 'warn';
  message: string;
}

export const CLIENT_TEXT_FIELDS: ClientTextField[] = ['summary_motivation', 'summary_salary', 'summary_notice', 'summary_key_requirements', 'summary_cultural_fit', 'expose_summary', 'expose_highlights'];

const INTERNAL_WORDS = /\b(aktuell|derzeit|heute|momentan|verdient|verdienst|bisher|bisheriges|minimum|mindestens|untergrenze|schmerzgrenze|nicht unter|notfalls|all-?in heute)\b/i;
const OTHER_APPS = /\b(andere(n)? bewerbung\w*|weitere(n)? prozess\w*|parallel\w* prozess\w*|weitere(s)? angebot|anderes angebot|angebot liegt vor|zweitgespräch|finale runde|in anderen prozessen)\b/i;
const AMOUNT = /\d[\d.,]*\s*(?:k\b|tsd\.?|t€|€|euro\b|mio\.?)/gi;

const sentencesOf = (text: string) => text.split(/(?<=[.!?;])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
const amountsIn = (text: string) => [...text.matchAll(AMOUNT)].map((m) => parseMoney(m[0])).filter((n): n is number => n != null && n >= 1000);
const near = (a: number, b: number | null) => b != null && b > 0 && Math.abs(a - b) / b <= 0.03;

function textOf(f: DossierForm, field: ClientTextField): string {
  return field === 'expose_highlights' ? f.expose_highlights.join(' · ') : f[field];
}

export function clientTextIssues(f: DossierForm): ClientTextIssue[] {
  const out: ClientTextIssue[] = [];
  const nameParts = f.full_name.split(/\s+/).filter((p) => p.length >= 3);
  const company = f.company.trim();
  const noticeNow = optionLabel(NOTICE_OPTIONS, f.notice_period);
  for (const field of CLIENT_TEXT_FIELDS) {
    const text = textOf(f, field).trim();
    if (!text) continue;
    const add = (level: ClientTextIssue['level'], message: string) => {
      if (!out.some((i) => i.field === field && i.message === message)) out.push({ field, level, message });
    };
    for (const s of sentencesOf(text)) {
      if (INTERNAL_WORDS.test(s) && amountsIn(s).length) add('danger', 'Nennt ein aktuelles Gehalt oder eine Untergrenze. Das darf der Kunde nie sehen.');
    }
    for (const a of amountsIn(text)) {
      if (a === f.expected_salary) continue;
      if (near(a, f.salary_minimum)) add('danger', 'Nennt die Schmerzgrenze. Die darf der Kunde nie sehen.');
      else if (near(a, f.current_salary)) add('danger', 'Nennt das aktuelle Gehalt. Das darf der Kunde nie sehen.');
      else if (field === 'summary_salary' && f.expected_salary && a < f.expected_salary) add('danger', 'Nennt einen Betrag unter dem Wunschgehalt.');
      else if (f.expected_salary) add('warn', `Betrag passt nicht mehr zur Akte (Wunschgehalt ${f.expected_salary.toLocaleString('de-DE')} €).`);
    }
    if (OTHER_APPS.test(text)) add('danger', 'Erwähnt andere Bewerbungen. Das bleibt beim Headhunter.');
    if (nameParts.some((p) => new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text))) add('danger', 'Enthält den Namen der Person.');
    if (company.length >= 3 && text.toLowerCase().includes(company.toLowerCase())) add('danger', 'Enthält den aktuellen Arbeitgeber.');
    // Veraltet: Kündigungsfrist oder Starttermin im Text weichen von den Angaben ab.
    if (noticeNow) {
      const mentioned = [...text.matchAll(/(\d+)\s*(Wochen?|Monate?)/gi)].map((m) => `${m[1]} ${m[2].toLowerCase().startsWith('w') ? (m[1] === '1' ? 'Woche' : 'Wochen') : (m[1] === '1' ? 'Monat' : 'Monate')}`);
      if (mentioned.length && !mentioned.some((m) => noticeNow.includes(m))) add('warn', `Kündigungsfrist passt nicht mehr zu den Angaben (jetzt ${noticeNow}).`);
    }
    if (f.availability_date) {
      const want = new Date(f.availability_date);
      const dates = [...text.matchAll(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g)].map((m) => new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
      const months = [...text.matchAll(/\b(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})\b/gi)]
        .map((m) => new Date(Number(m[2]), ['januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'].indexOf(m[1].toLowerCase()), 1));
      const off = [...dates, ...months].some((d) => d.getFullYear() !== want.getFullYear() || d.getMonth() !== want.getMonth());
      if (off) add('warn', `Starttermin passt nicht mehr zu den Angaben (verfügbar ab ${want.toLocaleDateString('de-DE')}).`);
    }
  }
  return out;
}

export const hasBlockingClientText = (f: DossierForm) => clientTextIssues(f).some((i) => i.level === 'danger');
