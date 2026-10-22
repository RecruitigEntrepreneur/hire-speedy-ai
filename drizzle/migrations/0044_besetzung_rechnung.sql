-- ============================================================================
-- Einstellung und Rechnung (Einstellungsprozess Paket 4a, 22.10.2026)
-- ============================================================================
-- Ab „Vertrag verbindlich“ (Paket 3) entsteht genau ein Placement und dazu ein
-- Rechnungsentwurf. Matchunt prüft den Entwurf und gibt ihn frei; erst dann
-- bekommt er die feste Nummer aus dem Nummernkreis, das PDF und geht an die
-- Rechnungs-E-Mail des Kunden. Danach bucht Matchunt den Zahlungseingang.
--
-- Zugleich geschlossen:
--  - Kunden und Headhunter lasen die interne Aufteilung (Headhunter-Anteil,
--    Matchunt-Marge) direkt aus placements. Sie lesen jetzt nur noch über
--    client_placements_view bzw. recruiter_placements_view; die Tabelle selbst
--    bleibt für Admins (und die Service-Role).
--  - Kunden sahen auch Rechnungsentwürfe. Jetzt nur gestellte Rechnungen, dafür
--    für das ganze Kundenteam der Stelle.
--  - Headhunter konnten Auszahlungsanforderungen mit beliebigem Betrag anlegen.
--  - Tranche 1 wurde mit der Zahlung fällig; laut Recruiter-Rahmenvertrag § 11
--    Abs. 2 erst nach Zahlung UND Antritt (Antritt gilt nach 14 Tagen ohne
--    Nichtantrittsmeldung, das setzt Paket 4b).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Nummernkreis (Rechnung, Storno, Gutschrift), je Art und Jahr lückenlos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_counters (
  kind        text    NOT NULL CHECK (kind IN ('invoice', 'cancellation', 'credit_note')),
  year        integer NOT NULL CHECK (year BETWEEN 2020 AND 2100),
  last_number integer NOT NULL CHECK (last_number >= 0),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, year)
);
ALTER TABLE public.document_counters ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.document_counters TO service_role;

-- Nächste Nummer; beim ersten Gebrauch im Jahr ab _start (Anschluss an bestehende Nummern).
CREATE OR REPLACE FUNCTION public.next_document_number(_kind text, _year integer, _start integer DEFAULT 1)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  INSERT INTO public.document_counters (kind, year, last_number)
  VALUES (_kind, _year, greatest(coalesce(_start, 1), 1))
  ON CONFLICT (kind, year) DO UPDATE
    SET last_number = public.document_counters.last_number + 1, updated_at = now()
  RETURNING last_number INTO n;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.next_document_number(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_document_number(text, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.next_document_number(text, integer, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- Rechnung: Entwurf, Freigabe, Versand, Zahlung
-- ---------------------------------------------------------------------------
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS submission_id uuid REFERENCES public.submissions(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS vat_rate numeric(5,2);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS reverse_charge boolean NOT NULL DEFAULT false;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS recipient jsonb;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS lines jsonb;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS pdf_path text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS released_at timestamptz;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS released_by uuid;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS sent_to text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_amount_cents bigint;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_note text CHECK (payment_note IS NULL OR length(payment_note) <= 1000);

COMMENT ON COLUMN public.invoices.status IS
  'draft = Entwurf (nur Matchunt), open = gestellt und offen, partially_paid, paid, cancelled (storniert). Ältere Werte (pending …) bleiben gültig.';
CREATE INDEX IF NOT EXISTS invoices_submission_idx ON public.invoices (submission_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON public.invoices (status);

DROP POLICY IF EXISTS "Clients can view their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Kundenteam liest gestellte Rechnungen" ON public.invoices;
CREATE POLICY "Kundenteam liest gestellte Rechnungen" ON public.invoices
  FOR SELECT USING (
    status <> 'draft'
    AND (client_id = auth.uid() OR (job_id IS NOT NULL AND public.can_access_job(job_id)))
  );
GRANT SELECT ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;

-- ---------------------------------------------------------------------------
-- Placements: interne Aufteilung nur noch für Admins
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view relevant placements" ON public.placements;
GRANT ALL ON public.placements TO service_role;

DROP VIEW IF EXISTS public.client_placements_view;
CREATE VIEW public.client_placements_view WITH (security_barrier = true) AS
  SELECT p.id, p.submission_id, s.job_id, s.candidate_id, s.recruiter_id,
         p.start_date, p.first_working_day, p.agreed_salary, p.gross_annual_target_compensation_cents,
         p.client_fee_cents, p.package_key, p.placement_state, p.continuity_state, p.invoice_state,
         p.continuity_end_date, p.ended_at, p.end_reason, p.payment_status, p.created_at
  FROM public.placements p
  JOIN public.submissions s ON s.id = p.submission_id
  WHERE public.can_access_job(s.job_id);
COMMENT ON VIEW public.client_placements_view IS 'Placements für das Kundenteam: eigenes Honorar, ohne Aufteilung zwischen Headhunter und Matchunt.';

DROP VIEW IF EXISTS public.recruiter_placements_view;
CREATE VIEW public.recruiter_placements_view WITH (security_barrier = true) AS
  SELECT p.id, p.submission_id, s.job_id, s.candidate_id,
         p.start_date, p.first_working_day, p.agreed_salary, p.gross_annual_target_compensation_cents,
         p.recruiter_initial_cents, p.recruiter_retention_cents, p.recruiter_payout, p.package_key,
         p.placement_state, p.continuity_state, p.retention_state, p.invoice_state,
         p.continuity_end_date, p.retention_release_date, p.ended_at, p.end_reason, p.payment_status, p.created_at
  FROM public.placements p
  JOIN public.submissions s ON s.id = p.submission_id
  WHERE s.recruiter_id = auth.uid();
COMMENT ON VIEW public.recruiter_placements_view IS 'Placements für den Headhunter: eigener Anteil, ohne Kundenhonorar und Matchunt-Marge.';

GRANT SELECT ON public.client_placements_view TO authenticated;
GRANT SELECT ON public.recruiter_placements_view TO authenticated;
GRANT SELECT ON public.client_placements_view TO service_role;
GRANT SELECT ON public.recruiter_placements_view TO service_role;

-- ---------------------------------------------------------------------------
-- Tranche 1 erst nach Zahlung UND Antritt (Recruiter-Rahmenvertrag § 11 Abs. 2)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.placements_invoice_state_changed()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN
  IF NEW.invoice_state = 'paid' AND NEW.placement_state IN ('started', 'completed')
     AND (OLD.invoice_state IS DISTINCT FROM 'paid' OR OLD.placement_state IS DISTINCT FROM NEW.placement_state) THEN
    UPDATE public.recruiter_payout_tranches
       SET status = 'due'
     WHERE placement_id = NEW.id AND tranche_type = 'initial' AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_placements_invoice_state ON public.placements;
CREATE TRIGGER trg_placements_invoice_state
  AFTER UPDATE OF invoice_state, placement_state ON public.placements
  FOR EACH ROW EXECUTE FUNCTION public.placements_invoice_state_changed();

-- ---------------------------------------------------------------------------
-- Keine selbst erfundenen Auszahlungsbeträge mehr
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Recruiters can create payout requests" ON public.payout_requests;
