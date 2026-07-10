import { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, Lock, Loader2, PlayCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AcademyLayout } from '../components/AcademyLayout';
import { useAcademyCourse, useAcademyProfile, type AcademyLesson } from '../lib/useAcademy';

const LEVEL_LABEL: Record<string, string> = { beginner: 'Einsteiger', intermediate: 'Fortgeschritten', advanced: 'Profi' };

export default function AcademyCourseDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useAcademyCourse(slug);
  const { data: profile } = useAcademyProfile();
  const isPremiumMember = profile?.plan === 'premium';

  const firstOpenLesson = useMemo<AcademyLesson | undefined>(() => {
    if (!data) return undefined;
    return data.lessons.find((l) => data.progress[l.id] !== 'completed') ?? data.lessons[0];
  }, [data]);

  const locked = (l: AcademyLesson) => l.is_premium && !isPremiumMember;

  if (isLoading) {
    return <AcademyLayout><div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></AcademyLayout>;
  }
  if (!data) {
    return (
      <AcademyLayout>
        <div className="mx-auto max-w-3xl px-4 py-24 text-center">
          <p className="text-muted-foreground">Kurs nicht gefunden.</p>
          <Button asChild variant="outline" className="mt-4"><Link to="/dashboard">Zum Lernbereich</Link></Button>
        </div>
      </AcademyLayout>
    );
  }

  const { course, modules, enrollment } = data;
  const pct = enrollment?.progress_pct ?? 0;

  return (
    <AcademyLayout>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Link to="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Lernbereich
        </Link>

        {/* Kopf */}
        <div className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="status-badge bg-secondary text-secondary-foreground">{LEVEL_LABEL[course.level] ?? course.level}</span>
            {course.is_premium && <span className="status-badge bg-warning/10 text-warning inline-flex items-center gap-1"><Lock className="h-3 w-3" /> Premium</span>}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{course.title}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">{course.description}</p>

          {enrollment && (
            <div className="mt-5 max-w-md">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>Dein Fortschritt</span><span>{pct}%</span>
              </div>
              <Progress value={pct} />
            </div>
          )}

          {firstOpenLesson && !locked(firstOpenLesson) && (
            <Button
              variant="hero"
              className="mt-6"
              onClick={() => navigate(`/kurs/${course.slug}/lektion/${firstOpenLesson.id}`)}
            >
              <PlayCircle className="mr-1 h-4 w-4" />
              {pct > 0 ? 'Weiterlernen' : 'Kurs starten'}
            </Button>
          )}
        </div>

        {/* Module & Lektionen */}
        <div className="space-y-6">
          {modules.map((m, mi) => (
            <Card key={m.id} className="glass-card">
              <CardContent className="p-0">
                <div className="border-b border-border/50 px-5 py-3">
                  <h2 className="font-semibold">{mi + 1}. {m.title}</h2>
                </div>
                <ul className="divide-y divide-border/40">
                  {m.lessons.map((l) => {
                    const done = data.progress[l.id] === 'completed';
                    const isLocked = locked(l);
                    return (
                      <li key={l.id}>
                        <button
                          disabled={isLocked}
                          onClick={() => navigate(`/kurs/${course.slug}/lektion/${l.id}`)}
                          className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-secondary/40 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isLocked ? <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                            : done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                            : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}
                          <span className="flex-1 text-sm">{l.title}</span>
                          {l.duration_min ? (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />{l.duration_min} Min
                            </span>
                          ) : null}
                          {l.is_premium && <span className="status-badge bg-warning/10 text-warning">Premium</span>}
                        </button>
                      </li>
                    );
                  })}
                  {m.lessons.length === 0 && <li className="px-5 py-3 text-sm text-muted-foreground">Lektionen folgen.</li>}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AcademyLayout>
  );
}
