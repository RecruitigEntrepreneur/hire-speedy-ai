-- Tabelle für strukturierte Interview-Notizen
CREATE TABLE public.candidate_interview_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  recruiter_id UUID NOT NULL,
  
  -- Block 1: Karriereziele
  career_ultimate_goal TEXT,
  career_3_5_year_plan TEXT,
  career_actions_taken TEXT,
  career_what_worked TEXT,
  career_what_didnt_work TEXT,
  
  -- Block 2: Aktuelle Situation & Wechselmotivation
  current_positive TEXT,
  current_negative TEXT,
  change_motivation TEXT,
  change_motivation_tags TEXT[] DEFAULT '{}',
  specific_incident TEXT,
  frequency_of_issues TEXT,
  would_stay_if_matched BOOLEAN,
  why_now TEXT,
  previous_process_issues TEXT,
  discussed_internally TEXT,
  
  -- Block 3: Gehalt
  salary_current TEXT,
  salary_desired TEXT,
  salary_minimum TEXT,
  offer_requirements TEXT[] DEFAULT '{}',
  
  -- Block 4: Vertragsrahmen
  notice_period TEXT,
  earliest_start_date DATE,
  
  -- Abschluss
  would_recommend BOOLEAN,
  recommendation_notes TEXT,
  
  -- Freitext
  additional_notes TEXT,
  
  -- Zusammenfassung für Kunden
  summary_motivation TEXT,
  summary_salary TEXT,
  summary_notice TEXT,
  summary_key_requirements TEXT,
  summary_cultural_fit TEXT,
  
  -- Metadaten
  interview_date TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS aktivieren
ALTER TABLE public.candidate_interview_notes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Recruiters can manage own interview notes"
ON public.candidate_interview_notes FOR ALL
USING (auth.uid() = recruiter_id);

CREATE POLICY "Admins can manage all interview notes"
ON public.candidate_interview_notes FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger für updated_at
CREATE TRIGGER update_candidate_interview_notes_updated_at
BEFORE UPDATE ON public.candidate_interview_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();