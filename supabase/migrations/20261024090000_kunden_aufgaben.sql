-- Kunden-Aufgaben (23.10.2026): Die Aufgaben selbst leitet die Function client-tasks aus dem
-- Stand ab. Gespeichert werden nur das Erledigt-Protokoll (Fragen, „Erledigt · 7 Tage“) und
-- die zwei neuen Antworten des Kunden: Antritt bestätigen und „Rechnung ist überwiesen“.
-- Schreiben nur über die Function (service_role); das Kundenteam liest das Protokoll seiner Stellen.

CREATE TABLE IF NOT EXISTS public.client_task_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_key text NOT NULL,
  kind text NOT NULL,
  submission_id uuid REFERENCES public.submissions(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  label text NOT NULL,
  answer text,
  note text,
  done_by uuid NOT NULL,
  done_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_task_log_job_idx ON public.client_task_log (job_id, done_at DESC);
CREATE INDEX IF NOT EXISTS client_task_log_key_idx ON public.client_task_log (task_key);
CREATE INDEX IF NOT EXISTS client_task_log_user_idx ON public.client_task_log (done_by, done_at DESC);

ALTER TABLE public.client_task_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Kundenteam liest Aufgaben-Protokoll" ON public.client_task_log;
CREATE POLICY "Kundenteam liest Aufgaben-Protokoll" ON public.client_task_log
  FOR SELECT TO authenticated
  USING (done_by = auth.uid() OR (job_id IS NOT NULL AND public.can_access_job(job_id)));

GRANT SELECT ON public.client_task_log TO authenticated;
GRANT ALL ON public.client_task_log TO service_role;

-- Aufgabe 14: Hat die Person angefangen?
ALTER TABLE public.placements
  ADD COLUMN IF NOT EXISTS start_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS start_confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS non_start_reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS non_start_reported_by uuid,
  ADD COLUMN IF NOT EXISTS non_start_reason text,
  ADD COLUMN IF NOT EXISTS non_start_note text;

-- Aufgabe 15: Kunde meldet „ist überwiesen“ (Hinweis an Matchunt, kein Zahlungsnachweis)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS client_paid_reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_paid_reported_on date,
  ADD COLUMN IF NOT EXISTS client_paid_reported_by uuid;
