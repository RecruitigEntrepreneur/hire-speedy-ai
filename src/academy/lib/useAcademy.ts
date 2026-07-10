import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { DEMO_COURSES, getDemoCourseContent, getDemoCourseById } from './demoContent';
import { localProgress, localAnonId } from './localProgress';

// Die generierten Supabase-Typen (integrations/supabase/types.ts) kennen die
// neuen academy_*-Tabellen noch nicht. Bis types.ts neu generiert ist, casten
// wir den Client lokal und definieren die Akademie-Typen hier von Hand.
const db = supabase as unknown as {
  from: (table: string) => any;
};

// DEMO-MODUS: Solange die academy_*-Tabellen in der DB fehlen, läuft die
// Akademie mit gebündelten Inhalten + localStorage-Fortschritt. Sobald die
// Migration angewandt ist, schaltet diese Probe automatisch auf die echte DB um.
let _dbAvailable: Promise<boolean> | null = null;
export function academyDbAvailable(): Promise<boolean> {
  if (!_dbAvailable) {
    _dbAvailable = (async () => {
      try {
        const { error } = await db.from('academy_courses').select('id').limit(1);
        return !error;
      } catch { return false; }
    })();
  }
  return _dbAvailable;
}

/** Echte Nutzer-ID falls eingeloggt, sonst stabile anonyme Demo-ID. */
function effectiveUid(userId?: string | null): string {
  return userId ?? localAnonId();
}

export type AcademyLevel = 'beginner' | 'intermediate' | 'advanced';

export interface AcademyProfile {
  id: string;
  user_id: string;
  display_name: string;
  experience_years: number | null;
  specialization: string | null;
  plan: 'free' | 'premium';
  created_at: string;
}

export interface AcademyCourse {
  id: string;
  slug: string;
  title: string;
  description: string;
  level: AcademyLevel;
  is_premium: boolean;
  published: boolean;
  cover_image_url: string | null;
  sort_order: number;
}

export interface AcademyEnrollment {
  id: string;
  user_id: string;
  course_id: string;
  status: 'active' | 'completed' | 'paused';
  progress_pct: number;
  started_at: string;
  completed_at: string | null;
}

/** Akademie-Registrierung — vergibt KEINE Plattform-Rolle (account_type=academy). */
export async function academySignUp(email: string, password: string, fullName: string) {
  const redirectUrl = `${window.location.origin}/dashboard`;
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectUrl,
      data: { full_name: fullName, account_type: 'academy' },
    },
  });
  return { error: error as Error | null };
}

export async function academySignIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error as Error | null };
}

/** Veröffentlichte Kurse (öffentlich lesbar, auch ohne Login). */
export function useAcademyCourses() {
  return useQuery({
    queryKey: ['academy', 'courses'],
    queryFn: async (): Promise<AcademyCourse[]> => {
      if (await academyDbAvailable()) {
        const { data, error } = await db
          .from('academy_courses').select('*').eq('published', true)
          .order('sort_order', { ascending: true });
        if (!error && data && data.length) return data as AcademyCourse[];
      }
      // Demo-Fallback
      return DEMO_COURSES.filter((c) => c.published).sort((a, b) => a.sort_order - b.sort_order);
    },
  });
}

/** Akademie-Profil des Nutzers (Demo-Profil, wenn DB/Login fehlt). */
export function useAcademyProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['academy', 'profile', user?.id ?? 'demo'],
    queryFn: async (): Promise<AcademyProfile | null> => {
      if (user?.id && await academyDbAvailable()) {
        const { data, error } = await db
          .from('academy_profiles').select('*').eq('user_id', user.id).maybeSingle();
        if (!error && data) return data as AcademyProfile;
      }
      return {
        id: 'demo-profile', user_id: effectiveUid(user?.id),
        display_name: (user?.email ?? '').split('@')[0] || 'Gast',
        experience_years: null, specialization: null, plan: 'free',
        created_at: new Date().toISOString(),
      };
    },
  });
}

/** Eigene Kurs-Einschreibungen. */
export function useAcademyEnrollments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['academy', 'enrollments', user?.id ?? 'demo'],
    queryFn: async (): Promise<AcademyEnrollment[]> => {
      if (user?.id && await academyDbAvailable()) {
        const { data, error } = await db
          .from('academy_enrollments').select('*').eq('user_id', user.id);
        if (!error && data) return data as AcademyEnrollment[];
      }
      return localProgress.enrollments(effectiveUid(user?.id));
    },
  });
}

