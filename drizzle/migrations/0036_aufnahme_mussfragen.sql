-- Sieben Muss-Fragen der Aufnahme (20.10.2026).
--
-- Gehaltsspielraum, längste abwartbare Kündigungsfrist, Arbeitserlaubnis/Visum,
-- Abwerbeschutz, Zielfirmen, Auswahlprozess und die Einwände von Kandidaten
-- samt Antwort des Kunden. Die alte Aufnahme fragte die meisten davon; seit dem
-- Fragenkatalog (src/lib/briefCatalog.ts) fehlten sie, und der Headhunter sah
-- sie nie. Visum, Zielfirmen und Abwerbeschutz haben schon Spalten (seit der
-- alten Aufnahme), die übrigen fünf kommen hier dazu.
--
-- Drei Stellen müssen mitziehen:
--   1. jobs: die fünf neuen Spalten
--   2. accept_intake_draft: die RPC hat eine FEST VERDRAHTETE Spaltenliste und
--      verwirft alles andere still (siehe 20260908120000_catalog_reaches_jobs)
--   3. recruiter_jobs_view: Spalten hinten angehängt (CREATE OR REPLACE VIEW
--      erlaubt nur das). Grundlage ist die Fassung aus 20261019170000_firmenlogo,
--      deshalb MUSS jene Migration vorher laufen.
-- Mehrfach ausführbar.

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS salary_flex text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS max_notice_period text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS interview_process text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS candidate_concerns text[];
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS candidate_concerns_answer text;

COMMENT ON COLUMN public.jobs.salary_flex IS 'Aufnahme: Spielraum über die Gehaltsrange für den richtigen Kandidaten (Chip-Text).';
COMMENT ON COLUMN public.jobs.max_notice_period IS 'Aufnahme: längste Kündigungsfrist, die der Kunde abwarten kann (Chip-Text).';
COMMENT ON COLUMN public.jobs.interview_process IS 'Aufnahme: Ablauf der Auswahl in Worten des Kunden.';
COMMENT ON COLUMN public.jobs.candidate_concerns IS 'Aufnahme: was Kandidaten an der Stelle kritisch sehen. Nur für Headhunter nach dem Reveal.';
COMMENT ON COLUMN public.jobs.candidate_concerns_answer IS 'Aufnahme: Antwort des Kunden auf diese Einwände. Nur für Headhunter nach dem Reveal.';

