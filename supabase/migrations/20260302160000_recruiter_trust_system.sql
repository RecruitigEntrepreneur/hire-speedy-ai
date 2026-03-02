-- ============================================================================
-- RECRUITER TRUST SYSTEM
-- Tables, triggers, functions, RLS policies for the Trust-Gate activation flow
-- ============================================================================

-- ─── 1. recruiter_trust_levels ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.recruiter_trust_levels (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id                UUID NOT NULL UNIQUE,
  trust_level                 TEXT NOT NULL DEFAULT 'bronze'
                                CHECK (trust_level IN ('bronze', 'silver', 'gold', 'suspended')),
  -- Metrics (updated by recalculate function)
  placements_hired            INTEGER DEFAULT 0,
  total_activations           INTEGER DEFAULT 0,
  activations_with_submission INTEGER DEFAULT 0,
  activation_ratio            NUMERIC(5,2) DEFAULT 0,
  active_count                INTEGER DEFAULT 0,
  max_active_slots            INTEGER DEFAULT 5,
  -- Level history
  previous_level              TEXT,
  level_changed_at            TIMESTAMPTZ,
  suspended_at                TIMESTAMPTZ,
  suspended_reason            TEXT,
  -- Timestamps
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trust_levels_recruiter ON public.recruiter_trust_levels(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_trust_levels_level ON public.recruiter_trust_levels(trust_level);

-- ─── 2. recruiter_job_activations ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.recruiter_job_activations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id        UUID NOT NULL,
  job_id              UUID NOT NULL,
  trust_level_at      TEXT NOT NULL,
  activated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_submission_at TIMESTAMPTZ,
  has_submitted       BOOLEAN DEFAULT false,
  UNIQUE(recruiter_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_activations_recruiter ON public.recruiter_job_activations(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_activations_job ON public.recruiter_job_activations(job_id);
CREATE INDEX IF NOT EXISTS idx_activations_submitted ON public.recruiter_job_activations(recruiter_id, has_submitted);

-- ─── 3. RLS Policies ────────────────────────────────────────────────────────

ALTER TABLE public.recruiter_trust_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiter_job_activations ENABLE ROW LEVEL SECURITY;

-- Trust levels: recruiter sees own, admin sees all
CREATE POLICY "Recruiters can view own trust level"
  ON public.recruiter_trust_levels FOR SELECT
  USING (auth.uid() = recruiter_id);

CREATE POLICY "Admins can manage all trust levels"
  ON public.recruiter_trust_levels FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- System can insert/update trust levels (for triggers/functions)
CREATE POLICY "System can manage trust levels"
  ON public.recruiter_trust_levels FOR ALL
  USING (true)
  WITH CHECK (true);

-- Activations: recruiter manages own, admin sees all
CREATE POLICY "Recruiters can view own activations"
  ON public.recruiter_job_activations FOR SELECT
  USING (auth.uid() = recruiter_id);

CREATE POLICY "Recruiters can insert own activations"
  ON public.recruiter_job_activations FOR INSERT
  WITH CHECK (auth.uid() = recruiter_id);

CREATE POLICY "Admins can manage all activations"
  ON public.recruiter_job_activations FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- System can update activations (for triggers)
CREATE POLICY "System can update activations"
  ON public.recruiter_job_activations FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ─── 4. Ensure trust level row exists ───────────────────────────────────────

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
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END;
$$;

-- ─── 5. Mark activation as submitted (trigger on submissions insert) ────────

CREATE OR REPLACE FUNCTION public.mark_activation_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark the activation for this job as submitted
  UPDATE public.recruiter_job_activations
  SET has_submitted = true,
      first_submission_at = COALESCE(first_submission_at, NOW())
  WHERE recruiter_id = NEW.recruiter_id
    AND job_id = NEW.job_id
    AND has_submitted = false;

  -- If a row was updated, increment the trust level counters
  IF FOUND THEN
    UPDATE public.recruiter_trust_levels
    SET activations_with_submission = activations_with_submission + 1,
        activation_ratio = (activations_with_submission + 1)::numeric
                           / GREATEST(total_activations, 1),
        updated_at = NOW()
    WHERE recruiter_id = NEW.recruiter_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop if exists to avoid conflicts, then create
DROP TRIGGER IF EXISTS trg_mark_activation_submitted ON public.submissions;
CREATE TRIGGER trg_mark_activation_submitted
  AFTER INSERT ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_activation_submitted();

-- ─── 6. Recalculate trust level ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.recalculate_trust_level(p_recruiter_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_placements INTEGER;
  v_influence NUMERIC;
  v_risk NUMERIC;
  v_ratio NUMERIC;
  v_total_activations INTEGER;
  v_critical_frauds INTEGER;
  v_current TEXT;
  v_new TEXT;
BEGIN
  -- Ensure row exists
  PERFORM public.ensure_trust_level_exists(p_recruiter_id);

  -- Count total hired placements from submissions
  SELECT COUNT(*) INTO v_placements
    FROM public.submissions
    WHERE recruiter_id = p_recruiter_id AND status = 'hired';

  -- Get influence score (default 50 if not found)
  SELECT COALESCE(influence_score, 50) INTO v_influence
    FROM public.recruiter_influence_scores
    WHERE recruiter_id = p_recruiter_id;
  IF NOT FOUND THEN v_influence := 50; END IF;

  -- Get risk score (default 0 if not found)
  SELECT COALESCE(risk_score, 0) INTO v_risk
    FROM public.user_behavior_scores
    WHERE user_id = p_recruiter_id;
  IF NOT FOUND THEN v_risk := 0; END IF;

  -- Get current trust level data
  SELECT trust_level, activation_ratio, total_activations
    INTO v_current, v_ratio, v_total_activations
    FROM public.recruiter_trust_levels
    WHERE recruiter_id = p_recruiter_id;

  -- Count confirmed critical fraud signals
  SELECT COUNT(*) INTO v_critical_frauds
    FROM public.fraud_signals
    WHERE user_id = p_recruiter_id
      AND severity = 'critical'
      AND status = 'confirmed';

  -- Determine new level
  -- Suspended: Bronze + bad ratio after enough activations, or critical fraud
  IF v_critical_frauds > 0 THEN
    v_new := 'suspended';
  ELSIF v_current = 'bronze' AND v_total_activations >= 5 AND v_ratio < 0.2 THEN
    v_new := 'suspended';
  -- Gold
  ELSIF v_placements >= 10 AND v_influence >= 60
        AND v_risk < 30 AND v_ratio >= 0.6
        AND v_critical_frauds = 0 THEN
    v_new := 'gold';
  -- Silver
  ELSIF v_placements >= 3 AND v_influence >= 40
        AND v_risk < 50 AND v_ratio >= 0.5 THEN
    v_new := 'silver';
  -- Bronze (default)
  ELSE
    v_new := 'bronze';
  END IF;

  -- Don't downgrade from suspended except by admin
  IF v_current = 'suspended' AND v_new != 'suspended' THEN
    v_new := 'suspended';
  END IF;

  -- Update placements count always
  UPDATE public.recruiter_trust_levels
  SET placements_hired = v_placements,
      updated_at = NOW()
  WHERE recruiter_id = p_recruiter_id;

  -- Update level only if changed
  IF v_new != v_current THEN
    UPDATE public.recruiter_trust_levels
    SET trust_level = v_new,
        previous_level = v_current,
        level_changed_at = NOW(),
        max_active_slots = CASE v_new
          WHEN 'gold' THEN 15
          WHEN 'silver' THEN 10
          WHEN 'bronze' THEN 5
          WHEN 'suspended' THEN 0
        END,
        suspended_at = CASE WHEN v_new = 'suspended' THEN NOW() ELSE NULL END,
        updated_at = NOW()
    WHERE recruiter_id = p_recruiter_id;
  END IF;
END;
$$;

-- ─── 7. Recalculate all trust levels (for cron job) ─────────────────────────

CREATE OR REPLACE FUNCTION public.recalculate_all_trust_levels()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recruiter_id UUID;
BEGIN
  FOR v_recruiter_id IN
    SELECT recruiter_id FROM public.recruiter_trust_levels
  LOOP
    PERFORM public.recalculate_trust_level(v_recruiter_id);
  END LOOP;
END;
$$;

-- ─── 8. On activation: increment counters ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.on_job_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure trust level row exists
  PERFORM public.ensure_trust_level_exists(NEW.recruiter_id);

  -- Increment counters
  UPDATE public.recruiter_trust_levels
  SET total_activations = total_activations + 1,
      active_count = active_count + 1,
      activation_ratio = activations_with_submission::numeric
                         / GREATEST(total_activations + 1, 1),
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

-- ─── 9. Bulk activation fraud detection ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_bulk_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_count INTEGER;
BEGIN
  -- Count activations in last hour
  SELECT COUNT(*) INTO v_recent_count
    FROM public.recruiter_job_activations
    WHERE recruiter_id = NEW.recruiter_id
      AND activated_at > NOW() - INTERVAL '1 hour';

  -- If more than 5 in an hour, flag it
  IF v_recent_count > 5 THEN
    INSERT INTO public.fraud_signals (
      signal_type, severity, confidence_score,
      user_id, job_id, details, status
    ) VALUES (
      'bulk_activation', 'high', 85,
      NEW.recruiter_id, NEW.job_id,
      jsonb_build_object(
        'activations_in_last_hour', v_recent_count,
        'message', 'Recruiter activated more than 5 jobs in 1 hour'
      ),
      'pending'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_bulk_activation ON public.recruiter_job_activations;
CREATE TRIGGER trg_check_bulk_activation
  AFTER INSERT ON public.recruiter_job_activations
  FOR EACH ROW
  EXECUTE FUNCTION public.check_bulk_activation();
