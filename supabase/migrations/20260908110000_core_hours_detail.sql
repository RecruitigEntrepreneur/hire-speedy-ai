-- ============================================================================
-- Die Uhrzeit hinter der Kernzeit
-- ============================================================================
-- BEFUND (09.09.2026, Testaufnahme "Senior Platform Engineer"): Die Anzeige
-- sagte "Gleitzeit mit Kernzeit 9 bis 15 Uhr". Der Katalog behielt davon
-- "Gleitzeit mit Kernzeit" -- die Kategorie -- und warf die Uhrzeit weg. Der
-- Recruiter konnte einem Kandidaten damit sagen, DASS es eine Kernzeit gibt,
-- aber nicht welche. Genau danach fragt aber jeder Kandidat.
--
-- `core_hours` bleibt die Kategorie (fuenf Chips, vergleichbar ueber alle
-- Stellen). Die Uhrzeit bekommt eine eigene Spalte, statt beides in einem
-- Textfeld zu vermischen: sonst waere "Gleitzeit mit Kernzeit" und
-- "Gleitzeit mit Kernzeit 9-15 Uhr" fuer jede Auswertung zweierlei.
--
-- Dasselbe Muster wie works_council -> works_council_meeting_schedule.
--
-- REIHENFOLGE: Diese Migration muss VOR 20260908120000 laufen. Jene
-- schreibt accept_intake_draft neu und nennt core_hours_detail in der
-- INSERT-Liste. plpgsql prueft Spaltennamen erst beim AUFRUF, nicht beim
-- Anlegen -- die falsche Reihenfolge liefe also sauber durch und liesse
-- danach jede Jobfreigabe scheitern. Deshalb der fruehere Zeitstempel.
-- ============================================================================

BEGIN;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS core_hours_detail text;

COMMENT ON COLUMN public.jobs.core_hours_detail IS
  'Die konkrete Uhrzeit zur Kategorie in core_hours ("09:00-15:00", '
  '"6-14 / 14-22 Uhr"). Wird nur erhoben, wenn core_hours eine Antwort traegt, '
  'zu der es ueberhaupt eine Uhrzeit gibt -- nicht bei Vertrauensarbeitszeit '
  'oder Gleitzeit ohne Kernzeit.';

-- ---------------------------------------------------------------------------
-- recruiter_jobs_view neu, mit der Spalte
-- ---------------------------------------------------------------------------
-- Basis ist unveraendert die Fassung aus 20260905090000; hinzu kommt eine
-- einzige Zeile. Die Klassenzuordnung bleibt: eine Uhrzeit beschreibt die
-- ROLLE und verraet kein Unternehmen, also ungated wie core_hours selbst.
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

  -- ---- Katalogfelder, SAFE: beschreiben die Rolle, nicht die Firma --------
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
  j.core_hours_detail,             -- neu: die Uhrzeit zur Kategorie
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

  -- ---- Reveal-gesperrt: identisch behandelt wie description/requirements --
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
  'Reveal-gated Job-Sicht fuer Recruiter. Identitaetstragende Spalten '
  '(client_id, office_address, office_lat/lng, briefing_notes, intake_briefing, '
  'intake_payload, draft_state) sind nicht enthalten. '
  'Die Felder des Briefing-Katalogs sind in zwei Klassen geteilt: was die ROLLE '
  'beschreibt (Vakanzgrund, Berichtsweg, Teamgroesse, die drei Muss-Kriterien, '
  'Nachschulbares, Erfolgs- und Misserfolgsprofil, Arbeitszeit samt konkreter '
  'Uhrzeit, Betriebsrat, Vertrag) ist ungated -- ohne diese Angaben kann der '
  'Recruiter kein Kandidatengespraech fuehren. Was die FIRMA verraten wuerde '
  '(company_name, company_culture, description, requirements, daily_routine, '
  'career_example, unique_selling_points, position_advantages, '
  'negative_impact_if_unfilled, industry_*) erscheint erst nach '
  'company_revealed = true auf einer eigenen Submission.';

COMMIT;
