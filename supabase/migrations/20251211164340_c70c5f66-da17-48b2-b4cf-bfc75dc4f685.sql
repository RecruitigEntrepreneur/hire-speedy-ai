-- =============================================
-- RECRUITER VERIFICATIONS TABLE
-- =============================================

CREATE TABLE public.recruiter_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID NOT NULL UNIQUE,
  
  -- Step 1: Info gelesen
  info_acknowledged BOOLEAN DEFAULT false,
  info_acknowledged_at TIMESTAMPTZ,
  
  -- Step 2: AGB
  terms_accepted BOOLEAN DEFAULT false,
  terms_accepted_at TIMESTAMPTZ,
  terms_version TEXT DEFAULT '1.0',
  
  -- Step 3: NDA
  nda_accepted BOOLEAN DEFAULT false,
  nda_accepted_at TIMESTAMPTZ,
  nda_version TEXT DEFAULT '1.0',
  
  -- Step 4: Rahmenvertrag
  contract_signed BOOLEAN DEFAULT false,
  contract_signed_at TIMESTAMPTZ,
  digital_signature TEXT,
  contract_version TEXT DEFAULT '1.0',
  
  -- Step 5: Profildaten
  company_name TEXT,
  tax_id TEXT,
  iban TEXT,
  profile_complete BOOLEAN DEFAULT false,
  profile_completed_at TIMESTAMPTZ,
  
  -- Status
  verification_status TEXT DEFAULT 'pending',
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  rejection_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recruiter_verifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Recruiters can view own verification"
ON public.recruiter_verifications
FOR SELECT
USING (auth.uid() = recruiter_id);

CREATE POLICY "Recruiters can insert own verification"
ON public.recruiter_verifications
FOR INSERT
WITH CHECK (auth.uid() = recruiter_id);

CREATE POLICY "Recruiters can update own verification"
ON public.recruiter_verifications
FOR UPDATE
USING (auth.uid() = recruiter_id);

CREATE POLICY "Admins can manage all verifications"
ON public.recruiter_verifications
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_recruiter_verifications_updated_at
BEFORE UPDATE ON public.recruiter_verifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();