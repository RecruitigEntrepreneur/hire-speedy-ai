ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS salary_months numeric;

COMMENT ON COLUMN public.jobs.salary_months IS
  'Auf wie viele Monatsgehaelter sich das Jahresfixum verteilt (12, 13, 13.5, 14). Firmenstandard, wird ab der zweiten Stelle desselben Kunden vererbt.';

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS contract_limitation text;

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_contract_limitation_check;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_contract_limitation_check
  CHECK (contract_limitation IS NULL
         OR contract_limitation IN ('unbefristet', 'befristet_mit_aussicht', 'befristet', 'projekt'));

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS contract_sent_digitally boolean;

COMMENT ON COLUMN public.jobs.contract_sent_digitally IS
  'Ob der Arbeitsvertrag digital versendet wird. Zusammen mit contract_creation_days die Antwort auf "wie schnell vom Ja zum Vertrag".';

COMMENT ON COLUMN public.jobs.contract_limitation IS
  'Befristung des Arbeitsvertrags. Getrennt von employment_type (Voll-/Teilzeit) und contract_type (Festanstellung vs. Contracting).';

DO $drop_age$
BEGIN
  EXECUTE 'ALTER TABLE public.jobs DROP COLUMN IF EXISTS team_avg_age';
EXCEPTION WHEN dependent_objects_still_exist OR feature_not_supported THEN
  RAISE WARNING 'team_avg_age konnte nicht geloescht werden (abhaengiges Objekt). Die Spalte wird ab jetzt nicht mehr befuellt -- parse-job-url fragt sie nicht mehr ab. Abhaengigkeit suchen und Spalte nachtraeglich loeschen.';
END
$drop_age$;

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
  j.day_rate_min, j.day_rate_max, j.contract_duration_months,
  j.utilization_days_per_week, j.extension_possible,
  j.vacancy_reason,
  j.reports_to,
  j.team_size,
  j.department_structure,
  j.task_focus,
  j.task_breakdown,
  j.must_have_criteria,
  j.trainable_skills,
  j.nice_to_have_criteria,
  j.decision_makers,
  j.success_profile,
  j.failure_profile,
  j.core_hours,
  j.overtime_policy,
  j.time_tracking_method,
  j.works_council,
  j.works_council_meeting_schedule,
  j.contract_creation_days,
  j.contract_sent_digitally,
  j.contract_limitation,
  j.contract_sensitive_topics,
  j.bonus_structure,
  j.salary_months,
  j.career_path,
  CASE WHEN rev.revealed THEN j.company_name    ELSE NULL END AS company_name,
  CASE WHEN rev.revealed THEN j.company_culture ELSE NULL END AS company_culture,
  CASE WHEN rev.revealed THEN j.description     ELSE NULL END AS description,
  CASE WHEN rev.revealed THEN j.requirements    ELSE NULL END AS requirements,
  CASE WHEN rev.revealed THEN j.daily_routine   ELSE NULL END AS daily_routine,
  CASE WHEN rev.revealed THEN j.career_example  ELSE NULL END AS career_example,
  CASE WHEN rev.revealed THEN j.unique_selling_points ELSE NULL END AS unique_selling_points,
  CASE WHEN rev.revealed THEN j.position_advantages   ELSE NULL END AS position_advantages,
  CASE WHEN rev.revealed THEN j.negative_impact_if_unfilled ELSE NULL END AS negative_impact_if_unfilled,
  CASE WHEN rev.revealed THEN j.industry_opportunities ELSE NULL END AS industry_opportunities,
  CASE WHEN rev.revealed THEN j.industry_challenges    ELSE NULL END AS industry_challenges,
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

COMMENT ON VIEW public.recruiter_jobs_view IS
  'Reveal-gated Job-Sicht fuer Recruiter. Identitaetstragende Spalten (client_id, office_address, office_lat/lng, briefing_notes, intake_briefing, intake_payload, draft_state) sind nicht enthalten. Die Felder des Briefing-Katalogs sind in zwei Klassen geteilt: was die ROLLE beschreibt ist ungated; was die FIRMA verraten wuerde erscheint erst nach company_revealed = true auf einer eigenen Submission.';