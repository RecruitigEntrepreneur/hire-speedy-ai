-- ============================================================================
-- Interviews bis zur Entscheidung (22.10.2026)
-- ============================================================================
-- 1. Vor Ort: Ansprechpartner mit Telefon für Empfang und Notfall.
-- 2. Erinnerung am Vortag: Function interview-reminders, einmal täglich um 15:00 UTC
--    (17:00 Sommerzeit, 16:00 Winterzeit). Nutzt das vorhandene Feld
--    interviews.reminder_24h_sent, damit niemand doppelt erinnert wird.
-- Feedback (vier Wege) und Runde 2 brauchen keine neuen Spalten: Das Feedback
-- bleibt in interviews.feedback, die Stufe danach ist interview_completed.
-- ============================================================================

ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS onsite_contact_name text;
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS onsite_contact_phone text;

COMMENT ON COLUMN public.interviews.onsite_contact_name IS 'Vor Ort: Ansprechpartner am Empfang (geht an Kandidat und Headhunter)';
COMMENT ON COLUMN public.interviews.onsite_contact_phone IS 'Vor Ort: Telefon des Ansprechpartners';

-- Täglicher Lauf für die Erinnerung am Vortag. Der Schlüssel entsteht beim ersten
-- Lauf über private.cron_token_for (Migration 20261021090000).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('interview-reminders') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'interview-reminders');
    PERFORM cron.schedule('interview-reminders', '0 15 * * *', $job$
      SELECT net.http_post(
        url := 'https://dngycrrhbnwdohbftpzq.supabase.co/functions/v1/interview-reminders',
        headers := jsonb_build_object('Content-Type', 'application/json',
                                      'x-cron-token', private.cron_token_for('interview-reminders')),
        body := '{}'::jsonb);
    $job$);
  END IF;
END;
$$;
