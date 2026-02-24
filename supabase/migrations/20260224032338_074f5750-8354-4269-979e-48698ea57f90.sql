
CREATE TABLE public.oauth_states (
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
CREATE POLICY "Block all client access to oauth states"
  ON public.oauth_states FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE public.recruiter_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL
    CHECK (provider IN ('hubspot','salesforce','greenhouse','lever',
                        'bullhorn','personio','workday','jobvite','icims')),
  auth_type TEXT NOT NULL
    CHECK (auth_type IN ('oauth','api_key','client_credentials')),
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  api_key_encrypted TEXT,
  client_id_encrypted TEXT,
  client_secret_encrypted TEXT,
  provider_metadata JSONB DEFAULT '{}',
  sync_candidates BOOLEAN DEFAULT true,
  sync_jobs BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  status TEXT DEFAULT 'connected'
    CHECK (status IN ('connected','disconnected','error','expired')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider)
);
CREATE INDEX idx_recruiter_integrations_user ON public.recruiter_integrations(user_id);
CREATE INDEX idx_recruiter_integrations_provider ON public.recruiter_integrations(provider);
CREATE INDEX idx_recruiter_integrations_status ON public.recruiter_integrations(status);
ALTER TABLE public.recruiter_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own integrations"
  ON public.recruiter_integrations FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own integrations"
  ON public.recruiter_integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own integrations"
  ON public.recruiter_integrations FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own integrations"
  ON public.recruiter_integrations FOR DELETE
  USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all integrations"
  ON public.recruiter_integrations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.recruiter_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
