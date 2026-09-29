-- Einreichen nur auf aktivierte Stellen ("Ich suche") und Einschätzung der
-- Muss-Kriterien an der Einreichung.
--
-- 1. Bisher sperrte nur die Stellenvorschau im Frontend; über die Stellenseite
--    oder die Stellenauswahl im Kandidatenprofil ging jede veröffentlichte
--    Stelle. Die Regel gilt jetzt in der Datenbank. Admins und Systemprozesse
--    (auth.uid() IS NULL, Service Role) bleiben ausgenommen. Bestehende
--    Einreichungen sind nicht betroffen (nur INSERT).
-- 2. criteria_assessment: je Muss-Kriterium die Einschätzung des Headhunters
--    ("met" | "partial"; "not_met" sperrt schon im Formular) mit anonymisiertem
--    Beleg. Kunden lesen die Einreichungen ihrer Stellen über die bestehenden
--    Policies.

CREATE OR REPLACE FUNCTION public.enforce_submission_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.recruiter_job_activations a
    WHERE a.recruiter_id = NEW.recruiter_id
      AND a.job_id = NEW.job_id
  ) THEN
    RAISE EXCEPTION 'Einreichen geht nur auf aktivierte Stellen. Bitte die Stelle zuerst aktivieren („Ich suche“).'
      USING ERRCODE = 'P0001', HINT = 'job_not_activated';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_submission_activation ON public.submissions;
CREATE TRIGGER trg_enforce_submission_activation
  BEFORE INSERT ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_submission_activation();

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS criteria_assessment jsonb,
  ADD COLUMN IF NOT EXISTS fit_overrides jsonb;

COMMENT ON COLUMN public.submissions.criteria_assessment IS
  'Einschätzung der Muss-Kriterien durch den Headhunter: [{criterion, rating: met|partial, evidence}], Beleg ohne Name/Arbeitgeber.';

COMMENT ON COLUMN public.submissions.fit_overrides IS
  'Passungs-Check: vom Headhunter übergangene Warnungen mit Begründung [{rule, message, reason}] (DSGVO Art. 22: keine Sperre allein durch Regel).';
