-- Add intake fields to jobs table for Smart Intake system
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS team_size integer,
ADD COLUMN IF NOT EXISTS team_avg_age text,
ADD COLUMN IF NOT EXISTS core_hours text,
ADD COLUMN IF NOT EXISTS overtime_policy text,
ADD COLUMN IF NOT EXISTS career_path text,
ADD COLUMN IF NOT EXISTS company_culture text,
ADD COLUMN IF NOT EXISTS success_profile text,
ADD COLUMN IF NOT EXISTS failure_profile text,
ADD COLUMN IF NOT EXISTS vacancy_reason text,
ADD COLUMN IF NOT EXISTS hiring_deadline date,
ADD COLUMN IF NOT EXISTS candidates_in_pipeline integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS decision_makers text[],
ADD COLUMN IF NOT EXISTS contract_type text,
ADD COLUMN IF NOT EXISTS works_council boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS daily_routine text,
ADD COLUMN IF NOT EXISTS task_breakdown jsonb,
ADD COLUMN IF NOT EXISTS trainable_skills text[],
ADD COLUMN IF NOT EXISTS intake_briefing text,
ADD COLUMN IF NOT EXISTS intake_completeness integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS hiring_urgency text DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS industry_challenges text,
ADD COLUMN IF NOT EXISTS industry_opportunities text,
ADD COLUMN IF NOT EXISTS department_structure text,
ADD COLUMN IF NOT EXISTS time_tracking_method text,
ADD COLUMN IF NOT EXISTS career_example text,
ADD COLUMN IF NOT EXISTS unique_selling_points text[],
ADD COLUMN IF NOT EXISTS position_advantages text[],
ADD COLUMN IF NOT EXISTS contract_sensitive_topics text,
ADD COLUMN IF NOT EXISTS reports_to text,
ADD COLUMN IF NOT EXISTS negative_impact_if_unfilled text,
ADD COLUMN IF NOT EXISTS candidates_dropped_reason text,
ADD COLUMN IF NOT EXISTS task_focus text,
ADD COLUMN IF NOT EXISTS must_have_criteria text[],
ADD COLUMN IF NOT EXISTS nice_to_have_criteria text[],
ADD COLUMN IF NOT EXISTS bonus_structure text,
ADD COLUMN IF NOT EXISTS contract_creation_days integer,
ADD COLUMN IF NOT EXISTS works_council_meeting_schedule text;

-- Add constraint for hiring_urgency
ALTER TABLE public.jobs
ADD CONSTRAINT jobs_hiring_urgency_check 
CHECK (hiring_urgency IN ('standard', 'urgent', 'hot') OR hiring_urgency IS NULL);

-- Add comment for documentation
COMMENT ON COLUMN public.jobs.intake_completeness IS 'Percentage of intake fields filled (0-100)';
COMMENT ON COLUMN public.jobs.intake_briefing IS 'Free-text briefing from customer, source for AI extraction';
COMMENT ON COLUMN public.jobs.hiring_urgency IS 'Urgency level: standard, urgent, or hot';