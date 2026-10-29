-- Aufgaben des Headhunters (28.10.2026): Stand der Stelle zu seinen eigenen Einreichungen.
-- recruiter_jobs_view zeigt nur veröffentlichte Stellen. Damit „Kunde prüft“ bei einer
-- besetzten, geschlossenen oder pausierten Stelle nicht den Kunden erinnert, liest der
-- Headhunter hier Status, Titel und Branche der Stellen seiner Einreichungen; den Firmennamen nur,
-- wenn die Firma für diese Einreichung aufgedeckt ist.
-- „In Prüfung“ (29.10.2026): ob das Kundenteam das Profil geöffnet hat, aus dem vorhandenen
-- Zugriffsprotokoll (log_candidate_access → activity_logs), ohne Matchunt-Admins: erstes und
-- letztes Öffnen und wie oft. Welche Person geöffnet hat, sieht der Headhunter nicht.
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_action ON public.activity_logs (entity_id, action);

DROP FUNCTION IF EXISTS public.my_submission_jobs(uuid[]);
CREATE OR REPLACE FUNCTION public.my_submission_jobs(p_submission_ids uuid[])
RETURNS TABLE (
  submission_id uuid, job_id uuid, job_status text, job_title text, job_industry text, company_name text,
  closed_at timestamptz, paused_at timestamptz, pause_until timestamptz,
  client_first_viewed_at timestamptz, client_last_viewed_at timestamptz, client_view_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, j.id, j.status, j.title, j.industry,
         CASE WHEN s.company_revealed THEN j.company_name END,
         j.closed_at, j.paused_at, j.pause_until,
         v.first_at, v.last_at, COALESCE(v.n, 0)::integer
  FROM public.submissions s
  JOIN public.jobs j ON j.id = s.job_id
  LEFT JOIN LATERAL (
    SELECT min(a.created_at) AS first_at, max(a.created_at) AS last_at, count(*) AS n
    FROM public.activity_logs a
    WHERE a.entity_id = s.id
      AND a.action = 'candidate_profile_viewed'
      AND NOT public.has_role(a.user_id, 'admin')
  ) v ON true
  WHERE s.recruiter_id = auth.uid()
    AND s.id = ANY(p_submission_ids);
$$;
REVOKE ALL ON FUNCTION public.my_submission_jobs(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_submission_jobs(uuid[]) TO authenticated;
