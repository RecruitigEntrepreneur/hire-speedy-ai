-- ============================================================================
-- pgTAP · Suchen, Kundensicht, Pause/Schließen, Bestandskunden, Partner-Stufen
--
-- Testet 20261008120000_suchen_kundenschutz_stufen.sql.
--
-- Geprüft wird vor allem, was NICHT passieren darf:
--   * mehr offene Suchen als Plätze (außer genau eine beim direkten Einreichen)
--   * Firmennamen sammeln (beendete Suche ohne Einreichung hält den Platz)
--   * Einreichen ohne laufende Suche, bei pausierter Stelle, ohne Kundenfrage
--   * Pausieren oder Schließen durch Hiring Manager
--   * Kunden sehen Headhunter fremder Stellen, Headhunter sehen andere Headhunter
--   * „Stelle schon direkt“ ohne Prüfung, vertrauliche Suche ohne Gold
--   * Selbst-Hochstufen und direktes Anlegen von Suchen
--
-- Ausführen (benötigt Docker + Supabase CLI):
--   supabase start && supabase test db
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(57);

CREATE SCHEMA IF NOT EXISTS tests;

CREATE OR REPLACE FUNCTION tests.authenticate_as(_uid uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END; $$;

CREATE OR REPLACE FUNCTION tests.clear_auth()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('role', 'postgres', true);
END; $$;

GRANT USAGE ON SCHEMA tests TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tests TO authenticated;

-- ----------------------------------------------------------------------------
-- Seed
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000005-0000-0000-0000-0000000000a1', 'hh1-005@example.com',   '{"role":"recruiter","full_name":"Tobias Klein"}'),
  ('00000005-0000-0000-0000-0000000000a2', 'hh2-005@example.com',   '{"role":"recruiter","full_name":"Julia Hartmann"}'),
  ('00000005-0000-0000-0000-0000000000c1', 'owner-005@example.com', '{"role":"client","full_name":"Kunde Owner"}'),
  ('00000005-0000-0000-0000-0000000000c2', 'hm-005@example.com',    '{"role":"client","full_name":"Kunde HM"}'),
  ('00000005-0000-0000-0000-0000000000c3', 'viewer-005@example.com','{"role":"client","full_name":"Kunde Viewer"}'),
  ('00000005-0000-0000-0000-0000000000d1', 'admin-005@example.com', '{"role":"client","full_name":"Admin"}');

INSERT INTO public.user_roles (user_id, role) VALUES ('00000005-0000-0000-0000-0000000000d1', 'admin');
UPDATE public.profiles SET company_name = 'Hartmann Executive Search' WHERE user_id = '00000005-0000-0000-0000-0000000000a2';

INSERT INTO public.recruiter_partner_status (user_id, contract_version, tier) VALUES
  ('00000005-0000-0000-0000-0000000000a1', '2.1', 'partner'),
  ('00000005-0000-0000-0000-0000000000a2', '2.1', 'gold');
UPDATE public.recruiter_partner_status SET tier_override = 'gold', tier_override_reason = 'Test'
 WHERE user_id = '00000005-0000-0000-0000-0000000000a2';

INSERT INTO public.organizations (id, name, type, owner_id)
VALUES ('00000005-0000-0000-0000-00000000000f', 'MedTec Süd GmbH', 'client', '00000005-0000-0000-0000-0000000000c1');
INSERT INTO public.organization_members (organization_id, user_id, role, status) VALUES
  ('00000005-0000-0000-0000-00000000000f', '00000005-0000-0000-0000-0000000000c2', 'hiring_manager', 'active'),
  ('00000005-0000-0000-0000-00000000000f', '00000005-0000-0000-0000-0000000000c3', 'viewer', 'active');

-- J1..J4 normal, J5 vertraulich, J10..J21 für die Platzregel
INSERT INTO public.jobs (id, client_id, organization_id, title, company_name, status)
SELECT ('00000005-0000-0000-0001-' || lpad(n::text, 12, '0'))::uuid,
       '00000005-0000-0000-0000-0000000000c1', '00000005-0000-0000-0000-00000000000f',
       'Stelle ' || n, 'MedTec Süd GmbH', 'published'
  FROM unnest(ARRAY[1,2,3,4,5,10,11,12,13,14,15,16,17,18,19,20,21]) AS n;
UPDATE public.jobs SET confidential_search = true WHERE id = '00000005-0000-0000-0001-000000000005';
INSERT INTO public.job_collaborators (job_id, user_id, role)
VALUES ('00000005-0000-0000-0001-000000000002', '00000005-0000-0000-0000-0000000000c2', 'hiring_manager');

INSERT INTO public.candidates (id, recruiter_id, full_name, email) VALUES
  ('00000005-0000-0000-0002-000000000001', '00000005-0000-0000-0000-0000000000a1', 'Lena K.', 'lena-005@example.com'),
  ('00000005-0000-0000-0002-000000000002', '00000005-0000-0000-0000-0000000000a1', 'Jonas M.', 'jonas-005@example.com');

-- ============================================================================
-- A) „Ich suche“, Kundenfrage, Einreichen
-- ============================================================================
SELECT tests.authenticate_as('00000005-0000-0000-0000-0000000000a1');

