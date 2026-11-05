-- ============================================================================
-- pgTAP · Lebenslauf-Pflicht und Lebenslauf-Speicher
--
-- Testet 20261014120000_lebenslauf_pflicht.sql.
--
--   * Einreichen ohne Lebenslauf geht nicht (auch nicht am Fenster vorbei)
--   * Link, Text-Datei oder alte Version zählen nicht als Lebenslauf
--   * Die Einreichung merkt sich die Lebenslauf-Version, egal was mitgeschickt wird
--   * Speicher: nur der eigene Headhunter und Admins lesen; Kunden und fremde
--     Headhunter nicht
--
-- Ausführen (benötigt Docker + Supabase CLI):
--   supabase start && supabase test db
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(16);

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
  ('00000006-0000-0000-0000-0000000000a1', 'hh1-006@example.com',   '{"role":"recruiter","full_name":"Tobias Klein"}'),
  ('00000006-0000-0000-0000-0000000000a2', 'hh2-006@example.com',   '{"role":"recruiter","full_name":"Julia Hartmann"}'),
  ('00000006-0000-0000-0000-0000000000c1', 'owner-006@example.com', '{"role":"client","full_name":"Kunde Owner"}'),
  ('00000006-0000-0000-0000-0000000000d1', 'admin-006@example.com', '{"role":"client","full_name":"Admin"}');

INSERT INTO public.user_roles (user_id, role) VALUES ('00000006-0000-0000-0000-0000000000d1', 'admin');

INSERT INTO public.jobs (id, client_id, title, company_name, status) VALUES
  ('00000006-0000-0000-0001-000000000001', '00000006-0000-0000-0000-0000000000c1', 'Stelle 1', 'MedTec Süd GmbH', 'published');

INSERT INTO public.candidates (id, recruiter_id, full_name, email, cv_url) VALUES
  ('00000006-0000-0000-0002-000000000001', '00000006-0000-0000-0000-0000000000a1', 'Lena K.',  'lena-006@example.com',  'https://linkedin.com/in/lena'),
  ('00000006-0000-0000-0002-000000000002', '00000006-0000-0000-0000-0000000000a1', 'Jonas M.', 'jonas-006@example.com', NULL);

-- Lena: nur Link und Text-Datei, dazu eine alte PDF-Version
INSERT INTO public.candidate_documents (id, candidate_id, document_type, file_name, file_url, is_current, created_at) VALUES
  ('00000006-0000-0000-0004-000000000001', '00000006-0000-0000-0002-000000000001', 'cv', 'lena.txt', 'https://x.test/storage/v1/object/public/cv-documents/00000006-0000-0000-0000-0000000000a1/lena.txt', true, now()),
  ('00000006-0000-0000-0004-000000000002', '00000006-0000-0000-0002-000000000001', 'cv', 'lena-alt.pdf', 'https://x.test/storage/v1/object/public/cv-documents/00000006-0000-0000-0000-0000000000a1/lena-alt.pdf', false, now() - interval '1 year');

-- Suche läuft, Kundenfrage beantwortet (Voraussetzungen aus 20261008120000)
SELECT tests.authenticate_as('00000006-0000-0000-0000-0000000000a1');
DO $$
BEGIN
  PERFORM public.start_job_search('00000006-0000-0000-0001-000000000001');
  PERFORM public.answer_client_question('00000006-0000-0000-0001-000000000001', 'no');
END $$;

-- ============================================================================
-- A) Pflicht beim Einreichen
-- ============================================================================
SELECT throws_ok(
  $$INSERT INTO public.submissions (job_id, candidate_id, recruiter_id) VALUES
    ('00000006-0000-0000-0001-000000000001', '00000006-0000-0000-0002-000000000002', '00000006-0000-0000-0000-0000000000a1')$$,
  'P0001', 'Ohne Lebenslauf kann der Kandidat nicht eingereicht werden.', 'Ohne Lebenslauf gesperrt');

SELECT throws_ok(
  $$INSERT INTO public.submissions (job_id, candidate_id, recruiter_id) VALUES
    ('00000006-0000-0000-0001-000000000001', '00000006-0000-0000-0002-000000000001', '00000006-0000-0000-0000-0000000000a1')$$,
  'P0001', 'Ohne Lebenslauf kann der Kandidat nicht eingereicht werden.', 'Link, Text-Datei und alte Version zählen nicht');

