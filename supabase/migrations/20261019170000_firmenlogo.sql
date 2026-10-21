-- ============================================================================
-- Firmenlogo je Firma (19.10.2026)
--
-- Das Logo gehört zur Firma (client_companies), nicht zum Konto: Tochterfirmen
-- haben eigene Logos, und Stellen hängen seit 20261015100000 an einer Firma.
-- Es kommt aus zwei Quellen:
--   upload  – der Kunde (oder Matchunt) hat es hochgeladen; gilt immer zuerst
--   website – die Function firmenlogo-holen hat es von der Website geholt und
--             in den Bucket company-logos kopiert, sobald die Website bekannt war
--   removed – der Kunde hat es entfernt; dann wird nichts mehr automatisch geholt
-- Headhunter sehen es in recruiter_jobs_view erst nach dem Reveal, wie den Namen.
--
-- Keine bestehenden Daten gehen verloren: das schon hochgeladene Logo der
-- Hauptfirma (company_profiles.logo_url) wird übernommen.
-- Buckets legt diese Migration NICHT an (company-logos existiert, öffentlich).
-- ============================================================================

-- 1. Spalten
ALTER TABLE public.client_companies
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS logo_source text,
  ADD COLUMN IF NOT EXISTS logo_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS logo_check jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_companies_logo_source_check') THEN
    ALTER TABLE public.client_companies
      ADD CONSTRAINT client_companies_logo_source_check
      CHECK (logo_source IS NULL OR logo_source IN ('upload', 'website', 'removed'));
  END IF;
END;
$$;

COMMENT ON COLUMN public.client_companies.logo_url IS 'Öffentliche Adresse im Bucket company-logos.';
COMMENT ON COLUMN public.client_companies.logo_source IS 'upload | website | removed – hochgeladen geht vor, removed sperrt das automatische Holen.';
COMMENT ON COLUMN public.client_companies.logo_check IS 'Letzter Versuch von firmenlogo-holen: Website, Quelle des Bilds oder Grund ohne Treffer.';

-- 2. Bestand: hochgeladenes Logo der Hauptfirma übernehmen
UPDATE public.client_companies cc
   SET logo_url = cp.logo_url, logo_source = 'upload'
  FROM public.company_profiles cp
 WHERE cc.role = 'main'
   AND cp.user_id = cc.owner_id
   AND cc.logo_url IS NULL
   AND NULLIF(btrim(cp.logo_url), '') IS NOT NULL;

-- 3. Kunde setzt oder entfernt das Logo einer Firma seines Kontos
CREATE OR REPLACE FUNCTION public.client_set_company_logo(p_company_id uuid, p_logo_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_acc record;
  v_row client_companies%ROWTYPE;
  v_url text := NULLIF(btrim(p_logo_url), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Bitte anmelden.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_row FROM client_companies WHERE id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Firma nicht gefunden.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.has_role(v_uid, 'admin') THEN
    SELECT * INTO v_acc FROM public.client_account_of(v_uid);
    IF v_row.owner_id IS DISTINCT FROM v_acc.owner_id OR NOT COALESCE(v_acc.can_manage, false) THEN
      RAISE EXCEPTION 'Das Logo ändern Inhaber und Admins des Kontos.' USING ERRCODE = '42501';
    END IF;
  END IF;
  -- Nur Bilder aus unserem Speicher, nie eine fremde Adresse.
  IF v_url IS NOT NULL AND v_url NOT LIKE '%/storage/v1/object/public/company-logos/%' THEN
    RAISE EXCEPTION 'Bitte das Logo hochladen.' USING ERRCODE = '22023';
  END IF;

  UPDATE client_companies
     SET logo_url = v_url,
         logo_source = CASE WHEN v_url IS NULL THEN 'removed' ELSE 'upload' END,
         updated_at = now()
   WHERE id = p_company_id;

  -- Hauptfirma: Firmenprofil und Organisation zeigen dasselbe Logo
  -- (Einstellungen, Checkliste, Einladungsseite).
  IF v_row.role = 'main' THEN
    UPDATE company_profiles SET logo_url = v_url, updated_at = now() WHERE user_id = v_row.owner_id;
    IF v_row.organization_id IS NOT NULL THEN
      UPDATE organizations SET logo_url = v_url, updated_at = now() WHERE id = v_row.organization_id;
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.client_set_company_logo(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_set_company_logo(uuid, text) TO authenticated;

-- 4. Admins dürfen Logos für jede Firma hochladen (Admin › Firmen prüfen › Ersetzen)
DROP POLICY IF EXISTS "Admins laden Firmenlogos hoch" ON storage.objects;
CREATE POLICY "Admins laden Firmenlogos hoch" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-logos' AND public.has_role(auth.uid(), 'admin'));

-- 5. recruiter_jobs_view: gleiche Spalten wie 20261008120000, company_logo_url angehängt
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
  CASE WHEN rev.revealed THEN cc.logo_url END AS company_logo_url
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
  );

COMMENT ON VIEW public.recruiter_jobs_view IS
  'Recruiter-only published jobs with masked briefing fields. Company name, logo and raw texts are revealed '
  'from „Ich suche“ (activation with company_revealed_at) or after opt-in. Paused jobs stay visible with '
  'paused_at/pause_until. Confidential searches are visible to Gold Partners only. No raw intake payload, '
  'client identifier or private draft is exposed.';
