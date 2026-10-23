import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Clock, Loader2, Lock } from 'lucide-react';
import { AcademyLayout } from '../components/AcademyLayout';
import { formatDateTime, locate, useCourseState } from '../lib/ausbildung';

export default function ModulPage() {
  const { moduleId } = useParams();
  const { data: state, isLoading } = useCourseState();
  const { module: m } = locate(state, undefined, moduleId);

  if (isLoading) {
    return <AcademyLayout><div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-[hsl(40_8%_60%)]" /></div></AcademyLayout>;
  }
  if (!m) return <Navigate to="/dashboard" replace />;

  const quizzesDone = m.lessons.filter((l) => l.quiz_done).length;
  const allQuizzes = quizzesDone === m.lessons.length;
  const waiting = !m.passed && m.retry_at && new Date(m.retry_at) > new Date() && !m.open_test_attempt ? m.retry_at : null;

  return (
    <AcademyLayout>
      <section className="mx-auto max-w-4xl px-5 py-12">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-[hsl(36_9%_72%)] hover:text-[hsl(40_20%_93%)]">
          <ArrowLeft className="h-4 w-4" /> Deine Ausbildung
        </Link>
        <p className="eyebrow mt-6">Modul {m.sort_order} von {state?.modules_total}</p>
        <h1 className="font-display mt-2 text-4xl">{m.title}</h1>
        {m.description && <p className="mt-3 max-w-2xl text-[17px] text-[hsl(36_10%_80%)]">{m.description}</p>}

        {!m.unlocked ? (
          <div className="acad-panel mt-8 flex items-center gap-3 p-5 text-[hsl(36_9%_72%)]">
            <Lock className="h-5 w-5" /> Dieses Modul öffnet, sobald du den Test des vorherigen Moduls bestanden hast.
          </div>
        ) : (
          <>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-1 text-xs text-[hsl(36_9%_66%)]">
              <span>Jedes Thema: lesen → Abfrage (bestanden ab 80 %, beliebig oft)</span>
            </div>
            <div className="acad-panel mt-3 divide-y divide-[hsl(40_30%_90%/0.06)] px-5">
              {m.lessons.map((l) => (
                <Link key={l.id} to={`/thema/${l.id}`} className="grid grid-cols-[1fr_auto] items-center gap-3 py-4 transition-colors hover:bg-[hsl(var(--acad-gold)/0.03)] sm:grid-cols-[1fr_auto_auto]">
                  <span>
                    <span className="font-medium">{m.sort_order}.{l.sort_order} {l.title}</span>
                    {l.learning_goal && <span className="mt-0.5 block text-sm text-[hsl(36_9%_66%)]">{l.learning_goal}</span>}
                  </span>
                  <span className="hidden text-xs text-[hsl(36_9%_66%)] sm:block">{l.duration_min ?? 8} Min · {l.quiz_total} Fragen</span>
                  {l.quiz_done
                    ? <span className="chip chip-emerald"><Check className="h-3 w-3" /> {l.quiz_best_score}/{l.quiz_total}</span>
                    : l.learned
                      ? <span className="chip chip-gold">Abfrage offen</span>
                      : <span className="chip">offen</span>}
                </Link>
              ))}
            </div>

            <div className={`acad-panel mt-6 p-5 ${m.passed ? 'border-[hsl(152_56%_48%/0.5)]' : allQuizzes ? 'border-[hsl(var(--acad-gold)/0.45)]' : ''}`}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Modul-Test</p>
                  <p className="mt-0.5 text-sm text-[hsl(36_9%_72%)]">
                    {m.test_question_count} Fragen aus allen Themen dieses Moduls · bestanden ab {m.test_pass_pct} % · keine Zeitgrenze
                  </p>
                  {m.passed && <p className="mt-1 text-sm text-[hsl(152_48%_66%)]">Bestanden mit {m.best_score} von {m.best_total}. Das nächste Modul ist offen.</p>}
                  {!m.passed && m.test_attempts > 0 && m.last_passed === false && (
                    <p className="mt-1 text-sm text-[hsl(36_10%_82%)]">Bisher bestes Ergebnis: {m.best_score} von {m.best_total}.</p>
                  )}
                </div>
                {!allQuizzes ? (
                  <span className="chip">noch {m.lessons.length - quizzesDone} {m.lessons.length - quizzesDone === 1 ? 'Abfrage' : 'Abfragen'}</span>
                ) : waiting ? (
                  <span className="chip"><Clock className="h-3 w-3" /> wieder ab {formatDateTime(waiting)}</span>
                ) : (
                  <Link to={`/modul/${m.id}/test`} className="btn-gold inline-flex items-center gap-1 px-5 py-2.5 text-sm">
                    {m.open_test_attempt ? 'Test fortsetzen' : m.passed ? 'Nochmal üben' : m.test_attempts ? 'Wiederholen' : 'Test starten'} <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </AcademyLayout>
  );
}
