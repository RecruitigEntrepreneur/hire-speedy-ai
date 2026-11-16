-- Wartezustand: Mit der eigenen Unterschrift ist das Headhunter-Dashboard offen, aber nur zum
-- Ansehen, bis Matchunt gegengezeichnet und freigeschaltet hat (Entscheidung 30.10.2026). Der
-- Vertrag und die Datenschutzvereinbarung gelten erst dann, also keine Kandidatendaten, keine
-- Suche und keine Einreichung vorher. Die Seite sperrt die Knöpfe, diese Trigger sperren die
-- Datenbank. Eng gefasst: Es trifft nur Konten mit einem offenen Onboarding-Vorgang, die noch
-- nicht freigeschaltet sind. Altkonten ohne Vorgang, Admins und das eigene Backend bleiben frei.

CREATE OR REPLACE FUNCTION public.recruiter_waits_for_countersign(_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles r
    JOIN public.recruiter_onboarding_cases c ON c.claimed_by = r.user_id AND c.revoked_at IS NULL
    WHERE r.user_id = _user
      AND r.role = 'recruiter'
      AND r.verified IS DISTINCT FROM true
  );
$fn$;
REVOKE ALL ON FUNCTION public.recruiter_waits_for_countersign(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recruiter_waits_for_countersign(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.recruiter_waits_for_countersign(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.block_recruiter_action_while_waiting()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NEW.recruiter_id = auth.uid()
     AND public.recruiter_waits_for_countersign(auth.uid()) THEN
    RAISE EXCEPTION 'Das geht, sobald Matchunt deinen Vertrag gegengezeichnet hat.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS wartezustand_keine_kandidaten ON public.candidates;
CREATE TRIGGER wartezustand_keine_kandidaten
  BEFORE INSERT ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.block_recruiter_action_while_waiting();

DROP TRIGGER IF EXISTS wartezustand_keine_einreichung ON public.submissions;
CREATE TRIGGER wartezustand_keine_einreichung
  BEFORE INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.block_recruiter_action_while_waiting();

DROP TRIGGER IF EXISTS wartezustand_keine_suche ON public.recruiter_job_activations;
CREATE TRIGGER wartezustand_keine_suche
  BEFORE INSERT ON public.recruiter_job_activations
  FOR EACH ROW EXECUTE FUNCTION public.block_recruiter_action_while_waiting();
