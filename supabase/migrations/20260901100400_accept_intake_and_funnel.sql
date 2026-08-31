-- ============================================================================
-- Jobaufnahme-Links · Uebergang in jobs, Firmenschluessel, Funnel (5/6)
-- ----------------------------------------------------------------------------
-- BEFUND 1: createOrganization (src/hooks/useOrganization.ts:69) hat NULL
--   Aufrufer -- es gibt im ganzen Repo keinen Codepfad, der eine Organisation
--   anlegt ausser dem manuellen Knopf in TeamManagement.tsx:124-149. Fuer
--   jeden nach dem 10.07. registrierten Kunden ist jobs.organization_id NULL.
--   Das Transferziel eines Gast-Entwurfs existiert also noch gar nicht.
--
-- BEFUND 2: Es gibt keinen Firmenschluessel auf Kundenseite.
--   company_profiles haengt an user_id UNIQUE (ein Profil je Login, nicht je
--   Firma) und hat kein Domainfeld, nur "website" als Freitext; organizations
--   hat gar nichts. company_profiles.email_domains aus Migration
--   20260619140000 ist nicht angewandt. Die Frage "ist das schon unser Kunde?"
--   ist heute nicht beantwortbar.
--
-- BEFUND 3: funnel_metrics beginnt erst bei total_submissions und kennt
--   entity_type nur als ('job','client','recruiter','platform'). Ein Trichter
--   "Link geoeffnet -> Aufnahme begonnen -> verifiziert -> beauftragt" hat dort
--   keinen Platz.
--
-- ENTSCHEIDUNG: organizations bekommt primary_domain als normalisierten
--   Schluessel -- aber die Zuordnung eines Intakes zu einer bestehenden
--   Organisation bleibt eine ausdrueckliche Admin-Handlung. Eine
--   Domainuebereinstimmung vergibt NIEMALS automatisch Rechte: wer bei
--   acme.de eine Adresse hat, wuerde sonst per can_access_job()
--   Lesezugriff auf alle Stellen dieser Organisation bekommen.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) Firmenschluessel auf Kundenseite
-- ----------------------------------------------------------------------------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS primary_domain text;

-- Partiell unique: zwei Organisationen duerfen nicht dieselbe Domain fuehren,
-- aber die allermeisten Bestandszeilen haben gar keine.
CREATE UNIQUE INDEX IF NOT EXISTS organizations_primary_domain_key
  ON public.organizations (primary_domain) WHERE primary_domain IS NOT NULL;

COMMENT ON COLUMN public.organizations.primary_domain IS
  'Normalisierte Hauptdomain (kleingeschrieben, ohne Protokoll und www). '
  'Erkennungsmerkmal fuer Bestandskunden. Vergibt fuer sich genommen KEINE '
  'Rechte -- die Zuordnung eines Intakes ist eine Admin-Handlung.';

-- ----------------------------------------------------------------------------
-- 2) Der Uebergang Entwurf -> Job
-- ----------------------------------------------------------------------------
-- Atomar, weil hier vier Dinge zusammen passieren muessen: Organisation,
-- Job, Mandat und Entwurfsstatus. Ein halb ausgefuehrter Uebergang hinterliesse
-- einen Job ohne Vertrag oder einen Entwurf, der zweimal angenommen wird.
--
-- Der Feld-Mapper liegt bewusst NICHT hier, sondern in TypeScript
-- (src/lib/intakeMapping.ts), damit Dashboard-Studio und Gast-Aufnahme
-- exakt dieselbe Abbildung benutzen. Diese Funktion nimmt die fertige
-- Job-Zeile als jsonb entgegen.
--
-- HARTE REGEL (F.4): client_id wird ausschliesslich im INSERT-Pfad gesetzt,
-- niemals per UPDATE. Das Gegenteil davon ist der bestehende Fehler in
-- NeueStelleBar.tsx:51 / buildRecord, wo ein Entwurf beim Speichern still den
-- Besitzer wechselt.
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

  -- Die drei Vorbedingungen, die vor dem Job stehen. Sie sind schon per CHECK
  -- auf intake_drafts erzwungen; hier stehen sie noch einmal, weil ein
  -- Uebergang ohne sie ein Datenfehler waere, kein Bedienfehler.
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

  -- ---- Organisation: bestehende nutzen oder neu anlegen --------------------
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
      -- Nur setzen, wenn die Domain noch frei ist; sonst bleibt sie leer und
      -- der Admin entscheidet ueber die Zusammenfuehrung.
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

  -- ---- Der Job ------------------------------------------------------------
  -- client_id kommt hier und nur hier hinein.
  INSERT INTO public.jobs (
    client_id, organization_id, status,
    title, company_name, description, requirements,
    location, remote_type, employment_type, experience_level,
    salary_min, salary_max,
    day_rate_min, day_rate_max, contract_duration_months,
    utilization_days_per_week, extension_possible,
    skills, must_haves, nice_to_haves,
    briefing_notes, vacancy_reason, reports_to, hiring_urgency,
    onsite_days_required, intake_completeness,
    intake_payload, reveal_envelope, reveal_trigger,
    search_difficulty, target_companies, nogo_companies,
    visa_sponsorship, experience_min, experience_max,
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
    d.id, d.link_id, _mandate_id, 'guest_intake', d.owner_user_id
  )
  RETURNING id INTO v_job;

  -- ---- Strukturierte Skill-Anforderungen ----------------------------------
  -- Die Policy auf job_skill_requirements verlangt jobs.client_id = auth.uid();
  -- diese Funktion laeuft als SECURITY DEFINER und umgeht sie bewusst.
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

  -- ---- Mandat mit Job und Organisation verbinden ---------------------------
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

  -- ---- Entwurf abschliessen ------------------------------------------------
  UPDATE public.intake_drafts
     SET job_id          = v_job,
         organization_id = v_org,
         client_user_id  = _client_user_id,
         review_state    = 'accepted',
         accepted_at     = now(),
         accepted_by     = _admin_id,
         last_activity_at= now()
   WHERE id = _draft_id;

  -- ---- Spuren: Funnel und Audit -------------------------------------------
  INSERT INTO public.intake_link_events (link_id, draft_id, event_type, actor_user_id, meta)
  VALUES (d.link_id, d.id, 'accepted', _admin_id,
          jsonb_build_object('job_id', v_job, 'organization_id', v_org));

  -- activity_logs bekommt beim Approve/Reject heute gar keinen Eintrag.
  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id,
                                    organization_id, details)
  VALUES (_admin_id, 'intake_accepted', 'job', v_job, v_org,
          jsonb_build_object('draft_id', d.id, 'link_id', d.link_id,
                             'mandate_id', _mandate_id, 'organization_id', v_org));

  RETURN v_job;
