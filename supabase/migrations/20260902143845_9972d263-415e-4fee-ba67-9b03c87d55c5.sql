BEGIN;

CREATE OR REPLACE FUNCTION public.placements_derive()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE
  s          jsonb;
  grundlage  numeric;
  cont_days  integer;
  notice     integer;
  m          public.commercial_mandates%ROWTYPE;
BEGIN
  -- ---- (0) Den Auftrag finden, wenn er nicht mitgegeben wurde --------------
  IF NEW.mandate_id IS NULL AND NEW.submission_id IS NOT NULL THEN
    SELECT j.mandate_id INTO NEW.mandate_id
      FROM public.submissions sub
      JOIN public.jobs j ON j.id = sub.job_id
     WHERE sub.id = NEW.submission_id;
  END IF;

  IF NEW.mandate_id IS NOT NULL AND NEW.pricing_snapshot IS NULL THEN
    SELECT * INTO m FROM public.commercial_mandates WHERE id = NEW.mandate_id;
    IF FOUND AND m.pricing_snapshot IS NOT NULL THEN
      NEW.package_key      := m.package_key;
      NEW.package_version  := m.package_version;
      NEW.pricing_snapshot := m.pricing_snapshot;
    END IF;
  END IF;

  IF NEW.gross_annual_target_compensation_cents IS NULL
     AND NEW.agreed_salary IS NOT NULL AND NEW.agreed_salary > 0 THEN
    NEW.gross_annual_target_compensation_cents := NEW.agreed_salary::bigint * 100;
    IF NEW.compensation_verified_at IS NULL THEN
      NULL;
    END IF;
  END IF;

  s := NEW.pricing_snapshot;
  IF s IS NULL THEN
    RETURN NEW;   -- Bestandsplacement ohne Paket -- unveraendert durchlassen.
  END IF;

  cont_days := nullif(s->>'continuityDays', '')::integer;
  notice    := coalesce(nullif(s->>'claimNoticeDays', '')::integer, 14);

  IF NEW.first_working_day IS NULL AND NEW.start_date IS NOT NULL THEN
    NEW.first_working_day := NEW.start_date;
  END IF;

  IF NEW.first_working_day IS NOT NULL AND cont_days IS NOT NULL THEN
    NEW.continuity_end_date    := NEW.first_working_day + cont_days;
    NEW.retention_release_date := NEW.first_working_day + cont_days + notice;
  ELSIF cont_days IS NULL THEN
    NEW.continuity_end_date    := NULL;
    NEW.retention_release_date := NULL;
  END IF;

  IF NEW.gross_annual_target_compensation_cents IS NOT NULL THEN
    grundlage := NEW.gross_annual_target_compensation_cents::numeric;
    NEW.client_fee_cents          := round(grundlage * (s->>'clientFeePct')::numeric / 100);
    NEW.recruiter_initial_cents   := round(grundlage * (s->>'recruiterInitialPct')::numeric / 100);
    NEW.recruiter_retention_cents := round(grundlage * (s->>'recruiterRetentionPct')::numeric / 100);
    NEW.matchunt_cents := NEW.client_fee_cents
                        - NEW.recruiter_initial_cents
                        - NEW.recruiter_retention_cents;

    NEW.total_fee        := round(NEW.client_fee_cents::numeric / 100, 2);
    NEW.platform_fee     := round(NEW.matchunt_cents::numeric / 100, 2);
    NEW.recruiter_payout := round((NEW.recruiter_initial_cents
                                 + NEW.recruiter_retention_cents)::numeric / 100, 2);
  END IF;

  IF cont_days IS NULL THEN
    NEW.continuity_state := 'not_applicable';
    IF coalesce(NEW.recruiter_retention_cents, 0) = 0 THEN
      NEW.retention_state := 'not_applicable';
    END IF;
  ELSIF NEW.placement_state = 'started' AND NEW.continuity_state = 'not_applicable' THEN
    NEW.continuity_state := 'running';
    IF NEW.retention_state = 'not_applicable' THEN
      NEW.retention_state := 'withheld';
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.placements_derive() IS
  'Holt Paket und Preis-Snapshot ueber submission -> job -> mandate und rechnet daraus Fristen und Betraege.';

COMMIT;