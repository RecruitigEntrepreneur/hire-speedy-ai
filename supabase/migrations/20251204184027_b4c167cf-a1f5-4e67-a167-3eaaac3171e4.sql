-- Status für user_roles erweitern
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- Admin-Notizen in profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- Custom fee per recruiter
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS custom_fee_percentage NUMERIC;

-- E-Mail Templates für Automationen
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email templates"
ON email_templates FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Recruiter Performance Tracking
CREATE TABLE IF NOT EXISTS recruiter_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID NOT NULL,
  placement_rate NUMERIC DEFAULT 0,
  interview_rate NUMERIC DEFAULT 0,
  avg_response_time_hours NUMERIC DEFAULT 0,
  quality_score NUMERIC DEFAULT 0,
  total_submissions INTEGER DEFAULT 0,
  total_placements INTEGER DEFAULT 0,
  total_interviews INTEGER DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE recruiter_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage recruiter performance"
ON recruiter_performance FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Recruiters can view their own performance"
ON recruiter_performance FOR SELECT
USING (auth.uid() = recruiter_id);

-- Triggers für updated_at
CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON email_templates
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_recruiter_performance_updated_at
BEFORE UPDATE ON recruiter_performance
FOR EACH ROW EXECUTE FUNCTION update_updated_at();