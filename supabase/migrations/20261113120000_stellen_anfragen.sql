-- Stellenseite des Kunden (13.11.2026): Anfragen an Matchunt zu einer laufenden Stelle.
--
-- Nach dem Livegang bearbeitet der Kunde seine Stelle nicht mehr selbst: Die Headhunter
-- suchen bereits auf das Briefing. Stattdessen fragt er eine Änderung an (Budget,
-- Anforderungen, Beschreibung; Text Pflicht), Matchunt prüft und informiert die Headhunter.
-- p_kind ist für spätere Anfragearten offen; heute gilt nur 'change'.
--
-- Nur eine Funktion, keine Tabelle, keine Daten. Die Meldung geht an die Admins
-- (notify_admins, wie client_request_callback).

CREATE OR REPLACE FUNCTION public.client_job_request(p_job_id uuid, p_kind text, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job jobs%ROWTYPE;
  v_note text := NULLIF(trim(COALESCE(p_note, '')), '');
BEGIN
  IF NOT public.can_access_job(p_job_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_kind IS DISTINCT FROM 'change' THEN
    RAISE EXCEPTION 'Unbekannte Anfrage.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF length(COALESCE(v_note, '')) < 5 THEN
    RAISE EXCEPTION 'Bitte beschreiben Sie kurz, was sich ändern soll.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF length(COALESCE(v_note, '')) > 2000 THEN
    RAISE EXCEPTION 'Der Hinweis ist zu lang (höchstens 2000 Zeichen).' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = p_job_id;

  PERFORM public.notify_admins('job_change_requested', 'Änderung an Stelle angefragt',
    format('„%s“ (%s): Der Kunde möchte etwas ändern: %s', v_job.title, v_job.company_name, v_note),
    'admin_review', p_job_id);
END;
$$;

REVOKE ALL ON FUNCTION public.client_job_request(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_job_request(uuid, text, text) TO authenticated;
