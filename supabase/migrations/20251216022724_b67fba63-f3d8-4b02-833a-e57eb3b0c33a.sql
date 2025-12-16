-- =============================================
-- PHASE 1: Basis-Outreach-System (5 Tabellen)
-- =============================================

-- 1. LEADS: Kontaktdatenbank mit 30+ Attributen
CREATE TABLE outreach_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Firmendaten
  company_name TEXT NOT NULL,
  company_website TEXT,
  industry TEXT,
  company_size TEXT,
  revenue_range TEXT,
  founding_year INTEGER,
  
  -- Kontaktperson
  contact_name TEXT NOT NULL,
  contact_role TEXT,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  contact_linkedin TEXT,
  
  -- Standort
  country TEXT DEFAULT 'DE',
  region TEXT,
  city TEXT,
  
  -- Recruiting-spezifisch
  recruiting_challenges JSONB DEFAULT '[]',
  current_ats TEXT,
  hiring_volume TEXT,
  open_positions_estimate INTEGER,
  
  -- Segmentierung
  lead_source TEXT,
  segment TEXT NOT NULL DEFAULT 'hiring_company',
  priority TEXT DEFAULT 'warm',
  score INTEGER DEFAULT 50,
  tags JSONB DEFAULT '[]',
  
  -- Status
  status TEXT DEFAULT 'new',
  last_contacted_at TIMESTAMPTZ,
  last_replied_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  
  -- Zusätzliche Attribute
  custom_attributes JSONB DEFAULT '{}',
  notes TEXT,
  
  -- Metadaten
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(contact_email)
);

-- 2. CAMPAIGNS: Kampagnen mit Regeln und Verboten
CREATE TABLE outreach_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Zielgruppen-Filter
  target_segment TEXT NOT NULL DEFAULT 'hiring_company',
  target_industries JSONB DEFAULT '[]',
  target_company_sizes JSONB DEFAULT '[]',
  target_regions JSONB DEFAULT '[]',
  
  -- Kampagnenziel
  goal TEXT NOT NULL DEFAULT 'initiate_conversation',
  
  -- Tonalität & Regeln
  tonality TEXT DEFAULT 'neutral',
  allowed_cta TEXT DEFAULT 'Macht ein kurzer Austausch Sinn?',
  forbidden_words JSONB DEFAULT '["jetzt", "dringend", "revolutionär", "beste", "einzigartige", "Gamechanger", "skalierbar", "disruptiv"]',
  max_word_count INTEGER DEFAULT 120,
  
  -- Absender
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  sender_signature TEXT,
  
  -- Sequenz-Konfiguration
  sequence_steps JSONB DEFAULT '[{"step": 1, "day": 0, "type": "initial"}, {"step": 2, "day": 3, "type": "followup_1"}, {"step": 3, "day": 7, "type": "followup_2"}]',
  
  -- Status
  is_active BOOLEAN DEFAULT false,
  is_paused BOOLEAN DEFAULT false,
  
  -- Statistiken
  stats JSONB DEFAULT '{"sent": 0, "opened": 0, "clicked": 0, "replied": 0, "converted": 0}',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 3. EMAILS: Generierte E-Mails mit Review-Status
