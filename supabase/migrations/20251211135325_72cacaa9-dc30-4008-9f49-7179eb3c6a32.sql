-- =============================================
-- FIX CRITICAL SECURITY ISSUES
-- =============================================

-- 1. DROP the insecure offers policy
DROP POLICY IF EXISTS "Public can view offers by token" ON public.offers;

-- 2. DROP insecure organization_invites policy (also found in DB)
DROP POLICY IF EXISTS "Anyone can view invite by token" ON public.organization_invites;

-- 3. DROP insecure reference_requests policy (also found in DB)
DROP POLICY IF EXISTS "Anyone can view request by token" ON public.reference_requests;

-- 4. Handle candidate_job_overview - it's a VIEW, not a table
-- Views don't support RLS directly. We need to drop and recreate with security_invoker
-- First check if it's a view and recreate it with SECURITY INVOKER
DROP VIEW IF EXISTS public.candidate_job_overview;

-- Recreate the view with security_invoker = true so it respects RLS of underlying tables
CREATE VIEW public.candidate_job_overview
WITH (security_invoker = true)
AS
SELECT 
  c.id as candidate_id,
  c.full_name,
  c.email,
  c.preferred_channel,
  c.recruiter_id,
  COUNT(s.id) as total_submissions,
  COUNT(s.id) FILTER (WHERE s.status NOT IN ('rejected', 'withdrawn', 'placed')) as active_submissions,
  json_agg(
    json_build_object(
      'job_id', j.id,
      'job_title', j.title,
      'company_name', j.company_name,
      'status', s.status,
      'submitted_at', s.submitted_at
    )
  ) FILTER (WHERE j.id IS NOT NULL) as jobs
FROM candidates c
LEFT JOIN submissions s ON s.candidate_id = c.id
LEFT JOIN jobs j ON j.id = s.job_id
GROUP BY c.id, c.full_name, c.email, c.preferred_channel, c.recruiter_id;