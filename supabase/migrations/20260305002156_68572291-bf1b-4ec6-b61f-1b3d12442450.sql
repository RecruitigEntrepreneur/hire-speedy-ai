CREATE POLICY "Clients can view experiences for submitted candidates"
ON public.candidate_experiences FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.submissions s
  JOIN public.jobs j ON j.id = s.job_id
  WHERE s.candidate_id = candidate_experiences.candidate_id
  AND j.client_id = auth.uid()
));