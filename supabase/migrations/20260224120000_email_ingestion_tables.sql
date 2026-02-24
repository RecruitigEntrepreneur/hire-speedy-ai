-- ============================================================================
-- Email Ingestion: recruiter_inbound_addresses + candidate_import_jobs
-- ============================================================================

-- 1. Recruiter Inbound Addresses
-- Each recruiter gets a unique inbound email address for CV forwarding
CREATE TABLE IF NOT EXISTS public.recruiter_inbound_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_address TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ria_email ON public.recruiter_inbound_addresses(email_address);
CREATE INDEX idx_ria_recruiter ON public.recruiter_inbound_addresses(recruiter_id);

ALTER TABLE public.recruiter_inbound_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recruiters can view their own inbound addresses"
  ON public.recruiter_inbound_addresses FOR SELECT
  USING (auth.uid() = recruiter_id);

CREATE POLICY "Admins can view all inbound addresses"
  ON public.recruiter_inbound_addresses FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Candidate Import Jobs
-- State machine for tracking email-based candidate imports
CREATE TABLE IF NOT EXISTS public.candidate_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID NOT NULL REFERENCES auth.users(id),

  -- Email metadata
  from_email TEXT NOT NULL,
  from_name TEXT,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  message_id TEXT,
  in_reply_to TEXT,

  -- Attachments (uploaded to cv-documents storage during sync phase)
  attachments JSONB DEFAULT '[]'::jsonb,
  -- Array of: { storage_path, original_name, size_bytes, mime_type }

  -- AI Classification results
  classification TEXT,
  -- 'new_candidate' | 'candidate_update' | 'candidate_notes' | 'candidate_with_notes' | 'multi_candidate' | 'unprocessable'
  classification_confidence REAL,
  classification_raw JSONB,

  -- Matching results
  matched_candidate_id UUID REFERENCES public.candidates(id),
  match_method TEXT,
  match_confidence REAL,

  -- Processing results
  created_candidate_ids UUID[] DEFAULT '{}',
  notes_created BOOLEAN DEFAULT false,

  -- State machine
  status TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'processing' | 'classified' | 'completed' | 'failed' | 'needs_review'
  error_message TEXT,
  processing_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cij_recruiter ON public.candidate_import_jobs(recruiter_id);
CREATE INDEX idx_cij_status ON public.candidate_import_jobs(status);
CREATE INDEX idx_cij_message_id ON public.candidate_import_jobs(message_id);

ALTER TABLE public.candidate_import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recruiters can view their own import jobs"
  ON public.candidate_import_jobs FOR SELECT
  USING (auth.uid() = recruiter_id);

CREATE POLICY "Admins can view all import jobs"
  ON public.candidate_import_jobs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role can insert/update (used by edge functions)
CREATE POLICY "Service role can manage import jobs"
  ON public.candidate_import_jobs FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. Add source tracking to candidate_notes
ALTER TABLE public.candidate_notes
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS import_job_id UUID REFERENCES public.candidate_import_jobs(id);

-- 4. Index for candidate matching by email within recruiter scope
CREATE INDEX IF NOT EXISTS idx_candidates_email_recruiter
  ON public.candidates(email, recruiter_id);

CREATE INDEX IF NOT EXISTS idx_candidates_phone_recruiter
  ON public.candidates(phone, recruiter_id)
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_candidates_fullname_recruiter
  ON public.candidates(recruiter_id, full_name);

-- 5. Auto-seed inbound addresses for existing recruiters
-- Uses same shortId logic as frontend: first 8 chars of UUID without dashes
INSERT INTO public.recruiter_inbound_addresses (recruiter_id, email_address)
SELECT
  ur.user_id,
  'r_' || LEFT(REPLACE(ur.user_id::text, '-', ''), 8) || '@inbound.matchunt.ai'
FROM public.user_roles ur
WHERE ur.role = 'recruiter'
ON CONFLICT (email_address) DO NOTHING;

-- 6. Trigger to auto-create inbound address for new recruiters
CREATE OR REPLACE FUNCTION public.auto_create_inbound_address()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'recruiter' THEN
    INSERT INTO public.recruiter_inbound_addresses (recruiter_id, email_address)
    VALUES (
      NEW.user_id,
      'r_' || LEFT(REPLACE(NEW.user_id::text, '-', ''), 8) || '@inbound.matchunt.ai'
    )
    ON CONFLICT (email_address) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_recruiter_role_created
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_inbound_address();
