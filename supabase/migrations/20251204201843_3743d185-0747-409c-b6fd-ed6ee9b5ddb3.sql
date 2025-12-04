-- Phase 4: GDPR Compliance Tables

-- Data Export Requests
CREATE TABLE public.data_export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  file_url TEXT,
  requested_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own export requests"
ON public.data_export_requests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own export requests"
ON public.data_export_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all export requests"
ON public.data_export_requests FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Data Deletion Requests
CREATE TABLE public.data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'completed')),
  reason TEXT,
  confirmation_token TEXT UNIQUE,
  confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own deletion requests"
ON public.data_deletion_requests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own deletion requests"
ON public.data_deletion_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own deletion requests"
ON public.data_deletion_requests FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all deletion requests"
ON public.data_deletion_requests FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Add scope to consents table
ALTER TABLE public.consents ADD COLUMN IF NOT EXISTS scope TEXT;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_data_export_user ON public.data_export_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_data_deletion_user ON public.data_deletion_requests(user_id, status);

-- Phase 5: Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.interviews;