-- Phase 1-3: Interview Management System

-- 1. User Integrations für OAuth Tokens (Microsoft Teams, Google Calendar)
CREATE TABLE IF NOT EXISTS public.user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('microsoft', 'google')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  email TEXT,
  metadata JSONB DEFAULT '{}',
  connected_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- RLS für user_integrations
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own integrations"
  ON public.user_integrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own integrations"
  ON public.user_integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integrations"
  ON public.user_integrations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own integrations"
  ON public.user_integrations FOR DELETE
  USING (auth.uid() = user_id);

-- 2. Interview Types Tabelle
CREATE TABLE IF NOT EXISTS public.interview_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  default_duration INTEGER DEFAULT 60,
  agenda_template TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS für interview_types
ALTER TABLE public.interview_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view system interview types"
  ON public.interview_types FOR SELECT
  USING (is_system = true OR organization_id IN (
    SELECT id FROM public.organizations WHERE id = organization_id
  ));

CREATE POLICY "Org members can manage custom types"
  ON public.interview_types FOR ALL
  USING (is_system = false);

-- Default Interview Types einfügen
INSERT INTO public.interview_types (name, description, default_duration, agenda_template, is_system) VALUES
('Kennenlernen', 'Erstes kurzes Gespräch zum gegenseitigen Kennenlernen', 30, 
 E'1. Vorstellung (5 Min)\n2. Motivation des Kandidaten (10 Min)\n3. Erwartungen klären (10 Min)\n4. Nächste Schritte (5 Min)', true),
('Fachinterview', 'Technisches Interview mit Fachfragen und Projektbeispielen', 60,
 E'1. Technische Erfahrung (15 Min)\n2. Projektbeispiele besprechen (20 Min)\n3. Fallstudie/Code-Review (15 Min)\n4. Fragen des Kandidaten (10 Min)', true),
('Case Study', 'Fallstudie mit Bearbeitung und Präsentation', 90,
 E'1. Aufgabenstellung erläutern (10 Min)\n2. Bearbeitungszeit (40 Min)\n3. Präsentation (20 Min)\n4. Diskussion und Fragen (20 Min)', true),
('Culture Fit', 'Team-Interview zur Unternehmenskultur und Zusammenarbeit', 45,
 E'1. Team-Vorstellung (10 Min)\n2. Arbeitsweise und Prozesse (15 Min)\n3. Werte und Kultur (10 Min)\n4. Offene Fragen (10 Min)', true),
('Abschlussgespräch', 'Finales Gespräch und Angebotsverhandlung', 30,
 E'1. Zusammenfassung bisheriger Gespräche (5 Min)\n2. Offene Punkte klären (10 Min)\n3. Gehaltsvorstellung besprechen (10 Min)\n4. Nächste Schritte und Timeline (5 Min)', true)
ON CONFLICT DO NOTHING;

-- 3. Interview Participants für Multi-Interviewer
CREATE TABLE IF NOT EXISTS public.interview_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'panel' CHECK (role IN ('lead', 'panel', 'observer')),
  confirmed BOOLEAN DEFAULT false,
  confirmed_at TIMESTAMPTZ,
  feedback_submitted BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(interview_id, user_id)
);

-- RLS für interview_participants
ALTER TABLE public.interview_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their interviews"
  ON public.interview_participants FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view interview participants"
  ON public.interview_participants FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can add participants"
  ON public.interview_participants FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Participants can update their own record"
  ON public.interview_participants FOR UPDATE
  USING (auth.uid() = user_id);

-- 4. Interviews Tabelle erweitern
ALTER TABLE public.interviews 
  ADD COLUMN IF NOT EXISTS google_meet_link TEXT,
  ADD COLUMN IF NOT EXISTS google_event_id TEXT,
  ADD COLUMN IF NOT EXISTS teams_meeting_id TEXT,
  ADD COLUMN IF NOT EXISTS teams_join_url TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS rescheduled_from UUID REFERENCES public.interviews(id),
  ADD COLUMN IF NOT EXISTS interview_type_id UUID REFERENCES public.interview_types(id),
  ADD COLUMN IF NOT EXISTS reminder_24h_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_1h_sent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS no_show_reported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS no_show_by TEXT CHECK (no_show_by IN ('candidate', 'client', 'technical'));

-- Index für Performance
CREATE INDEX IF NOT EXISTS idx_interview_participants_interview ON public.interview_participants(interview_id);
CREATE INDEX IF NOT EXISTS idx_interview_participants_user ON public.interview_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_user ON public.user_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_interviews_type ON public.interviews(interview_type_id);
CREATE INDEX IF NOT EXISTS idx_interviews_cancelled ON public.interviews(cancelled_at) WHERE cancelled_at IS NOT NULL;

-- Trigger für updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_integrations_updated_at ON public.user_integrations;
CREATE TRIGGER update_user_integrations_updated_at
  BEFORE UPDATE ON public.user_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_interview_types_updated_at ON public.interview_types;
CREATE TRIGGER update_interview_types_updated_at
  BEFORE UPDATE ON public.interview_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();