END;
$fn$;

REVOKE ALL ON FUNCTION public.accept_intake_draft(uuid, uuid, uuid, uuid, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_intake_draft(uuid, uuid, uuid, uuid, jsonb, uuid) TO service_role;

COMMENT ON FUNCTION public.accept_intake_draft(uuid, uuid, uuid, uuid, jsonb, uuid) IS
  'Atomarer Uebergang Gast-Aufnahme -> jobs: Organisation sichern, Job anlegen '
  '(client_id ausschliesslich im INSERT), Skill-Anforderungen schreiben, Mandat '
  'verbinden, Entwurf schliessen, Funnel und activity_logs stempeln.';

-- ----------------------------------------------------------------------------
-- 3) Der Funnel
-- ----------------------------------------------------------------------------
-- Kein security_invoker (Hausregel aus LOVABLE_DB_PROMPTS.md:148-158); die
-- Rollenpruefung steht wie bei recruiter_jobs_view IN der View.
DROP VIEW IF EXISTS public.intake_link_funnel;
CREATE VIEW public.intake_link_funnel AS
SELECT
  l.id                AS link_id,
  l.label,
  l.link_type,
  l.campaign_key,
  l.source,
  l.owner_user_id,
  l.created_at,
  l.revoked_at,
  l.expires_at,
  l.uses_count,
  COUNT(DISTINCT e.anonymous_id) FILTER (WHERE e.event_type = 'link_opened')     AS opened,
  COUNT(DISTINCT e.draft_id)     FILTER (WHERE e.event_type = 'intake_started')  AS started,
  COUNT(DISTINCT e.draft_id)     FILTER (WHERE e.event_type = 'contact_provided')AS contacted,
  COUNT(DISTINCT e.draft_id)     FILTER (WHERE e.event_type = 'email_verified')  AS verified,
  COUNT(DISTINCT e.draft_id)     FILTER (WHERE e.event_type = 'intake_completed')AS completed,
  COUNT(DISTINCT e.draft_id)     FILTER (WHERE e.event_type = 'submitted')       AS submitted,
  COUNT(DISTINCT e.draft_id)     FILTER (WHERE e.event_type = 'accepted')        AS accepted,
  COUNT(DISTINCT e.draft_id)     FILTER (WHERE e.event_type = 'contract_signed') AS signed,
  COUNT(DISTINCT e.draft_id)     FILTER (WHERE e.event_type = 'published')       AS published,
  MAX(e.occurred_at)                                                             AS last_event_at
FROM public.intake_links l
LEFT JOIN public.intake_link_events e ON e.link_id = l.id
WHERE public.has_role(auth.uid(), 'admin')
GROUP BY l.id;

GRANT SELECT ON public.intake_link_funnel TO authenticated;

COMMENT ON VIEW public.intake_link_funnel IS
  'Trichter je Aufnahme-Link: Aufrufe, Starts, Kontaktaufnahmen, verifizierte '
  'Intakes, vollstaendige Aufnahmen, Beauftragungsanfragen, Annahmen, '
  'Unterschriften, Veroeffentlichungen. Rollenpruefung in der View.';

COMMIT;
