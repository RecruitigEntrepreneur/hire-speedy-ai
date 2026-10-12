ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_closed_hire_submission_id_fkey;

NOTIFY pgrst, 'reload schema';