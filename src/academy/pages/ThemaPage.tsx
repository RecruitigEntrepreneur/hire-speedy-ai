import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, FileText, Loader2, Play } from 'lucide-react';
import { AcademyLayout } from '../components/AcademyLayout';
import { RichText } from '../components/RichText';
import { locate, useCourseState, useLessonContent } from '../lib/ausbildung';

export default function ThemaPage() {
  const { lessonId } = useParams();
  const { data: state, isLoading: stateLoading } = useCourseState();
  const { data: lesson, isLoading } = useLessonContent(lessonId);
  const { module: m, lesson: ls } = locate(state, lessonId);

  if (isLoading || stateLoading) {
    return <AcademyLayout><div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-[hsl(40_8%_60%)]" /></div></AcademyLayout>;
  }
  if (!lesson || !m || !ls) return <Navigate to="/dashboard" replace />;
  if (!m.unlocked) return <Navigate to={`/modul/${m.id}`} replace />;

  return (
    <AcademyLayout>
      <article className="mx-auto max-w-3xl px-5 py-12">
        <Link to={`/modul/${m.id}`} className="inline-flex items-center gap-1.5 text-sm text-[hsl(36_9%_72%)] hover:text-[hsl(40_20%_93%)]">
          <ArrowLeft className="h-4 w-4" /> Modul {m.sort_order} · {m.title}
        </Link>
        <p className="eyebrow mt-6">Thema {m.sort_order}.{ls.sort_order} · {lesson.duration_min ?? 8} Min</p>
        <h1 className="font-display mt-2 text-[34px] leading-tight">{lesson.title}</h1>
        {lesson.learning_goal && (
          <p className="mt-3 text-[17px] text-[hsl(var(--acad-gold-soft))]">{lesson.learning_goal}</p>
        )}

        {lesson.video_url ? (
          <div className="mt-8 aspect-video overflow-hidden rounded-2xl border border-[hsl(40_30%_90%/0.1)]">
            <iframe src={lesson.video_url} title={lesson.title} className="h-full w-full" allow="fullscreen" />
          </div>
        ) : (
          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-dashed border-[hsl(40_30%_90%/0.14)] px-5 py-4 text-sm text-[hsl(36_9%_66%)]">
            <Play className="h-4 w-4" /> Das Video zu diesem Thema folgt. Bis dahin steht alles Wichtige im Text.
          </div>
        )}

        <RichText text={lesson.body} className="mt-8" />

        {lesson.vorlage_body && (
          <section className="acad-panel mt-10 p-6">
            <p className="flex items-center gap-2 text-sm text-[hsl(var(--acad-gold-soft))]"><FileText className="h-4 w-4" /> Vorlage</p>
            <h2 className="font-display mt-1 text-2xl">{lesson.vorlage_title}</h2>
            <RichText text={lesson.vorlage_body} className="mt-4 text-[15px]" />
          </section>
        )}

        <div className="acad-panel mt-10 flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="font-medium">Abfrage zu diesem Thema</p>
            <p className="mt-0.5 text-sm text-[hsl(36_9%_72%)]">
              {ls.quiz_total} Fragen · sofort mit Begründung · bestanden ab 80 % · beliebig oft
            </p>
            {ls.quiz_done && <p className="mt-1 flex items-center gap-1 text-sm text-[hsl(152_48%_66%)]"><Check className="h-4 w-4" /> Bestanden mit {ls.quiz_best_score} von {ls.quiz_total}</p>}
          </div>
          <Link to={`/thema/${lesson.id}/abfrage`} className="btn-gold inline-flex items-center gap-1 px-5 py-2.5 text-sm">
            {ls.quiz_done ? 'Nochmal üben' : 'Zur Abfrage'} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </article>
    </AcademyLayout>
  );
}