SELECT tests.clear_auth();
INSERT INTO public.candidate_documents (id, candidate_id, document_type, file_name, file_url, is_current) VALUES
  ('00000006-0000-0000-0004-000000000003', '00000006-0000-0000-0002-000000000002', 'cv', 'Jonas_CV.docx',
   'https://x.test/storage/v1/object/public/cv-documents/00000006-0000-0000-0002-000000000002/cv_v1.docx', true);
SELECT tests.authenticate_as('00000006-0000-0000-0000-0000000000a1');

SELECT lives_ok(
  $$INSERT INTO public.submissions (id, job_id, candidate_id, recruiter_id, cv_document_id) VALUES
    ('00000006-0000-0000-0003-000000000001', '00000006-0000-0000-0001-000000000001', '00000006-0000-0000-0002-000000000002',
     '00000006-0000-0000-0000-0000000000a1', '00000006-0000-0000-0004-000000000002')$$,
  'Mit Word-Lebenslauf geht es');

SELECT is((SELECT cv_document_id FROM public.submissions WHERE id = '00000006-0000-0000-0003-000000000001'),
          '00000006-0000-0000-0004-000000000003'::uuid,
          'Eingereichte Version setzt die Datenbank, nicht der Aufrufer');

SELECT tests.clear_auth();
SELECT is((SELECT count(*)::int FROM public.submissions WHERE candidate_id = '00000006-0000-0000-0002-000000000001'), 0,
          'Lena wurde nicht eingereicht');

-- Systemprozesse sind ausgenommen (bestehende Abläufe ohne Anmeldung)
SELECT lives_ok(
  $$INSERT INTO public.submissions (id, job_id, candidate_id, recruiter_id) VALUES
    ('00000006-0000-0000-0003-000000000002', '00000006-0000-0000-0001-000000000001', '00000006-0000-0000-0002-000000000001',
     '00000006-0000-0000-0000-0000000000a1')$$,
  'Service Role ist ausgenommen');
SELECT is((SELECT cv_document_id FROM public.submissions WHERE id = '00000006-0000-0000-0003-000000000002'), NULL,
          'Ohne Lebenslauf bleibt die Version leer');

-- Bestehende Einreichungen bleiben unberührt
SELECT lives_ok(
  $$UPDATE public.submissions SET recruiter_notes = 'nachgetragen' WHERE id = '00000006-0000-0000-0003-000000000002'$$,
  'Ändern alter Einreichungen geht weiter');

-- ============================================================================
-- B) Speicher cv-documents
-- ============================================================================
SELECT tests.authenticate_as('00000006-0000-0000-0000-0000000000a1');
SELECT ok(public.can_access_cv_object('00000006-0000-0000-0000-0000000000a1/x.pdf'), 'Eigener Ordner');
SELECT ok(public.can_access_cv_object('00000006-0000-0000-0002-000000000002/cv_v1.docx'), 'Ordner des eigenen Kandidaten');
SELECT ok(public.can_access_cv_object('email-imports/00000006-0000-0000-0000-0000000000a1/a.pdf'), 'Eigener E-Mail-Eingang');

SELECT tests.authenticate_as('00000006-0000-0000-0000-0000000000a2');
SELECT ok(NOT public.can_access_cv_object('00000006-0000-0000-0000-0000000000a1/x.pdf'), 'Fremder Headhunter: fremder Ordner gesperrt');
SELECT ok(NOT public.can_access_cv_object('00000006-0000-0000-0002-000000000002/cv_v1.docx'), 'Fremder Headhunter: fremder Kandidat gesperrt');

SELECT tests.authenticate_as('00000006-0000-0000-0000-0000000000c1');
SELECT ok(NOT public.can_access_cv_object('00000006-0000-0000-0002-000000000002/cv_v1.docx'), 'Kunde liest den Speicher nicht direkt');

SELECT tests.authenticate_as('00000006-0000-0000-0000-0000000000d1');
SELECT ok(public.can_access_cv_object('00000006-0000-0000-0002-000000000002/cv_v1.docx'), 'Admin darf lesen');

SELECT tests.clear_auth();
SELECT ok(NOT public.can_access_cv_object('00000006-0000-0000-0000-0000000000a1/x.pdf'), 'Ohne Anmeldung nichts');

SELECT * FROM finish();
ROLLBACK;
