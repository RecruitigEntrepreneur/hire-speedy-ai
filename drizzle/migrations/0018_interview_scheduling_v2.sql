-- Interview-Terminierung v2 (02.10.2026): ein Fenster statt Assistent.
-- Neu: interviews-Spalten, interview_attendees, interview_invites,
-- client_interview_hours, calendar_connections, calendar_oauth_states,
-- calendar_it_requests. Keine bestehenden Daten werden veraendert.

-- 1) interviews -------------------------------------------------------------
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS round smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS allow_alternative boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS alternative_rules jsonb,
  ADD COLUMN IF NOT EXISTS response_token_hash text,
  ADD COLUMN IF NOT EXISTS response_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_token_hash text,
  ADD COLUMN IF NOT EXISTS client_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS organizer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS meeting_provider text,
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES public.interviews(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS consent_given_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.interviews ADD CONSTRAINT interviews_meeting_provider_check
    CHECK (meeting_provider IS NULL OR meeting_provider IN ('client_calendar', 'matchunt_teams', 'none'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS interviews_response_token_hash_key
  ON public.interviews (response_token_hash) WHERE response_token_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS interviews_client_token_hash_key
  ON public.interviews (client_token_hash) WHERE client_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interviews_requested_by_status
  ON public.interviews (requested_by, status);

COMMENT ON COLUMN public.interviews.round IS 'Interview-Runde (1 = erstes Gespraech).';
COMMENT ON COLUMN public.interviews.allow_alternative IS 'Kandidat darf eine andere Zeit innerhalb alternative_rules waehlen.';
COMMENT ON COLUMN public.interviews.alternative_rules IS 'Schnappschuss der Interview-Zeiten (InterviewHoursRules) fuer die andere Zeit.';
COMMENT ON COLUMN public.interviews.response_token_hash IS 'Hash des Kandidaten-Links (Klartext nur in der Mail).';
COMMENT ON COLUMN public.interviews.client_token_hash IS 'Hash des Kunden-Links "andere Zeit bestaetigen" aus der Mail.';
COMMENT ON COLUMN public.interviews.meeting_provider IS 'client_calendar = Termin im Outlook des Kunden, matchunt_teams = Matchunt-Konto, none = noch kein Link.';

-- 2) interview_attendees ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.interview_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  name text NOT NULL,
  title text,
  required boolean NOT NULL DEFAULT true,
  kind text NOT NULL CHECK (kind IN ('client_user', 'external')),
  is_organizer boolean NOT NULL DEFAULT false,
  response_status text NOT NULL DEFAULT 'needs_action'
    CHECK (response_status IN ('needs_action', 'accepted', 'declined', 'tentative')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (interview_id, email)
);
CREATE INDEX IF NOT EXISTS idx_interview_attendees_interview ON public.interview_attendees (interview_id);
CREATE INDEX IF NOT EXISTS idx_interview_attendees_user ON public.interview_attendees (user_id) WHERE user_id IS NOT NULL;

GRANT SELECT ON public.interview_attendees TO authenticated;
GRANT ALL ON public.interview_attendees TO service_role;
ALTER TABLE public.interview_attendees ENABLE ROW LEVEL SECURITY;

-- Lesen: Kundenteam mit Zugriff auf die Stelle und Admins. Der Headhunter
-- bekommt die Mailadressen der Kundenseite bewusst nicht (Umgehungsschutz).
DROP POLICY IF EXISTS "Client team can view interview attendees" ON public.interview_attendees;
CREATE POLICY "Client team can view interview attendees"
  ON public.interview_attendees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.interviews i
      JOIN public.submissions s ON s.id = i.submission_id
      WHERE i.id = interview_attendees.interview_id
        AND public.can_access_job(s.job_id)
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- 3) interview_invites (Kalendereinladungen je Empfaenger) -------------------
CREATE TABLE IF NOT EXISTS public.interview_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  recipient_key text NOT NULL,
  email text NOT NULL,
  uid text NOT NULL,
  sequence integer NOT NULL DEFAULT 0,
  last_method text CHECK (last_method IS NULL OR last_method IN ('REQUEST', 'CANCEL')),
  last_sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (interview_id, recipient_key)
);
GRANT ALL ON public.interview_invites TO service_role;
ALTER TABLE public.interview_invites ENABLE ROW LEVEL SECURITY;
-- keine Policies: nur Service-Role

