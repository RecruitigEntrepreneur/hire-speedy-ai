-- Phase 4: Interview Feedback System
CREATE TABLE public.interview_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES public.interviews(id) ON DELETE CASCADE NOT NULL,
  evaluator_id UUID NOT NULL,
  technical_skills INTEGER CHECK (technical_skills BETWEEN 1 AND 5),
  communication INTEGER CHECK (communication BETWEEN 1 AND 5),
  culture_fit INTEGER CHECK (culture_fit BETWEEN 1 AND 5),
  motivation INTEGER CHECK (motivation BETWEEN 1 AND 5),
  problem_solving INTEGER CHECK (problem_solving BETWEEN 1 AND 5),
  overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
  pros TEXT[] DEFAULT '{}',
  cons TEXT[] DEFAULT '{}',
  recommendation TEXT CHECK (recommendation IN ('hire', 'next_round', 'reject', 'undecided')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(interview_id, evaluator_id)
);

-- Phase 5: Job Scorecards
CREATE TABLE public.job_scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  criteria JSONB DEFAULT '[]',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.scorecard_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES public.interviews(id) ON DELETE CASCADE NOT NULL,
  scorecard_id UUID REFERENCES public.job_scorecards(id) ON DELETE CASCADE NOT NULL,
  evaluator_id UUID NOT NULL,
  scores JSONB DEFAULT '{}',
  total_score DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(interview_id, scorecard_id, evaluator_id)
);

-- Enable RLS
ALTER TABLE public.interview_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_scorecards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scorecard_evaluations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for interview_feedback (via submissions)
CREATE POLICY "Users can view feedback for interviews they're involved in"
ON public.interview_feedback FOR SELECT
USING (
  evaluator_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.interviews i
    JOIN public.submissions s ON s.id = i.submission_id
    WHERE i.id = interview_feedback.interview_id
    AND s.recruiter_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.interviews i
    JOIN public.submissions s ON s.id = i.submission_id
    JOIN public.jobs j ON j.id = s.job_id
    WHERE i.id = interview_feedback.interview_id
    AND j.client_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own feedback"
ON public.interview_feedback FOR INSERT
WITH CHECK (evaluator_id = auth.uid());

CREATE POLICY "Users can update their own feedback"
ON public.interview_feedback FOR UPDATE
USING (evaluator_id = auth.uid());

-- RLS Policies for job_scorecards (via jobs.client_id or submissions.recruiter_id)
CREATE POLICY "Users can view scorecards for their jobs"
ON public.job_scorecards FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_scorecards.job_id
    AND j.client_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.submissions s ON s.job_id = j.id
    WHERE j.id = job_scorecards.job_id
    AND s.recruiter_id = auth.uid()
  )
);

CREATE POLICY "Clients can manage scorecards for their jobs"
ON public.job_scorecards FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_scorecards.job_id
    AND j.client_id = auth.uid()
  )
);

-- RLS Policies for scorecard_evaluations
CREATE POLICY "Users can view evaluations they created or are involved in"
ON public.scorecard_evaluations FOR SELECT
USING (
  evaluator_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.interviews i
    JOIN public.submissions s ON s.id = i.submission_id
    WHERE i.id = scorecard_evaluations.interview_id
    AND s.recruiter_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.interviews i
    JOIN public.submissions s ON s.id = i.submission_id
    JOIN public.jobs j ON j.id = s.job_id
    WHERE i.id = scorecard_evaluations.interview_id
    AND j.client_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own evaluations"
ON public.scorecard_evaluations FOR INSERT
WITH CHECK (evaluator_id = auth.uid());

CREATE POLICY "Users can update their own evaluations"
ON public.scorecard_evaluations FOR UPDATE
USING (evaluator_id = auth.uid());

-- Triggers for updated_at
CREATE TRIGGER update_interview_feedback_updated_at
BEFORE UPDATE ON public.interview_feedback
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_job_scorecards_updated_at
BEFORE UPDATE ON public.job_scorecards
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();