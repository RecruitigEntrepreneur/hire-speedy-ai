CREATE OR REPLACE FUNCTION public.guard_opt_in_by_candidate_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  eff text := COALESCE(NEW.stage, NEW.status);
BEGIN
  IF auth.uid() IS NULL
     OR auth.uid() IS DISTINCT FROM OLD.recruiter_id
     OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF OLD.identity_unlocked IS NOT TRUE AND (
       (eff IN ('candidate_opted_in','interview_scheduled','second_interview','offer','hired','placed')
        AND eff IS DISTINCT FROM COALESCE(OLD.stage, OLD.status))
       OR NEW.identity_unlocked IS TRUE
       OR NEW.identity_revealed IS TRUE
     )
     OR (NEW.opt_in_response = 'approved' AND OLD.opt_in_response IS DISTINCT FROM 'approved')
  THEN
    RAISE EXCEPTION 'Das Opt-In kann nur der Kandidat selbst geben (Klick in der Einladung).'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_opt_in_by_candidate_only ON public.submissions;
CREATE TRIGGER trg_guard_opt_in_by_candidate_only
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.guard_opt_in_by_candidate_only();