-- ============================================================================
-- Anzeige & Ansprache: Entwürfe zur Prüfung durch Matchunt (29.09.2026)
--
-- format-job-for-recruiters schreibt die neue Anzeige samt Kurzansprachen mit
-- entwurf: true hierher statt live in jobs.formatted_content. Matchunt sieht
-- sie im Freigabe-Dialog bzw. in Admin > Jobs, kann neu erzeugen oder
-- bearbeiten und übernimmt sie dann selbst in formatted_content.
--
-- Eigene Tabelle statt Spalte an jobs: die Prüfung enthält den Firmennamen
-- (gefundene Begriffe), und jobs-Zeilen liest auch der Kunde. Hier lesen und
-- schreiben nur Admins; die Function arbeitet mit der Service-Role.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.job_recruiter_text_drafts (
  job_id     uuid PRIMARY KEY REFERENCES public.jobs(id) ON DELETE CASCADE,
  content    jsonb NOT NULL,
  pruefung   jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.job_recruiter_text_drafts IS
  'Entwurf von Anzeige & Ansprache (formatted_content) je Stelle, bis Matchunt ihn übernimmt. Nur Admins.';

ALTER TABLE public.job_recruiter_text_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins verwalten Anzeige-Entwürfe" ON public.job_recruiter_text_drafts;
CREATE POLICY "Admins verwalten Anzeige-Entwürfe" ON public.job_recruiter_text_drafts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

COMMIT;
