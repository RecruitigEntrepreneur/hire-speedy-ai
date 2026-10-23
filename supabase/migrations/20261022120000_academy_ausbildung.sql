-- ============================================================================
-- Matchunt Akademie — Ausbildung mit Modulen, Themen, Abfragen und Modul-Tests
-- ----------------------------------------------------------------------------
-- Setzt 20260616130000_academy_foundation.sql voraus (academy_* Grundtabellen).
--
-- Aufbau: Kurs „Ausbildung“ → Module → Themen (academy_lessons) → Fragenpool.
--   * Nach jedem Thema eine Abfrage (Zufallsauswahl aus dem Pool, sofortige
--     Rückmeldung mit Begründung, beliebig oft).
--   * Am Ende jedes Moduls ein Modul-Test (Zufallsauswahl aus allen Themen des
--     Moduls, Bestehensgrenze je Modul, Wartezeit nach Nichtbestehen).
--   * Das nächste Modul öffnet erst nach bestandenem Modul-Test.
--
-- Sicherheit:
--   * Lösungen liegen in academy_question_keys und sind für Lernende nie lesbar.
--   * Auswertung ausschließlich serverseitig in SECURITY-DEFINER-Funktionen.
--   * Feste Fragen, keine KI-Bewertung (AI Act Anhang III Nr. 3 b).
--   * Die Akademie bleibt vom Plattform-Dashboard getrennt: nichts hier vergibt
--     eine Plattform-Rolle oder schreibt in Plattform-Tabellen.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Erweiterungen bestehender Tabellen
-- ----------------------------------------------------------------------------
ALTER TABLE public.academy_modules
  ADD COLUMN IF NOT EXISTS description         TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS test_question_count INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS test_pass_pct       INTEGER NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS test_retry_minutes  INTEGER NOT NULL DEFAULT 120;

ALTER TABLE public.academy_modules
  ADD CONSTRAINT academy_modules_test_question_count_chk CHECK (test_question_count BETWEEN 1 AND 50),
  ADD CONSTRAINT academy_modules_test_pass_pct_chk       CHECK (test_pass_pct BETWEEN 1 AND 100),
  ADD CONSTRAINT academy_modules_test_retry_minutes_chk  CHECK (test_retry_minutes BETWEEN 0 AND 10080);

ALTER TABLE public.academy_lessons
  ADD COLUMN IF NOT EXISTS learning_goal       TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS vorlage_title       TEXT,
  ADD COLUMN IF NOT EXISTS vorlage_body        TEXT,
  ADD COLUMN IF NOT EXISTS quiz_question_count INTEGER NOT NULL DEFAULT 5;

ALTER TABLE public.academy_lessons
  ADD CONSTRAINT academy_lessons_quiz_question_count_chk CHECK (quiz_question_count BETWEEN 1 AND 20);

-- ----------------------------------------------------------------------------
-- 2) Fragenpool (ohne Lösung) und Lösungen (getrennt)
-- ----------------------------------------------------------------------------
-- options je Typ:
--   single / multi / order: [{"id":"a","text":"…"}, …]   (order: in richtiger Reihenfolge gespeichert)
--   match:                  {"left":[{"id":"l1","text":"…"}], "right":[{"id":"r1","text":"…"}]}
CREATE TABLE public.academy_questions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id   UUID NOT NULL REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('single', 'multi', 'order', 'match')),
  case_text   TEXT,
  prompt      TEXT NOT NULL,
  options     JSONB NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- correct je Typ:
--   single: "b"   multi: ["a","c"]   order: ["a","b","c"]   match: {"l1":"r2","l2":"r1"}
CREATE TABLE public.academy_question_keys (
  question_id UUID PRIMARY KEY REFERENCES public.academy_questions(id) ON DELETE CASCADE,
  correct     JSONB NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3) Versuche (Abfrage nach Thema = topic, Modul-Test = module)
