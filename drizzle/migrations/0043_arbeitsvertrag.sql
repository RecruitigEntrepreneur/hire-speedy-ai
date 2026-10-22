-- ============================================================================
-- Arbeitsvertrag und Unterschrift (Einstellungsprozess Paket 3, 22.10.2026)
-- ============================================================================
-- Nach der Zusage schickt der Kunde den Arbeitsvertrag:
--   digital  Kunde lädt seinen Vertrag hoch, DocuSign: erst die Firma, dann der
--            Kandidat. Abgeschlossen = unterschrieben, ohne Meldung.
--   self     Kunde schickt selbst (Papier, eigenes Tool). Melden darf jede Seite:
--            Kunde (24 h rückgängig, Headhunter macht die Gegenprobe), Headhunter
--            oder Matchunt (Kunde bestätigt; Matchunt mit Beleg direkt).
-- Ohne Meldung: Tag 7 Mail an den Kunden, Tag 10 Aufgabe für den Headhunter,
-- Tag 21 Fall für Matchunt (täglicher Lauf contract-followups).
--
-- Stände (status):
--   preparing       Vertrag in Arbeit (Weg gewählt, noch nicht verschickt)
--   sent_self       vom Kunden selbst verschickt (Angabe des Kunden)
--   sent_digital    über DocuSign verschickt, Firma unterschreibt zuerst
--   company_signed  Firma hat unterschrieben, Kandidat offen
--   reported        Headhunter oder Matchunt meldet, Kunde bestätigt noch
--   signed          beide unterschrieben; nach Kundenmeldung 24 h rückgängig
--   final           verbindlich (Grundlage für Einstellung und Rechnung, Paket 4)
--   declined        Kandidat hat in DocuSign abgelehnt
--   dropped         Kandidat ist abgesprungen
--   voided          digitaler Umschlag zurückgezogen
--
-- Geschrieben wird nur über die Function employment-contract (Service-Role).
-- Das unterschriebene PDF sehen Kunde und Matchunt; der Headhunter nur das Datum
-- (my_contract_tasks liefert ihm keine Dateipfade).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.employment_contracts (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id          uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  offer_id               uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  job_id                 uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  way                    text NOT NULL DEFAULT 'self' CHECK (way IN ('digital', 'self')),
  status                 text NOT NULL DEFAULT 'preparing'
                         CHECK (status IN ('preparing', 'sent_self', 'sent_digital', 'company_signed', 'reported', 'signed', 'final', 'declined', 'dropped', 'voided')),
  previous_status        text,
  sent_at                timestamptz,
  -- digital
  envelope_id            text,
  document_path          text,
  signed_document_path   text,
  company_signer_name    text,
  company_signer_email   text,
  candidate_email        text,
  company_signed_at      timestamptz,
  candidate_signed_at    timestamptz,
  envelope_synced_at     timestamptz,
  fixed_term             boolean,
  non_compete            boolean,
  -- Werte laut Vertrag (Grundlage der Rechnung)
  signed_on              date,
  salary                 integer CHECK (salary IS NULL OR salary BETWEEN 10000 AND 2000000),
  variable_salary        integer CHECK (variable_salary IS NULL OR variable_salary BETWEEN 0 AND 2000000),
  start_date             date,
  close_job              boolean NOT NULL DEFAULT false,
  -- Meldung und Bestätigung
  reported_by            uuid,
  reported_role          text CHECK (reported_role IS NULL OR reported_role IN ('client', 'recruiter', 'admin', 'docusign')),
  reported_at            timestamptz,
  report_note            text CHECK (report_note IS NULL OR length(report_note) <= 2000),
  evidence_note          text CHECK (evidence_note IS NULL OR length(evidence_note) <= 2000),
  undo_until             timestamptz,
  confirmed_by           uuid,
  confirmed_at           timestamptz,
  recruiter_check        text CHECK (recruiter_check IS NULL OR recruiter_check IN ('ok', 'differs')),
  recruiter_check_note   text CHECK (recruiter_check_note IS NULL OR length(recruiter_check_note) <= 2000),
  recruiter_checked_at   timestamptz,
  decline_reason         text CHECK (decline_reason IS NULL OR length(decline_reason) <= 2000),
  drop_reason            text CHECK (drop_reason IS NULL OR length(drop_reason) <= 2000),
  final_at               timestamptz,
  -- Erinnerungen ohne Meldung (je einmal)
  client_reminded_at     timestamptz,
  recruiter_reminded_at  timestamptz,
  admin_case_at          timestamptz,
  created_by             uuid,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Je Bewerbung ein laufender Vertrag; abgesprungen/zurückgezogen/abgelehnt zählt nicht mehr.
CREATE UNIQUE INDEX IF NOT EXISTS employment_contracts_one_open
  ON public.employment_contracts (submission_id)
  WHERE status NOT IN ('dropped', 'voided', 'declined');
CREATE INDEX IF NOT EXISTS employment_contracts_envelope_idx ON public.employment_contracts (envelope_id) WHERE envelope_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS employment_contracts_job_idx ON public.employment_contracts (job_id);

CREATE TABLE IF NOT EXISTS public.employment_contract_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id  uuid NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
  event_type   text NOT NULL,
  actor_role   text,
  actor_id     uuid,
  details      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employment_contract_events_contract_idx ON public.employment_contract_events (contract_id, created_at);

ALTER TABLE public.employment_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employment_contract_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Kundenteam liest Arbeitsverträge" ON public.employment_contracts;
CREATE POLICY "Kundenteam liest Arbeitsverträge" ON public.employment_contracts
  FOR SELECT USING (public.can_access_job(job_id));

DROP POLICY IF EXISTS "Admins lesen Arbeitsverträge" ON public.employment_contracts;
CREATE POLICY "Admins lesen Arbeitsverträge" ON public.employment_contracts
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins lesen Vertragsverlauf" ON public.employment_contract_events;
CREATE POLICY "Admins lesen Vertragsverlauf" ON public.employment_contract_events
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.employment_contracts TO authenticated;
GRANT ALL ON public.employment_contracts TO service_role;
GRANT SELECT ON public.employment_contract_events TO authenticated;
GRANT ALL ON public.employment_contract_events TO service_role;

-- Headhunter: Stand seiner Verträge ohne Dateien und ohne Firmen-Unterzeichner
CREATE OR REPLACE FUNCTION public.my_contract_tasks()
RETURNS TABLE (
  contract_id uuid, submission_id uuid, way text, status text, sent_at timestamptz,
  company_signed_at timestamptz, candidate_signed_at timestamptz, reported_role text, reported_at timestamptz,
  recruiter_check text, signed_on date, salary integer, variable_salary integer, start_date date,
  undo_until timestamptz, final_at timestamptz, updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.submission_id, c.way, c.status, c.sent_at,
         c.company_signed_at, c.candidate_signed_at, c.reported_role, c.reported_at,
         c.recruiter_check, c.signed_on, c.salary, c.variable_salary, c.start_date,
         c.undo_until, c.final_at, c.updated_at
  FROM public.employment_contracts c
  JOIN public.submissions s ON s.id = c.submission_id
  WHERE s.recruiter_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.my_contract_tasks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_contract_tasks() TO authenticated;

-- Täglicher Lauf: Erinnerungen Tag 7/10/21, abgelaufene 24-h-Fenster verbindlich machen
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('contract-followups') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'contract-followups');
    PERFORM cron.schedule('contract-followups', '0 7 * * *', $job$
      SELECT net.http_post(
        url := 'https://dngycrrhbnwdohbftpzq.supabase.co/functions/v1/contract-followups',
        headers := jsonb_build_object('Content-Type', 'application/json',
                                      'x-cron-token', private.cron_token_for('contract-followups')),
        body := '{}'::jsonb);
    $job$);
  END IF;
END;
$$;
