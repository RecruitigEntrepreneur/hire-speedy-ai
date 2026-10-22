-- ============================================================================
-- Kandidatenprofil für Kunden (09.10.2026)
--  1. Einschätzung zur Stelle entsteht automatisch: Auslöser beim Einreichen
--     ohne app.settings (die gibt es in diesem Projekt nicht, vgl. 20260926151000),
--     dazu Nachholen und Sicherheitsnetz alle 10 Minuten.
--  2. Angaben aus dem Gespräch mit dem Headhunter für den Kunden (anonymisiert).
--  3. Ausbildung für den Kunden (Hochschule erst nach Interview-Zusage).
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 1a. Adresse der Functions (nicht geheim; lokal überschreibbar) und eigener Schlüssel
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS private.app_settings (
  key   text PRIMARY KEY,
  value text NOT NULL
);
REVOKE ALL ON private.app_settings FROM PUBLIC;
REVOKE ALL ON private.app_settings FROM anon, authenticated;
-- Leer: Die Functions-Adresse steht als Standard in request_fit_assessment.
-- Lokal lässt sie sich hier mit key = 'functions_url' überschreiben.

CREATE TABLE IF NOT EXISTS private.cron_tokens (
  name       text PRIMARY KEY,
  token      text NOT NULL CHECK (length(token) >= 32),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Schlüssel je Hintergrundjob, angelegt beim ersten Gebrauch (nicht in der Migration).
-- Gleiche Funktion wie in 20261021090000_matchunt_liga.sql; mehrfach ausführbar.
CREATE OR REPLACE FUNCTION private.cron_token_for(_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
DECLARE
  v_token text;
BEGIN
  INSERT INTO private.cron_tokens (name, token)
  VALUES (_name, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
  ON CONFLICT (name) DO NOTHING;
  SELECT token INTO v_token FROM private.cron_tokens WHERE name = _name;
  RETURN v_token;
END;
$$;
REVOKE ALL ON FUNCTION private.cron_token_for(text) FROM PUBLIC;

-- Versuche je Einreichung, damit ein Fehler nicht alle 10 Minuten wiederholt wird.
CREATE TABLE IF NOT EXISTS private.fit_assessment_attempts (
  submission_id uuid PRIMARY KEY,
  attempts      integer NOT NULL DEFAULT 0,
  last_at       timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.fit_assessment_attempts FROM PUBLIC;
REVOKE ALL ON private.fit_assessment_attempts FROM anon, authenticated;
-- Nur der Server (Edge Functions, Cron) darf die privaten Tabellen nutzen.
GRANT USAGE ON SCHEMA private TO service_role;
GRANT ALL ON private.app_settings, private.cron_tokens, private.fit_assessment_attempts TO service_role;

-- Ruft assess-candidate-fit für eine Einreichung auf (fire and forget).
CREATE OR REPLACE FUNCTION private.request_fit_assessment(p_submission_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_url   text;
  v_token text;
BEGIN
  SELECT COALESCE((SELECT value FROM private.app_settings WHERE key = 'functions_url'),
                  'https://dngycrrhbnwdohbftpzq.supabase.co/functions/v1')
    INTO v_url;
  v_token := private.cron_token_for('fit-assessment');
  IF v_url IS NULL OR v_token IS NULL THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := v_url || '/assess-candidate-fit',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-token', v_token),
    body := jsonb_build_object('submissionId', p_submission_id)
  );
  INSERT INTO private.fit_assessment_attempts (submission_id, attempts, last_at)
  VALUES (p_submission_id, 1, now())
  ON CONFLICT (submission_id) DO UPDATE SET attempts = private.fit_assessment_attempts.attempts + 1, last_at = now();
END;
$$;
REVOKE ALL ON FUNCTION private.request_fit_assessment(uuid) FROM PUBLIC;

-- Nachhol-Lauf nur, solange es Arbeit gibt: startet bei neuer Einreichung,
-- run_fit_assessment_fill schaltet ihn ab, sobald nichts mehr offen ist.
CREATE OR REPLACE FUNCTION private.ensure_fit_assessment_fill()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fit-assessment-fill') THEN
    PERFORM cron.schedule('fit-assessment-fill', '*/10 * * * *', 'SELECT public.run_fit_assessment_fill()');
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.ensure_fit_assessment_fill() FROM PUBLIC;

-- Auslöser beim Einreichen: darf das Einreichen nie verhindern.
CREATE OR REPLACE FUNCTION public.trigger_generate_fit_assessment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  BEGIN
    PERFORM private.request_fit_assessment(NEW.id);
    -- Netz für Fehlschläge: Nachhol-Lauf an, bis die Einschätzung da ist.
    PERFORM private.ensure_fit_assessment_fill();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Einschätzung zur Stelle nicht angestoßen: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_fit_assessment ON public.submissions;
CREATE TRIGGER trg_generate_fit_assessment
  AFTER INSERT ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_generate_fit_assessment();

-- Nachholen und Netz: offene Einreichungen ohne Einschätzung, höchstens 5 je Lauf,
-- höchstens 5 Versuche, frühestens eine Stunde nach dem letzten.
CREATE OR REPLACE FUNCTION public.run_fit_assessment_fill()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  r record;
  n integer := 0;
BEGIN
  FOR r IN
    SELECT s.id
      FROM submissions s
      LEFT JOIN private.fit_assessment_attempts t ON t.submission_id = s.id
     WHERE NOT EXISTS (SELECT 1 FROM candidate_fit_assessments a WHERE a.submission_id = s.id)
       AND COALESCE(s.status, '') NOT IN ('rejected', 'client_rejected', 'withdrawn', 'hired', 'placed')
       AND COALESCE(s.stage, '') NOT IN ('rejected', 'client_rejected', 'withdrawn', 'hired', 'placed')
       AND s.submitted_at > now() - interval '180 days'
       AND (t.submission_id IS NULL OR (t.attempts < 5 AND t.last_at < now() - interval '1 hour'))
     ORDER BY s.submitted_at DESC
     LIMIT 5
  LOOP
    PERFORM private.request_fit_assessment(r.id);
    n := n + 1;
  END LOOP;
  -- Nichts mehr offen (auch keine späteren Versuche): Lauf abschalten.
  IF NOT EXISTS (
    SELECT 1
      FROM submissions s
      LEFT JOIN private.fit_assessment_attempts t ON t.submission_id = s.id
     WHERE NOT EXISTS (SELECT 1 FROM candidate_fit_assessments a WHERE a.submission_id = s.id)
       AND COALESCE(s.status, '') NOT IN ('rejected', 'client_rejected', 'withdrawn', 'hired', 'placed')
       AND COALESCE(s.stage, '') NOT IN ('rejected', 'client_rejected', 'withdrawn', 'hired', 'placed')
       AND s.submitted_at > now() - interval '180 days'
       AND (t.submission_id IS NULL OR t.attempts < 5)
  ) AND EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fit-assessment-fill') THEN
    PERFORM cron.unschedule('fit-assessment-fill');
  END IF;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.run_fit_assessment_fill() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_fit_assessment_fill() FROM anon, authenticated;

-- Kein dauerhafter Zeitplan: Der Lauf startet bei der nächsten Einreichung
-- (ensure_fit_assessment_fill) und arbeitet dabei auch ältere offene Einreichungen ab.

-- ----------------------------------------------------------------------------
-- 2. Wunschgehalt als Spanne: aus Freitext („85-95k“, „90.000“) oder Akte,
--    auf 5.000 € gerundet. Heutiges Gehalt und Mindestgehalt bleiben beim Headhunter.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.salary_wish_band(p_text text, p_fallback_min numeric, p_fallback_max numeric)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  nums numeric[];
  lo numeric;
  hi numeric;
BEGIN
  IF p_text IS NOT NULL THEN
    SELECT array_agg(CASE WHEN v < 1000 THEN v * 1000 ELSE v END ORDER BY ord)
      INTO nums
      FROM (
        SELECT replace(replace(m[1], '.', ''), ',', '')::numeric AS v, ord
          FROM regexp_matches(p_text, '(\d{1,3}(?:[.,]\d{3})+|\d+)', 'g') WITH ORDINALITY AS x(m, ord)
      ) q
     WHERE v >= 10;
  END IF;
  IF nums IS NOT NULL AND array_length(nums, 1) >= 1 THEN
    lo := nums[1];
    hi := COALESCE(nums[2], nums[1]);
  ELSE
    lo := COALESCE(p_fallback_min, p_fallback_max);
    hi := COALESCE(p_fallback_max, p_fallback_min);
  END IF;
  IF lo IS NULL OR lo < 10000 THEN
    RETURN NULL;
  END IF;
  IF hi < lo THEN hi := lo; END IF;
  lo := floor(lo / 5000) * 5000;
  hi := ceil(hi / 5000) * 5000;
  IF hi - lo < 10000 THEN hi := lo + 10000; END IF;
  RETURN (lo / 1000)::int || '–' || (hi / 1000)::int || ' T€';
END;
$$;

-- ----------------------------------------------------------------------------
-- 2b. Firmen eines Kandidaten als Ersetzungsliste: ganze Namen und ihre
--     markanten Einzelwörter („Fresenius“ aus „Fresenius Medical Care“),
--     ohne Rechtsformen und Allerweltswörter.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.employer_tokens(p_candidate_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH namen AS (
    SELECT DISTINCT btrim(x) AS n FROM (
      SELECT company AS x FROM candidates WHERE id = p_candidate_id
      UNION
      SELECT company_name FROM candidate_experiences WHERE candidate_id = p_candidate_id
    ) q WHERE x IS NOT NULL AND length(btrim(x)) >= 3
  ), woerter AS (
    SELECT DISTINCT w FROM namen, regexp_split_to_table(n, '[\s,.&/()-]+') AS w
     WHERE length(w) >= 4
       AND lower(w) NOT IN ('gmbh', 'mbh', 'group', 'gruppe', 'holding', 'international', 'deutschland', 'germany',
                            'medical', 'care', 'klinik', 'kliniken', 'klinikum', 'services', 'service', 'solutions',
                            'technologies', 'technology', 'systems', 'consulting', 'partner', 'partners', 'management',
                            'healthcare', 'health', 'pharma', 'software', 'digital', 'europe', 'global', 'und', 'stiftung')
  )
  SELECT COALESCE(array_agg(t ORDER BY length(t) DESC), ARRAY[]::text[])
    FROM (SELECT n AS t FROM namen UNION SELECT w FROM woerter) z;
$$;

-- ----------------------------------------------------------------------------
-- 3. Gespräch mit dem Headhunter für den Kunden
--    Freitexte ohne Namen und Firmen, solange die Identität gesperrt ist.
--    Nicht enthalten: heutiges Gehalt, Mindestgehalt (Schmerzgrenze), gesperrte
--    Firmen, andere Bewerbungen, Empfehlungsstufe, Kritik am Arbeitgeber,
--    Gegenangebot-Einschätzung. Ersetzte Notiz-Datensätze zählen nicht.
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.client_candidate_interview_view;
CREATE VIEW public.client_candidate_interview_view AS
SELECT
  s.id AS submission_id,
  s.job_id,
  n.interview_date,
  n.interview_type,
  n.change_motivation_tags,
  n.offer_requirements,
  n.notice_period,
  n.earliest_start_date,
  n.leadership_scope,
  n.leadership_team_size,
  -- Nur das Wunschgehalt. salary_expectation_min ist die Schmerzgrenze (candidateDossier.ts).
  public.salary_wish_band(n.salary_desired, c.expected_salary, NULL) AS salary_wish,
  CASE WHEN s.identity_unlocked THEN COALESCE(NULLIF(btrim(n.summary_motivation), ''), n.change_motivation)
       ELSE public.scrub_identity_tokens(public.scrub_identity_tokens(COALESCE(NULLIF(btrim(n.summary_motivation), ''), n.change_motivation), nm.toks, 'der Kandidat'), emp.toks, '[ein Unternehmen]')
  END AS change_motivation,
  CASE WHEN s.identity_unlocked THEN n.why_now
       ELSE public.scrub_identity_tokens(public.scrub_identity_tokens(n.why_now, nm.toks, 'der Kandidat'), emp.toks, '[ein Unternehmen]')
  END AS why_now
FROM submissions s
JOIN candidates c ON c.id = s.candidate_id
LEFT JOIN LATERAL (
  SELECT * FROM candidate_interview_notes x
   WHERE x.candidate_id = s.candidate_id
     AND COALESCE(x.status, '') <> 'superseded'
   ORDER BY x.updated_at DESC NULLS LAST, x.created_at DESC
   LIMIT 1
) n ON true
CROSS JOIN LATERAL (
  SELECT ARRAY[c.full_name] || ARRAY(
    SELECT p FROM unnest(string_to_array(COALESCE(c.full_name, ''), ' ')) p WHERE length(p) >= 3
  ) AS toks
) nm
CROSS JOIN LATERAL (SELECT public.employer_tokens(c.id) AS toks) emp
WHERE public.can_access_job(s.job_id)
  AND COALESCE(n.presentation_consent, true);

GRANT SELECT ON public.client_candidate_interview_view TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. Ausbildung für den Kunden (Hochschule erst nach Interview-Zusage)
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.client_candidate_education_view;
CREATE VIEW public.client_candidate_education_view AS
SELECT
  s.id AS submission_id,
  e.id,
  e.degree,
  e.field_of_study,
  e.graduation_year,
  CASE WHEN s.identity_unlocked THEN e.institution END AS institution,
  e.sort_order
FROM submissions s
JOIN candidate_educations e ON e.candidate_id = s.candidate_id
WHERE public.can_access_job(s.job_id);

GRANT SELECT ON public.client_candidate_education_view TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. Erwähnungen in Team-Notizen benachrichtigen
--    Kunden durften notifications nie selbst anlegen (keine INSERT-Policy) -- die
--    @-Erwähnung lief still ins Leere. Jetzt geprüft: nur wer die Stelle sieht,
--    und nur Kollegen, die sie ebenfalls sehen.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_candidate_mention(p_submission_id uuid, p_user_ids uuid[], p_title text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job   uuid;
  v_title text;
  v_from  text;
  n       integer;
BEGIN
  SELECT s.job_id, j.title INTO v_job, v_title
    FROM submissions s JOIN jobs j ON j.id = s.job_id
   WHERE s.id = p_submission_id;
  IF v_job IS NULL OR NOT public.can_access_job(v_job) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diese Einreichung' USING ERRCODE = '42501';
  END IF;
  SELECT NULLIF(btrim(full_name), '') INTO v_from FROM profiles WHERE user_id = auth.uid();

  INSERT INTO notifications (user_id, type, title, message, related_type, related_id)
  SELECT u, 'comment_mention', left(COALESCE(NULLIF(btrim(p_title), ''), 'Sie wurden erwähnt'), 120),
         COALESCE(v_from, 'Ein Teammitglied') || ' hat Sie zu einem Kandidaten (' || v_title || ') erwähnt.',
         'submission', p_submission_id
    FROM unnest(p_user_ids) AS u
   WHERE u <> auth.uid() AND public.can_access_job(v_job, u);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_candidate_mention(uuid, uuid[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_candidate_mention(uuid, uuid[], text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. Werdegang für den Kunden: Tätigkeiten vor der Freigabe ohne Namen und Firmen
--    statt gar nicht (bisher NULL). Gleiche Bereinigung wie cv_ai_summary.
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.client_candidate_experiences_view;
CREATE VIEW public.client_candidate_experiences_view AS
SELECT
  ce.id,
  s.id AS submission_id,
  ce.candidate_id,
  ce.job_title,
  ce.start_date,
  ce.end_date,
  ce.is_current,
  ce.sort_order,
  s.identity_unlocked,
  CASE WHEN s.identity_unlocked THEN ce.company_name END AS company_name,
  CASE WHEN s.identity_unlocked THEN ce.description
       ELSE public.scrub_identity_tokens(public.scrub_identity_tokens(ce.description, nm.toks, 'der Kandidat'), emp.toks, '[ein Unternehmen]')
  END AS description
FROM candidate_experiences ce
JOIN submissions s ON s.candidate_id = ce.candidate_id
JOIN jobs j ON j.id = s.job_id
JOIN candidates c ON c.id = ce.candidate_id
CROSS JOIN LATERAL (
  SELECT ARRAY[c.full_name] || ARRAY(
    SELECT p FROM unnest(string_to_array(COALESCE(c.full_name, ''), ' ')) p WHERE length(p) >= 3
  ) AS toks
) nm
CROSS JOIN LATERAL (SELECT public.employer_tokens(c.id) AS toks) emp
WHERE public.can_access_job(s.job_id);

GRANT SELECT ON public.client_candidate_experiences_view TO authenticated, service_role;
