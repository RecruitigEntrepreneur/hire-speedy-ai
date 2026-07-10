-- ============================================================================
-- Matchunt Akademie — Phase 0: Fundament
-- ----------------------------------------------------------------------------
-- Eigene Subdomain (akademie.matchunt.de), GETEILTES Backend.
-- Akademie-Mitgliedschaft lebt in academy_* Tabellen und ist BEWUSST vom
-- sensiblen app_role / user_roles Pfad entkoppelt:
--   * Akademie-Signup vergibt KEINE Plattform-Rolle.
--   * "Andocken" (Absolvent -> Recruiter) ist eine separate Admin-Aktion
--     (kommt in Phase 5), niemals Self-Service.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) academy_profiles — Mitgliedsprofil (entkoppelt von user_roles)
-- ----------------------------------------------------------------------------
CREATE TABLE public.academy_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name        TEXT NOT NULL DEFAULT '',
  experience_years    INTEGER,
  specialization      TEXT,
  plan                TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2) academy_courses / academy_modules / academy_lessons — LMS-Inhalt
-- ----------------------------------------------------------------------------
CREATE TABLE public.academy_courses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                TEXT NOT NULL UNIQUE,
  title               TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  level               TEXT NOT NULL DEFAULT 'beginner' CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  is_premium          BOOLEAN NOT NULL DEFAULT false,
  published           BOOLEAN NOT NULL DEFAULT false,
  cover_image_url     TEXT,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.academy_modules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id           UUID NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.academy_lessons (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id           UUID NOT NULL REFERENCES public.academy_modules(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  content_type        TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('video', 'text', 'quiz')),
  body                TEXT NOT NULL DEFAULT '',
  video_url           TEXT,
  duration_min        INTEGER,
  is_premium          BOOLEAN NOT NULL DEFAULT false,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3) academy_enrollments / academy_lesson_progress — Fortschritt
-- ----------------------------------------------------------------------------
CREATE TABLE public.academy_enrollments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id           UUID NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  progress_pct        INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

CREATE TABLE public.academy_lesson_progress (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id           UUID NOT NULL REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX idx_academy_modules_course      ON public.academy_modules(course_id);
CREATE INDEX idx_academy_lessons_module      ON public.academy_lessons(module_id);
CREATE INDEX idx_academy_enrollments_user    ON public.academy_enrollments(user_id);
CREATE INDEX idx_academy_enrollments_course  ON public.academy_enrollments(course_id);
CREATE INDEX idx_academy_progress_user       ON public.academy_lesson_progress(user_id);
CREATE INDEX idx_academy_progress_lesson     ON public.academy_lesson_progress(lesson_id);
-- Partieller Index für die read_published-Policy (nur veröffentlichte Kurse werden gefiltert)
CREATE INDEX idx_academy_courses_published   ON public.academy_courses(published) WHERE published = true;

-- ----------------------------------------------------------------------------
-- updated_at Trigger (nutzt vorhandene public.update_updated_at())
-- ----------------------------------------------------------------------------
CREATE TRIGGER trg_academy_profiles_updated_at     BEFORE UPDATE ON public.academy_profiles        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_academy_courses_updated_at      BEFORE UPDATE ON public.academy_courses         FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_academy_modules_updated_at      BEFORE UPDATE ON public.academy_modules         FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_academy_lessons_updated_at      BEFORE UPDATE ON public.academy_lessons         FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_academy_enrollments_updated_at  BEFORE UPDATE ON public.academy_enrollments     FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_academy_progress_updated_at     BEFORE UPDATE ON public.academy_lesson_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.academy_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_courses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_modules         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_lessons         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_enrollments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_lesson_progress ENABLE ROW LEVEL SECURITY;

-- academy_profiles: Nutzer verwaltet eigenes Profil, Admin alles
CREATE POLICY "academy_profiles_select_own" ON public.academy_profiles
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "academy_profiles_insert_own" ON public.academy_profiles
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "academy_profiles_update_own" ON public.academy_profiles
  FOR UPDATE USING (user_id = (select auth.uid()));
CREATE POLICY "academy_profiles_admin_all" ON public.academy_profiles
  FOR ALL USING (has_role((select auth.uid()), 'admin'::app_role));

-- Inhalte (courses/modules/lessons): veröffentlichte sind öffentlich lesbar
-- (für Landing/Katalog-Vorschau, auch anonym). Admin verwaltet alles.
CREATE POLICY "academy_courses_read_published" ON public.academy_courses
  FOR SELECT USING (published = true);
CREATE POLICY "academy_courses_admin_all" ON public.academy_courses
  FOR ALL USING (has_role((select auth.uid()), 'admin'::app_role));

CREATE POLICY "academy_modules_read_published" ON public.academy_modules
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.academy_courses c
    WHERE c.id = academy_modules.course_id AND c.published = true
  ));
