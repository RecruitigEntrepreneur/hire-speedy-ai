-- Add hard_facts column to candidate_client_summary for structured presentation data
ALTER TABLE public.candidate_client_summary 
ADD COLUMN IF NOT EXISTS hard_facts JSONB DEFAULT '{}';

-- Add deal_probability column for deal closing likelihood
ALTER TABLE public.candidate_client_summary 
ADD COLUMN IF NOT EXISTS deal_probability INTEGER DEFAULT NULL;

-- Create table for commitment updates from recruiters
CREATE TABLE IF NOT EXISTS public.candidate_commitment_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES public.submissions(id) ON DELETE CASCADE,
  recruiter_id UUID NOT NULL,
  commitment_level TEXT NOT NULL CHECK (commitment_level IN ('high', 'medium', 'low')),
  reason TEXT,
  previous_level TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for risk reports from recruiters
CREATE TABLE IF NOT EXISTS public.candidate_risk_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES public.submissions(id) ON DELETE CASCADE,
  recruiter_id UUID NOT NULL,
  risk_type TEXT NOT NULL CHECK (risk_type IN ('counter_offer', 'competing_process', 'hesitation', 'personal_situation', 'other')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for client notifications
CREATE TABLE IF NOT EXISTS public.client_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  submission_id UUID REFERENCES public.submissions(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('new_candidate', 'decision_required', 'risk_detected', 'sla_warning', 'interview_result')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.candidate_commitment_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_risk_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for commitment updates
CREATE POLICY "Recruiters can view their own commitment updates" 
ON public.candidate_commitment_updates FOR SELECT 
USING (auth.uid() = recruiter_id);

CREATE POLICY "Recruiters can create commitment updates" 
ON public.candidate_commitment_updates FOR INSERT 
WITH CHECK (auth.uid() = recruiter_id);

-- RLS policies for risk reports
CREATE POLICY "Recruiters can view their own risk reports" 
ON public.candidate_risk_reports FOR SELECT 
USING (auth.uid() = recruiter_id);

CREATE POLICY "Recruiters can manage their own risk reports" 
ON public.candidate_risk_reports FOR ALL 
USING (auth.uid() = recruiter_id);

-- RLS policies for client notifications
CREATE POLICY "Clients can view their own notifications" 
ON public.client_notifications FOR SELECT 
USING (auth.uid() = client_id);

CREATE POLICY "Clients can update their own notifications" 
ON public.client_notifications FOR UPDATE 
USING (auth.uid() = client_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_commitment_updates_candidate ON public.candidate_commitment_updates(candidate_id);
CREATE INDEX IF NOT EXISTS idx_risk_reports_candidate ON public.candidate_risk_reports(candidate_id);
CREATE INDEX IF NOT EXISTS idx_client_notifications_client ON public.client_notifications(client_id, is_read);