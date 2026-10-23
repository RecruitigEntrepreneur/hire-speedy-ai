import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Loader2, RotateCcw } from 'lucide-react';
import { AcademyLayout } from '../components/AcademyLayout';
import { QuestionView, ResultMark, TYPE_LABEL, initialAnswer, isComplete, missingHint } from '../components/QuestionView';
import { Answer, StartedAttempt, TopicFeedback, answerTopic, locate, startAttempt, useCourseState } from '../lib/ausbildung';

export default function AbfragePage() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: state, isLoading } = useCourseState();
  const { module: m, lesson: ls } = locate(state, lessonId);

  const [attempt, setAttempt] = useState<StartedAttempt | null>(null);
  const [startError, setStartError] = useState('');
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<Answer | undefined>();
  const [feedback, setFeedback] = useState<TopicFeedback | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState(0);
  const started = useRef(-1);

  useEffect(() => {
    if (!lessonId || started.current === round) return;
    started.current = round;
    setAttempt(null); setIndex(0); setFeedback(null); setResults([]); setStartError('');
    startAttempt('topic', lessonId)
      .then((a) => { setAttempt(a); setAnswer(initialAnswer(a.questions[0])); })
      .catch((e: Error) => setStartError(e.message));
  }, [lessonId, round]);

  if (isLoading) {
    return <AcademyLayout><div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-[hsl(40_8%_60%)]" /></div></AcademyLayout>;
  }
  if (!m || !ls) return <Navigate to="/dashboard" replace />;

  const q = attempt?.questions[index];
  const finished = !!feedback?.finished;

  const check = async () => {
    if (!attempt || !q) return;
    if (!isComplete(q, answer)) { setHint(missingHint(q)); return; }
    setBusy(true);
    try {
      const fb = await answerTopic(attempt.attempt_id, q.id, answer as Answer);
      setFeedback(fb);
      setResults((r) => [...r, fb.correct]);
      if (fb.finished) qc.invalidateQueries({ queryKey: ['academy', 'state'] });
    } catch (e) {
      setHint((e as Error).message);
    } finally { setBusy(false); }
  };

  const next = () => {
    if (!attempt) return;
    const n = index + 1;
    setIndex(n); setFeedback(null); setHint('');
    setAnswer(initialAnswer(attempt.questions[n]));
    window.scrollTo(0, 0);
  };

  const score = results.filter(Boolean).length;
  const showSummary = finished && index === (attempt?.total ?? 0) - 1;

  return (
    <AcademyLayout>
      <section className="mx-auto max-w-3xl px-5 py-12">
        <Link to={`/thema/${ls.id}`} className="inline-flex items-center gap-1.5 text-sm text-[hsl(36_9%_72%)] hover:text-[hsl(40_20%_93%)]">
          <ArrowLeft className="h-4 w-4" /> Zurück zum Thema
        </Link>
        <p className="eyebrow mt-6">Abfrage · Thema {m.sort_order}.{ls.sort_order}</p>
        <h1 className="font-display mt-2 text-3xl">{ls.title}</h1>

        {startError && <p className="mt-8 text-[hsl(6_85%_75%)]">{startError}</p>}
        {!attempt && !startError && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[hsl(40_8%_60%)]" /></div>}

        {attempt && q && (
          <>
            <div className="mt-6 flex items-center gap-2" aria-label={`Frage ${index + 1} von ${attempt.total}`}>
              {attempt.questions.map((_, i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full ${i < results.length ? (results[i] ? 'bg-[hsl(152_56%_48%)]' : 'bg-[hsl(6_85%_72%)]') : i === index ? 'bg-[hsl(var(--acad-gold))]' : 'bg-[hsl(30_6%_15%)]'}`} />
              ))}
            </div>
            <p className="mt-3 text-sm text-[hsl(36_9%_72%)]">Frage {index + 1} von {attempt.total} · {TYPE_LABEL[q.type]}</p>

            <div className="acad-panel mt-4 p-6">
              {q.case_text && <p className="mb-3 rounded-xl bg-[hsl(30_6%_11%)] p-4 text-[15px] italic text-[hsl(36_10%_82%)]">{q.case_text}</p>}
              <p className="text-lg font-medium">{q.prompt}</p>
              <div className="mt-5">
                <QuestionView
                  key={q.id}
                  question={q}
                  value={answer}
                  onChange={(a) => { setAnswer(a); setHint(''); }}
                  reveal={feedback ? { correct: feedback.correct, correct_answer: feedback.correct_answer } : null}
                />
              </div>

              {feedback && (
                <div className={`mt-5 rounded-xl border p-4 ${feedback.correct ? 'border-[hsl(152_56%_48%/0.45)]' : 'border-[hsl(6_85%_72%/0.45)]'}`} role="status">
                  <div className="flex items-center gap-2"><ResultMark correct={feedback.correct} /></div>
                  <p className="mt-2 text-[15px] text-[hsl(36_10%_85%)]"><span className="font-medium">Warum: </span>{feedback.explanation}</p>
                  {!feedback.correct && (
                    <p className="mt-1 text-xs text-[hsl(36_9%_66%)]">Merk dir die Begründung: Die Frage kann in einer späteren Abfrage oder im Modul-Test wieder vorkommen.</p>
                  )}
                </div>
              )}

              {hint && <p className="mt-3 text-sm text-[hsl(6_85%_75%)]" role="alert">{hint}</p>}

              <div className="mt-6 flex flex-wrap gap-2">
                {!feedback && (
                  <button onClick={check} disabled={busy} className="btn-gold inline-flex items-center gap-1 px-5 py-2.5 text-sm">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Antwort prüfen'}
                  </button>
                )}
                {feedback && !showSummary && (
                  <button onClick={next} className="btn-gold inline-flex items-center gap-1 px-5 py-2.5 text-sm">Nächste Frage <ArrowRight className="h-4 w-4" /></button>
                )}
              </div>
            </div>

            {showSummary && feedback && (
              <div className={`acad-panel mt-6 p-6 ${feedback.passed ? 'border-[hsl(152_56%_48%/0.5)]' : 'border-[hsl(6_85%_72%/0.4)]'}`} role="status">
                <p className="font-display text-2xl">{score} von {attempt.total} richtig</p>
                <p className="mt-1 text-[15px] text-[hsl(36_10%_82%)]">
                  {feedback.passed
                    ? 'Bestanden. Das Thema ist abgehakt.'
                    : 'Noch nicht bestanden (ab 80 %). Lies die Begründungen und probier es gleich nochmal – es kommen teils andere Fragen.'}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {feedback.passed ? (
                    <button
                      onClick={async () => {
                        await qc.invalidateQueries({ queryKey: ['academy', 'state'] });
                        const nextLesson = m.lessons.find((l) => l.sort_order > ls.sort_order);
                        navigate(nextLesson ? `/thema/${nextLesson.id}` : `/modul/${m.id}`);
                      }}
                      className="btn-gold inline-flex items-center gap-1 px-5 py-2.5 text-sm"
                    >
                      {m.lessons.some((l) => l.sort_order > ls.sort_order) ? 'Weiter zum nächsten Thema' : 'Zum Modul-Test'} <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button onClick={() => setRound((r) => r + 1)} className="btn-gold inline-flex items-center gap-1 px-5 py-2.5 text-sm"><RotateCcw className="h-4 w-4" /> Nochmal</button>
                  )}
                  <Link to={`/thema/${ls.id}`} className="btn-ghost-acad px-5 py-2.5 text-sm">Thema nochmal lesen</Link>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </AcademyLayout>
  );
}
