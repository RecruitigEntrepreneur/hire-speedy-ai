
-- Fix Security Definer Views - recreate with SECURITY INVOKER
DROP VIEW IF EXISTS client_submissions_view;
DROP VIEW IF EXISTS client_interviews_view;
DROP VIEW IF EXISTS client_offers_view;

-- 1. Create View for Client Submissions with SECURITY INVOKER
CREATE VIEW client_submissions_view 
WITH (security_invoker = true) AS
SELECT 
  s.id,
  s.status,
  s.stage,
  s.submitted_at,
  s.match_score,
  s.job_id,
  s.candidate_id,
  j.client_id,
  j.title as job_title,
  j.industry as job_industry,
  c.full_name as candidate_name,
  c.job_title as candidate_role,
  c.skills,
  c.experience_years,
  c.city,
  c.notice_period
FROM submissions s
JOIN jobs j ON s.job_id = j.id
JOIN candidates c ON s.candidate_id = c.id;

-- 2. Create View for Client Interviews with SECURITY INVOKER
CREATE VIEW client_interviews_view 
WITH (security_invoker = true) AS
SELECT 
  i.id,
  i.status,
  i.scheduled_at,
  i.created_at,
  i.submission_id,
  s.status as submission_status,
  s.job_id,
  j.client_id,
  j.title as job_title,
  j.industry as job_industry,
  c.full_name as candidate_name,
  c.id as candidate_id
FROM interviews i
JOIN submissions s ON i.submission_id = s.id
JOIN jobs j ON s.job_id = j.id
JOIN candidates c ON s.candidate_id = c.id
WHERE i.status NOT IN ('cancelled', 'completed', 'no_show');

-- 3. Create View for Client Offers with SECURITY INVOKER
CREATE VIEW client_offers_view 
WITH (security_invoker = true) AS
SELECT 
  o.id,
  o.status,
  o.created_at,
  o.submission_id,
  s.status as submission_status,
  s.job_id,
  j.client_id,
  j.title as job_title,
  c.full_name as candidate_name,
  c.id as candidate_id
FROM offers o
JOIN submissions s ON o.submission_id = s.id
JOIN jobs j ON s.job_id = j.id
JOIN candidates c ON s.candidate_id = c.id
WHERE o.status NOT IN ('cancelled', 'rejected');

-- Grant access
GRANT SELECT ON client_submissions_view TO authenticated;
GRANT SELECT ON client_interviews_view TO authenticated;
GRANT SELECT ON client_offers_view TO authenticated;
