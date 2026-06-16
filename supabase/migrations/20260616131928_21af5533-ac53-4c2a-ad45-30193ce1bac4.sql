CREATE OR REPLACE VIEW public.client_candidate_view AS
SELECT
  s.id                          AS submission_id,
  s.candidate_id,
  s.job_id,
  j.client_id,
  s.status,
  s.stage,
  s.match_score,
  s.identity_unlocked,
  s.recruiter_notes,
  j.title                       AS job_title,
  j.industry                    AS job_industry,
  j.company_name                AS job_company_name,
  c.job_title                   AS candidate_role,
  c.seniority,
  c.skills,
  c.certifications,
  c.language_skills,
  c.industry_experience,
  c.target_roles,
  c.notice_period,
  c.availability_date,
  c.remote_preference,
  c.relocation_willing,
  c.remote_days_preferred,
  public.anon_region_broad(c.city)               AS region_broad,
  public.anon_experience_band(c.experience_years) AS experience_band,
  public.anon_salary_band(COALESCE(c.expected_salary, c.salary_expectation_max)) AS salary_band,
  CASE WHEN s.identity_unlocked THEN c.full_name        END AS full_name,
  CASE WHEN s.identity_unlocked THEN c.email            END AS email,
  CASE WHEN s.identity_unlocked THEN c.phone            END AS phone,
  CASE WHEN s.identity_unlocked THEN c.cv_url           END AS cv_url,
  CASE WHEN s.identity_unlocked THEN c.linkedin_url     END AS linkedin_url,
  CASE WHEN s.identity_unlocked THEN c.city             END AS city,
  CASE WHEN s.identity_unlocked THEN c.experience_years END AS experience_years,
  CASE
    WHEN s.identity_unlocked THEN c.cv_ai_summary
    ELSE public.scrub_identity_tokens(
           public.scrub_identity_tokens(c.cv_ai_summary, nm.toks, 'der Kandidat'),
           emp.toks, '[ein Unternehmen]')
  END AS cv_ai_summary,
  s.submitted_at
FROM submissions s
JOIN jobs j        ON j.id = s.job_id
JOIN candidates c  ON c.id = s.candidate_id
CROSS JOIN LATERAL (
  SELECT ARRAY[c.full_name] || ARRAY(
    SELECT p FROM unnest(string_to_array(COALESCE(c.full_name, ''), ' ')) p WHERE length(p) >= 3
  ) AS toks
) nm
CROSS JOIN LATERAL (
  SELECT ARRAY(
    SELECT DISTINCT x FROM (
      SELECT c.company AS x
      UNION
      SELECT ce.company_name FROM candidate_experiences ce WHERE ce.candidate_id = c.id
    ) q WHERE x IS NOT NULL AND length(btrim(x)) >= 3
  ) AS toks
) emp
WHERE j.client_id = auth.uid();

GRANT SELECT ON public.client_candidate_view TO authenticated;