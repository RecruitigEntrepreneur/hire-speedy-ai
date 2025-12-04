-- Phase D: Deal Health Table
CREATE TABLE deal_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL UNIQUE,
  
  -- Health Metriken (0-100)
  health_score INTEGER DEFAULT 50,
  risk_level TEXT DEFAULT 'medium',
  
  -- Drop-Off Analyse
  drop_off_probability NUMERIC DEFAULT 0,
  days_since_last_activity INTEGER DEFAULT 0,
  
  -- Engpass-Analyse
  bottleneck TEXT,
  bottleneck_user_id UUID,
  bottleneck_days INTEGER DEFAULT 0,
  
  -- KI-Analyse
  ai_assessment TEXT,
  recommended_actions JSONB DEFAULT '[]',
  risk_factors JSONB DEFAULT '[]',
  
  -- Timestamps
  calculated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for deal_health
ALTER TABLE deal_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view deal health for their submissions" ON deal_health
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM submissions s
      JOIN jobs j ON j.id = s.job_id
      WHERE s.id = deal_health.submission_id
      AND (s.recruiter_id = auth.uid() OR j.client_id = auth.uid())
    )
  );

CREATE POLICY "System can insert deal health" ON deal_health
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update deal health" ON deal_health
  FOR UPDATE USING (true);

CREATE POLICY "Admins can manage all deal health" ON deal_health
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Indexes for deal_health
CREATE INDEX idx_deal_health_submission ON deal_health(submission_id);
CREATE INDEX idx_deal_health_risk ON deal_health(risk_level, health_score);

-- Phase E: Extend interviews table
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS proposed_slots JSONB DEFAULT '[]';
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS selected_slot_index INTEGER;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS teams_meeting_id TEXT;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS teams_join_url TEXT;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS client_confirmed BOOLEAN DEFAULT false;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS client_confirmed_at TIMESTAMPTZ;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS candidate_confirmed BOOLEAN DEFAULT false;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS candidate_confirmed_at TIMESTAMPTZ;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS reminder_24h_sent BOOLEAN DEFAULT false;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS reminder_1h_sent BOOLEAN DEFAULT false;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS no_show_reported BOOLEAN DEFAULT false;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS no_show_by TEXT;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS selection_token TEXT UNIQUE;

-- Phase F: Fraud Signals Table
CREATE TABLE fraud_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Signal-Typ
  signal_type TEXT NOT NULL,
  
  -- Schweregrad
  severity TEXT DEFAULT 'low',
  confidence_score NUMERIC DEFAULT 0,
  
  -- Betroffene Entitäten
  user_id UUID,
  candidate_id UUID,
  submission_id UUID,
  job_id UUID,
  
  -- Details
  details JSONB DEFAULT '{}',
  evidence JSONB DEFAULT '[]',
  
  -- Status
  status TEXT DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  action_taken TEXT,
  notes TEXT,
  
  -- Auto-Actions
  auto_action_taken TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for fraud_signals
ALTER TABLE fraud_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all fraud signals" ON fraud_signals
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert fraud signals" ON fraud_signals
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their own fraud signals" ON fraud_signals
  FOR SELECT USING (auth.uid() = user_id);

-- Indexes for fraud_signals
CREATE INDEX idx_fraud_signals_status ON fraud_signals(status, severity);
CREATE INDEX idx_fraud_signals_user ON fraud_signals(user_id);
CREATE INDEX idx_fraud_signals_candidate ON fraud_signals(candidate_id);
CREATE INDEX idx_fraud_signals_type ON fraud_signals(signal_type, created_at DESC);