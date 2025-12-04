-- Fix Security Definer View by recreating with SECURITY INVOKER
DROP VIEW IF EXISTS public.candidate_rankings;

CREATE VIEW public.candidate_rankings 
WITH (security_invoker = on)
AS
SELECT 
  s.id AS submission_id,
  s.job_id,
  s.candidate_id,
  s.status,
  c.full_name,
  s.match_score,
  cb.confidence_score,
  cb.interview_readiness_score,
  cb.closing_probability,
  cb.engagement_level,
  ROUND(
    (COALESCE(s.match_score, 50) * 0.3 +
     COALESCE(cb.confidence_score, 50) * 0.25 +
     COALESCE(cb.interview_readiness_score, 50) * 0.2 +
     COALESCE(cb.closing_probability, 50) * 0.25)::numeric
  ) AS overall_rank_score,
  RANK() OVER (
    PARTITION BY s.job_id 
    ORDER BY (
      COALESCE(s.match_score, 50) * 0.3 +
      COALESCE(cb.confidence_score, 50) * 0.25 +
      COALESCE(cb.interview_readiness_score, 50) * 0.2 +
      COALESCE(cb.closing_probability, 50) * 0.25
    ) DESC
  ) AS rank_position
FROM public.submissions s
JOIN public.candidates c ON c.id = s.candidate_id
LEFT JOIN public.candidate_behavior cb ON cb.submission_id = s.id
WHERE s.status NOT IN ('rejected', 'withdrawn');