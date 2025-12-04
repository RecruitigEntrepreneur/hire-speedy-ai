-- =====================================================
-- PHASE 4: ENTERPRISE - Database Migration
-- =====================================================

-- Feature 2: Team Accounts
-- =====================================================

-- Organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('client', 'agency')),
  owner_id UUID NOT NULL,
  settings JSONB DEFAULT '{}',
  logo_url TEXT,
  billing_email TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Organization members table
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'hiring_manager', 'viewer', 'finance')),
  permissions JSONB DEFAULT '[]',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  invited_by UUID,
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Organization invites table
CREATE TABLE public.organization_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'hiring_manager', 'viewer', 'finance')),
  permissions JSONB DEFAULT '[]',
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  invited_by UUID NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Permission definitions table
CREATE TABLE public.permission_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('jobs', 'candidates', 'offers', 'billing', 'team'))
);

-- Insert default permissions
INSERT INTO public.permission_definitions (id, name, description, category) VALUES
  ('view_jobs', 'Jobs anzeigen', 'Kann alle Jobs der Organisation sehen', 'jobs'),
  ('manage_jobs', 'Jobs verwalten', 'Kann Jobs erstellen, bearbeiten, pausieren', 'jobs'),
  ('view_candidates', 'Kandidaten anzeigen', 'Kann eingereichte Kandidaten sehen', 'candidates'),
  ('review_candidates', 'Kandidaten bewerten', 'Kann Kandidaten bewerten und Feedback geben', 'candidates'),
  ('schedule_interviews', 'Interviews planen', 'Kann Interviews terminieren', 'candidates'),
  ('create_offers', 'Angebote erstellen', 'Kann Jobangebote an Kandidaten senden', 'offers'),
  ('approve_offers', 'Angebote genehmigen', 'Kann Angebote final genehmigen', 'offers'),
  ('view_billing', 'Billing anzeigen', 'Kann Rechnungen und Zahlungen sehen', 'billing'),
  ('manage_billing', 'Billing verwalten', 'Kann Zahlungsmethoden verwalten', 'billing'),
  ('manage_team', 'Team verwalten', 'Kann Teammitglieder einladen und verwalten', 'team');

-- Add organization_id to jobs table
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Feature 9: ATS Integrations
-- =====================================================

-- Integrations table
CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('personio', 'greenhouse', 'workday', 'lever', 'bamboohr')),
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  api_key_encrypted TEXT,
  config JSONB DEFAULT '{}',
  sync_jobs BOOLEAN DEFAULT true,
  sync_candidates BOOLEAN DEFAULT true,
  sync_status BOOLEAN DEFAULT true,
  sync_interval_minutes INTEGER DEFAULT 60,
  last_synced_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'error', 'expired')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Integration mappings table
CREATE TABLE public.integration_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('job', 'candidate', 'submission')),
  internal_id UUID NOT NULL,
  external_id TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict', 'error')),
  UNIQUE(integration_id, entity_type, internal_id),
  UNIQUE(integration_id, entity_type, external_id)
);

-- Integration sync log table
CREATE TABLE public.integration_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'manual')),
  direction TEXT NOT NULL CHECK (direction IN ('import', 'export', 'bidirectional')),
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]',
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed'))
);

-- Feature 18: Talent Pool Engine
-- =====================================================

-- Talent pool table
CREATE TABLE public.talent_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  recruiter_id UUID NOT NULL,
  pool_type TEXT DEFAULT 'general' CHECK (pool_type IN ('general', 'silver_medalist', 'future_fit', 'passive')),
  skills_snapshot JSONB,
  experience_years INTEGER,
  preferred_roles TEXT[],
  preferred_locations TEXT[],
  salary_expectation_min INTEGER,
  salary_expectation_max INTEGER,
  availability TEXT CHECK (availability IN ('immediate', '2_weeks', '1_month', '3_months', 'passive')),
  last_contacted_at TIMESTAMPTZ,
  contact_frequency TEXT DEFAULT 'quarterly' CHECK (contact_frequency IN ('monthly', 'quarterly', 'yearly')),
  next_contact_at TIMESTAMPTZ,
  source_submission_id UUID,
  added_reason TEXT,
  is_active BOOLEAN DEFAULT true,
  opted_out_at TIMESTAMPTZ,
  notes TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(candidate_id, recruiter_id)
);

-- Talent alerts table
CREATE TABLE public.talent_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_pool_id UUID NOT NULL REFERENCES public.talent_pool(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  match_score INTEGER,
  match_reasons JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'submitted', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Feature 19: Automated Reference Checks
-- =====================================================

-- Reference requests table
CREATE TABLE public.reference_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  reference_name TEXT NOT NULL,
  reference_email TEXT NOT NULL,
  reference_phone TEXT,
  reference_company TEXT,
  reference_position TEXT,
  relationship TEXT CHECK (relationship IN ('manager', 'colleague', 'report', 'client')),
  access_token TEXT UNIQUE NOT NULL,
  requested_by UUID NOT NULL,
  requested_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'declined', 'expired')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Reference responses table
