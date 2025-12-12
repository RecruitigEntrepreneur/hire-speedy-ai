-- Phase 2: Activity Logging Triggers

-- Function to log activity
CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs (action, entity_type, entity_id, user_id, details)
    VALUES (
      'created',
      TG_TABLE_NAME,
      NEW.id,
      COALESCE(auth.uid(), NEW.recruiter_id, NEW.client_id),
      jsonb_build_object('new_data', to_jsonb(NEW))
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.activity_logs (action, entity_type, entity_id, user_id, details)
    VALUES (
      'updated',
      TG_TABLE_NAME,
      NEW.id,
      auth.uid(),
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'changes', jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.activity_logs (action, entity_type, entity_id, user_id, details)
    VALUES (
      'deleted',
      TG_TABLE_NAME,
      OLD.id,
      auth.uid(),
      jsonb_build_object('deleted_data', to_jsonb(OLD))
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for jobs table
DROP TRIGGER IF EXISTS jobs_activity_log ON public.jobs;
CREATE TRIGGER jobs_activity_log
  AFTER INSERT OR UPDATE OR DELETE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- Trigger for submissions table  
DROP TRIGGER IF EXISTS submissions_activity_log ON public.submissions;
CREATE TRIGGER submissions_activity_log
  AFTER INSERT OR UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- Trigger for placements table
DROP TRIGGER IF EXISTS placements_activity_log ON public.placements;
CREATE TRIGGER placements_activity_log
  AFTER INSERT OR UPDATE ON public.placements
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- Trigger for interviews table
DROP TRIGGER IF EXISTS interviews_activity_log ON public.interviews;
CREATE TRIGGER interviews_activity_log
  AFTER INSERT OR UPDATE ON public.interviews
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();

-- Function to log user registration and verification
CREATE OR REPLACE FUNCTION public.log_user_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs (action, entity_type, entity_id, user_id, details)
    VALUES (
      'registered',
      'user',
      NEW.user_id,
      NEW.user_id,
      jsonb_build_object('role', NEW.role)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND OLD.verified IS DISTINCT FROM NEW.verified THEN
    INSERT INTO public.activity_logs (action, entity_type, entity_id, user_id, details)
    VALUES (
      CASE WHEN NEW.verified THEN 'verified' ELSE 'unverified' END,
      'user',
      NEW.user_id,
      auth.uid(),
      jsonb_build_object('role', NEW.role, 'verified', NEW.verified)
    );
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for user_roles table
DROP TRIGGER IF EXISTS user_roles_activity_log ON public.user_roles;
CREATE TRIGGER user_roles_activity_log
  AFTER INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_user_activity();

-- Update RLS policy to allow system inserts
DROP POLICY IF EXISTS "System can insert logs" ON public.activity_logs;
CREATE POLICY "System can insert logs" 
ON public.activity_logs 
FOR INSERT 
WITH CHECK (true);