SELECT throws_ok(
  $$INSERT INTO public.recruiter_job_activations (recruiter_id, job_id, trust_level_at)
    VALUES ('00000005-0000-0000-0000-0000000000a1', '00000005-0000-0000-0001-000000000001', 'bronze')$$,
  '42501', NULL, 'Suchen lassen sich nicht mehr direkt anlegen');

SELECT is((public.start_job_search('00000005-0000-0000-0001-000000000001') ->> 'company_name'),
          'MedTec Süd GmbH', '„Ich suche“ zeigt den Firmennamen');
SELECT is((public.start_job_search('00000005-0000-0000-0001-000000000001') ->> 'needs_client_answer')::boolean,
          true, 'Kundenfrage ist offen');
SELECT is((SELECT company_name FROM public.recruiter_job_activations a
             JOIN public.recruiter_jobs_view v ON v.id = a.job_id
            WHERE a.job_id = '00000005-0000-0000-0001-000000000001'),
          'MedTec Süd GmbH', 'View zeigt den Firmennamen ab „Ich suche“');
SELECT is((SELECT company_name FROM public.recruiter_jobs_view WHERE id = '00000005-0000-0000-0001-000000000003'),
          NULL, 'Ohne Suche bleibt der Name verborgen');

SELECT throws_ok(
  $$INSERT INTO public.submissions (job_id, candidate_id, recruiter_id) VALUES
    ('00000005-0000-0000-0001-000000000001', '00000005-0000-0000-0002-000000000001', '00000005-0000-0000-0000-0000000000a1')$$,
  'P0001', 'Bitte zuerst beantworten, ob das Unternehmen schon dein Kunde ist.', 'Einreichen erst nach der Kundenfrage');
SELECT throws_ok(
  $$INSERT INTO public.submissions (job_id, candidate_id, recruiter_id) VALUES
    ('00000005-0000-0000-0001-000000000003', '00000005-0000-0000-0002-000000000001', '00000005-0000-0000-0000-0000000000a1')$$,
  'P0001', NULL, 'Einreichen ohne Suche geht nicht');

SELECT lives_ok($$SELECT public.answer_client_question('00000005-0000-0000-0001-000000000001', 'no')$$, 'Antwort „Nein“');
SELECT lives_ok(
  $$INSERT INTO public.submissions (id, job_id, candidate_id, recruiter_id) VALUES
    ('00000005-0000-0000-0003-000000000001', '00000005-0000-0000-0001-000000000001', '00000005-0000-0000-0002-000000000001', '00000005-0000-0000-0000-0000000000a1')$$,
  'Einreichen nach der Antwort');
SELECT is((SELECT ends_at FROM public.recruiter_job_activations
            WHERE recruiter_id = '00000005-0000-0000-0000-0000000000a1' AND job_id = '00000005-0000-0000-0001-000000000001'),
          NULL, 'Mit Einreichung läuft keine Frist mehr');
SELECT is((public.my_search_capacity() ->> 'used')::int, 0, 'Suche mit Einreichung belegt keinen Platz');

-- ============================================================================
-- B) Plätze: 10 für alle, eine über die Grenze nur beim direkten Einreichen
-- ============================================================================
SELECT lives_ok($$SELECT public.start_job_search(('00000005-0000-0000-0001-' || lpad(n::text, 12, '0'))::uuid)
                   FROM generate_series(10, 19) n$$, 'Zehn Suchen starten');
