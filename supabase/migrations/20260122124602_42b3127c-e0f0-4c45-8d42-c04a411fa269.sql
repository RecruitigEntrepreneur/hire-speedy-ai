-- Add Partner Facts columns to company_profiles
ALTER TABLE public.company_profiles
ADD COLUMN IF NOT EXISTS headcount INTEGER,
ADD COLUMN IF NOT EXISTS annual_revenue TEXT,
ADD COLUMN IF NOT EXISTS founded_year INTEGER,
ADD COLUMN IF NOT EXISTS unique_selling_point TEXT,
ADD COLUMN IF NOT EXISTS company_awards TEXT[],
ADD COLUMN IF NOT EXISTS last_enriched_at TIMESTAMPTZ;