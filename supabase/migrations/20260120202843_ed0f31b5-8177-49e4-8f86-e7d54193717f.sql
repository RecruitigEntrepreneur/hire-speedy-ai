-- Add new fields for job approval workflow
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS formatted_content JSONB,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);

-- Add comment for documentation
COMMENT ON COLUMN public.jobs.formatted_content IS 'AI-formatted content for recruiter display (headline, highlights, selling_points)';
COMMENT ON COLUMN public.jobs.approved_at IS 'Timestamp when job was approved by admin';
COMMENT ON COLUMN public.jobs.approved_by IS 'Admin user ID who approved the job';