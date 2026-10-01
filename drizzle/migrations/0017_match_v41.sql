CREATE TABLE IF NOT EXISTS public.match_v41_profiles (
  entity_type    text        NOT NULL CHECK (entity_type IN ('job', 'candidate')),
  entity_id      uuid        NOT NULL,
  input_hash     text        NOT NULL,
  profile        jsonb       NOT NULL,
  model          text,
  prompt_version text        NOT NULL,
  ai_ok          boolean     NOT NULL DEFAULT true,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_type, entity_id)
);

ALTER TABLE public.match_v41_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins lesen V4.1-Profile" ON public.match_v41_profiles;
CREATE POLICY "Admins lesen V4.1-Profile" ON public.match_v41_profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.match_v41_results (
  candidate_id   uuid        NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_id         uuid        NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  recruiter_id   uuid        NOT NULL,
  tier           text        NOT NULL CHECK (tier IN ('sehr_passend', 'passend', 'pruefen', 'ausgeschlossen')),
  sort_score     integer     NOT NULL DEFAULT 0,
  confidence     numeric(3,2) NOT NULL DEFAULT 0,
  result         jsonb       NOT NULL,
  input_hash     text        NOT NULL,
  model          text,
  prompt_version text        NOT NULL,
  ai_judged      boolean     NOT NULL DEFAULT false,
  computed_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (candidate_id, job_id)
);

CREATE INDEX IF NOT EXISTS match_v41_results_job_tier_idx ON public.match_v41_results (job_id, tier);
CREATE INDEX IF NOT EXISTS match_v41_results_recruiter_idx ON public.match_v41_results (recruiter_id, computed_at DESC);

ALTER TABLE public.match_v41_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Headhunter lesen Urteile eigener Kandidaten" ON public.match_v41_results;
CREATE POLICY "Headhunter lesen Urteile eigener Kandidaten" ON public.match_v41_results
  FOR SELECT TO authenticated
  USING (
    recruiter_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.candidates c WHERE c.id = candidate_id AND c.recruiter_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins lesen alle V4.1-Urteile" ON public.match_v41_results;
CREATE POLICY "Admins lesen alle V4.1-Urteile" ON public.match_v41_results
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.match_v41_overrides (
  candidate_id uuid        NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_id       uuid        NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  recruiter_id uuid        NOT NULL DEFAULT auth.uid(),
  decision     text        NOT NULL CHECK (decision IN ('show', 'hide')),
  reason       text        CHECK (reason IS NULL OR char_length(reason) <= 500),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (candidate_id, job_id, recruiter_id)
);

ALTER TABLE public.match_v41_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Headhunter verwalten eigene Übersteuerungen" ON public.match_v41_overrides;
CREATE POLICY "Headhunter verwalten eigene Übersteuerungen" ON public.match_v41_overrides
  FOR ALL TO authenticated
  USING (
    recruiter_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.candidates c WHERE c.id = candidate_id AND c.recruiter_id = auth.uid())
  )
  WITH CHECK (
    recruiter_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.candidates c WHERE c.id = candidate_id AND c.recruiter_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins lesen alle Übersteuerungen" ON public.match_v41_overrides;
CREATE POLICY "Admins lesen alle Übersteuerungen" ON public.match_v41_overrides
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.match_v41_results TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_v41_overrides TO authenticated;
GRANT SELECT ON public.match_v41_profiles TO authenticated;
GRANT ALL ON public.match_v41_profiles TO service_role;
GRANT ALL ON public.match_v41_results TO service_role;
GRANT ALL ON public.match_v41_overrides TO service_role;

COMMENT ON TABLE public.match_v41_results IS 'Match V4.1: KI-Urteil je Kandidat × Stelle (Stufe, Belege, Klärfragen). Nur Headhunter (eigene Kandidaten) und Admins. Nie für Kunden.';