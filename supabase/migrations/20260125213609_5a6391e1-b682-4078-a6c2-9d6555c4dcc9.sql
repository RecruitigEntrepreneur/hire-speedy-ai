-- Add missing match_policy column to submissions table
-- This column is used by the V3.1 Matching Engine to categorize candidates as 'hot', 'standard', or 'maybe'

ALTER TABLE public.submissions 
ADD COLUMN IF NOT EXISTS match_policy TEXT DEFAULT NULL;

-- Add index for performance when filtering by match_policy
CREATE INDEX IF NOT EXISTS idx_submissions_match_policy ON public.submissions(match_policy);

-- Add comment for documentation
COMMENT ON COLUMN public.submissions.match_policy IS 'V3.1 Matching Policy tier: hot, standard, maybe, or null';