import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, Clock, Loader2 } from 'lucide-react';
import { AcademyLayout } from '../components/AcademyLayout';
import { QuestionView, ResultMark, TYPE_LABEL, initialAnswer, isComplete } from '../components/QuestionView';
import {
  Answer, AttemptResult, StartedAttempt, finishAttempt, formatDateTime, locate, saveTestAnswer, startAttempt, useCourseState,
} from '../lib/ausbildung';

export default function ModulTestPage() {
  const { moduleId } = useParams();
  const qc = useQueryClient();
  const { data: state, isLoading } = useCourseState();
  const { module: m } = locate(state, undefined, moduleId);

  const [attempt, setAttempt] = useState<StartedAttempt | null>(null);
  const [startError, setStartError] = useState('');
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [index, setIndex] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [showReview, setShowReview] = useState(false);
  const started = useRef(false);
  // Reihenfolge-Fragen sind ab Start „vollständig“; als beantwortet zählen sie erst nach einer Bewegung.
  const touched = useRef(new Set<string>());
  // Speichern läuft im Hintergrund nacheinander; die nächste Frage erscheint sofort.
  const saving = useRef<Promise<void>>(Promise.resolve());
  const failed = useRef(new Set<string>());

  useEffect(() => {
    if (!moduleId || started.current) return;
    started.current = true;
    startAttempt('module', moduleId)
      .then((a) => {
        setAttempt(a);
        const init: Record<string, Answer> = {};
        a.questions.forEach((q) => {
          const saved = a.answers?.[q.id];
          const start = saved ?? initialAnswer(q);
          if (start !== undefined) init[q.id] = start;
        });
        setAnswers(init);
      })
      .catch((e: Error) => setStartError(e.message));
  }, [moduleId]);

  if (isLoading) {
    return <AcademyLayout><div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-[hsl(40_8%_60%)]" /></div></AcademyLayout>;
  }
  if (!m) return <Navigate to="/dashboard" replace />;

  const questions = attempt?.questions ?? [];
  const q = questions[index];
  const answeredCount = questions.filter((x) => isComplete(x, answers[x.id]) && (x.type !== 'order' || attempt?.answers?.[x.id] !== undefined || touched.current.has(x.id))).length;

  const persist = (qid: string) => {
    if (!attempt) return;
    const question = questions.find((x) => x.id === qid);
    const a = answers[qid];
    if (!question || !isComplete(question, a)) return;
    saving.current = saving.current
      .then(() => saveTestAnswer(attempt.attempt_id, qid, a))
      .then(
        () => { failed.current.delete(qid); },
        () => { failed.current.add(qid); setError('Eine Antwort konnte nicht gespeichert werden. Beim Abgeben versuchen wir es erneut.'); },
      );
  };

  const go = (to: number) => {
    setError('');
    if (q) persist(q.id);
    setIndex(to);
    window.scrollTo(0, 0);
  };

  const submit = async () => {
    if (!attempt) return;
    setBusy(true); setError('');
    try {
      if (q) persist(q.id);
      await saving.current;
      for (const qid of [...failed.current]) {
        await saveTestAnswer(attempt.attempt_id, qid, answers[qid]);
        failed.current.delete(qid);
      }
      const res = await finishAttempt(attempt.attempt_id);
      setResult(res);
      setConfirming(false);
      qc.invalidateQueries({ queryKey: ['academy', 'state'] });
      window.scrollTo(0, 0);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const nextModule = result?.next_module_id ? state?.modules.find((x) => x.id === result.next_module_id) : undefined;
  const weakest = result?.by_lesson.filter((b) => b.wrong > 0).sort((a, b) => b.wrong - a.wrong)[0];

  return (
    <AcademyLayout>
      <section className="mx-auto max-w-3xl px-5 py-12">
        <Link to={`/modul/${m.id}`} className="inline-flex items-center gap-1.5 text-sm text-[hsl(36_9%_72%)] hover:text-[hsl(40_20%_93%)]">
          <ArrowLeft className="h-4 w-4" /> Modul {m.sort_order} · {m.title}
        </Link>
        <p className="eyebrow mt-6">Modul-Test {m.sort_order}</p>
        <h1 className="font-display mt-2 text-3xl">{m.title}</h1>

        {startError && (
          <div className="acad-panel mt-8 flex items-center gap-3 p-5 text-[hsl(36_10%_82%)]">
            <Clock className="h-5 w-5 text-[hsl(var(--acad-gold-soft))]" /> {startError}
          </div>
        )}
        {!attempt && !startError && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[hsl(40_8%_60%)]" /></div>}

        {/* Ergebnis */}
        {result && (
          <div className="mt-8 space-y-6">
            <div className={`acad-panel p-6 ${result.passed ? 'border-[hsl(152_56%_48%/0.5)]' : 'border-[hsl(6_85%_72%/0.4)]'}`} role="status">
              <p className="font-display text-3xl">{result.score} von {result.total} richtig</p>
              <p className="mt-1 text-[15px]">
                {result.passed
                  ? <span className="text-[hsl(152_48%_66%)]">Bestanden (ab {result.pass_pct} %). {nextModule ? `Modul ${nextModule.sort_order} ist jetzt offen.` : 'Das war das letzte Modul.'}</span>
                  : <span className="text-[hsl(6_85%_78%)]">{Math.round((result.score / result.total) * 100)} % – noch nicht bestanden (ab {result.pass_pct} %).</span>}
              </p>
              {!result.passed && result.retry_at && (
                <p className="mt-1 text-sm text-[hsl(36_9%_72%)]">Wiederholung mit neuen Fragen ab {formatDateTime(result.retry_at)}.</p>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                {result.passed && nextModule && (
                  <Link to={`/modul/${nextModule.id}`} className="btn-gold inline-flex items-center gap-1 px-5 py-2.5 text-sm">Weiter zu Modul {nextModule.sort_order} <ArrowRight className="h-4 w-4" /></Link>
                )}
                {result.passed && !nextModule && (
                  <Link to="/dashboard" className="btn-gold inline-flex items-center gap-1 px-5 py-2.5 text-sm">Zur Übersicht <ArrowRight className="h-4 w-4" /></Link>
                )}
                {!result.passed && weakest && (
                  <Link to={`/thema/${weakest.lesson_id}`} className="btn-gold inline-flex items-center gap-1 px-5 py-2.5 text-sm">Thema {m.sort_order}.{weakest.sort_order} nochmal ansehen</Link>
                )}
                <button onClick={() => setShowReview((v) => !v)} className="btn-ghost-acad px-5 py-2.5 text-sm">
                  {showReview ? 'Antworten ausblenden' : result.passed ? 'Antworten durchgehen' : 'Fehler durchgehen'}
                </button>
              </div>
            </div>

            <div className="acad-panel px-5">
              <p className="pt-4 text-sm font-medium">{result.passed ? 'Nach Themen' : 'Was noch wackelt'}</p>
              {result.by_lesson.map((b) => (
                <div key={b.lesson_id} className="flex items-center justify-between gap-3 border-b border-[hsl(40_30%_90%/0.06)] py-3 text-[15px] last:border-0">
                  <span>{m.sort_order}.{b.sort_order} {b.title}</span>
                  {b.wrong === 0
                    ? <span className="text-sm text-[hsl(152_48%_66%)]">alles richtig</span>
                    : <span className="text-sm text-[hsl(6_85%_78%)]">{b.wrong} {b.wrong === 1 ? 'Fehler' : 'Fehler'} von {b.total}</span>}
                </div>
              ))}
            </div>

            {showReview && (
              <div className="space-y-4">
                {result.review.filter((r) => (result.passed ? true : !r.correct)).map((r, i) => (
                  <div key={r.question_id} className="acad-panel p-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-[hsl(36_9%_66%)]">Frage {i + 1} · {TYPE_LABEL[r.type]}</span>
                      <ResultMark correct={r.correct} />
                    </div>
                    {r.case_text && <p className="mt-3 rounded-xl bg-[hsl(30_6%_11%)] p-3 text-sm italic text-[hsl(36_10%_82%)]">{r.case_text}</p>}
                    <p className="mt-3 font-medium">{r.prompt}</p>
                    <div className="mt-3">
                      <QuestionView
                        question={{ id: r.question_id, type: r.type, case_text: r.case_text, prompt: r.prompt, options: r.options }}
                        value={r.your_answer ?? undefined}
                        onChange={() => undefined}
                        reveal={{ correct: r.correct, correct_answer: r.correct_answer }}
                      />
                    </div>
                    <p className="mt-3 text-[15px] text-[hsl(36_10%_85%)]"><span className="font-medium">Warum: </span>{r.explanation}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Test */}
        {attempt && q && !result && (
          <>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-sm text-[hsl(36_9%_72%)]">
              <span>Frage {index + 1} von {questions.length} · {TYPE_LABEL[q.type]}</span>
              <span>bestanden ab {m.test_pass_pct} % · keine Zeitgrenze</span>
            </div>
            <div className="mt-2 flex gap-1">
              {questions.map((x, i) => (
                <button key={x.id} onClick={() => go(i)} aria-label={`Zu Frage ${i + 1}`} aria-current={i === index ? 'step' : undefined} className={`h-2 flex-1 rounded-full ${i === index ? 'bg-[hsl(var(--acad-gold))]' : isComplete(x, answers[x.id]) && (x.type !== 'order' || touched.current.has(x.id) || attempt.answers?.[x.id] !== undefined) ? 'bg-[hsl(36_9%_55%)]' : 'bg-[hsl(30_6%_15%)]'}`} />
              ))}
            </div>

            <div className="acad-panel mt-4 p-6">
              {q.case_text && <p className="mb-3 rounded-xl bg-[hsl(30_6%_11%)] p-4 text-[15px] italic text-[hsl(36_10%_82%)]">{q.case_text}</p>}
              <p className="text-lg font-medium">{q.prompt}</p>
              <div className="mt-5">
                <QuestionView
                  key={q.id}
                  question={q}
                  value={answers[q.id]}
                  onChange={(a) => { touched.current.add(q.id); setAnswers((prev) => ({ ...prev, [q.id]: a })); }}
                />
              </div>
              {error && <p className="mt-3 text-sm text-[hsl(6_85%_75%)]" role="alert">{error}</p>}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
                <button onClick={() => go(index - 1)} disabled={index === 0} className="btn-ghost-acad px-4 py-2 text-sm disabled:opacity-30">Zurück</button>
                {index < questions.length - 1
                  ? <button onClick={() => go(index + 1)} className="btn-gold inline-flex items-center gap-1 px-5 py-2.5 text-sm">Weiter <ArrowRight className="h-4 w-4" /></button>
                  : <button onClick={() => setConfirming(true)} className="btn-gold inline-flex items-center gap-1 px-5 py-2.5 text-sm"><Check className="h-4 w-4" /> Test abgeben</button>}
              </div>
            </div>

            {confirming && (
              <div className="acad-panel mt-4 border-[hsl(var(--acad-gold)/0.45)] p-5" role="alertdialog" aria-label="Test abgeben">
                <p className="font-medium">Test jetzt abgeben?</p>
                <p className="mt-1 text-sm text-[hsl(36_10%_82%)]">
                  {answeredCount} von {questions.length} Fragen beantwortet.
                  {answeredCount < questions.length && ' Unbeantwortete Fragen zählen als falsch.'}
                </p>
                <div className="mt-4 flex gap-2">
                  <button onClick={submit} disabled={busy} className="btn-gold inline-flex items-center gap-1 px-5 py-2.5 text-sm">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Endgültig abgeben'}
                  </button>
                  <button onClick={() => setConfirming(false)} className="btn-ghost-acad px-5 py-2.5 text-sm">Weiter prüfen</button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </AcademyLayout>
  );
}
