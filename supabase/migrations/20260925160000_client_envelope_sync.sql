-- Kundenverträge: Gegenzeichnung sicher erkennen (Entscheidung 25.09.2026).
--
-- Befund Kanna Medics (25.09.2026): Matchunt hatte in DocuSign gegengezeichnet,
-- die Datenbank erfuhr es nie. Der Webhook scheitert ohne HMAC-Schlüssel, und
-- nachgefragt hat nur die Seite des Kunden, und die nur nach SEINER Unterschrift.
-- Ohne erkannte Gegenzeichnung kein Konto und keine Zugangsmail.
--
-- docusign-sync fragt deshalb alle 15 Minuten offene Kundenumschläge ab. DocuSign
-- erlaubt je Umschlag höchstens eine Abfrage alle 15 Minuten; die Spalte hält fest,
-- wann zuletzt gefragt wurde (auch durch docusign-status).

alter table public.commercial_mandates
  add column if not exists envelope_last_synced_at timestamptz;

comment on column public.commercial_mandates.envelope_last_synced_at is
  'Letzte Abfrage des Umschlags bei DocuSign (docusign-sync, docusign-status). DocuSign erlaubt höchstens eine je 15 Minuten.';

-- Nur die offenen Umschläge, älteste Abfrage zuerst.
create index if not exists commercial_mandates_open_envelope_idx
  on public.commercial_mandates (envelope_last_synced_at nulls first)
  where envelope_id is not null and countersigned_at is null;

-- Alle 15 Minuten (gleiches Muster wie die anderen Cron-Läufe).
select cron.schedule(
  'docusign-client-sync',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/docusign-sync',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
