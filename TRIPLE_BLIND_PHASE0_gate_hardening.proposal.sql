-- ============================================================================
-- TRIPLE-BLIND · PHASE 0 — GATE HARDENING  (VORSCHLAG / NOCH NICHT ANGEWENDET)
-- ============================================================================
-- Status:  ENTWURF zum Review. Liegt ABSICHTLICH im Repo-Root, NICHT in
--          supabase/migrations/, damit es beim nächsten Lovable-Deploy NICHT
--          automatisch ausgeführt wird. Zum Anwenden später nach
--          supabase/migrations/20260618xxxxxx_triple_blind_phase0_gate.sql
--          verschieben (Timestamp anpassen) und deployen.
--
-- Ziel dieser Migration (rein DB-seitig, additiv):
--   1. reveal_events  — unveränderlicher Consent-/Reveal-Ledger.
--   2. reveal_identity(...) — die EINZIGE sanktionierte Reveal-Funktion.
--   3. protect_reveal_columns — Guard-Trigger: kein Client darf Reveal-/Consent-
--      Spalten oder reveal-implizierende stage/status-Werte selbst setzen.
--   4. sync_identity_unlock_with_stage — Status-vs-Stage-Landmine entschärft
--      (Trigger prüft nur noch `stage`, nicht mehr COALESCE(stage,status)).
--
-- Consent-Modell (Entscheidung 2026-06-18): KANDIDATEN-KLICK = GOLD-STANDARD.
--   - basis='candidate_link_accept'      → Service-Role-Edge-Fn (Kandidat klickt
--                                           E-Mail-Link in process-interview-response)
--   - basis='recruiter_asserted_opt_in'  → Recruiter, NUR mit dokumentiertem proof
--   - basis='admin_override'             → Admin
--
-- WICHTIG — begleitende Code-Änderungen, die mit dieser Migration zusammen
-- ausgerollt werden MÜSSEN (sonst bricht der bestehende Opt-In-Flow):
--   (A) src/hooks/useIdentityUnlock.ts respondToOptIn(): NICHT mehr direkt
--       `identity_unlocked=true` schreiben (würde am Guard scheitern), sondern
--       supabase.rpc('reveal_identity', { p_submission_id, p_basis:
--       'recruiter_asserted_opt_in', p_actor: user.id, p_proof: {...} }).
--   (B) supabase/functions/process-interview-response (accept): statt direktem
--       UPDATE der Reveal-Spalten → reveal_identity(basis='candidate_link_accept',
--       proof = { response_token_hash, slot, accepted_at }).
--   (C) supabase/functions/send-interview-invitation: getUser() + Abgleich gegen
--       job.client_id (IDOR-Fix) — reiner Edge-Fn-Change, hier nicht enthalten.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Reveal-/Consent-Ledger (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reveal_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  basis         text NOT NULL CHECK (basis IN
                  ('candidate_link_accept','recruiter_asserted_opt_in','admin_override')),
  actor         uuid,                       -- auth.users.id des Auslösers (kann NULL sein: Service)
  proof         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reveal_events_submission
  ON public.reveal_events(submission_id, created_at DESC);

ALTER TABLE public.reveal_events ENABLE ROW LEVEL SECURITY;

-- Recruiter/Client dürfen die Reveal-Historie ihrer eigenen Submissions LESEN
-- (Basis für DSGVO-Auskunft / Trust-Badge in Phase 3). Schreiben NUR über
-- reveal_identity (SECURITY DEFINER) — daher KEINE INSERT-Policy.
DROP POLICY IF EXISTS "Parties can view reveal history" ON public.reveal_events;
CREATE POLICY "Parties can view reveal history" ON public.reveal_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.jobs j ON j.id = s.job_id
      WHERE s.id = reveal_events.submission_id
        AND (s.recruiter_id = auth.uid() OR j.client_id = auth.uid()
             OR public.has_role(auth.uid(),'admin'))
    )
  );

