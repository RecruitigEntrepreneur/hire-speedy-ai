-- ============================================================================
-- Interview-Pflicht vor dem Einreichen (Entscheidung 12.10.2026)
-- ============================================================================
-- Befund: Ein Kandidat ließ sich mit einem Interview-Entwurf einreichen, der nur
-- aus eingeworfenen Notizen bestand -- ohne Gesprächstermin, ohne „Warum jetzt“.
-- Beim Kunden blieb „Aus dem Gespräch mit dem Headhunter“ fast leer.
--
-- Regel (gleich wie src/lib/candidateDossier.ts › interviewGaps/interviewCompleted):
-- Das Interview ist mit „Interview abschließen“ beendet (status = 'completed')
-- und hat Gesprächsdatum, Gesprächsart, Warum wechseln, Warum jetzt,
-- Wunschgehalt und Verfügbarkeit. Ältere Abläufe legten je Kandidat mehrere
-- Notiz-Datensätze an; gezählt wird über alle nicht ersetzten.
--
-- Wie enforce_submission_activation: Hintergrundprozesse (ohne Nutzer) und
-- Admins sind ausgenommen.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_submission_interview()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ok boolean;
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  SELECT
    bool_or(n.status = 'completed')
    AND bool_or(n.interview_date IS NOT NULL)
    AND bool_or(NULLIF(btrim(n.interview_type), '') IS NOT NULL)
    AND bool_or(NULLIF(btrim(n.why_now), '') IS NOT NULL)
    AND bool_or(NULLIF(btrim(n.change_motivation), '') IS NOT NULL OR COALESCE(cardinality(n.change_motivation_tags), 0) > 0)
    AND (bool_or(NULLIF(btrim(n.salary_desired), '') IS NOT NULL) OR COALESCE(max(c.expected_salary), max(c.salary_fix), 0) > 0)
    AND (bool_or(NULLIF(btrim(n.notice_period), '') IS NOT NULL OR n.earliest_start_date IS NOT NULL)
         OR bool_or(NULLIF(btrim(c.notice_period), '') IS NOT NULL OR c.availability_date IS NOT NULL))
    INTO v_ok
    FROM candidate_interview_notes n
    JOIN candidates c ON c.id = n.candidate_id
   WHERE n.candidate_id = NEW.candidate_id
     AND n.status IS DISTINCT FROM 'superseded';

  IF NOT COALESCE(v_ok, false) THEN
    RAISE EXCEPTION 'Bitte schließe zuerst das Interview mit dem Kandidaten ab. Dafür brauchst du Gesprächsdatum und -art, Warum wechseln, Warum jetzt, Wunschgehalt und Verfügbarkeit.'
      USING ERRCODE = 'P0001', HINT = 'interview_required';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_submission_interview() IS
  'Einreichen nur mit abgeschlossenem Interview (Mindestangaben wie interviewGaps im Frontend). Entscheidung 12.10.2026.';

DROP TRIGGER IF EXISTS trg_enforce_submission_interview ON public.submissions;
CREATE TRIGGER trg_enforce_submission_interview
  BEFORE INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_submission_interview();
