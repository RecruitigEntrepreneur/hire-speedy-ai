-- Add columns for Triple-Blind identity reveal tracking
ALTER TABLE public.submissions 
ADD COLUMN IF NOT EXISTS identity_revealed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS revealed_at timestamp with time zone;

-- Add pending_opt_in column to interviews
ALTER TABLE public.interviews 
ADD COLUMN IF NOT EXISTS pending_opt_in boolean DEFAULT false;

-- Create index for faster queries on identity_revealed
CREATE INDEX IF NOT EXISTS idx_submissions_identity_revealed 
ON public.submissions(identity_revealed) 
WHERE identity_revealed = true;

-- Update RLS policy to allow clients to see revealed submissions
CREATE POLICY "Clients can view revealed submissions" 
ON public.submissions 
FOR SELECT 
USING (
  identity_revealed = true 
  AND EXISTS (
    SELECT 1 FROM public.jobs j 
    WHERE j.id = submissions.job_id 
    AND j.client_id = auth.uid()
  )
);