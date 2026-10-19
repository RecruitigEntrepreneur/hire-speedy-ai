ALTER TABLE public.candidate_interview_notes
  ADD COLUMN IF NOT EXISTS salary_basis text,
  ADD COLUMN IF NOT EXISTS non_compete text;

ALTER TABLE public.candidate_interview_notes DROP CONSTRAINT IF EXISTS candidate_interview_notes_salary_basis_check;
ALTER TABLE public.candidate_interview_notes
  ADD CONSTRAINT candidate_interview_notes_salary_basis_check CHECK (salary_basis IS NULL OR salary_basis IN ('fix', 'total'));

ALTER TABLE public.candidate_interview_notes DROP CONSTRAINT IF EXISTS candidate_interview_notes_non_compete_check;
ALTER TABLE public.candidate_interview_notes
  ADD CONSTRAINT candidate_interview_notes_non_compete_check CHECK (non_compete IS NULL OR non_compete IN ('none', 'non_compete', 'garden_leave', 'negotiable'));

COMMENT ON COLUMN public.candidate_interview_notes.salary_basis IS 'fix | total – Gehaltsangaben als Fixum oder Gesamt mit Bonus';
COMMENT ON COLUMN public.candidate_interview_notes.non_compete IS 'none | non_compete | garden_leave | negotiable – nur intern';