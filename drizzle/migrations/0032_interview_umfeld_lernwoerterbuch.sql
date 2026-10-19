ALTER TABLE public.candidate_interview_notes
  ADD COLUMN IF NOT EXISTS company_size_pref text,
  ADD COLUMN IF NOT EXISTS industry_change text,
  ADD COLUMN IF NOT EXISTS international_pref text;

ALTER TABLE public.candidate_interview_notes DROP CONSTRAINT IF EXISTS candidate_interview_notes_company_size_pref_check;
ALTER TABLE public.candidate_interview_notes
  ADD CONSTRAINT candidate_interview_notes_company_size_pref_check CHECK (company_size_pref IS NULL OR company_size_pref IN ('corporate', 'midsize', 'startup', 'any'));

ALTER TABLE public.candidate_interview_notes DROP CONSTRAINT IF EXISTS candidate_interview_notes_industry_change_check;
ALTER TABLE public.candidate_interview_notes
  ADD CONSTRAINT candidate_interview_notes_industry_change_check CHECK (industry_change IS NULL OR industry_change IN ('same', 'open'));

ALTER TABLE public.candidate_interview_notes DROP CONSTRAINT IF EXISTS candidate_interview_notes_international_pref_check;
ALTER TABLE public.candidate_interview_notes
  ADD CONSTRAINT candidate_interview_notes_international_pref_check CHECK (international_pref IS NULL OR international_pref IN ('yes', 'no'));

COMMENT ON COLUMN public.candidate_interview_notes.company_size_pref IS 'corporate | midsize | startup | any – gewünschte Unternehmensgröße';
COMMENT ON COLUMN public.candidate_interview_notes.industry_change IS 'same | open – in der Branche bleiben oder offen für einen Wechsel';
COMMENT ON COLUMN public.candidate_interview_notes.international_pref IS 'yes | no – internationale Aufgaben gewünscht';

CREATE TABLE IF NOT EXISTS public.interview_phrase_learnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  side text NOT NULL CHECK (side IN ('pos', 'neg', 'goal')),
  phrase text NOT NULL CHECK (char_length(phrase) BETWEEN 3 AND 60 AND phrase !~ '[0-9@]'),
  label text NOT NULL CHECK (char_length(label) BETWEEN 2 AND 80),
  family text,
  recruiter_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (side, phrase, label, recruiter_id)
);

COMMENT ON TABLE public.interview_phrase_learnings IS 'Vom Headhunter bestätigte Paare „Wendung → Knopf“ für gefällt, stört und Karriereziel im Interview. Kein Kandidatenbezug.';

CREATE INDEX IF NOT EXISTS interview_phrase_learnings_side_idx ON public.interview_phrase_learnings (side);

GRANT SELECT, INSERT, DELETE ON public.interview_phrase_learnings TO authenticated;
GRANT ALL ON public.interview_phrase_learnings TO service_role;

ALTER TABLE public.interview_phrase_learnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Headhunter lesen gelernte Wendungen" ON public.interview_phrase_learnings;
CREATE POLICY "Headhunter lesen gelernte Wendungen"
  ON public.interview_phrase_learnings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'recruiter') OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Headhunter speichern eigene Wendungen" ON public.interview_phrase_learnings;
CREATE POLICY "Headhunter speichern eigene Wendungen"
  ON public.interview_phrase_learnings FOR INSERT TO authenticated
  WITH CHECK (recruiter_id = auth.uid() AND (public.has_role(auth.uid(), 'recruiter') OR public.has_role(auth.uid(), 'admin')));

DROP POLICY IF EXISTS "Headhunter löschen eigene Wendungen" ON public.interview_phrase_learnings;
CREATE POLICY "Headhunter löschen eigene Wendungen"
  ON public.interview_phrase_learnings FOR DELETE TO authenticated
  USING (recruiter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));