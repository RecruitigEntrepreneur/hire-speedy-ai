-- ─────────────────────────────────────────────────────────────────────────────
-- Repair: active_count in recruiter_trust_levels wird nicht gepflegt
--
-- Befund (2026-07-19): Live-DB hat 5 Zeilen in recruiter_job_activations,
-- aber recruiter_trust_levels.active_count = 0 → das Slot-Limit greift nie.
-- Ursache: Tabellen wurden vermutlich über 20260302185119 (ohne Trigger)
-- angelegt; der Trigger aus 20260302160000 fehlt in der Live-DB.
--
-- Dieses Skript ist idempotent: Funktionen/Trigger werden neu erstellt,
-- danach werden alle Zähler aus den echten Daten zurückgerechnet.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Sicherstellen, dass die Helper-Funktion existiert
CREATE OR REPLACE FUNCTION public.ensure_trust_level_exists(p_recruiter_id UUID)
RETURNS public.recruiter_trust_levels
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.recruiter_trust_levels;
BEGIN
  SELECT * INTO v_row FROM public.recruiter_trust_levels
    WHERE recruiter_id = p_recruiter_id;

  IF NOT FOUND THEN
    INSERT INTO public.recruiter_trust_levels (recruiter_id)
    VALUES (p_recruiter_id)
    ON CONFLICT (recruiter_id) DO NOTHING;
    SELECT * INTO v_row FROM public.recruiter_trust_levels
      WHERE recruiter_id = p_recruiter_id;
  END IF;

  RETURN v_row;
END;
$$;

-- 2. Aktivierungs-Trigger (Zähler hochzählen) neu erstellen
CREATE OR REPLACE FUNCTION public.on_job_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_trust_level_exists(NEW.recruiter_id);

  UPDATE public.recruiter_trust_levels
  SET total_activations = COALESCE(total_activations, 0) + 1,
      active_count = COALESCE(active_count, 0) + 1,
      activation_ratio = COALESCE(activations_with_submission, 0)::numeric
                         / GREATEST(COALESCE(total_activations, 0) + 1, 1),
      updated_at = NOW()
  WHERE recruiter_id = NEW.recruiter_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_job_activation ON public.recruiter_job_activations;
CREATE TRIGGER trg_on_job_activation
  AFTER INSERT ON public.recruiter_job_activations
  FOR EACH ROW
  EXECUTE FUNCTION public.on_job_activation();

-- 3. Gegenstück für spätere "Suche beenden"-Funktion (Phase D):
--    Beim Löschen einer Aktivierung wird der Slot wieder frei.
--    total_activations bleibt bewusst stehen (Aktivierungsquote = Historie).
CREATE OR REPLACE FUNCTION public.on_job_activation_removed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.recruiter_trust_levels
  SET active_count = GREATEST(COALESCE(active_count, 0) - 1, 0),
      updated_at = NOW()
  WHERE recruiter_id = OLD.recruiter_id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_job_activation_removed ON public.recruiter_job_activations;
CREATE TRIGGER trg_on_job_activation_removed
  AFTER DELETE ON public.recruiter_job_activations
  FOR EACH ROW
  EXECUTE FUNCTION public.on_job_activation_removed();

-- 4. Backfill: Zähler aus den echten Aktivierungen zurückrechnen
INSERT INTO public.recruiter_trust_levels (recruiter_id)
SELECT DISTINCT a.recruiter_id
FROM public.recruiter_job_activations a
ON CONFLICT (recruiter_id) DO NOTHING;

UPDATE public.recruiter_trust_levels t
SET active_count = s.cnt,
    total_activations = GREATEST(COALESCE(t.total_activations, 0), s.cnt),
    activations_with_submission = GREATEST(COALESCE(t.activations_with_submission, 0), s.with_sub),
    activation_ratio = CASE
      WHEN GREATEST(COALESCE(t.total_activations, 0), s.cnt) > 0
      THEN GREATEST(COALESCE(t.activations_with_submission, 0), s.with_sub)::numeric
           / GREATEST(COALESCE(t.total_activations, 0), s.cnt)
      ELSE 0
    END,
    updated_at = NOW()
FROM (
  SELECT recruiter_id,
         COUNT(*) AS cnt,
         COUNT(*) FILTER (WHERE has_submitted) AS with_sub
  FROM public.recruiter_job_activations
  GROUP BY recruiter_id
) s
WHERE t.recruiter_id = s.recruiter_id;
