-- Add urgency and industry fields to jobs table
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS urgency text DEFAULT 'standard' CHECK (urgency IN ('standard', 'urgent', 'hot')),
ADD COLUMN IF NOT EXISTS industry text;

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  related_id uuid,
  related_type text,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  job_id uuid,
  candidate_id uuid,
  content text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their messages"
ON public.messages FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send messages"
ON public.messages FOR INSERT
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can mark messages as read"
ON public.messages FOR UPDATE
USING (auth.uid() = recipient_id);

-- Create recruiter_documents table
CREATE TABLE IF NOT EXISTS public.recruiter_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL,
  document_type text NOT NULL,
  document_url text,
  is_accepted boolean DEFAULT false,
  accepted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.recruiter_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recruiters can manage their documents"
ON public.recruiter_documents FOR ALL
USING (auth.uid() = recruiter_id);

CREATE POLICY "Admins can view all documents"
ON public.recruiter_documents FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Add bank details to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS bank_iban text,
ADD COLUMN IF NOT EXISTS bank_bic text,
ADD COLUMN IF NOT EXISTS tax_id text,
ADD COLUMN IF NOT EXISTS company_address text;