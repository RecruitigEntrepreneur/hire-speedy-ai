-- Drop old policy that only works with submission_id
DROP POLICY IF EXISTS "Clients can view summaries for their job submissions" ON candidate_client_summary;

-- Create new policy: Client can view summary if the candidate was submitted to any of their jobs
CREATE POLICY "Clients can view summaries for candidates submitted to their jobs"
ON candidate_client_summary
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM submissions s
    JOIN jobs j ON j.id = s.job_id
    WHERE s.candidate_id = candidate_client_summary.candidate_id
      AND j.client_id = auth.uid()
  )
);