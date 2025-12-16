-- Erweitere outreach_leads um alle neuen Felder für 80+ Variablen

-- Person erweitert
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS seniority TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS mobile_phone TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS direct_phone TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS office_phone TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS personal_linkedin_url TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS education TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS email_quality TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS email_verification_status TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS profile_id TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS sid TEXT;

-- Company erweitert
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS company_alias TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS company_type TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS company_description TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS company_domain TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS company_headcount INTEGER;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS company_industries JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS company_technologies JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS company_financials TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS company_linkedin_url TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS company_founded_year INTEGER;

-- Company Adresse
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS company_address_line TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS company_city TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS company_zip TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS company_state TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS company_country TEXT;

-- HQ Adresse
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS hq_name TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS hq_address_line TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS hq_city TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS hq_zip TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS hq_state TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS hq_country TEXT;

-- Hiring-Signale (als JSONB Array für Flexibilität)
-- Format: [{title, url, location, date}, ...]
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS hiring_signals JSONB DEFAULT '[]'::jsonb;

-- Wechsel-Signale
-- Format: {prev_company, prev_title, new_company, new_title, date}
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS job_change_data JSONB DEFAULT '{}'::jsonb;
-- Format: {from_country, from_state, to_country, to_state, date}
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS location_move_data JSONB DEFAULT '{}'::jsonb;

-- Meta
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS list_name TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'de';
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS segment TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS priority TEXT;