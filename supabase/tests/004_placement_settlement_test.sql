-- ============================================================================
-- pgTAP · Abrechnung, Continuity-Faelle, Ersatzsuche und Auszahlung
--
-- Testet 20260902100300_placement_settlement.sql und den Fix in
-- 20260902100400_fix_log_activity_missing_status.sql.
--
-- Geprueft wird, was NICHT passieren darf:
--   * ein Anspruch aus einem ausgeschlossenen oder unbekannten Grund
--   * ein Anspruch aus einem Ausscheiden ausserhalb des Zeitraums
--   * eine Meldung nach Ablauf der Frist
--   * eine Auszahlung des Einbehalts vor Ablauf von Zeitraum UND Meldefrist
--   * eine Auszahlung an den Recruiter, bevor der Kunde bezahlt hat
--   * eine Auslobung ohne erfolgreiche Ersatzvermittlung
--   * eine Aenderung an einer gestellten Rechnung
--
-- Ausfuehren (benoetigt Docker + Supabase CLI):
--   supabase start && supabase test db
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(25);

-- ----------------------------------------------------------------------------
-- Testdaten: eine Vermittlung mit Continuity 90 bei 100.000 Euro
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (id, email) VALUES
  ('99999999-aaaa-0000-0000-000000000001', 'recruiter-004@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'kunde@example.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.jobs (id, client_id, title, company_name, status)
VALUES ('bbbbbbbb-1111-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
        'Testposition', 'Beispiel GmbH', 'published')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.candidates (id, recruiter_id, full_name, email)
VALUES ('cccccccc-1111-0000-0000-000000000001', '99999999-aaaa-0000-0000-000000000001',
        'A. Kandidat', 'kandidat-004@example.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.submissions (id, job_id, candidate_id, recruiter_id)
VALUES ('dddddddd-1111-0000-0000-000000000001', 'bbbbbbbb-1111-0000-0000-000000000001',
        'cccccccc-1111-0000-0000-000000000001', '99999999-aaaa-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION pg_temp.snapshot_c90() RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'packageKey', 'continuity_90', 'publicName', 'Matchunt Continuity 90',
    'clientFeePct', 23, 'recruiterInitialPct', 10, 'recruiterRetentionPct', 5,
    'matchuntPct', 8, 'researchBountyPct', 8, 'matchuntOnClaimPct', 5,
    'continuityDays', 90, 'claimNoticeDays', 14, 'researchMaxActiveDays', 60,
    'eligibleClaimCategories',
      '["no_show","candidate_resigned","employer_performance","employer_fit"]'::jsonb,
    'excludedClaimCategories',
      '["redundancy","restructuring","position_eliminated"]'::jsonb);
$$;

INSERT INTO public.placements
  (id, submission_id, first_working_day, placement_state,
   package_key, package_version, pricing_snapshot, gross_annual_target_compensation_cents)
VALUES ('eeeeeeee-1111-0000-0000-000000000001', 'dddddddd-1111-0000-0000-000000000001',
        DATE '2026-03-01', 'started', 'continuity_90', 1,
        pg_temp.snapshot_c90(), 10000000);

-- ============================================================================
-- A) Die Betraege und Fristen werden gerechnet, nicht eingetragen
-- ============================================================================
SELECT is((SELECT client_fee_cents FROM public.placements WHERE id='eeeeeeee-1111-0000-0000-000000000001'),
          2300000::bigint, '100.000 Euro mit Continuity 90 ergeben 23.000 Euro Kundenhonorar');
SELECT is((SELECT recruiter_initial_cents FROM public.placements WHERE id='eeeeeeee-1111-0000-0000-000000000001'),
          1000000::bigint, 'Initialtranche 10.000 Euro');
SELECT is((SELECT recruiter_retention_cents FROM public.placements WHERE id='eeeeeeee-1111-0000-0000-000000000001'),
          500000::bigint, 'Einbehalt 5.000 Euro');
SELECT is((SELECT matchunt_cents FROM public.placements WHERE id='eeeeeeee-1111-0000-0000-000000000001'),
          800000::bigint, 'Matchunt 8.000 Euro');
SELECT is((SELECT client_fee_cents - recruiter_initial_cents - recruiter_retention_cents - matchunt_cents
             FROM public.placements WHERE id='eeeeeeee-1111-0000-0000-000000000001'),
          0::bigint, 'Die Verteilung geht ohne Restcent auf');

SELECT is((SELECT continuity_end_date FROM public.placements WHERE id='eeeeeeee-1111-0000-0000-000000000001'),
          DATE '2026-05-30', 'Der Anspruchszeitraum endet 90 Tage nach dem ersten Arbeitstag');
SELECT is((SELECT retention_release_date FROM public.placements WHERE id='eeeeeeee-1111-0000-0000-000000000001'),
          DATE '2026-06-13', 'Der Einbehalt wird erst 14 Tage nach dem Zeitraum frei, nicht an seinem Ende');
SELECT is((SELECT retention_release_date - continuity_end_date
             FROM public.placements WHERE id='eeeeeeee-1111-0000-0000-000000000001'),
          14, 'Zwischen Zeitraumende und Freigabe liegt genau die Meldefrist');

SELECT is((SELECT retention_state FROM public.placements WHERE id='eeeeeeee-1111-0000-0000-000000000001'),
          'withheld', 'Der Einbehalt ist zunaechst gebunden');
SELECT is((SELECT continuity_state FROM public.placements WHERE id='eeeeeeee-1111-0000-0000-000000000001'),
          'running', 'Der Anspruchszeitraum laeuft');

-- ============================================================================
-- B) Welche Gruende einen Fall ausloesen
-- ============================================================================
CREATE OR REPLACE FUNCTION pg_temp.claim(
  _kategorie text, _ausscheiden date, _kenntnis date, _gemeldet timestamptz
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.continuity_claims
    (placement_id, category, separation_date, known_at, deadline, reported_at)
  VALUES ('eeeeeeee-1111-0000-0000-000000000001', _kategorie, _ausscheiden,
          _kenntnis, _kenntnis + 14, _gemeldet)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

SELECT lives_ok($$ SELECT pg_temp.claim('candidate_resigned', DATE '2026-04-15',
                                        DATE '2026-04-15', TIMESTAMPTZ '2026-04-16') $$,
  'Eine Eigenkuendigung in den ersten 90 Tagen begruendet einen Anspruch');

SELECT throws_ok($$ SELECT pg_temp.claim('position_eliminated', DATE '2026-04-15',
                                         DATE '2026-04-15', TIMESTAMPTZ '2026-04-16') $$,
  NULL, 'Eine gestrichene Stelle ist ausgeschlossen');

SELECT throws_ok($$ SELECT pg_temp.claim('unbekannter_grund', DATE '2026-04-15',
                                         DATE '2026-04-15', TIMESTAMPTZ '2026-04-16') $$,
  NULL, 'Ein unbekannter Grund begruendet keinen Anspruch');

SELECT throws_ok($$ SELECT pg_temp.claim('candidate_resigned', DATE '2026-07-01',
                                         DATE '2026-07-01', TIMESTAMPTZ '2026-07-02') $$,
  NULL, 'Ein Ausscheiden nach Tag 90 begruendet keinen Anspruch');

SELECT throws_ok($$ SELECT pg_temp.claim('candidate_resigned', DATE '2026-04-01',
                                         DATE '2026-04-01', TIMESTAMPTZ '2026-05-01') $$,
  NULL, 'Eine Meldung nach Ablauf der Frist wird abgewiesen');

SELECT lives_ok($$ SELECT pg_temp.claim('candidate_resigned', DATE '2026-04-01',
                                        DATE '2026-05-20', TIMESTAMPTZ '2026-05-22') $$,
  'Spaet bekannt geworden, aber fristgerecht gemeldet -- der Anspruch besteht');

-- ============================================================================
-- C) Was ein anerkannter Fall ausloest
-- ============================================================================
CREATE OR REPLACE FUNCTION pg_temp.anerkennen() RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  v_id := pg_temp.claim('candidate_resigned', DATE '2026-04-15', DATE '2026-04-15',
                        TIMESTAMPTZ '2026-04-16');
  UPDATE public.continuity_claims SET status = 'accepted', decided_at = now() WHERE id = v_id;
