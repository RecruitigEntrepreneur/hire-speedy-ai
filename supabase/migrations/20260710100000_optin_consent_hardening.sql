-- ============================================================================
-- OPT-IN CONSENT HARDENING (Triple-Blind Einladungsprozess)
-- ============================================================================
-- Zwei Fixes am Reveal-Trigger aus 20260616150000_opt_in_reveals_identity.sql:
--
-- 1. STATUS-LANDMINE: Der bloße Status 'interview' stand in der Auto-Reveal-
--    Liste — beide Anfrage-Pfade setzen aber status='interview' bereits bei
--    der ANFRAGE (vor jedem Opt-In). Nur der COALESCE-Vorrang von
--    stage='interview_requested' verhinderte den Sofort-Reveal. Jeder Pfad,
--    der status ohne stage schreibt, hätte Identitäten ohne Opt-In enthüllt.
--    → 'interview' wird aus der Liste entfernt. Opt-In-Stufen sind explizit:
--    candidate_opted_in, interview_scheduled, second_interview, offer, hired,
--    placed. (Bereits freigegebene Submissions bleiben frei — kein Rollback.)
--
-- 2. CONSENT-PROTOKOLL: consent_confirmed wurde vom Trigger pauschal auf true
--    gesetzt — eine behauptete, nicht eingeholte Einwilligung. Neu:
--    - process-interview-response verlangt jetzt aktive Zustimmung des
--      Kandidaten (Checkbox + Firmenname + Umfang) und schreibt consent_meta
--      mit Textversion und Zeitpunkt.
--    - Der Trigger setzt consent_confirmed weiterhin (Invariante bleibt),
--      markiert aber in consent_meta ehrlich, wenn die Einwilligung nur aus
--      einem Stage-Übergang abgeleitet wurde (z. B. Recruiter hat telefonisch
--      eingeholt und Stage manuell gesetzt) statt explizit protokolliert.
-- ============================================================================

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS consent_meta jsonb;

COMMENT ON COLUMN public.submissions.consent_meta IS
  'Audit der Einwilligung: {source: interview_accept|stage_transition, text_version, consented_at, interview_id?}';

CREATE OR REPLACE FUNCTION public.sync_identity_unlock_with_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  eff text := COALESCE(NEW.stage, NEW.status);
  -- 'interview' bewusst NICHT mehr enthalten (Status-Landmine, s. Kopfkommentar)
  opted_in boolean :=
       eff IN ('candidate_opted_in','interview_scheduled',
               'second_interview','offer','hired','placed')
    OR NEW.identity_revealed IS TRUE;
BEGIN
  IF opted_in AND NEW.identity_unlocked IS DISTINCT FROM TRUE THEN
    NEW.identity_unlocked   := TRUE;
    NEW.identity_revealed   := TRUE;  -- Legacy-Flag konsistent halten
    NEW.unlocked_at         := COALESCE(NEW.unlocked_at, now());
    NEW.revealed_at         := COALESCE(NEW.revealed_at, now());
    NEW.consent_confirmed   := TRUE;
    NEW.consent_confirmed_at := COALESCE(NEW.consent_confirmed_at, now());
    -- Ehrliches Audit: nur befüllen, wenn kein explizites Protokoll vorliegt.
    NEW.consent_meta := COALESCE(NEW.consent_meta, jsonb_build_object(
      'source', 'stage_transition',
      'stage', eff,
      'consented_at', now(),
      'note', 'Automatisch aus Stage-Übergang abgeleitet; explizites Kandidaten-Consent bevorzugt.'
    ));
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger selbst bleibt unverändert bestehen (trg_sync_identity_unlock).

-- ----------------------------------------------------------------------------
-- Verifikation nach Deploy:
--   -- Neue Anfragen (stage='interview_requested', status='interview') dürfen
--   -- NICHT mehr unlocken:
--   -- INSERT/UPDATE testen und prüfen, dass identity_unlocked false bleibt.
--   SELECT id, stage, status, identity_unlocked, consent_meta->>'source'
--   FROM public.submissions
--   WHERE stage = 'interview_requested' AND identity_unlocked IS TRUE;
-- ----------------------------------------------------------------------------