-- ---------------------------------------------------------------------------
-- accept_intake_draft nimmt die Spalten an
-- ---------------------------------------------------------------------------
-- Dieselbe Fassung wie 20260909130000, ergänzt um die fünf neuen Spalten.
CREATE OR REPLACE FUNCTION public.accept_intake_draft(
  _draft_id        uuid,
  _admin_id        uuid,
  _client_user_id  uuid,
  _organization_id uuid,
  _job             jsonb,
  _mandate_id      uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  d       public.intake_drafts%ROWTYPE;
  v_org   uuid := _organization_id;
  v_job   uuid;
  v_name  text;
BEGIN
  SELECT * INTO d FROM public.intake_drafts WHERE id = _draft_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aufnahme % nicht gefunden.', _draft_id USING ERRCODE = 'no_data_found';
  END IF;

  IF d.job_id IS NOT NULL THEN
    RAISE EXCEPTION 'Aufnahme % wurde bereits angenommen (Job %).', _draft_id, d.job_id
      USING ERRCODE = 'unique_violation';
  END IF;

  IF d.review_state <> 'pending_admin' THEN
    RAISE EXCEPTION 'Aufnahme % steht auf "%" statt "pending_admin".', _draft_id, d.review_state
      USING ERRCODE = 'check_violation';
  END IF;
  IF d.capture_state <> 'complete' OR d.identity_state <> 'email_verified' THEN
    RAISE EXCEPTION 'Aufnahme % ist nicht vollstaendig oder die E-Mail ist nicht verifiziert.', _draft_id
      USING ERRCODE = 'check_violation';
  END IF;
  IF _client_user_id IS NULL THEN
    RAISE EXCEPTION 'Fuer die Annahme wird ein Kundenkonto benoetigt.'
      USING ERRCODE = 'not_null_violation';
  END IF;

  IF v_org IS NULL THEN
    SELECT o.id INTO v_org
      FROM public.organizations o
     WHERE o.owner_id = _client_user_id AND o.type = 'client'
     ORDER BY o.created_at
     LIMIT 1;
  END IF;

  IF v_org IS NULL THEN
    v_name := NULLIF(btrim(COALESCE(d.company_legal_name, d.company_name, '')), '');
    INSERT INTO public.organizations (name, type, owner_id, primary_domain)
    VALUES (
      COALESCE(v_name, 'Unbenanntes Unternehmen'),
      'client',
      _client_user_id,
      CASE WHEN d.company_domain IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM public.organizations o2
                              WHERE o2.primary_domain = d.company_domain)
           THEN d.company_domain END
    )
    RETURNING id INTO v_org;

    INSERT INTO public.organization_members (organization_id, user_id, role, status)
    VALUES (v_org, _client_user_id, 'owner', 'active')
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.jobs (
    client_id, organization_id, status,
    title, company_name, description, requirements,
    location, remote_type, employment_type, experience_level,
    salary_min, salary_max,
    day_rate_min, day_rate_max, contract_duration_months,
    utilization_days_per_week, extension_possible,
    skills, must_haves, nice_to_haves,
    benefits, industry, required_languages, required_certifications, onsite_required,
    briefing_notes, vacancy_reason, reports_to, hiring_urgency,
    onsite_days_required, intake_completeness,
    intake_payload, reveal_envelope, reveal_trigger,
    search_difficulty, target_companies, nogo_companies,
    visa_sponsorship, experience_min, experience_max,
    -- Fragenkatalog (08.09.2026): 32 Spalten, die der Kunde beantwortet
    -- hat und die bisher im Entwurf liegen blieben. `core_hours_detail` kam
    -- am 09.09.2026 dazu; die Spalte legt 20260908110000 an, die deshalb
    -- ZUERST laufen muss. War diese Datei zu dem Zeitpunkt schon angewandt,
    -- fehlt die Spalte in der RPC und die Uhrzeit bleibt im Entwurf liegen --
    -- dann muss die Funktion in einer eigenen Migration neu geschrieben
    -- werden.
    salary_months, bonus_structure, contract_limitation,
    core_hours, core_hours_detail, overtime_policy, time_tracking_method,
    works_council_meeting_schedule, negative_impact_if_unfilled, daily_routine,
    task_focus, success_profile, failure_profile,
    company_culture, career_path, career_example,
    contract_sensitive_topics, industry_opportunities, industry_challenges,
    company_size_band, company_headcount, candidates_dropped_reason, team_size,
    contract_creation_days, candidates_in_pipeline, works_council,
    contract_sent_digitally, remote_days_flexible,
    must_have_criteria, trainable_skills,
    nice_to_have_criteria,
    decision_makers, unique_selling_points, position_advantages,
    task_breakdown,
    -- Muss-Fragen der Aufnahme (20.10.2026)
    salary_flex, max_notice_period, interview_process,
    candidate_concerns, candidate_concerns_answer,
    intake_draft_id, intake_link_id, mandate_id, source, owner_user_id
  )
  VALUES (
    _client_user_id, v_org, 'pending_approval',
    COALESCE(NULLIF(_job->>'title', ''), COALESCE(d.title, 'Unbenannte Position')),
    COALESCE(NULLIF(_job->>'company_name', ''), COALESCE(d.company_name, 'Unbenanntes Unternehmen')),
    NULLIF(_job->>'description', ''),
    NULLIF(_job->>'requirements', ''),
    NULLIF(_job->>'location', ''),
    COALESCE(NULLIF(_job->>'remote_type', ''), 'hybrid'),
    COALESCE(NULLIF(_job->>'employment_type', ''), d.contract_type),
    COALESCE(NULLIF(_job->>'experience_level', ''), 'mid'),
    (_job->>'salary_min')::integer,
    (_job->>'salary_max')::integer,
    (_job->>'day_rate_min')::integer,
    (_job->>'day_rate_max')::integer,
    (_job->>'contract_duration_months')::integer,
    (_job->>'utilization_days_per_week')::integer,
    (_job->>'extension_possible')::boolean,
    CASE WHEN _job ? 'skills'        THEN ARRAY(SELECT jsonb_array_elements_text(_job->'skills'))        END,
    CASE WHEN _job ? 'must_haves'    THEN ARRAY(SELECT jsonb_array_elements_text(_job->'must_haves'))    END,
    CASE WHEN _job ? 'nice_to_haves' THEN ARRAY(SELECT jsonb_array_elements_text(_job->'nice_to_haves')) END,
    CASE WHEN _job ? 'benefits'      THEN ARRAY(SELECT jsonb_array_elements_text(_job->'benefits'))      END,
    NULLIF(_job->>'industry', ''),
    _job->'required_languages',
    CASE WHEN _job ? 'required_certifications'
         THEN ARRAY(SELECT jsonb_array_elements_text(_job->'required_certifications')) END,
    (_job->>'onsite_required')::boolean,
    NULLIF(_job->>'briefing_notes', ''),
    NULLIF(_job->>'vacancy_reason', ''),
    NULLIF(_job->>'reports_to', ''),
    NULLIF(_job->>'hiring_urgency', ''),
    (_job->>'onsite_days_required')::integer,
    COALESCE((_job->>'intake_completeness')::integer, d.completeness),
    COALESCE(_job->'intake_payload', d.intake_payload),
    _job->'reveal_envelope',
    COALESCE(NULLIF(_job->>'reveal_trigger', ''), 'after_first_interview'),
    NULLIF(_job->>'search_difficulty', ''),
    CASE WHEN _job ? 'target_companies' THEN ARRAY(SELECT jsonb_array_elements_text(_job->'target_companies')) END,
    CASE WHEN _job ? 'nogo_companies'   THEN ARRAY(SELECT jsonb_array_elements_text(_job->'nogo_companies'))   END,
    (_job->>'visa_sponsorship')::boolean,
    (_job->>'experience_min')::integer,
    (_job->>'experience_max')::integer,
    (_job->>'salary_months')::numeric,
    NULLIF(_job->>'bonus_structure', ''),
    NULLIF(_job->>'contract_limitation', ''),
    NULLIF(_job->>'core_hours', ''),
    NULLIF(_job->>'core_hours_detail', ''),
    NULLIF(_job->>'overtime_policy', ''),
    NULLIF(_job->>'time_tracking_method', ''),
    NULLIF(_job->>'works_council_meeting_schedule', ''),
    NULLIF(_job->>'negative_impact_if_unfilled', ''),
    NULLIF(_job->>'daily_routine', ''),
    NULLIF(_job->>'task_focus', ''),
    NULLIF(_job->>'success_profile', ''),
    NULLIF(_job->>'failure_profile', ''),
    NULLIF(_job->>'company_culture', ''),
    NULLIF(_job->>'career_path', ''),
    NULLIF(_job->>'career_example', ''),
    NULLIF(_job->>'contract_sensitive_topics', ''),
    NULLIF(_job->>'industry_opportunities', ''),
    NULLIF(_job->>'industry_challenges', ''),
    NULLIF(_job->>'company_size_band', ''),
    (_job->>'company_headcount')::numeric::integer,
    NULLIF(_job->>'candidates_dropped_reason', ''),
    (_job->>'team_size')::numeric::integer,
    (_job->>'contract_creation_days')::numeric::integer,
    (_job->>'candidates_in_pipeline')::numeric::integer,
    (_job->>'works_council')::boolean,
    (_job->>'contract_sent_digitally')::boolean,
    (_job->>'remote_days_flexible')::boolean,
    CASE WHEN _job ? 'must_have_criteria'
         THEN ARRAY(SELECT jsonb_array_elements_text(_job->'must_have_criteria')) END,
    CASE WHEN _job ? 'trainable_skills'
         THEN ARRAY(SELECT jsonb_array_elements_text(_job->'trainable_skills')) END,
    CASE WHEN _job ? 'nice_to_have_criteria'
         THEN ARRAY(SELECT jsonb_array_elements_text(_job->'nice_to_have_criteria')) END,
    CASE WHEN _job ? 'decision_makers'
         THEN ARRAY(SELECT jsonb_array_elements_text(_job->'decision_makers')) END,
    CASE WHEN _job ? 'unique_selling_points'
         THEN ARRAY(SELECT jsonb_array_elements_text(_job->'unique_selling_points')) END,
    CASE WHEN _job ? 'position_advantages'
         THEN ARRAY(SELECT jsonb_array_elements_text(_job->'position_advantages')) END,
    _job->'task_breakdown',
    NULLIF(_job->>'salary_flex', ''),
    NULLIF(_job->>'max_notice_period', ''),
    NULLIF(_job->>'interview_process', ''),
    CASE WHEN _job ? 'candidate_concerns'
         THEN ARRAY(SELECT jsonb_array_elements_text(_job->'candidate_concerns')) END,
    NULLIF(_job->>'candidate_concerns_answer', ''),
    d.id, d.link_id, _mandate_id, 'guest_intake', d.owner_user_id
  )
  RETURNING id INTO v_job;

  IF d.skill_requirements IS NOT NULL AND jsonb_typeof(d.skill_requirements) = 'array' THEN
    INSERT INTO public.job_skill_requirements
      (job_id, skill_name, type, weight, min_years, min_proficiency)
    SELECT DISTINCT ON (lower(s->>'skill'))
           v_job,
           btrim(s->>'skill'),
           COALESCE(NULLIF(s->>'kind', ''), 'nice'),
           CASE WHEN s->>'kind' = 'must' THEN 1.0 ELSE 0.5 END,
           NULLIF(s->>'min_years', '')::integer,
           NULLIF(s->>'proficiency', '')
      FROM jsonb_array_elements(d.skill_requirements) s
     WHERE COALESCE(btrim(s->>'skill'), '') <> ''
     ORDER BY lower(s->>'skill'), (s->>'kind' = 'must') DESC
    ON CONFLICT (job_id, skill_name) DO NOTHING;
  END IF;

  IF _mandate_id IS NOT NULL THEN
    UPDATE public.commercial_mandates
       SET job_id          = v_job,
           organization_id = v_org,
           client_user_id  = _client_user_id,
           status          = CASE WHEN status = 'client_confirmed' THEN 'accepted' ELSE status END,
           accepted_at     = COALESCE(accepted_at, now()),
           accepted_by     = COALESCE(accepted_by, _admin_id),
           signature_status = CASE
             WHEN signature_status = 'not_required'
              AND EXISTS (SELECT 1 FROM public.commercial_terms_templates t
                           WHERE t.id = commercial_mandates.template_id AND t.requires_signature)
             THEN 'pending'
             ELSE signature_status END
     WHERE id = _mandate_id;
  END IF;

  UPDATE public.intake_drafts
     SET job_id          = v_job,
         organization_id = v_org,
         client_user_id  = _client_user_id,
         review_state    = 'accepted',
         accepted_at     = now(),
         accepted_by     = _admin_id,
         last_activity_at= now()
   WHERE id = _draft_id;

  INSERT INTO public.intake_link_events (link_id, draft_id, event_type, actor_user_id, meta)
  VALUES (d.link_id, d.id, 'accepted', _admin_id,
          jsonb_build_object('job_id', v_job, 'organization_id', v_org));

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id,
                                    organization_id, details)
  VALUES (_admin_id, 'intake_accepted', 'job', v_job, v_org,
          jsonb_build_object('draft_id', d.id, 'link_id', d.link_id,
                             'mandate_id', _mandate_id, 'organization_id', v_org));

  RETURN v_job;
