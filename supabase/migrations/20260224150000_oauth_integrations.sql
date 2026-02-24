-- ============================================================================
-- Universal OAuth 2.0 for CRM Integrations
-- Tables: oauth_states (ephemeral CSRF/PKCE), recruiter_integrations (per-recruiter)
-- ============================================================================

-- 1. OAuth States (ephemeral, for CSRF/PKCE protection)
-- Rows are created when a recruiter initiates OAuth, deleted after callback
CREATE TABLE IF NOT EXISTS public.oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  redirect_uri TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_oauth_states_state ON public.oauth_states(state);
CREATE INDEX idx_oauth_states_expires ON public.oauth_states(expires_at);

ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- Service role only - no user can directly access this table
CREATE POLICY "Service role manages oauth states"
  ON public.oauth_states FOR ALL
  USING (false)
  WITH CHECK (false);

-- 2. Recruiter Integrations (per-recruiter CRM connections)
CREATE TABLE IF NOT EXISTS public.recruiter_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN (
    'hubspot', 'salesforce', 'greenhouse', 'lever',
    'bullhorn', 'personio', 'workday', 'jobvite', 'icims'
  )),
  auth_type TEXT NOT NULL CHECK (auth_type IN ('oauth', 'api_key', 'client_credentials')),

  -- OAuth tokens (encrypted at application level via AES-256-GCM)
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,

  -- API key (encrypted at application level)
  api_key_encrypted TEXT,

  -- Client credentials for Personio-style auth
  client_id_encrypted TEXT,
  client_secret_encrypted TEXT,

  -- Provider-specific metadata (e.g. Salesforce instance URL)
  provider_metadata JSONB DEFAULT '{}',

  -- Sync configuration
  sync_candidates BOOLEAN DEFAULT true,
  sync_jobs BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,

  -- Status
  status TEXT DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error', 'expired')),
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id, provider)
);

CREATE INDEX idx_recruiter_integrations_user ON public.recruiter_integrations(user_id);
CREATE INDEX idx_recruiter_integrations_provider ON public.recruiter_integrations(provider);
CREATE INDEX idx_recruiter_integrations_status ON public.recruiter_integrations(status);
CREATE INDEX idx_recruiter_integrations_token_expiry ON public.recruiter_integrations(token_expires_at)
  WHERE auth_type = 'oauth';

ALTER TABLE public.recruiter_integrations ENABLE ROW LEVEL SECURITY;

-- Recruiters can view their own integrations
CREATE POLICY "Users can view own integrations"
  ON public.recruiter_integrations FOR SELECT
  USING (auth.uid() = user_id);

-- Recruiters can insert their own integrations
CREATE POLICY "Users can insert own integrations"
  ON public.recruiter_integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Recruiters can update their own integrations
CREATE POLICY "Users can update own integrations"
  ON public.recruiter_integrations FOR UPDATE
  USING (auth.uid() = user_id);

-- Recruiters can delete their own integrations
CREATE POLICY "Users can delete own integrations"
  ON public.recruiter_integrations FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can view all integrations
CREATE POLICY "Admins can view all integrations"
  ON public.recruiter_integrations FOR SELECT
  USING (public.has_role('admin', auth.uid()));

-- Service role can manage all (used by edge functions)
CREATE POLICY "Service role manages integrations"
  ON public.recruiter_integrations FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. Cleanup function for expired oauth states
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
  DELETE FROM public.oauth_states WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
