-- ============================================================================
-- Recruiter sehen bei Contracting den Satz des Spezialisten (29.09.2026)
--
-- Befund: recruiter_jobs_view lieferte day_rate_min/max roh aus -- das Budget
-- des Kunden, alles inklusive (Vertragswerk v4, § 12 Abs. 4). Recruiter
-- nannten es Freelancern als Tagessatz; beim Spezialisten kommen aber nur
-- 78 % an, und die Marge (fee_percentage = 22) lag offen im View.
--
-- Entscheidung 29.09.2026: Recruiter sehen den Satz des Spezialisten,
-- abgerundet auf volle 10 EUR, und ihren Verdienst je Einsatztag. Budget und
-- Marge bleiben Innenseite. Festanstellung bleibt unveraendert.
--
-- View-Erweiterung wie 20260910120000: gleiche Spaltenreihenfolge und -typen,
-- gleicher Filter, gleiche Maskierung und Reveal-Regel; zwei Spalten angehaengt.
-- ============================================================================

BEGIN;

CREATE OR REPLACE VIEW public.recruiter_jobs_view AS
SELECT
  j.id, j.title, j.status, j.industry, j.location,
  j.remote_type, j.employment_type, j.experience_level,
  j.salary_min, j.salary_max,
  -- Contracting: die Marge ist Innenseite, auch gegenueber Recruitern. Der Cast
  -- haelt den Spaltentyp des Views (numeric(5,2)), sonst lehnt Postgres ab.
  (CASE WHEN j.employment_type = 'freelance' THEN NULL ELSE j.fee_percentage END)::numeric(5,2) AS fee_percentage,
  j.recruiter_fee_percentage,
  j.skills, j.must_haves, j.nice_to_haves, j.screening_questions,
  j.company_size_band, j.funding_stage, j.hiring_urgency, j.urgency,
  j.tech_environment, j.required_languages, j.required_certifications,
  j.onsite_required, j.onsite_days_required, j.remote_policy,
  j.benefits, j.deadline, j.created_at, j.updated_at,
  j.embedding,
  -- Contracting: Satz des Spezialisten statt Kundenbudget (all-in),
  -- abgerundet auf volle 10 EUR. Dieselbe Rechnung wie spezialistenTagessatz()
  -- in _shared/contracting-konditionen.ts.
  CASE WHEN j.employment_type = 'freelance'
       THEN (floor(j.day_rate_min * sp.anteil / 1000) * 10)::integer
       ELSE j.day_rate_min END AS day_rate_min,
  CASE WHEN j.employment_type = 'freelance'
       THEN (floor(j.day_rate_max * sp.anteil / 1000) * 10)::integer
       ELSE j.day_rate_max END AS day_rate_max,
  j.contract_duration_months,
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
  j.core_hours,
  j.core_hours_detail,
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

  public.maskiere(j.candidates_dropped_reason, j.reveal_envelope) AS candidates_dropped_reason,
  j.candidates_in_pipeline,

  public.maskiere(j.success_profile,   j.reveal_envelope) AS success_profile,
  public.maskiere(j.failure_profile,   j.reveal_envelope) AS failure_profile,
  public.maskiere(j.career_path,       j.reveal_envelope) AS career_path,
  public.maskiere(j.daily_routine,     j.reveal_envelope) AS daily_routine,
  public.maskiere(j.company_culture,   j.reveal_envelope) AS company_culture,
  public.maskiere(j.career_example,    j.reveal_envelope) AS career_example,
  public.maskiere(j.unique_selling_points, j.reveal_envelope) AS unique_selling_points,
  public.maskiere(j.position_advantages,   j.reveal_envelope) AS position_advantages,
  public.maskiere(j.negative_impact_if_unfilled, j.reveal_envelope) AS negative_impact_if_unfilled,
  public.maskiere(j.industry_opportunities, j.reveal_envelope) AS industry_opportunities,
  public.maskiere(j.industry_challenges,    j.reveal_envelope) AS industry_challenges,

  public.maskiere_json(j.formatted_content, j.reveal_envelope) AS formatted_content,
  public.maskiere_json(j.job_summary,       j.reveal_envelope) AS job_summary,

  CASE WHEN rev.revealed THEN j.company_name  ELSE NULL END AS company_name,
  CASE WHEN rev.revealed THEN j.description   ELSE NULL END AS description,
  CASE WHEN rev.revealed THEN j.requirements  ELSE NULL END AS requirements,

  COALESCE(rev.revealed, false) AS company_revealed,
  j.remote_days_flexible,
  -- Only these two role/process answers are projected. Never expose the full
  -- intake_payload. Narrative answers keep the existing company reveal gate.
  CASE WHEN rev.revealed THEN public.maskiere_json(
    jsonb_strip_nulls(jsonb_build_object(
      'deliverable_90d', j.intake_payload #> '{briefing_answers,deliverable_90d}',
      'interview_process', j.intake_payload #> '{briefing_answers,interview_process}'
    )), j.reveal_envelope
  ) ELSE NULL END AS recruiter_briefing_answers,
  CASE WHEN rev.revealed THEN j.company_headcount ELSE NULL END AS company_headcount,
  -- Neu (angehaengt): Verdienst des Recruiters je Einsatztag, gerechnet vom
  -- Tagessatz des Kunden -- den Recruiter selbst nicht mehr sehen.
  CASE WHEN j.employment_type = 'freelance'
       THEN round(j.day_rate_min * j.recruiter_fee_percentage / 100.0)::integer END AS recruiter_day_earning_min,
  CASE WHEN j.employment_type = 'freelance'
       THEN round(j.day_rate_max * j.recruiter_fee_percentage / 100.0)::integer END AS recruiter_day_earning_max
FROM jobs j
-- Anteil des Spezialisten: aus dem Preis-Snapshot des Contracting-Auftrags,
-- sonst die geltende Kondition (ANTEIL_SPEZIALIST = 78).
LEFT JOIN public.commercial_mandates cm
  ON cm.id = j.mandate_id AND cm.fee_basis = 'day_rate_all_in'
CROSS JOIN LATERAL (
  SELECT COALESCE((cm.pricing_snapshot ->> 'specialistPct')::numeric, 78) AS anteil
) sp
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

COMMENT ON VIEW public.recruiter_jobs_view IS
  'Recruiter-only published jobs with masked briefing fields. Additional 90-day '
  'and interview answers are allowlisted and revealed only after company opt-in. '
  'No raw intake payload, client identifier or private draft is exposed. '
  'Contracting: day_rate_min/max are the specialist rate (all-in budget x '
  'specialist share, floored to 10 EUR); fee_percentage is hidden; '
  'recruiter_day_earning_min/max is the recruiter share per working day.';

COMMIT;