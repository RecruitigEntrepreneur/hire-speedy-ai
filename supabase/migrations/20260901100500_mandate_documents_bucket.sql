-- ============================================================================
-- Jobaufnahme-Links · Ablage der Vertragsdokumente (6/6)
-- ----------------------------------------------------------------------------
-- Eigener, privater Bucket statt job-documents. Zwei Gruende:
--   1. job-documents hat die Policy "Authenticated users can upload job
--      documents" WITH CHECK (bucket_id = 'job-documents') ohne Pfadbindung
--      (20251212181114:8-12) -- jeder angemeldete Nutzer darf dort schreiben,
--      und parse-job-pdf:61-64 laedt einen frei waehlbaren Pfad mit
--      Service-Role herunter. Vertraege gehoeren nicht in diesen Raum.
--   2. Vertragsdokumente haben eine andere Aufbewahrung als Stellen-PDFs.
--
-- Zugriff ausschliesslich ueber Service-Role bzw. signierte URLs. Es gibt
-- bewusst KEINE Upload-Policy fuer authenticated: der Gast laedt nichts hoch,
-- und der Admin schreibt ueber die Edge Function.
-- ============================================================================

BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('mandate-documents', 'mandate-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Nur Admins lesen direkt; alle anderen Wege laufen ueber signierte URLs,
-- die die Edge Function ausstellt.
DROP POLICY IF EXISTS "Admins read mandate documents" ON storage.objects;
CREATE POLICY "Admins read mandate documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'mandate-documents' AND public.has_role(auth.uid(), 'admin'));

-- Der unterzeichnete Rueckläufer aus DocuSign wird vom Admin hinterlegt.
DROP POLICY IF EXISTS "Admins write mandate documents" ON storage.objects;
CREATE POLICY "Admins write mandate documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mandate-documents' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update mandate documents" ON storage.objects;
CREATE POLICY "Admins update mandate documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING      (bucket_id = 'mandate-documents' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'mandate-documents' AND public.has_role(auth.uid(), 'admin'));

COMMIT;
