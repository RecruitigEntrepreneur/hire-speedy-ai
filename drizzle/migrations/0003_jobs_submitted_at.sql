ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
COMMENT ON COLUMN public.jobs.submitted_at IS 'Wann der Kunde die Stelle eingereicht hat (Status draft -> pending_*). Anzeige "Eingereicht am".';
UPDATE public.jobs SET submitted_at = updated_at WHERE submitted_at IS NULL AND status IN ('pending_approval', 'pending_client_approval');