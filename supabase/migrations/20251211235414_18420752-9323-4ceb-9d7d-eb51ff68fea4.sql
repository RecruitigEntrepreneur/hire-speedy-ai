-- Create storage bucket for CV documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('cv-documents', 'cv-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload CVs
CREATE POLICY "Users can upload CV documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'cv-documents');

-- Allow authenticated users to read their uploaded CVs
CREATE POLICY "Users can read CV documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'cv-documents');

-- Allow authenticated users to delete their CVs
CREATE POLICY "Users can delete CV documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'cv-documents');