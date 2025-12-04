
-- =====================================================
-- PHASE 1: FOUNDATION - Database Migration
-- =====================================================

-- 1. Extend candidates table with channel preferences
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS preferred_channel TEXT DEFAULT 'email';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT false;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS sms_opt_in BOOLEAN DEFAULT false;

-- 2. Create offers table
CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  recruiter_id UUID NOT NULL,
  
  -- Offer details
  position_title TEXT NOT NULL,
  salary_offered INTEGER NOT NULL,
  salary_currency TEXT DEFAULT 'EUR',
  bonus_amount INTEGER,
  equity_percentage NUMERIC,
  benefits JSONB DEFAULT '[]',
  start_date DATE,
  contract_type TEXT DEFAULT 'permanent',
  probation_months INTEGER DEFAULT 6,
  remote_policy TEXT,
  location TEXT,
  custom_terms TEXT,
  
  -- Negotiation
  original_salary INTEGER,
  counter_offer_salary INTEGER,
  counter_offer_at TIMESTAMPTZ,
  counter_offer_notes TEXT,
  negotiation_rounds INTEGER DEFAULT 0,
  
  -- Status tracking
  status TEXT DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  decision_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Signature
  offer_document_url TEXT,
  candidate_signature TEXT,
  candidate_signed_at TIMESTAMPTZ,
  client_signature TEXT,
  client_signed_at TIMESTAMPTZ,
  
  -- Token for external access
  access_token TEXT UNIQUE,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create offer_events table for tracking
CREATE TABLE IF NOT EXISTS offer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_type TEXT,
  actor_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create communication_log table
CREATE TABLE IF NOT EXISTS communication_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
  submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  message_type TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  template_id UUID,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  external_id TEXT,
  links_clicked JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create message_templates table
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  channel TEXT NOT NULL,
  message_type TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Create candidate_conflicts table
CREATE TABLE IF NOT EXISTS candidate_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  submission_a_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  submission_b_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  conflict_type TEXT NOT NULL,
  severity TEXT DEFAULT 'low',
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Create rejection_templates table
CREATE TABLE IF NOT EXISTS rejection_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  stage TEXT NOT NULL,
  reason_category TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  include_feedback BOOLEAN DEFAULT false,
  include_alternatives BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Create rejections table
CREATE TABLE IF NOT EXISTS rejections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  rejected_by UUID NOT NULL,
  rejection_stage TEXT NOT NULL,
  rejection_reason TEXT,
  reason_category TEXT,
  template_id UUID REFERENCES rejection_templates(id),
  custom_feedback TEXT,
  ai_improvement_suggestions JSONB,
  sent_via TEXT[],
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS on all new tables
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rejection_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE rejections ENABLE ROW LEVEL SECURITY;

-- Offers policies
CREATE POLICY "Clients can manage their own offers" ON offers
  FOR ALL USING (client_id = auth.uid());

CREATE POLICY "Recruiters can view offers for their submissions" ON offers
  FOR SELECT USING (recruiter_id = auth.uid());

CREATE POLICY "Admins can manage all offers" ON offers
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public can view offers by token" ON offers
  FOR SELECT USING (access_token IS NOT NULL);

-- Offer events policies
CREATE POLICY "Users can view offer events for their offers" ON offer_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM offers o 
      WHERE o.id = offer_events.offer_id 
      AND (o.client_id = auth.uid() OR o.recruiter_id = auth.uid())
    )
  );

CREATE POLICY "System can insert offer events" ON offer_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can manage all offer events" ON offer_events
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Communication log policies
CREATE POLICY "Recruiters can view communication for their candidates" ON communication_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM candidates c 
      WHERE c.id = communication_log.candidate_id 
      AND c.recruiter_id = auth.uid()
    )
  );