CREATE TABLE outreach_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES outreach_leads(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES outreach_campaigns(id) ON DELETE SET NULL,
  
  -- Inhalt
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  body_html TEXT,
  
  -- AI-Metadaten
  used_variables JSONB DEFAULT '[]',
  confidence_level TEXT DEFAULT 'mittel',
  generation_prompt TEXT,
  
  -- Review-Workflow
  status TEXT DEFAULT 'draft',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  -- Sequenz
  sequence_step INTEGER DEFAULT 1,
  scheduled_for TIMESTAMPTZ,
  
  -- Versand
  sent_at TIMESTAMPTZ,
  resend_id TEXT,
  
  -- Tracking
  opened_at TIMESTAMPTZ,
  open_count INTEGER DEFAULT 0,
  clicked_at TIMESTAMPTZ,
  click_count INTEGER DEFAULT 0,
  clicked_links JSONB DEFAULT '[]',
  
  -- Reply-Tracking
  replied_at TIMESTAMPTZ,
  reply_sentiment TEXT,
  reply_intent TEXT,
  
  -- Conversion
  meeting_booked_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  revenue_attributed DECIMAL,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. SEND QUEUE: Hochperformante Versand-Warteschlange
CREATE TABLE outreach_send_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID REFERENCES outreach_emails(id) ON DELETE CASCADE,
  
  priority INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processing_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. IMPORT JOBS: Bulk-Import-Tracking
CREATE TABLE outreach_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  file_url TEXT,
  total_rows INTEGER DEFAULT 0,
  processed_rows INTEGER DEFAULT 0,
  successful_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  duplicate_rows INTEGER DEFAULT 0,
  
  status TEXT DEFAULT 'pending',
  error_log JSONB DEFAULT '[]',
  column_mapping JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

-- =============================================
-- PHASE 2: Reply Management (3 Tabellen)
-- =============================================

-- 6. CONVERSATIONS: E-Mail-Threads
CREATE TABLE outreach_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES outreach_leads(id) ON DELETE CASCADE,
  
  subject TEXT,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  message_count INTEGER DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'active',
  intent TEXT,
  sentiment TEXT,
  
  -- Assignment
  assigned_to UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. MESSAGES: Einzelne Nachrichten (Outbound + Inbound)
CREATE TABLE outreach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES outreach_conversations(id) ON DELETE CASCADE,
  email_id UUID REFERENCES outreach_emails(id) ON DELETE SET NULL,
  
  direction TEXT NOT NULL DEFAULT 'outbound',
  
  subject TEXT,
  body TEXT NOT NULL,
  body_html TEXT,
  
  -- Inbound-spezifisch
  from_email TEXT,
  from_name TEXT,
  received_at TIMESTAMPTZ,
  
  -- AI-Analyse
  intent TEXT,
  sentiment TEXT,
  ai_summary TEXT,
  suggested_action TEXT,
  
  -- Flags
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. SEQUENCES: Aktive Sequenzen pro Lead
CREATE TABLE outreach_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES outreach_leads(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  
  current_step INTEGER DEFAULT 1,
  next_email_at TIMESTAMPTZ,
  
  -- Status
  status TEXT DEFAULT 'active',
  pause_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- INDIZES für Performance (unique names)
-- =============================================

CREATE INDEX idx_outreach_leads_email ON outreach_leads(contact_email);
CREATE INDEX idx_outreach_leads_status ON outreach_leads(status);
CREATE INDEX idx_outreach_leads_segment ON outreach_leads(segment);
CREATE INDEX idx_outreach_leads_created_by ON outreach_leads(created_by);

CREATE INDEX idx_outreach_emails_status ON outreach_emails(status);
CREATE INDEX idx_outreach_emails_lead ON outreach_emails(lead_id);
CREATE INDEX idx_outreach_emails_campaign ON outreach_emails(campaign_id);

CREATE INDEX idx_outreach_queue_pending ON outreach_send_queue(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_outreach_queue_status ON outreach_send_queue(status);

CREATE INDEX idx_outreach_conversations_lead ON outreach_conversations(lead_id);
CREATE INDEX idx_outreach_conversations_status ON outreach_conversations(status);

CREATE INDEX idx_outreach_messages_conv ON outreach_messages(conversation_id);
CREATE INDEX idx_outreach_messages_dir ON outreach_messages(direction);

CREATE INDEX idx_outreach_sequences_next ON outreach_sequences(next_email_at) WHERE status = 'active';
CREATE INDEX idx_outreach_sequences_lead ON outreach_sequences(lead_id);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE outreach_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_send_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_sequences ENABLE ROW LEVEL SECURITY;

-- Admin full access policies
CREATE POLICY "Admin full access on outreach_leads" ON outreach_leads
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin full access on outreach_campaigns" ON outreach_campaigns
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin full access on outreach_emails" ON outreach_emails
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin full access on outreach_send_queue" ON outreach_send_queue
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin full access on outreach_import_jobs" ON outreach_import_jobs
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin full access on outreach_conversations" ON outreach_conversations
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin full access on outreach_messages" ON outreach_messages
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin full access on outreach_sequences" ON outreach_sequences
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- System policies for edge functions
CREATE POLICY "System can manage outreach_emails" ON outreach_emails
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "System can manage outreach_send_queue" ON outreach_send_queue
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "System can manage outreach_conversations" ON outreach_conversations
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "System can manage outreach_messages" ON outreach_messages
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "System can manage outreach_sequences" ON outreach_sequences
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "System can update outreach_leads" ON outreach_leads
  FOR UPDATE USING (true) WITH CHECK (true);