END;
$fn$;

COMMENT ON FUNCTION public.accept_intake_draft(uuid, uuid, uuid, uuid, jsonb, uuid) IS
  'Nimmt eine Beauftragungsanfrage an und erzeugt die Stelle. Der INSERT trägt die Spalten des '
  'Fragenkatalogs (seit 2026-09-08) und seit 2026-10-20 auch die sieben Muss-Fragen. Die Gegenseite '
  'steht in supabase/functions/_shared/brief-columns.ts, gegen den Katalog abgesichert durch '
  'src/lib/briefColumns.test.ts.';

-- ---------------------------------------------------------------------------
-- recruiter_jobs_view: die neuen Antworten für den Headhunter
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.recruiter_jobs_view AS
SELECT
  j.id, j.title, j.status, j.industry, j.location,
  j.remote_type, j.employment_type, j.experience_level,
  j.salary_min, j.salary_max,
  (CASE WHEN j.employment_type = 'freelance' THEN NULL ELSE j.fee_percentage END)::numeric(5,2) AS fee_percentage,
  j.recruiter_fee_percentage,
  j.skills, j.must_haves, j.nice_to_haves, j.screening_questions,
  j.company_size_band, j.funding_stage, j.hiring_urgency, j.urgency,
  j.tech_environment, j.required_languages, j.required_certifications,
  j.onsite_required, j.onsite_days_required, j.remote_policy,
  j.benefits, j.deadline, j.created_at, j.updated_at,
  j.embedding,
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
  CASE WHEN rev.revealed THEN public.maskiere_json(
    jsonb_strip_nulls(jsonb_build_object(
      'deliverable_90d', j.intake_payload #> '{briefing_answers,deliverable_90d}',
      'interview_process', j.intake_payload #> '{briefing_answers,interview_process}'
    )), j.reveal_envelope
  ) ELSE NULL END AS recruiter_briefing_answers,
  CASE WHEN rev.revealed THEN j.company_headcount ELSE NULL END AS company_headcount,
  CASE WHEN j.employment_type = 'freelance'
       THEN round(j.day_rate_min * j.recruiter_fee_percentage / 100.0)::integer END AS recruiter_day_earning_min,
  CASE WHEN j.employment_type = 'freelance'
       THEN round(j.day_rate_max * j.recruiter_fee_percentage / 100.0)::integer END AS recruiter_day_earning_max,
  -- Neu (angehängt)
  j.paused_at,
  CASE WHEN j.paused_at IS NOT NULL THEN j.pause_until END AS pause_until,
  CASE WHEN j.paused_at IS NOT NULL THEN j.pause_reason END AS pause_reason,
  j.confidential_search,
  -- Neu (19.10.2026, angehängt): Firmenlogo wie der Name erst nach dem Reveal.
  CASE WHEN rev.revealed THEN cc.logo_url END AS company_logo_url,
  -- Neu (20.10.2026, angehängt): die sieben Muss-Fragen der Aufnahme.
  -- Gehalt, Frist, Visum und Ablauf sind ohne Firmenbezug; Zielfirmen,
  -- Abwerbeschutz und Einwände verraten den Kunden und kommen erst nach dem Reveal.
  j.salary_flex,
  j.max_notice_period,
  j.visa_sponsorship,
  public.maskiere(j.interview_process, j.reveal_envelope) AS interview_process,
  CASE WHEN rev.revealed THEN j.target_companies END AS target_companies,
  CASE WHEN rev.revealed THEN j.nogo_companies END AS nogo_companies,
  CASE WHEN rev.revealed THEN j.candidate_concerns END AS candidate_concerns,
  CASE WHEN rev.revealed THEN public.maskiere(j.candidate_concerns_answer, j.reveal_envelope) END AS candidate_concerns_answer
