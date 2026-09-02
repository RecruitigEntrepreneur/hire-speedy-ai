-- ============================================================================
-- pgTAP · Pakete, Rahmenvertrag, Einzelauftrag und Veroeffentlichungssperre
--
-- Testet die drei Migrationen des Aufnahme-Nachlaufs:
--   20260902100000_commercial_packages.sql
--   20260902100100_framework_and_assignment.sql
--   20260902100200_intake_process_states.sql
--
-- Geprueft wird, was NICHT passieren darf:
--   * ein viertes Paket, oder ein Paket, dessen Verteilung nicht aufgeht
--   * ein abweichender Prozentsatz fuer eine einzelne Anfrage
--   * eine Gegenzeichnung vor der Kundenunterschrift
--   * eine Aenderung am Vertrag nach der Kundenunterschrift
--   * eine Veroeffentlichung ohne beide Unterschriften und wirksamen
--     Rahmenvertrag
--
-- Dazu die Wirtschaftsrechnung bei 100.000 Euro aus der Spezifikation.
--
-- Ausfuehren (benoetigt Docker + Supabase CLI):
--   supabase start && supabase test db
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(47);

-- ----------------------------------------------------------------------------
-- Testdaten
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin@matchunt.ai'),
  ('22222222-2222-2222-2222-222222222222', 'kunde@example.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organizations (id, name, type, owner_id, primary_domain)
VALUES ('33333333-3333-3333-3333-333333333333', 'Beispiel GmbH', 'client',
        '22222222-2222-2222-2222-222222222222', 'beispiel-test.de')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.contract_templates (id, doc_type, version, is_active, title, body_md, body_sha256, agb_version)
VALUES ('44444444-4444-4444-4444-444444444444', 'framework', 99, false,
        'Rahmenvertrag (Test)', '# Test', 'sha-rv-test', '2026-06'),
       ('55555555-5555-5555-5555-555555555555', 'assignment', 99, false,
        'Einzelauftrag (Test)', '# Test', 'sha-ea-test', '2026-06')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.intake_links (id, link_type, label, token_hash, created_by)
VALUES ('77777777-7777-7777-7777-777777777777', 'public', 'Test', 'hash-test-003',
        '11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.intake_drafts (id, link_id, title, contact_email, company_name, capture_state)
VALUES ('88888888-8888-8888-8888-888888888888', '77777777-7777-7777-7777-777777777777',
        'Testposition', 'kunde@example.com', 'Beispiel GmbH', 'complete')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- A) Die drei Pakete
-- ============================================================================
SELECT is(
  (SELECT count(*)::int FROM public.commercial_packages WHERE is_active),
  3, 'Es gibt genau drei aktive Pakete');

SELECT set_eq(
  'SELECT package_key FROM public.commercial_packages WHERE is_active',
  ARRAY['core', 'continuity_90', 'continuity_180'],
  'Die drei Pakete heissen core, continuity_90, continuity_180');

SELECT is(
  (SELECT count(*)::int FROM public.commercial_packages
    WHERE is_active
      AND recruiter_initial_pct + recruiter_retention_pct + matchunt_pct <> client_fee_pct),
  0, 'Invariante 1: ohne Claim geht die Verteilung in jedem Paket auf');

SELECT is(
  (SELECT count(*)::int FROM public.commercial_packages
    WHERE is_active
      AND recruiter_initial_pct + research_bounty_pct + matchunt_on_claim_pct <> client_fee_pct),
  0, 'Invariante 2: mit Claim geht die Verteilung in jedem Paket auf');

SELECT is(
  (SELECT count(*)::int FROM public.commercial_packages
    WHERE is_active AND recruiter_initial_pct + recruiter_retention_pct <> 15.00),
  0, 'Der Recruiter erhaelt ohne Claim in jedem Paket 15 Prozentpunkte');

SELECT is(
  (SELECT count(*)::int FROM public.commercial_packages
    WHERE is_active AND matchunt_on_claim_pct <> 5.00),
  0, 'Matchunt verbleiben bei erfolgreicher Ersatzvermittlung immer 5 Punkte');

SELECT is((SELECT client_fee_pct FROM public.commercial_packages WHERE package_key='core' AND is_active),
          20.00::numeric, 'Core kostet 20 Prozent');
SELECT is((SELECT client_fee_pct FROM public.commercial_packages WHERE package_key='continuity_90' AND is_active),
          23.00::numeric, 'Continuity 90 kostet 23 Prozent');
SELECT is((SELECT client_fee_pct FROM public.commercial_packages WHERE package_key='continuity_180' AND is_active),
          26.00::numeric, 'Continuity 180 kostet 26 Prozent');

SELECT is((SELECT continuity_days FROM public.commercial_packages WHERE package_key='core' AND is_active),
          NULL, 'Core hat keinen Continuity-Zeitraum');
SELECT is((SELECT research_max_active_days FROM public.commercial_packages WHERE package_key='continuity_90' AND is_active),
          60, 'Continuity 90 loest 60 aktive Suchtage aus');
SELECT is((SELECT research_max_active_days FROM public.commercial_packages WHERE package_key='continuity_180' AND is_active),
          90, 'Continuity 180 loest 90 aktive Suchtage aus');

-- Die Bounty ist die verfallene Tranche plus den Continuity-Aufpreis.
SELECT is(
  (SELECT research_bounty_pct FROM public.commercial_packages WHERE package_key='continuity_90' AND is_active),
  (SELECT c.recruiter_retention_pct + (c.client_fee_pct - k.client_fee_pct)
     FROM public.commercial_packages c, public.commercial_packages k
    WHERE c.package_key='continuity_90' AND c.is_active AND k.package_key='core' AND k.is_active),
  'Continuity 90: Auslobung = verfallene Tranche + Aufpreis');

SELECT is(
  (SELECT research_bounty_pct FROM public.commercial_packages WHERE package_key='continuity_180' AND is_active),
  (SELECT c.recruiter_retention_pct + (c.client_fee_pct - k.client_fee_pct)
     FROM public.commercial_packages c, public.commercial_packages k
    WHERE c.package_key='continuity_180' AND c.is_active AND k.package_key='core' AND k.is_active),
  'Continuity 180: Auslobung = verfallene Tranche + Aufpreis');

-- ============================================================================
-- B) Die Wirtschaftsrechnung bei 100.000 Euro
-- ============================================================================
CREATE OR REPLACE FUNCTION pg_temp.betrag(_key text, _spalte text) RETURNS numeric
LANGUAGE plpgsql AS $$
DECLARE v numeric;
BEGIN
  EXECUTE format('SELECT round(100000 * %I / 100, 2) FROM public.commercial_packages
                   WHERE package_key = $1 AND is_active', _spalte)
    INTO v USING _key;
  RETURN v;
END $$;

SELECT is(pg_temp.betrag('core','client_fee_pct'),          20000.00::numeric, 'Core: Kundenhonorar 20.000 Euro');
SELECT is(pg_temp.betrag('core','recruiter_initial_pct'),   15000.00::numeric, 'Core: Recruiter 15.000 Euro');
SELECT is(pg_temp.betrag('core','matchunt_pct'),             5000.00::numeric, 'Core: Matchunt 5.000 Euro');

SELECT is(pg_temp.betrag('continuity_90','client_fee_pct'),          23000.00::numeric, 'C90: Kundenhonorar 23.000 Euro');
SELECT is(pg_temp.betrag('continuity_90','recruiter_initial_pct'),   10000.00::numeric, 'C90: Initialtranche 10.000 Euro');
SELECT is(pg_temp.betrag('continuity_90','recruiter_retention_pct'),  5000.00::numeric, 'C90: Einbehalt 5.000 Euro');
SELECT is(pg_temp.betrag('continuity_90','matchunt_pct'),             8000.00::numeric, 'C90 ohne Claim: Matchunt 8.000 Euro');
SELECT is(pg_temp.betrag('continuity_90','research_bounty_pct'),      8000.00::numeric, 'C90 mit Claim: Auslobung 8.000 Euro');
SELECT is(pg_temp.betrag('continuity_90','matchunt_on_claim_pct'),    5000.00::numeric, 'C90 mit Claim: Matchunt 5.000 Euro');

SELECT is(pg_temp.betrag('continuity_180','client_fee_pct'),          26000.00::numeric, 'C180: Kundenhonorar 26.000 Euro');
SELECT is(pg_temp.betrag('continuity_180','recruiter_initial_pct'),   10000.00::numeric, 'C180: Initialtranche 10.000 Euro');
SELECT is(pg_temp.betrag('continuity_180','recruiter_retention_pct'),  5000.00::numeric, 'C180: Einbehalt 5.000 Euro');
SELECT is(pg_temp.betrag('continuity_180','matchunt_pct'),            11000.00::numeric, 'C180 ohne Claim: Matchunt 11.000 Euro');
SELECT is(pg_temp.betrag('continuity_180','research_bounty_pct'),     11000.00::numeric, 'C180 mit Claim: Auslobung 11.000 Euro');
SELECT is(pg_temp.betrag('continuity_180','matchunt_on_claim_pct'),    5000.00::numeric, 'C180 mit Claim: Matchunt 5.000 Euro');

-- ============================================================================
-- C) Was die Paketdefinition ablehnen muss
-- ============================================================================
SELECT throws_ok($$
  INSERT INTO public.commercial_packages
    (package_key, version, public_name, summary, sort_order, client_fee_pct,
     recruiter_initial_pct, recruiter_retention_pct, matchunt_pct,
     research_bounty_pct, matchunt_on_claim_pct)
  VALUES ('enterprise', 1, 'X', 'Y', 4, 30, 20, 0, 10, 0, 10)
$$, NULL, 'Ein viertes Paket wird abgelehnt');

