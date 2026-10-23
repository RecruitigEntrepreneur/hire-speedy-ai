import { Link } from 'react-router-dom';
import { ArrowRight, Check, GraduationCap, Loader2, Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { AcademyLayout } from '../components/AcademyLayout';
import { ModuleState, nextStep, useCourseState } from '../lib/ausbildung';

function ModuleBadge({ m }: { m: ModuleState }) {
  if (m.passed) {
    return <span className="chip chip-emerald"><Check className="h-3 w-3" /> Test {m.best_score}/{m.best_total}</span>;
  }
  if (!m.unlocked) return <span className="chip"><Lock className="h-3 w-3" /> gesperrt</span>;
  const done = m.lessons.filter((l) => l.quiz_done).length;
  return <span className="chip chip-gold">{done < m.lessons.length ? `${done} von ${m.lessons.length} Themen` : 'Modul-Test offen'}</span>;
}

export default function AusbildungPage() {
  const { user } = useAuth();
  const { data: state, isLoading, error } = useCourseState();
  const firstName = (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0];
  const step = nextStep(state);

  return (
    <AcademyLayout>
      <section className="mx-auto max-w-5xl px-5 py-12">
        {isLoading ? (
          <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-[hsl(40_8%_60%)]" /></div>
        ) : error ? (
          <p className="text-[hsl(6_85%_75%)]">Die Ausbildung konnte nicht geladen werden: {(error as Error).message}</p>
        ) : !state ? (
          <p className="text-[hsl(40_8%_70%)]">Die Ausbildung ist noch nicht freigeschaltet.</p>
        ) : (
          <>
            <p className="eyebrow">Ausbildung zum Headhunter</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <h1 className="font-display text-4xl">{firstName ? `Hallo ${firstName}` : 'Deine Ausbildung'}</h1>
              <p className="text-sm text-[hsl(36_9%_72%)]">
                {state.modules_passed} von {state.modules_total} Modulen bestanden
              </p>
            </div>

            {step && step.kind !== 'done' && (
              <Link
                to={step.kind === 'lesson' ? `/thema/${step.lesson.id}` : `/modul/${step.module.id}/test`}
                className="acad-panel mt-8 flex flex-wrap items-center justify-between gap-4 p-5 transition-colors hover:border-[hsl(var(--acad-gold)/0.5)]"
              >
                <div>
                  <p className="text-xs text-[hsl(var(--acad-gold-soft))]">Als Nächstes · Modul {step.module.sort_order}</p>
                  <p className="mt-1 text-lg font-medium">
                    {step.kind === 'lesson'
                      ? `${step.module.sort_order}.${step.lesson.sort_order} ${step.lesson.title}`
                      : `Modul-Test: ${step.module.title}`}
                  </p>
                  <p className="mt-0.5 text-sm text-[hsl(36_9%_72%)]">
                    {step.kind === 'lesson'
                      ? `${step.lesson.duration_min ?? 8} Min lesen, dann ${step.lesson.quiz_total} Fragen`
                      : `${step.module.test_question_count} Fragen · bestanden ab ${step.module.test_pass_pct} %`}
                  </p>
                </div>
                <span className="btn-gold inline-flex items-center gap-1 px-5 py-2.5 text-sm">
                  {step.kind === 'lesson' && step.lesson.learned ? 'Weiter' : 'Starten'} <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            )}

            <div className="acad-panel mt-6 divide-y divide-[hsl(40_30%_90%/0.06)] px-5">
              {state.modules.map((m) => {
                const row = (
                  <div className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 py-4">
                    <span className={`font-display text-2xl ${m.unlocked ? 'text-[hsl(var(--acad-gold-soft))]' : 'text-[hsl(36_9%_45%)]'}`}>{m.sort_order}</span>
                    <span>
                      <span className={m.unlocked ? 'font-medium' : 'text-[hsl(36_9%_60%)]'}>{m.title}</span>
                      <span className="mt-0.5 block text-sm text-[hsl(36_9%_66%)]">
                        {m.lessons.map((l) => l.title).join(' · ')}
                      </span>
                    </span>
                    <ModuleBadge m={m} />
                  </div>
                );
                return m.unlocked
                  ? <Link key={m.id} to={`/modul/${m.id}`} className="block transition-colors hover:bg-[hsl(var(--acad-gold)/0.03)]">{row}</Link>
                  : <div key={m.id} aria-disabled="true">{row}</div>;
              })}
            </div>

            <div className={`acad-panel mt-6 flex flex-wrap items-center justify-between gap-4 p-5 ${step?.kind === 'done' ? 'border-[hsl(152_56%_48%/0.5)]' : ''}`}>
              <div className="flex items-start gap-3">
                <GraduationCap className="mt-0.5 h-5 w-5 text-[hsl(var(--acad-gold-soft))]" />
                <div>
                  <p className="font-medium">Zulassungsprüfung</p>
                  <p className="mt-0.5 max-w-xl text-sm text-[hsl(36_9%_72%)]">
                    {step?.kind === 'done'
                      ? 'Alle Module bestanden. Wir melden uns für deine Zulassungsprüfung: Arbeitsprobe und Live-Prüfung mit zwei Prüfern. Wer besteht, kommt nach Vertrag und Freischaltung ins echte Matchunt-Dashboard.'
                      : 'Öffnet, wenn alle 8 Module bestanden sind. Danach: Arbeitsprobe und Live-Prüfung. Erst wer besteht, kommt ins echte Matchunt-Dashboard.'}
                  </p>
                </div>
              </div>
              <span className={`chip ${step?.kind === 'done' ? 'chip-emerald' : ''}`}>
                {step?.kind === 'done' ? 'bereit' : `${state.modules_passed}/${state.modules_total} Module`}
              </span>
            </div>
          </>
        )}
      </section>
    </AcademyLayout>
  );
}
