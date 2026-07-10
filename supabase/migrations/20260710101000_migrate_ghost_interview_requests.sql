-- ============================================================================
-- GEISTER-ANFRAGEN MIGRIEREN (Triple-Blind Einladungsprozess)
-- ============================================================================
-- Der alte InterviewRequestWithOptInDialog (Dashboard-Widgets) schrieb
-- Interview-Anfragen als JSON in submissions.client_notes:
--   {"pending_interview_request": {client_time_slots, client_message,
--    requested_at, status: "pending_opt_in"}}
-- Es entstand KEINE interviews-Zeile, KEIN Token, KEINE Kandidaten-E-Mail —
-- diese Anfragen waren in der Interview-Agenda unsichtbar.
--
-- Diese Migration überführt sie in echte interviews-Zeilen (pending_response),
-- damit sie in der Agenda unter "Wartet auf Kandidaten-Antwort" auftauchen
-- und der Kunde sie steuern kann (Erinnern / neue Slots / Zurückziehen).
--
-- HINWEIS: Eine Einladungs-E-Mail wurde für diese Alt-Anfragen nie versendet —
-- der zuständige Recruiter hat bereits einen influence_alert (opt_in_pending)
-- und muss das Opt-In weiterhin aktiv einholen bzw. die Anfrage neu auslösen.
-- client_notes wird NICHT verändert (kein Datenverlust).
-- ============================================================================

DO $$
DECLARE
  r RECORD;
  req jsonb;
  slot_objects jsonb;
  migrated int := 0;
BEGIN
  FOR r IN
    SELECT s.id AS submission_id, s.client_notes
    FROM public.submissions s
    WHERE s.client_notes IS NOT NULL
      AND s.client_notes LIKE '%pending_interview_request%'
  LOOP
    BEGIN
      req := (r.client_notes::jsonb) -> 'pending_interview_request';
    EXCEPTION WHEN others THEN
      CONTINUE;  -- kein valides JSON → überspringen
    END;

    IF req IS NULL THEN
      CONTINUE;
    END IF;

    -- Duplikate vermeiden: es existiert bereits eine offene/terminierte Anfrage
    IF EXISTS (
      SELECT 1 FROM public.interviews i
      WHERE i.submission_id = r.submission_id
        AND i.status IN ('pending', 'pending_response', 'scheduled', 'counter_proposed')
    ) THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(
             jsonb_agg(jsonb_build_object('datetime', t.v, 'status', 'available')),
             '[]'::jsonb
           )
      INTO slot_objects
    FROM jsonb_array_elements_text(COALESCE(req -> 'client_time_slots', '[]'::jsonb)) AS t(v);

    INSERT INTO public.interviews (
      submission_id,
      status,
      proposed_slots,
      duration_minutes,
      meeting_format,
      meeting_type,
      client_message,
      response_token,
      pending_opt_in,
      created_at
    ) VALUES (
      r.submission_id,
      'pending_response',
      slot_objects,
      60,
      'video',
      'video',
      NULLIF(req ->> 'client_message', ''),
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      TRUE,
      COALESCE(NULLIF(req ->> 'requested_at', '')::timestamptz, now())
    );

    migrated := migrated + 1;
  END LOOP;

  RAISE NOTICE 'Geister-Anfragen migriert: %', migrated;
END $$;
