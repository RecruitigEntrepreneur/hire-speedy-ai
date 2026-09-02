-- ============================================================================
-- Behebt: jedes UPDATE auf placements scheitert
-- ----------------------------------------------------------------------------
-- BEFUND (gefunden 2026-09-02 beim Bau der Abrechnungsspur):
--   log_activity haengt als Trigger an interviews, jobs, submissions und
--   placements. Der INSERT-Zweig faengt fehlende Spalten sorgfaeltig ab --
--   recruiter_id und client_id werden je in einem BEGIN/EXCEPTION-Block
--   gelesen. Der UPDATE-Zweig tut das nicht: er liest OLD.status und
--   NEW.status ungeprueft.
--
--   interviews, jobs und submissions haben eine Spalte status. placements hat
--   keine -- dort heisst sie payment_status. Folge: JEDES Update auf
--   placements bricht mit
--     ERROR: record "old" has no field "status"
--   ab. Betroffen ist damit auch "als bezahlt markieren" in AdminPlacements.
--
--   Der Fehler steckt seit 20251212185019 im Code und ist in der letzten
--   Fassung 20260114004153 unveraendert enthalten.
--
-- FIX: Der UPDATE-Zweig liest den Status nach demselben Muster wie der
--   INSERT-Zweig die anderen optionalen Spalten. Fehlt er, wird NULL
--   protokolliert statt abzubrechen. Am Protokollformat aendert sich sonst
--   nichts, damit bestehende Auswertungen weiter passen.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user_id    uuid;
  v_old_status text;
  v_new_status text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_user_id := auth.uid();

    -- recruiter_id, falls die Tabelle sie hat.
    IF v_user_id IS NULL THEN
      BEGIN
        EXECUTE format('SELECT ($1).recruiter_id') INTO v_user_id USING NEW;
      EXCEPTION WHEN undefined_column THEN
        v_user_id := NULL;
      END;
    END IF;

    -- client_id, falls die Tabelle sie hat (jobs, feedback -- nicht submissions).
    IF v_user_id IS NULL THEN
      BEGIN
        EXECUTE format('SELECT ($1).client_id') INTO v_user_id USING NEW;
      EXCEPTION WHEN undefined_column THEN
        v_user_id := NULL;
      END;
    END IF;

    INSERT INTO public.activity_logs (action, entity_type, entity_id, user_id, details)
    VALUES ('created', TG_TABLE_NAME, NEW.id, v_user_id,
            jsonb_build_object('new_data', to_jsonb(NEW)));
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Genau hier lag der Fehler: status wurde ungeprueft gelesen. placements
    -- hat keine solche Spalte, also brach jedes Update ab.
    BEGIN
      EXECUTE format('SELECT (($1).status)::text') INTO v_old_status USING OLD;
      EXECUTE format('SELECT (($1).status)::text') INTO v_new_status USING NEW;
    EXCEPTION WHEN undefined_column THEN
      v_old_status := NULL;
      v_new_status := NULL;
    END;

    INSERT INTO public.activity_logs (action, entity_type, entity_id, user_id, details)
    VALUES ('updated', TG_TABLE_NAME, NEW.id, auth.uid(),
            jsonb_build_object(
              'old_status', v_old_status,
              'new_status', v_new_status,
              'changes', jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
            ));
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.activity_logs (action, entity_type, entity_id, user_id, details)
    VALUES ('deleted', TG_TABLE_NAME, OLD.id, auth.uid(),
            jsonb_build_object('deleted_data', to_jsonb(OLD)));
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$fn$;

COMMENT ON FUNCTION public.log_activity() IS
  'Protokolliert Aenderungen an interviews, jobs, submissions und placements. '
  'Liest status nur, wenn die Tabelle ihn hat -- placements fuehrt stattdessen '
  'payment_status, und der ungepruefte Zugriff liess dort seit 20251212185019 '
  'jedes Update scheitern.';

COMMIT;