-- ----------------------------------------------------------------------------
CREATE TABLE public.academy_quiz_attempts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('topic', 'module')),
  lesson_id    UUID REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
  module_id    UUID REFERENCES public.academy_modules(id) ON DELETE CASCADE,
  question_ids UUID[] NOT NULL,
  answers      JSONB NOT NULL DEFAULT '{}'::jsonb,
  results      JSONB NOT NULL DEFAULT '{}'::jsonb,
  total        INTEGER NOT NULL,
  pass_pct     INTEGER NOT NULL,
  score        INTEGER,
  passed       BOOLEAN,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at  TIMESTAMPTZ,
  CONSTRAINT academy_quiz_attempts_ref_chk CHECK (
    (kind = 'topic'  AND lesson_id IS NOT NULL AND module_id IS NOT NULL) OR
    (kind = 'module' AND lesson_id IS NULL     AND module_id IS NOT NULL)
  )
);

CREATE INDEX idx_academy_questions_lesson       ON public.academy_questions(lesson_id);
CREATE INDEX idx_academy_attempts_user_module   ON public.academy_quiz_attempts(user_id, module_id);
CREATE INDEX idx_academy_attempts_user_lesson   ON public.academy_quiz_attempts(user_id, lesson_id);

CREATE TRIGGER trg_academy_questions_updated_at BEFORE UPDATE ON public.academy_questions     FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_academy_keys_updated_at      BEFORE UPDATE ON public.academy_question_keys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.academy_questions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_question_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Fragen und Lösungen: nur Admin direkt. Lernende bekommen Fragen ausschließlich
-- über academy_start_attempt (ohne Lösung).
CREATE POLICY "academy_questions_admin_all" ON public.academy_questions
  FOR ALL USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));
CREATE POLICY "academy_question_keys_admin_all" ON public.academy_question_keys
  FOR ALL USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

-- Versuche: Lernende lesen nur eigene; geschrieben wird nur über die Funktionen.
CREATE POLICY "academy_attempts_select_own" ON public.academy_quiz_attempts
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "academy_attempts_admin_all" ON public.academy_quiz_attempts
  FOR ALL USING (has_role((select auth.uid()), 'admin'::app_role));

-- ============================================================================
-- 4) Hilfsfunktionen
-- ============================================================================

