DROP VIEW IF EXISTS public.recruiter_jobs_view;

CREATE VIEW public.recruiter_jobs_view AS
SELECT
  j.id, j.title, j.status, j.industry, j.location,
  j.remote_type, j.employment_type, j.experience_level,
  j.salary_min, j.salary_max, j.fee_percentage, j.recruiter_fee_percentage,
  j.skills, j.must_haves, j.nice_to_haves, j.screening_questions,
  j.company_size_band, j.funding_stage, j.hiring_urgency, j.urgency,
  j.tech_environment, j.required_languages, j.required_certifications,
  j.onsite_required, j.onsite_days_required, j.remote_policy,
  j.benefits, j.deadline, j.created_at, j.updated_at,
  j.formatted_content, j.job_summary,
  j.embedding,
  CASE WHEN rev.revealed THEN j.company_name    ELSE NULL END AS company_name,
  CASE WHEN rev.revealed THEN j.company_culture ELSE NULL END AS company_culture,
  CASE WHEN rev.revealed THEN j.description     ELSE NULL END AS description,
  CASE WHEN rev.revealed THEN j.requirements    ELSE NULL END AS requirements,
  COALESCE(rev.revealed, false) AS company_revealed
FROM jobs j
LEFT JOIN LATERAL (
  SELECT true AS revealed
  FROM submissions s
  WHERE s.job_id = j.id
    AND s.recruiter_id = auth.uid()
    AND s.company_revealed = true
  LIMIT 1
) rev ON true
WHERE public.has_role(auth.uid(), 'recruiter')
  AND j.status = 'published';

GRANT SELECT ON public.recruiter_jobs_view TO authenticated;