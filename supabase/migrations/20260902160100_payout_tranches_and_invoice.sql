-- ============================================================================
-- Vom Auftrag zum Placement zur Auszahlung (2/2)
-- ----------------------------------------------------------------------------
-- 20260902100300 legte recruiter_payout_tranches an, aber niemand erzeugte
-- welche. Dasselbe bei invoices: die Tabelle existiert seit 20251204182100 und
-- wurde nie befuellt.
--
-- Beides entsteht jetzt automatisch aus dem Placement -- nicht, weil Automatik
-- schoener ist, sondern weil eine von Hand eingetragene Zahl eine weitere
-- Quelle waere, die von der vereinbarten abweichen kann.
--
-- Wann was entsteht:
--   Placement mit Betraegen  -> Tranche 'initial', faellig nach Zahlungseingang
--                            -> Tranche 'retention', faellig nach Fristablauf
--   Claim anerkannt          -> 'retention' verfaellt
--   Ersatzsuche erfolgreich  -> Tranche 'research_bounty' fuer den Sucher
--   Rechnung bezahlt         -> Tranchen werden faellig
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) Tranchen aus dem Placement
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.placements_create_tranches()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE
  v_recruiter uuid;
BEGIN
  -- Ohne Betraege gibt es nichts auszuzahlen.
  IF NEW.client_fee_cents IS NULL OR NEW.pricing_snapshot IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT recruiter_id INTO v_recruiter
    FROM public.submissions WHERE id = NEW.submission_id;
  IF v_recruiter IS NULL THEN
    RETURN NULL;   -- Kein Recruiter -- Direktbesetzung o. Ae.
  END IF;

  -- Initialtranche. ON CONFLICT DO NOTHING macht den Trigger wiederholbar:
  -- er laeuft bei jedem Update, soll aber nur einmal anlegen.
  IF coalesce(NEW.recruiter_initial_cents, 0) > 0 THEN
    INSERT INTO public.recruiter_payout_tranches
      (placement_id, recruiter_id, tranche_type, amount_cents, due_condition)
    VALUES (NEW.id, v_recruiter, 'initial', NEW.recruiter_initial_cents,
            'nach vollständigem Zahlungseingang des Kunden')
    ON CONFLICT (placement_id, recruiter_id, tranche_type) DO NOTHING;
  END IF;

  -- Einbehalt. Nur bei einem Paket mit Continuity-Leistung.
  IF coalesce(NEW.recruiter_retention_cents, 0) > 0 THEN
    INSERT INTO public.recruiter_payout_tranches
      (placement_id, recruiter_id, tranche_type, amount_cents, due_condition, due_date)
    VALUES (NEW.id, v_recruiter, 'retention', NEW.recruiter_retention_cents,
            'nach Ablauf von Continuity-Zeitraum und Meldefrist',
            NEW.retention_release_date)
    ON CONFLICT (placement_id, recruiter_id, tranche_type)
      DO UPDATE SET due_date = EXCLUDED.due_date
      WHERE public.recruiter_payout_tranches.status = 'pending';
  END IF;

  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_placements_tranches ON public.placements;
CREATE TRIGGER trg_placements_tranches
  AFTER INSERT OR UPDATE ON public.placements
  FOR EACH ROW EXECUTE FUNCTION public.placements_create_tranches();

COMMENT ON FUNCTION public.placements_create_tranches() IS
  'Legt die Auszahlungstranchen des Recruiters an, sobald das Placement seine '
  'Betraege kennt. Wiederholbar: ON CONFLICT DO NOTHING, damit der Trigger bei '
  'jedem Update laufen darf, ohne zu verdoppeln.';

