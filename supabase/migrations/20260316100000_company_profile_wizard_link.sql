-- ============================================================================
-- Company Profile ↔ Wizard Link
-- Adds FK from jobs → company_profiles and extends company_profiles with
-- wizard-relevant default fields.
-- ============================================================================

-- 1. Extend company_profiles with wizard-relevant defaults
ALTER TABLE company_profiles
  ADD COLUMN IF NOT EXISTS company_size_band TEXT,
  ADD COLUMN IF NOT EXISTS funding_stage TEXT,
  ADD COLUMN IF NOT EXISTS default_tech_environment TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS default_benefits TEXT[] DEFAULT '{}';

-- 2. Add FK from jobs → company_profiles
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS company_profile_id UUID REFERENCES company_profiles(id);

-- 3. Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_jobs_company_profile_id
  ON jobs(company_profile_id)
  WHERE company_profile_id IS NOT NULL;

-- 4. Backfill existing jobs: link to company_profiles via client_id → user_id
UPDATE jobs j
SET company_profile_id = cp.id
FROM company_profiles cp
WHERE j.client_id = cp.user_id
  AND j.company_profile_id IS NULL;
