-- Kandidateninterview: eingeworfene Quellen (eigene Notizen, Transkripte,
-- Fotos, Mails, Schnellerfassung, Live-Notiz) je Kandidat. Die Akte bleibt die
-- Wahrheit; die Quelle ist der Beleg, aus dem ein Wert stammt.
--
-- Datensparsamkeit: Rohtexte von Transkripten (Aufzeichnungen des Kandidaten)
-- werden nach 30 Tagen gelöscht, eigene Notizen nach 12 Monaten. Die Zeile
-- bleibt als Verlaufseintrag (Art, Datum, Einwilligung) ohne Rohtext erhalten.

CREATE TABLE IF NOT EXISTS public.candidate_capture_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  recruiter_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('notes', 'transcript', 'photo', 'mail', 'quick', 'live')),
  label text,
  raw_text text,
  -- Nur bei Transkripten: Kandidat hat der Aufzeichnung zugestimmt (§ 201 StGB)
  recording_consent boolean,
  suggestions_total integer,
  suggestions_accepted integer,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capture_sources_candidate ON public.candidate_capture_sources (candidate_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_capture_sources TO authenticated;
GRANT ALL ON public.candidate_capture_sources TO service_role;

ALTER TABLE public.candidate_capture_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recruiters manage own capture sources" ON public.candidate_capture_sources;
CREATE POLICY "Recruiters manage own capture sources"
  ON public.candidate_capture_sources FOR ALL
  USING (auth.uid() = recruiter_id)
  WITH CHECK (
    auth.uid() = recruiter_id
    AND EXISTS (SELECT 1 FROM public.candidates c WHERE c.id = candidate_id AND c.recruiter_id = auth.uid())
    AND (kind <> 'transcript' OR recording_consent IS TRUE)
  );

DROP POLICY IF EXISTS "Admins manage all capture sources" ON public.candidate_capture_sources;
CREATE POLICY "Admins manage all capture sources"
  ON public.candidate_capture_sources FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Rohtext löschen, sobald die Frist abgelaufen ist (reines SQL, keine App-Settings nötig)
CREATE OR REPLACE FUNCTION public.purge_expired_capture_sources()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH purged AS (
    UPDATE public.candidate_capture_sources
    SET raw_text = NULL
    WHERE raw_text IS NOT NULL AND expires_at IS NOT NULL AND expires_at < now()
    RETURNING 1
  )
  SELECT count(*)::integer FROM purged;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('capture-sources-purge') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'capture-sources-purge');
    PERFORM cron.schedule('capture-sources-purge', '20 3 * * *', 'select public.purge_expired_capture_sources()');
  END IF;
END $$;

COMMENT ON TABLE public.candidate_capture_sources IS 'Eingeworfene Interview-Quellen je Kandidat; Rohtext mit Ablaufdatum (Transkripte 30 Tage, Notizen 12 Monate).';