SELECT is((public.my_search_capacity() ->> 'used')::int, 10, 'Zehn Plätze belegt');
SELECT throws_ok($$SELECT public.start_job_search('00000005-0000-0000-0001-000000000020')$$,
  'P0001', NULL, 'Die elfte Suche ist gesperrt');
SELECT lives_ok($$SELECT public.start_job_search('00000005-0000-0000-0001-000000000020', true)$$,
  'Eine Suche über die Grenze, wenn direkt eingereicht wird');
SELECT throws_ok($$SELECT public.start_job_search('00000005-0000-0000-0001-000000000021', true)$$,
  'P0001', NULL, 'Aber nicht zwei');

SELECT lives_ok($$SELECT public.end_job_search('00000005-0000-0000-0001-000000000010')$$, 'Suche selbst beenden');
SELECT ok((SELECT slot_until > now() + interval '29 days' FROM public.recruiter_job_activations
            WHERE recruiter_id = '00000005-0000-0000-0000-0000000000a1' AND job_id = '00000005-0000-0000-0001-000000000010'),
          'Beendet ohne Einreichung: Platz bleibt bis Tag 30 gesperrt');
SELECT is((public.my_search_capacity() ->> 'used')::int, 11, 'Beenden gibt den Platz nicht frei (keine Namenssammlung)');

SELECT is((SELECT count(*)::int FROM public.recruiter_trust_levels WHERE recruiter_id <> '00000005-0000-0000-0000-0000000000a1'),
          0, 'Headhunter sieht nur die eigene Stufe');
UPDATE public.recruiter_trust_levels SET max_active_slots = 99 WHERE recruiter_id = '00000005-0000-0000-0000-0000000000a1';
SELECT tests.clear_auth();
SELECT is((SELECT max_active_slots FROM public.recruiter_trust_levels WHERE recruiter_id = '00000005-0000-0000-0000-0000000000a1'),
          5, 'Selbst-Hochstufen wirkt nicht');

-- ============================================================================
-- C) Pause und Schließen
-- ============================================================================
-- Setup: laufende Suche mit Einreichung auf J2 (direkt angelegt)
INSERT INTO public.recruiter_job_activations
  (recruiter_id, job_id, trust_level_at, status, has_submitted, ends_at, company_revealed_at)
VALUES ('00000005-0000-0000-0000-0000000000a1', '00000005-0000-0000-0001-000000000002', 'partner', 'active', true, NULL, now());

SELECT tests.authenticate_as('00000005-0000-0000-0000-0000000000c2');
SELECT throws_ok($$SELECT public.client_pause_job('00000005-0000-0000-0001-000000000002', now() + interval '14 days', 'Urlaub')$$,
  '42501', NULL, 'Hiring Manager darf nicht pausieren');
SELECT tests.authenticate_as('00000005-0000-0000-0000-0000000000c1');
SELECT throws_ok($$SELECT public.client_pause_job('00000005-0000-0000-0001-000000000002', now() + interval '100 days', 'Urlaub')$$,
  'P0001', NULL, 'Pause höchstens 8 Wochen');
SELECT lives_ok($$SELECT public.client_pause_job('00000005-0000-0000-0001-000000000002', now() + interval '14 days', 'Urlaub')$$,
  'Owner pausiert');
SELECT tests.clear_auth();
SELECT is((SELECT status FROM public.recruiter_job_activations
            WHERE recruiter_id = '00000005-0000-0000-0000-0000000000a1' AND job_id = '00000005-0000-0000-0001-000000000002'),
          'paused', 'Suche ruht mit der Stelle');
SELECT ok(EXISTS (SELECT 1 FROM public.notifications WHERE user_id = '00000005-0000-0000-0000-0000000000a1' AND type = 'job_paused'),
          'Headhunter erfährt von der Pause');

SELECT tests.authenticate_as('00000005-0000-0000-0000-0000000000a2');
SELECT throws_ok($$SELECT public.start_job_search('00000005-0000-0000-0001-000000000002')$$,
  'P0001', NULL, 'Pausierte Stelle: kein „Ich suche“');
