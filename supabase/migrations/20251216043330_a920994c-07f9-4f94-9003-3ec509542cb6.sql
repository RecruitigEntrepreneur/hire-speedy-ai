-- Add trigger tracking columns to outreach_emails table
ALTER TABLE public.outreach_emails 
ADD COLUMN IF NOT EXISTS trigger_type TEXT,
ADD COLUMN IF NOT EXISTS trigger_secondary TEXT,
ADD COLUMN IF NOT EXISTS trigger_problem TEXT,
ADD COLUMN IF NOT EXISTS trigger_confidence TEXT,
ADD COLUMN IF NOT EXISTS recipient_role TEXT;

-- Add index for trigger analysis
CREATE INDEX IF NOT EXISTS idx_outreach_emails_trigger_type ON public.outreach_emails(trigger_type);
CREATE INDEX IF NOT EXISTS idx_outreach_emails_recipient_role ON public.outreach_emails(recipient_role);

-- Add comment for documentation
COMMENT ON COLUMN public.outreach_emails.trigger_type IS 'Primary trigger used: hiring, transition, technology, growth, role';
COMMENT ON COLUMN public.outreach_emails.trigger_secondary IS 'Optional secondary trigger';
COMMENT ON COLUMN public.outreach_emails.trigger_problem IS 'Identified problem statement for the lead';
COMMENT ON COLUMN public.outreach_emails.trigger_confidence IS 'Confidence level of trigger detection: high, medium, low';
COMMENT ON COLUMN public.outreach_emails.recipient_role IS 'Detected role category: cto, hr, founder, manager, other';