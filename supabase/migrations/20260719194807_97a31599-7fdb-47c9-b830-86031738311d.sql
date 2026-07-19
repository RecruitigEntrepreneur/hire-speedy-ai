CREATE TABLE IF NOT EXISTS public.match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'impression', 'click', 'shortlist', 'submit', 'interview', 'hire', 'reject',
    'v31_scored', 'v4_scored', 'job_normalized'
  )),
  candidate_id UUID,
  job_id UUID,
  submission_id UUID,
  actor_role TEXT,
  rank INT,
  score INT,
  match_version TEXT,
  model TEXT,
  prompt_version TEXT,
  is_synthetic BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.match_events IS
  'Lern-Schleife des Matchings: jede Ranking-Interaktion (impression→hire/reject) und jeder Modell-Output, reproduzierbar mit Modell-/Prompt-Version. is_synthetic trennt Testdaten strikt von Lernsignalen.';

CREATE INDEX IF NOT EXISTS idx_match_events_job ON public.match_events(job_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_events_candidate ON public.match_events(candidate_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_events_type ON public.match_events(event_type, occurred_at DESC);

GRANT SELECT ON public.match_events TO authenticated;
GRANT ALL ON public.match_events TO service_role;

ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can manage match events"
  ON public.match_events FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins can read match events"
  ON public.match_events FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.match_ai_judgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL,
  job_id UUID NOT NULL,
  input_hash TEXT NOT NULL,
  judge_model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  dimensions JSONB NOT NULL,
  weighted_score INT NOT NULL,
  v31_score INT,
  blended_score INT,
  red_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, job_id, input_hash)
);

COMMENT ON TABLE public.match_ai_judgements IS
  'Pair-Level-Cache des evidenzbasierten LLM-Judge (V4). Invalidiert sich über input_hash (Profil-/Job-/Versions-Änderung = neuer Hash).';

CREATE INDEX IF NOT EXISTS idx_match_ai_judgements_pair ON public.match_ai_judgements(candidate_id, job_id);

GRANT SELECT ON public.match_ai_judgements TO authenticated;
GRANT ALL ON public.match_ai_judgements TO service_role;

ALTER TABLE public.match_ai_judgements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can manage match judgements"
  ON public.match_ai_judgements FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins can read match judgements"
  ON public.match_ai_judgements FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS requirements_normalized_at TIMESTAMPTZ;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS requirements_normalization_version TEXT;

COMMENT ON COLUMN public.jobs.requirements_normalized_at IS
  'Zeitpunkt der letzten Anforderungs-Normalisierung (normalize-job-requirements → job_skill_requirements).';