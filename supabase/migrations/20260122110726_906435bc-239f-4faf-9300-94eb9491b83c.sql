-- ===========================================
-- Triple-Blind 2-Stufen-Enthüllung für Recruiter
-- ===========================================

-- 1. Neue Spalten in jobs für kontextreiche Anonymisierung
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS company_size_band text,
ADD COLUMN IF NOT EXISTS funding_stage text,
ADD COLUMN IF NOT EXISTS hiring_urgency text DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS tech_environment text[];

-- 2. Neue Spalten in submissions für 2-Stufen-Reveal
ALTER TABLE public.submissions
ADD COLUMN IF NOT EXISTS company_revealed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS company_revealed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS full_access_granted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS full_access_granted_at timestamp with time zone;

-- 3. Trigger-Funktion für Stufe 1: company_revealed bei candidate_opted_in
CREATE OR REPLACE FUNCTION public.reveal_company_on_opt_in()
RETURNS TRIGGER AS $$
BEGIN
  -- Stufe 1: Wenn Status zu 'candidate_opted_in' wechselt
  IF NEW.status = 'candidate_opted_in' AND 
     (OLD.status IS NULL OR OLD.status != 'candidate_opted_in') AND
     NEW.company_revealed = false THEN
    
    NEW.company_revealed := true;
    NEW.company_revealed_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Trigger für Stufe 1 auf submissions
DROP TRIGGER IF EXISTS on_submission_opt_in ON public.submissions;
CREATE TRIGGER on_submission_opt_in
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.reveal_company_on_opt_in();

-- 5. Trigger-Funktion für Stufe 2: full_access_granted bei Interview-Bestätigung
CREATE OR REPLACE FUNCTION public.grant_full_access_on_interview_confirm()
RETURNS TRIGGER AS $$
BEGIN
  -- Stufe 2: Wenn Kandidat Interview bestätigt
  IF NEW.candidate_confirmed = true AND 
     (OLD.candidate_confirmed IS NULL OR OLD.candidate_confirmed = false) THEN
    
    UPDATE public.submissions 
    SET full_access_granted = true,
        full_access_granted_at = NOW(),
        company_revealed = true,
        company_revealed_at = COALESCE(company_revealed_at, NOW())
    WHERE id = NEW.submission_id
      AND (full_access_granted = false OR full_access_granted IS NULL);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Trigger für Stufe 2 auf interviews
DROP TRIGGER IF EXISTS on_interview_confirmed ON public.interviews;
CREATE TRIGGER on_interview_confirmed
  AFTER UPDATE ON public.interviews
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_full_access_on_interview_confirm();

-- 7. Index für schnellere Abfragen
CREATE INDEX IF NOT EXISTS idx_submissions_company_revealed 
  ON public.submissions(company_revealed) 
  WHERE company_revealed = true;

CREATE INDEX IF NOT EXISTS idx_submissions_full_access 
  ON public.submissions(full_access_granted) 
  WHERE full_access_granted = true;