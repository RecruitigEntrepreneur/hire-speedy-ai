-- ============================================================================
-- Interview-Fenster (06.10.2026)
--
-- 1) Verschieben: Eine Verschiebe-Anfrage verweist auf den gebuchten Termin.
--    Der alte Termin bleibt bestehen, bis der Kandidat eine neue Zeit
--    bestätigt; erst dann wird er ersetzt (superseded_by).
-- 2) Leitfaden: Fragen je Interview (KI aus Stelle + Headhunter-Notiz),
--    bearbeitbar, mit abgehakten Punkten. Schreiben nur über die Edge
--    Function (Service-Role); Lesen wie das Interview selbst.
-- Keine bestehenden Daten werden verändert.
-- ============================================================================
BEGIN;

ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS reschedules_interview_id uuid REFERENCES public.interviews(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guide jsonb,
  ADD COLUMN IF NOT EXISTS guide_generated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_interviews_reschedules
  ON public.interviews (reschedules_interview_id)
  WHERE reschedules_interview_id IS NOT NULL;

COMMENT ON COLUMN public.interviews.reschedules_interview_id IS 'Verschiebe-Anfrage: der gebuchte Termin, der bis zur Bestätigung einer neuen Zeit bestehen bleibt.';
COMMENT ON COLUMN public.interviews.guide IS 'Interview-Leitfaden: { sections: [{ title, items: [{ id, text, hint?, done }] }] }';
COMMENT ON COLUMN public.interviews.guide_generated_at IS 'Wann der Leitfaden erzeugt wurde (KI).';

COMMIT;
