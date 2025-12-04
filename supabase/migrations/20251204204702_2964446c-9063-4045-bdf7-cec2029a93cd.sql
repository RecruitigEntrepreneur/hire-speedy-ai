-- =====================================================
-- PHASE B: Client Verifications
-- =====================================================

CREATE TABLE public.client_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  
  -- AGB/Terms
  terms_accepted BOOLEAN DEFAULT false,
  terms_accepted_at TIMESTAMPTZ,
  terms_version TEXT DEFAULT '1.0',
  
  -- Vertrag
  contract_signed BOOLEAN DEFAULT false,
  contract_signed_at TIMESTAMPTZ,
  contract_pdf_url TEXT,
  digital_signature TEXT,
  
  -- KYC
  kyc_status TEXT DEFAULT 'pending',
  kyc_verified_at TIMESTAMPTZ,
  kyc_verified_by UUID,
  company_registration_number TEXT,
  vat_id TEXT,
  kyc_rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(client_id)
);

ALTER TABLE public.client_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own verification" ON public.client_verifications
  FOR SELECT USING (auth.uid() = client_id);
  
CREATE POLICY "Clients can insert own verification" ON public.client_verifications
  FOR INSERT WITH CHECK (auth.uid() = client_id);
  
CREATE POLICY "Clients can update own verification" ON public.client_verifications
  FOR UPDATE USING (auth.uid() = client_id);
  
CREATE POLICY "Admins can manage all verifications" ON public.client_verifications
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_client_verifications_updated_at
  BEFORE UPDATE ON public.client_verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- =====================================================
-- PHASE C.1: Event Engine - Platform Events
-- =====================================================

CREATE TABLE public.platform_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event-Typ
  event_type TEXT NOT NULL,
  
  -- Kontext
  user_id UUID NOT NULL,
  user_type TEXT,
  entity_type TEXT,
  entity_id UUID,
  
  -- Metadaten
  metadata JSONB DEFAULT '{}',
  response_time_seconds INTEGER,
  session_id TEXT,
  
  -- Device-Info (für Anti-Fraud)
  ip_address TEXT,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.platform_events ENABLE ROW LEVEL SECURITY;

-- System can insert events
CREATE POLICY "System can insert events" ON public.platform_events
  FOR INSERT WITH CHECK (true);

-- Users can view their own events
CREATE POLICY "Users can view own events" ON public.platform_events
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all events
CREATE POLICY "Admins can view all events" ON public.platform_events
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Performance-Indexes
CREATE INDEX idx_platform_events_user ON public.platform_events(user_id, created_at DESC);
CREATE INDEX idx_platform_events_entity ON public.platform_events(entity_type, entity_id);
CREATE INDEX idx_platform_events_type ON public.platform_events(event_type, created_at DESC);

-- =====================================================
-- PHASE C.2: Behavior Engine - User Behavior Scores
-- =====================================================

CREATE TABLE public.user_behavior_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  user_type TEXT NOT NULL,
  
  -- Response-Metriken
  avg_response_time_hours NUMERIC DEFAULT 0,
  response_count INTEGER DEFAULT 0,
  
  -- Behavior-Klassifizierung
  ghost_rate NUMERIC DEFAULT 0,
  sla_compliance_rate NUMERIC DEFAULT 100,
  interview_show_rate NUMERIC DEFAULT 100,
  
  -- Klassifizierung
  behavior_class TEXT DEFAULT 'neutral',
  
  -- Risiko-Score (0-100)
  risk_score NUMERIC DEFAULT 0,
  
  -- Letzte Berechnung
  calculated_at TIMESTAMPTZ DEFAULT now(),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_behavior_scores ENABLE ROW LEVEL SECURITY;

-- Users can view their own scores
CREATE POLICY "Users can view own behavior scores" ON public.user_behavior_scores
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can manage all scores
CREATE POLICY "Admins can manage all behavior scores" ON public.user_behavior_scores
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- System can upsert scores
CREATE POLICY "System can insert behavior scores" ON public.user_behavior_scores
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update behavior scores" ON public.user_behavior_scores
  FOR UPDATE USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_user_behavior_scores_updated_at
  BEFORE UPDATE ON public.user_behavior_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- =====================================================
-- PHASE C.3: SLA Engine - Rules
-- =====================================================

CREATE TABLE public.sla_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL,
  
  -- Anwendungsbereich
  entity_type TEXT NOT NULL,
  phase TEXT NOT NULL,
  applicable_to TEXT DEFAULT 'all',
  
  -- Zeitvorgaben
  deadline_hours INTEGER NOT NULL,
  warning_hours INTEGER,
  
  -- Aktionen
  warning_action TEXT DEFAULT 'notify',
  deadline_action TEXT DEFAULT 'remind',
  escalate_to TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 1,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sla_rules ENABLE ROW LEVEL SECURITY;

-- Everyone can read SLA rules
CREATE POLICY "Anyone can read SLA rules" ON public.sla_rules
  FOR SELECT USING (true);

-- Admins can manage SLA rules
CREATE POLICY "Admins can manage SLA rules" ON public.sla_rules
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Default SLA-Regeln
INSERT INTO public.sla_rules (rule_name, entity_type, phase, applicable_to, deadline_hours, warning_hours, warning_action, deadline_action) VALUES
  ('client_submission_review', 'submission', 'submitted', 'client', 48, 6, 'email', 'remind'),
  ('candidate_opt_in', 'submission', 'opt_in_requested', 'recruiter', 24, 4, 'notify', 'escalate'),
  ('interview_response', 'interview', 'pending', 'client', 24, 4, 'email', 'escalate'),
  ('interview_feedback', 'interview', 'completed', 'client', 48, 12, 'notify', 'remind'),
  ('recruiter_first_submission', 'job', 'published', 'recruiter', 72, 24, 'notify', 'remind');

-- =====================================================
-- PHASE C.3: SLA Engine - Deadlines Tracking
-- =====================================================

CREATE TABLE public.sla_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sla_rule_id UUID REFERENCES public.sla_rules(id) ON DELETE CASCADE,
  
  -- Betroffene Entitäten
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  responsible_user_id UUID NOT NULL,
  
  -- Zeitstempel
  started_at TIMESTAMPTZ DEFAULT now(),
  deadline_at TIMESTAMPTZ NOT NULL,
  warning_at TIMESTAMPTZ,
  
  -- Status
  status TEXT DEFAULT 'active',
  completed_at TIMESTAMPTZ,
  breached_at TIMESTAMPTZ,
  
  -- Reminder-Tracking
  reminders_sent INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sla_deadlines ENABLE ROW LEVEL SECURITY;

-- Users can view their own deadlines
CREATE POLICY "Users can view own deadlines" ON public.sla_deadlines
  FOR SELECT USING (auth.uid() = responsible_user_id);

-- Admins can manage all deadlines
CREATE POLICY "Admins can manage all deadlines" ON public.sla_deadlines
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- System can manage deadlines
CREATE POLICY "System can insert deadlines" ON public.sla_deadlines
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update deadlines" ON public.sla_deadlines
  FOR UPDATE USING (true);

-- Index for deadline checks
CREATE INDEX idx_sla_deadlines_status ON public.sla_deadlines(status, deadline_at);
CREATE INDEX idx_sla_deadlines_user ON public.sla_deadlines(responsible_user_id, status);