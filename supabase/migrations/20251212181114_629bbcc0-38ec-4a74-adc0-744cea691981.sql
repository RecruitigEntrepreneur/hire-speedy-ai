-- Create storage bucket for job documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-documents', 'job-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for job-documents bucket
-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload job documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'job-documents');

-- Allow authenticated users to read their uploaded files
CREATE POLICY "Authenticated users can read job documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'job-documents');

-- Allow authenticated users to delete their uploaded files
CREATE POLICY "Authenticated users can delete job documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'job-documents');