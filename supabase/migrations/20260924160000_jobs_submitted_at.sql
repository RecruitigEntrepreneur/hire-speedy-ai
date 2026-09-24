-- Wann eine Stelle eingereicht wurde (24.09.2026).
--
-- Der Status einer eingereichten Stelle steht jetzt an der Stelle selbst
-- (Job-Detail, Jobliste, Dashboard), mit Datum je Schritt. Fuer "Eingereicht"
-- gab es bisher nur updated_at -- das verschiebt sich bei jeder spaeteren
-- Bearbeitung. Gesetzt wird die Spalte vom Kunden beim Einreichen
-- (useClientIntake.submit).

BEGIN;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

COMMENT ON COLUMN public.jobs.submitted_at IS
  'Wann der Kunde die Stelle eingereicht hat (Status draft -> pending_*). Anzeige "Eingereicht am".';

-- Wartende Stellen: bester vorhandener Wert. Laengst live gegangene bleiben
-- leer -- dort waere updated_at ein beliebiges spaeteres Datum.
UPDATE public.jobs
   SET submitted_at = updated_at
 WHERE submitted_at IS NULL
   AND status IN ('pending_approval', 'pending_client_approval');

COMMIT;
