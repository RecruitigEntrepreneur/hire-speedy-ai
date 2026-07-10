-- ============================================================================
-- JOB-REVIEW-FEEDBACK (Stelle-ausschreiben, Block D)
-- ============================================================================
-- Abgelehnte Jobs wurden bisher auf status='draft' gesetzt und der Grund als
-- "[ABGELEHNT] …" in briefing_notes GESCHRIEBEN (dabei wurde das Kunden-
-- Briefing überschrieben!). Keine UI zeigte den Grund je an.
-- Neu: echte Spalten für den Rückgabe-Grund; das Frontend zeigt ihn als
-- Banner auf der Job-Seite und benachrichtigt den Kunden.
-- ============================================================================

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

COMMENT ON COLUMN public.jobs.rejection_reason IS
  'Grund der Rückgabe aus der Admin-Prüfung; wird beim erneuten Einreichen geleert.';