/** Schreibt den Nutzer in einen Kurs ein (idempotent; Demo -> localStorage). */
export async function academyEnroll(userId: string, courseId: string) {
  if (userId && await academyDbAvailable()) {
    const { error } = await db.from('academy_enrollments').upsert(
      { user_id: userId, course_id: courseId, status: 'active', progress_pct: 0 },
      { onConflict: 'user_id,course_id' },
    );
    if (!error) return { error: null };
  }
  localProgress.enroll(courseId);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Phase 1 — Kursinhalt, Lektion-Player & Fortschritts-Engine
// ---------------------------------------------------------------------------

export interface AcademyModule {
  id: string;
  course_id: string;
  title: string;
  sort_order: number;
}

export interface AcademyLesson {
  id: string;
  module_id: string;
  title: string;
  content_type: 'video' | 'text' | 'quiz';
  body: string;
  video_url: string | null;
  duration_min: number | null;
  is_premium: boolean;
  sort_order: number;
}

export type LessonStatus = 'not_started' | 'in_progress' | 'completed';

export interface AcademyModuleWithLessons extends AcademyModule {
  lessons: AcademyLesson[];
}

export interface AcademyCourseContent {
  course: AcademyCourse;
  modules: AcademyModuleWithLessons[];
  lessons: AcademyLesson[]; // flach, in Reihenfolge (Modul -> Lektion)
  progress: Record<string, LessonStatus>;
  enrollment: AcademyEnrollment | null;
}

/** Kurs inkl. Modulen, Lektionen (geordnet) und eigenem Fortschritt. */
export function useAcademyCourse(slug: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['academy', 'course', slug, user?.id ?? 'demo'],
    enabled: !!slug,
    queryFn: async (): Promise<AcademyCourseContent | null> => {
      if (user?.id && await academyDbAvailable()) {
        const { data: course } = await db
          .from('academy_courses').select('*').eq('slug', slug).maybeSingle();
        if (course) {
          const { data: modules } = await db
            .from('academy_modules').select('*').eq('course_id', course.id)
            .order('sort_order', { ascending: true });
          const moduleIds = (modules ?? []).map((m: AcademyModule) => m.id);
          const lessonsRes = moduleIds.length
            ? await db.from('academy_lessons').select('*').in('module_id', moduleIds)
                .order('sort_order', { ascending: true })
            : { data: [] };
          const lessons = (lessonsRes.data ?? []) as AcademyLesson[];
          const lessonIds = lessons.map((l) => l.id);
          let progress: Record<string, LessonStatus> = {};
          if (lessonIds.length) {
            const { data: prog } = await db.from('academy_lesson_progress')
              .select('lesson_id,status').eq('user_id', user.id).in('lesson_id', lessonIds);
            progress = Object.fromEntries(
              (prog ?? []).map((p: { lesson_id: string; status: LessonStatus }) => [p.lesson_id, p.status]),
            );
          }
          const { data: enr } = await db.from('academy_enrollments')
            .select('*').eq('user_id', user.id).eq('course_id', course.id).maybeSingle();
          const modulesWithLessons: AcademyModuleWithLessons[] = (modules ?? []).map((m: AcademyModule) => ({
            ...m, lessons: lessons.filter((l) => l.module_id === m.id),
          }));
          const flat = modulesWithLessons.flatMap((m) => m.lessons);
          return { course: course as AcademyCourse, modules: modulesWithLessons, lessons: flat, progress, enrollment: (enr ?? null) as AcademyEnrollment | null };
        }
      }
      // Demo-Fallback (gebündelter Inhalt + localStorage-Fortschritt)
      const demo = getDemoCourseContent(slug);
      if (!demo) return null;
      const uid = effectiveUid(user?.id);
      return {
        course: demo.course, modules: demo.modules, lessons: demo.lessons,
        progress: localProgress.progressMap(demo.lessons.map((l) => l.id)),
        enrollment: localProgress.enrollment(uid, demo.course.id),
      };
    },
  });
}

/** Markiert eine Lektion als abgeschlossen und rechnet den Kursfortschritt neu (Demo -> localStorage). */
export async function completeLesson(userId: string, courseId: string, lessonId: string) {
  if (userId && await academyDbAvailable()) {
    const { error: pErr } = await db.from('academy_lesson_progress').upsert(
      { user_id: userId, lesson_id: lessonId, status: 'completed', completed_at: new Date().toISOString() },
      { onConflict: 'user_id,lesson_id' },
    );
    if (!pErr) { await recomputeCourseProgress(userId, courseId); return { error: null }; }
  }
  localProgress.completeLesson(courseId, lessonId);
  return { error: null };
}

/** enrollment.progress_pct = abgeschlossene / gesamte Lektionen des Kurses (auto-enroll). */
export async function recomputeCourseProgress(userId: string, courseId: string) {
  const { data: modules } = await db.from('academy_modules').select('id').eq('course_id', courseId);
  const moduleIds = (modules ?? []).map((m: { id: string }) => m.id);
  if (!moduleIds.length) return;
  const { data: lessons } = await db.from('academy_lessons').select('id').in('module_id', moduleIds);
  const lessonIds = (lessons ?? []).map((l: { id: string }) => l.id);
  const total = lessonIds.length;
  if (!total) return;
  const { data: done } = await db.from('academy_lesson_progress')
    .select('lesson_id').eq('user_id', userId).eq('status', 'completed').in('lesson_id', lessonIds);
  const completed = (done ?? []).length;
  const pct = Math.round((completed / total) * 100);
  await db.from('academy_enrollments').upsert(
    {
      user_id: userId,
      course_id: courseId,
      status: pct >= 100 ? 'completed' : 'active',
      progress_pct: pct,
      completed_at: pct >= 100 ? new Date().toISOString() : null,
    },
    { onConflict: 'user_id,course_id' },
  );
}
