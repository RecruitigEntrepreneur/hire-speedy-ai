-- lovable-cron-fallback-reviewed: DocuSign-Gegenzeichnung ohne verlaesslichen Webhook; 15-Min-Abgleich als Backstop, ersetzt den fehlerhaften Job aus 20260925160000
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