END $$;

SELECT lives_ok($$ SELECT pg_temp.anerkennen() $$, 'Ein Fall laesst sich anerkennen');

SELECT is((SELECT retention_state FROM public.placements WHERE id='eeeeeeee-1111-0000-0000-000000000001'),
          'forfeited', 'Der anerkannte Fall laesst den Einbehalt verfallen -- er finanziert die Auslobung');
SELECT is((SELECT research_state FROM public.placements WHERE id='eeeeeeee-1111-0000-0000-000000000001'),
          'running', 'Der erneute Suchlauf startet');

-- ============================================================================
-- D) Einbehalt und Auszahlung
-- ============================================================================
CREATE OR REPLACE FUNCTION pg_temp.versuch(_was text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v_p uuid := 'eeeeeeee-1111-0000-0000-000000000001';
BEGIN
  CASE _was
    WHEN 'einbehalt_zu_frueh' THEN
      -- Ersten Arbeitstag auf heute setzen, damit die Frist wirklich laeuft.
      UPDATE public.placements SET first_working_day = CURRENT_DATE,
             retention_state = 'withheld', continuity_state = 'running' WHERE id = v_p;
      UPDATE public.placements SET retention_state = 'released' WHERE id = v_p;

    WHEN 'einbehalt_bei_offenem_fall' THEN
      UPDATE public.placements SET retention_state = 'withheld',
             continuity_state = 'running', retention_release_date = CURRENT_DATE - 1 WHERE id = v_p;
      PERFORM pg_temp.claim('candidate_resigned', DATE '2026-04-15', DATE '2026-04-15',
                            TIMESTAMPTZ '2026-04-16');
      UPDATE public.placements SET retention_state = 'released' WHERE id = v_p;

    WHEN 'tranche_vor_zahlungseingang' THEN
      INSERT INTO public.recruiter_payout_tranches
        (placement_id, recruiter_id, tranche_type, amount_cents, due_condition)
      VALUES (v_p, '99999999-aaaa-0000-0000-000000000001', 'initial', 1000000,
              'nach vollstaendigem Zahlungseingang');
      UPDATE public.recruiter_payout_tranches SET status = 'paid'
       WHERE placement_id = v_p AND tranche_type = 'initial';

    WHEN 'auslobung_ohne_erfolg' THEN
      UPDATE public.placements SET invoice_state = 'paid' WHERE id = v_p;
      INSERT INTO public.recruiter_payout_tranches
        (placement_id, recruiter_id, tranche_type, amount_cents, due_condition)
      VALUES (v_p, '99999999-aaaa-0000-0000-000000000001', 'research_bounty', 800000,
              'nach erfolgreicher Ersatzvermittlung');
      UPDATE public.recruiter_payout_tranches SET status = 'paid'
       WHERE placement_id = v_p AND tranche_type = 'research_bounty';

    WHEN 'tranche_nach_zahlungseingang' THEN
      UPDATE public.placements SET invoice_state = 'paid' WHERE id = v_p;
      INSERT INTO public.recruiter_payout_tranches
        (placement_id, recruiter_id, tranche_type, amount_cents, due_condition)
      VALUES (v_p, '99999999-aaaa-0000-0000-000000000001', 'initial', 1000000,
              'nach vollstaendigem Zahlungseingang');
      UPDATE public.recruiter_payout_tranches SET status = 'paid'
       WHERE placement_id = v_p AND tranche_type = 'initial';

    WHEN 'rechnung_aendern' THEN
      INSERT INTO public.invoices
        (placement_id, client_id, invoice_number, amount, total_amount,
         amount_cents, tax_amount_cents, status)
      VALUES (v_p, '22222222-2222-2222-2222-222222222222', 'RE-TEST-004', 0, 0,
              2300000, 437000, 'sent');
      UPDATE public.invoices SET amount_cents = 1 WHERE invoice_number = 'RE-TEST-004';
  END CASE;
END $$;

SELECT throws_ok($$ SELECT pg_temp.versuch('einbehalt_zu_frueh') $$, NULL,
  'Der Einbehalt laesst sich nicht auszahlen, solange die Frist laeuft');

SELECT throws_ok($$ SELECT pg_temp.versuch('einbehalt_bei_offenem_fall') $$, NULL,
  'Der Einbehalt bleibt gebunden, solange ein gemeldeter Fall offen ist');

SELECT throws_ok($$ SELECT pg_temp.versuch('tranche_vor_zahlungseingang') $$, NULL,
  'Kein Geld an den Recruiter, bevor der Kunde bezahlt hat');

SELECT throws_ok($$ SELECT pg_temp.versuch('auslobung_ohne_erfolg') $$, NULL,
  'Die Auslobung wird erst bei erfolgreicher Ersatzvermittlung faellig');

SELECT lives_ok($$ SELECT pg_temp.versuch('tranche_nach_zahlungseingang') $$,
  'Nach dem Zahlungseingang ist die Initialtranche auszahlbar');

SELECT throws_ok($$ SELECT pg_temp.versuch('rechnung_aendern') $$, NULL,
  'Eine gestellte Rechnung ist unveraenderlich -- Korrektur nur per Gutschrift');

SELECT * FROM finish();
ROLLBACK;
