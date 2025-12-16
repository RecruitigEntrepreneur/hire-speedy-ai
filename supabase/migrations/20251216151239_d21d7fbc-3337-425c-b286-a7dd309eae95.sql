-- Create outreach_companies table
CREATE TABLE public.outreach_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identification (domain is the key!)
  domain TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  
  -- Basic data
  website TEXT,
  linkedin_url TEXT,
  description TEXT,
  industry TEXT,
  headcount INTEGER,
  founded_year INTEGER,
  technologies JSONB DEFAULT '[]'::jsonb,
  
  -- Location
  city TEXT,
  country TEXT,
  address TEXT,
  
  -- Career page data (centralized!)
  career_page_url TEXT,
  career_page_status TEXT DEFAULT 'pending',
  live_jobs JSONB DEFAULT '[]'::jsonb,
  live_jobs_count INTEGER DEFAULT 0,
  hiring_activity TEXT DEFAULT 'unknown',
  career_crawled_at TIMESTAMPTZ,
  
  -- News & Updates
  recent_news JSONB DEFAULT '[]'::jsonb,
  news_crawled_at TIMESTAMPTZ,
  company_updates JSONB DEFAULT '[]'::jsonb,
  
  -- Scoring & Status
  priority_score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  
  -- Meta
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add company_id to outreach_leads
ALTER TABLE public.outreach_leads ADD COLUMN company_id UUID REFERENCES public.outreach_companies(id);

-- Create indexes
CREATE INDEX idx_outreach_companies_domain ON public.outreach_companies(domain);
CREATE INDEX idx_outreach_companies_hiring_activity ON public.outreach_companies(hiring_activity);
CREATE INDEX idx_outreach_companies_status ON public.outreach_companies(status);
CREATE INDEX idx_outreach_leads_company ON public.outreach_leads(company_id);

-- Enable RLS
ALTER TABLE public.outreach_companies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for outreach_companies
CREATE POLICY "Admins can manage all companies"
ON public.outreach_companies FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view companies"
ON public.outreach_companies FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert companies"
ON public.outreach_companies FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update companies"
ON public.outreach_companies FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_outreach_companies_updated_at
BEFORE UPDATE ON public.outreach_companies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();