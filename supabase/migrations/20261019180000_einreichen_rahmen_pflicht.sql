-- ============================================================================
-- Einreichen nur mit Rahmen fürs Matching (Entscheidung 19.10.2026)
-- ============================================================================
-- Befund: „Bereit zum Einreichen“ zeigte 8 von 8, „Passende Stellen“ meldete
-- trotzdem „Arbeitsmodell nicht vollständig erfasst“ (Stefan Weißhaupt). Die
-- Pflichtliste und das Matching prüften Verschiedenes; das Interview fragte
-- Arbeitsmodell, Pendelzeit und Sprachen nur freiwillig.
--
-- Regel (gleich wie src/lib/candidateDossier.ts › rahmenGaps):
--   Arbeitsmodell gesetzt, Wohnort gesetzt, Pendelzeit > 0 – außer „nur remote“
--   oder umzugsbereit –, und mindestens eine Sprache.
-- Zusätzlich zur Interview-Regel aus 20261012120000, die hier unverändert
-- übernommen ist. Eigenständig: legt Funktion und Trigger an, auch wenn
-- 20261012120000 live noch fehlt. Bestehende Einreichungen bleiben unberührt
-- (BEFORE INSERT). Hintergrundprozesse (ohne Nutzer) und Admins sind ausgenommen.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_submission_interview()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ok boolean;
  v_fehlt text[] := ARRAY[]::text[];
  c record;
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- 1. Interview abgeschlossen mit Mindestangaben (wie 20261012120000)
  SELECT
    bool_or(n.status = 'completed')
    AND bool_or(n.interview_date IS NOT NULL)
    AND bool_or(NULLIF(btrim(n.interview_type), '') IS NOT NULL)
    AND bool_or(NULLIF(btrim(n.why_now), '') IS NOT NULL)
    AND bool_or(NULLIF(btrim(n.change_motivation), '') IS NOT NULL OR COALESCE(cardinality(n.change_motivation_tags), 0) > 0)
    AND (bool_or(NULLIF(btrim(n.salary_desired), '') IS NOT NULL) OR COALESCE(max(c2.expected_salary), max(c2.salary_fix), 0) > 0)
    AND (bool_or(NULLIF(btrim(n.notice_period), '') IS NOT NULL OR n.earliest_start_date IS NOT NULL)
         OR bool_or(NULLIF(btrim(c2.notice_period), '') IS NOT NULL OR c2.availability_date IS NOT NULL))
    INTO v_ok
    FROM candidate_interview_notes n
    JOIN candidates c2 ON c2.id = n.candidate_id
   WHERE n.candidate_id = NEW.candidate_id
     AND n.status IS DISTINCT FROM 'superseded';

  IF NOT COALESCE(v_ok, false) THEN
    RAISE EXCEPTION 'Bitte schließe zuerst das Interview mit dem Kandidaten ab. Dafür brauchst du Gesprächsdatum und -art, Warum wechseln, Warum jetzt, Wunschgehalt und Verfügbarkeit.'
      USING ERRCODE = 'P0001', HINT = 'interview_required';
  END IF;

  -- 2. Rahmen fürs Matching (neu 19.10.2026)
  SELECT remote_preference, city, max_commute_minutes, relocation_willing
    INTO c
    FROM candidates
   WHERE id = NEW.candidate_id;

  IF NULLIF(btrim(c.remote_preference), '') IS NULL THEN
    v_fehlt := array_append(v_fehlt, 'Arbeitsmodell');
  END IF;
  IF NULLIF(btrim(c.city), '') IS NULL THEN
    v_fehlt := array_append(v_fehlt, 'Wohnort');
  END IF;
  IF c.remote_preference IS DISTINCT FROM 'remote'
     AND c.relocation_willing IS NOT TRUE
     AND COALESCE(c.max_commute_minutes, 0) <= 0 THEN
    v_fehlt := array_append(v_fehlt, 'Pendelzeit');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM candidate_languages l
     WHERE l.candidate_id = NEW.candidate_id AND NULLIF(btrim(l.language), '') IS NOT NULL
  ) THEN
    v_fehlt := array_append(v_fehlt, 'Sprachen');
  END IF;

  IF cardinality(v_fehlt) > 0 THEN
    RAISE EXCEPTION 'Vor dem Einreichen fehlt noch: %. Du ergänzt es in „Bereit zum Einreichen“ oder im Interview (Rahmen).', array_to_string(v_fehlt, ', ')
      USING ERRCODE = 'P0001', HINT = 'rahmen_required';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_submission_interview() IS
  'Einreichen nur mit abgeschlossenem Interview (Mindestangaben wie interviewGaps) und Rahmen fürs Matching '
  '(Arbeitsmodell, Wohnort, Pendelzeit, Sprachen wie rahmenGaps im Frontend). Entscheidungen 12.10. und 19.10.2026.';

DROP TRIGGER IF EXISTS trg_enforce_submission_interview ON public.submissions;
CREATE TRIGGER trg_enforce_submission_interview
  BEFORE INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_submission_interview();
