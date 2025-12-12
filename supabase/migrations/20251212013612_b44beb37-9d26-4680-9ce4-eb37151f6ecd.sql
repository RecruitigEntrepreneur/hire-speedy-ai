-- Create candidate_client_summary table for storing AI-generated client summaries
CREATE TABLE public.candidate_client_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES public.submissions(id) ON DELETE SET NULL,
  executive_summary TEXT,
  risk_factors JSONB DEFAULT '[]'::jsonb,
  positive_factors JSONB DEFAULT '[]'::jsonb,
  change_motivation_summary TEXT,
  job_hopper_analysis JSONB DEFAULT '{}'::jsonb,
  recommendation_score INTEGER,
  recommendation TEXT,
  key_selling_points JSONB DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ DEFAULT now(),
  model_version TEXT DEFAULT 'v1',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_candidate_client_summary_candidate_id ON public.candidate_client_summary(candidate_id);
CREATE INDEX idx_candidate_client_summary_submission_id ON public.candidate_client_summary(submission_id);

-- Enable RLS
ALTER TABLE public.candidate_client_summary ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage all client summaries"
ON public.candidate_client_summary FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Recruiters can manage summaries for their candidates"
ON public.candidate_client_summary FOR ALL
USING (EXISTS (
  SELECT 1 FROM candidates c
  WHERE c.id = candidate_client_summary.candidate_id
  AND c.recruiter_id = auth.uid()
));

CREATE POLICY "Clients can view summaries for their job submissions"
ON public.candidate_client_summary FOR SELECT
USING (EXISTS (
  SELECT 1 FROM submissions s
  JOIN jobs j ON j.id = s.job_id
  WHERE s.id = candidate_client_summary.submission_id
  AND j.client_id = auth.uid()
));

-- Trigger for updated_at
CREATE TRIGGER update_candidate_client_summary_updated_at
BEFORE UPDATE ON public.candidate_client_summary
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();