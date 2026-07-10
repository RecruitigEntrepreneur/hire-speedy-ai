// localStorage-Fortschritt für den DEMO-MODUS (kein Backend).
// Persistiert Einschreibungen und abgeschlossene Lektionen pro Browser.
import type { AcademyEnrollment, LessonStatus } from './useAcademy';
import { getDemoLessonIds } from './demoContent';

const KEY = 'matchunt-academy-demo-v1';

interface Store {
  enrolled: Record<string, { started_at: string; completed_at: string | null }>;
  completed: Record<string, true>; // lessonId -> true
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch { /* ignore */ }
  return { enrolled: {}, completed: {} };
}
function save(s: Store) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

/** Stabile anonyme Demo-Nutzer-ID (ohne Login testbar). */
export function localAnonId(): string {
  const k = 'matchunt-academy-demo-uid';
  let id = '';
  try { id = localStorage.getItem(k) ?? ''; } catch { /* ignore */ }
  if (!id) {
    id = 'demo-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { localStorage.setItem(k, id); } catch { /* ignore */ }
  }
  return id;
}

function pctFor(courseId: string, s: Store): number {
  const ids = getDemoLessonIds(courseId);
  if (!ids.length) return 0;
  const done = ids.filter((id) => s.completed[id]).length;
  return Math.round((done / ids.length) * 100);
}

export const localProgress = {
  enroll(courseId: string) {
    const s = load();
    if (!s.enrolled[courseId]) { s.enrolled[courseId] = { started_at: new Date().toISOString(), completed_at: null }; save(s); }
  },

  completeLesson(courseId: string, lessonId: string) {
    const s = load();
    s.completed[lessonId] = true;
    if (!s.enrolled[courseId]) s.enrolled[courseId] = { started_at: new Date().toISOString(), completed_at: null };
    if (pctFor(courseId, s) >= 100) s.enrolled[courseId].completed_at = new Date().toISOString();
    save(s);
  },

  progressMap(lessonIds: string[]): Record<string, LessonStatus> {
    const s = load();
    const map: Record<string, LessonStatus> = {};
    lessonIds.forEach((id) => { if (s.completed[id]) map[id] = 'completed'; });
    return map;
  },

  enrollment(userId: string, courseId: string): AcademyEnrollment | null {
    const s = load();
    const e = s.enrolled[courseId];
    if (!e) return null;
    const pct = pctFor(courseId, s);
    return {
      id: 'demo-enr-' + courseId, user_id: userId, course_id: courseId,
      status: pct >= 100 ? 'completed' : 'active', progress_pct: pct,
      started_at: e.started_at, completed_at: e.completed_at,
    };
  },

  enrollments(userId: string): AcademyEnrollment[] {
    const s = load();
    return Object.keys(s.enrolled)
      .map((courseId) => localProgress.enrollment(userId, courseId))
      .filter((e): e is AcademyEnrollment => e !== null);
  },
};
