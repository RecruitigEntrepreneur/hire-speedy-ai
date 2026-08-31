DROP POLICY IF EXISTS "Admins read mandate documents" ON storage.objects;
CREATE POLICY "Admins read mandate documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'mandate-documents' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins write mandate documents" ON storage.objects;
CREATE POLICY "Admins write mandate documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mandate-documents' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update mandate documents" ON storage.objects;
CREATE POLICY "Admins update mandate documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING      (bucket_id = 'mandate-documents' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'mandate-documents' AND public.has_role(auth.uid(), 'admin'));