SELECT throws_ok($$
  INSERT INTO public.commercial_packages
    (package_key, version, public_name, summary, sort_order, client_fee_pct,
     recruiter_initial_pct, recruiter_retention_pct, matchunt_pct,
     research_bounty_pct, matchunt_on_claim_pct)
  VALUES ('core', 90, 'X', 'Y', 4, 20, 15, 0, 6, 0, 5)
$$, NULL, 'Ein Paket, dessen Verteilung ohne Claim nicht aufgeht, wird abgelehnt');

SELECT throws_ok($$
  INSERT INTO public.commercial_packages
    (package_key, version, public_name, summary, sort_order, client_fee_pct,
     recruiter_initial_pct, recruiter_retention_pct, matchunt_pct,
     research_bounty_pct, matchunt_on_claim_pct)
  VALUES ('core', 91, 'X', 'Y', 4, 20, 15, 0, 5, 3, 5)
$$, NULL, 'Ein Paket, dessen Verteilung mit Claim nicht aufgeht, wird abgelehnt');

SELECT throws_ok($$
  INSERT INTO public.commercial_packages
    (package_key, version, public_name, summary, sort_order, client_fee_pct,
     continuity_days, research_max_active_days, recruiter_initial_pct,
     recruiter_retention_pct, matchunt_pct, research_bounty_pct,
     matchunt_on_claim_pct, eligible_claim_categories, excluded_claim_categories)
  VALUES ('continuity_90', 92, 'X', 'Y', 4, 23, 90, 60, 10, 5, 8, 8, 5,
          '["no_show"]'::jsonb, '["no_show"]'::jsonb)
$$, NULL, 'Ein Grund kann nicht zugleich gueltig und ausgeschlossen sein');

