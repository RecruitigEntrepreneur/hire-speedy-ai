-- Phase 1: Suppression List & Rate Limits

-- Globale Suppression/DNC-Liste
CREATE TABLE IF NOT EXISTS public.outreach_suppression_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  reason TEXT NOT NULL, -- 'unsubscribe', 'bounce', 'complaint', 'manual', 'spam_trap', 'reply_optout'
  source TEXT, -- 'reply', 'webhook', 'import', 'admin'
  original_lead_id UUID REFERENCES public.outreach_leads(id) ON DELETE SET NULL,
  added_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

-- Index für schnelle Lookups
CREATE INDEX idx_suppression_email ON public.outreach_suppression_list(email);
CREATE INDEX idx_suppression_reason ON public.outreach_suppression_list(reason);

-- Rate Limits Tabelle
CREATE TABLE IF NOT EXISTS public.outreach_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_email TEXT NOT NULL,
  target_domain TEXT, -- NULL = global für diesen Sender
  limit_type TEXT NOT NULL DEFAULT 'daily', -- 'daily', 'hourly'
  max_count INTEGER NOT NULL DEFAULT 100,
  current_count INTEGER DEFAULT 0,
  reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sender_email, target_domain, limit_type)
);

CREATE INDEX idx_rate_limits_sender ON public.outreach_rate_limits(sender_email);
CREATE INDEX idx_rate_limits_reset ON public.outreach_rate_limits(reset_at);

-- Winning Patterns für Learning Loop (Phase 4, aber Tabelle jetzt anlegen)
CREATE TABLE IF NOT EXISTS public.outreach_winning_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.outreach_campaigns(id) ON DELETE CASCADE,
  segment TEXT,
  pattern_type TEXT NOT NULL, -- 'subject', 'hook', 'cta', 'no_go'
  pattern_text TEXT NOT NULL,
  success_rate NUMERIC DEFAULT 0,
  sample_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_winning_patterns_campaign ON public.outreach_winning_patterns(campaign_id);
CREATE INDEX idx_winning_patterns_type ON public.outreach_winning_patterns(pattern_type);

-- Reply Classifications für Labeling
CREATE TABLE IF NOT EXISTS public.outreach_reply_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID REFERENCES public.outreach_emails(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.outreach_leads(id) ON DELETE CASCADE,
  ai_classification TEXT, -- 'positive', 'neutral', 'objection', 'not_interested', 'wrong_person', 'unsub', 'spam_risk'
  ai_confidence NUMERIC,
  human_classification TEXT, -- Override durch Admin
  classified_by UUID,
  classified_at TIMESTAMPTZ,
  reply_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_reply_class_email ON public.outreach_reply_classifications(email_id);
CREATE INDEX idx_reply_class_lead ON public.outreach_reply_classifications(lead_id);

-- Erweitere Campaigns um neue Felder
ALTER TABLE public.outreach_campaigns ADD COLUMN IF NOT EXISTS test_mode BOOLEAN DEFAULT false;
ALTER TABLE public.outreach_campaigns ADD COLUMN IF NOT EXISTS test_recipients JSONB DEFAULT '[]';
ALTER TABLE public.outreach_campaigns ADD COLUMN IF NOT EXISTS variable_whitelist JSONB DEFAULT '["first_name","job_title","company_name","industries","headcount","technologies","hiring_title_1","city","country"]';
ALTER TABLE public.outreach_campaigns ADD COLUMN IF NOT EXISTS fallbacks JSONB DEFAULT '{"first_name":"","industries":"Ihr Bereich","city":"","country":""}';
ALTER TABLE public.outreach_campaigns ADD COLUMN IF NOT EXISTS audience_type TEXT DEFAULT 'hiring_company';
ALTER TABLE public.outreach_campaigns ADD COLUMN IF NOT EXISTS value_proposition TEXT;
ALTER TABLE public.outreach_campaigns ADD COLUMN IF NOT EXISTS cta_type TEXT DEFAULT 'yes_no';
ALTER TABLE public.outreach_campaigns ADD COLUMN IF NOT EXISTS forbidden_words JSONB DEFAULT '["dringend","jetzt","revolutionär","garantiert","exklusiv"]';
ALTER TABLE public.outreach_campaigns ADD COLUMN IF NOT EXISTS max_words INTEGER DEFAULT 120;
ALTER TABLE public.outreach_campaigns ADD COLUMN IF NOT EXISTS daily_limit INTEGER DEFAULT 200;
ALTER TABLE public.outreach_campaigns ADD COLUMN IF NOT EXISTS domain_daily_limit INTEGER DEFAULT 10;

-- Erweitere Emails um Attribution-Felder
ALTER TABLE public.outreach_emails ADD COLUMN IF NOT EXISTS call_booked_at TIMESTAMPTZ;
ALTER TABLE public.outreach_emails ADD COLUMN IF NOT EXISTS job_created_at TIMESTAMPTZ;
ALTER TABLE public.outreach_emails ADD COLUMN IF NOT EXISTS hire_completed_at TIMESTAMPTZ;
ALTER TABLE public.outreach_emails ADD COLUMN IF NOT EXISTS revenue_amount NUMERIC;
ALTER TABLE public.outreach_emails ADD COLUMN IF NOT EXISTS attribution_notes TEXT;
ALTER TABLE public.outreach_emails ADD COLUMN IF NOT EXISTS ai_confidence TEXT;
ALTER TABLE public.outreach_emails ADD COLUMN IF NOT EXISTS personalization_used JSONB DEFAULT '[]';
ALTER TABLE public.outreach_emails ADD COLUMN IF NOT EXISTS risk_flags JSONB DEFAULT '[]';

-- Erweitere Campaigns um Attribution-Summen
ALTER TABLE public.outreach_campaigns ADD COLUMN IF NOT EXISTS total_revenue NUMERIC DEFAULT 0;
ALTER TABLE public.outreach_campaigns ADD COLUMN IF NOT EXISTS total_hires INTEGER DEFAULT 0;
ALTER TABLE public.outreach_campaigns ADD COLUMN IF NOT EXISTS total_meetings INTEGER DEFAULT 0;

-- Erweitere Leads um Validierungsfelder
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS email_validated BOOLEAN DEFAULT false;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS email_validation_status TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS is_suppressed BOOLEAN DEFAULT false;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS suppression_reason TEXT;
ALTER TABLE public.outreach_leads ADD COLUMN IF NOT EXISTS duplicate_of UUID REFERENCES public.outreach_leads(id);

-- RLS Policies
ALTER TABLE public.outreach_suppression_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_winning_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_reply_classifications ENABLE ROW LEVEL SECURITY;

-- Suppression List Policies
CREATE POLICY "Admins can manage suppression list" ON public.outreach_suppression_list
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view suppression list" ON public.outreach_suppression_list
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert suppression entries" ON public.outreach_suppression_list
  FOR INSERT WITH CHECK (true);

-- Rate Limits Policies
CREATE POLICY "Admins can manage rate limits" ON public.outreach_rate_limits
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can manage rate limits" ON public.outreach_rate_limits
  FOR ALL USING (true);

-- Winning Patterns Policies
CREATE POLICY "Admins can manage winning patterns" ON public.outreach_winning_patterns
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view winning patterns" ON public.outreach_winning_patterns
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Reply Classifications Policies
CREATE POLICY "Admins can manage reply classifications" ON public.outreach_reply_classifications
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view reply classifications" ON public.outreach_reply_classifications
  FOR SELECT USING (auth.uid() IS NOT NULL);