CREATE POLICY "System can insert communication log" ON communication_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can manage all communication logs" ON communication_log
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Message templates policies
CREATE POLICY "Authenticated users can view active templates" ON message_templates
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage all templates" ON message_templates
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Candidate conflicts policies
CREATE POLICY "Recruiters can view conflicts for their candidates" ON candidate_conflicts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM candidates c 
      WHERE c.id = candidate_conflicts.candidate_id 
      AND c.recruiter_id = auth.uid()
    )
  );

CREATE POLICY "System can manage conflicts" ON candidate_conflicts
  FOR ALL USING (true);

CREATE POLICY "Admins can manage all conflicts" ON candidate_conflicts
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Rejection templates policies
CREATE POLICY "Authenticated users can view active rejection templates" ON rejection_templates
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage rejection templates" ON rejection_templates
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Rejections policies
CREATE POLICY "Clients can create rejections for their job submissions" ON rejections
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM submissions s
      JOIN jobs j ON j.id = s.job_id
      WHERE s.id = rejections.submission_id
      AND j.client_id = auth.uid()
    )
  );

CREATE POLICY "Users can view rejections for their submissions" ON rejections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM submissions s
      JOIN jobs j ON j.id = s.job_id
      WHERE s.id = rejections.submission_id
      AND (j.client_id = auth.uid() OR s.recruiter_id = auth.uid())
    )
  );

CREATE POLICY "Admins can manage all rejections" ON rejections
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- REALTIME
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE offers;
ALTER PUBLICATION supabase_realtime ADD TABLE offer_events;

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_offers_submission_id ON offers(submission_id);
CREATE INDEX IF NOT EXISTS idx_offers_client_id ON offers(client_id);
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);
CREATE INDEX IF NOT EXISTS idx_offers_access_token ON offers(access_token);
CREATE INDEX IF NOT EXISTS idx_offer_events_offer_id ON offer_events(offer_id);
CREATE INDEX IF NOT EXISTS idx_communication_log_candidate_id ON communication_log(candidate_id);
CREATE INDEX IF NOT EXISTS idx_communication_log_submission_id ON communication_log(submission_id);
CREATE INDEX IF NOT EXISTS idx_candidate_conflicts_candidate_id ON candidate_conflicts(candidate_id);
CREATE INDEX IF NOT EXISTS idx_rejections_submission_id ON rejections(submission_id);

-- =====================================================
-- SEED DATA: Message Templates
-- =====================================================

INSERT INTO message_templates (name, channel, message_type, subject, body, variables) VALUES
('Opt-In Request Email', 'email', 'opt_in_request', 
 'Spannende Karrierechance: {job_title}',
 'Sehr geehrte(r) {candidate_name},\n\nein Unternehmen sucht einen {job_title} und Ihr Profil passt hervorragend.\n\nGehalt: {salary_range}\nStandort: {location}\n\nMöchten Sie mehr erfahren?\n\n{opt_in_link}',
 '["candidate_name", "job_title", "salary_range", "location", "opt_in_link"]'),

('Opt-In Request SMS', 'sms', 'opt_in_request',
 NULL,
 'Hallo {candidate_name}, spannende Stelle als {job_title}! Interesse? {opt_in_link}',
 '["candidate_name", "job_title", "opt_in_link"]'),

('Interview Invite Email', 'email', 'interview_invite',
 'Einladung zum Interview: {job_title}',
 'Sehr geehrte(r) {candidate_name},\n\nwir freuen uns, Sie zu einem Interview einzuladen.\n\nPosition: {job_title}\nTermin: {interview_date}\nLink: {interview_link}\n\nMit freundlichen Grüßen',
 '["candidate_name", "job_title", "interview_date", "interview_link"]'),

('Interview Reminder Email', 'email', 'interview_reminder',
 'Erinnerung: Ihr Interview morgen',
 'Sehr geehrte(r) {candidate_name},\n\ndies ist eine freundliche Erinnerung an Ihr Interview morgen um {interview_time}.\n\nLink: {interview_link}\n\nViel Erfolg!',
 '["candidate_name", "interview_time", "interview_link"]'),

