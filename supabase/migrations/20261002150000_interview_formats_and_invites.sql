-- ============================================================================
-- Interview-Terminierung v2, Ergänzung (02.10.2026)
--
-- Telefon und Vor Ort neben Teams: Rückrufnummer des Kandidaten und ein
-- Hinweis zum Ort (Empfang, Parken). Kollegen direkt aus dem Anfrage-Fenster
-- einladen: Funktion im Gespräch, Markierung „Entscheider“, Zeitpunkt der
-- Team-Einladung. Keine bestehenden Daten werden verändert.
-- ============================================================================
BEGIN;

ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS call_phone text,
  ADD COLUMN IF NOT EXISTS location_note text;

COMMENT ON COLUMN public.interviews.call_phone IS 'Telefon-Interview: Nummer, unter der der Kandidat angerufen wird (vom Kandidaten bestätigt).';
COMMENT ON COLUMN public.interviews.location_note IS 'Vor-Ort-Interview: Hinweis für den Kandidaten (Empfang, Parken, Ansprechpartner).';

ALTER TABLE public.interview_attendees
  ADD COLUMN IF NOT EXISTS is_decision_maker boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS function_key text,
  ADD COLUMN IF NOT EXISTS invited_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.interview_attendees ADD CONSTRAINT interview_attendees_function_key_check
    CHECK (function_key IS NULL OR function_key IN ('fachbereich', 'fuehrungskraft', 'geschaeftsfuehrung', 'hr', 'andere'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.interview_attendees.is_decision_maker IS 'Entscheidet über die Einstellung; Feedback wird oben gezeigt.';
COMMENT ON COLUMN public.interview_attendees.invited_at IS 'Aus dem Anfrage-Fenster ins Team eingeladen (Team-Einladung noch offen oder angenommen).';

COMMIT;
