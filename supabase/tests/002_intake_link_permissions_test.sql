-- ============================================================================
-- pgTAP · Berechtigungen und Sperren der login-freien Jobaufnahme
--
-- Prueft genau die Zusagen, die im Frontend nicht ueberpruefbar sind:
--   * anon kann Links, Entwuerfe, Token und Vereinbarungen NICHT lesen
--   * ein angemeldeter Nicht-Admin ebenfalls nicht
--   * Token-Hashes und Rate-Limit-Zaehler sind fuer NIEMANDEN per API lesbar
--   * ein Kunde kann seine eigene fee_percentage nicht aendern
--   * ein Kunde kann eine Stelle nicht selbst veroeffentlichen
--   * eine Stelle aus einer Beauftragungsanfrage bleibt ohne unterzeichneten
--     Vertrag gesperrt -- auch fuer den Admin
--   * vom Kunden bestaetigte Konditionen sind unveraenderlich
--   * die aktive Konditionsregel ist fuer Angemeldete lesbar (sie ist
--     veroeffentlicht, kein Geheimnis)
--
-- Ausfuehren (benoetigt Docker + Supabase CLI):
--   supabase start && supabase test db
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(24);

-- ----------------------------------------------------------------------------
-- Impersonation (uebernommen aus 001_client_team_permissions_test.sql:26-42)
-- ----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS tests;

CREATE OR REPLACE FUNCTION tests.authenticate_as(_uid uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

CREATE OR REPLACE FUNCTION tests.be_anon()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('role', 'anon', true);
END; $$;

CREATE OR REPLACE FUNCTION tests.clear_auth()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('role', 'postgres', true);
END; $$;

-- ----------------------------------------------------------------------------
-- Seed
-- ----------------------------------------------------------------------------
SELECT tests.clear_auth();

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at,
                        raw_user_meta_data, created_at, updated_at,
                        aud, role, instance_id)
VALUES
  ('aaaa0000-0000-0000-0000-000000000001', 'intake-admin@test.local',  'x', now(), '{}'::jsonb, now(), now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('aaaa0000-0000-0000-0000-000000000002', 'intake-client@test.local', 'x', now(), '{}'::jsonb, now(), now(), 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role) VALUES
  ('aaaa0000-0000-0000-0000-000000000001', 'admin'),
  ('aaaa0000-0000-0000-0000-000000000002', 'client')
ON CONFLICT DO NOTHING;

INSERT INTO public.intake_links (id, token_hash, link_type, label, created_by)
VALUES ('bbbb0000-0000-0000-0000-000000000001', 'hash-fuer-den-test', 'personal',
        'Testlink', 'aaaa0000-0000-0000-0000-000000000001');

INSERT INTO public.intake_drafts (id, link_id, contact_name, contact_email, company_name)
VALUES ('cccc0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000001',
        'Testperson', 'test@beispiel-firma.de', 'Beispiel GmbH');

INSERT INTO public.intake_draft_tokens (draft_id, token_hash, origin)
VALUES ('cccc0000-0000-0000-0000-000000000001', 'token-hash-fuer-den-test', 'start');

-- Eine Stelle des Kunden, die NICHT aus einer Aufnahme stammt.
INSERT INTO public.jobs (id, client_id, title, company_name, status, fee_percentage, recruiter_fee_percentage)
VALUES ('dddd0000-0000-0000-0000-000000000001', 'aaaa0000-0000-0000-0000-000000000002',
        'Bestandsstelle', 'Beispiel GmbH', 'draft', 20.00, 15.00);

-- ============================================================================
-- 1) anon sieht nichts
-- ============================================================================
SELECT tests.be_anon();

SELECT is((SELECT count(*)::int FROM public.intake_links),  0,
  'anon kann keine Aufnahme-Links lesen');
SELECT is((SELECT count(*)::int FROM public.intake_drafts), 0,
  'anon kann keine Gast-Aufnahmen lesen');
SELECT is((SELECT count(*)::int FROM public.intake_draft_tokens), 0,
  'anon kann keine Zugriffstoken lesen');
SELECT is((SELECT count(*)::int FROM public.commercial_mandates), 0,
  'anon kann keine Vereinbarungen lesen');