CREATE TABLE public.reference_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.reference_requests(id) ON DELETE CASCADE,
  overall_performance INTEGER CHECK (overall_performance BETWEEN 1 AND 5),
  technical_skills INTEGER CHECK (technical_skills BETWEEN 1 AND 5),
  communication INTEGER CHECK (communication BETWEEN 1 AND 5),
  teamwork INTEGER CHECK (teamwork BETWEEN 1 AND 5),
  reliability INTEGER CHECK (reliability BETWEEN 1 AND 5),
  leadership INTEGER CHECK (leadership BETWEEN 1 AND 5),
  strengths TEXT[],
  areas_for_improvement TEXT[],
  notable_achievements TEXT,
  working_style TEXT,
  would_rehire BOOLEAN,
  recommendation_level TEXT CHECK (recommendation_level IN ('strong_yes', 'yes', 'neutral', 'no', 'strong_no')),
  additional_comments TEXT,
  ai_summary TEXT,
  ai_risk_flags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- Enable RLS on all new tables
-- =====================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_responses ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS Policies
-- =====================================================

-- Organizations policies
CREATE POLICY "Users can view their own organizations" ON public.organizations
  FOR SELECT USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organizations.id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  );

CREATE POLICY "Owners can manage their organizations" ON public.organizations
  FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "Admins can view all organizations" ON public.organizations
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Organization members policies
CREATE POLICY "Members can view org members" ON public.organization_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  );

CREATE POLICY "Org admins can manage members" ON public.organization_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
      AND om.status = 'active'
    )
  );

CREATE POLICY "System admins can manage all members" ON public.organization_members
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Organization invites policies
CREATE POLICY "Org admins can manage invites" ON public.organization_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_invites.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
      AND om.status = 'active'
    )
  );

CREATE POLICY "Anyone can view invite by token" ON public.organization_invites
  FOR SELECT USING (true);

CREATE POLICY "System admins can manage all invites" ON public.organization_invites
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Permission definitions policies (read-only for all authenticated)
CREATE POLICY "Authenticated users can view permissions" ON public.permission_definitions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Integrations policies
CREATE POLICY "Org admins can manage integrations" ON public.integrations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = integrations.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
      AND om.status = 'active'
    )
  );

CREATE POLICY "Org members can view integrations" ON public.integrations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = integrations.organization_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  );

CREATE POLICY "System admins can manage all integrations" ON public.integrations
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Integration mappings policies
CREATE POLICY "Org members can view mappings" ON public.integration_mappings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.integrations i
      JOIN public.organization_members om ON om.organization_id = i.organization_id
      WHERE i.id = integration_mappings.integration_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  );

CREATE POLICY "System can manage mappings" ON public.integration_mappings
  FOR ALL USING (true);

-- Integration sync log policies
CREATE POLICY "Org members can view sync logs" ON public.integration_sync_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.integrations i
      JOIN public.organization_members om ON om.organization_id = i.organization_id
      WHERE i.id = integration_sync_log.integration_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
    )
  );

CREATE POLICY "System can manage sync logs" ON public.integration_sync_log
  FOR ALL USING (true);

-- Talent pool policies
CREATE POLICY "Recruiters can manage their talent pool" ON public.talent_pool
  FOR ALL USING (recruiter_id = auth.uid());

CREATE POLICY "System admins can view all talent pools" ON public.talent_pool
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Talent alerts policies
CREATE POLICY "Recruiters can manage their alerts" ON public.talent_alerts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.talent_pool tp
      WHERE tp.id = talent_alerts.talent_pool_id
      AND tp.recruiter_id = auth.uid()
    )
  );

CREATE POLICY "System can insert alerts" ON public.talent_alerts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System admins can view all alerts" ON public.talent_alerts
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Reference requests policies
CREATE POLICY "Recruiters can manage their reference requests" ON public.reference_requests
  FOR ALL USING (requested_by = auth.uid());

CREATE POLICY "Anyone can view request by token" ON public.reference_requests
  FOR SELECT USING (true);

CREATE POLICY "System admins can manage all reference requests" ON public.reference_requests
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Reference responses policies
CREATE POLICY "Anyone can insert reference response" ON public.reference_responses
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Requesters can view responses" ON public.reference_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.reference_requests rr
      WHERE rr.id = reference_responses.request_id
      AND rr.requested_by = auth.uid()
    )
  );

CREATE POLICY "System admins can view all responses" ON public.reference_responses
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- Update triggers for updated_at
-- =====================================================

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_talent_pool_updated_at
  BEFORE UPDATE ON public.talent_pool
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =====================================================
-- Create indexes for performance
-- =====================================================

CREATE INDEX idx_organization_members_org_id ON public.organization_members(organization_id);
CREATE INDEX idx_organization_members_user_id ON public.organization_members(user_id);
CREATE INDEX idx_organization_invites_org_id ON public.organization_invites(organization_id);
CREATE INDEX idx_organization_invites_token ON public.organization_invites(token);
CREATE INDEX idx_integrations_org_id ON public.integrations(organization_id);
CREATE INDEX idx_integration_mappings_integration_id ON public.integration_mappings(integration_id);
CREATE INDEX idx_talent_pool_recruiter_id ON public.talent_pool(recruiter_id);
CREATE INDEX idx_talent_pool_candidate_id ON public.talent_pool(candidate_id);
CREATE INDEX idx_talent_alerts_pool_id ON public.talent_alerts(talent_pool_id);
CREATE INDEX idx_reference_requests_candidate_id ON public.reference_requests(candidate_id);
CREATE INDEX idx_reference_requests_token ON public.reference_requests(access_token);