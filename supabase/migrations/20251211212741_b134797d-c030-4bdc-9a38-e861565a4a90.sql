-- Create candidate_activity_log table for tracking all recruiter actions
CREATE TABLE public.candidate_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  recruiter_id UUID NOT NULL,
  activity_type TEXT NOT NULL, -- 'call', 'email', 'note', 'status_change', 'playbook_used', 'alert_actioned', 'hubspot_import'
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  related_submission_id UUID REFERENCES public.submissions(id) ON DELETE SET NULL,
  related_alert_id UUID REFERENCES public.influence_alerts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.candidate_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Recruiters can view their own activity logs"
ON public.candidate_activity_log
FOR SELECT
USING (auth.uid() = recruiter_id);

CREATE POLICY "Recruiters can insert their own activity logs"
ON public.candidate_activity_log
FOR INSERT
WITH CHECK (auth.uid() = recruiter_id);

CREATE POLICY "Recruiters can update their own activity logs"
ON public.candidate_activity_log
FOR UPDATE
USING (auth.uid() = recruiter_id);

CREATE POLICY "Recruiters can delete their own activity logs"
ON public.candidate_activity_log
FOR DELETE
USING (auth.uid() = recruiter_id);

CREATE POLICY "Admins can manage all activity logs"
ON public.candidate_activity_log
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_candidate_activity_log_candidate_id ON public.candidate_activity_log(candidate_id);
CREATE INDEX idx_candidate_activity_log_recruiter_id ON public.candidate_activity_log(recruiter_id);
CREATE INDEX idx_candidate_activity_log_created_at ON public.candidate_activity_log(created_at DESC);