-- ----------------------------------------------------------------------------
-- 2) Ein anerkannter Fall laesst die Tranche verfallen
-- ----------------------------------------------------------------------------
-- Bisher setzte continuity_claims_apply nur placements.retention_state auf
-- 'forfeited'. Die Tranche selbst blieb auf 'pending' stehen und waere in der
-- Auszahlungsliste weiter aufgetaucht.
CREATE OR REPLACE FUNCTION public.continuity_claims_apply()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    UPDATE public.placements
       SET continuity_state = 'claim_accepted',
           retention_state  = CASE WHEN retention_state = 'released'
                                   THEN retention_state       -- schon ausgezahlt
                                   ELSE 'forfeited' END,
           placement_state  = CASE WHEN placement_state = 'started'
                                   THEN 'ended_early' ELSE placement_state END,
           ended_at         = coalesce(ended_at, NEW.separation_date),
           end_reason       = coalesce(end_reason, NEW.category),
           research_state   = 'running'
     WHERE id = NEW.placement_id;

    -- Und die Tranche mit. Eine verfallene Tranche, die in der Liste weiter
    -- als faellig steht, wuerde frueher oder spaeter ausgezahlt.
    UPDATE public.recruiter_payout_tranches
       SET status = 'forfeited',
           forfeited_at = now(),
           forfeit_reason = 'Continuity-Fall anerkannt (' || NEW.category || ')'
     WHERE placement_id = NEW.placement_id
       AND tranche_type = 'retention'
       AND status IN ('pending', 'due');

  ELSIF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
    UPDATE public.placements
       SET continuity_state = 'claim_rejected'
     WHERE id = NEW.placement_id;

  ELSIF NEW.status IN ('submitted', 'in_review') AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.placements
       SET continuity_state = 'claim_open'
     WHERE id = NEW.placement_id AND continuity_state IN ('running', 'not_applicable');
  END IF;

  RETURN NEW;
END;
$fn$;

-- ----------------------------------------------------------------------------
-- 3) Erfolgreiche Ersatzsuche erzeugt die Auslobung
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.research_assignments_apply()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE v_recruiter uuid;
BEGIN
  IF NEW.status = 'succeeded' AND OLD.status IS DISTINCT FROM 'succeeded' THEN
    UPDATE public.placements
       SET research_state = 'succeeded'
     WHERE id = NEW.placement_id;

    -- Die Auslobung geht an den, der tatsaechlich gesucht hat -- das kann ein
    -- anderer sein als der urspruengliche Recruiter.
    v_recruiter := coalesce(NEW.assigned_recruiter_id, NEW.original_recruiter_id);
    IF v_recruiter IS NOT NULL THEN
      INSERT INTO public.recruiter_payout_tranches
        (placement_id, recruiter_id, tranche_type, amount_cents, due_condition)
      VALUES (NEW.placement_id, v_recruiter, 'research_bounty', NEW.bounty_cents,
              'nach erfolgreicher Ersatzvermittlung')
      ON CONFLICT (placement_id, recruiter_id, tranche_type) DO NOTHING;
    END IF;

  ELSIF NEW.status IN ('exhausted', 'cancelled') AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.placements SET research_state = NEW.status WHERE id = NEW.placement_id;
  ELSIF NEW.status = 'paused' AND OLD.status <> 'paused' THEN
    UPDATE public.placements SET research_state = 'paused' WHERE id = NEW.placement_id;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_research_apply ON public.research_assignments;
CREATE TRIGGER trg_research_apply
  AFTER UPDATE ON public.research_assignments
  FOR EACH ROW EXECUTE FUNCTION public.research_assignments_apply();

-- ----------------------------------------------------------------------------
-- 4) Bezahlte Rechnung macht die Tranchen faellig
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.placements_invoice_state_changed()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN
  IF NEW.invoice_state = 'paid' AND OLD.invoice_state IS DISTINCT FROM 'paid' THEN
    -- Die Initialtranche wird sofort faellig, der Einbehalt erst zu seinem
    -- Datum -- deshalb bleibt er auf 'pending'.
    UPDATE public.recruiter_payout_tranches
       SET status = 'due'
     WHERE placement_id = NEW.id AND tranche_type = 'initial' AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_placements_invoice_state ON public.placements;
CREATE TRIGGER trg_placements_invoice_state
  AFTER UPDATE OF invoice_state ON public.placements
  FOR EACH ROW EXECUTE FUNCTION public.placements_invoice_state_changed();

COMMIT;
