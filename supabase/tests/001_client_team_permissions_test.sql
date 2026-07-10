-- ============================================================================
-- pgTAP · Berechtigungsmatrix Client-Teams (Phase 1)
--
-- Testet die RLS-/View-Schicht aus 20260710130000_client_team_foundation.sql:
--   * Mandanten-Isolation (Org A sieht nie Daten von Org B)
--   * Job-Scoping: hiring_manager/viewer nur zugewiesene Jobs; hr/owner alles
--   * Viewer strikt read-only (außer Kommentare)
--   * Deaktivierte Mitglieder verlieren SOFORT jeden Zugriff
--   * Triple-Blind-PII-Gates (identity_unlocked) bleiben intakt
--   * Invite-Tokens nicht mehr öffentlich lesbar
--   * Audit-Logging (Team-Events, Kandidaten-Profilzugriff)
--
-- Ausführen (benötigt Docker + Supabase CLI):
--   supabase start && supabase test db
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(40);

-- ----------------------------------------------------------------------------
-- Impersonation-Helfer (session_user bleibt postgres → Rollenwechsel erlaubt)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- Seed: 2 Organisationen, 7 User, 3 Jobs, 4 Kandidaten, 4 Submissions
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner-a@test.de',    'x', now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'hr-a@test.de',       'x', now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'hm-a@test.de',       'x', now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'viewer-a@test.de',   'x', now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'inactive-a@test.de', 'x', now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner-b@test.de',    'x', now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'recruiter@test.de',  'x', now(), '{"provider":"email","providers":["email"]}', '{"role":"recruiter"}');

INSERT INTO public.organizations (id, name, type, owner_id)
VALUES
  ('a1111111-0000-0000-0000-000000000000', 'Org A GmbH', 'client', 'a0000000-0000-0000-0000-000000000001'),
  ('b1111111-0000-0000-0000-000000000000', 'Org B AG',   'client', 'b0000000-0000-0000-0000-000000000001');

