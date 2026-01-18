-- Create interview_notes table for live note-taking during interviews
CREATE TABLE public.interview_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'general' CHECK (note_type IN ('general', 'strength', 'concern', 'question')),
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  timestamp_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create interview_checklist_progress table
CREATE TABLE public.interview_checklist_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  checklist_item TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  phase TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(interview_id, checklist_item)
);

-- Add live session columns to interviews table
ALTER TABLE public.interviews 
ADD COLUMN IF NOT EXISTS live_session_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS live_session_ended_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS quick_scores JSONB DEFAULT '{}';

-- Enable RLS
ALTER TABLE public.interview_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_checklist_progress ENABLE ROW LEVEL SECURITY;

-- RLS policies for interview_notes
CREATE POLICY "Users can view interview notes for their interviews"
ON public.interview_notes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.interviews i
    JOIN public.submissions s ON i.submission_id = s.id
    JOIN public.jobs j ON s.job_id = j.id
    WHERE i.id = interview_notes.interview_id
    AND j.client_id = auth.uid()
  )
);

CREATE POLICY "Users can create notes for their interviews"
ON public.interview_notes FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.interviews i
    JOIN public.submissions s ON i.submission_id = s.id
    JOIN public.jobs j ON s.job_id = j.id
    WHERE i.id = interview_notes.interview_id
    AND j.client_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own notes"
ON public.interview_notes FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
ON public.interview_notes FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for interview_checklist_progress
CREATE POLICY "Users can view checklist progress for their interviews"
ON public.interview_checklist_progress FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.interviews i
    JOIN public.submissions s ON i.submission_id = s.id
    JOIN public.jobs j ON s.job_id = j.id
    WHERE i.id = interview_checklist_progress.interview_id
    AND j.client_id = auth.uid()
  )
);

CREATE POLICY "Users can manage checklist progress for their interviews"
ON public.interview_checklist_progress FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.interviews i
    JOIN public.submissions s ON i.submission_id = s.id
    JOIN public.jobs j ON s.job_id = j.id
    WHERE i.id = interview_checklist_progress.interview_id
    AND j.client_id = auth.uid()
  )
);

-- Create indexes for better performance
CREATE INDEX idx_interview_notes_interview_id ON public.interview_notes(interview_id);
CREATE INDEX idx_interview_notes_user_id ON public.interview_notes(user_id);
CREATE INDEX idx_interview_checklist_progress_interview_id ON public.interview_checklist_progress(interview_id);