BEGIN;

CREATE OR REPLACE FUNCTION public.maskiere(_text text, _envelope jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $fn$
DECLARE
  MARKE   constant text := '[anonymisiert]';
  begriff text;
  aus     text := _text;
  p       integer;
  runden  integer;
BEGIN
  IF _text IS NULL OR btrim(_text) = '' THEN RETURN _text; END IF;
  IF _envelope IS NULL OR jsonb_typeof(_envelope -> 'red_list') <> 'array' THEN
    RETURN _text;
  END IF;

  FOR begriff IN
    SELECT btrim(x)
      FROM jsonb_array_elements_text(_envelope -> 'red_list') AS t(x)
     ORDER BY length(btrim(x)) DESC
     LIMIT 50
  LOOP
    CONTINUE WHEN begriff IS NULL OR length(begriff) < 3;
    CONTINUE WHEN position(lower(begriff) IN lower(MARKE)) > 0;

    runden := 0;
    LOOP
      p := position(lower(begriff) IN lower(aus));
      EXIT WHEN p = 0;
      aus := left(aus, p - 1) || MARKE || substr(aus, p + length(begriff));
      runden := runden + 1;
      EXIT WHEN runden > 100;
    END LOOP;
  END LOOP;

  RETURN aus;
END
$fn$;

COMMENT ON FUNCTION public.maskiere(text, jsonb) IS
  'Ersetzt die in reveal_envelope.red_list genannten Begriffe durch '
  '"[anonymisiert]". Literal und ohne Ruecksicht auf Gross-/Kleinschreibung. '
  'Die Liste stammt aus der Aufnahme: die KI benennt dort, was die Firma '
  'verraten wuerde.';

CREATE OR REPLACE FUNCTION public.maskiere(_werte text[], _envelope jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  SELECT CASE
    WHEN _werte IS NULL THEN NULL
    ELSE ARRAY(SELECT public.maskiere(x, _envelope) FROM unnest(_werte) AS t(x))
  END;
$fn$;

CREATE OR REPLACE FUNCTION public.maskiere_json(_wert jsonb, _envelope jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $fn$
DECLARE
  roh text;
BEGIN
  IF _wert IS NULL THEN RETURN NULL; END IF;
  roh := public.maskiere(_wert::text, _envelope);
  RETURN roh::jsonb;
EXCEPTION WHEN others THEN
  RAISE WARNING '[maskiere_json] nicht zurueckgewandelt, Feld wird geleert';
  RETURN NULL;
END
$fn$;

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
  'Was ein Recruiter von einer veroeffentlichten Stelle sieht. Seit dem '
  '09.09.2026 wird maskiert statt gesperrt: die in reveal_envelope.red_list '
  'genannten Begriffe werden ersetzt, dafuer sind Arbeitsalltag, '
  'Alleinstellungsmerkmale, Kultur und Karrierebeispiel sichtbar -- der '
  'Headhunter kann die Stelle sonst nicht beschreiben. Hinter dem Reveal '
  'bleiben nur der Firmenname und die Originalanzeige. Die KI-Texte laufen '
  'ebenfalls durch die Maskierung: sie entstehen aus den Rohwerten und waren '
  'vorher der offene Weg an der Sperre vorbei.';

COMMIT;