
CREATE TABLE IF NOT EXISTS public.recruiter_trust_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID NOT NULL UNIQUE,
  trust_level TEXT NOT NULL DEFAULT 'bronze' CHECK (trust_level IN ('bronze', 'silver', 'gold', 'suspended')),
  placements_hired INTEGER DEFAULT 0,
  total_activations INTEGER DEFAULT 0,
  activations_with_submission INTEGER DEFAULT 0,
  activation_ratio NUMERIC(5,2) DEFAULT 0,
  active_count INTEGER DEFAULT 0,
  max_active_slots INTEGER DEFAULT 5,
  previous_level TEXT,
  level_changed_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  suspended_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.recruiter_job_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID NOT NULL,
  job_id UUID NOT NULL,
  trust_level_at TEXT NOT NULL,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_submission_at TIMESTAMPTZ,
  has_submitted BOOLEAN DEFAULT false,
  UNIQUE(recruiter_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_trust_levels_recruiter ON public.recruiter_trust_levels(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_trust_levels_level ON public.recruiter_trust_levels(trust_level);
CREATE INDEX IF NOT EXISTS idx_activations_recruiter ON public.recruiter_job_activations(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_activations_job ON public.recruiter_job_activations(job_id);
CREATE INDEX IF NOT EXISTS idx_activations_submitted ON public.recruiter_job_activations(recruiter_id, has_submitted);

ALTER TABLE public.recruiter_trust_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiter_job_activations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recruiters can view own trust level" ON public.recruiter_trust_levels;
CREATE POLICY "Recruiters can view own trust level"
  ON public.recruiter_trust_levels FOR SELECT
  USING (auth.uid() = recruiter_id);

DROP POLICY IF EXISTS "Recruiters can insert own trust level" ON public.recruiter_trust_levels;
CREATE POLICY "Recruiters can insert own trust level"
  ON public.recruiter_trust_levels FOR INSERT
  WITH CHECK (auth.uid() = recruiter_id);

DROP POLICY IF EXISTS "Recruiters can update own trust level" ON public.recruiter_trust_levels;
CREATE POLICY "Recruiters can update own trust level"
  ON public.recruiter_trust_levels FOR UPDATE
  USING (auth.uid() = recruiter_id);

DROP POLICY IF EXISTS "Recruiters can view own activations" ON public.recruiter_job_activations;
CREATE POLICY "Recruiters can view own activations"
  ON public.recruiter_job_activations FOR SELECT
  USING (auth.uid() = recruiter_id);

DROP POLICY IF EXISTS "Recruiters can insert own activations" ON public.recruiter_job_activations;
CREATE POLICY "Recruiters can insert own activations"
  ON public.recruiter_job_activations FOR INSERT
  WITH CHECK (auth.uid() = recruiter_id);

NOTIFY pgrst, 'reload schema';