SELECT is((SELECT paused_at IS NOT NULL FROM public.recruiter_jobs_view WHERE id = '00000005-0000-0000-0001-000000000002'),
          true, 'Headhunter sieht die Stelle als pausiert');
SELECT tests.authenticate_as('00000005-0000-0000-0000-0000000000a1');
SELECT throws_ok(
  $$INSERT INTO public.submissions (job_id, candidate_id, recruiter_id) VALUES
    ('00000005-0000-0000-0001-000000000002', '00000005-0000-0000-0002-000000000002', '00000005-0000-0000-0000-0000000000a1')$$,
  'P0001', NULL, 'Einreichen bei pausierter Stelle gesperrt (Fehler von früher)');

SELECT tests.authenticate_as('00000005-0000-0000-0000-0000000000c1');
SELECT lives_ok($$SELECT public.client_resume_job('00000005-0000-0000-0001-000000000002')$$, 'Weitersuchen');
SELECT tests.clear_auth();
SELECT is((SELECT status FROM public.recruiter_job_activations
            WHERE recruiter_id = '00000005-0000-0000-0000-0000000000a1' AND job_id = '00000005-0000-0000-0001-000000000002'),
          'active', 'Suche läuft wieder');

SELECT tests.authenticate_as('00000005-0000-0000-0000-0000000000c1');
SELECT throws_ok($$SELECT public.client_close_job('00000005-0000-0000-0001-000000000002', 'filled_elsewhere')$$,
  'P0001', NULL, 'Anderweitig besetzt nur mit Bestätigung');
SELECT lives_ok($$SELECT public.client_close_job('00000005-0000-0000-0001-000000000002', 'filled_elsewhere', NULL, NULL, NULL, NULL, true)$$,
  'Schließen mit Bestätigung');
SELECT tests.clear_auth();
SELECT is((SELECT end_reason FROM public.recruiter_job_activations
            WHERE recruiter_id = '00000005-0000-0000-0000-0000000000a1' AND job_id = '00000005-0000-0000-0001-000000000002'),
          'job_closed', 'Suche endet mit der Stelle');
SELECT is((SELECT status FROM public.jobs WHERE id = '00000005-0000-0000-0001-000000000002'), 'filled', 'Stelle besetzt');

-- ============================================================================
-- D) Kundensicht und Meldung
-- ============================================================================
SELECT tests.authenticate_as('00000005-0000-0000-0000-0000000000c1');
SELECT is((SELECT count(*)::int FROM public.get_job_searchers('00000005-0000-0000-0001-000000000001')), 1,
          'Kunde sieht den suchenden Headhunter');
SELECT is((SELECT full_name FROM public.get_job_searchers('00000005-0000-0000-0001-000000000001')), 'Tobias Klein',
          'mit Namen');
SELECT is((SELECT searching FROM public.get_jobs_searcher_counts(ARRAY['00000005-0000-0000-0001-000000000001'::uuid])), 1,
          'Zahl der Suchenden für die Liste');
SELECT lives_ok($$SELECT public.report_direct_contact('00000005-0000-0000-0001-000000000001',
                    '00000005-0000-0000-0000-0000000000a1', 'phone', 'Hat mich direkt angerufen')$$, 'Direktkontakt melden');

SELECT tests.authenticate_as('00000005-0000-0000-0000-0000000000c3');
SELECT is((SELECT count(*)::int FROM public.get_job_searchers('00000005-0000-0000-0001-000000000001')), 0,
          'Viewer ohne Zuweisung sieht niemanden');
SELECT tests.authenticate_as('00000005-0000-0000-0000-0000000000a2');
SELECT is((SELECT count(*)::int FROM public.get_job_searchers('00000005-0000-0000-0001-000000000001')), 0,
          'Headhunter sehen keine anderen Headhunter');
SELECT is((SELECT count(*)::int FROM public.client_contact_reports), 0, 'Headhunter sehen keine Meldungen');
SELECT tests.authenticate_as('00000005-0000-0000-0000-0000000000d1');
SELECT is((SELECT count(*)::int FROM public.admin_contact_reports()), 1, 'Matchunt sieht die Meldung');

