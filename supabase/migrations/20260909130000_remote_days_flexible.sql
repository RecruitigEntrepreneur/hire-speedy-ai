-- ============================================================================
-- "Frei waehlbar" ist keine Null
-- ============================================================================
-- BEFUND (09.09.2026): Der Chip "frei waehlbar" bei den Homeoffice-Tagen legte
-- die 5 ab. Daraus wurde onsite_days_required = 0, und der Recruiter las "null
-- Tage vor Ort" -- also eine Vollremote-Stelle. "Frei waehlbar" heisst aber,
-- dass der KANDIDAT entscheidet. Zwei verschiedene Sachverhalte lagen auf
-- demselben Speicherwert, und der falsche davon stand in der Eckdatenleiste.
--
-- Dazu endeten die Chips bei 3: eine echte Vollremote-Stelle hatte gar keinen.
-- Der Katalog fuehrt jetzt 0 bis 5, und "frei waehlbar" traegt keine Zahl mehr
-- -- die Auskunft geht ueber diese Spalte raus.
--
-- Ungated: ob der Kandidat seine Homeoffice-Tage selbst waehlt, beschreibt die
-- Rolle und verraet kein Unternehmen.
-- ============================================================================

BEGIN;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS remote_days_flexible boolean;

COMMENT ON COLUMN public.jobs.remote_days_flexible IS
  'Der Kandidat waehlt seine Homeoffice-Tage selbst. Schliesst sich mit einer '
  'festen Zahl in onsite_days_required aus: entweder es gibt eine Vorgabe oder '
  'es gibt keine.';

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
  j.remote_days_flexible,          -- der Kandidat entscheidet selbst
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
  -- Neu: die genaue Kopfzahl. Vor dem Reveal traegt company_size_band die
  -- Auskunft, danach steht die Zahl daneben.
  CASE WHEN rev.revealed THEN j.company_headcount ELSE NULL END AS company_headcount,

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
  'negative_impact_if_unfilled, industry_*, company_headcount) erscheint erst '
  'nach company_revealed = true auf einer eigenen Submission. Die '
  'Groessenklasse company_size_band bleibt ungated und ist der grobe Ersatz '
  'fuer die gesperrte Kopfzahl.';

-- ---------------------------------------------------------------------------
-- accept_intake_draft nimmt die Spalte an
-- ---------------------------------------------------------------------------
-- Dieselbe Fassung wie 20260909120000, ergaenzt um remote_days_flexible.
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
  'Nimmt eine Beauftragungsanfrage an und erzeugt die Stelle. Seit 2026-09-08 '
  'traegt der INSERT auch die 35 Spalten des Fragenkatalogs. Vorher hatte die '
  'Funktion eine fest verdrahtete Liste, die alles andere aus _job still '
  'verwarf -- jede Antwort des Kunden im Katalog ging beim Anlegen verloren. '
  'Die Gegenseite steht in supabase/functions/_shared/brief-columns.ts, '
  'gegen den Katalog abgesichert durch src/lib/briefColumns.test.ts.';

COMMIT;
