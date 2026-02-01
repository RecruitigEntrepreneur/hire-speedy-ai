-- Add new fields to interviews table for the professional interview workflow
ALTER TABLE public.interviews 
ADD COLUMN IF NOT EXISTS response_token text UNIQUE,
ADD COLUMN IF NOT EXISTS counter_slots jsonb,
ADD COLUMN IF NOT EXISTS decline_reason text,
ADD COLUMN IF NOT EXISTS candidate_message text,
ADD COLUMN IF NOT EXISTS meeting_format text,
ADD COLUMN IF NOT EXISTS onsite_address text,
ADD COLUMN IF NOT EXISTS client_message text;

-- Add index for response_token lookups
CREATE INDEX IF NOT EXISTS idx_interviews_response_token ON public.interviews(response_token) WHERE response_token IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.interviews.response_token IS 'Unique token for candidate response page (accept/counter/decline)';
COMMENT ON COLUMN public.interviews.counter_slots IS 'Alternative slots proposed by candidate as counter-offer';
COMMENT ON COLUMN public.interviews.meeting_format IS 'Format: teams, meet, video, phone, onsite';
COMMENT ON COLUMN public.interviews.client_message IS 'Message from client to candidate in invitation';