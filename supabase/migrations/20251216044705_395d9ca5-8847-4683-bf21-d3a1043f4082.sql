-- Add career crawl columns to outreach_leads
ALTER TABLE outreach_leads ADD COLUMN IF NOT EXISTS career_page_url TEXT;
ALTER TABLE outreach_leads ADD COLUMN IF NOT EXISTS career_page_status TEXT DEFAULT 'pending';
ALTER TABLE outreach_leads ADD COLUMN IF NOT EXISTS live_jobs JSONB DEFAULT '[]'::jsonb;
ALTER TABLE outreach_leads ADD COLUMN IF NOT EXISTS live_jobs_count INTEGER DEFAULT 0;
ALTER TABLE outreach_leads ADD COLUMN IF NOT EXISTS career_crawled_at TIMESTAMPTZ;
ALTER TABLE outreach_leads ADD COLUMN IF NOT EXISTS hiring_activity TEXT DEFAULT 'unknown';

-- Add index for sorting by hiring activity
CREATE INDEX IF NOT EXISTS idx_outreach_leads_hiring_activity ON outreach_leads(hiring_activity);
CREATE INDEX IF NOT EXISTS idx_outreach_leads_live_jobs_count ON outreach_leads(live_jobs_count DESC);

-- Add comment for documentation
COMMENT ON COLUMN outreach_leads.hiring_activity IS 'hot (10+) | active (3-9) | low (1-2) | none (0) | unknown';