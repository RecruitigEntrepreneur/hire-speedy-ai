-- Job Wizard: Three Engagement Tracks Migration
-- Adds support for Festanstellung, Freelancer, and ANÜ tracks

-- New columns for engagement model
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS engagement_model TEXT DEFAULT 'permanent';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS headcount INTEGER DEFAULT 1;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS compensation_model TEXT;

-- Freelancer/Project fields
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS rate_min NUMERIC;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS rate_max NUMERIC;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS rate_currency TEXT DEFAULT 'EUR';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS rate_includes_margin BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS project_duration TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS project_scope TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS project_budget_total NUMERIC;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS deliverables TEXT[];
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS extension_possible BOOLEAN;

-- ANÜ (Temp Staffing) fields
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assignment_duration TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS takeover_option TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS equal_pay_applicable BOOLEAN;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS equal_pay_start TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS shift_model TEXT DEFAULT 'normal';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS collective_agreement TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS industry_surcharges BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS existing_framework_contract BOOLEAN;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS works_council_status TEXT;

-- Extended requirement fields
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS exclusion_criteria TEXT[];
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS experience_years_min INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS industry_experience_required BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS travel_required TEXT DEFAULT 'none';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS security_clearance_required BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS background_check_required BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS drivers_license_required TEXT;

-- Context fields
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS team_integration TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS project_context TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS interview_stages INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS interview_process TEXT;

-- Contract & timing
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS start_date_flexibility TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS salary_negotiable BOOLEAN DEFAULT true;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS equity_options BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS probation_months INTEGER;

-- Quality scores
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS profile_completeness INTEGER DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS matching_readiness INTEGER DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recruiter_actionability INTEGER DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ai_import_confidence INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS headcount_filled INTEGER DEFAULT 0;

-- Set existing jobs to permanent engagement model
UPDATE jobs SET engagement_model = 'permanent' WHERE engagement_model IS NULL;

-- Add check constraint for valid engagement models
ALTER TABLE jobs ADD CONSTRAINT valid_engagement_model
  CHECK (engagement_model IN ('permanent', 'freelance', 'temp_staffing'));
