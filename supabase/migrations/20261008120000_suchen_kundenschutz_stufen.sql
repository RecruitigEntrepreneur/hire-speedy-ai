-- ============================================================================
-- Suchen, Kundensicht, Pause/Schließen, Bestandskunden, Partner-Stufen
-- (Entscheidungen 01.–08.10.2026)
--
-- A  Suchen & Kundensicht
--    · „Ich suche“ läuft nur noch über start_job_search(): 30 Tage für die erste
--      Einreichung, danach sucht der Headhunter ohne Platz weiter. Plätze sind für
--      alle gleich (10 offene Suchen ohne Einreichung, bei sehr schwacher
--      Such-Quote 2). Selbst beendet ohne Einreichung hält den Platz bis Tag 30
--      (sonst ließen sich Firmennamen sammeln).
--    · Der Kunde sieht alle Headhunter seiner Stelle mit Namen (get_job_searchers),
--      auch nach dem Ende der Suche, und meldet Direktkontakte.
--    · Pause mit Ende und Grund, Schließen mit Grund; die Suchen ruhen bzw. enden
--      mit. Behebt den Fehler, dass pausierte Stellen für Headhunter weiterliefen.
-- B  Firmenname & Bestandskunde
--    · Den Firmennamen sieht jeder Headhunter ab „Ich suche“ (Vertrag § 5 Abs. 2).
--    · „Ist das schon dein Kunde?“ muss vor der ersten Einreichung beantwortet
--      sein; „Ja“ verlangt einen unterschriebenen Vertrag als Beleg, „Stelle schon
--      direkt“ zusätzlich die Beauftragung und die Bestätigung des Kunden.
-- C  Partner-Stufen
--    · Partner / Silber Partner / Gold Partner als reine Ansehensstufen,
--      täglich aus den letzten 12 Monaten berechnet, mit Admin-Ausnahme.
--
-- Läuft nicht automatisch: in Lovable ausdrücklich anstoßen.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. jobs: Pause mit Ende, Schließen mit Grund, vertrauliche Suche
-- ----------------------------------------------------------------------------
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS pause_until timestamptz,
  ADD COLUMN IF NOT EXISTS pause_reason text,
  ADD COLUMN IF NOT EXISTS pause_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_note text,
  ADD COLUMN IF NOT EXISTS closed_hire_submission_id uuid REFERENCES public.submissions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS closed_hire_start date,
  ADD COLUMN IF NOT EXISTS closed_hire_salary integer,
  ADD COLUMN IF NOT EXISTS closed_not_matchunt_confirmed boolean,
  ADD COLUMN IF NOT EXISTS callback_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS confidential_search boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.jobs.pause_until IS 'Ende der Pause; danach läuft die Stelle automatisch wieder an (run_search_maintenance).';
COMMENT ON COLUMN public.jobs.confidential_search IS 'Vertrauliche Suche: nur Gold Partner sehen die Stelle. Setzt nur Matchunt.';

-- Vertrauliche Suche setzt nur Matchunt.
CREATE OR REPLACE FUNCTION public.jobs_guard_confidential()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.confidential_search := OLD.confidential_search;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jobs_guard_confidential ON public.jobs;
CREATE TRIGGER trg_jobs_guard_confidential
  BEFORE UPDATE OF confidential_search ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.jobs_guard_confidential();

-- ----------------------------------------------------------------------------
-- 2. Suchen bekommen einen Status
-- ----------------------------------------------------------------------------
ALTER TABLE public.recruiter_job_activations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_hold boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS end_reason text,
  ADD COLUMN IF NOT EXISTS slot_until timestamptz,
  ADD COLUMN IF NOT EXISTS company_revealed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS over_limit boolean NOT NULL DEFAULT false;

ALTER TABLE public.recruiter_job_activations DROP CONSTRAINT IF EXISTS rja_status_check;
ALTER TABLE public.recruiter_job_activations
  ADD CONSTRAINT rja_status_check CHECK (status IN ('active', 'paused', 'ended'));
ALTER TABLE public.recruiter_job_activations DROP CONSTRAINT IF EXISTS rja_end_reason_check;
ALTER TABLE public.recruiter_job_activations
  ADD CONSTRAINT rja_end_reason_check
  CHECK (end_reason IS NULL OR end_reason IN ('self', 'expired', 'job_closed', 'direct_position', 'admin'));

COMMENT ON COLUMN public.recruiter_job_activations.ends_at IS 'Frist für die erste Einreichung (30 Tage ab Start, steht während einer Pause still); NULL, sobald eingereicht.';
COMMENT ON COLUMN public.recruiter_job_activations.slot_until IS 'Selbst beendet ohne Einreichung: Platz bleibt bis hierhin belegt.';
COMMENT ON COLUMN public.recruiter_job_activations.company_revealed_at IS 'Wann der Headhunter den Firmennamen gesehen hat (Protokoll).';
COMMENT ON COLUMN public.recruiter_job_activations.review_hold IS 'Suche ruht, weil Matchunt „Stelle schon direkt“ prüft.';

CREATE INDEX IF NOT EXISTS idx_rja_job_status ON public.recruiter_job_activations (job_id, status);
CREATE INDEX IF NOT EXISTS idx_rja_recruiter_status ON public.recruiter_job_activations (recruiter_id, status);

-- Bestand einordnen
UPDATE public.recruiter_job_activations a
   SET status = 'ended', ended_at = now(), end_reason = 'job_closed'
  FROM public.jobs j
 WHERE j.id = a.job_id
   AND a.status <> 'ended'
   AND j.status IN ('closed', 'filled');

UPDATE public.recruiter_job_activations
   SET ends_at = activated_at + interval '30 days'
 WHERE status = 'active' AND NOT COALESCE(has_submitted, false) AND ends_at IS NULL;

UPDATE public.recruiter_job_activations
   SET status = 'ended', ended_at = now(), end_reason = 'expired'
 WHERE status = 'active' AND NOT COALESCE(has_submitted, false) AND ends_at <= now();

UPDATE public.recruiter_job_activations a
   SET status = 'paused', paused_at = j.paused_at
  FROM public.jobs j
 WHERE j.id = a.job_id AND a.status = 'active' AND j.paused_at IS NOT NULL;

UPDATE public.recruiter_job_activations
   SET company_revealed_at = activated_at
 WHERE company_revealed_at IS NULL AND status IN ('active', 'paused');

-- Schreiben nur noch über die Funktionen; Selbst-Hochstufen schließen.
DROP POLICY IF EXISTS "Recruiters can insert own activations" ON public.recruiter_job_activations;
DROP POLICY IF EXISTS "System can update activations" ON public.recruiter_job_activations;
DROP POLICY IF EXISTS "Recruiters can update own trust level" ON public.recruiter_trust_levels;
DROP POLICY IF EXISTS "Recruiters can insert own trust level" ON public.recruiter_trust_levels;
DROP POLICY IF EXISTS "System can manage trust levels" ON public.recruiter_trust_levels;