-- Ist die Antwort richtig? Rein, ohne Tabellenzugriff.
CREATE OR REPLACE FUNCTION public.academy__answer_correct(p_type TEXT, p_correct JSONB, p_answer JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_answer IS NULL OR p_correct IS NULL THEN RETURN false; END IF;
  IF p_type = 'single' THEN
    RETURN jsonb_typeof(p_answer) = 'string' AND p_answer = p_correct;
  ELSIF p_type = 'multi' THEN
    IF jsonb_typeof(p_answer) <> 'array' OR jsonb_typeof(p_correct) <> 'array' THEN RETURN false; END IF;
    RETURN (SELECT coalesce(array_agg(x ORDER BY x), '{}') FROM jsonb_array_elements_text(p_answer) x)
         = (SELECT coalesce(array_agg(x ORDER BY x), '{}') FROM jsonb_array_elements_text(p_correct) x);
  ELSIF p_type = 'order' THEN
    RETURN jsonb_typeof(p_answer) = 'array' AND p_answer = p_correct;
  ELSIF p_type = 'match' THEN
    RETURN jsonb_typeof(p_answer) = 'object' AND p_answer = p_correct;
  END IF;
  RETURN false;
END;
$$;

-- Hat der Nutzer den Modul-Test bestanden?
CREATE OR REPLACE FUNCTION public.academy__module_passed(p_user UUID, p_module UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.academy_quiz_attempts a
    WHERE a.user_id = p_user AND a.module_id = p_module AND a.kind = 'module' AND a.passed IS TRUE
  );
$$;

-- Ist das Modul für den Nutzer offen? Erstes Modul immer, sonst nach bestandenem Vormodul.
CREATE OR REPLACE FUNCTION public.academy__module_unlocked(p_user UUID, p_module UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course UUID; v_sort INT; v_prev UUID;
BEGIN
  SELECT m.course_id, m.sort_order INTO v_course, v_sort
  FROM public.academy_modules m JOIN public.academy_courses c ON c.id = m.course_id
  WHERE m.id = p_module AND c.published = true;
  IF v_course IS NULL THEN RETURN false; END IF;

  SELECT m.id INTO v_prev FROM public.academy_modules m
  WHERE m.course_id = v_course AND (m.sort_order < v_sort OR (m.sort_order = v_sort AND m.id < p_module))
  ORDER BY m.sort_order DESC, m.id DESC LIMIT 1;

  IF v_prev IS NULL THEN RETURN true; END IF;
  RETURN public.academy__module_passed(p_user, v_prev);
END;
$$;

-- Abfrage zu einem Thema mindestens einmal bestanden?
CREATE OR REPLACE FUNCTION public.academy__topic_done(p_user UUID, p_lesson UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.academy_quiz_attempts a
    WHERE a.user_id = p_user AND a.lesson_id = p_lesson AND a.kind = 'topic' AND a.passed IS TRUE
  );
$$;

-- Frage für Lernende aufbereiten (ohne Lösung; Reihenfolge-Elemente und
-- rechte Zuordnungsspalte gemischt).
CREATE OR REPLACE FUNCTION public.academy__public_question(q public.academy_questions)
RETURNS JSONB
LANGUAGE sql VOLATILE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', q.id,
    'type', q.type,
    'case_text', q.case_text,
    'prompt', q.prompt,
    'options', CASE
      WHEN q.type = 'order' THEN
        (SELECT coalesce(jsonb_agg(e ORDER BY random()), '[]'::jsonb) FROM jsonb_array_elements(q.options) e)
      WHEN q.type = 'match' THEN
        jsonb_build_object(
          'left',  q.options -> 'left',
          'right', (SELECT coalesce(jsonb_agg(e ORDER BY random()), '[]'::jsonb) FROM jsonb_array_elements(q.options -> 'right') e)
        )
      ELSE q.options
    END
  );
$$;

-- Ergebnis eines Versuchs abschließen (unbeantwortet = falsch).
CREATE OR REPLACE FUNCTION public.academy__grade_attempt(p_attempt UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_results JSONB := '{}'::jsonb;
  v_score INT := 0;
  r RECORD;
  a public.academy_quiz_attempts;
BEGIN
  SELECT * INTO a FROM public.academy_quiz_attempts WHERE id = p_attempt FOR UPDATE;
  FOR r IN
    SELECT q.id, q.type, k.correct
    FROM unnest(a.question_ids) qid
    JOIN public.academy_questions q ON q.id = qid
    JOIN public.academy_question_keys k ON k.question_id = q.id
  LOOP
    IF public.academy__answer_correct(r.type, r.correct, a.answers -> r.id::text) THEN
      v_results := v_results || jsonb_build_object(r.id::text, true);
      v_score := v_score + 1;
    ELSE
      v_results := v_results || jsonb_build_object(r.id::text, false);
    END IF;
  END LOOP;

  UPDATE public.academy_quiz_attempts
  SET results = v_results,
      score = v_score,
      passed = (v_score * 100) >= (a.pass_pct * a.total),
      finished_at = now()
  WHERE id = p_attempt;
END;
$$;

-- ============================================================================
-- 5) Öffentliche Funktionen für die Akademie-Oberfläche
-- ============================================================================

-- Gesamter Stand eines Kurses für den eingeloggten Nutzer.
CREATE OR REPLACE FUNCTION public.academy_course_state(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_course public.academy_courses;
  v_modules JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Bitte melde dich an.'; END IF;
  SELECT * INTO v_course FROM public.academy_courses WHERE slug = p_slug AND published = true;
  IF v_course.id IS NULL THEN RETURN NULL; END IF;

  SELECT coalesce(jsonb_agg(mod ORDER BY (mod->>'sort_order')::int, mod->>'id'), '[]'::jsonb) INTO v_modules
  FROM (
    SELECT jsonb_build_object(
      'id', m.id,
      'title', m.title,
      'description', m.description,
      'sort_order', m.sort_order,
      'test_question_count', m.test_question_count,
      'test_pass_pct', m.test_pass_pct,
      'test_retry_minutes', m.test_retry_minutes,
      'unlocked', public.academy__module_unlocked(v_uid, m.id),
      'passed', public.academy__module_passed(v_uid, m.id),
      'best_score', (SELECT max(a.score) FROM public.academy_quiz_attempts a
                     WHERE a.user_id = v_uid AND a.module_id = m.id AND a.kind = 'module' AND a.finished_at IS NOT NULL),
      'best_total', (SELECT a.total FROM public.academy_quiz_attempts a
                     WHERE a.user_id = v_uid AND a.module_id = m.id AND a.kind = 'module' AND a.finished_at IS NOT NULL
                     ORDER BY a.score DESC NULLS LAST LIMIT 1),
      'test_attempts', (SELECT count(*) FROM public.academy_quiz_attempts a
                        WHERE a.user_id = v_uid AND a.module_id = m.id AND a.kind = 'module' AND a.finished_at IS NOT NULL),
      'retry_at', (SELECT a.finished_at + make_interval(mins => m.test_retry_minutes)
                   FROM public.academy_quiz_attempts a
                   WHERE a.user_id = v_uid AND a.module_id = m.id AND a.kind = 'module' AND a.finished_at IS NOT NULL
                   ORDER BY a.finished_at DESC LIMIT 1),
      'last_passed', (SELECT a.passed FROM public.academy_quiz_attempts a
                      WHERE a.user_id = v_uid AND a.module_id = m.id AND a.kind = 'module' AND a.finished_at IS NOT NULL
                      ORDER BY a.finished_at DESC LIMIT 1),
      'open_test_attempt', (SELECT a.id FROM public.academy_quiz_attempts a
                            WHERE a.user_id = v_uid AND a.module_id = m.id AND a.kind = 'module' AND a.finished_at IS NULL
                              AND a.started_at > now() - interval '3 hours'
                            ORDER BY a.started_at DESC LIMIT 1),
      'lessons', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', l.id,
          'title', l.title,
          'learning_goal', l.learning_goal,
          'duration_min', l.duration_min,
          'sort_order', l.sort_order,
          'learned', EXISTS (SELECT 1 FROM public.academy_lesson_progress p
                             WHERE p.user_id = v_uid AND p.lesson_id = l.id AND p.status = 'completed'),
          'quiz_done', public.academy__topic_done(v_uid, l.id),
          'quiz_best_score', (SELECT max(a.score) FROM public.academy_quiz_attempts a
                              WHERE a.user_id = v_uid AND a.lesson_id = l.id AND a.kind = 'topic' AND a.finished_at IS NOT NULL),
          'quiz_total', least(l.quiz_question_count,
                              (SELECT count(*) FROM public.academy_questions q WHERE q.lesson_id = l.id AND q.active)),
          'question_count', (SELECT count(*) FROM public.academy_questions q WHERE q.lesson_id = l.id AND q.active)
        ) ORDER BY l.sort_order, l.id), '[]'::jsonb)
        FROM public.academy_lessons l WHERE l.module_id = m.id
      )
    ) AS mod
    FROM public.academy_modules m WHERE m.course_id = v_course.id
  ) s;

  RETURN jsonb_build_object(
    'course', jsonb_build_object('id', v_course.id, 'slug', v_course.slug, 'title', v_course.title, 'description', v_course.description),
    'modules', v_modules,
    'modules_total', jsonb_array_length(v_modules),
    'modules_passed', (SELECT count(*) FROM jsonb_array_elements(v_modules) e WHERE (e->>'passed')::boolean)
  );
