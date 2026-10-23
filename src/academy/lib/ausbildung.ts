// Ausbildung mit Modulen, Themen, Abfragen und Modul-Tests.
// Alle Auswertungen laufen serverseitig (Migration 20261022120000_academy_ausbildung.sql);
// die Oberfläche bekommt Fragen nie zusammen mit ihrer Lösung.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

// Die generierten Supabase-Typen kennen die academy_*-Tabellen und -Funktionen noch nicht.
const db = supabase as unknown as {
  from: (table: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }>; // eslint-disable-line @typescript-eslint/no-explicit-any
};

export const AUSBILDUNG_SLUG = 'ausbildung';

export type QuestionType = 'single' | 'multi' | 'order' | 'match';
export interface Option { id: string; text: string }
export interface MatchOptions { left: Option[]; right: Option[] }

export interface PublicQuestion {
  id: string;
  type: QuestionType;
  case_text: string | null;
  prompt: string;
  options: Option[] | MatchOptions;
}

/** single: "b" · multi: ["a","c"] · order: ["a","b","c"] · match: {"l1":"r2"} */
export type Answer = string | string[] | Record<string, string>;

export interface LessonState {
  id: string;
  title: string;
  learning_goal: string;
  duration_min: number | null;
  sort_order: number;
  learned: boolean;
  quiz_done: boolean;
  quiz_best_score: number | null;
  quiz_total: number;
  question_count: number;
}

export interface ModuleState {
  id: string;
  title: string;
  description: string;
  sort_order: number;
  test_question_count: number;
  test_pass_pct: number;
  test_retry_minutes: number;
  unlocked: boolean;
  passed: boolean;
  best_score: number | null;
  best_total: number | null;
  test_attempts: number;
  retry_at: string | null;
  last_passed: boolean | null;
  open_test_attempt: string | null;
  lessons: LessonState[];
}

export interface CourseState {
  course: { id: string; slug: string; title: string; description: string };
  modules: ModuleState[];
  modules_total: number;
  modules_passed: number;
}

export interface StartedAttempt {
  attempt_id: string;
  kind: 'topic' | 'module';
  total: number;
  answers: Record<string, Answer>;
  questions: PublicQuestion[];
}

export interface TopicFeedback {
  correct: boolean;
  correct_answer: Answer;
  explanation: string;
  answered: number;
  total: number;
  finished: boolean;
  score: number | null;
  passed: boolean | null;
}

export interface ReviewItem {
  question_id: string;
  type: QuestionType;
  case_text: string | null;
  prompt: string;
  options: Option[] | MatchOptions;
  your_answer: Answer | null;
  correct_answer: Answer;
  correct: boolean;
  explanation: string;
}

export interface AttemptResult {
  attempt_id: string;
  kind: 'topic' | 'module';
  score: number;
  total: number;
  pass_pct: number;
  passed: boolean;
  module_id: string;
  next_module_id: string | null;
  next_module_unlocked: boolean | null;
  retry_at: string | null;
  by_lesson: { lesson_id: string; title: string; sort_order: number; total: number; wrong: number }[];
  review: ReviewItem[];
}

export interface LessonContent {
  id: string;
  module_id: string;
  title: string;
  body: string;
  video_url: string | null;
  duration_min: number | null;
  sort_order: number;
  learning_goal: string;
  vorlage_title: string | null;
  vorlage_body: string | null;
}

/** Fehlermeldungen aus den Datenbankfunktionen sind schon deutsch und für Menschen geschrieben. */
function unwrap<T>(res: { data: any; error: { message: string } | null }): T { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export function useCourseState(slug = AUSBILDUNG_SLUG) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['academy', 'state', slug, user?.id],
    enabled: !!user,
    queryFn: async () => unwrap<CourseState | null>(await db.rpc('academy_course_state', { p_slug: slug })),
  });
}

export function useLessonContent(lessonId: string | undefined) {
  return useQuery({
    queryKey: ['academy', 'lesson', lessonId],
    enabled: !!lessonId,
    queryFn: async (): Promise<LessonContent | null> => {
      const { data, error } = await db.from('academy_lessons')
        .select('id,module_id,title,body,video_url,duration_min,sort_order,learning_goal,vorlage_title,vorlage_body')
        .eq('id', lessonId).maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as LessonContent | null;
    },
  });
}

export async function startAttempt(kind: 'topic' | 'module', ref: string) {
  return unwrap<StartedAttempt>(await db.rpc('academy_start_attempt', { p_kind: kind, p_ref: ref }));
}

export async function answerTopic(attemptId: string, questionId: string, answer: Answer) {
  return unwrap<TopicFeedback>(await db.rpc('academy_answer', { p_attempt: attemptId, p_question: questionId, p_answer: answer }));
}

export async function saveTestAnswer(attemptId: string, questionId: string, answer: Answer) {
  return unwrap<{ saved: boolean; answered: number; total: number }>(
    await db.rpc('academy_answer', { p_attempt: attemptId, p_question: questionId, p_answer: answer }),
  );
}

export async function finishAttempt(attemptId: string) {
  return unwrap<AttemptResult>(await db.rpc('academy_finish_attempt', { p_attempt: attemptId }));
}

/** Findet Modul und Thema im Kursstand (für Navigation und Sperren). */
export function locate(state: CourseState | null | undefined, lessonId?: string, moduleId?: string) {
  if (!state) return { module: undefined, lesson: undefined, index: -1 };
  const index = state.modules.findIndex((m) =>
    (moduleId && m.id === moduleId) || (lessonId && m.lessons.some((l) => l.id === lessonId)));
  const module = index >= 0 ? state.modules[index] : undefined;
  const lesson = lessonId ? module?.lessons.find((l) => l.id === lessonId) : undefined;
  return { module, lesson, index };
}

/** Der nächste sinnvolle Schritt in der Ausbildung. */
export function nextStep(state: CourseState | null | undefined):
  | { kind: 'lesson'; module: ModuleState; lesson: LessonState }
  | { kind: 'test'; module: ModuleState }
  | { kind: 'done' }
  | null {
  if (!state) return null;
  const module = state.modules.find((m) => m.unlocked && !m.passed);
  if (!module) return state.modules.length && state.modules.every((m) => m.passed) ? { kind: 'done' } : null;
  const lesson = module.lessons.find((l) => !l.quiz_done);
  if (lesson) return { kind: 'lesson', module, lesson };
  return { kind: 'test', module };
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' Uhr';
}
