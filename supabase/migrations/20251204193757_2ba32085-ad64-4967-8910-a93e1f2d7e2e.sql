-- Email Events Table for logging
CREATE TABLE public.email_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  to_email TEXT NOT NULL,
  template_name TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

-- Policies for email_events
CREATE POLICY "Admins can manage all email events"
  ON public.email_events
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert email events"
  ON public.email_events
  FOR INSERT
  WITH CHECK (true);

-- Consents Table for GDPR compliance
CREATE TABLE public.consents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_type TEXT NOT NULL,
  subject_id UUID NOT NULL,
  consent_type TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0',
  granted BOOLEAN NOT NULL DEFAULT false,
  ip_address TEXT,
  user_agent TEXT,
  granted_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;

-- Policies for consents
CREATE POLICY "Admins can view all consents"
  ON public.consents
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert consents"
  ON public.consents
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view their own consents"
  ON public.consents
  FOR SELECT
  USING (auth.uid() = subject_id);

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800,
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png']
);

-- Storage policies
CREATE POLICY "Users can upload their own documents"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own documents"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all documents"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'documents' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Recruiters can upload candidate documents"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = 'candidates');