-- Add job_summary column for AI-generated executive summary
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS job_summary jsonb DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.jobs.job_summary IS 'AI-generated structured executive summary with key_facts, tasks_structured, requirements_structured, benefits_extracted, and ai_insights';