END;
$$;

-- Abfrage (topic) oder Modul-Test (module) starten. Gibt Fragen OHNE Lösung zurück.
CREATE OR REPLACE FUNCTION public.academy_start_attempt(p_kind TEXT, p_ref UUID)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_lesson public.academy_lessons;
  v_module public.academy_modules;
  v_ids UUID[];
  v_last_ids UUID[];
  v_open public.academy_quiz_attempts;
  v_last public.academy_quiz_attempts;
  v_attempt UUID;
  v_missing INT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Bitte melde dich an.'; END IF;

  IF p_kind = 'topic' THEN
    SELECT * INTO v_lesson FROM public.academy_lessons WHERE id = p_ref;
    IF v_lesson.id IS NULL THEN RAISE EXCEPTION 'Thema nicht gefunden.'; END IF;
    IF NOT public.academy__module_unlocked(v_uid, v_lesson.module_id) THEN
      RAISE EXCEPTION 'Dieses Modul ist noch gesperrt.';
    END IF;

    SELECT array_agg(id) INTO v_ids FROM (
      SELECT q.id FROM public.academy_questions q
      WHERE q.lesson_id = v_lesson.id AND q.active
        AND EXISTS (SELECT 1 FROM public.academy_question_keys k WHERE k.question_id = q.id)
      ORDER BY random() LIMIT v_lesson.quiz_question_count
    ) s;
    IF v_ids IS NULL THEN RAISE EXCEPTION 'Für dieses Thema gibt es noch keine Fragen.'; END IF;

    -- Wer die Abfrage startet, hat das Thema gelernt.
    INSERT INTO public.academy_lesson_progress (user_id, lesson_id, status, completed_at)
    VALUES (v_uid, v_lesson.id, 'completed', now())
    ON CONFLICT (user_id, lesson_id) DO UPDATE SET status = 'completed',
      completed_at = coalesce(public.academy_lesson_progress.completed_at, now());

    INSERT INTO public.academy_quiz_attempts (user_id, kind, lesson_id, module_id, question_ids, total, pass_pct)
    VALUES (v_uid, 'topic', v_lesson.id, v_lesson.module_id, v_ids, array_length(v_ids, 1), 80)
    RETURNING id INTO v_attempt;

  ELSIF p_kind = 'module' THEN
    SELECT * INTO v_module FROM public.academy_modules WHERE id = p_ref;
    IF v_module.id IS NULL THEN RAISE EXCEPTION 'Modul nicht gefunden.'; END IF;
    IF NOT public.academy__module_unlocked(v_uid, v_module.id) THEN
      RAISE EXCEPTION 'Dieses Modul ist noch gesperrt.';
    END IF;

    SELECT count(*) INTO v_missing FROM public.academy_lessons l
    WHERE l.module_id = v_module.id AND NOT public.academy__topic_done(v_uid, l.id);
    IF v_missing > 0 THEN
      RAISE EXCEPTION 'Erst alle Abfragen dieses Moduls bestehen (noch %).', v_missing;
    END IF;

    -- Offenen Versuch fortsetzen statt neu zu würfeln.
    SELECT * INTO v_open FROM public.academy_quiz_attempts a
    WHERE a.user_id = v_uid AND a.module_id = v_module.id AND a.kind = 'module' AND a.finished_at IS NULL
      AND a.started_at > now() - interval '3 hours'
    ORDER BY a.started_at DESC LIMIT 1;

    IF v_open.id IS NOT NULL THEN
      v_attempt := v_open.id;
      v_ids := v_open.question_ids;
    ELSE
      SELECT * INTO v_last FROM public.academy_quiz_attempts a
      WHERE a.user_id = v_uid AND a.module_id = v_module.id AND a.kind = 'module' AND a.finished_at IS NOT NULL
      ORDER BY a.finished_at DESC LIMIT 1;

      IF v_last.id IS NOT NULL AND v_last.passed IS NOT TRUE
         AND v_last.finished_at + make_interval(mins => v_module.test_retry_minutes) > now() THEN
        RAISE EXCEPTION 'Wiederholung möglich ab %.',
          to_char((v_last.finished_at + make_interval(mins => v_module.test_retry_minutes)) AT TIME ZONE 'Europe/Berlin', 'DD.MM. HH24:MI "Uhr"');
      END IF;
      v_last_ids := coalesce(v_last.question_ids, '{}');

      -- Neue Fragen bevorzugen: was im letzten Versuch drankam, kommt zuletzt.
      SELECT array_agg(id) INTO v_ids FROM (
        SELECT q.id FROM public.academy_questions q
        JOIN public.academy_lessons l ON l.id = q.lesson_id
        WHERE l.module_id = v_module.id AND q.active
          AND EXISTS (SELECT 1 FROM public.academy_question_keys k WHERE k.question_id = q.id)
        ORDER BY (q.id = ANY (v_last_ids)), random()
        LIMIT v_module.test_question_count
      ) s;
      IF v_ids IS NULL THEN RAISE EXCEPTION 'Für dieses Modul gibt es noch keine Fragen.'; END IF;

      INSERT INTO public.academy_quiz_attempts (user_id, kind, module_id, question_ids, total, pass_pct)
      VALUES (v_uid, 'module', v_module.id, v_ids, array_length(v_ids, 1), v_module.test_pass_pct)
      RETURNING id INTO v_attempt;
    END IF;
  ELSE
    RAISE EXCEPTION 'Unbekannte Art: %', p_kind;
  END IF;

  RETURN jsonb_build_object(
    'attempt_id', v_attempt,
    'kind', p_kind,
    'total', array_length(v_ids, 1),
    'answers', (SELECT answers FROM public.academy_quiz_attempts WHERE id = v_attempt),
    'questions', (
      SELECT coalesce(jsonb_agg(public.academy__public_question(q) ORDER BY t.ord), '[]'::jsonb)
      FROM unnest(v_ids) WITH ORDINALITY AS t(qid, ord)
      JOIN public.academy_questions q ON q.id = t.qid
    )
  );
