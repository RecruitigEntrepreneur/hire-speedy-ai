
-- Erweitere candidates Tabelle mit neuen Feldern
ALTER TABLE public.candidates
ADD COLUMN IF NOT EXISTS job_title TEXT,
ADD COLUMN IF NOT EXISTS company TEXT,
ADD COLUMN IF NOT EXISTS seniority TEXT,
ADD COLUMN IF NOT EXISTS work_model TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS remote_possible BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS relocation_willing BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS salary_fix INTEGER,
ADD COLUMN IF NOT EXISTS salary_bonus INTEGER,
ADD COLUMN IF NOT EXISTS visa_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS work_permit_notes TEXT,
ADD COLUMN IF NOT EXISTS portfolio_url TEXT,
ADD COLUMN IF NOT EXISTS github_url TEXT,
ADD COLUMN IF NOT EXISTS website_url TEXT,
ADD COLUMN IF NOT EXISTS certificates JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS hubspot_contact_id TEXT,
ADD COLUMN IF NOT EXISTS import_source TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS candidate_status TEXT DEFAULT 'new';

-- Erstelle candidate_notes Tabelle für erweiterte Notizen
CREATE TABLE IF NOT EXISTS public.candidate_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  recruiter_id UUID NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  is_private BOOLEAN DEFAULT true,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.candidate_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies für candidate_notes
CREATE POLICY "Recruiters can manage their own notes"
ON public.candidate_notes
FOR ALL
USING (auth.uid() = recruiter_id);

CREATE POLICY "Admins can manage all notes"
ON public.candidate_notes
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger für updated_at
CREATE TRIGGER update_candidate_notes_updated_at
BEFORE UPDATE ON public.candidate_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Index für bessere Performance
CREATE INDEX IF NOT EXISTS idx_candidate_notes_candidate_id ON public.candidate_notes(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_notes_recruiter_id ON public.candidate_notes(recruiter_id);
