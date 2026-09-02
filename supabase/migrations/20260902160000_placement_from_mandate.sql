-- ============================================================================
-- Vom Auftrag zum Placement zur Auszahlung (1/2)
-- ----------------------------------------------------------------------------
-- BEFUND: Zwischen dem Einzelauftrag und der Abrechnung fehlte das Bindeglied.
--   placements bekam Paket und Preis-Snapshot nie zugewiesen -- 20260902100300
--   legte die Spalten an, aber niemand fuellte sie. Der Trigger
--   placements_derive rechnet aus dem Snapshot; ohne Snapshot rechnet er nichts.
--
--   Dazu zwei Fehler im Bestand:
--
--   (a) process-offer-response rechnet die Fee selbst und falsch:
--         totalFee       = Gehalt * jobs.fee_percentage / 100
--         recruiterPayout = totalFee * recruiter_fee / fee
--       Die zweite Zeile nimmt den Recruiter-Anteil als QUOTE DES HONORARS.
--       Bei Continuity 90 waeren das 15/23 von 23.000 = 15.000 statt der
--       vereinbarten 15.000 aus 100.000 -- hier zufaellig gleich, aber nur,
--       weil das Beispiel glatt aufgeht. Bei Core waere es 15/20 von 20.000 =
--       15.000; bei einem Paket mit anderer Struktur laege es daneben.
--       Ausserdem zieht es die Prozentsaetze aus jobs statt aus dem
--       Preis-Snapshot -- also aus Werten, die sich spaeter aendern koennen.
--
--   (b) process-talent-hub-action schreibt beim Wechsel auf "hired" die
--       Spalten job_id, candidate_id, recruiter_id, client_id, status und
--       placement_date nach placements. KEINE davon existiert. Dieser Weg hat
--       noch nie ein Placement angelegt.
--
-- ENTSCHEIDUNG: Das Placement holt sich Paket und Preis-Snapshot selbst --
--   ueber submission -> job -> mandate. Damit ist es gleichgueltig, welcher
--   Weg das Placement anlegt: die Rechnung stimmt in jedem Fall, und sie
--   stimmt mit dem, was der Kunde unterschrieben hat.
--
--   Die Betraege werden NICHT uebernommen, sondern gerechnet -- aus der
--   Abrechnungsgrundlage und dem Snapshot. Eine uebergebene Zahl waere eine
--   vierte Quelle neben den drei, die es schon gab.
-- ============================================================================

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
  -- Ueber submission -> job -> mandate. Der Weg ist eindeutig: jobs.mandate_id
  -- zeigt auf genau einen Einzelauftrag.
  IF NEW.mandate_id IS NULL AND NEW.submission_id IS NOT NULL THEN
    SELECT j.mandate_id INTO NEW.mandate_id
      FROM public.submissions sub
      JOIN public.jobs j ON j.id = sub.job_id
     WHERE sub.id = NEW.submission_id;
  END IF;

  -- Paket und Snapshot aus dem Auftrag uebernehmen, falls noch nicht gesetzt.
  IF NEW.mandate_id IS NOT NULL AND NEW.pricing_snapshot IS NULL THEN
    SELECT * INTO m FROM public.commercial_mandates WHERE id = NEW.mandate_id;
    IF FOUND AND m.pricing_snapshot IS NOT NULL THEN
      NEW.package_key      := m.package_key;
      NEW.package_version  := m.package_version;
      NEW.pricing_snapshot := m.pricing_snapshot;
    END IF;
  END IF;

  -- Ohne vereinbarte Grundlage die vereinbarte Vergütung heranziehen.
  -- agreed_salary ist das, was im Arbeitsvertrag steht -- genau die
  -- Bemessungsgrundlage, die der Einzelauftrag nennt.
  IF NEW.gross_annual_target_compensation_cents IS NULL
     AND NEW.agreed_salary IS NOT NULL AND NEW.agreed_salary > 0 THEN
    NEW.gross_annual_target_compensation_cents := NEW.agreed_salary::bigint * 100;
    IF NEW.compensation_verified_at IS NULL THEN
      -- Noch nicht gegengeprueft: die Zahl stammt aus dem Angebot, nicht aus
      -- dem unterzeichneten Vertrag. Der Unterschied wird gefuehrt, damit
      -- niemand eine ungeprüfte Zahl fuer eine geprüfte haelt.
      NULL;
    END IF;
  END IF;

  s := NEW.pricing_snapshot;
  IF s IS NULL THEN
    RETURN NEW;   -- Bestandsplacement ohne Paket -- unveraendert durchlassen.
  END IF;

  cont_days := nullif(s->>'continuityDays', '')::integer;
  notice    := coalesce(nullif(s->>'claimNoticeDays', '')::integer, 14);

  -- ---- (1) Fristen ab dem ersten Arbeitstag --------------------------------
  -- Fehlt der erste Arbeitstag, gilt das vereinbarte Startdatum.
  IF NEW.first_working_day IS NULL AND NEW.start_date IS NOT NULL THEN
    NEW.first_working_day := NEW.start_date;
  END IF;

  IF NEW.first_working_day IS NOT NULL AND cont_days IS NOT NULL THEN
    NEW.continuity_end_date    := NEW.first_working_day + cont_days;
    -- Zeitraum PLUS Meldefrist, nicht nur Zeitraum.
    NEW.retention_release_date := NEW.first_working_day + cont_days + notice;
  ELSIF cont_days IS NULL THEN
    NEW.continuity_end_date    := NULL;
    NEW.retention_release_date := NULL;
  END IF;

  -- ---- (2) Betraege --------------------------------------------------------
  IF NEW.gross_annual_target_compensation_cents IS NOT NULL THEN
    grundlage := NEW.gross_annual_target_compensation_cents::numeric;
    NEW.client_fee_cents          := round(grundlage * (s->>'clientFeePct')::numeric / 100);
    NEW.recruiter_initial_cents   := round(grundlage * (s->>'recruiterInitialPct')::numeric / 100);
    NEW.recruiter_retention_cents := round(grundlage * (s->>'recruiterRetentionPct')::numeric / 100);
    -- Matchunt als Rest, damit die Summe exakt aufgeht.
    NEW.matchunt_cents := NEW.client_fee_cents
                        - NEW.recruiter_initial_cents
                        - NEW.recruiter_retention_cents;

    -- Die alten Freitextspalten mitfuehren, damit Bestandsansichten weiter
    -- stimmen statt still zu veralten.
    NEW.total_fee        := round(NEW.client_fee_cents::numeric / 100, 2);
    NEW.platform_fee     := round(NEW.matchunt_cents::numeric / 100, 2);
    NEW.recruiter_payout := round((NEW.recruiter_initial_cents
                                 + NEW.recruiter_retention_cents)::numeric / 100, 2);
  END IF;

  -- ---- (3) Spuren, die sich aus dem Paket ergeben --------------------------
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
  'Holt Paket und Preis-Snapshot ueber submission -> job -> mandate und rechnet '
  'daraus Fristen und Betraege. Damit ist gleichgueltig, welcher Weg das '
  'Placement anlegt -- die Rechnung stimmt und stimmt mit dem, was der Kunde '
  'unterschrieben hat. Ersetzt die eigene Rechnung in process-offer-response.';

COMMIT;
