import { useMemo } from 'react';
import type { Answers } from '../IntakeBriefing';
import type { BuiltJob, FreelanceTerms, JobType } from './types';
import { cn } from '@/lib/utils';
import { AlertTriangle, BadgeCheck, TrendingUp } from 'lucide-react';

interface OpenQuestion {
  id: string;
  text: string;
  chapter: string;
  weight: number;
}

interface Props {
  type: JobType;
  built: BuiltJob;
  freelance: FreelanceTerms;
  answers: Answers;
  openQuestions: OpenQuestion[];
  revealDescriptor: string;
}

const answerText = (a: Answers[string] | undefined): string =>
  !a || a.unknown ? '' : Array.isArray(a.value) ? a.value.join(' ') : String(a.value ?? '');

/** AGG-Guardrail: erkennt Kriterien, die nicht berufsbezogen sind. */
const AGG_PATTERN = /\balter\b|\bjung(e|er)?\b|männlich|weiblich|\bfrau(en)?\b|\bmann\b|herkunft|nationalität|religion|schwanger|behindert|behinderung|\bgeschlecht/i;

/**
 * Beratender Qualitäts-Check vor der Übergabe — warnt und zeigt Hebel, blockiert NIE.
 *
 * Ohne Punktzahl: die frühere "Briefing-Reife x/100" rechnete
 * 0,6 × Fortschritt + 0,4 × Formularpunkte und stand damit bei einem vollständig
 * ausgefüllten Profil und NULL beantworteten Fragen bereits bei 40. Sie stand
 * ausserdem im Widerspruch zur Prozentzahl in der Kopfzeile. Was bleibt, sind die
 * Warnungen und die Hebel — die sind belegbar.
 */
export function QualityCheck({ type, built, freelance, answers, openQuestions, revealDescriptor }: Props) {
  const { warnings, levers } = useMemo(() => {
    const isFreelance = type === 'freelance';
    const warnings: string[] = [];
    const levers: string[] = [];

    // ---- Konsistenz & Vollständigkeit -------------------------------------
    const onsiteAnswer = answerText(answers.onsite_days);
    if (built.remote_type === 'remote' && onsiteAnswer && !onsiteAnswer.startsWith('0')) {
      warnings.push(`Widerspruch: Remote-Stelle, aber „${onsiteAnswer}" Bürotage im Briefing.`);
    }
    if (built.remote_type === 'onsite' && onsiteAnswer.startsWith('0')) {
      warnings.push('Widerspruch: Vor-Ort-Stelle, aber 0 Bürotage im Briefing.');
    }
    if (!isFreelance && (built.experience_level === 'senior' || built.experience_level === 'lead') && built.salary_max && built.salary_max < 70_000) {
      warnings.push(`Budget wirkt niedrig für ${built.experience_level === 'lead' ? 'Lead' : 'Senior'} (max. €${(built.salary_max / 1000).toFixed(0)}k) — Markt-Feedback einplanen.`);
    }
    if (!isFreelance && built.experience_level === 'junior' && built.salary_max && built.salary_max > 95_000) {
      warnings.push('Junior-Level mit Budget über €95k — passt Titel oder Level?');
    }
    if (built.must_haves.length >= 8) {
      warnings.push(`${built.must_haves.length} Muss-Kriterien — der erreichbare Markt schrumpft erheblich.`);
      levers.push('1–2 Muss-Kriterien auf „verhandelbar" setzen: +5 P');
    }
    if (AGG_PATTERN.test(answerText(answers.exclusion_criteria))) {
      warnings.push('Ausschlusskriterien enthalten möglicherweise unzulässige (AGG-) Merkmale — bitte nur berufsbezogen formulieren.');
    }
    if (!built.location && built.remote_type !== 'remote') {
      warnings.push('Kein Standort angegeben, obwohl die Stelle nicht remote ist.');
    }

    // ---- Score & Hebel ------------------------------------------------------
    let profilePts = 0;
    if (built.title) profilePts += 20;
    if (built.location || built.remote_type === 'remote') profilePts += 15;
    if (isFreelance ? freelance.dayRateMin || freelance.dayRateMax : built.salary_min || built.salary_max) {
      profilePts += 25;
    } else {
      levers.push(isFreelance ? 'Tagessatz-Spanne angeben: +6 P' : 'Gehaltsband angeben: +6 P');
    }
    if (built.must_haves.length > 0) profilePts += 20;
    if (revealDescriptor) profilePts += 20;
    else levers.push('Anonymen Firmen-Descriptor setzen: +4 P');

    for (const q of openQuestions.slice(0, 2)) {
      levers.push(`„${q.text.length > 60 ? q.text.slice(0, 57) + '…' : q.text}" beantworten: +${q.weight * 3} P`);
    }

    return { warnings, levers: levers.slice(0, 3) };
  }, [type, built, freelance, answers, openQuestions, revealDescriptor]);

  // Nichts zu sagen heisst nichts anzeigen. Vorher stand hier bei null Antworten
  // "Keine Auffälligkeiten — die Recruiter haben, was sie brauchen." — im
  // KI-Pfad war dieser Satz sogar zwingend, weil openQuestions dort immer leer ist.
  if (warnings.length === 0 && levers.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <BadgeCheck className="h-4 w-4 text-muted-foreground" />
        Vor der Übergabe
      </p>

      {warnings.map((w) => (
        <p key={w} className="mb-1.5 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {w}
        </p>
      ))}
      {levers.map((l) => (
        <p key={l} className="mb-1 flex items-start gap-1.5 text-xs text-muted-foreground">
          <TrendingUp className="mt-0.5 h-3 w-3 shrink-0 text-primary/70" /> {l}
        </p>
      ))}
      <p className="mt-2 border-t pt-2 text-[11px] text-muted-foreground">
        Nur Beratung — übergeben ist jederzeit möglich.
      </p>
    </div>
  );
}
