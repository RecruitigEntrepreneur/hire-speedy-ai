-- ============================================
-- Phase 6: Skill-Level-Tracking Extension
-- ============================================

-- Extend candidate_skills with level tracking columns
ALTER TABLE public.candidate_skills
  ADD COLUMN IF NOT EXISTS years_experience NUMERIC,
  ADD COLUMN IF NOT EXISTS last_used DATE,
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS from_cv BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Extend job_skill_requirements with level requirements
ALTER TABLE public.job_skill_requirements
  ADD COLUMN IF NOT EXISTS min_years NUMERIC,
  ADD COLUMN IF NOT EXISTS min_proficiency TEXT CHECK (min_proficiency IN ('beginner', 'intermediate', 'advanced', 'expert')),
  ADD COLUMN IF NOT EXISTS recency_required INTEGER,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create trigger to update updated_at on candidate_skills
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add trigger for candidate_skills
DROP TRIGGER IF EXISTS update_candidate_skills_updated_at ON public.candidate_skills;
CREATE TRIGGER update_candidate_skills_updated_at
  BEFORE UPDATE ON public.candidate_skills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add trigger for job_skill_requirements
DROP TRIGGER IF EXISTS update_job_skill_requirements_updated_at ON public.job_skill_requirements;
CREATE TRIGGER update_job_skill_requirements_updated_at
  BEFORE UPDATE ON public.job_skill_requirements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_candidate_skills_primary ON public.candidate_skills(candidate_id) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_candidate_skills_verified ON public.candidate_skills(candidate_id) WHERE verified = true;
CREATE INDEX IF NOT EXISTS idx_job_skill_requirements_min_years ON public.job_skill_requirements(job_id) WHERE min_years IS NOT NULL;