-- ----------------------------------------------------------------------------
-- 3. Hilfsfunktionen: Empfänger, Benachrichtigung, Rechte
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.job_client_audience(p_job_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT j.client_id FROM jobs j WHERE j.id = p_job_id
  UNION
  SELECT o.owner_id FROM jobs j JOIN organizations o ON o.id = j.organization_id WHERE j.id = p_job_id
  UNION
  SELECT om.user_id
    FROM jobs j
    JOIN organization_members om
      ON om.organization_id = j.organization_id AND om.status = 'active' AND om.role IN ('admin', 'hr')
   WHERE j.id = p_job_id
  UNION
  SELECT jc.user_id FROM job_collaborators jc WHERE jc.job_id = p_job_id;
$$;

CREATE OR REPLACE FUNCTION public.notify_users(
  p_users uuid[], p_type text, p_title text, p_message text,
  p_related_type text DEFAULT NULL, p_related_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO notifications (user_id, type, title, message, related_type, related_id)
  SELECT DISTINCT u, p_type, p_title, p_message, p_related_type, p_related_id
    FROM unnest(COALESCE(p_users, ARRAY[]::uuid[])) AS u
   WHERE u IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.notify_admins(
  p_type text, p_title text, p_message text, p_related_type text DEFAULT 'admin_review', p_related_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.notify_users(
    ARRAY(SELECT DISTINCT user_id FROM user_roles WHERE role = 'admin'),
    p_type, p_title, p_message, p_related_type, p_related_id);
$$;

-- Darf der angemeldete Nutzer die Stelle pausieren/schließen? (Kundenvertrag § 3 Abs. 2)
CREATE OR REPLACE FUNCTION public.can_manage_job(p_job_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(p_user_id, 'admin') OR EXISTS (
    SELECT 1 FROM jobs j
     WHERE j.id = p_job_id
       AND (
         (j.organization_id IS NULL AND j.client_id = p_user_id)
         OR (j.organization_id IS NOT NULL
             AND public.get_org_role(j.organization_id, p_user_id) IN ('owner', 'admin', 'hr'))
       )
  );
$$;

CREATE OR REPLACE FUNCTION public.recruiter_display_name(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(trim(p.full_name), ''), 'Ein Headhunter')
         || COALESCE(' (' || NULLIF(trim(p.company_name), '') || ')', '')
    FROM profiles p WHERE p.user_id = p_user_id
  UNION ALL SELECT 'Ein Headhunter'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.job_client_key(p_job_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(organization_id::text, client_id::text) FROM jobs WHERE id = p_job_id;
$$;

-- ----------------------------------------------------------------------------
-- 4. Plätze: für alle gleich
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_slots_used(p_recruiter uuid, p_exclude_job uuid DEFAULT NULL)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int
    FROM recruiter_job_activations a
   WHERE a.recruiter_id = p_recruiter
     AND (p_exclude_job IS NULL OR a.job_id <> p_exclude_job)
     AND (
       (a.status = 'active' AND NOT COALESCE(a.has_submitted, false))
       OR (a.status = 'ended' AND a.slot_until > now())
     );
$$;

-- 10 offene Suchen ohne Einreichung; wer bei mindestens 5 Suchen weniger als
-- 20 % mit einer Einreichung abschließt, hat bis zur nächsten Einreichung 2.
CREATE OR REPLACE FUNCTION public.search_slot_limit(p_recruiter uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH s AS (
    SELECT count(*) FILTER (WHERE COALESCE(has_submitted, false)) AS k,
           count(*) FILTER (WHERE COALESCE(has_submitted, false)
                              OR (status = 'ended' AND end_reason IN ('self', 'expired'))) AS n
      FROM recruiter_job_activations
     WHERE recruiter_id = p_recruiter
  )
  SELECT CASE WHEN n >= 5 AND k::numeric / n < 0.2 THEN 2 ELSE 10 END FROM s;
$$;

CREATE OR REPLACE FUNCTION public.my_search_capacity()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'used', public.search_slots_used(auth.uid()),
    'limit', public.search_slot_limit(auth.uid())
  );
$$;

-- ----------------------------------------------------------------------------
-- 5. Bestandskunden: Angaben und Belege
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recruiter_client_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_key text NOT NULL,
  organization_id uuid,
  client_user_id uuid,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  answer text NOT NULL CHECK (answer IN ('no', 'client', 'direct_position')),
  status text NOT NULL CHECK (status IN ('none', 'pending', 'confirmed', 'rejected')),
  contract_path text,
  assignment_path text,
  client_answer text CHECK (client_answer IN ('yes', 'no')),
  client_answered_at timestamptz,
  client_answered_by uuid,
  stichtag timestamptz,
  decided_by uuid,
  decided_at timestamptz,
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.recruiter_client_declarations IS
  '„Ist das schon dein Kunde?“: Antwort je Headhunter und Kunde (no/client) und je Stelle (direct_position). Belege sieht nur Matchunt.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_rcd_client
  ON public.recruiter_client_declarations (recruiter_id, client_key)
  WHERE answer IN ('no', 'client');
CREATE UNIQUE INDEX IF NOT EXISTS uq_rcd_direct
  ON public.recruiter_client_declarations (recruiter_id, job_id)
  WHERE answer = 'direct_position' AND status IN ('pending', 'confirmed');

ALTER TABLE public.recruiter_client_declarations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Headhunter sehen eigene Angaben" ON public.recruiter_client_declarations;
CREATE POLICY "Headhunter sehen eigene Angaben" ON public.recruiter_client_declarations
  FOR SELECT USING (recruiter_id = auth.uid());
DROP POLICY IF EXISTS "Admins verwalten Angaben" ON public.recruiter_client_declarations;
CREATE POLICY "Admins verwalten Angaben" ON public.recruiter_client_declarations
  FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO storage.buckets (id, name, public)
VALUES ('recruiter-proofs', 'recruiter-proofs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Headhunter laden eigene Belege" ON storage.objects;
CREATE POLICY "Headhunter laden eigene Belege" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recruiter-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Headhunter sehen eigene Belege" ON storage.objects;
CREATE POLICY "Headhunter sehen eigene Belege" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'recruiter-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Admins sehen Belege" ON storage.objects;
CREATE POLICY "Admins sehen Belege" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'recruiter-proofs' AND public.has_role(auth.uid(), 'admin'));

-- Kunden sehen die Fotos der Headhunter, die für ihre Stellen suchen oder gesucht haben.
-- Die Prüfung läuft als SECURITY DEFINER: Suchen selbst darf der Kunde per RLS nicht lesen.
CREATE OR REPLACE FUNCTION public.client_sees_recruiter(p_recruiter_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM recruiter_job_activations a
     WHERE a.recruiter_id::text = p_recruiter_id
       AND public.can_access_job(a.job_id)
  );
$$;

DROP POLICY IF EXISTS "Kunden sehen Fotos suchender Headhunter" ON storage.objects;
CREATE POLICY "Kunden sehen Fotos suchender Headhunter" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'recruiter-avatars' AND public.client_sees_recruiter((storage.foldername(name))[1]));

-- ----------------------------------------------------------------------------
-- 6. „Ich suche“ und „Suche beenden“
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_job_search(p_job_id uuid, p_for_submission boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_job jobs%ROWTYPE;
  v_act recruiter_job_activations%ROWTYPE;
  v_found boolean;
  v_used int;
  v_limit int;
  v_tier text;
  v_over boolean := false;
  v_needs_answer boolean;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'recruiter') THEN
    RAISE EXCEPTION 'Nur Headhunter können suchen.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = v_uid AND role = 'recruiter' AND suspended_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Dein Konto ist gesperrt.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = p_job_id;
  IF NOT FOUND OR v_job.status IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'Diese Stelle ist nicht mehr offen.' USING ERRCODE = 'P0001', HINT = 'job_not_open';
  END IF;
  IF v_job.paused_at IS NOT NULL THEN
    RAISE EXCEPTION 'Der Kunde hat die Stelle pausiert%.',
      COALESCE(' bis ' || to_char(v_job.pause_until AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY'), '')
      USING ERRCODE = 'P0001', HINT = 'job_paused';
  END IF;

  SELECT tier INTO v_tier FROM recruiter_partner_status WHERE user_id = v_uid AND ended_at IS NULL;

  SELECT * INTO v_act FROM recruiter_job_activations WHERE recruiter_id = v_uid AND job_id = p_job_id FOR UPDATE;
  v_found := FOUND;

  IF v_job.confidential_search AND COALESCE(v_tier, '') <> 'gold' AND NOT v_found THEN
    RAISE EXCEPTION 'Vertrauliche Suche: Diese Stelle ist Gold Partnern vorbehalten.' USING ERRCODE = 'P0001', HINT = 'confidential';
  END IF;

  IF NOT (v_found AND v_act.status IN ('active', 'paused')) THEN
    IF v_found AND v_act.end_reason = 'direct_position' THEN
      RAISE EXCEPTION 'Diese Stelle bearbeitest du direkt mit dem Kunden.' USING ERRCODE = 'P0001', HINT = 'direct_position';
    END IF;

    v_used := public.search_slots_used(v_uid, p_job_id);
    v_limit := public.search_slot_limit(v_uid);
    IF v_used >= v_limit THEN
      -- Wer direkt einreicht, darf genau eine Suche über die Grenze starten.
      IF p_for_submission AND v_used < v_limit + 1 THEN
        v_over := true;
      ELSE
        RAISE EXCEPTION 'Alle % Plätze für offene Suchen sind belegt. Reiche bei einer Suche ein, dann ist der Platz sofort frei.', v_limit
          USING ERRCODE = 'P0001', HINT = 'no_slot';
      END IF;
    END IF;

    IF v_found THEN
      UPDATE recruiter_job_activations
         SET status = 'active',
             activated_at = now(),
             ends_at = CASE WHEN COALESCE(has_submitted, false) THEN NULL ELSE now() + interval '30 days' END,
             ended_at = NULL, end_reason = NULL, slot_until = NULL, paused_at = NULL,
             review_hold = false, reminder_sent_at = NULL, over_limit = v_over,
             company_revealed_at = COALESCE(company_revealed_at, now())
       WHERE id = v_act.id
       RETURNING * INTO v_act;
    ELSE
      INSERT INTO recruiter_job_activations
        (recruiter_id, job_id, trust_level_at, status, ends_at, company_revealed_at, over_limit)
      VALUES
        (v_uid, p_job_id, COALESCE(v_tier, 'partner'), 'active', now() + interval '30 days', now(), v_over)
      RETURNING * INTO v_act;
    END IF;

    PERFORM public.notify_users(
      ARRAY(SELECT public.job_client_audience(p_job_id)),
      'search_started',
      'Ein Headhunter sucht jetzt für Sie',
      format('%s sucht jetzt für „%s“.', public.recruiter_display_name(v_uid), v_job.title),
      'job', p_job_id);
  END IF;

  v_needs_answer := NOT EXISTS (
    SELECT 1 FROM recruiter_client_declarations d
     WHERE d.recruiter_id = v_uid
       AND d.client_key = COALESCE(v_job.organization_id::text, v_job.client_id::text)
       AND d.answer IN ('no', 'client'));

  RETURN jsonb_build_object(
    'activation_id', v_act.id,
    'status', v_act.status,
    'company_name', v_job.company_name,
    'location', v_job.location,
    'ends_at', v_act.ends_at,
    'needs_client_answer', v_needs_answer,
    'slots_used', public.search_slots_used(v_uid),
    'slot_limit', public.search_slot_limit(v_uid),
    'over_limit', v_act.over_limit
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.end_job_search(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_act recruiter_job_activations%ROWTYPE;
BEGIN
  UPDATE recruiter_job_activations
     SET status = 'ended', ended_at = now(), end_reason = 'self', paused_at = NULL,
         slot_until = CASE WHEN COALESCE(has_submitted, false) THEN NULL
                           ELSE GREATEST(activated_at + interval '30 days', now()) END
   WHERE recruiter_id = auth.uid() AND job_id = p_job_id AND status IN ('active', 'paused')
   RETURNING * INTO v_act;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Für diese Stelle läuft keine Suche.' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object('status', v_act.status, 'slot_until', v_act.slot_until);
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Einreichen nur bei laufender Suche und beantworteter Kundenfrage
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_submission_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_act recruiter_job_activations%ROWTYPE;
  v_job jobs%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = NEW.job_id;
  IF NOT FOUND OR v_job.status IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'Diese Stelle ist nicht mehr offen.' USING ERRCODE = 'P0001', HINT = 'job_not_open';
  END IF;
  IF v_job.paused_at IS NOT NULL THEN
    RAISE EXCEPTION 'Der Kunde hat die Stelle pausiert. Einreichen geht wieder, wenn sie weiterläuft.'
      USING ERRCODE = 'P0001', HINT = 'job_paused';
  END IF;

  SELECT * INTO v_act FROM recruiter_job_activations WHERE recruiter_id = NEW.recruiter_id AND job_id = NEW.job_id;
  IF NOT FOUND OR v_act.status = 'ended' THEN
    RAISE EXCEPTION 'Einreichen geht nur bei laufender Suche. Bitte zuerst „Ich suche“ drücken.'
      USING ERRCODE = 'P0001', HINT = 'job_not_activated';
  END IF;
  IF v_act.status = 'paused' THEN
    RAISE EXCEPTION 'Deine Suche ruht gerade. Einreichen geht danach wieder.'
      USING ERRCODE = 'P0001', HINT = 'search_paused';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM recruiter_client_declarations d
     WHERE d.recruiter_id = NEW.recruiter_id
       AND d.client_key = COALESCE(v_job.organization_id::text, v_job.client_id::text)
       AND d.answer IN ('no', 'client')
  ) THEN
    RAISE EXCEPTION 'Bitte zuerst beantworten, ob das Unternehmen schon dein Kunde ist.'
      USING ERRCODE = 'P0001', HINT = 'client_question_open';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_activation_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.recruiter_job_activations
     SET has_submitted = true,
         first_submission_at = COALESCE(first_submission_at, now()),
         ends_at = NULL
   WHERE recruiter_id = NEW.recruiter_id
     AND job_id = NEW.job_id
     AND COALESCE(has_submitted, false) = false;

  IF FOUND THEN
    UPDATE public.recruiter_trust_levels
       SET activations_with_submission = COALESCE(activations_with_submission, 0) + 1,
           activation_ratio = (COALESCE(activations_with_submission, 0) + 1)::numeric
                              / GREATEST(COALESCE(total_activations, 0), 1),
           updated_at = now()
     WHERE recruiter_id = NEW.recruiter_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. Stelle pausiert/läuft wieder/geschlossen → Suchen ruhen/laufen/enden
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.jobs_sync_searches()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recruiters uuid[];
  v_bis text;
BEGIN
  IF OLD.paused_at IS NULL AND NEW.paused_at IS NOT NULL THEN
    v_recruiters := ARRAY(SELECT recruiter_id FROM recruiter_job_activations
                           WHERE job_id = NEW.id AND status IN ('active', 'paused'));
    UPDATE recruiter_job_activations
       SET status = 'paused', paused_at = now()
     WHERE job_id = NEW.id AND status = 'active';
    v_bis := COALESCE(' bis ' || to_char(NEW.pause_until AT TIME ZONE 'Europe/Berlin', 'DD.MM.'), '');
    PERFORM public.notify_users(v_recruiters, 'job_paused', 'Stelle pausiert',
      format('„%s“ ist pausiert%s%s. Deine Suche ruht so lange, deine Kandidaten laufen weiter.',
             NEW.title, v_bis, COALESCE(' · ' || NULLIF(NEW.pause_reason, ''), '')),
      'job', NEW.id);

  ELSIF OLD.paused_at IS NOT NULL AND NEW.paused_at IS NULL AND NEW.status = 'published' THEN
    v_recruiters := ARRAY(SELECT recruiter_id FROM recruiter_job_activations
                           WHERE job_id = NEW.id AND status = 'paused' AND NOT review_hold);
    UPDATE recruiter_job_activations
       SET status = 'active',
           ends_at = CASE WHEN ends_at IS NULL THEN NULL ELSE ends_at + (now() - COALESCE(paused_at, now())) END,
           paused_at = NULL
     WHERE job_id = NEW.id AND status = 'paused' AND NOT review_hold;
    PERFORM public.notify_users(v_recruiters, 'job_resumed', 'Stelle läuft wieder',
      format('„%s“ läuft wieder. Deine Suche geht weiter.', NEW.title), 'job', NEW.id);
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('closed', 'filled') THEN
    v_recruiters := ARRAY(
      SELECT recruiter_id FROM recruiter_job_activations WHERE job_id = NEW.id AND status IN ('active', 'paused')
      UNION
      SELECT recruiter_id FROM submissions WHERE job_id = NEW.id);
    UPDATE recruiter_job_activations
       SET status = 'ended', ended_at = now(), end_reason = 'job_closed', slot_until = NULL, paused_at = NULL
     WHERE job_id = NEW.id AND status IN ('active', 'paused');
    PERFORM public.notify_users(v_recruiters, 'job_closed', 'Stelle geschlossen',
      format('„%s“ ist geschlossen · %s. Deine eingereichten Kandidaten bleiben beteiligungsfähig.',
             NEW.title, CASE WHEN NEW.status = 'filled' THEN 'besetzt' ELSE 'die Suche endet' END),
      'job', NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jobs_sync_searches ON public.jobs;
CREATE TRIGGER trg_jobs_sync_searches
  AFTER UPDATE OF paused_at, status ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.jobs_sync_searches();

-- ----------------------------------------------------------------------------
-- 9. Kunde: pausieren, weitersuchen, schließen, Rückruf
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.client_pause_job(p_job_id uuid, p_until timestamptz, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job jobs%ROWTYPE;
BEGIN
  IF NOT public.can_manage_job(p_job_id) THEN
    RAISE EXCEPTION 'Pausieren dürfen Owner, Admin und HR.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id FOR UPDATE;
  IF v_job.status IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'Nur laufende Stellen lassen sich pausieren.' USING ERRCODE = 'P0001';
  END IF;
  IF p_until IS NULL OR p_until <= now() OR p_until > now() + interval '62 days' THEN
    RAISE EXCEPTION 'Bitte ein Ende der Pause innerhalb der nächsten 8 Wochen wählen.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE jobs
     SET paused_at = COALESCE(paused_at, now()),
         pause_until = p_until,
         pause_reason = NULLIF(trim(COALESCE(p_reason, '')), ''),
         pause_reminder_sent_at = NULL
   WHERE id = p_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.client_resume_job(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_job(p_job_id) THEN
    RAISE EXCEPTION 'Weitersuchen dürfen Owner, Admin und HR.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE jobs
     SET paused_at = NULL, pause_until = NULL, pause_reason = NULL, pause_reminder_sent_at = NULL
   WHERE id = p_job_id AND paused_at IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.client_close_job(
  p_job_id uuid,
  p_reason text,
  p_note text DEFAULT NULL,
  p_hire_submission_id uuid DEFAULT NULL,
  p_hire_start date DEFAULT NULL,
  p_hire_salary integer DEFAULT NULL,
  p_not_matchunt boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job jobs%ROWTYPE;
  v_sub submissions%ROWTYPE;
  v_status text;
  v_label text;
BEGIN
  IF NOT public.can_manage_job(p_job_id) THEN
    RAISE EXCEPTION 'Schließen dürfen Owner, Admin und HR.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_reason NOT IN ('filled_via_matchunt', 'filled_elsewhere', 'no_candidates', 'cancelled') THEN
    RAISE EXCEPTION 'Unbekannter Grund.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id FOR UPDATE;
  IF v_job.status IN ('closed', 'filled') THEN
    RAISE EXCEPTION 'Die Stelle ist bereits geschlossen.' USING ERRCODE = 'P0001';
  END IF;

  IF p_reason = 'filled_via_matchunt' THEN
    SELECT * INTO v_sub FROM submissions WHERE id = p_hire_submission_id AND job_id = p_job_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Bitte den eingestellten Kandidaten auswählen.' USING ERRCODE = 'P0001';
    END IF;
    v_status := 'filled';
    v_label := 'besetzt mit einem Kandidaten von Matchunt';
  ELSIF p_reason = 'filled_elsewhere' THEN
    IF NOT COALESCE(p_not_matchunt, false) THEN
      RAISE EXCEPTION 'Bitte bestätigen, dass die eingestellte Person nicht über Matchunt vorgestellt wurde.' USING ERRCODE = 'P0001';
    END IF;
    v_status := 'filled';
    v_label := 'anderweitig besetzt';
  ELSIF p_reason = 'no_candidates' THEN
    v_status := 'closed';
    v_label := 'keine passenden Kandidaten';
  ELSE
    v_status := 'closed';
    v_label := 'Stelle entfällt';
  END IF;

  UPDATE jobs
     SET status = v_status,
         closed_reason = p_reason,
         closed_at = now(),
         closed_note = NULLIF(trim(COALESCE(p_note, '')), ''),
         closed_hire_submission_id = CASE WHEN p_reason = 'filled_via_matchunt' THEN p_hire_submission_id END,
         closed_hire_start = CASE WHEN p_reason = 'filled_via_matchunt' THEN p_hire_start END,
         closed_hire_salary = CASE WHEN p_reason = 'filled_via_matchunt' THEN p_hire_salary END,
         closed_not_matchunt_confirmed = CASE WHEN p_reason = 'filled_elsewhere' THEN true END,
         paused_at = NULL, pause_until = NULL, pause_reason = NULL
   WHERE id = p_job_id;

  IF p_reason = 'filled_via_matchunt' THEN
    PERFORM public.notify_users(ARRAY[v_sub.recruiter_id], 'hire_reported', 'Einstellung gemeldet',
      format('Der Kunde meldet: Dein Kandidat für „%s“ wurde eingestellt. Matchunt prüft das und meldet sich.', v_job.title),
      'submission', v_sub.id);
  END IF;

  PERFORM public.notify_admins('job_closed_by_client', 'Stelle geschlossen',
    format('„%s“ (%s) wurde geschlossen: %s.', v_job.title, v_job.company_name, v_label),
    'admin_review', p_job_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.client_request_callback(p_job_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job jobs%ROWTYPE;
BEGIN
  IF NOT public.can_access_job(p_job_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE jobs SET callback_requested_at = now() WHERE id = p_job_id RETURNING * INTO v_job;
  PERFORM public.notify_admins('callback_requested', 'Rückruf gewünscht',
    format('„%s“ (%s): Der Kunde wollte schließen (keine passenden Kandidaten) und wünscht einen Rückruf.%s',
           v_job.title, v_job.company_name, COALESCE(' Hinweis: ' || NULLIF(trim(COALESCE(p_note, '')), ''), '')),
    'admin_review', p_job_id);
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. Kunde sieht, wer sucht und gesucht hat
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_job_searchers(p_job_id uuid)
RETURNS TABLE (
  activation_id uuid,
  recruiter_id uuid,
  full_name text,
  company_name text,
  avatar_path text,
  partner_number text,
  tier text,
  is_new boolean,
  status text,
  started_at timestamptz,
  ended_at timestamptz,
  candidates integer,
  last_submission_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id,
         a.recruiter_id,
         p.full_name,
         p.company_name,
         p.avatar_path,
         CASE WHEN ps.ended_at IS NULL THEN ps.partner_number END,
         CASE WHEN ps.ended_at IS NULL THEN ps.tier END,
         NOT EXISTS (SELECT 1 FROM interviews i JOIN submissions s2 ON s2.id = i.submission_id
                      WHERE s2.recruiter_id = a.recruiter_id),
         a.status,
         a.activated_at,
         a.ended_at,
         (SELECT count(*)::int FROM submissions s WHERE s.job_id = a.job_id AND s.recruiter_id = a.recruiter_id),
         (SELECT max(s.submitted_at) FROM submissions s WHERE s.job_id = a.job_id AND s.recruiter_id = a.recruiter_id)
    FROM recruiter_job_activations a
    LEFT JOIN profiles p ON p.user_id = a.recruiter_id
    LEFT JOIN recruiter_partner_status ps ON ps.user_id = a.recruiter_id
   WHERE a.job_id = p_job_id
     AND (public.can_access_job(p_job_id) OR public.has_role(auth.uid(), 'admin'))
   ORDER BY (a.status = 'ended'),
            CASE WHEN ps.ended_at IS NULL AND ps.tier = 'gold' THEN 0
                 WHEN ps.ended_at IS NULL AND ps.tier = 'silver' THEN 1 ELSE 2 END,
            a.activated_at;
$$;

CREATE OR REPLACE FUNCTION public.get_jobs_searcher_counts(p_job_ids uuid[])
RETURNS TABLE (job_id uuid, searching integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.job_id, count(*)::int
    FROM recruiter_job_activations a
   WHERE a.job_id = ANY (p_job_ids)
     AND a.status IN ('active', 'paused')
     AND public.can_access_job(a.job_id)
   GROUP BY a.job_id;
$$;

-- ----------------------------------------------------------------------------
-- 11. Direktkontakt melden
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_contact_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  recruiter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('phone', 'email', 'linkedin', 'other')),
  note text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'confirmed', 'dismissed')),
  admin_note text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.client_contact_reports IS 'Kunde meldet Kontakt eines Headhunters außerhalb der Plattform. Vertraulich, nur Matchunt liest.';

ALTER TABLE public.client_contact_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins verwalten Meldungen" ON public.client_contact_reports;
CREATE POLICY "Admins verwalten Meldungen" ON public.client_contact_reports
  FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.report_direct_contact(p_job_id uuid, p_recruiter_id uuid, p_channel text, p_note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_job jobs%ROWTYPE;
BEGIN
  IF NOT public.can_access_job(p_job_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM recruiter_job_activations WHERE job_id = p_job_id AND recruiter_id = p_recruiter_id) THEN
    RAISE EXCEPTION 'Dieser Headhunter hat nicht für die Stelle gesucht.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id;
  INSERT INTO client_contact_reports (job_id, recruiter_id, reported_by, channel, note)
  VALUES (p_job_id, p_recruiter_id, auth.uid(), p_channel, NULLIF(trim(COALESCE(p_note, '')), ''))
  RETURNING id INTO v_id;
  PERFORM public.notify_admins('contact_report', 'Direktkontakt gemeldet',
    format('%s: Kunde meldet Kontakt außerhalb der Plattform durch %s.', v_job.company_name,
           public.recruiter_display_name(p_recruiter_id)),
    'admin_review', v_id);
  RETURN v_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 12. „Ist das schon dein Kunde?“
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.answer_client_question(p_job_id uuid, p_answer text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_job jobs%ROWTYPE;
  v_key text;
  v_stichtag timestamptz;
  v_client recruiter_client_declarations%ROWTYPE;
  v_direct recruiter_client_declarations%ROWTYPE;
BEGIN
  IF p_answer NOT IN ('no', 'client', 'direct_position') THEN
    RAISE EXCEPTION 'Unbekannte Antwort.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM recruiter_job_activations
                  WHERE recruiter_id = v_uid AND job_id = p_job_id AND status IN ('active', 'paused')) THEN
    RAISE EXCEPTION 'Für diese Stelle läuft keine Suche.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = p_job_id;
  v_key := COALESCE(v_job.organization_id::text, v_job.client_id::text);
  SELECT min(a.activated_at) INTO v_stichtag
    FROM recruiter_job_activations a JOIN jobs j ON j.id = a.job_id
   WHERE a.recruiter_id = v_uid AND COALESCE(j.organization_id::text, j.client_id::text) = v_key;

  SELECT * INTO v_client FROM recruiter_client_declarations
   WHERE recruiter_id = v_uid AND client_key = v_key AND answer IN ('no', 'client');

  IF p_answer = 'no' THEN
    IF NOT FOUND THEN
      INSERT INTO recruiter_client_declarations (recruiter_id, client_key, organization_id, client_user_id, job_id, answer, status, stichtag)
      VALUES (v_uid, v_key, v_job.organization_id, v_job.client_id, p_job_id, 'no', 'none', v_stichtag)
      RETURNING * INTO v_client;
    END IF;
    RETURN jsonb_build_object('client_declaration_id', v_client.id);
  END IF;

  -- Ja: Kunde (Beleg folgt); bei „Stelle schon direkt“ zusätzlich je Stelle.
  IF NOT FOUND THEN
    INSERT INTO recruiter_client_declarations (recruiter_id, client_key, organization_id, client_user_id, job_id, answer, status, stichtag)
    VALUES (v_uid, v_key, v_job.organization_id, v_job.client_id, p_job_id, 'client', 'pending', v_stichtag)
    RETURNING * INTO v_client;
  ELSIF v_client.answer = 'no' THEN
    UPDATE recruiter_client_declarations
       SET answer = 'client', status = 'pending', job_id = p_job_id, updated_at = now()
     WHERE id = v_client.id
     RETURNING * INTO v_client;
  END IF;

  IF p_answer = 'direct_position' THEN
    INSERT INTO recruiter_client_declarations (recruiter_id, client_key, organization_id, client_user_id, job_id, answer, status, stichtag)
    VALUES (v_uid, v_key, v_job.organization_id, v_job.client_id, p_job_id, 'direct_position', 'pending', v_stichtag)
    RETURNING * INTO v_direct;

    UPDATE recruiter_job_activations
       SET status = 'paused', review_hold = true, paused_at = COALESCE(paused_at, now())
     WHERE recruiter_id = v_uid AND job_id = p_job_id AND status IN ('active', 'paused');

    PERFORM public.notify_users(
      ARRAY(SELECT public.job_client_audience(p_job_id)),
      'direct_position_request', 'Kurze Rückfrage zu Ihrer Stelle',
      format('%s gibt an, dass Sie ihm die Stelle „%s“ schon vor Ihrer Beauftragung von Matchunt direkt übertragen haben. Bitte bestätigen Sie das auf der Stellenseite.',
             public.recruiter_display_name(v_uid), v_job.title),
      'job', p_job_id);
  END IF;

  PERFORM public.notify_admins('client_declaration', 'Bestandskunde gemeldet',
    format('%s meldet %s als Kunden%s.', public.recruiter_display_name(v_uid), v_job.company_name,
           CASE WHEN p_answer = 'direct_position' THEN format(' und hat „%s“ schon direkt', v_job.title) ELSE '' END),
    'admin_review', COALESCE(v_direct.id, v_client.id));

  RETURN jsonb_build_object('client_declaration_id', v_client.id, 'direct_declaration_id', v_direct.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.attach_declaration_proof(p_declaration_id uuid, p_kind text, p_path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_kind NOT IN ('contract', 'assignment') THEN
    RAISE EXCEPTION 'Unbekannte Belegart.' USING ERRCODE = 'P0001';
  END IF;
  IF p_path IS NULL OR split_part(p_path, '/', 1) <> auth.uid()::text THEN
    RAISE EXCEPTION 'Ungültiger Ablageort.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE recruiter_client_declarations
     SET contract_path = CASE WHEN p_kind = 'contract' THEN p_path ELSE contract_path END,
         assignment_path = CASE WHEN p_kind = 'assignment' THEN p_path ELSE assignment_path END,
         status = CASE WHEN status = 'rejected' THEN 'pending' ELSE status END,
         updated_at = now()
   WHERE id = p_declaration_id AND recruiter_id = auth.uid() AND answer IN ('client', 'direct_position');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Angabe nicht gefunden.' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_job_direct_position_requests(p_job_id uuid)
RETURNS TABLE (declaration_id uuid, recruiter_name text, created_at timestamptz, client_answer text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, public.recruiter_display_name(d.recruiter_id), d.created_at, d.client_answer
    FROM recruiter_client_declarations d
   WHERE d.job_id = p_job_id
     AND d.answer = 'direct_position'
     AND d.status = 'pending'
     AND public.can_access_job(p_job_id);
$$;

CREATE OR REPLACE FUNCTION public.client_answer_direct_position(p_declaration_id uuid, p_answer text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_d recruiter_client_declarations%ROWTYPE;
  v_job jobs%ROWTYPE;
BEGIN
  IF p_answer NOT IN ('yes', 'no') THEN
    RAISE EXCEPTION 'Unbekannte Antwort.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_d FROM recruiter_client_declarations
   WHERE id = p_declaration_id AND answer = 'direct_position' AND status = 'pending';
  IF NOT FOUND OR NOT public.can_manage_job(v_d.job_id) THEN
    RAISE EXCEPTION 'Rückfrage nicht gefunden.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE recruiter_client_declarations
     SET client_answer = p_answer, client_answered_at = now(), client_answered_by = auth.uid(), updated_at = now()
   WHERE id = p_declaration_id;
  SELECT * INTO v_job FROM jobs WHERE id = v_d.job_id;
  PERFORM public.notify_admins('client_declaration', 'Kunde hat geantwortet',
    format('%s: „%s“ schon direkt an %s vergeben? Antwort: %s.', v_job.company_name, v_job.title,
           public.recruiter_display_name(v_d.recruiter_id), CASE WHEN p_answer = 'yes' THEN 'Ja' ELSE 'Nein' END),
    'admin_review', p_declaration_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_decide_declaration(p_declaration_id uuid, p_decision text, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_d recruiter_client_declarations%ROWTYPE;
  v_job jobs%ROWTYPE;
  v_company text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Nur Matchunt.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_decision NOT IN ('confirm', 'reject') THEN
    RAISE EXCEPTION 'Unbekannte Entscheidung.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_d FROM recruiter_client_declarations WHERE id = p_declaration_id FOR UPDATE;
  IF NOT FOUND OR v_d.answer = 'no' THEN
    RAISE EXCEPTION 'Angabe nicht gefunden.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_job FROM jobs WHERE id = v_d.job_id;
  v_company := COALESCE(v_job.company_name, 'das Unternehmen');

  UPDATE recruiter_client_declarations
     SET status = CASE WHEN p_decision = 'confirm' THEN 'confirmed' ELSE 'rejected' END,
         reject_reason = CASE WHEN p_decision = 'reject' THEN NULLIF(trim(COALESCE(p_reason, '')), '') END,
         decided_by = auth.uid(), decided_at = now(), updated_at = now()
   WHERE id = p_declaration_id;

  IF v_d.answer = 'direct_position' THEN
    IF p_decision = 'confirm' THEN
      -- Wer die Stelle nachweislich schon hatte, ist auch Bestandskunde.
      UPDATE recruiter_client_declarations
         SET status = 'confirmed', decided_by = auth.uid(), decided_at = now(), updated_at = now()
       WHERE recruiter_id = v_d.recruiter_id AND client_key = v_d.client_key AND answer = 'client' AND status <> 'confirmed';
      UPDATE recruiter_job_activations
         SET status = 'ended', ended_at = now(), end_reason = 'direct_position', review_hold = false,
             paused_at = NULL, slot_until = NULL
       WHERE recruiter_id = v_d.recruiter_id AND job_id = v_d.job_id;
      PERFORM public.notify_users(ARRAY[v_d.recruiter_id], 'declaration_decided', 'Stelle direkt bestätigt',
        format('Bestätigt: Du bearbeitest „%s“ direkt mit %s. Deine Suche bei Matchunt ist beendet, eingereichte Kandidaten laufen weiter.',
               v_job.title, v_company), 'job', v_d.job_id);
      PERFORM public.notify_users(ARRAY(SELECT public.job_client_audience(v_d.job_id)), 'direct_position_confirmed',
        'Stelle wird direkt bearbeitet',
        format('%s bearbeitet „%s“ direkt mit Ihnen, wie vor Ihrer Matchunt-Beauftragung vereinbart. Bei Matchunt suchen die anderen Headhunter weiter. Über „Stelle verwalten“ können Sie jederzeit pausieren oder schließen.',
               public.recruiter_display_name(v_d.recruiter_id), v_job.title), 'job', v_d.job_id);
    ELSE
      UPDATE recruiter_job_activations
         SET status = CASE WHEN v_job.paused_at IS NULL THEN 'active' ELSE 'paused' END,
             review_hold = false,
             ends_at = CASE WHEN ends_at IS NULL THEN NULL ELSE ends_at + (now() - COALESCE(paused_at, now())) END,
             paused_at = CASE WHEN v_job.paused_at IS NULL THEN NULL ELSE paused_at END
       WHERE recruiter_id = v_d.recruiter_id AND job_id = v_d.job_id AND review_hold;
      PERFORM public.notify_users(ARRAY[v_d.recruiter_id], 'declaration_decided', 'Beleg reicht nicht',
        format('„%s“ läuft weiter über Matchunt.%s', v_job.title, COALESCE(' Grund: ' || NULLIF(trim(COALESCE(p_reason, '')), ''), '')),
        'job', v_d.job_id);
    END IF;
  ELSE
    PERFORM public.notify_users(ARRAY[v_d.recruiter_id], 'declaration_decided',
      CASE WHEN p_decision = 'confirm' THEN 'Bestandskunde bestätigt' ELSE 'Beleg reicht nicht' END,
      CASE WHEN p_decision = 'confirm'
           THEN format('%s ist als dein Bestandskunde bestätigt. Außerhalb von Matchunt bist du mit ihr frei.', v_company)
           ELSE format('%s bleibt für dich geschützt.%s', v_company, COALESCE(' Grund: ' || NULLIF(trim(COALESCE(p_reason, '')), ''), ''))
      END,
      'job', v_d.job_id);
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 13. Partner-Stufen: Partner / Silber Partner / Gold Partner
-- ----------------------------------------------------------------------------
ALTER TABLE public.recruiter_partner_status DROP CONSTRAINT IF EXISTS recruiter_partner_status_tier_check;
ALTER TABLE public.recruiter_partner_status
  ADD CONSTRAINT recruiter_partner_status_tier_check CHECK (tier IN ('partner', 'silver', 'gold'));

ALTER TABLE public.recruiter_partner_status
  ADD COLUMN IF NOT EXISTS tier_since timestamptz,
  ADD COLUMN IF NOT EXISTS tier_valid_until timestamptz,
  ADD COLUMN IF NOT EXISTS tier_override text CHECK (tier_override IN ('partner', 'silver', 'gold')),
  ADD COLUMN IF NOT EXISTS tier_override_reason text,
  ADD COLUMN IF NOT EXISTS tier_override_by uuid,
  ADD COLUMN IF NOT EXISTS tier_override_at timestamptz,
  ADD COLUMN IF NOT EXISTS tier_metrics jsonb,
  ADD COLUMN IF NOT EXISTS tier_checked_at timestamptz;

COMMENT ON COLUMN public.recruiter_partner_status.tier IS
  'Ansehensstufe: partner (ab Vertrag), silver (5 Kunden-Interviews oder 1 Einstellung in 12 Monaten, Interview-Quote ab 20 %), gold (3 Einstellungen in 12 Monaten, Interview-Quote ab 35 %, mindestens 6 Monate dabei, kein Verstoß). Keine Wirkung auf Plätze.';

CREATE OR REPLACE FUNCTION public.recruiter_tier_metrics(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH subs AS (
    SELECT s.id FROM submissions s
     WHERE s.recruiter_id = p_user_id AND s.submitted_at >= now() - interval '12 months'
  ),
  iv AS (
    SELECT count(DISTINCT i.submission_id) AS n
      FROM interviews i JOIN submissions s ON s.id = i.submission_id
     WHERE s.recruiter_id = p_user_id AND i.created_at >= now() - interval '12 months'
       AND COALESCE(i.status, '') NOT IN ('cancelled')
  ),
  iv_sub AS (
    SELECT count(DISTINCT i.submission_id) AS n
      FROM interviews i JOIN subs ON subs.id = i.submission_id
  ),
  pl AS (
    SELECT count(*) AS n FROM placements p JOIN submissions s ON s.id = p.submission_id
     WHERE s.recruiter_id = p_user_id AND p.created_at >= now() - interval '12 months'
       AND p.ended_at IS NULL
  ),
  ps AS (SELECT granted_at FROM recruiter_partner_status WHERE user_id = p_user_id)
  SELECT jsonb_build_object(
    'submissions', (SELECT count(*) FROM subs),
    'interviews', (SELECT n FROM iv),
    'placements', (SELECT n FROM pl),
    'interview_quote', CASE WHEN (SELECT count(*) FROM subs) >= 5
                            THEN round((SELECT n FROM iv_sub)::numeric / (SELECT count(*) FROM subs), 2) END,
    'months_active', COALESCE((SELECT floor(extract(epoch FROM now() - granted_at) / 2629800)::int FROM ps), 0),
    'violation', EXISTS (SELECT 1 FROM client_contact_reports r WHERE r.recruiter_id = p_user_id AND r.status = 'confirmed')
              OR EXISTS (SELECT 1 FROM fraud_signals f WHERE f.user_id = p_user_id AND f.severity = 'critical' AND f.status = 'confirmed')
  );
$$;

CREATE OR REPLACE FUNCTION public.partner_tier_target(p_metrics jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN (p_metrics ->> 'violation')::boolean THEN 'partner'
    WHEN (p_metrics ->> 'placements')::int >= 3
         AND COALESCE((p_metrics ->> 'interview_quote')::numeric, 1) >= 0.35
         AND (p_metrics ->> 'months_active')::int >= 6 THEN 'gold'
    WHEN ((p_metrics ->> 'interviews')::int >= 5 OR (p_metrics ->> 'placements')::int >= 1)
         AND COALESCE((p_metrics ->> 'interview_quote')::numeric, 1) >= 0.20 THEN 'silver'
    ELSE 'partner'
  END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_partner_tier(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ps recruiter_partner_status%ROWTYPE;
  v_metrics jsonb;
  v_target text;
  v_new text;
  v_rank_cur int;
  v_rank_target int;
  v_rank_new int;
  v_valid timestamptz;
  v_label text;
BEGIN
  SELECT * INTO v_ps FROM recruiter_partner_status WHERE user_id = p_user_id AND ended_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_metrics := public.recruiter_tier_metrics(p_user_id);
  v_target := public.partner_tier_target(v_metrics);
  v_rank_cur := CASE v_ps.tier WHEN 'gold' THEN 2 WHEN 'silver' THEN 1 ELSE 0 END;
  v_rank_target := CASE v_target WHEN 'gold' THEN 2 WHEN 'silver' THEN 1 ELSE 0 END;

  IF v_ps.tier_override IS NOT NULL THEN
    v_new := v_ps.tier_override;
  ELSIF (v_metrics ->> 'violation')::boolean THEN
    v_new := 'partner';
  ELSIF v_rank_target >= v_rank_cur THEN
    v_new := v_target;
  ELSIF v_ps.tier_valid_until IS NULL OR v_ps.tier_valid_until <= now() THEN
    -- Abstieg nur um eine Stufe und erst, wenn die Gültigkeit abgelaufen ist.
    v_new := CASE v_ps.tier WHEN 'gold' THEN 'silver' ELSE 'partner' END;
  ELSE
    v_new := v_ps.tier;
  END IF;
  v_rank_new := CASE v_new WHEN 'gold' THEN 2 WHEN 'silver' THEN 1 ELSE 0 END;

  -- Gültigkeit: 12 Monate ab Erreichen, verlängert sich, solange die Kriterien
  -- erfüllt sind; nach einem Abstieg 90 Tage.
  v_valid := CASE
    WHEN v_new = 'partner' THEN NULL
    WHEN v_rank_target >= v_rank_new OR v_ps.tier_override IS NOT NULL THEN now() + interval '12 months'
    WHEN v_rank_new < v_rank_cur THEN now() + interval '90 days'
    ELSE v_ps.tier_valid_until
  END;

  UPDATE recruiter_partner_status
     SET tier = v_new,
         tier_since = CASE WHEN v_new IS DISTINCT FROM v_ps.tier THEN now() ELSE COALESCE(tier_since, granted_at) END,
         tier_valid_until = v_valid,
         tier_metrics = v_metrics,
         tier_checked_at = now(),
         updated_at = now()
   WHERE user_id = p_user_id;

  IF v_new IS DISTINCT FROM v_ps.tier THEN
    v_label := CASE v_new WHEN 'gold' THEN 'Gold Partner' WHEN 'silver' THEN 'Silber Partner' ELSE 'Partner' END;
    PERFORM public.notify_users(ARRAY[p_user_id], 'tier_changed',
      CASE WHEN v_rank_new > v_rank_cur THEN 'Neue Partnerstufe' ELSE 'Partnerstufe geändert' END,
      CASE WHEN v_rank_new > v_rank_cur
           THEN format('Glückwunsch: Du bist jetzt Matchunt %s. Dein Badge zeigt die neue Stufe.', v_label)
           ELSE format('Deine Partnerstufe ist jetzt Matchunt %s.', v_label) END,
      NULL, NULL);
  END IF;

  RETURN v_new;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_all_partner_tiers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  n int := 0;
BEGIN
  FOR r IN SELECT user_id FROM recruiter_partner_status WHERE ended_at IS NULL LOOP
    PERFORM public.recalculate_partner_tier(r.user_id);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.my_partner_progress()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'tier', ps.tier,
    'tier_since', COALESCE(ps.tier_since, ps.granted_at),
    'tier_valid_until', ps.tier_valid_until,
    'partner_number', ps.partner_number,
    'metrics', public.recruiter_tier_metrics(ps.user_id),
    'override', ps.tier_override IS NOT NULL
  )
    FROM recruiter_partner_status ps
   WHERE ps.user_id = auth.uid() AND ps.ended_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_partner_tier(p_user_id uuid, p_tier text, p_reason text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Nur Matchunt.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_tier IS NOT NULL AND p_tier NOT IN ('partner', 'silver', 'gold') THEN
    RAISE EXCEPTION 'Unbekannte Stufe.' USING ERRCODE = 'P0001';
  END IF;
  IF p_tier IS NOT NULL AND NULLIF(trim(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Bitte eine Begründung angeben.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE recruiter_partner_status
     SET tier_override = p_tier,
         tier_override_reason = CASE WHEN p_tier IS NULL THEN NULL ELSE trim(p_reason) END,
         tier_override_by = CASE WHEN p_tier IS NULL THEN NULL ELSE auth.uid() END,
         tier_override_at = CASE WHEN p_tier IS NULL THEN NULL ELSE now() END
   WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kein Partnerstatus für diesen Headhunter.' USING ERRCODE = 'P0001';
  END IF;
  RETURN public.recalculate_partner_tier(p_user_id);
END;
$$;

-- ----------------------------------------------------------------------------
-- 14. Headhunter: Meine Suchen
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_searches()
RETURNS TABLE (
  job_id uuid,
  title text,
  company_name text,
  location text,
  status text,
  started_at timestamptz,
  ends_at timestamptz,
  ended_at timestamptz,
  end_reason text,
  slot_until timestamptz,
  review_hold boolean,
  job_status text,
  job_paused_until timestamptz,
  job_pause_reason text,
  submissions integer,
  in_process integer,
  last_submission_at timestamptz,
  client_declaration text,
  client_declaration_id uuid,
  direct_declaration text,
  direct_declaration_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.job_id,
         j.title,
         CASE WHEN a.company_revealed_at IS NOT NULL THEN j.company_name END,
         j.location,
         a.status,
         a.activated_at,
         a.ends_at,
         a.ended_at,
         a.end_reason,
         a.slot_until,
         a.review_hold,
         j.status,
         CASE WHEN j.paused_at IS NOT NULL THEN j.pause_until END,
         CASE WHEN j.paused_at IS NOT NULL THEN j.pause_reason END,
         (SELECT count(*)::int FROM submissions s WHERE s.job_id = a.job_id AND s.recruiter_id = a.recruiter_id),
         (SELECT count(*)::int FROM submissions s WHERE s.job_id = a.job_id AND s.recruiter_id = a.recruiter_id
             AND s.stage NOT IN ('rejected', 'client_rejected', 'withdrawn', 'placed')),
         (SELECT max(s.submitted_at) FROM submissions s WHERE s.job_id = a.job_id AND s.recruiter_id = a.recruiter_id),
         (SELECT d.answer || ':' || d.status FROM recruiter_client_declarations d
           WHERE d.recruiter_id = a.recruiter_id AND d.client_key = COALESCE(j.organization_id::text, j.client_id::text)
             AND d.answer IN ('no', 'client') LIMIT 1),
         (SELECT d.id FROM recruiter_client_declarations d
           WHERE d.recruiter_id = a.recruiter_id AND d.client_key = COALESCE(j.organization_id::text, j.client_id::text)
             AND d.answer IN ('no', 'client') LIMIT 1),
         (SELECT d.status FROM recruiter_client_declarations d
           WHERE d.recruiter_id = a.recruiter_id AND d.job_id = a.job_id AND d.answer = 'direct_position'
           ORDER BY d.created_at DESC LIMIT 1),
         (SELECT d.id FROM recruiter_client_declarations d
           WHERE d.recruiter_id = a.recruiter_id AND d.job_id = a.job_id AND d.answer = 'direct_position'
           ORDER BY d.created_at DESC LIMIT 1)
    FROM recruiter_job_activations a
    JOIN jobs j ON j.id = a.job_id
   WHERE a.recruiter_id = auth.uid()
   ORDER BY CASE a.status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
            a.ends_at NULLS LAST, a.activated_at DESC;
$$;

-- ----------------------------------------------------------------------------
-- 15. Admin-Listen
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_contact_reports()
RETURNS TABLE (id uuid, created_at timestamptz, status text, channel text, note text, admin_note text,
               job_id uuid, job_title text, company_name text, recruiter_id uuid, recruiter_name text,
               reporter_name text, name_shown_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.created_at, r.status, r.channel, r.note, r.admin_note,
         r.job_id, j.title, j.company_name, r.recruiter_id, public.recruiter_display_name(r.recruiter_id),
         (SELECT p.full_name FROM profiles p WHERE p.user_id = r.reported_by),
         (SELECT a.company_revealed_at FROM recruiter_job_activations a WHERE a.job_id = r.job_id AND a.recruiter_id = r.recruiter_id)
    FROM client_contact_reports r
    LEFT JOIN jobs j ON j.id = r.job_id
   WHERE public.has_role(auth.uid(), 'admin')
   ORDER BY (r.status = 'open') DESC, r.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_report_status(p_id uuid, p_status text, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recruiter uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Nur Matchunt.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_status NOT IN ('open', 'confirmed', 'dismissed') THEN
    RAISE EXCEPTION 'Unbekannter Status.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE client_contact_reports
     SET status = p_status, admin_note = NULLIF(trim(COALESCE(p_note, '')), ''), decided_by = auth.uid(), decided_at = now()
   WHERE id = p_id
   RETURNING recruiter_id INTO v_recruiter;
  IF v_recruiter IS NOT NULL THEN
    PERFORM public.recalculate_partner_tier(v_recruiter);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_declarations()
RETURNS TABLE (id uuid, created_at timestamptz, answer text, status text, recruiter_id uuid, recruiter_name text,
               company_name text, job_id uuid, job_title text, stichtag timestamptz, contract_path text,
               assignment_path text, client_answer text, reject_reason text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.created_at, d.answer, d.status, d.recruiter_id, public.recruiter_display_name(d.recruiter_id),
         j.company_name, d.job_id, j.title, d.stichtag, d.contract_path, d.assignment_path, d.client_answer, d.reject_reason
    FROM recruiter_client_declarations d
    LEFT JOIN jobs j ON j.id = d.job_id
   WHERE public.has_role(auth.uid(), 'admin') AND d.answer IN ('client', 'direct_position')
   ORDER BY (d.status = 'pending') DESC, d.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_job_changes()
RETURNS TABLE (job_id uuid, title text, company_name text, state text, paused_at timestamptz, pause_until timestamptz,
               pause_reason text, closed_at timestamptz, closed_reason text, closed_note text,
               hire_candidate text, hire_start date, hire_salary integer, not_matchunt_confirmed boolean,
               callback_requested_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT j.id, j.title, j.company_name,
         CASE WHEN j.status IN ('closed', 'filled') THEN j.status WHEN j.paused_at IS NOT NULL THEN 'paused' ELSE 'callback' END,
         j.paused_at, j.pause_until, j.pause_reason, j.closed_at, j.closed_reason, j.closed_note,
         (SELECT c.full_name FROM submissions s JOIN candidates c ON c.id = s.candidate_id WHERE s.id = j.closed_hire_submission_id),
         j.closed_hire_start, j.closed_hire_salary, j.closed_not_matchunt_confirmed, j.callback_requested_at
    FROM jobs j
   WHERE public.has_role(auth.uid(), 'admin')
     AND (j.paused_at IS NOT NULL
          OR (j.status IN ('closed', 'filled') AND j.closed_at >= now() - interval '90 days')
          OR j.callback_requested_at >= now() - interval '90 days')
   ORDER BY GREATEST(COALESCE(j.callback_requested_at, '-infinity'), COALESCE(j.closed_at, '-infinity'), COALESCE(j.paused_at, '-infinity')) DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_partner_tiers()
RETURNS TABLE (user_id uuid, full_name text, company_name text, partner_number text, tier text, tier_since timestamptz,
               tier_valid_until timestamptz, tier_override text, tier_override_reason text, metrics jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ps.user_id, p.full_name, p.company_name, ps.partner_number, ps.tier, COALESCE(ps.tier_since, ps.granted_at),
         ps.tier_valid_until, ps.tier_override, ps.tier_override_reason, public.recruiter_tier_metrics(ps.user_id)
    FROM recruiter_partner_status ps
    LEFT JOIN profiles p ON p.user_id = ps.user_id
   WHERE public.has_role(auth.uid(), 'admin') AND ps.ended_at IS NULL
   ORDER BY CASE ps.tier WHEN 'gold' THEN 0 WHEN 'silver' THEN 1 ELSE 2 END, p.full_name;
$$;

-- ----------------------------------------------------------------------------
-- 16. Wartung: Ablauf, Erinnerungen, Pausen-Ende
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_search_maintenance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  -- Hinweis 5 Tage vor Ablauf der Frist für die erste Einreichung
  FOR r IN
    SELECT a.id, a.recruiter_id, a.job_id, a.ends_at, j.title
      FROM recruiter_job_activations a JOIN jobs j ON j.id = a.job_id
     WHERE a.status = 'active' AND NOT COALESCE(a.has_submitted, false)
       AND a.reminder_sent_at IS NULL AND a.ends_at > now() AND a.ends_at <= now() + interval '5 days'
  LOOP
    PERFORM public.notify_users(ARRAY[r.recruiter_id], 'search_reminder', 'Deine Suche läuft bald ab',
      format('Noch %s Tage für deine erste Einreichung bei „%s“.',
             GREATEST(1, ceil(extract(epoch FROM r.ends_at - now()) / 86400))::int, r.title),
      'job', r.job_id);
    UPDATE recruiter_job_activations SET reminder_sent_at = now() WHERE id = r.id;
  END LOOP;

  -- Ablauf ohne Einreichung
  UPDATE recruiter_job_activations
     SET status = 'ended', ended_at = now(), end_reason = 'expired', slot_until = NULL
   WHERE status = 'active' AND NOT COALESCE(has_submitted, false) AND ends_at <= now();

  -- Pause endet in 3 Tagen
  FOR r IN
    SELECT id, title, pause_until FROM jobs
     WHERE paused_at IS NOT NULL AND pause_until IS NOT NULL AND pause_reminder_sent_at IS NULL
       AND pause_until > now() AND pause_until <= now() + interval '3 days'
  LOOP
    PERFORM public.notify_users(ARRAY(SELECT public.job_client_audience(r.id)), 'pause_ending', 'Ihre Pause endet bald',
      format('Die Pause für „%s“ endet am %s. Danach suchen die Headhunter weiter. Verlängern oder schließen können Sie über „Stelle verwalten“.',
             r.title, to_char(r.pause_until AT TIME ZONE 'Europe/Berlin', 'DD.MM.')),
      'job', r.id);
    UPDATE jobs SET pause_reminder_sent_at = now() WHERE id = r.id;
  END LOOP;

  -- Pause vorbei: Stelle läuft wieder an
  FOR r IN
    SELECT id, title FROM jobs
     WHERE paused_at IS NOT NULL AND pause_until IS NOT NULL AND pause_until <= now() AND status = 'published'
  LOOP
    UPDATE jobs SET paused_at = NULL, pause_until = NULL, pause_reason = NULL, pause_reminder_sent_at = NULL WHERE id = r.id;
    PERFORM public.notify_users(ARRAY(SELECT public.job_client_audience(r.id)), 'pause_ended', 'Ihre Stelle läuft wieder',
      format('„%s“ ist wieder aktiv. Die Headhunter suchen weiter.', r.title), 'job', r.id);
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('search-maintenance') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'search-maintenance');
    PERFORM cron.schedule('search-maintenance', '7 * * * *', 'select public.run_search_maintenance()');
    PERFORM cron.unschedule('partner-tiers-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'partner-tiers-daily');
    PERFORM cron.schedule('partner-tiers-daily', '40 3 * * *', 'select public.recalculate_all_partner_tiers()');
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 17. recruiter_jobs_view: Name ab „Ich suche“, Pause sichtbar, vertrauliche Suche
--     Gleiche Spalten wie 20260929100000, Reveal-Regel erweitert, vier Spalten angehängt.
-- ----------------------------------------------------------------------------
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
  j.confidential_search
FROM jobs j
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
  'Recruiter-only published jobs with masked briefing fields. Company name and raw texts are revealed '
  'from „Ich suche“ (activation with company_revealed_at) or after opt-in. Paused jobs stay visible with '
  'paused_at/pause_until. Confidential searches are visible to Gold Partners only. No raw intake payload, '
  'client identifier or private draft is exposed.';

-- ----------------------------------------------------------------------------
-- 18. Rechte für die Funktionen
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.run_search_maintenance() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalculate_all_partner_tiers() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalculate_partner_tier(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_users(uuid[], text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_admins(text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recruiter_tier_metrics(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.start_job_search(uuid, boolean),
  public.end_job_search(uuid),
  public.my_search_capacity(),
  public.my_searches(),
  public.answer_client_question(uuid, text),
  public.attach_declaration_proof(uuid, text, text),
  public.get_job_searchers(uuid),
  public.get_jobs_searcher_counts(uuid[]),
  public.report_direct_contact(uuid, uuid, text, text),
  public.get_job_direct_position_requests(uuid),
  public.client_answer_direct_position(uuid, text),
  public.client_pause_job(uuid, timestamptz, text),
  public.client_resume_job(uuid),
  public.client_close_job(uuid, text, text, uuid, date, integer, boolean),
  public.client_request_callback(uuid, text),
  public.my_partner_progress(),
  public.admin_decide_declaration(uuid, text, text),
  public.admin_set_partner_tier(uuid, text, text),
  public.admin_contact_reports(),
  public.admin_set_report_status(uuid, text, text),
  public.admin_declarations(),
  public.admin_job_changes(),
  public.admin_partner_tiers()
TO authenticated;

-- Bestehende Partner sofort einstufen.
SELECT public.recalculate_all_partner_tiers();

NOTIFY pgrst, 'reload schema';

COMMIT;
