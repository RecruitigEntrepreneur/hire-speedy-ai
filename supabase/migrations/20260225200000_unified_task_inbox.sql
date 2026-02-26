-- ============================================================================
-- Unified Task Inbox: Schema Extensions, Dedup, Cron, VIEW
-- Enables the Intelligent Task Center with unified alerts + manual tasks
-- ============================================================================

-- ─── 1. Enable Extensions ────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ─── 2. Schema Extensions: influence_alerts ──────────────────────────────────
ALTER TABLE public.influence_alerts
  ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS impact_score INTEGER DEFAULT 50;

-- ─── 3. Schema Extensions: recruiter_tasks ───────────────────────────────────
ALTER TABLE public.recruiter_tasks
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'
    CHECK (source IN ('manual', 'system', 'sequence', 'sla'));

ALTER TABLE public.recruiter_tasks
  ADD COLUMN IF NOT EXISTS related_alert_id UUID REFERENCES public.influence_alerts(id) ON DELETE SET NULL;

ALTER TABLE public.recruiter_tasks
  ADD COLUMN IF NOT EXISTS playbook_id UUID REFERENCES public.coaching_playbooks(id) ON DELETE SET NULL;

-- ─── 4. Cleanup: Remove Duplicate Active Alerts ──────────────────────────────
-- Keep only the newest alert per (submission_id, alert_type) among active ones
DELETE FROM public.influence_alerts a
USING public.influence_alerts b
WHERE a.submission_id = b.submission_id
  AND a.alert_type = b.alert_type
  AND a.created_at < b.created_at
  AND a.action_taken IS NULL
  AND a.is_dismissed = false
  AND b.action_taken IS NULL
  AND b.is_dismissed = false;

-- ─── 5. Partial UNIQUE Index (prevents future duplicates) ────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_influence_alerts_active_unique
  ON public.influence_alerts (submission_id, alert_type)
  WHERE action_taken IS NULL AND is_dismissed = false;

-- ─── 6. Unified Task Inbox VIEW ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.unified_task_inbox AS

-- System-generated alerts
SELECT
  'alert'::TEXT AS item_type,
  ia.id AS item_id,
  ia.recruiter_id,
  ia.title,
  ia.message AS description,
  ia.recommended_action,
  ia.alert_type AS task_category,
  CASE ia.priority
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    ELSE 4
  END AS sort_priority,
  ia.priority,
  ia.submission_id,
  s.candidate_id,
  s.job_id,
  ia.playbook_id,
  ia.created_at,
  ia.expires_at AS due_at,
  ia.is_read,
  ia.is_dismissed AS is_archived,
  (ia.action_taken IS NOT NULL) AS is_completed,
  ia.action_taken_at AS completed_at,
  ia.snoozed_until,
  ia.impact_score,
  -- Kontext für UI
  c.full_name AS candidate_name,
  c.phone AS candidate_phone,
  c.email AS candidate_email,
  j.title AS job_title,
  j.company_name
FROM public.influence_alerts ia
LEFT JOIN public.submissions s ON s.id = ia.submission_id
LEFT JOIN public.candidates c ON c.id = s.candidate_id
LEFT JOIN public.jobs j ON j.id = s.job_id

UNION ALL

-- Manual recruiter tasks
SELECT
  'task'::TEXT AS item_type,
  rt.id AS item_id,
  rt.recruiter_id,
  rt.title,
  rt.description,
  NULL::TEXT AS recommended_action,
  rt.task_type AS task_category,
  CASE rt.priority
    WHEN 'urgent' THEN 1
    WHEN 'high' THEN 2
    WHEN 'normal' THEN 3
    ELSE 4
  END AS sort_priority,
  CASE rt.priority
    WHEN 'urgent' THEN 'critical'
    WHEN 'high' THEN 'high'
    WHEN 'normal' THEN 'medium'
    ELSE 'low'
  END AS priority,
  rt.submission_id,
  rt.candidate_id,
  rt.job_id,
  rt.playbook_id,
  rt.created_at,
  rt.due_at,
  false AS is_read,
  (rt.status = 'cancelled') AS is_archived,
  (rt.status = 'completed') AS is_completed,
  rt.completed_at,
  NULL::TIMESTAMPTZ AS snoozed_until,
  50 AS impact_score,
  -- Kontext
  c.full_name AS candidate_name,
  c.phone AS candidate_phone,
  c.email AS candidate_email,
  j.title AS job_title,
  j.company_name
FROM public.recruiter_tasks rt
LEFT JOIN public.candidates c ON c.id = rt.candidate_id
LEFT JOIN public.jobs j ON j.id = rt.job_id;

-- ─── 7. Enable Realtime for recruiter_tasks ──────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.recruiter_tasks;

-- ─── 8. pg_cron Jobs ─────────────────────────────────────────────────────────

-- 8a. Influence Engine: every 15 minutes
SELECT cron.schedule(
  'influence-engine-run',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/influence-engine',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 8b. Escalation Engine: every 5 minutes
SELECT cron.schedule(
  'escalation-engine-run',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/escalation-engine',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 8c. Influence Score Calculation: hourly
SELECT cron.schedule(
  'influence-score-calc',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/calculate-influence-score',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 8d. Cleanup expired/snoozed alerts: daily at 03:00 UTC
SELECT cron.schedule(
  'cleanup-expired-alerts',
  '0 3 * * *',
  $$
  UPDATE public.influence_alerts
  SET is_dismissed = true
  WHERE expires_at IS NOT NULL
    AND expires_at < now()
    AND is_dismissed = false
    AND action_taken IS NULL;
  $$
);
