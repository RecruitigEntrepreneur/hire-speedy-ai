-- ============================================================================
-- Platz frei nach Einreichung (Befund 13.10.2026)
-- ============================================================================
-- Live fehlte der Trigger trg_mark_activation_submitted: Er stand nur in der
-- Git-Migration 20260302160000, die Lovable-Version 20260302185119 legte nur
-- die Tabellen an. Folge: has_submitted blieb nach jeder Einreichung false.
--   - search_slots_used zählte jede Suche mit Einreichung weiter als belegt
--     („Alle 2 Plätze belegt“ trotz 8 Einreichungen auf 3 Suchen),
--   - search_slot_limit sah 0 % Einreichungsquote und senkte das Limit auf 2,
--   - Suchen mit Einreichung behielten ends_at und liefen nach 30 Tagen ab.
--
-- Diese Migration legt den Trigger (wieder) an und trägt alle bestehenden
-- Einreichungen nach. Idempotent: kann mehrfach laufen.
-- ============================================================================

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
         ends_at = NULL,
         slot_until = NULL
   WHERE recruiter_id = NEW.recruiter_id
     AND job_id = NEW.job_id
     AND COALESCE(has_submitted, false) = false;

  IF FOUND THEN
    UPDATE public.recruiter_trust_levels
       SET activations_with_submission = COALESCE(activations_with_submission, 0) + 1,
           activation_ratio = (COALESCE(activations_with_submission, 0) + 1)::numeric
                              / GREATEST(COALESCE(total_activations, 0), COALESCE(activations_with_submission, 0) + 1, 1),
           updated_at = now()
     WHERE recruiter_id = NEW.recruiter_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_activation_submitted ON public.submissions;
CREATE TRIGGER trg_mark_activation_submitted
  AFTER INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.mark_activation_submitted();

-- Nachtrag: jede Suche, in der der Headhunter schon eingereicht hat.
WITH s AS (
  SELECT recruiter_id, job_id, min(submitted_at) AS first_at
    FROM public.submissions
   WHERE recruiter_id IS NOT NULL AND job_id IS NOT NULL
   GROUP BY recruiter_id, job_id
)
UPDATE public.recruiter_job_activations a
   SET has_submitted = true,
       first_submission_at = COALESCE(a.first_submission_at, s.first_at, now()),
       ends_at = CASE WHEN a.status = 'ended' THEN a.ends_at ELSE NULL END,
       slot_until = NULL
  FROM s
 WHERE a.recruiter_id = s.recruiter_id
   AND a.job_id = s.job_id
   AND COALESCE(a.has_submitted, false) = false;

-- Zähler im Vertrauensstand an den Nachtrag angleichen.
UPDATE public.recruiter_trust_levels t
   SET activations_with_submission = c.k,
       activation_ratio = c.k::numeric / GREATEST(COALESCE(t.total_activations, 0), c.k, 1),
       updated_at = now()
  FROM (
    SELECT recruiter_id, count(*) FILTER (WHERE has_submitted) AS k
      FROM public.recruiter_job_activations
     GROUP BY recruiter_id
  ) c
 WHERE t.recruiter_id = c.recruiter_id
   AND COALESCE(t.activations_with_submission, 0) <> c.k;

COMMENT ON FUNCTION public.mark_activation_submitted() IS
  'Nach einer Einreichung: Suche zählt als „mit Einreichung“ (Platz frei, kein Ablauf nach 30 Tagen). Trigger live nachgezogen 13.10.2026.';
