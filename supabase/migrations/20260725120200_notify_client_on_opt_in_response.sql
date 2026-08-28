-- ============================================================================
-- Welle 1 / Schritt 4: Client-Benachrichtigung bei Opt-In-Antwort serverseitig
-- ----------------------------------------------------------------------------
-- Warum:
--   Bisher hat der Recruiter-Client die Benachrichtigung an den Kunden selbst
--   geschrieben. Dafuer musste er `jobs.client_id` lesen — genau der
--   Identitaetsvektor, den Welle 1 schliesst. Seit dem Entzug des
--   Direktzugriffs auf public.jobs lief dieser Pfad ins Leere und der Kunde
--   wurde bei einer Opt-In-Antwort nicht mehr benachrichtigt.
--
-- Loesung:
--   Ein AFTER-UPDATE-Trigger auf submissions.opt_in_response erzeugt die
--   Benachrichtigung mit Definer-Rechten. Der Recruiter erfaehrt die client_id
--   damit nie — und der clientseitige Insert entfaellt (im Frontend entfernt).
--
--   Der Trigger feuert nur bei einem echten Wechsel auf 'approved'/'denied',
--   ist also idempotent gegenueber wiederholten Updates mit gleichem Wert.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_client_on_opt_in_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  IF NEW.opt_in_response IS DISTINCT FROM OLD.opt_in_response
     AND NEW.opt_in_response IN ('approved', 'denied')
  THEN
    SELECT j.client_id INTO v_client_id
      FROM public.jobs j
     WHERE j.id = NEW.job_id;

    IF v_client_id IS NOT NULL THEN
      INSERT INTO public.notifications
        (user_id, type, title, message, related_id, related_type)
      VALUES (
        v_client_id,
        CASE WHEN NEW.opt_in_response = 'approved'
             THEN 'opt_in_approved' ELSE 'opt_in_denied' END,
        CASE WHEN NEW.opt_in_response = 'approved'
             THEN 'Kandidat hat zugestimmt' ELSE 'Kandidat hat abgelehnt' END,
        CASE WHEN NEW.opt_in_response = 'approved'
             THEN 'Die Identität des Kandidaten wurde freigegeben. Sie können jetzt die vollständigen Daten sehen.'
             ELSE 'Der Kandidat hat die Freigabe seiner Identität abgelehnt.' END,
        NEW.id,
        'submission'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_client_on_opt_in_response ON public.submissions;

CREATE TRIGGER trg_notify_client_on_opt_in_response
AFTER UPDATE OF opt_in_response ON public.submissions
FOR EACH ROW
EXECUTE FUNCTION public.notify_client_on_opt_in_response();

COMMENT ON FUNCTION public.notify_client_on_opt_in_response() IS
  'Benachrichtigt den Kunden bei Opt-In-Antwort. Ersetzt den frueheren '
  'clientseitigen Insert, der jobs.client_id lesen musste (Identitaetsvektor).';