FROM jobs j
LEFT JOIN public.client_companies cc ON cc.id = j.company_id
LEFT JOIN public.commercial_mandates cm
  ON cm.id = j.mandate_id AND cm.fee_basis = 'day_rate_all_in'
CROSS JOIN LATERAL (
  SELECT COALESCE((cm.pricing_snapshot ->> 'specialistPct')::numeric, 78) AS anteil
) sp
-- Firmenname ab „Ich suche“ (Aktivierung mit Protokoll) oder wie bisher nach Opt-in.
CROSS JOIN LATERAL (
  SELECT (
    EXISTS (SELECT 1 FROM recruiter_job_activations a
             WHERE a.job_id = j.id AND a.recruiter_id = auth.uid() AND a.company_revealed_at IS NOT NULL)
    OR EXISTS (SELECT 1 FROM submissions s
                WHERE s.job_id = j.id AND s.recruiter_id = auth.uid() AND s.company_revealed = true)
  ) AS revealed
) rev
WHERE public.has_role(auth.uid(), 'recruiter')
  AND j.status = 'published'
  AND (
    NOT j.confidential_search
    OR EXISTS (SELECT 1 FROM recruiter_partner_status ps
                WHERE ps.user_id = auth.uid() AND ps.ended_at IS NULL AND ps.tier = 'gold')
    OR EXISTS (SELECT 1 FROM recruiter_job_activations a WHERE a.job_id = j.id AND a.recruiter_id = auth.uid())
  );;

COMMENT ON VIEW public.recruiter_jobs_view IS
  'Recruiter-only published jobs with masked briefing fields. Company name, logo and raw texts are revealed '
  'from „Ich suche“ (activation with company_revealed_at) or after opt-in. Paused jobs stay visible with '
  'paused_at/pause_until. Confidential searches are visible to Gold Partners only. No raw intake payload, '
  'client identifier or private draft is exposed.';