('Offer Notification Email', 'email', 'offer',
 'Jobangebot: {job_title}',
 'Sehr geehrte(r) {candidate_name},\n\nwir freuen uns, Ihnen ein Angebot unterbreiten zu können!\n\nPosition: {job_title}\nGehalt: {salary}\n\nBitte prüfen Sie das Angebot: {offer_link}\n\nDas Angebot ist gültig bis {expires_at}.',
 '["candidate_name", "job_title", "salary", "offer_link", "expires_at"]');

-- Seed rejection templates
INSERT INTO rejection_templates (name, stage, reason_category, subject, body, include_feedback) VALUES
('Standard Screening Absage', 'screening', 'skills_mismatch',
 'Rückmeldung zu Ihrer Bewerbung',
 'Sehr geehrte(r) {candidate_name},\n\nvielen Dank für Ihr Interesse an der Position {job_title}.\n\nNach sorgfältiger Prüfung Ihrer Unterlagen müssen wir Ihnen leider mitteilen, dass wir uns für andere Kandidaten entschieden haben.\n\nWir wünschen Ihnen viel Erfolg bei Ihrer weiteren Jobsuche.\n\nMit freundlichen Grüßen',
 false),

('Interview Absage - Skills', 'interview', 'skills_mismatch',
 'Rückmeldung nach Ihrem Interview',
 'Sehr geehrte(r) {candidate_name},\n\nvielen Dank für das angenehme Gespräch zu der Position {job_title}.\n\nNach interner Beratung haben wir uns entschieden, mit Kandidaten fortzufahren, deren technisches Profil noch besser zu unseren aktuellen Anforderungen passt.\n\nWir wünschen Ihnen alles Gute für Ihre weitere Karriere.',
 true),

('Interview Absage - Culture Fit', 'interview', 'culture_fit',
 'Rückmeldung nach Ihrem Interview',
 'Sehr geehrte(r) {candidate_name},\n\nvielen Dank für das Gespräch zu der Position {job_title}.\n\nObwohl uns Ihre fachlichen Qualifikationen überzeugt haben, haben wir uns für Kandidaten entschieden, bei denen wir eine noch bessere Passung mit unserer Unternehmenskultur sehen.\n\nFür Ihre weitere Jobsuche wünschen wir Ihnen viel Erfolg.',
 true),

('Offer Absage', 'offer', 'other',
 'Rückmeldung zu unserem Angebot',
 'Sehr geehrte(r) {candidate_name},\n\nwir haben zur Kenntnis genommen, dass Sie unser Angebot für die Position {job_title} abgelehnt haben.\n\nWir bedauern Ihre Entscheidung, respektieren sie jedoch. Sollten sich Ihre Pläne ändern, freuen wir uns, von Ihnen zu hören.\n\nAlles Gute für Ihre Zukunft.',
 false);

-- =====================================================
-- VIEW: Candidate Job Overview (for Multi-Job Tracking)
-- =====================================================

CREATE OR REPLACE VIEW candidate_job_overview AS
SELECT 
  c.id AS candidate_id,
  c.full_name,
  c.email,
  c.recruiter_id,
  c.preferred_channel,
  COUNT(s.id) AS total_submissions,
  COUNT(CASE WHEN s.status NOT IN ('rejected', 'withdrawn') THEN 1 END) AS active_submissions,
  json_agg(
    json_build_object(
      'submission_id', s.id,
      'job_id', j.id,
      'job_title', j.title,
      'company_name', j.company_name,
      'status', s.status,
      'stage', s.stage,
      'submitted_at', s.submitted_at,
      'last_activity', s.updated_at
    ) ORDER BY s.submitted_at DESC
  ) FILTER (WHERE s.id IS NOT NULL) AS jobs
FROM candidates c
LEFT JOIN submissions s ON s.candidate_id = c.id
LEFT JOIN jobs j ON j.id = s.job_id
GROUP BY c.id;
