-- Fix log_activity function to handle tables without client_id column
CREATE OR REPLACE FUNCTION public.log_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Start with auth.uid()
    v_user_id := auth.uid();
    
    -- Try recruiter_id if available (most tables have this)
    IF v_user_id IS NULL THEN
      BEGIN
        EXECUTE format('SELECT ($1).recruiter_id') INTO v_user_id USING NEW;
      EXCEPTION WHEN undefined_column THEN
        v_user_id := NULL;
      END;
    END IF;
    
    -- Try client_id only for tables that have it (jobs, feedback, etc. - NOT submissions)
    IF v_user_id IS NULL THEN
      BEGIN
        EXECUTE format('SELECT ($1).client_id') INTO v_user_id USING NEW;
      EXCEPTION WHEN undefined_column THEN
        v_user_id := NULL;
      END;
    END IF;
    
    INSERT INTO public.activity_logs (action, entity_type, entity_id, user_id, details)
    VALUES (
      'created',
      TG_TABLE_NAME,
      NEW.id,
      v_user_id,
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
$function$;