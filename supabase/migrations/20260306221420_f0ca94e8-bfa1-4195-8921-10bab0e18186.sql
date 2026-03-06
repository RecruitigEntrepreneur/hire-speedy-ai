
-- Auto-trigger: Bei neuer Submission automatisch Fit Assessment generieren via pg_net
CREATE OR REPLACE FUNCTION public.trigger_generate_fit_assessment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_url TEXT;
  v_service_key TEXT;
BEGIN
  v_url := current_setting('app.settings.supabase_url', true);
  v_service_key := current_setting('app.settings.service_role_key', true);

  IF v_url IS NULL OR v_service_key IS NULL THEN
    RAISE WARNING 'trigger_generate_fit_assessment: missing app.settings.supabase_url or service_role_key';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/assess-candidate-fit',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := jsonb_build_object('submissionId', NEW.id)
  );

  RETURN NEW;
END;
$function$;

-- Trigger auf submissions
DROP TRIGGER IF EXISTS trg_generate_fit_assessment ON public.submissions;
CREATE TRIGGER trg_generate_fit_assessment
  AFTER INSERT ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_generate_fit_assessment();
