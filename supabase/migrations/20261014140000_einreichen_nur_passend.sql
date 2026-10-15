-- ============================================================================
-- Einreichen nur bei Passung (14.10.2026)
-- ============================================================================
-- Unpassende Kandidaten und Stellen bietet die Oberfläche nicht mehr an. Diese
-- Sperre greift auch an ihr vorbei: Sagt das Matching (match_v41_results)
-- „ausgeschlossen“ für genau diesen Kandidaten und diese Stelle, lehnt die
-- Datenbank die Einreichung ab – außer der Headhunter hat den Ausschluss mit
-- „Trotzdem vorschlagen“ bewusst übersteuert (match_v41_overrides 'show').
-- Gibt es kein Urteil, entscheidet die Oberfläche (sie prüft beim Öffnen).
-- Admins und Edge Functions (ohne Nutzer) sind ausgenommen.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.guard_submission_match_fit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
       SELECT 1 FROM public.match_v41_results r
        WHERE r.candidate_id = NEW.candidate_id
          AND r.job_id = NEW.job_id
          AND r.tier = 'ausgeschlossen')
     AND NOT EXISTS (
       SELECT 1 FROM public.match_v41_overrides o
        WHERE o.candidate_id = NEW.candidate_id
          AND o.job_id = NEW.job_id
          AND o.recruiter_id = NEW.recruiter_id
          AND o.decision = 'show')
  THEN
    RAISE EXCEPTION 'Der Kandidat passt laut Matching nicht zu dieser Stelle.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_submission_match_fit ON public.submissions;
CREATE TRIGGER trg_guard_submission_match_fit
  BEFORE INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.guard_submission_match_fit();
