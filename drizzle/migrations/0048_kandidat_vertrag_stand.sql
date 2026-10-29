-- ============================================================================
-- Kandidat immer auf dem Laufenden beim Arbeitsvertrag (29.10.2026)
-- ----------------------------------------------------------------------------
-- Schickt der Kunde den Vertrag selbst, erfuhr der Kandidat von Matchunt bisher
-- nichts. Jetzt bekommt er Mails („<Headhunter> über Matchunt“) und antwortet
-- auf einer Seite ohne Konto (/vertrag/:token):
--   Ist angekommen · Noch nicht da · Schon unterschrieben (Kunde bestätigt)
--   und nach einer Meldung des Kunden: Stimmt · Stimmt so nicht
-- „Stimmt“ schließt die Gegenprobe wie die des Headhunters; wer zuerst.
--
--   contract_candidate_links  persönliche Links (nur Hash), Zugriff nur über
--                             die Function contract-status
--   employment_contracts      Mail an den Kandidaten, seine Antwort, einmalige
--                             Frage nach 7 Tagen, seine Bestätigung
-- reported_role kennt jetzt auch 'candidate' (Kandidat meldet selbst).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.contract_candidate_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  opened_at timestamptz,
  last_opened_at timestamptz,
  answered_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contract_candidate_links_contract_idx ON public.contract_candidate_links (contract_id, created_at DESC);

COMMENT ON TABLE public.contract_candidate_links IS
  'Persönliche Links des Kandidaten zur Seite /vertrag/:token (Stand des Arbeitsvertrags). Nur der Hash wird gespeichert; Zugriff ausschließlich über die Function contract-status.';

-- Lovable: GRANT vor dem Einschalten von RLS
GRANT ALL ON public.contract_candidate_links TO service_role;
ALTER TABLE public.contract_candidate_links ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.employment_contracts
  ADD COLUMN IF NOT EXISTS candidate_informed_at timestamptz,
  ADD COLUMN IF NOT EXISTS candidate_asked_at timestamptz,
  ADD COLUMN IF NOT EXISTS candidate_status text
    CHECK (candidate_status IS NULL OR candidate_status IN ('arrived', 'missing')),
  ADD COLUMN IF NOT EXISTS candidate_status_at timestamptz,
  ADD COLUMN IF NOT EXISTS candidate_check text
    CHECK (candidate_check IS NULL OR candidate_check IN ('ok', 'differs')),
  ADD COLUMN IF NOT EXISTS candidate_check_note text
    CHECK (candidate_check_note IS NULL OR length(candidate_check_note) <= 2000),
  ADD COLUMN IF NOT EXISTS candidate_checked_at timestamptz;

COMMENT ON COLUMN public.employment_contracts.candidate_status IS
  'Antwort des Kandidaten auf „Ist Ihr Vertrag angekommen?“: arrived oder missing. Ein neuer Versand setzt sie zurück.';
COMMENT ON COLUMN public.employment_contracts.candidate_check IS
  'Bestätigung des Kandidaten nach einer Meldung des Kunden (ok/differs). Schließt die Gegenprobe wie recruiter_check.';

ALTER TABLE public.employment_contracts DROP CONSTRAINT IF EXISTS employment_contracts_reported_role_check;
ALTER TABLE public.employment_contracts
  ADD CONSTRAINT employment_contracts_reported_role_check
  CHECK (reported_role IS NULL OR reported_role IN ('client', 'recruiter', 'admin', 'docusign', 'candidate'));

GRANT SELECT ON public.employment_contracts TO authenticated;
GRANT ALL ON public.employment_contracts TO service_role;

-- Headhunter: Stand seiner Verträge, jetzt mit der Antwort des Kandidaten
DROP FUNCTION IF EXISTS public.my_contract_tasks();
CREATE FUNCTION public.my_contract_tasks()
RETURNS TABLE (
  contract_id uuid, submission_id uuid, way text, status text, sent_at timestamptz,
  company_signed_at timestamptz, candidate_signed_at timestamptz, reported_role text, reported_at timestamptz,
  recruiter_check text, signed_on date, salary integer, variable_salary integer, start_date date,
  undo_until timestamptz, final_at timestamptz, updated_at timestamptz,
  candidate_status text, candidate_status_at timestamptz, candidate_check text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.submission_id, c.way, c.status, c.sent_at,
         c.company_signed_at, c.candidate_signed_at, c.reported_role, c.reported_at,
         c.recruiter_check, c.signed_on, c.salary, c.variable_salary, c.start_date,
         c.undo_until, c.final_at, c.updated_at,
         c.candidate_status, c.candidate_status_at, c.candidate_check
  FROM public.employment_contracts c
  JOIN public.submissions s ON s.id = c.submission_id
  WHERE s.recruiter_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.my_contract_tasks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_contract_tasks() TO authenticated;