SELECT is((SELECT count(*)::int FROM public.intake_link_events), 0,
  'anon kann keine Funnel-Ereignisse lesen');

SELECT throws_ok(
  $$ INSERT INTO public.intake_drafts (contact_email) VALUES ('angreifer@example.com') $$,
  NULL, NULL,
  'anon kann keine Aufnahme anlegen -- der Gast-Pfad laeuft ausschliesslich ueber Edge Functions'
);

-- ============================================================================
-- 2) Angemeldete Nicht-Admins sehen ebenfalls nichts
-- ============================================================================
SELECT tests.authenticate_as('aaaa0000-0000-0000-0000-000000000002');

SELECT is((SELECT count(*)::int FROM public.intake_links),  0,
  'Ein Kunde kann keine Aufnahme-Links lesen');
SELECT is((SELECT count(*)::int FROM public.intake_drafts), 0,
  'Ein Kunde kann keine fremden Aufnahmen lesen');
SELECT is((SELECT count(*)::int FROM public.intake_draft_tokens), 0,
  'Ein Kunde kann keine Zugriffstoken lesen');

-- Die veroeffentlichte Regel ist dagegen absichtlich lesbar.
SELECT cmp_ok((SELECT count(*)::int FROM public.commercial_terms_templates WHERE is_active), '>=', 1,
  'Die aktive Konditionsregel ist fuer Angemeldete lesbar -- sie ist veroeffentlicht');

-- ============================================================================
-- 3) Der Kunde kann seine eigenen Konditionen nicht setzen
-- ============================================================================
UPDATE public.jobs SET fee_percentage = 5.00
 WHERE id = 'dddd0000-0000-0000-0000-000000000001';

SELECT is(
  (SELECT fee_percentage FROM public.jobs WHERE id = 'dddd0000-0000-0000-0000-000000000001'),
  20.00::numeric,
  'Der Statusguard schreibt eine vom Kunden geaenderte fee_percentage auf den alten Wert zurueck'
);

UPDATE public.jobs SET recruiter_fee_percentage = 1.00
 WHERE id = 'dddd0000-0000-0000-0000-000000000001';
SELECT is(
  (SELECT recruiter_fee_percentage FROM public.jobs WHERE id = 'dddd0000-0000-0000-0000-000000000001'),
  15.00::numeric,
  'Dasselbe fuer den Recruiter-Anteil'
);

SELECT throws_ok(
  $$ UPDATE public.jobs SET status = 'published' WHERE id = 'dddd0000-0000-0000-0000-000000000001' $$,
  'insufficient_privilege', NULL,
  'Ein Kunde kann eine Stelle nicht selbst veroeffentlichen'
);

-- Erlaubte Uebergaenge bleiben moeglich.
UPDATE public.jobs SET status = 'pending_approval'
 WHERE id = 'dddd0000-0000-0000-0000-000000000001';
SELECT is(
  (SELECT status FROM public.jobs WHERE id = 'dddd0000-0000-0000-0000-000000000001'),
  'pending_approval',
  'draft -> pending_approval bleibt fuer den Kunden erlaubt'
);

-- ============================================================================
-- 4) Der Admin sieht alles
-- ============================================================================
SELECT tests.authenticate_as('aaaa0000-0000-0000-0000-000000000001');

SELECT is((SELECT count(*)::int FROM public.intake_links),  1, 'Der Admin sieht die Aufnahme-Links');
SELECT is((SELECT count(*)::int FROM public.intake_drafts), 1, 'Der Admin sieht die Aufnahmen');
SELECT is((SELECT count(*)::int FROM public.intake_draft_tokens), 1,
  'Der Admin sieht, WER Zugriff auf eine Aufnahme hat');

-- ============================================================================
-- 5) Rate-Limit-Zaehler und Verifizierungscodes sind fuer niemanden lesbar
-- ============================================================================
SELECT is((SELECT count(*)::int FROM public.intake_rate_limits), 0,
  'Rate-Limit-Zaehler sind auch fuer Admins nicht per API lesbar');
SELECT is((SELECT count(*)::int FROM public.intake_email_verifications), 0,
  'Verifizierungscodes sind auch fuer Admins nicht per API lesbar');

