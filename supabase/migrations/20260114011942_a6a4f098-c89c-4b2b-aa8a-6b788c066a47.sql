-- ============================================
-- V3.1 MATCHING ENGINE SCHEMA EXTENSIONS
-- ============================================

-- 1. Erweitere skill_taxonomy für Dependencies und Cluster
ALTER TABLE skill_taxonomy ADD COLUMN IF NOT EXISTS core_prereqs TEXT[] DEFAULT '{}';
ALTER TABLE skill_taxonomy ADD COLUMN IF NOT EXISTS support_prereqs TEXT[] DEFAULT '{}';
ALTER TABLE skill_taxonomy ADD COLUMN IF NOT EXISTS cluster_id TEXT;
ALTER TABLE skill_taxonomy ADD COLUMN IF NOT EXISTS weight NUMERIC DEFAULT 1.0;

-- 2. Erweitere matching_config für Profile und Policies
ALTER TABLE matching_config ADD COLUMN IF NOT EXISTS profile TEXT DEFAULT 'default';
ALTER TABLE matching_config ADD COLUMN IF NOT EXISTS hard_kill_defaults JSONB DEFAULT '{
  "visa_required": true,
  "language_required": true,
  "onsite_required": true,
  "license_required": true
}'::jsonb;
ALTER TABLE matching_config ADD COLUMN IF NOT EXISTS dealbreaker_multipliers JSONB DEFAULT '{
  "salary": [
    {"min": 0, "max": 10, "multiplier": 0.6},
    {"min": 10, "max": 20, "multiplier": 0.3},
    {"min": 20, "max": 30, "multiplier": 0.15},
    {"min": 30, "max": 999, "multiplier": 0.05}
  ],
  "start_date": [
    {"min": 14, "max": 30, "multiplier": 0.7},
    {"min": 30, "max": 60, "multiplier": 0.4},
    {"min": 60, "max": 999, "multiplier": 0.2}
  ],
  "seniority": [
    {"gap": 1, "multiplier": 0.6},
    {"gap": 2, "multiplier": 0.25},
    {"gap": 3, "multiplier": 0.1}
  ]
}'::jsonb;
ALTER TABLE matching_config ADD COLUMN IF NOT EXISTS display_policies JSONB DEFAULT '{
  "hot": {"minScore": 85, "minCoverage": 0.85, "maxBlockers": 0, "requiresMultiplier1": true},
  "standard": {"minScore": 75, "minCoverage": 0.70, "maxBlockers": 0, "requiresMultiplier1": false},
  "maybe": {"minScore": 65, "minCoverage": 0.60, "maxBlockers": 1, "requiresMultiplier1": false}
}'::jsonb;

-- 3. Neue Tabelle für strukturierte Job-Skill-Requirements
CREATE TABLE IF NOT EXISTS job_skill_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('must', 'nice')),
  weight NUMERIC DEFAULT 1.0,
  cluster_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(job_id, skill_name)
);

-- Enable RLS
ALTER TABLE job_skill_requirements ENABLE ROW LEVEL SECURITY;

-- RLS Policies für job_skill_requirements
CREATE POLICY "Users can view job skill requirements for visible jobs"
  ON job_skill_requirements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM jobs WHERE jobs.id = job_skill_requirements.job_id
    )
  );

CREATE POLICY "Clients can manage skill requirements for their jobs"
  ON job_skill_requirements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM jobs WHERE jobs.id = job_skill_requirements.job_id AND jobs.client_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all job skill requirements"
  ON job_skill_requirements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
    )
  );

-- 4. Erweitere jobs Tabelle für Hard-Kill Konfiguration
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS required_languages JSONB DEFAULT '[]'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS required_certifications TEXT[] DEFAULT '{}';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS onsite_required BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS hard_kill_overrides JSONB DEFAULT '{}'::jsonb;

-- 5. Erweitere candidates Tabelle für besseres Matching
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS certifications TEXT[] DEFAULT '{}';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS language_skills JSONB DEFAULT '[]'::jsonb;

-- 6. Index für Performance
CREATE INDEX IF NOT EXISTS idx_job_skill_requirements_job_id ON job_skill_requirements(job_id);
CREATE INDEX IF NOT EXISTS idx_job_skill_requirements_type ON job_skill_requirements(type);
CREATE INDEX IF NOT EXISTS idx_skill_taxonomy_cluster ON skill_taxonomy(cluster_id);

-- 7. Erweitere match_outcomes für V3.1 Tracking
ALTER TABLE match_outcomes ADD COLUMN IF NOT EXISTS must_have_coverage NUMERIC;
ALTER TABLE match_outcomes ADD COLUMN IF NOT EXISTS gate_multiplier NUMERIC;
ALTER TABLE match_outcomes ADD COLUMN IF NOT EXISTS policy_tier TEXT;
ALTER TABLE match_outcomes ADD COLUMN IF NOT EXISTS killed BOOLEAN DEFAULT false;
ALTER TABLE match_outcomes ADD COLUMN IF NOT EXISTS excluded BOOLEAN DEFAULT false;
ALTER TABLE match_outcomes ADD COLUMN IF NOT EXISTS kill_reason TEXT;