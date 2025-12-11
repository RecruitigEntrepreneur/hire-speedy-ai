-- =============================================
-- PHASE 1: Neue Tabellen für strukturierte CV-Daten
-- =============================================

-- 1. Berufserfahrung (Experiences)
CREATE TABLE public.candidate_experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  location TEXT,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Ausbildung (Education)
CREATE TABLE public.candidate_educations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  institution TEXT NOT NULL,
  degree TEXT,
  field_of_study TEXT,
  graduation_year INTEGER,
  grade TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Sprachen (Languages) - strukturiert mit Proficiency
CREATE TABLE public.candidate_languages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  proficiency TEXT, -- 'native', 'fluent', 'advanced', 'intermediate', 'basic'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(candidate_id, language)
);

-- 4. Skills mit Kategorie und Level (erweitert)
CREATE TABLE public.candidate_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  category TEXT, -- 'programming', 'tool', 'soft_skill', 'process', 'domain'
  level TEXT, -- 'beginner', 'intermediate', 'expert'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(candidate_id, skill_name)
);

-- =============================================
-- PHASE 2: Neue Felder in candidates Tabelle
-- =============================================

-- CV-Rohdaten und AI-Zusammenfassung
ALTER TABLE public.candidates 
ADD COLUMN IF NOT EXISTS cv_raw_text TEXT,
ADD COLUMN IF NOT EXISTS cv_ai_summary TEXT,
ADD COLUMN IF NOT EXISTS cv_ai_bullets JSONB DEFAULT '[]'::jsonb;

-- Erweiterte Gehaltsfelder
ALTER TABLE public.candidates 
ADD COLUMN IF NOT EXISTS salary_expectation_min INTEGER,
ADD COLUMN IF NOT EXISTS salary_expectation_max INTEGER;

-- Präferenzen / Wunschrolle
ALTER TABLE public.candidates 
ADD COLUMN IF NOT EXISTS target_roles JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS target_industries JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS target_locations JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS target_employment_type TEXT;

-- Remote-Präferenz als explizites Feld
ALTER TABLE public.candidates 
ADD COLUMN IF NOT EXISTS remote_preference TEXT;

-- CV Parser Metadaten
ALTER TABLE public.candidates 
ADD COLUMN IF NOT EXISTS cv_parsed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cv_parser_version TEXT DEFAULT 'v1';

-- =============================================
-- PHASE 3: RLS Policies für neue Tabellen
-- =============================================

-- Enable RLS
ALTER TABLE public.candidate_experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_educations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_skills ENABLE ROW LEVEL SECURITY;

-- candidate_experiences Policies
CREATE POLICY "Recruiters can manage experiences for their candidates"
ON public.candidate_experiences FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.candidates c 
  WHERE c.id = candidate_experiences.candidate_id 
  AND c.recruiter_id = auth.uid()
));

CREATE POLICY "Admins can manage all experiences"
ON public.candidate_experiences FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- candidate_educations Policies
CREATE POLICY "Recruiters can manage educations for their candidates"
ON public.candidate_educations FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.candidates c 
  WHERE c.id = candidate_educations.candidate_id 
  AND c.recruiter_id = auth.uid()
));

CREATE POLICY "Admins can manage all educations"
ON public.candidate_educations FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- candidate_languages Policies
CREATE POLICY "Recruiters can manage languages for their candidates"
ON public.candidate_languages FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.candidates c 
  WHERE c.id = candidate_languages.candidate_id 
  AND c.recruiter_id = auth.uid()
));

CREATE POLICY "Admins can manage all languages"
ON public.candidate_languages FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- candidate_skills Policies
CREATE POLICY "Recruiters can manage skills for their candidates"
ON public.candidate_skills FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.candidates c 
  WHERE c.id = candidate_skills.candidate_id 
  AND c.recruiter_id = auth.uid()
));

CREATE POLICY "Admins can manage all skills"
ON public.candidate_skills FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- PHASE 4: Indizes für Performance
-- =============================================

CREATE INDEX idx_candidate_experiences_candidate ON public.candidate_experiences(candidate_id);
CREATE INDEX idx_candidate_educations_candidate ON public.candidate_educations(candidate_id);
CREATE INDEX idx_candidate_languages_candidate ON public.candidate_languages(candidate_id);
CREATE INDEX idx_candidate_skills_candidate ON public.candidate_skills(candidate_id);