-- ---------------------------------------------------------------------------
-- 2) reveal_identity(...) — die EINZIGE sanktionierte Reveal-Funktion.
--    SECURITY DEFINER (Owner postgres): das von ihr ausgeführte UPDATE läuft
--    als postgres und passiert damit den Guard-Trigger (current_user=postgres).
--    Direkte Client-UPDATEs (current_user='authenticated') werden geblockt.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reveal_identity(
  p_submission_id uuid,
  p_basis         text,
  p_actor         uuid  DEFAULT NULL,
  p_proof         jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller     uuid := auth.uid();   -- echter Endnutzer (NULL bei reiner Service-Role)
  v_jwt_role   text := COALESCE(
                   NULLIF(current_setting('request.jwt.claims', true), '')::json ->> 'role',
                   '');
  v_is_service boolean := v_jwt_role = 'service_role';
  v_is_admin   boolean := v_caller IS NOT NULL AND public.has_role(v_caller, 'admin');
  v_is_recruiter boolean := EXISTS (
                   SELECT 1 FROM public.submissions
                   WHERE id = p_submission_id AND recruiter_id = v_caller);
BEGIN
  IF p_basis NOT IN ('candidate_link_accept','recruiter_asserted_opt_in','admin_override') THEN
    RAISE EXCEPTION 'reveal_identity: invalid basis %', p_basis;
  END IF;

  -- Autorisierung: nur Service-Role, Admin oder der zuständige Recruiter.
  IF NOT (v_is_service OR v_is_admin OR v_is_recruiter) THEN
    RAISE EXCEPTION 'reveal_identity: not authorized for submission %', p_submission_id;
  END IF;

  -- Gold-Standard: recruiter-behaupteter Opt-In nur mit dokumentiertem Proof.
  IF v_is_recruiter AND NOT (v_is_service OR v_is_admin) THEN
    IF p_basis <> 'recruiter_asserted_opt_in' OR p_proof IS NULL OR p_proof = '{}'::jsonb THEN
      RAISE EXCEPTION
        'reveal_identity: recruiter reveal requires basis=recruiter_asserted_opt_in and non-empty proof';
    END IF;
  END IF;

  -- Idempotenter Reveal. Reveal wird NIE zurückgenommen.
  UPDATE public.submissions SET
    identity_unlocked     = TRUE,
    identity_revealed     = TRUE,                                  -- Legacy synchron
    unlocked_at           = COALESCE(unlocked_at, now()),
    revealed_at           = COALESCE(revealed_at, now()),
    unlocked_by           = COALESCE(unlocked_by, p_actor, v_caller),
    consent_confirmed     = TRUE,
    consent_confirmed_at  = COALESCE(consent_confirmed_at, now()),
    company_revealed      = TRUE,
    company_revealed_at   = COALESCE(company_revealed_at, now())
  WHERE id = p_submission_id
    AND identity_unlocked IS DISTINCT FROM TRUE;

  -- Ledger immer schreiben (auch wenn schon revealed → vollständige Historie).
  INSERT INTO public.reveal_events(submission_id, basis, actor, proof)
  VALUES (p_submission_id, p_basis, COALESCE(p_actor, v_caller), COALESCE(p_proof, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.reveal_identity(uuid, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.reveal_identity(uuid, text, uuid, jsonb)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) Guard-Trigger: kein Client darf Reveal selbst auslösen.
--    SECURITY INVOKER (default) → current_user spiegelt den echten Aufrufer:
--      'authenticated'  = Client/Recruiter via PostgREST  → geblockt
--      'service_role'   = Service-Key                      → erlaubt
--      'postgres'       = Aufruf aus reveal_identity()     → erlaubt
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_reveal_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  -- Stufen, die einen Reveal implizieren (sowohl als stage- als auch status-Wert).
  reveal_stages constant text[] := ARRAY[
    'candidate_opted_in','interview_scheduled','interview',
    'second_interview','offer','hired','placed'];
  is_privileged boolean :=
       current_user IN ('service_role','supabase_admin','postgres')
    OR (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'));
BEGIN
  IF is_privileged THEN
    RETURN NEW;
  END IF;

  -- (a) Reveal-/Consent-Spalten sind serverkontrolliert.
  IF NEW.identity_unlocked     IS DISTINCT FROM OLD.identity_unlocked
  OR NEW.identity_revealed     IS DISTINCT FROM OLD.identity_revealed
  OR NEW.unlocked_at           IS DISTINCT FROM OLD.unlocked_at
  OR NEW.revealed_at           IS DISTINCT FROM OLD.revealed_at
  OR NEW.unlocked_by           IS DISTINCT FROM OLD.unlocked_by
  OR NEW.consent_confirmed     IS DISTINCT FROM OLD.consent_confirmed
  OR NEW.consent_confirmed_at  IS DISTINCT FROM OLD.consent_confirmed_at
  OR NEW.company_revealed      IS DISTINCT FROM OLD.company_revealed
  OR NEW.company_revealed_at   IS DISTINCT FROM OLD.company_revealed_at
  OR NEW.full_access_granted   IS DISTINCT FROM OLD.full_access_granted
  OR NEW.full_access_granted_at IS DISTINCT FROM OLD.full_access_granted_at
  THEN
    RAISE EXCEPTION
      'Triple-Blind: reveal/consent columns are server-controlled (use reveal_identity()).';
  END IF;

  -- (b) Reveal-implizierende stage/status-Transition nur über Server.
  IF (NEW.stage  IS DISTINCT FROM OLD.stage  AND NEW.stage  = ANY(reveal_stages))
  OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status = ANY(reveal_stages))
  THEN
    RAISE EXCEPTION
      'Triple-Blind: reveal-implying stage/status transition must go through reveal_identity().';
  END IF;

  RETURN NEW;
END;
$$;

-- Muss VOR sync_identity_unlock laufen (Triggernamen alphabetisch:
-- "protect_reveal_columns" < "trg_sync_identity_unlock"). Beide BEFORE UPDATE.
DROP TRIGGER IF EXISTS protect_reveal_columns ON public.submissions;
CREATE TRIGGER protect_reveal_columns
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_reveal_columns();

-- ---------------------------------------------------------------------------
-- 4) Status-vs-Stage-Landmine entschärfen.
--    Vorher: eff := COALESCE(NEW.stage, NEW.status)  → ein UPDATE mit nur
--    status='interview' (stage NULL) löste einen Reveal aus. Jetzt: Trigger
--    prüft ausschließlich `stage`. (Der Guard verhindert zusätzlich, dass ein
--    Client `stage` überhaupt auf einen Reveal-Wert setzt.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_identity_unlock_with_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  opted_in boolean :=
       NEW.stage IN ('candidate_opted_in','interview_scheduled','interview',
                     'second_interview','offer','hired','placed')
    OR NEW.identity_revealed IS TRUE;
BEGIN
  IF opted_in AND NEW.identity_unlocked IS DISTINCT FROM TRUE THEN
    NEW.identity_unlocked    := TRUE;
    NEW.identity_revealed    := TRUE;
    NEW.unlocked_at          := COALESCE(NEW.unlocked_at, now());
    NEW.revealed_at          := COALESCE(NEW.revealed_at, now());
    NEW.consent_confirmed    := TRUE;
    NEW.consent_confirmed_at := COALESCE(NEW.consent_confirmed_at, now());
  END IF;
  RETURN NEW;
END;
$$;
-- Trigger trg_sync_identity_unlock bleibt unverändert (BEFORE INSERT/UPDATE).

COMMIT;

-- ============================================================================
-- VERIFIKATION nach Anwendung (manuell / als pgTAP in Phase 4):
--
--  -- 1. Client kann sich NICHT selbst freischalten (muss FEHLER werfen):
--  --    als 'authenticated'-Rolle des Clients:
--  UPDATE submissions SET identity_unlocked = true WHERE id = '<eigene-job-submission>';
--  --    erwartet: ERROR 'reveal/consent columns are server-controlled'
--
--  -- 2. Client kann stage nicht auf Reveal-Wert setzen (muss FEHLER werfen):
--  UPDATE submissions SET stage = 'candidate_opted_in' WHERE id = '<...>';
--  --    erwartet: ERROR 'reveal-implying stage/status transition ...'
--
--  -- 3. Nur status='interview' ohne stage löst KEINEN Reveal mehr aus:
--  --    (als Service-Role) — identity_unlocked bleibt false.
--
--  -- 4. reveal_identity als Recruiter ohne Proof → FEHLER; mit Proof → ok + Ledger-Zeile.
--  SELECT reveal_identity('<sub>','recruiter_asserted_opt_in', auth.uid(), '{}'::jsonb);   -- ERROR
--  SELECT reveal_identity('<sub>','recruiter_asserted_opt_in', auth.uid(),
--                         '{"channel":"phone","at":"2026-06-18T10:00:00Z"}');               -- ok
--  SELECT * FROM reveal_events WHERE submission_id = '<sub>';                                -- 1 Zeile
-- ============================================================================
