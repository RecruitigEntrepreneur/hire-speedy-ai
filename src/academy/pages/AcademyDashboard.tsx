import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Award, BookOpen, Check, Loader2, Lock, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/lib/auth';
import { AcademyLayout } from '../components/AcademyLayout';
import {
  useAcademyCourses, useAcademyEnrollments, useAcademyProfile, academyEnroll,
  type AcademyCourse,
} from '../lib/useAcademy';

export default function AcademyDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useAcademyProfile();
  const { data: courses, isLoading: coursesLoading } = useAcademyCourses();
  const { data: enrollments, isLoading: enrollLoading } = useAcademyEnrollments();
  const [enrolling, setEnrolling] = useState<string | null>(null);

  const enrolledIds = useMemo(
    () => new Set((enrollments ?? []).map((e) => e.course_id)),
    [enrollments],
  );
  const myCourses = useMemo(
    () => (courses ?? []).filter((c) => enrolledIds.has(c.id)),
    [courses, enrolledIds],
  );
  const otherCourses = useMemo(
    () => (courses ?? []).filter((c) => !enrolledIds.has(c.id)),
    [courses, enrolledIds],
  );

  const handleEnroll = async (course: AcademyCourse) => {
    setEnrolling(course.id);
    const { error } = await academyEnroll(user?.id ?? '', course.id);
    setEnrolling(null);
    if (error) {
      toast.error('Einschreibung fehlgeschlagen: ' + error.message);
      return;
    }
    toast.success(`Eingeschrieben in „${course.title}".`);
    queryClient.invalidateQueries({ queryKey: ['academy', 'enrollments'] });
    navigate(`/kurs/${course.slug}`);
  };

  const firstName = (profile?.display_name || user?.email || '').split(' ')[0];
  const loading = coursesLoading || enrollLoading;

  return (
    <AcademyLayout>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Willkommen{firstName ? `, ${firstName}` : ''} 👋
          </h1>
          <p className="mt-1 text-muted-foreground">Dein Lernbereich in der Matchunt Akademie.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-12">
            {/* Meine Kurse */}
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
                <BookOpen className="h-5 w-5" /> Meine Kurse
              </h2>
              {myCourses.length === 0 ? (
                <Card className="glass-card">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Du bist noch in keinen Kurs eingeschrieben — leg unten los.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {myCourses.map((c) => {
                    const enr = (enrollments ?? []).find((e) => e.course_id === c.id);
                    return (
                      <Card key={c.id} className="glass-card flex flex-col">
                        <CardHeader>
                          <CardTitle className="text-lg">{c.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-1 flex-col">
                          <div className="mb-3">
                            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                              <span>Fortschritt</span><span>{enr?.progress_pct ?? 0}%</span>
                            </div>
                            <Progress value={enr?.progress_pct ?? 0} />
                          </div>
                          <Button asChild variant="hero" className="mt-auto">
                            <Link to={`/kurs/${c.slug}`}>
                              {(enr?.progress_pct ?? 0) > 0 ? 'Weiterlernen' : 'Kurs starten'}
                            </Link>
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Weitere Kurse */}
            {otherCourses.length > 0 && (
              <section>
                <h2 className="mb-4 text-xl font-semibold">Weitere Kurse</h2>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {otherCourses.map((c) => (
                    <Card key={c.id} className="glass-card flex flex-col">
                      <CardHeader>
                        <div className="mb-2">
                          {c.is_premium ? (
                            <span className="status-badge bg-warning/10 text-warning inline-flex items-center gap-1">
                              <Lock className="h-3 w-3" /> Premium
                            </span>
                          ) : (
                            <span className="status-badge status-published">Kostenlos</span>
                          )}
                        </div>
                        <CardTitle className="text-lg">{c.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-1 flex-col">
                        <p className="flex-1 text-sm text-muted-foreground">{c.description}</p>
                        <Button
                          variant="outline"
                          className="mt-4"
                          disabled={enrolling === c.id}
                          onClick={() => handleEnroll(c)}
                        >
                          {enrolling === c.id
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <><Check className="mr-1 h-4 w-4" /> Einschreiben</>}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Andocken-Teaser (Phase 5) */}
            <section>
              <div className="glass-card flex flex-col items-start gap-4 rounded-2xl p-8 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-navy">
                    <Rocket className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-semibold">
                      <Award className="h-4 w-4" /> Recruiter bei Matchunt werden
                    </h3>
                    <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                      Schließe deine Kurse ab und bewirb dich anschließend, um an echten Mandaten
                      zu arbeiten und zu verdienen. Die Bewerbung schalten wir in Kürze frei.
                    </p>
                  </div>
                </div>
                <Button variant="outline" disabled>Bald verfügbar</Button>
              </div>
            </section>
          </div>
        )}
      </div>
    </AcademyLayout>
  );
}
