-- ============================================================================
-- Welle 1 / Schritt 3: Direktzugriff der Recruiter auf public.jobs entziehen
-- ----------------------------------------------------------------------------
-- ACHTUNG — REIHENFOLGE BEIM DEPLOY:
--   Diese Migration erst anwenden, wenn das Frontend, das auf
--   recruiter_jobs_view umgestellt wurde, ausgerollt ist. Vorher entzieht sie
--   laufenden Clients den Job-Zugriff und Recruiter-Seiten laufen leer.
--
--   Reihenfolge:
--     1. 20260725120000_recruiter_jobs_view_hardening.sql   (View erweitern)
--     2. Frontend-Release                                    (View benutzen)
--     3. DIESE Migration                                     (Direktzugriff zu)
--
-- Was sie tut:
--   Die Policy "Recruiters can view published jobs" (angelegt in
--   20251204171610) erlaubt SELECT auf alle Spalten jedes veröffentlichten
--   Jobs. Genau darüber lief das Firmennamen-Leck. Nach dem Drop lesen
--   Recruiter Jobs ausschließlich über recruiter_jobs_view, die maskiert.
--
--   Kunden (Client team), Admins und Edge Functions (Service Role) sind nicht
--   betroffen — deren Policies bleiben unverändert.
-- ============================================================================

DROP POLICY IF EXISTS "Recruiters can view published jobs" ON public.jobs;

-- Gegenprobe: In public.jobs darf jetzt keine Policy mehr existieren, die
-- Recruitern pauschal SELECT gewährt. Schlägt fehl, falls doch eine übrig ist.
DO $$
DECLARE
  leftover text;
BEGIN
  SELECT string_agg(policyname, ', ')
    INTO leftover
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename  = 'jobs'
     AND policyname ILIKE '%recruiter%';

  IF leftover IS NOT NULL THEN
    RAISE EXCEPTION
      'Es existieren weiterhin Recruiter-Policies auf public.jobs: %', leftover;
  END IF;
END $$;