-- ============================================================================
-- E) „Stelle schon direkt“ mit Prüfung
-- ============================================================================
SELECT tests.authenticate_as('00000005-0000-0000-0000-0000000000a2');
SELECT lives_ok($$SELECT public.start_job_search('00000005-0000-0000-0001-000000000004')$$, 'Gold startet J4');
SELECT lives_ok($$SELECT public.answer_client_question('00000005-0000-0000-0001-000000000004', 'direct_position')$$,
  '„Diese Stelle habe ich schon direkt“');
SELECT is((SELECT status || '/' || review_hold FROM public.recruiter_job_activations
            WHERE recruiter_id = '00000005-0000-0000-0000-0000000000a2' AND job_id = '00000005-0000-0000-0001-000000000004'),
          'paused/true', 'Suche ruht während der Prüfung');
SELECT tests.authenticate_as('00000005-0000-0000-0000-0000000000c1');
SELECT lives_ok($$SELECT public.client_answer_direct_position(
                    (SELECT declaration_id FROM public.get_job_direct_position_requests('00000005-0000-0000-0001-000000000004')), 'yes')$$,
  'Kunde bestätigt');
SELECT tests.authenticate_as('00000005-0000-0000-0000-0000000000d1');
SELECT lives_ok($$SELECT public.admin_decide_declaration(
                    (SELECT id FROM public.admin_declarations() WHERE answer = 'direct_position' LIMIT 1), 'confirm')$$,
  'Matchunt bestätigt');
SELECT tests.authenticate_as('00000005-0000-0000-0000-0000000000a2');
SELECT throws_ok($$SELECT public.start_job_search('00000005-0000-0000-0001-000000000004')$$,
  'P0001', 'Diese Stelle bearbeitest du direkt mit dem Kunden.', 'Danach kein erneutes „Ich suche“');

-- ============================================================================
-- F) Vertrauliche Suche und Stufen
-- ============================================================================
SELECT is((SELECT count(*)::int FROM public.recruiter_jobs_view WHERE id = '00000005-0000-0000-0001-000000000005'), 1,
          'Gold sieht die vertrauliche Suche');
SELECT tests.authenticate_as('00000005-0000-0000-0000-0000000000a1');
SELECT is((SELECT count(*)::int FROM public.recruiter_jobs_view WHERE id = '00000005-0000-0000-0001-000000000005'), 0,
          'Partner sieht sie nicht');

SELECT tests.authenticate_as('00000005-0000-0000-0000-0000000000d1');
SELECT throws_ok($$SELECT public.admin_set_partner_tier('00000005-0000-0000-0000-0000000000a1', 'gold', '')$$,
  'P0001', NULL, 'Hochstufen nur mit Begründung');
SELECT tests.clear_auth();
SELECT is(public.partner_tier_target('{"violation":false,"placements":1,"interviews":0,"interview_quote":null,"months_active":1}'),
          'silver', 'Eine Einstellung reicht für Silber');
SELECT is(public.partner_tier_target('{"violation":false,"placements":3,"interviews":9,"interview_quote":0.5,"months_active":4}'),
          'silver', 'Gold erst nach 6 Monaten');

-- ============================================================================
-- G) Wartungslauf: Ablauf ohne Einreichung, Pausen-Ende
-- ============================================================================
SELECT tests.clear_auth();
UPDATE public.recruiter_job_activations SET ends_at = now() - interval '1 minute'
 WHERE recruiter_id = '00000005-0000-0000-0000-0000000000a1' AND job_id = '00000005-0000-0000-0001-000000000011';
UPDATE public.jobs SET paused_at = now() - interval '3 days', pause_until = now() - interval '1 minute'
 WHERE id = '00000005-0000-0000-0001-000000000012';
SELECT lives_ok($$SELECT public.run_search_maintenance()$$, 'Wartungslauf');
SELECT is((SELECT end_reason FROM public.recruiter_job_activations
            WHERE recruiter_id = '00000005-0000-0000-0000-0000000000a1' AND job_id = '00000005-0000-0000-0001-000000000011'),
          'expired', '30 Tage ohne Einreichung: Suche endet');
SELECT is((SELECT paused_at FROM public.jobs WHERE id = '00000005-0000-0000-0001-000000000012'), NULL,
          'Pause vorbei: Stelle läuft wieder');

SELECT * FROM finish();
ROLLBACK;
