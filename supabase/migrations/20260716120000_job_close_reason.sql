-- Schließen-Flow der Job-Detailseite: Grund + Zeitpunkt der Schließung.
-- Additiv und abwärtskompatibel; der Client fällt bei fehlender Spalte auf
-- ein reines Status-Update zurück (isMissingColumnError-Muster).
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS closed_reason text,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

COMMENT ON COLUMN public.jobs.closed_reason IS
  'Warum der Kunde die Stelle geschlossen hat: filled_via_matchunt | filled_elsewhere | on_hold | cancelled';
COMMENT ON COLUMN public.jobs.closed_at IS
  'Zeitpunkt der Schließung durch den Kunden';