END;
$$;

-- Eine Antwort abgeben.
--   Abfrage (topic): sofortige Rückmeldung mit Begründung; nur die erste Antwort zählt.
--   Modul-Test (module): Antwort wird gespeichert, Auswertung erst bei academy_finish_attempt.
CREATE OR REPLACE FUNCTION public.academy_answer(p_attempt UUID, p_question UUID, p_answer JSONB)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  a public.academy_quiz_attempts;
  q public.academy_questions;
  k public.academy_question_keys;
  v_ok BOOLEAN;
  v_answered INT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Bitte melde dich an.'; END IF;
  SELECT * INTO a FROM public.academy_quiz_attempts WHERE id = p_attempt FOR UPDATE;
  IF a.id IS NULL OR a.user_id <> v_uid THEN RAISE EXCEPTION 'Versuch nicht gefunden.'; END IF;
  IF a.finished_at IS NOT NULL THEN RAISE EXCEPTION 'Dieser Versuch ist schon abgeschlossen.'; END IF;
  IF NOT (p_question = ANY (a.question_ids)) THEN RAISE EXCEPTION 'Frage gehört nicht zu diesem Versuch.'; END IF;

  SELECT * INTO q FROM public.academy_questions WHERE id = p_question;
  SELECT * INTO k FROM public.academy_question_keys WHERE question_id = p_question;

  IF a.kind = 'topic' THEN
    IF a.results ? p_question::text THEN
      v_ok := (a.results ->> p_question::text)::boolean;
    ELSE
      v_ok := public.academy__answer_correct(q.type, k.correct, p_answer);
      UPDATE public.academy_quiz_attempts
      SET answers = answers || jsonb_build_object(p_question::text, p_answer),
          results = results || jsonb_build_object(p_question::text, v_ok)
      WHERE id = a.id;
    END IF;

    SELECT count(*) INTO v_answered FROM jsonb_object_keys(
      (SELECT results FROM public.academy_quiz_attempts WHERE id = a.id));
    IF v_answered >= a.total THEN
      PERFORM public.academy__grade_attempt(a.id);
    END IF;

    RETURN (
      SELECT jsonb_build_object(
        'correct', v_ok,
        'correct_answer', k.correct,
        'explanation', k.explanation,
        'answered', v_answered,
        'total', x.total,
        'finished', x.finished_at IS NOT NULL,
        'score', x.score,
        'passed', x.passed
      ) FROM public.academy_quiz_attempts x WHERE x.id = a.id
    );
  END IF;

  UPDATE public.academy_quiz_attempts
  SET answers = answers || jsonb_build_object(p_question::text, p_answer)
  WHERE id = a.id;
  SELECT count(*) INTO v_answered FROM jsonb_object_keys(
    (SELECT answers FROM public.academy_quiz_attempts WHERE id = a.id));
  RETURN jsonb_build_object('saved', true, 'answered', v_answered, 'total', a.total);
