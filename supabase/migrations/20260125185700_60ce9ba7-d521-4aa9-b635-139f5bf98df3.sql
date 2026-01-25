-- Add crawl_sources column to track which sources were crawled and their status
ALTER TABLE public.outreach_companies 
ADD COLUMN IF NOT EXISTS crawl_sources JSONB DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN public.outreach_companies.crawl_sources IS 'Tracks which data sources were crawled, their status, and what data was extracted from each source';