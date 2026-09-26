-- ============================================================================
-- Cron docusign-client-sync ohne app.settings
-- ============================================================================
-- Befund (Live, 26.09.2026): Der Job aus 20260925160000 scheiterte bei jedem
-- Lauf, weil current_setting('app.settings.supabase_url') und
-- 'app.settings.service_role_key' in diesem Projekt nicht gesetzt sind. Kein
-- offener Kundenvertrag wurde je abgefragt; ohne passenden HMAC-Schlüssel
-- erfuhr das System eine Gegenzeichnung damit gar nicht mehr von selbst.
--
-- Neu: ein eigener Schlüssel nur für diesen Aufruf. Er wird HIER erzeugt und
-- liegt im Schema private, das die API nicht ausliefert -- niemand muss ihn
-- kennen oder eintragen. Der Cron schickt ihn als x-cron-token, docusign-sync
-- prüft ihn über cron_token_valid (nur mit dem Service-Schlüssel aufrufbar).
-- Die Projektadresse ist nicht geheim (steht in jedem Frontend-Build).
-- ============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS private.cron_tokens (
  name       text PRIMARY KEY,
  token      text NOT NULL CHECK (length(token) >= 32),
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.cron_tokens FROM PUBLIC;
REVOKE ALL ON private.cron_tokens FROM anon, authenticated;

INSERT INTO private.cron_tokens (name, token)
VALUES ('docusign-sync', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
ON CONFLICT (name) DO NOTHING;

-- Passt der Schlüssel? Nur für das Backend (Service-Rolle), nie für Nutzer.
CREATE OR REPLACE FUNCTION public.cron_token_valid(_name text, _token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT coalesce(length(_token) >= 32, false)
     AND EXISTS (SELECT 1 FROM private.cron_tokens t WHERE t.name = _name AND t.token = _token);
$fn$;
REVOKE ALL ON FUNCTION public.cron_token_valid(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cron_token_valid(text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_token_valid(text, text) TO service_role;

-- Derselbe Jobname ersetzt den alten, fehlerhaften Befehl.
SELECT cron.schedule(
  'docusign-client-sync',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dngycrrhbnwdohbftpzq.supabase.co/functions/v1/docusign-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-token', (SELECT token FROM private.cron_tokens WHERE name = 'docusign-sync')
    ),
    body := '{}'::jsonb
  );
  $$
);

COMMIT;
