-- ============================================================================
-- Auto-generate Fit Assessment on Submission INSERT
-- ============================================================================
-- Uses pg_net (already enabled) to fire-and-forget an HTTP call to the
-- assess-candidate-fit Edge Function whenever a new submission is created.
-- This ensures assessments are pre-generated before the client opens the page.
--
-- Follows the same pattern as cron jobs in 20260225200000_unified_task_inbox.sql
-- ============================================================================

-- Function: trigger handler for auto-generating fit assessments
CREATE OR REPLACE FUNCTION public.trigger_generate_fit_assessment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Fire-and-forget: call the Edge Function via pg_net
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/assess-candidate-fit',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('submissionId', NEW.id::text)
  );
  RETURN NEW;
END;
$$;

-- Trigger: fire after every new submission
CREATE TRIGGER trg_generate_fit_assessment
  AFTER INSERT ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_generate_fit_assessment();
