-- =============================================
-- CRITICAL SECURITY FIXES - CONTINUED
-- =============================================

-- Drop the duplicate policy we just created and clean up
DROP POLICY IF EXISTS "Admins can view all offers" ON public.offers;
DROP POLICY IF EXISTS "Clients can view their job offers" ON public.offers;
DROP POLICY IF EXISTS "Recruiters can view offers for their candidates" ON public.offers;
DROP POLICY IF EXISTS "Clients can manage their offers" ON public.offers;
DROP POLICY IF EXISTS "Admins can manage all offers" ON public.offers;
DROP POLICY IF EXISTS "System can manage offers" ON public.offers;

-- Recreate offers policies properly
CREATE POLICY "Clients can view their job offers"
ON public.offers FOR SELECT
USING (auth.uid() = client_id);

CREATE POLICY "Recruiters can view offers for their candidates"
ON public.offers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM submissions s
    JOIN candidates c ON c.id = s.candidate_id
    WHERE s.candidate_id = offers.candidate_id 
    AND s.job_id = offers.job_id 
    AND c.recruiter_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all offers"
ON public.offers FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients can insert their offers"
ON public.offers FOR INSERT
WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Clients can update their offers"
ON public.offers FOR UPDATE
USING (auth.uid() = client_id);

CREATE POLICY "Clients can delete their offers"
ON public.offers FOR DELETE
USING (auth.uid() = client_id);

CREATE POLICY "Admins can manage all offers"
ON public.offers FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- System policy for edge functions (uses service_role, bypasses RLS anyway)
-- Not needed as service_role bypasses RLS