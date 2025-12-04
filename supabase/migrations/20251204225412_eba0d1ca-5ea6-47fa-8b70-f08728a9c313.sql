-- Interview Intelligence Tabelle
CREATE TABLE public.interview_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  
  -- Pre-Interview (für Kandidat)
  candidate_prep JSONB DEFAULT '{}',
  company_insights JSONB DEFAULT '{}',
  
  -- Pre-Interview (für Client)
  interviewer_guide JSONB DEFAULT '{}',
  candidate_summary TEXT,
  
  -- Post-Interview
  interview_feedback JSONB DEFAULT '{}',
  ai_assessment JSONB DEFAULT '{}',
  risk_assessment JSONB DEFAULT '{}',
  hiring_recommendation TEXT CHECK (hiring_recommendation IN ('strong_yes', 'yes', 'maybe', 'no', 'strong_no')),
  recommendation_reasoning TEXT,
  
  -- Coaching für Recruiter
  recruiter_next_steps JSONB DEFAULT '[]',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Automation Rules Tabelle
CREATE TABLE public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT NOT NULL,
  conditions JSONB DEFAULT '{}',
  actions JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Candidate Rankings View
CREATE OR REPLACE VIEW public.candidate_rankings AS
SELECT 
  s.id AS submission_id,
  s.job_id,
  s.candidate_id,
  s.status,
  c.full_name,
  s.match_score,
  cb.confidence_score,
  cb.interview_readiness_score,
  cb.closing_probability,
  cb.engagement_level,
  -- Composite Ranking Score (gewichteter Durchschnitt)
  ROUND(
    (COALESCE(s.match_score, 50) * 0.3 +
     COALESCE(cb.confidence_score, 50) * 0.25 +
     COALESCE(cb.interview_readiness_score, 50) * 0.2 +
     COALESCE(cb.closing_probability, 50) * 0.25)::numeric
  ) AS overall_rank_score,
  -- Rank innerhalb des Jobs
  RANK() OVER (
    PARTITION BY s.job_id 
    ORDER BY (
      COALESCE(s.match_score, 50) * 0.3 +
      COALESCE(cb.confidence_score, 50) * 0.25 +
      COALESCE(cb.interview_readiness_score, 50) * 0.2 +
      COALESCE(cb.closing_probability, 50) * 0.25
    ) DESC
  ) AS rank_position
FROM public.submissions s
JOIN public.candidates c ON c.id = s.candidate_id
LEFT JOIN public.candidate_behavior cb ON cb.submission_id = s.id
WHERE s.status NOT IN ('rejected', 'withdrawn');

-- RLS für interview_intelligence
ALTER TABLE public.interview_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all interview intelligence"
ON public.interview_intelligence FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients can view intelligence for their job interviews"
ON public.interview_intelligence FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.interviews i
    JOIN public.submissions s ON s.id = i.submission_id
    JOIN public.jobs j ON j.id = s.job_id
    WHERE i.id = interview_intelligence.interview_id
    AND j.client_id = auth.uid()
  )
);

CREATE POLICY "Recruiters can view intelligence for their submissions"
ON public.interview_intelligence FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.interviews i
    JOIN public.submissions s ON s.id = i.submission_id
    WHERE i.id = interview_intelligence.interview_id
    AND s.recruiter_id = auth.uid()
  )
);

CREATE POLICY "System can insert interview intelligence"
ON public.interview_intelligence FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update interview intelligence"
ON public.interview_intelligence FOR UPDATE
USING (true);

-- RLS für automation_rules
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all automation rules"
ON public.automation_rules FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view active rules"
ON public.automation_rules FOR SELECT
USING (is_active = true);

-- Indexes
CREATE INDEX idx_interview_intelligence_interview_id ON public.interview_intelligence(interview_id);
CREATE INDEX idx_interview_intelligence_submission_id ON public.interview_intelligence(submission_id);
CREATE INDEX idx_automation_rules_trigger_event ON public.automation_rules(trigger_event);
CREATE INDEX idx_automation_rules_is_active ON public.automation_rules(is_active);

-- Trigger für updated_at
CREATE TRIGGER update_interview_intelligence_updated_at
BEFORE UPDATE ON public.interview_intelligence
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_automation_rules_updated_at
BEFORE UPDATE ON public.automation_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();