-- ============================================================================
-- 6) Das Freigabe-Gate: kein Vertrag, keine Veroeffentlichung
-- ============================================================================
SELECT tests.clear_auth();

INSERT INTO public.commercial_mandates (
  id, draft_id, template_id, template_version,
  fee_percentage, recruiter_fee_percentage, fee_basis, payment_terms_days,
  snapshot, snapshot_sha256, agb_version, status,
  client_confirmed_at, client_confirmed_email, agb_accepted_at, signature_status
)
SELECT 'eeee0000-0000-0000-0000-000000000001', 'cccc0000-0000-0000-0000-000000000001',
       t.id, t.version, 20.00, 15.00, 'annual_target_salary', 14,
       '{"terms":{}}'::jsonb, 'sha-test', t.agb_version, 'accepted',
       now(), 'test@beispiel-firma.de', now(), 'pending'
  FROM public.commercial_terms_templates t WHERE t.is_active LIMIT 1;

INSERT INTO public.jobs (id, client_id, title, company_name, status,
                         intake_draft_id, mandate_id, source)
VALUES ('dddd0000-0000-0000-0000-000000000002', 'aaaa0000-0000-0000-0000-000000000002',
        'Stelle aus Anfrage', 'Beispiel GmbH', 'pending_approval',
        'cccc0000-0000-0000-0000-000000000001', 'eeee0000-0000-0000-0000-000000000001',
        'guest_intake');

SELECT tests.authenticate_as('aaaa0000-0000-0000-0000-000000000001');

SELECT throws_ok(
  $$ UPDATE public.jobs SET status = 'published' WHERE id = 'dddd0000-0000-0000-0000-000000000002' $$,
  'check_violation', NULL,
  'Auch ein Admin kann eine Stelle aus einer Beauftragungsanfrage ohne unterzeichneten Vertrag nicht veroeffentlichen'
);

SELECT tests.clear_auth();
UPDATE public.commercial_mandates
   SET signature_status = 'signed', signature_signed_at = now()
 WHERE id = 'eeee0000-0000-0000-0000-000000000001';

SELECT tests.authenticate_as('aaaa0000-0000-0000-0000-000000000001');
UPDATE public.jobs SET status = 'published'
 WHERE id = 'dddd0000-0000-0000-0000-000000000002';

SELECT is(
  (SELECT status FROM public.jobs WHERE id = 'dddd0000-0000-0000-0000-000000000002'),
  'published',
  'Nach unterzeichnetem Vertrag laesst der Guard die Veroeffentlichung zu'
);

-- ============================================================================
-- 7) Bestaetigte Konditionen sind unveraenderlich
-- ============================================================================
SELECT tests.clear_auth();

SELECT throws_ok(
  $$ UPDATE public.commercial_mandates SET fee_percentage = 12.00
      WHERE id = 'eeee0000-0000-0000-0000-000000000001' $$,
  'check_violation', NULL,
  'Eine vom Kunden bestaetigte Kondition kann nicht ueberschrieben werden'
);

SELECT throws_ok(
  $$ UPDATE public.commercial_mandates SET snapshot_sha256 = 'manipuliert'
      WHERE id = 'eeee0000-0000-0000-0000-000000000001' $$,
  'check_violation', NULL,
  'Der Snapshot einer bestaetigten Vereinbarung ist unveraenderlich'
);

SELECT throws_ok(
  $$ UPDATE public.commercial_mandates SET signature_status = 'pending'
      WHERE id = 'eeee0000-0000-0000-0000-000000000001' $$,
  'check_violation', NULL,
  'Ein unterzeichneter Vertrag kann nur auf "voided" gesetzt werden'
);

-- ============================================================================
-- 8) Bandbreite am Link
-- ============================================================================
SELECT throws_ok(
  $$ UPDATE public.intake_links
        SET terms_template_id = (SELECT id FROM public.commercial_terms_templates WHERE is_active LIMIT 1),
            fee_percentage = 60.00
      WHERE id = 'bbbb0000-0000-0000-0000-000000000001' $$,
  'check_violation', NULL,
  'Ein Link kann kein Honorar ausserhalb der veroeffentlichten Bandbreite tragen'
);

SELECT * FROM finish();
ROLLBACK;
