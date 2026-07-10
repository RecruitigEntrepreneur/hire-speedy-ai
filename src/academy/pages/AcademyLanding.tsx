import { Link } from 'react-router-dom';
import {
  GraduationCap, Award, Users, Rocket, ArrowRight, Lock, BookOpen, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AcademyLayout } from '../components/AcademyLayout';
import { useAcademyCourses, type AcademyCourse } from '../lib/useAcademy';

const LEVEL_LABEL: Record<AcademyCourse['level'], string> = {
  beginner: 'Einsteiger',
  intermediate: 'Fortgeschritten',
  advanced: 'Profi',
};

const PILLARS = [
  { icon: BookOpen, title: 'Kurse & Lektionen', text: 'Strukturierte Module von Sourcing bis Closing — in deinem Tempo.' },
  { icon: Award, title: 'Prüfung & Zertifikat', text: 'Weise dein Können nach und erhalte ein anerkanntes Abschlusszertifikat.' },
  { icon: Users, title: 'Community & Coaching', text: 'Lerne mit anderen Headhuntern und erhalte Feedback von Profis.' },
  { icon: Rocket, title: 'Praxis bei Matchunt', text: 'Bewirb dich nach dem Abschluss als Recruiter und arbeite an echten Mandaten.' },
];

function CourseCard({ course }: { course: AcademyCourse }) {
  return (
    <Card className="glass-card flex flex-col transition-all hover:shadow-md">
      <CardHeader>
        <div className="mb-2 flex items-center justify-between">
          <span className="status-badge bg-secondary text-secondary-foreground">{LEVEL_LABEL[course.level]}</span>
          {course.is_premium ? (
            <span className="status-badge bg-warning/10 text-warning inline-flex items-center gap-1">
              <Lock className="h-3 w-3" /> Premium
            </span>
          ) : (
            <span className="status-badge status-published">Kostenlos</span>
          )}
        </div>
        <CardTitle className="text-lg">{course.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <p className="flex-1 text-sm text-muted-foreground">{course.description}</p>
        <Button asChild variant="ghost" className="mt-4 justify-start px-0 text-sm">
          <Link to={`/kurs/${course.slug}`}>
            Zum Kurs <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function AcademyLanding() {
  const { data: courses, isLoading } = useAcademyCourses();

  return (
    <AcademyLayout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="mx-auto max-w-4xl px-4 py-24 text-center sm:py-32">
          <div className="animate-fade-in mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-navy shadow-glow">
            <GraduationCap className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="animate-slide-up text-4xl font-bold tracking-tight sm:text-5xl">
            Werde zum <span className="gradient-text">Top-Headhunter</span>
          </h1>
          <p className="animate-slide-up mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Die Matchunt Akademie bildet dich zur modernen Personalberatung aus — und öffnet dir
            danach die Tür, als Recruiter an echten Mandaten zu verdienen.
          </p>
          <div className="animate-slide-up mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" variant="hero">
              <Link to="/dashboard">Kostenlos starten <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#kurse">Kurse ansehen</a>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Freemium — Basisinhalte gratis, kein Risiko.</p>
        </div>
      </section>

      {/* Säulen */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p) => (
            <div key={p.title} className="stat-card">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <p.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">{p.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Kurskatalog */}
      <section id="kurse" className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Kurskatalog</h2>
          <p className="mt-2 text-muted-foreground">Starte mit den Grundlagen oder vertiefe dich als Profi.</p>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : courses && courses.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => <CourseCard key={c.id} course={c} />)}
          </div>
        ) : (
          <p className="text-center text-muted-foreground">Bald verfügbar.</p>
        )}
      </section>

      {/* Abschluss-CTA */}
      <section className="mx-auto max-w-4xl px-4 pb-8">
        <div className="glass-card rounded-2xl px-8 py-12 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Vom Lernen zum Verdienen</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Nach Abschluss und Zertifikat kannst du dich als Recruiter bei Matchunt bewerben —
            und dein Wissen direkt in Platzierungen umsetzen.
          </p>
          <Button asChild size="lg" variant="hero" className="mt-6">
            <Link to="/dashboard">Jetzt Mitglied werden</Link>
          </Button>
        </div>
      </section>
    </AcademyLayout>
  );
}
