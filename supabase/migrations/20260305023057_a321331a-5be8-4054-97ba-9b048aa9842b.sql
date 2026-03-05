-- Intelligent Fit Assessment: AI-powered, evidence-based candidate-job fit analysis
CREATE TABLE public.candidate_fit_assessments (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id             UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  candidate_id              UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_id                    UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  overall_verdict           TEXT NOT NULL CHECK (overall_verdict IN ('strong_fit', 'good_fit', 'partial_fit', 'weak_fit', 'no_fit')),
  overall_score             INTEGER NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  executive_summary         TEXT NOT NULL,
  verdict_confidence        TEXT NOT NULL CHECK (verdict_confidence IN ('high', 'medium', 'low')),
  requirement_assessments   JSONB NOT NULL DEFAULT '[]'::jsonb,
  bonus_qualifications      JSONB NOT NULL DEFAULT '[]'::jsonb,
  gap_analysis              JSONB NOT NULL DEFAULT '[]'::jsonb,
  career_trajectory         JSONB DEFAULT '{}'::jsonb,
  implicit_competencies     JSONB NOT NULL DEFAULT '[]'::jsonb,
  motivation_fit            JSONB DEFAULT NULL,
  dimension_scores          JSONB NOT NULL DEFAULT '{}'::jsonb,
  rejection_reasoning       TEXT,
  model_used                TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  prompt_version            TEXT NOT NULL DEFAULT 'v1',
  input_data_hash           TEXT,
  generation_time_ms        INTEGER,
  generated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by              UUID,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(submission_id)
);

CREATE INDEX idx_fit_assessments_submission ON public.candidate_fit_assessments(submission_id);
CREATE INDEX idx_fit_assessments_candidate ON public.candidate_fit_assessments(candidate_id);
CREATE INDEX idx_fit_assessments_job ON public.candidate_fit_assessments(job_id);
CREATE INDEX idx_fit_assessments_verdict ON public.candidate_fit_assessments(overall_verdict);

ALTER TABLE public.candidate_fit_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all fit assessments"
ON public.candidate_fit_assessments FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Recruiters can manage fit assessments for their candidates"
ON public.candidate_fit_assessments FOR ALL
USING (EXISTS (
  SELECT 1 FROM candidates c
  WHERE c.id = candidate_fit_assessments.candidate_id
  AND c.recruiter_id = auth.uid()
));

CREATE POLICY "Clients can view fit assessments for their job submissions"
ON public.candidate_fit_assessments FOR SELECT
USING (EXISTS (
  SELECT 1 FROM submissions s
  JOIN jobs j ON j.id = s.job_id
  WHERE s.id = candidate_fit_assessments.submission_id
  AND j.client_id = auth.uid()
));

CREATE TRIGGER update_candidate_fit_assessments_updated_at
BEFORE UPDATE ON public.candidate_fit_assessments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();