-- 4) client_interview_hours -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_interview_hours (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_interview_hours TO authenticated;
GRANT ALL ON public.client_interview_hours TO service_role;
ALTER TABLE public.client_interview_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own interview hours" ON public.client_interview_hours;
CREATE POLICY "Users manage own interview hours"
  ON public.client_interview_hours FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5) calendar_connections (nur Server) --------------------------------------
CREATE TABLE IF NOT EXISTS public.calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('microsoft', 'google')),
  account_email text,
  tenant_id text,
  refresh_token_encrypted text,
  access_token_encrypted text,
  token_expires_at timestamptz,
  scopes text,
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'expired', 'error', 'revoked')),
  error_message text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_tenant ON public.calendar_connections (tenant_id);
GRANT ALL ON public.calendar_connections TO service_role;
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.calendar_connections FROM anon, authenticated;
-- keine Policies: Tokens verlassen den Server nie

-- 6) calendar_oauth_states (nur Server) -------------------------------------
CREATE TABLE IF NOT EXISTS public.calendar_oauth_states (
  state text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'microsoft',
  purpose text NOT NULL CHECK (purpose IN ('connect', 'admin_consent')),
  code_verifier text,
  return_path text,
  it_request_id uuid,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.calendar_oauth_states TO service_role;
ALTER TABLE public.calendar_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.calendar_oauth_states FROM anon, authenticated;

-- 7) calendar_it_requests ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calendar_it_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'microsoft',
  it_email text NOT NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'approved', 'cancelled')),
  tenant_id text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  reminded_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_calendar_it_requests_requested_by ON public.calendar_it_requests (requested_by, status);
GRANT SELECT ON public.calendar_it_requests TO authenticated;
GRANT ALL ON public.calendar_it_requests TO service_role;
ALTER TABLE public.calendar_it_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own calendar it requests" ON public.calendar_it_requests;
CREATE POLICY "Users view own calendar it requests"
  ON public.calendar_it_requests FOR SELECT
  USING (auth.uid() = requested_by OR (organization_id IS NOT NULL AND public.is_org_member(organization_id)));

-- Aufraeumen abgelaufener OAuth-States
CREATE OR REPLACE FUNCTION public.purge_expired_calendar_oauth_states()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.calendar_oauth_states WHERE expires_at < now() - interval '1 day';
$$;
REVOKE ALL ON FUNCTION public.purge_expired_calendar_oauth_states() FROM PUBLIC, anon, authenticated;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('calendar-oauth-states-purge') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'calendar-oauth-states-purge');
    PERFORM cron.schedule('calendar-oauth-states-purge', '35 3 * * *', 'select public.purge_expired_calendar_oauth_states()');
  END IF;
END $$;

COMMENT ON TABLE public.interview_attendees IS 'Teilnehmer auf Kundenseite je Interview (Team oder extern per E-Mail), Pflicht/optional.';
COMMENT ON TABLE public.interview_invites IS 'Je Empfaenger UID/SEQUENCE der Matchunt-Kalendereinladung, damit Aenderungen/Absagen denselben Eintrag treffen.';
COMMENT ON TABLE public.client_interview_hours IS 'Interview-Zeiten je Nutzer: Rahmen, in dem Kandidaten eine andere Zeit waehlen duerfen.';
COMMENT ON TABLE public.calendar_connections IS 'Verbundene Kalender (Microsoft/Google). Tokens AES-GCM-verschluesselt, nur Service-Role.';
COMMENT ON TABLE public.calendar_it_requests IS 'Bitte an die IT des Kunden, die Kalender-App einmal fuer die Firma freizugeben.';