SELECT throws_ok($$
  INSERT INTO public.commercial_packages
    (package_key, version, is_active, public_name, summary, sort_order,
     client_fee_pct, recruiter_initial_pct, recruiter_retention_pct,
     matchunt_pct, research_bounty_pct, matchunt_on_claim_pct)
  VALUES ('core', 93, true, 'X', 'Y', 4, 20, 15, 0, 5, 0, 5)
$$, NULL, 'Zwei aktive Fassungen desselben Pakets werden abgelehnt');

-- ============================================================================
-- D) Der Preis kommt aus dem Paket, nicht aus einer Eingabe
-- ============================================================================
CREATE OR REPLACE FUNCTION pg_temp.auftrag(
  _fee bigint, _init bigint, _ret bigint, _mu bigint,
  _grundlage bigint DEFAULT 10000000, _snapshot jsonb DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
  v_draft uuid;
BEGIN
  -- Je Aufruf eine eigene Aufnahme: commercial_mandates_one_open_idx laesst nur
  -- einen offenen Auftrag pro Aufnahme zu, und das soll auch so bleiben.
  INSERT INTO public.intake_drafts (link_id, title, contact_email, company_name, capture_state)
  VALUES ('77777777-7777-7777-7777-777777777777', 'Testposition',
          'kunde@example.com', 'Beispiel GmbH', 'complete')
  RETURNING id INTO v_draft;

  INSERT INTO public.commercial_mandates
    (draft_id, contract_template_id, fee_percentage, recruiter_fee_percentage,
     fee_basis, payment_terms_days, snapshot, snapshot_sha256, agb_version,
     package_key, package_version, pricing_snapshot, pricing_snapshot_sha256,
     gross_annual_target_compensation_cents, compensation_basis,
     client_fee_cents, recruiter_initial_cents, recruiter_retention_cents, matchunt_cents)
  VALUES (v_draft, '55555555-5555-5555-5555-555555555555',
          23, 15, 'annual_target_salary', 14, '{}'::jsonb, 's', '2026-06',
          'continuity_90', 1,
          coalesce(_snapshot, jsonb_build_object(
            'packageKey', 'continuity_90', 'clientFeePct', 23,
            'recruiterInitialPct', 10, 'recruiterRetentionPct', 5,
            'matchuntPct', 8, 'researchBountyPct', 8, 'matchuntOnClaimPct', 5)),
          'ps', _grundlage, 'intake_estimate', _fee, _init, _ret, _mu)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

SELECT lives_ok($$ SELECT pg_temp.auftrag(2300000, 1000000, 500000, 800000) $$,
  'Der korrekt gerechnete Auftrag wird angenommen');

SELECT throws_ok($$ SELECT pg_temp.auftrag(2500000, 1000000, 500000, 1000000) $$,
  NULL, 'Ein abweichendes Kundenhonorar wird abgelehnt');

SELECT throws_ok($$ SELECT pg_temp.auftrag(2300000, 1200000, 500000, 600000) $$,
  NULL, 'Eine still erhoehte Recruiter-Tranche wird abgelehnt');

SELECT throws_ok($$ SELECT pg_temp.auftrag(2300000, 1000000, 500000, 900000) $$,
  NULL, 'Eine Verteilung, die nicht aufgeht, wird abgelehnt');

SELECT throws_ok($$
  SELECT pg_temp.auftrag(3000000, 1000000, 500000, 1500000, 10000000,
    jsonb_build_object('clientFeePct', 30, 'recruiterInitialPct', 10,
                       'recruiterRetentionPct', 5, 'matchuntPct', 15,
                       'researchBountyPct', 8))
$$, NULL, 'Ein Snapshot mit gefaelschtem Prozentsatz wird abgelehnt');

-- Die Prozentspalten werden aus dem Paket gefuellt, nicht uebernommen.
-- Die Zeile wird in einer eigenen Funktion angelegt UND gelesen: ein SELECT,
-- das eine einfuegende Funktion in seiner eigenen WHERE-Klausel aufruft, sieht
-- die neue Zeile nicht -- der Snapshot des Statements ist aelter.
CREATE OR REPLACE FUNCTION pg_temp.satz_am_auftrag() RETURNS numeric
LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
  v    numeric;
BEGIN
  -- Erst anlegen, dann lesen. Auch innerhalb einer Funktion nimmt das SELECT
  -- seinen Snapshot zu Statementbeginn -- eine Zeile, die derselbe Ausdruck
  -- gerade erst einfuegt, ist darin nicht enthalten.
  v_id := pg_temp.auftrag(2300000, 1000000, 500000, 800000);
  SELECT fee_percentage INTO v FROM public.commercial_mandates WHERE id = v_id;
  RETURN v;
END $$;

SELECT is(pg_temp.satz_am_auftrag(), 23.00::numeric,
  'Der Prozentsatz am Auftrag stammt aus dem Paket');

-- ============================================================================
-- E) Unterschriftsreihenfolge und Unveraenderlichkeit
-- ============================================================================
CREATE OR REPLACE FUNCTION pg_temp.rahmenvertrag(_status text DEFAULT 'draft')
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.client_framework_agreements
    (organization_id, template_id, template_version, snapshot, snapshot_sha256, agb_version)
  VALUES (NULL, '44444444-4444-4444-4444-444444444444', 99, '{}'::jsonb, 'sha', '2026-06')
  RETURNING id INTO v_id;

  IF _status IN ('pending_release','sent','customer_signed','active') THEN
    UPDATE public.client_framework_agreements
       SET status='pending_release', released_for_signature_at=now() WHERE id=v_id;
  END IF;
  IF _status IN ('sent','customer_signed','active') THEN
    UPDATE public.client_framework_agreements SET status='sent' WHERE id=v_id;
  END IF;
  IF _status IN ('customer_signed','active') THEN
    UPDATE public.client_framework_agreements
       SET status='customer_signed', customer_signed_at=now(),
           customer_signer_email='kunde@example.com' WHERE id=v_id;
  END IF;
  IF _status = 'active' THEN
    UPDATE public.client_framework_agreements
       SET status='active', countersigned_at=now(), countersigner_name='Test' WHERE id=v_id;
  END IF;
  RETURN v_id;
