-- Phase 1: Erweitere outreach_companies für Company-First
ALTER TABLE outreach_companies 
ADD COLUMN IF NOT EXISTS outreach_status TEXT DEFAULT 'unberührt',
ADD COLUMN IF NOT EXISTS warm_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS best_entry_point_id UUID,
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS company_notes TEXT,
ADD COLUMN IF NOT EXISTS platform_fit TEXT[] DEFAULT '{}';

-- Phase 1: Erweitere outreach_leads für Contact-Tracking
ALTER TABLE outreach_leads
ADD COLUMN IF NOT EXISTS decision_level TEXT DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS functional_area TEXT,
ADD COLUMN IF NOT EXISTS contact_outreach_status TEXT DEFAULT 'nicht_kontaktiert',
ADD COLUMN IF NOT EXISTS is_primary_contact BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 0;

-- Index für Performance
CREATE INDEX IF NOT EXISTS idx_outreach_companies_status ON outreach_companies(outreach_status);
CREATE INDEX IF NOT EXISTS idx_outreach_companies_warm_score ON outreach_companies(warm_score DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_leads_company_decision ON outreach_leads(company_id, decision_level);