END;
$$;

-- Versuch abschließen und Auswertung zurückgeben (mit Begründungen zum Nachlesen).
CREATE OR REPLACE FUNCTION public.academy_finish_attempt(p_attempt UUID)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  a public.academy_quiz_attempts;
  v_module public.academy_modules;
  v_next UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Bitte melde dich an.'; END IF;
  SELECT * INTO a FROM public.academy_quiz_attempts WHERE id = p_attempt;
  IF a.id IS NULL OR a.user_id <> v_uid THEN RAISE EXCEPTION 'Versuch nicht gefunden.'; END IF;

  IF a.finished_at IS NULL THEN
    PERFORM public.academy__grade_attempt(a.id);
    SELECT * INTO a FROM public.academy_quiz_attempts WHERE id = p_attempt;
  END IF;

  SELECT * INTO v_module FROM public.academy_modules WHERE id = a.module_id;
  SELECT m.id INTO v_next FROM public.academy_modules m
  WHERE m.course_id = v_module.course_id
    AND (m.sort_order > v_module.sort_order OR (m.sort_order = v_module.sort_order AND m.id > v_module.id))
  ORDER BY m.sort_order, m.id LIMIT 1;

  RETURN jsonb_build_object(
    'attempt_id', a.id,
    'kind', a.kind,
    'score', a.score,
    'total', a.total,
    'pass_pct', a.pass_pct,
    'passed', a.passed,
    'module_id', a.module_id,
    'next_module_id', v_next,
    'next_module_unlocked', CASE WHEN v_next IS NULL THEN NULL ELSE public.academy__module_unlocked(v_uid, v_next) END,
    'retry_at', CASE WHEN a.kind = 'module' AND a.passed IS NOT TRUE
                     THEN a.finished_at + make_interval(mins => v_module.test_retry_minutes) END,
    'by_lesson', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'lesson_id', s.lesson_id, 'title', s.title, 'sort_order', s.sort_order,
        'total', s.total, 'wrong', s.wrong
      ) ORDER BY s.sort_order), '[]'::jsonb)
      FROM (
        SELECT l.id AS lesson_id, l.title, l.sort_order,
               count(*) AS total,
               count(*) FILTER (WHERE coalesce((a.results ->> q.id::text)::boolean, false) = false) AS wrong
        FROM unnest(a.question_ids) qid
        JOIN public.academy_questions q ON q.id = qid
        JOIN public.academy_lessons l ON l.id = q.lesson_id
        GROUP BY l.id, l.title, l.sort_order
      ) s
    ),
    'review', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'question_id', q.id,
        'type', q.type,
        'case_text', q.case_text,
        'prompt', q.prompt,
        'options', q.options,
        'your_answer', a.answers -> q.id::text,
        'correct_answer', k.correct,
        'correct', coalesce((a.results ->> q.id::text)::boolean, false),
        'explanation', k.explanation
      ) ORDER BY t.ord), '[]'::jsonb)
      FROM unnest(a.question_ids) WITH ORDINALITY AS t(qid, ord)
      JOIN public.academy_questions q ON q.id = t.qid
      JOIN public.academy_question_keys k ON k.question_id = q.id
    )
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- Rechte: Hilfsfunktionen nur intern, öffentliche Funktionen nur für Angemeldete.
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.academy__answer_correct(TEXT, JSONB, JSONB)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.academy__module_passed(UUID, UUID)               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.academy__module_unlocked(UUID, UUID)             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.academy__topic_done(UUID, UUID)                  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.academy__public_question(public.academy_questions) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.academy__grade_attempt(UUID)                     FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.academy_course_state(TEXT)            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.academy_start_attempt(TEXT, UUID)     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.academy_answer(UUID, UUID, JSONB)     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.academy_finish_attempt(UUID)          FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.academy_course_state(TEXT)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.academy_start_attempt(TEXT, UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.academy_answer(UUID, UUID, JSONB)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.academy_finish_attempt(UUID)       TO authenticated;

-- ----------------------------------------------------------------------------
-- Alte Demo-Kurse aus Phase 0/1 ausblenden; die Ausbildung ersetzt sie.
-- ----------------------------------------------------------------------------
UPDATE public.academy_courses SET published = false
WHERE slug IN ('headhunting-grundlagen', 'active-sourcing-pro', 'recruiter-grundlagen', 'zertifizierter-matchunt-recruiter');