INSERT INTO public.organization_members (organization_id, user_id, role, status, joined_at)
VALUES
  ('a1111111-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'owner',          'active',   now()),
  ('a1111111-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'hr',             'active',   now()),
  ('a1111111-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'hiring_manager', 'active',   now()),
  ('a1111111-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000004', 'viewer',         'active',   now()),
  ('a1111111-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000005', 'hiring_manager', 'inactive', now()),
  ('b1111111-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000001', 'owner',          'active',   now());

INSERT INTO public.jobs (id, client_id, organization_id, title, company_name, status)
VALUES
  ('a2222222-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000000', 'Job A1', 'Org A GmbH', 'published'),
  ('a2222222-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000000', 'Job A2', 'Org A GmbH', 'published'),
  ('b2222222-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'b1111111-0000-0000-0000-000000000000', 'Job B1', 'Org B AG',   'published');

-- HM, Viewer und das deaktivierte Mitglied sind Job A1 zugewiesen (A2 nicht!)
INSERT INTO public.job_collaborators (job_id, user_id, role, added_by)
VALUES
  ('a2222222-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'hiring_manager', 'a0000000-0000-0000-0000-000000000001'),
  ('a2222222-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'viewer',         'a0000000-0000-0000-0000-000000000001'),
  ('a2222222-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', 'hiring_manager', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT (job_id, user_id) DO NOTHING;

INSERT INTO public.candidates (id, recruiter_id, full_name, email)
VALUES
  ('c3333333-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Max Verdeckt',     'max@test.de'),
  ('c3333333-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'Klara Kandidatin', 'klara@test.de'),
  ('c3333333-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'Tom Anonym',       'tom@test.de'),
  ('c3333333-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'Bea Fremd',        'bea@test.de');

INSERT INTO public.submissions (id, job_id, candidate_id, recruiter_id, status, identity_unlocked)
VALUES
  ('d4444444-0000-0000-0000-000000000001', 'a2222222-0000-0000-0000-000000000001', 'c3333333-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'submitted', false),
  ('d4444444-0000-0000-0000-000000000002', 'a2222222-0000-0000-0000-000000000001', 'c3333333-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'submitted', true),
  ('d4444444-0000-0000-0000-000000000003', 'a2222222-0000-0000-0000-000000000002', 'c3333333-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'submitted', false),
  ('d4444444-0000-0000-0000-000000000004', 'b2222222-0000-0000-0000-000000000001', 'c3333333-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'submitted', false);

-- Eine offene Einladung in Org A (für Leak-Test)
INSERT INTO public.organization_invites (organization_id, email, role, token_hash, expires_at, invited_by)
VALUES ('a1111111-0000-0000-0000-000000000000', 'neu@test.de', 'hiring_manager', 'nur-ein-test-hash', now() + interval '7 days', 'a0000000-0000-0000-0000-000000000001');

-- ============================================================================
-- A · Job-Sichtbarkeit
-- ============================================================================
SELECT tests.authenticate_as('a0000000-0000-0000-0000-000000000002');  -- hr_a
SELECT is(
  (SELECT count(*) FROM public.jobs WHERE id IN ('a2222222-0000-0000-0000-000000000001','a2222222-0000-0000-0000-000000000002','b2222222-0000-0000-0000-000000000001')),
  2::bigint, 'HR sieht alle Jobs der eigenen Org, keine fremden');

SELECT tests.authenticate_as('a0000000-0000-0000-0000-000000000003');  -- hm_a
SELECT is(
  (SELECT count(*) FROM public.jobs WHERE id IN ('a2222222-0000-0000-0000-000000000001','a2222222-0000-0000-0000-000000000002','b2222222-0000-0000-0000-000000000001')),
  1::bigint, 'Hiring Manager sieht nur zugewiesene Jobs');
SELECT is(
  (SELECT count(*) FROM public.jobs WHERE id = 'a2222222-0000-0000-0000-000000000002'),
  0::bigint, 'Hiring Manager sieht NICHT den nicht zugewiesenen Org-Job');

SELECT tests.authenticate_as('a0000000-0000-0000-0000-000000000004');  -- viewer_a
SELECT is(
  (SELECT count(*) FROM public.jobs WHERE id = 'a2222222-0000-0000-0000-000000000001'),
  1::bigint, 'Viewer sieht den zugewiesenen Job');

SELECT tests.authenticate_as('a0000000-0000-0000-0000-000000000005');  -- inactive_a
SELECT is(
  (SELECT count(*) FROM public.jobs WHERE id IN ('a2222222-0000-0000-0000-000000000001','a2222222-0000-0000-0000-000000000002','b2222222-0000-0000-0000-000000000001')),
  0::bigint, 'Deaktiviertes Mitglied sieht keine Jobs mehr (trotz Collaborator-Eintrag)');

SELECT tests.authenticate_as('b0000000-0000-0000-0000-000000000001');  -- owner_b
SELECT is(
  (SELECT count(*) FROM public.jobs WHERE id IN ('a2222222-0000-0000-0000-000000000001','a2222222-0000-0000-0000-000000000002','b2222222-0000-0000-0000-000000000001')),
  1::bigint, 'Owner B sieht nur den eigenen Job (Cross-Tenant-Isolation)');

SELECT tests.authenticate_as('a0000000-0000-0000-0000-000000000001');  -- owner_a
SELECT is(
  (SELECT count(*) FROM public.jobs WHERE id IN ('a2222222-0000-0000-0000-000000000001','a2222222-0000-0000-0000-000000000002','b2222222-0000-0000-0000-000000000001')),
  2::bigint, 'Owner A sieht beide Org-A-Jobs');

-- ============================================================================
-- B · Job-Bearbeitung
-- ============================================================================
SELECT tests.authenticate_as('a0000000-0000-0000-0000-000000000003');  -- hm_a
SELECT is(
  (WITH u AS (UPDATE public.jobs SET description = 'edit' WHERE id = 'a2222222-0000-0000-0000-000000000001' RETURNING 1) SELECT count(*) FROM u),
  1::bigint, 'Hiring Manager kann zugewiesenen Job bearbeiten');
SELECT is(
  (WITH u AS (UPDATE public.jobs SET description = 'edit' WHERE id = 'a2222222-0000-0000-0000-000000000002' RETURNING 1) SELECT count(*) FROM u),
  0::bigint, 'Hiring Manager kann fremden Org-Job NICHT bearbeiten');

SELECT tests.authenticate_as('a0000000-0000-0000-0000-000000000004');  -- viewer_a
SELECT is(
  (WITH u AS (UPDATE public.jobs SET description = 'edit' WHERE id = 'a2222222-0000-0000-0000-000000000001' RETURNING 1) SELECT count(*) FROM u),
  0::bigint, 'Viewer kann Jobs NICHT bearbeiten (read-only)');

SELECT tests.authenticate_as('a0000000-0000-0000-0000-000000000005');  -- inactive_a
SELECT is(
  (WITH u AS (UPDATE public.jobs SET description = 'edit' WHERE id = 'a2222222-0000-0000-0000-000000000001' RETURNING 1) SELECT count(*) FROM u),
  0::bigint, 'Deaktiviertes Mitglied kann Jobs NICHT bearbeiten');

-- ============================================================================
-- C · Job-Erstellung (Intake)
-- ============================================================================
SELECT tests.authenticate_as('a0000000-0000-0000-0000-000000000004');  -- viewer_a
SELECT throws_ok(
  $$ INSERT INTO public.jobs (client_id, title, company_name) VALUES ('a0000000-0000-0000-0000-000000000004', 'Viewer Job', 'Org A GmbH') $$,
  '42501', NULL, 'Viewer darf KEINE Jobs anlegen');

SELECT tests.authenticate_as('a0000000-0000-0000-0000-000000000003');  -- hm_a
SELECT lives_ok(
  $$ INSERT INTO public.jobs (id, client_id, title, company_name) VALUES ('a2222222-0000-0000-0000-000000000099', 'a0000000-0000-0000-0000-000000000003', 'HM Test Job', 'Org A GmbH') $$,
  'Hiring Manager darf Job-Intake anlegen');

SELECT tests.clear_auth();
SELECT is(
  (SELECT organization_id FROM public.jobs WHERE id = 'a2222222-0000-0000-0000-000000000099'),
  'a1111111-0000-0000-0000-000000000000'::uuid, 'Neuer Job erbt die Organisation des Erstellers (Trigger)');
SELECT is(
  (SELECT count(*) FROM public.job_collaborators WHERE job_id = 'a2222222-0000-0000-0000-000000000099' AND user_id = 'a0000000-0000-0000-0000-000000000003'),
  1::bigint, 'Ersteller wird automatisch job_collaborator (Trigger)');

-- ============================================================================
-- D · Submissions
-- ============================================================================
SELECT tests.authenticate_as('a0000000-0000-0000-0000-000000000003');  -- hm_a
SELECT is(
  (SELECT count(*) FROM public.submissions WHERE id IN ('d4444444-0000-0000-0000-000000000001','d4444444-0000-0000-0000-000000000002','d4444444-0000-0000-0000-000000000003','d4444444-0000-0000-0000-000000000004')),
  2::bigint, 'Hiring Manager sieht nur Submissions seiner zugewiesenen Jobs');
SELECT is(
  (WITH u AS (UPDATE public.submissions SET client_notes = 'x' WHERE id = 'd4444444-0000-0000-0000-000000000001' RETURNING 1) SELECT count(*) FROM u),
  1::bigint, 'Hiring Manager kann Submission seines Jobs aktualisieren');

SELECT tests.authenticate_as('a0000000-0000-0000-0000-000000000004');  -- viewer_a
SELECT is(
  (WITH u AS (UPDATE public.submissions SET client_notes = 'x' WHERE id = 'd4444444-0000-0000-0000-000000000001' RETURNING 1) SELECT count(*) FROM u),
  0::bigint, 'Viewer kann Submissions NICHT aktualisieren');

SELECT tests.authenticate_as('b0000000-0000-0000-0000-000000000001');  -- owner_b
SELECT is(
  (SELECT count(*) FROM public.submissions WHERE id IN ('d4444444-0000-0000-0000-000000000001','d4444444-0000-0000-0000-000000000002','d4444444-0000-0000-0000-000000000003','d4444444-0000-0000-0000-000000000004')),
  1::bigint, 'Owner B sieht nur die Submission des eigenen Jobs');

-- ============================================================================
-- E · Triple-Blind: client_candidate_view + Rohtabelle candidates
-- ============================================================================
SELECT tests.authenticate_as('a0000000-0000-0000-0000-000000000003');  -- hm_a
SELECT is(
  (SELECT count(*) FROM public.client_candidate_view WHERE submission_id IN ('d4444444-0000-0000-0000-000000000001','d4444444-0000-0000-0000-000000000002','d4444444-0000-0000-0000-000000000003','d4444444-0000-0000-0000-000000000004')),
  2::bigint, 'View liefert dem HM nur Kandidaten seiner Jobs');
SELECT ok(
  (SELECT full_name FROM public.client_candidate_view WHERE submission_id = 'd4444444-0000-0000-0000-000000000001') IS NULL,
  'PII-Gate: Name ist NULL solange identity_unlocked = false');
SELECT is(
  (SELECT full_name FROM public.client_candidate_view WHERE submission_id = 'd4444444-0000-0000-0000-000000000002'),
  'Klara Kandidatin', 'PII-Gate: Name sichtbar nach Reveal (identity_unlocked = true)');
SELECT is(
  (SELECT count(*) FROM public.candidates WHERE id IN ('c3333333-0000-0000-0000-000000000001','c3333333-0000-0000-0000-000000000002','c3333333-0000-0000-0000-000000000003','c3333333-0000-0000-0000-000000000004')),
  1::bigint, 'Rohtabelle candidates: nur der revealte Kandidat ist lesbar');

SELECT tests.authenticate_as('b0000000-0000-0000-0000-000000000001');  -- owner_b
SELECT is(
  (SELECT count(*) FROM public.client_candidate_view WHERE submission_id IN ('d4444444-0000-0000-0000-000000000001','d4444444-0000-0000-0000-000000000002','d4444444-0000-0000-0000-000000000003','d4444444-0000-0000-0000-000000000004')),
  1::bigint, 'View: Owner B sieht nur den Kandidaten des eigenen Jobs (Cross-Tenant)');

-- ============================================================================
-- F · Kommentare (Viewer darf, Deaktivierte nicht)
-- ============================================================================
SELECT tests.authenticate_as('a0000000-0000-0000-0000-000000000004');  -- viewer_a
SELECT lives_ok(
  $$ INSERT INTO public.candidate_comments (submission_id, user_id, content) VALUES ('d4444444-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'Viewer-Kommentar') $$,
  'Viewer darf Kandidaten kommentieren');

SELECT tests.authenticate_as('a0000000-0000-0000-0000-000000000005');  -- inactive_a
SELECT throws_ok(
  $$ INSERT INTO public.candidate_comments (submission_id, user_id, content) VALUES ('d4444444-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', 'Sollte scheitern') $$,
  '42501', NULL, 'Deaktiviertes Mitglied darf NICHT kommentieren');

-- ============================================================================
-- G · Team-Verwaltung: Mitglieder & Einladungen
-- ============================================================================
SELECT tests.authenticate_as('a0000000-0000-0000-0000-000000000003');  -- hm_a
SELECT is(
  (SELECT count(*) FROM public.organization_members WHERE organization_id = 'a1111111-0000-0000-0000-000000000000'),
  5::bigint, 'Mitglied kann Team-Liste der eigenen Org lesen (keine Policy-Rekursion)');

SELECT tests.authenticate_as('b0000000-0000-0000-0000-000000000001');  -- owner_b
SELECT is(
  (SELECT count(*) FROM public.organization_members WHERE organization_id = 'a1111111-0000-0000-0000-000000000000'),
  0::bigint, 'Owner B sieht KEINE Mitglieder von Org A');

SELECT tests.authenticate_as('a0000000-0000-0000-0000-000000000003');  -- hm_a
SELECT is(
  (SELECT count(*) FROM public.organization_invites WHERE organization_id = 'a1111111-0000-0000-0000-000000000000'),
  0::bigint, 'Invite-Leak geschlossen: Nicht-Admins sehen keine Einladungen/Tokens');

SELECT tests.authenticate_as('a0000000-0000-0000-0000-000000000002');  -- hr_a
SELECT is(
  (SELECT count(*) FROM public.organization_invites WHERE organization_id = 'a1111111-0000-0000-0000-000000000000'),
  0::bigint, 'Auch HR (kein Org-Admin) sieht keine Einladungen');
SELECT is(
  (WITH u AS (UPDATE public.organization_members SET role = 'viewer' WHERE organization_id = 'a1111111-0000-0000-0000-000000000000' AND user_id = 'a0000000-0000-0000-0000-000000000003' RETURNING 1) SELECT count(*) FROM u),
  0::bigint, 'HR kann Rollen NICHT ändern (nur owner/admin)');

SELECT tests.authenticate_as('a0000000-0000-0000-0000-000000000001');  -- owner_a
SELECT is(
  (SELECT count(*) FROM public.organization_invites WHERE organization_id = 'a1111111-0000-0000-0000-000000000000'),
  1::bigint, 'Owner sieht die offene Einladung der eigenen Org');
SELECT is(
  (WITH u AS (UPDATE public.organization_members SET role = 'hiring_manager' WHERE organization_id = 'a1111111-0000-0000-0000-000000000000' AND user_id = 'a0000000-0000-0000-0000-000000000004' RETURNING 1) SELECT count(*) FROM u),
  1::bigint, 'Owner kann Rollen ändern');

-- ============================================================================
-- H · Audit & Helfer
-- ============================================================================
SELECT tests.clear_auth();
SELECT ok(
  (SELECT count(*) FROM public.activity_logs WHERE organization_id = 'a1111111-0000-0000-0000-000000000000' AND action = 'team_role_changed') >= 1,
  'Rollenwechsel wird im Audit-Log protokolliert');

SELECT tests.authenticate_as('a0000000-0000-0000-0000-000000000003');  -- hm_a
SELECT lives_ok(
  $$ SELECT public.log_candidate_access('d4444444-0000-0000-0000-000000000001') $$,
  'log_candidate_access läuft für berechtigten Zugriff');
SELECT lives_ok(
  $$ SELECT public.log_candidate_access('d4444444-0000-0000-0000-000000000004') $$,
  'log_candidate_access wirft nicht bei fremder Submission (No-Op)');

SELECT tests.clear_auth();
SELECT is(
  (SELECT count(*) FROM public.activity_logs WHERE action = 'candidate_profile_viewed' AND entity_id = 'd4444444-0000-0000-0000-000000000001' AND user_id = 'a0000000-0000-0000-0000-000000000003'),
  1::bigint, 'DSGVO: Kandidaten-Profilzugriff wird mit Org protokolliert');
SELECT is(
  (SELECT count(*) FROM public.activity_logs WHERE action = 'candidate_profile_viewed' AND entity_id = 'd4444444-0000-0000-0000-000000000004'),
  0::bigint, 'DSGVO: Unberechtigter Zugriff erzeugt KEINEN Log (und keine Daten)');

SELECT is(
  public.org_intake_approval_required('a1111111-0000-0000-0000-000000000000'),
  false, 'intake_approval_required ist standardmäßig aus');

UPDATE public.organizations
SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{intake_approval_required}', 'true')
WHERE id = 'a1111111-0000-0000-0000-000000000000';

SELECT is(
  public.org_intake_approval_required('a1111111-0000-0000-0000-000000000000'),
  true, 'intake_approval_required liest das Org-Setting');

SELECT * FROM finish();

ROLLBACK;
