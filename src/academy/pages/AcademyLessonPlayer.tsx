import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Lock, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { AcademyLayout } from '../components/AcademyLayout';
import { useAcademyCourse, useAcademyProfile, completeLesson } from '../lib/useAcademy';

export default function AcademyLessonPlayer() {
  const { slug, lessonId } = useParams<{ slug: string; lessonId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data, isLoading } = useAcademyCourse(slug);
  const { data: profile } = useAcademyProfile();
  const [saving, setSaving] = useState(false);

  const idx = useMemo(() => data?.lessons.findIndex((l) => l.id === lessonId) ?? -1, [data, lessonId]);
  const lesson = idx >= 0 ? data!.lessons[idx] : undefined;
  const prev = idx > 0 ? data!.lessons[idx - 1] : undefined;
  const next = data && idx >= 0 && idx < data.lessons.length - 1 ? data.lessons[idx + 1] : undefined;
  const isPremiumMember = profile?.plan === 'premium';
  const done = lesson ? data!.progress[lesson.id] === 'completed' : false;

  if (isLoading) {
    return <AcademyLayout><div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></AcademyLayout>;
  }
  if (!data || !lesson) {
    return (
      <AcademyLayout>
        <div className="mx-auto max-w-3xl px-4 py-24 text-center">
          <p className="text-muted-foreground">Lektion nicht gefunden.</p>
          <Button asChild variant="outline" className="mt-4"><Link to={`/kurs/${slug}`}>Zur Kursübersicht</Link></Button>
        </div>
      </AcademyLayout>
    );
  }

  const { course } = data;

  // Premium-Gating
  if (lesson.is_premium && !isPremiumMember) {
    return (
      <AcademyLayout>
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <div className="glass-card rounded-2xl p-10">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
              <Lock className="h-6 w-6 text-warning" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Premium-Lektion</h1>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">
              „{lesson.title}" ist Teil von Matchunt Premium. Schalte alle Module, Prüfungen und das
              Zertifikat frei.
            </p>
            <Button variant="hero" className="mt-6" disabled><Sparkles className="mr-1 h-4 w-4" /> Premium freischalten (bald)</Button>
            <div className="mt-4">
              <Button asChild variant="ghost" size="sm"><Link to={`/kurs/${course.slug}`}>Zurück zum Kurs</Link></Button>
            </div>
          </div>
        </div>
      </AcademyLayout>
    );
  }

  const handleComplete = async () => {
    setSaving(true);
    const { error } = await completeLesson(user?.id ?? '', course.id, lesson.id);
    setSaving(false);
    if (error) { toast.error('Konnte nicht gespeichert werden: ' + error.message); return; }
    queryClient.invalidateQueries({ queryKey: ['academy'] });
    if (next) {
      toast.success('Lektion abgeschlossen.');
      navigate(`/kurs/${course.slug}/lektion/${next.id}`);
    } else {
      toast.success('Kurs abgeschlossen — stark! 🎓');
      navigate(`/kurs/${course.slug}`);
    }
  };

  return (
    <AcademyLayout>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_280px]">
        {/* Inhalt */}
        <div className="min-w-0">
          <Link to={`/kurs/${course.slug}`} className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> {course.title}
          </Link>

          <h1 className="text-2xl font-bold tracking-tight">{lesson.title}</h1>
          <p className="mt-1 text-xs text-muted-foreground">Lektion {idx + 1} von {data.lessons.length}</p>

          {lesson.video_url ? (
            <div className="mt-6 aspect-video w-full overflow-hidden rounded-xl border border-border/50 bg-black">
              <iframe src={lesson.video_url} title={lesson.title} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          ) : null}

          <div className="prose-academy mt-6 space-y-4 text-[15px] leading-relaxed text-foreground/90">
            {lesson.body.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
            {!lesson.body && !lesson.video_url && <p className="text-muted-foreground">Inhalt folgt.</p>}
          </div>

          {/* Abschluss + Navigation */}
          <div className="mt-10 flex flex-col gap-3 border-t border-border/50 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={!prev} onClick={() => prev && navigate(`/kurs/${course.slug}/lektion/${prev.id}`)}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Zurück
              </Button>
              <Button variant="outline" size="sm" disabled={!next} onClick={() => next && navigate(`/kurs/${course.slug}/lektion/${next.id}`)}>
                Weiter <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
            <Button variant="hero" disabled={saving} onClick={handleComplete}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" />
                : done ? <><CheckCircle2 className="mr-1 h-4 w-4" /> {next ? 'Erledigt — nächste Lektion' : 'Erledigt — Kurs abschließen'}</>
                : <>{next ? 'Abschließen & weiter' : 'Abschließen'}</>}
            </Button>
          </div>
        </div>

        {/* Outline */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Kursinhalt</p>
            <Card className="glass-card">
              <CardContent className="p-2">
                <ul className="space-y-0.5">
                  {data.lessons.map((l, i) => {
                    const active = l.id === lesson.id;
                    const lDone = data.progress[l.id] === 'completed';
                    const lLocked = l.is_premium && !isPremiumMember;
                    return (
                      <li key={l.id}>
                        <button
                          disabled={lLocked}
                          onClick={() => navigate(`/kurs/${course.slug}/lektion/${l.id}`)}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors disabled:opacity-50 ${active ? 'bg-secondary font-medium' : 'hover:bg-secondary/50'}`}
                        >
                          {lLocked ? <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            : lDone ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                            : <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                          <span className="line-clamp-2 flex-1">{i + 1}. {l.title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          </div>
        </aside>
      </div>
    </AcademyLayout>
  );
}
