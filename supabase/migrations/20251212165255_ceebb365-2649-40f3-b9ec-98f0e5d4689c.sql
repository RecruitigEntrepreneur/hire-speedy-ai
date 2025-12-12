-- Add RLS policy for clients to view candidates submitted to their jobs
CREATE POLICY "Clients can view candidates for their jobs"
ON public.candidates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM submissions s
    JOIN jobs j ON j.id = s.job_id
    WHERE s.candidate_id = candidates.id
    AND j.client_id = auth.uid()
  )
);