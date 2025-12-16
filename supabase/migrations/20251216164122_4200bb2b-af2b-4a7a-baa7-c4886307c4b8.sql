-- Add new fields to outreach_companies for intelligence data
ALTER TABLE outreach_companies 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS founding_year INTEGER,
ADD COLUMN IF NOT EXISTS revenue_range TEXT,
ADD COLUMN IF NOT EXISTS revenue_trend TEXT,
ADD COLUMN IF NOT EXISTS employee_growth TEXT,
ADD COLUMN IF NOT EXISTS platform_fit TEXT DEFAULT 'both',
ADD COLUMN IF NOT EXISTS intelligence_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_enriched_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS social_linkedin TEXT,
ADD COLUMN IF NOT EXISTS social_twitter TEXT;

-- Create company_intelligence table for historized events
CREATE TABLE IF NOT EXISTS public.company_intelligence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES outreach_companies(id) ON DELETE CASCADE,
  data_type TEXT NOT NULL, -- 'funding', 'management_change', 'expansion', 'news', 'financial', 'hiring'
  title TEXT NOT NULL,
  description TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  importance TEXT DEFAULT 'medium', -- 'high', 'medium', 'low'
  source TEXT,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  valid_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_intelligence ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_intelligence
CREATE POLICY "Authenticated users can view company intelligence"
ON public.company_intelligence
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert company intelligence"
ON public.company_intelligence
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can update company intelligence"
ON public.company_intelligence
FOR UPDATE
USING (true);

CREATE POLICY "Authenticated users can delete company intelligence"
ON public.company_intelligence
FOR DELETE
USING (true);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_company_intelligence_company_id ON public.company_intelligence(company_id);
CREATE INDEX IF NOT EXISTS idx_company_intelligence_data_type ON public.company_intelligence(data_type);
CREATE INDEX IF NOT EXISTS idx_company_intelligence_captured_at ON public.company_intelligence(captured_at DESC);