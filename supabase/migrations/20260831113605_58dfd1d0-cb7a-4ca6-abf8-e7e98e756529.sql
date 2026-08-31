UPDATE public.submissions
   SET stage = 'client_rejected'
 WHERE status = 'rejected'
   AND stage NOT IN ('rejected', 'client_rejected', 'withdrawn');

UPDATE public.submissions SET stage = 'interview_completed' WHERE stage IN ('interview_1', 'interview_2', 'interviewed');
UPDATE public.submissions SET stage = 'offer'               WHERE stage IN ('offer_pending', 'offer_extended', 'offer_accepted');
UPDATE public.submissions SET stage = 'placed'              WHERE stage IN ('hired');
UPDATE public.submissions SET stage = 'in_review'           WHERE stage IN ('reviewing', 'screening', 'pending');

UPDATE public.submissions
   SET stage = 'submitted'
 WHERE stage IS NULL
    OR stage NOT IN (
      'submitted', 'in_review', 'interview_requested', 'candidate_opted_in',
      'interview_scheduled', 'interview_counter_proposed', 'interview_declined',
      'interview_completed', 'offer', 'placed', 'rejected', 'client_rejected',
      'withdrawn'
    );

ALTER TABLE public.submissions
  ALTER COLUMN stage SET DEFAULT 'submitted';

ALTER TABLE public.submissions
  DROP CONSTRAINT IF EXISTS submissions_stage_check;

ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_stage_check CHECK (stage IN (
    'submitted',
    'in_review',
    'interview_requested',
    'candidate_opted_in',
    'interview_scheduled',
    'interview_counter_proposed',
    'interview_declined',
    'interview_completed',
    'offer',
    'placed',
    'rejected',
    'client_rejected',
    'withdrawn'
  ));

CREATE OR REPLACE FUNCTION public.submissions_status_from_stage(p_stage text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_stage
    WHEN 'submitted'                  THEN 'submitted'
    WHEN 'in_review'                  THEN 'in_review'
    WHEN 'interview_requested'        THEN 'interview'
    WHEN 'candidate_opted_in'         THEN 'interview'
    WHEN 'interview_scheduled'        THEN 'interview'
    WHEN 'interview_counter_proposed' THEN 'interview'
    WHEN 'interview_declined'         THEN 'rejected'
    WHEN 'interview_completed'        THEN 'interview'
    WHEN 'offer'                      THEN 'offer'
    WHEN 'placed'                     THEN 'placed'
    WHEN 'rejected'                   THEN 'rejected'
    WHEN 'client_rejected'            THEN 'rejected'
    WHEN 'withdrawn'                  THEN 'rejected'
    ELSE 'submitted'
  END;
$$;

CREATE OR REPLACE FUNCTION public.sync_submission_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.status := public.submissions_status_from_stage(NEW.stage);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_submission_status ON public.submissions;

CREATE TRIGGER trg_sync_submission_status
BEFORE INSERT OR UPDATE ON public.submissions
FOR EACH ROW
EXECUTE FUNCTION public.sync_submission_status();

UPDATE public.submissions
   SET status = public.submissions_status_from_stage(stage)
 WHERE status IS DISTINCT FROM public.submissions_status_from_stage(stage);

DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n
    FROM public.submissions
   WHERE status IS DISTINCT FROM public.submissions_status_from_stage(stage);

  IF n > 0 THEN
    RAISE EXCEPTION 'Nach der Migration widersprechen sich noch % Submissions', n;
  END IF;
END $$;

COMMENT ON COLUMN public.submissions.stage IS
  'Einzige Wahrheit fuer den Prozessfortschritt. Kanonisches Vokabular per CHECK erzwungen.';

COMMENT ON COLUMN public.submissions.status IS
  'ABGELEITET aus stage via trg_sync_submission_status — nicht direkt beschreiben.';