CREATE POLICY "academy_modules_admin_all" ON public.academy_modules
  FOR ALL USING (has_role((select auth.uid()), 'admin'::app_role));

CREATE POLICY "academy_lessons_read_published" ON public.academy_lessons
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.academy_modules m
    JOIN public.academy_courses c ON c.id = m.course_id
    WHERE m.id = academy_lessons.module_id AND c.published = true
  ));
CREATE POLICY "academy_lessons_admin_all" ON public.academy_lessons
  FOR ALL USING (has_role((select auth.uid()), 'admin'::app_role));

-- Fortschritt/Enrollments: Nutzer verwaltet nur eigene Daten, Admin alles
CREATE POLICY "academy_enrollments_own_all" ON public.academy_enrollments
  FOR ALL USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "academy_enrollments_admin_all" ON public.academy_enrollments
  FOR ALL USING (has_role((select auth.uid()), 'admin'::app_role));

CREATE POLICY "academy_progress_own_all" ON public.academy_lesson_progress
  FOR ALL USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "academy_progress_admin_all" ON public.academy_lesson_progress
  FOR ALL USING (has_role((select auth.uid()), 'admin'::app_role));

-- ============================================================================
-- handle_new_user — ADDITIVER Zweig für Akademie-Mitglieder
-- ----------------------------------------------------------------------------
-- Bestehende Logik (client/recruiter, kein Self-Service-Admin) UNVERÄNDERT.
-- Neu: account_type = 'academy' => nur profiles + academy_profiles,
--      KEINE user_roles-Zeile => null Plattform-Privilegien bis zum Andocken.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  requested_role text := NEW.raw_user_meta_data ->> 'role';
  account_type   text := NEW.raw_user_meta_data ->> 'account_type';
  safe_role app_role;
BEGIN
  -- Basis-Profil immer anlegen
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  );

  -- Akademie-Mitglieder: KEINE Plattform-Rolle. Mitgliedschaft separat.
  IF account_type = 'academy' THEN
    INSERT INTO public.academy_profiles (user_id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''))
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
  END IF;

  -- Plattform-Signups: nur client/recruiter; niemals Self-Service-Admin.
  safe_role := CASE
    WHEN requested_role IN ('client', 'recruiter') THEN requested_role::app_role
    ELSE 'client'::app_role
  END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, safe_role);

  RETURN NEW;
END;
$$;

-- ============================================================================
-- SEED — ein Demo-Kurs, damit Katalog & Landing nicht leer sind
-- ============================================================================
INSERT INTO public.academy_courses (id, slug, title, description, level, is_premium, published, sort_order) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'headhunting-grundlagen', 'Headhunting-Grundlagen',
   'Vom ersten Mandat bis zur Platzierung: Sourcing, Ansprache, Qualifizierung und Closing – das Fundament für erfolgreiche Personalberatung.',
   'beginner', false, true, 1),
  ('a0000000-0000-4000-8000-000000000002', 'active-sourcing-pro', 'Active Sourcing Pro',
   'Fortgeschrittene Such- und Ansprachestrategien auf LinkedIn & Co., Boolean Search, Talent-Mapping und Conversion-Optimierung.',
   'advanced', true, true, 2);

INSERT INTO public.academy_modules (id, course_id, title, sort_order) VALUES
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Einführung & Mindset', 1),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Sourcing-Grundlagen', 2);

INSERT INTO public.academy_lessons (module_id, title, content_type, body, duration_min, is_premium, sort_order) VALUES
  ('b0000000-0000-4000-8000-000000000001', 'Was macht einen Top-Headhunter aus?', 'text', 'Willkommen in der Matchunt Akademie. In dieser Lektion klären wir Rolle, Verantwortung und Erfolgsfaktoren moderner Personalberatung.', 8, false, 1),
  ('b0000000-0000-4000-8000-000000000001', 'Der Recruiting-Funnel im Überblick', 'text', 'Vom Mandat bis zur Platzierung: die Phasen des Funnels und wo die meisten Kandidaten verloren gehen.', 10, false, 2),
  ('b0000000-0000-4000-8000-000000000002', 'Quellen identifizieren', 'text', 'Wo finden sich die besten passiven Kandidaten? Ein Überblick über Kanäle und ihre Stärken.', 12, false, 1),
  ('b0000000-0000-4000-8000-000000000002', 'Erste Ansprache formulieren', 'text', 'Wie eine Erstansprache aussehen muss, damit sie geöffnet und beantwortet wird.', 9, true, 2);
