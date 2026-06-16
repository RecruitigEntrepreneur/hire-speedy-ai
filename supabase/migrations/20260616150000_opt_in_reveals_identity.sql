-- ============================================================================
-- Triple-Blind · Status/Reveal konsolidieren (Gap #20)
-- Entscheidung des Auftraggebers: "Opt-In = Identität freigeben."
--
-- Problem: stage='candidate_opted_in' (Pipeline) und identity_unlocked (Reveal)
-- liefen auseinander. Ein Recruiter konnte den Stage auf 'candidate_opted_in'
-- setzen (Badge "Opt-In erhalten"), während der Kandidat für den Client weiter
-- anonym blieb (identity_unlocked=false). Außerdem existiert ein Legacy-Flag
-- identity_revealed, das manche Pfade statt identity_unlocked setzen.
--
-- Lösung: EINE Invariante, zentral in der DB erzwungen:
--   Sobald eine Submission die Opt-In-Stufe ODER weiter erreicht (oder das
--   Legacy-Flag identity_revealed gesetzt ist), gilt identity_unlocked=true.
--   Der Reveal wird NIE automatisch zurückgenommen (Daten werden nie zerstört).
-- Damit können Badge ("Opt-In erhalten") und Identitäts-Status nie wieder
-- widersprüchlich sein.
--
-- Hinweis: Diese Migration GIBT für bereits opted-in Kandidaten die Identität
-- gegenüber dem Client frei (= gewünschtes "Opt-In = Reveal"-Verhalten).
-- ============================================================================

-- Stufen, ab denen die Identität freigegeben ist (Opt-In oder weiter).
-- submitted/screening/interview_requested bleiben anonym; rejected/declined auch.
CREATE OR REPLACE FUNCTION public.sync_identity_unlock_with_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  eff text := COALESCE(NEW.stage, NEW.status);
  opted_in boolean :=
       eff IN ('candidate_opted_in','interview_scheduled','interview',
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
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_identity_unlock ON public.submissions;
CREATE TRIGGER trg_sync_identity_unlock
  BEFORE INSERT OR UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_identity_unlock_with_stage();

-- ----------------------------------------------------------------------------
-- Backfill: bestehende inkonsistente Datensätze in Einklang bringen
-- (opted-in oder weiter, aber identity_unlocked noch nicht gesetzt).
-- ----------------------------------------------------------------------------
UPDATE public.submissions
SET
  identity_unlocked   = TRUE,
  identity_revealed   = TRUE,
  unlocked_at         = COALESCE(unlocked_at, now()),
  revealed_at         = COALESCE(revealed_at, now()),
  consent_confirmed   = TRUE,
  consent_confirmed_at = COALESCE(consent_confirmed_at, now())
WHERE identity_unlocked IS DISTINCT FROM TRUE
  AND (
        COALESCE(stage, status) IN ('candidate_opted_in','interview_scheduled',
            'interview','second_interview','offer','hired','placed')
     OR identity_revealed IS TRUE
  );

-- ----------------------------------------------------------------------------
-- Verifikation nach Deploy:
--   -- darf 0 Zeilen liefern (kein Widerspruch mehr):
--   SELECT id, stage, status, identity_unlocked
--   FROM public.submissions
--   WHERE COALESCE(stage,status) IN ('candidate_opted_in','interview_scheduled',
--         'interview','second_interview','offer','hired','placed')
--     AND identity_unlocked IS DISTINCT FROM TRUE;
-- ----------------------------------------------------------------------------
