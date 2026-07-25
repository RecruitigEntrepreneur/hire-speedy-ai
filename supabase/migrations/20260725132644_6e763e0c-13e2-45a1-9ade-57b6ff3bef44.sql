DROP POLICY IF EXISTS "Recruiters can view published jobs" ON public.jobs;

DO $$
DECLARE leftover text;
BEGIN
  SELECT string_agg(policyname, ', ') INTO leftover
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'jobs'
     AND policyname ILIKE '%recruiter%';
  IF leftover IS NOT NULL THEN
    RAISE EXCEPTION 'Es existieren weiterhin Recruiter-Policies auf public.jobs: %', leftover;
  END IF;
END $$;