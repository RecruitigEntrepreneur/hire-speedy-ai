-- Add calendar event IDs to interviews table
ALTER TABLE public.interviews
ADD COLUMN IF NOT EXISTS outlook_event_id text,
ADD COLUMN IF NOT EXISTS google_event_id text;