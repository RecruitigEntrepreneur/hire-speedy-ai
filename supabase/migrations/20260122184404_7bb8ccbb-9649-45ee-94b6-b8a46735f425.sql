-- Create table for caching AI-generated match recommendations
CREATE TABLE public.match_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  match_score INTEGER,
  recommendation_text TEXT NOT NULL,
  action_recommendation TEXT NOT NULL,
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  key_match_points JSONB DEFAULT '[]'::jsonb,
  key_risks JSONB DEFAULT '[]'::jsonb,
  negotiation_hints JSONB DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ DEFAULT now(),
  model_version TEXT DEFAULT 'v1',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(candidate_id, job_id)
);

-- Enable RLS
ALTER TABLE public.match_recommendations ENABLE ROW LEVEL SECURITY;

-- Recruiters can view recommendations for their candidates
CREATE POLICY "Recruiters can view match recommendations for their candidates"
ON public.match_recommendations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = match_recommendations.candidate_id
    AND c.recruiter_id = auth.uid()
  )
);

-- Recruiters can insert recommendations for their candidates
CREATE POLICY "Recruiters can insert match recommendations for their candidates"
ON public.match_recommendations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = match_recommendations.candidate_id
    AND c.recruiter_id = auth.uid()
  )
);

-- Recruiters can update recommendations for their candidates
CREATE POLICY "Recruiters can update match recommendations for their candidates"
ON public.match_recommendations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = match_recommendations.candidate_id
    AND c.recruiter_id = auth.uid()
  )
);

-- Recruiters can delete recommendations for their candidates
CREATE POLICY "Recruiters can delete match recommendations for their candidates"
ON public.match_recommendations
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = match_recommendations.candidate_id
    AND c.recruiter_id = auth.uid()
  )
);

-- Create index for fast lookups
CREATE INDEX idx_match_recommendations_candidate_job ON public.match_recommendations(candidate_id, job_id);
CREATE INDEX idx_match_recommendations_generated_at ON public.match_recommendations(generated_at);

-- Trigger for updated_at
CREATE TRIGGER update_match_recommendations_updated_at
BEFORE UPDATE ON public.match_recommendations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to invalidate recommendations when candidate is updated
CREATE OR REPLACE FUNCTION public.invalidate_match_recommendations_on_candidate_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete cached recommendations when significant candidate fields change
  IF OLD.skills IS DISTINCT FROM NEW.skills
     OR OLD.experience_years IS DISTINCT FROM NEW.experience_years
     OR OLD.expected_salary IS DISTINCT FROM NEW.expected_salary
     OR OLD.salary_expectation_min IS DISTINCT FROM NEW.salary_expectation_min
     OR OLD.salary_expectation_max IS DISTINCT FROM NEW.salary_expectation_max
     OR OLD.city IS DISTINCT FROM NEW.city
     OR OLD.availability_date IS DISTINCT FROM NEW.availability_date
  THEN
    DELETE FROM public.match_recommendations WHERE candidate_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach trigger to candidates table
CREATE TRIGGER invalidate_recommendations_on_candidate_update
AFTER UPDATE ON public.candidates
FOR EACH ROW
EXECUTE FUNCTION public.invalidate_match_recommendations_on_candidate_update();