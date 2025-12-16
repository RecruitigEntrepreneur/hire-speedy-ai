-- Add extended personalization fields to outreach_companies
ALTER TABLE public.outreach_companies 
ADD COLUMN IF NOT EXISTS kununu_score DECIMAL,
ADD COLUMN IF NOT EXISTS glassdoor_score DECIMAL,
ADD COLUMN IF NOT EXISTS linkedin_followers INTEGER,
ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
ADD COLUMN IF NOT EXISTS funding_stage TEXT,
ADD COLUMN IF NOT EXISTS funding_total TEXT,
ADD COLUMN IF NOT EXISTS investors JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS key_executives JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS remote_policy TEXT,
ADD COLUMN IF NOT EXISTS awards JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS cloud_provider TEXT,
ADD COLUMN IF NOT EXISTS marketing_tools JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS development_tools JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS company_culture JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS recent_funding_date TEXT,
ADD COLUMN IF NOT EXISTS employee_growth TEXT;