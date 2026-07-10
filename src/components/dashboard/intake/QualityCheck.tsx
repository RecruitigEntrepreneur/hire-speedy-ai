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
  progressPct: number;
  openQuestions: OpenQuestion[];
  revealDescriptor: string;
}

const answerText = (a: Answers[string] | undefined): string =>
  !a || a.unknown ? '' : Array.isArray(a.value) ? a.value.join(' ') : String(a.value ?? '');

/** AGG-Guardrail: erkennt Kriterien, die nicht berufsbezogen sind. */
const AGG_PATTERN = /\balter\b|\bjung(e|er)?\b|männlich|weiblich|\bfrau(en)?\b|\bmann\b|herkunft|nationalität|religion|schwanger|behindert|behinderung|\bgeschlecht/i;

/** Beratender Qualitäts-Check vor der Übergabe — warnt und zeigt Hebel, blockiert NIE. */
export function QualityCheck({ type, built, freelance, answers, progressPct, openQuestions, revealDescriptor }: Props) {
  const { score, warnings, levers } = useMemo(() => {
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

    const score = Math.max(0, Math.min(100, Math.round(progressPct * 0.6 + profilePts * 0.4 - warnings.length * 5)));
    return { score, warnings, levers: levers.slice(0, 3) };
  }, [type, built, freelance, answers, progressPct, openQuestions, revealDescriptor]);

  const level = score >= 80 ? 'gut' : score >= 55 ? 'mittel' : 'niedrig';

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <BadgeCheck className={cn('h-4 w-4', level === 'gut' ? 'text-emerald-500' : level === 'mittel' ? 'text-amber-500' : 'text-muted-foreground')} />
          Briefing-Reife
        </p>
        <span className={cn('text-sm font-bold tabular-nums', level === 'gut' ? 'text-emerald-600' : level === 'mittel' ? 'text-amber-600' : 'text-muted-foreground')}>
          {score}/100
        </span>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', level === 'gut' ? 'bg-emerald-500' : level === 'mittel' ? 'bg-amber-500' : 'bg-muted-foreground/40')}
          style={{ width: `${score}%` }}
        />
      </div>

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
      {warnings.length === 0 && levers.length === 0 && (
        <p className="text-xs text-muted-foreground">Keine Auffälligkeiten — die Recruiter haben, was sie brauchen.</p>
      )}
      <p className="mt-2 border-t pt-2 text-[11px] text-muted-foreground">
        Nur Beratung — übergeben ist jederzeit möglich.
      </p>
    </div>
  );
}
