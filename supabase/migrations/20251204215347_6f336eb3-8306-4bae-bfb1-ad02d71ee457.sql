
-- Fix: Recreate view with SECURITY INVOKER (default, safer)
DROP VIEW IF EXISTS candidate_job_overview;

CREATE VIEW candidate_job_overview WITH (security_invoker = true) AS
SELECT 
  c.id AS candidate_id,
  c.full_name,
  c.email,
  c.recruiter_id,
  c.preferred_channel,
  COUNT(s.id) AS total_submissions,
  COUNT(CASE WHEN s.status NOT IN ('rejected', 'withdrawn') THEN 1 END) AS active_submissions,
  json_agg(
    json_build_object(
      'submission_id', s.id,
      'job_id', j.id,
      'job_title', j.title,
      'company_name', j.company_name,
      'status', s.status,
      'stage', s.stage,
      'submitted_at', s.submitted_at,
      'last_activity', s.updated_at
    ) ORDER BY s.submitted_at DESC
  ) FILTER (WHERE s.id IS NOT NULL) AS jobs
FROM candidates c
LEFT JOIN submissions s ON s.candidate_id = c.id
LEFT JOIN jobs j ON j.id = s.job_id
GROUP BY c.id;