END $$;

-- Jeder verbotene Versuch laeuft vollstaendig INNERHALB einer Funktion ab.
-- Sonst laeuft das UPDATE gegen einen Snapshot, der die eben angelegte Zeile
-- nicht enthaelt, trifft null Zeilen und wirft nichts -- der Test waere gruen,
-- ohne je einen Waechter beruehrt zu haben.
CREATE OR REPLACE FUNCTION pg_temp.versuch(_was text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  CASE _was
    WHEN 'gegenzeichnung_vor_kunde' THEN
      v_id := pg_temp.rahmenvertrag('sent');
      UPDATE public.client_framework_agreements
         SET countersigned_at = now(), countersigner_name = 'Zu frueh' WHERE id = v_id;

    WHEN 'versand_ohne_freigabe' THEN
      v_id := pg_temp.rahmenvertrag('draft');
      UPDATE public.client_framework_agreements SET status = 'sent' WHERE id = v_id;

    WHEN 'sprung_auf_active' THEN
      v_id := pg_temp.rahmenvertrag('sent');
      UPDATE public.client_framework_agreements
         SET status = 'active', customer_signed_at = now(),
             customer_signer_email = 'x@y.de', countersigned_at = now() WHERE id = v_id;

    WHEN 'text_nach_unterschrift_aendern' THEN
      v_id := pg_temp.rahmenvertrag('customer_signed');
      UPDATE public.client_framework_agreements
         SET snapshot = '{"geaendert": true}'::jsonb, snapshot_sha256 = 'anders' WHERE id = v_id;

    WHEN 'unterschriftsdatum_zurueckdrehen' THEN
      v_id := pg_temp.rahmenvertrag('customer_signed');
      UPDATE public.client_framework_agreements
         SET customer_signed_at = '2020-01-01' WHERE id = v_id;

    WHEN 'gegenzeichnen_nach_kunde' THEN
      v_id := pg_temp.rahmenvertrag('customer_signed');
      UPDATE public.client_framework_agreements
         SET status = 'active', countersigned_at = now(), countersigner_name = 'Test'
       WHERE id = v_id;
  END CASE;
END $$;

SELECT lives_ok($$ SELECT pg_temp.rahmenvertrag('active') $$,
  'Der vorgesehene Weg draft->pending_release->sent->customer_signed->active laeuft');

SELECT throws_ok($$ SELECT pg_temp.versuch('gegenzeichnung_vor_kunde') $$, NULL,
  'Matchunt kann nicht gegenzeichnen, bevor der Kunde unterschrieben hat');

SELECT throws_ok($$ SELECT pg_temp.versuch('versand_ohne_freigabe') $$, NULL,
  'Ohne Freigabe des Admins geht nichts zur Unterschrift');

SELECT throws_ok($$ SELECT pg_temp.versuch('sprung_auf_active') $$, NULL,
  'Der Sprung von sent direkt auf active wird abgelehnt');

SELECT throws_ok($$ SELECT pg_temp.versuch('text_nach_unterschrift_aendern') $$, NULL,
  'Nach der Kundenunterschrift ist der Vertragstext unveraenderlich');

SELECT throws_ok($$ SELECT pg_temp.versuch('unterschriftsdatum_zurueckdrehen') $$, NULL,
  'Das Unterschriftsdatum laesst sich nicht zurueckdrehen');

SELECT lives_ok($$ SELECT pg_temp.versuch('gegenzeichnen_nach_kunde') $$,
  'Gegenzeichnen bleibt nach der Kundenunterschrift moeglich');

SELECT * FROM finish();
ROLLBACK;
