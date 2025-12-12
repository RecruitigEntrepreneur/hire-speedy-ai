-- Add briefing_notes column to jobs table for recruiter instructions
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS briefing_notes TEXT;