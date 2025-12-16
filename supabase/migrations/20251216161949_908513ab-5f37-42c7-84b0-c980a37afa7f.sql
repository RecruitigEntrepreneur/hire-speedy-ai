-- Add Company-First columns to outreach_leads
ALTER TABLE public.outreach_leads 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.outreach_companies(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS decision_level text DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS functional_area text DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS outreach_status text DEFAULT 'not_contacted';

-- Add index for company_id lookups
CREATE INDEX IF NOT EXISTS idx_outreach_leads_company_id ON public.outreach_leads(company_id);

-- Add index for outreach_status
CREATE INDEX IF NOT EXISTS idx_outreach_leads_outreach_status ON public.outreach_leads(outreach_status);

-- Add Company-First columns to outreach_companies
ALTER TABLE public.outreach_companies 
ADD COLUMN IF NOT EXISTS outreach_status text DEFAULT 'neu',
ADD COLUMN IF NOT EXISTS warm_score integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS best_entry_point_id uuid,
ADD COLUMN IF NOT EXISTS last_activity_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS company_notes text,
ADD COLUMN IF NOT EXISTS platform_fit text[];