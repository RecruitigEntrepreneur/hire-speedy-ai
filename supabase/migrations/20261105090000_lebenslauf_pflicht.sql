-- Lebenslauf-Pflicht beim Einreichen und abgedichteter Lebenslauf-Speicher.
--
-- 1. Ohne hochgeladenen Lebenslauf (PDF oder Word, aktuelle Version in
--    candidate_documents) geht keine neue Einreichung mehr – auf keinem Weg.
--    Admins und Systemprozesse (auth.uid() IS NULL, Service Role) bleiben
--    ausgenommen, wie bei enforce_submission_activation. Bestehende
--    Einreichungen sind nicht betroffen (nur INSERT).
-- 2. Die Einreichung merkt sich, welche Lebenslauf-Version eingereicht wurde
--    (cv_document_id, setzt die Datenbank selbst).
-- 3. candidate_documents.extracted: was im Lebenslauf stand (Position,
--    Arbeitgeber, Berufsjahre, Abschlüsse), für den Abgleich mit der Akte.
--    confirmed_current_at: der Headhunter hat bestätigt, dass der Lebenslauf
--    noch aktuell ist.
-- 4. Speicher cv-documents: Bisher durfte jeder angemeldete Nutzer jeden
--    Lebenslauf lesen, hochladen und löschen (Regel prüfte nur den Speicher).
--    Jetzt nur noch der Headhunter, dem der Kandidat gehört, und Admins.
--    Kunden bekommen den Lebenslauf nach der Interview-Zusage über die
--    Function client-candidate-cv (kurzlebiger Link).

-- ----------------------------------------------------------------------------
-- 1) Spalten
-- ----------------------------------------------------------------------------
ALTER TABLE public.candidate_documents
  ADD COLUMN IF NOT EXISTS extracted jsonb,
  ADD COLUMN IF NOT EXISTS confirmed_current_at timestamptz;

COMMENT ON COLUMN public.candidate_documents.extracted IS
  'Abdruck des Lebenslaufs beim Hochladen: {job_title, company, experience_years, degrees[]} – Abgleich mit der Akte.';
COMMENT ON COLUMN public.candidate_documents.confirmed_current_at IS
  'Headhunter hat beim Einreichen bestätigt, dass der Lebenslauf noch aktuell ist.';

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS cv_document_id uuid REFERENCES public.candidate_documents(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.submissions.cv_document_id IS
  'Lebenslauf-Version, die mit dieser Einreichung eingereicht wurde (setzt require_candidate_cv).';

-- ----------------------------------------------------------------------------
-- 2) Aktueller Lebenslauf eines Kandidaten
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_candidate_cv_id(p_candidate_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id
    FROM public.candidate_documents d
   WHERE d.candidate_id = p_candidate_id
     AND d.document_type = 'cv'
     AND d.is_current IS TRUE
     AND d.file_name ~* '\.(pdf|docx?)$'
   ORDER BY d.created_at DESC
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_candidate_cv_id(uuid) FROM PUBLIC;

-- ----------------------------------------------------------------------------
-- 3) Pflicht beim Einreichen
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.require_candidate_cv()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cv uuid := public.current_candidate_cv_id(NEW.candidate_id);
BEGIN
  IF v_cv IS NULL
     AND auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Ohne Lebenslauf kann der Kandidat nicht eingereicht werden.'
      USING ERRCODE = 'P0001', HINT = 'cv_missing';
  END IF;

  -- Immer selbst setzen, nie vom Aufrufer übernehmen
  NEW.cv_document_id := v_cv;
  RETURN NEW;
END;
$$;

-- Name sortiert nach trg_enforce_submission_activation: erst „Ich suche“ und
-- Kundenfrage, dann der Lebenslauf.
DROP TRIGGER IF EXISTS trg_require_candidate_cv ON public.submissions;
CREATE TRIGGER trg_require_candidate_cv
  BEFORE INSERT ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.require_candidate_cv();

-- ----------------------------------------------------------------------------
-- 4) Speicher cv-documents abdichten
-- ----------------------------------------------------------------------------
-- Ablagepfade im Speicher:
--   {user_id}/…                    Lebenslauf-Import, Interview einwerfen
--   {candidate_id}/…               Reiter „Dokumente“
--   email-imports/{recruiter_id}/… E-Mail-Eingang (lädt die Service Role hoch)
-- Ältere Dateien mit anderem Pfad bleiben über candidate_documents erreichbar.
CREATE OR REPLACE FUNCTION public.can_access_cv_object(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
       public.has_role(auth.uid(), 'admin')
    OR (storage.foldername(p_name))[1] = auth.uid()::text
    OR ((storage.foldername(p_name))[1] = 'email-imports' AND (storage.foldername(p_name))[2] = auth.uid()::text)
    OR EXISTS (
         SELECT 1 FROM public.candidates c
          WHERE c.id::text = (storage.foldername(p_name))[1]
            AND c.recruiter_id = auth.uid())
    OR EXISTS (
         SELECT 1
           FROM public.candidate_documents d
           JOIN public.candidates c ON c.id = d.candidate_id
          WHERE c.recruiter_id = auth.uid()
            AND right(d.file_url, length(p_name) + 14) = '/cv-documents/' || p_name)
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_cv_object(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_cv_object(text) TO authenticated;

DROP POLICY IF EXISTS "Users can upload CV documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can read CV documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete CV documents" ON storage.objects;
DROP POLICY IF EXISTS "CV: lesen nur eigene" ON storage.objects;
DROP POLICY IF EXISTS "CV: hochladen nur eigene" ON storage.objects;
DROP POLICY IF EXISTS "CV: ersetzen nur eigene" ON storage.objects;
DROP POLICY IF EXISTS "CV: löschen nur eigene" ON storage.objects;

CREATE POLICY "CV: lesen nur eigene" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'cv-documents' AND public.can_access_cv_object(name));

CREATE POLICY "CV: hochladen nur eigene" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cv-documents' AND public.can_access_cv_object(name));

CREATE POLICY "CV: ersetzen nur eigene" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'cv-documents' AND public.can_access_cv_object(name))
  WITH CHECK (bucket_id = 'cv-documents' AND public.can_access_cv_object(name));

CREATE POLICY "CV: löschen nur eigene" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'cv-documents' AND public.can_access_cv_object(name));
