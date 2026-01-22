-- =====================================================
-- ML ARCHITECTURE PHASE 1: DATA FOUNDATION
-- Automatic outcome tracking + training event logging
-- =====================================================

-- 1. Create ml_training_events table for structured ML training data
CREATE TABLE public.ml_training_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  
  -- Snapshot at time of event
  match_score_at_event INTEGER,
  candidate_skills_snapshot JSONB,
  job_requirements_snapshot JSONB,
  salary_delta_at_event NUMERIC,
  domain_match_at_event TEXT,
  
  -- Outcome
  final_outcome TEXT,
  days_to_outcome INTEGER,
  rejection_category TEXT,
  
  -- Metadata
  recruiter_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.ml_training_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can read all training events"
  ON public.ml_training_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Recruiters can read own training events"
  ON public.ml_training_events FOR SELECT
  USING (recruiter_id = auth.uid());

-- Indexes
CREATE INDEX idx_ml_training_events_submission ON ml_training_events(submission_id);
CREATE INDEX idx_ml_training_events_candidate ON ml_training_events(candidate_id);
CREATE INDEX idx_ml_training_events_job ON ml_training_events(job_id);
CREATE INDEX idx_ml_training_events_outcome ON ml_training_events(final_outcome) WHERE final_outcome IS NOT NULL;
CREATE INDEX idx_ml_training_events_created ON ml_training_events(created_at);

-- 2. Trigger for automatic outcome sync to match_outcomes
CREATE OR REPLACE FUNCTION sync_submission_outcome_to_match()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('hired', 'rejected', 'withdrawn', 'expired', 'client_rejected') 
     AND (OLD.status IS NULL OR OLD.status != NEW.status) THEN
    
    UPDATE match_outcomes
    SET 
      actual_outcome = NEW.status,
      outcome_stage = COALESCE(NEW.stage, 'unknown'),
      rejection_category = NEW.rejection_reason,
      outcome_recorded_at = NOW(),
      days_to_outcome = EXTRACT(DAY FROM NOW() - match_outcomes.created_at)::INTEGER
    WHERE submission_id = NEW.id
      AND actual_outcome IS NULL;
    
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger for ML training event logging
CREATE OR REPLACE FUNCTION log_ml_training_event()
RETURNS TRIGGER AS $$
DECLARE
  v_candidate_skills JSONB;
  v_job_requirements JSONB;
  v_salary_delta NUMERIC;
BEGIN
  SELECT to_jsonb(skills) INTO v_candidate_skills
  FROM candidates WHERE id = NEW.candidate_id;
  
  SELECT jsonb_build_object(
    'must_haves', must_haves,
    'nice_to_haves', nice_to_haves,
    'experience_level', experience_level
  ) INTO v_job_requirements
  FROM jobs WHERE id = NEW.job_id;
  
  SELECT 
    CASE 
      WHEN c.salary_expectation_min IS NOT NULL AND j.salary_max IS NOT NULL 
      THEN ((c.salary_expectation_min - j.salary_max)::NUMERIC / NULLIF(j.salary_max, 0)) * 100
      ELSE NULL
    END INTO v_salary_delta
  FROM candidates c, jobs j
  WHERE c.id = NEW.candidate_id AND j.id = NEW.job_id;
  
  INSERT INTO ml_training_events (
    event_type, submission_id, candidate_id, job_id,
    match_score_at_event, candidate_skills_snapshot, job_requirements_snapshot,
    salary_delta_at_event, final_outcome, days_to_outcome, rejection_category, recruiter_id
  ) VALUES (
    CASE WHEN TG_OP = 'INSERT' THEN 'submission_created' ELSE 'status_' || NEW.status END,
    NEW.id, NEW.candidate_id, NEW.job_id,
    NEW.match_score, v_candidate_skills, v_job_requirements, v_salary_delta,
    CASE WHEN NEW.status IN ('hired', 'rejected', 'withdrawn', 'expired', 'client_rejected') 
         THEN NEW.status ELSE NULL END,
    CASE WHEN NEW.status IN ('hired', 'rejected', 'withdrawn', 'expired', 'client_rejected')
         THEN EXTRACT(DAY FROM NOW() - NEW.submitted_at)::INTEGER ELSE NULL END,
    NEW.rejection_reason, NEW.recruiter_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create triggers
DROP TRIGGER IF EXISTS trigger_sync_outcome ON submissions;
CREATE TRIGGER trigger_sync_outcome
  AFTER UPDATE ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION sync_submission_outcome_to_match();

DROP TRIGGER IF EXISTS trigger_log_ml_event_insert ON submissions;
CREATE TRIGGER trigger_log_ml_event_insert
  AFTER INSERT ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION log_ml_training_event();

DROP TRIGGER IF EXISTS trigger_log_ml_event_update ON submissions;
CREATE TRIGGER trigger_log_ml_event_update
  AFTER UPDATE ON submissions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_ml_training_event();

-- 5. Backfill existing submission outcomes to match_outcomes
UPDATE match_outcomes mo
SET 
  actual_outcome = s.status,
  outcome_stage = COALESCE(s.stage, 'unknown'),
  rejection_category = s.rejection_reason,
  outcome_recorded_at = s.updated_at,
  days_to_outcome = EXTRACT(DAY FROM s.updated_at - mo.created_at)::INTEGER
FROM submissions s
WHERE mo.submission_id = s.id
  AND s.status IN ('hired', 'rejected', 'withdrawn', 'expired', 'client_rejected')
  AND mo.actual_outcome IS NULL;

-- 6. Backfill ml_training_events for existing submissions
INSERT INTO ml_training_events (
  event_type, submission_id, candidate_id, job_id,
  match_score_at_event, candidate_skills_snapshot,
  final_outcome, days_to_outcome, rejection_category, recruiter_id, created_at
)
SELECT 
  CASE 
    WHEN s.status IN ('hired', 'rejected', 'withdrawn', 'expired', 'client_rejected')
    THEN 'status_' || s.status
    ELSE 'submission_created'
  END,
  s.id, s.candidate_id, s.job_id, s.match_score, to_jsonb(c.skills),
  CASE WHEN s.status IN ('hired', 'rejected', 'withdrawn', 'expired', 'client_rejected') 
       THEN s.status ELSE NULL END,
  CASE WHEN s.status IN ('hired', 'rejected', 'withdrawn', 'expired', 'client_rejected')
       THEN EXTRACT(DAY FROM s.updated_at - s.submitted_at)::INTEGER ELSE NULL END,
  s.rejection_reason, s.recruiter_id, s.submitted_at
FROM submissions s
JOIN candidates c ON c.id = s.candidate_id;