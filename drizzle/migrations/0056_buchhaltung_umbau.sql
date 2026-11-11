-- Buchhaltung und Nachbesetzung (Umbau 11.11.2026)
--
-- Grundlage: die mit Marko abgesegneten Screens K1–K14, H1–H13, A1–A10, J1–J6, F1–F3
-- (Plan im Gedächtnis „buchhaltung-plan-2026-11“). Kurz:
--   * Headhunter bekommen Geld nur mit Antritt. Continuity: 5 % bei Antritt,
--     10 % nach der Garantie (Konditionen-Fassung 2), Auslobung 15 % für die
--     Nachbesetzung. Fassung 1 (10/5) gilt für Altfälle weiter.
--   * Antritt steht fest: Kunde bestätigt, Headhunter meldet und der Kunde
--     widerspricht 3 Werktage nicht, oder 14 Tage nach dem ersten Arbeitstag
--     ohne abweichende Meldung.
--   * Nichtantritt ist bei Continuity ein normaler Nachbesetzungsfall
--     (continuity_claims.kind = 'non_start'), bei Core entscheidet Matchunt
--     je Fall über ein Angebot (research_offers, „Joker“).
--   * Nachbesetzung: die bestehende Stelle wird wieder geöffnet
--     (jobs.research_for_placement_id), für alle Headhunter, bis besetzt
--     oder vom Kunden beendet.
--   * Gutschriftverfahren (§ 14 Abs. 2 S. 2 UStG) mit Monatslauf, Zahlungen
--     aus dem Kontoauszug, Erinnerung und Mahnung, Storno/Korrektur,
--     Monatsabschluss.
--   * Sicherheit: Kunden-Rechnungen nur noch für owner/admin/hr/finance,
--     Auszahlungskonto der Headhunter nur mit Mail-Code und 48 h Wartezeit.
--
-- Lovable-Regeln: keine Daten-Einfügungen, erst GRANT, dann RLS, keine
-- Fremdschlüssel auf auth.users, kein BEGIN/COMMIT, täglicher Lauf statt
-- häufigem Cron.

-- ---------------------------------------------------------------------------
-- 1) Einstellungen der Abrechnung (Konditionen-Fassung 2: Stichtag usw.)
--    Werte schreibt nur die Seite Admin › Pakete & Konditionen (Edge Function).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT ALL ON public.billing_settings TO service_role;
GRANT SELECT ON public.billing_settings TO authenticated;
ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins lesen Abrechnungseinstellungen" ON public.billing_settings;
CREATE POLICY "Admins lesen Abrechnungseinstellungen" ON public.billing_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 2) Zustimmung der Headhunter zu neuen Konditionen (H2, § 18 Abs. 2)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recruiter_condition_consents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL,
  version      smallint NOT NULL CHECK (version >= 1),
  consented_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recruiter_id, version)
);
GRANT ALL ON public.recruiter_condition_consents TO service_role;
GRANT SELECT ON public.recruiter_condition_consents TO authenticated;
ALTER TABLE public.recruiter_condition_consents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Headhunter liest eigene Zustimmung" ON public.recruiter_condition_consents;
CREATE POLICY "Headhunter liest eigene Zustimmung" ON public.recruiter_condition_consents
  FOR SELECT TO authenticated USING (recruiter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 3) Abrechnungsdaten der Headhunter (H13) und Kontowechsel mit Code
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recruiter_billing_profiles (
  recruiter_id            uuid PRIMARY KEY,
  legal_name              text,
  legal_form              text,
  street                  text,
  postal_code             text,
  city                    text,
  country                 text NOT NULL DEFAULT 'DE',
  tax_mode                text NOT NULL DEFAULT 'standard' CHECK (tax_mode IN ('standard', 'small_business', 'foreign')),
  vat_id                  text,
  tax_number              text,
  account_holder          text,
  iban                    text,
  bic                     text,
  iban_confirmed_at       timestamptz,
  pending_account_holder  text,
  pending_iban            text,
  pending_bic             text,
  pending_requested_at    timestamptz,
  pending_confirmed_at    timestamptz,
  pending_effective_at    timestamptz,
  self_billing_objected_at timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.recruiter_billing_profiles TO service_role;
GRANT SELECT ON public.recruiter_billing_profiles TO authenticated;
ALTER TABLE public.recruiter_billing_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Headhunter liest eigene Abrechnungsdaten" ON public.recruiter_billing_profiles;
CREATE POLICY "Headhunter liest eigene Abrechnungsdaten" ON public.recruiter_billing_profiles
  FOR SELECT TO authenticated USING (recruiter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Einmal-Codes für den Kontowechsel: nur die Edge Function liest sie.
CREATE TABLE IF NOT EXISTS public.recruiter_account_codes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL,
  code_hash    text NOT NULL,
  expires_at   timestamptz NOT NULL,
  attempts     smallint NOT NULL DEFAULT 0,
  used_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.recruiter_account_codes TO service_role;
ALTER TABLE public.recruiter_account_codes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS recruiter_account_codes_recruiter_idx ON public.recruiter_account_codes (recruiter_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 4) Besetzung: Fassung, Antritt mit Gegenprobe, Halbzeit, Nachbesetzung
-- ---------------------------------------------------------------------------
ALTER TABLE public.placements
  ADD COLUMN IF NOT EXISTS conditions_version      smallint,
  ADD COLUMN IF NOT EXISTS start_reported_at       timestamptz,
  ADD COLUMN IF NOT EXISTS start_reported_by       uuid,
  ADD COLUMN IF NOT EXISTS start_reported_on       date,
  ADD COLUMN IF NOT EXISTS start_report_kind       text,
  ADD COLUMN IF NOT EXISTS start_contested_at      timestamptz,
  ADD COLUMN IF NOT EXISTS start_contest_note      text,
  ADD COLUMN IF NOT EXISTS start_fixed_at          timestamptz,
  ADD COLUMN IF NOT EXISTS start_fixed_how         text,
  ADD COLUMN IF NOT EXISTS halfway_status          text,
  ADD COLUMN IF NOT EXISTS halfway_note            text,
  ADD COLUMN IF NOT EXISTS halfway_at              timestamptz,
  ADD COLUMN IF NOT EXISTS client_sphere_at        timestamptz,
  ADD COLUMN IF NOT EXISTS research_kind           text,
  ADD COLUMN IF NOT EXISTS research_bounty_cents   bigint,
  ADD COLUMN IF NOT EXISTS research_job_id         uuid,
  ADD COLUMN IF NOT EXISTS research_started_at     timestamptz,
  ADD COLUMN IF NOT EXISTS research_ended_at       timestamptz,
  ADD COLUMN IF NOT EXISTS research_end_reason     text,
  ADD COLUMN IF NOT EXISTS replaces_placement_id   uuid;

ALTER TABLE public.placements DROP CONSTRAINT IF EXISTS placements_start_report_kind_check;
ALTER TABLE public.placements ADD CONSTRAINT placements_start_report_kind_check
  CHECK (start_report_kind IS NULL OR start_report_kind IN ('started', 'later', 'not_started'));
ALTER TABLE public.placements DROP CONSTRAINT IF EXISTS placements_start_fixed_how_check;
ALTER TABLE public.placements ADD CONSTRAINT placements_start_fixed_how_check
  CHECK (start_fixed_how IS NULL OR start_fixed_how IN ('client', 'recruiter_unopposed', 'no_report_14d', 'admin', 'client_sphere'));
ALTER TABLE public.placements DROP CONSTRAINT IF EXISTS placements_halfway_status_check;
ALTER TABLE public.placements ADD CONSTRAINT placements_halfway_status_check
  CHECK (halfway_status IS NULL OR halfway_status IN ('ok', 'shaky'));
ALTER TABLE public.placements DROP CONSTRAINT IF EXISTS placements_research_kind_check;
ALTER TABLE public.placements ADD CONSTRAINT placements_research_kind_check
  CHECK (research_kind IS NULL OR research_kind IN ('continuity', 'joker'));
ALTER TABLE public.placements DROP CONSTRAINT IF EXISTS placements_research_end_reason_check;
ALTER TABLE public.placements ADD CONSTRAINT placements_research_end_reason_check
  CHECK (research_end_reason IS NULL OR research_end_reason IN ('filled', 'client_ended', 'matchunt_ended'));
ALTER TABLE public.placements DROP CONSTRAINT IF EXISTS placements_start_contest_note_check;
ALTER TABLE public.placements ADD CONSTRAINT placements_start_contest_note_check
  CHECK (start_contest_note IS NULL OR length(start_contest_note) <= 1000);
ALTER TABLE public.placements DROP CONSTRAINT IF EXISTS placements_halfway_note_check;
ALTER TABLE public.placements ADD CONSTRAINT placements_halfway_note_check
  CHECK (halfway_note IS NULL OR length(halfway_note) <= 1000);

-- Nachbesetzung: anerkannt, aber Position noch nicht bestätigt = awaiting_position
ALTER TABLE public.placements DROP CONSTRAINT IF EXISTS placements_research_state_check;
ALTER TABLE public.placements ADD CONSTRAINT placements_research_state_check
  CHECK (research_state = ANY (ARRAY['not_applicable', 'awaiting_position', 'awaiting_payment', 'running', 'paused', 'succeeded', 'exhausted', 'cancelled']));

CREATE INDEX IF NOT EXISTS placements_replaces_idx ON public.placements (replaces_placement_id) WHERE replaces_placement_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS placements_research_job_idx ON public.placements (research_job_id) WHERE research_job_id IS NOT NULL;

-- Stelle als Nachbesetzung wieder geöffnet; Stelle ruht auf Entscheidung von Matchunt (Stufe 4)
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS research_for_placement_id uuid,
  ADD COLUMN IF NOT EXISTS research_since            timestamptz,
  ADD COLUMN IF NOT EXISTS cooperation_paused_at     timestamptz;
CREATE INDEX IF NOT EXISTS jobs_research_for_placement_idx ON public.jobs (research_for_placement_id) WHERE research_for_placement_id IS NOT NULL;

-- Land der Rechnungsanschrift bestimmt den Steuerfall (K12)
ALTER TABLE public.company_profiles ADD COLUMN IF NOT EXISTS billing_country text;

-- ---------------------------------------------------------------------------
-- 5) Fälle: Nichtantritt gehört dazu, Stellungnahme des Headhunters
-- ---------------------------------------------------------------------------
ALTER TABLE public.continuity_claims
  ADD COLUMN IF NOT EXISTS kind                   text NOT NULL DEFAULT 'departure',
  ADD COLUMN IF NOT EXISTS recruiter_statement    text,
  ADD COLUMN IF NOT EXISTS recruiter_statement_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_sphere          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS decision_note          text;
ALTER TABLE public.continuity_claims DROP CONSTRAINT IF EXISTS continuity_claims_kind_check;
ALTER TABLE public.continuity_claims ADD CONSTRAINT continuity_claims_kind_check
  CHECK (kind IN ('departure', 'non_start'));
ALTER TABLE public.continuity_claims DROP CONSTRAINT IF EXISTS continuity_claims_statement_check;
ALTER TABLE public.continuity_claims ADD CONSTRAINT continuity_claims_statement_check
  CHECK (recruiter_statement IS NULL OR length(recruiter_statement) <= 2000);

-- Prüfung beim Anlegen: Zeitraum ab Abschluss des Arbeitsvertrags (Fassung 3,
-- § 9 Abs. 1) bis Ende Continuity, Meldefrist ab Kenntnis. Den Grund beurteilt
-- Matchunt (A8), nicht mehr die Kategorienliste im Paket.
CREATE OR REPLACE FUNCTION public.continuity_claims_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  p          public.placements%ROWTYPE;
  s          jsonb;
  cont_days  integer;
  notice     integer;
  frist      date;
  ende       date;
BEGIN
  SELECT * INTO p FROM public.placements WHERE id = NEW.placement_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Placement % existiert nicht.', NEW.placement_id USING ERRCODE = 'foreign_key_violation';
  END IF;
  s := p.pricing_snapshot;
  IF s IS NULL THEN
    RAISE EXCEPTION 'Placement % hat keinen Preis-Snapshot.', p.id USING ERRCODE = 'check_violation';
  END IF;
  cont_days := nullif(s->>'continuityDays', '')::integer;
  notice    := coalesce(nullif(s->>'claimNoticeDays', '')::integer, 14);
  IF cont_days IS NULL THEN
    RAISE EXCEPTION 'Paket % enthält keine Nachbesetzung.', coalesce(s->>'publicName', s->>'packageKey') USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.kind = 'departure' THEN
    IF p.first_working_day IS NULL THEN
      RAISE EXCEPTION 'Placement % hat keinen ersten Arbeitstag.', p.id USING ERRCODE = 'check_violation';
    END IF;
    ende := p.first_working_day + cont_days;
    IF NEW.separation_date > ende THEN
      RAISE EXCEPTION 'Das Ausscheiden (%) liegt nach dem Ende des Zeitraums (%).', NEW.separation_date, ende USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    -- Nichtantritt: zwischen Unterschrift und erstem Arbeitstag
    IF NEW.separation_date < (p.created_at AT TIME ZONE 'Europe/Berlin')::date - 1 THEN
      RAISE EXCEPTION 'Die Absage (%) liegt vor der Unterschrift.', NEW.separation_date USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  frist := NEW.known_at + notice;
  NEW.deadline := frist;
  IF NEW.reported_at::date > frist THEN
    RAISE EXCEPTION 'Die Meldefrist ist am % abgelaufen (Kenntnis am %, % Tage Frist).', frist, NEW.known_at, notice USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- Folgen einer Entscheidung. Anerkannt: Einbehalt verfällt, bei Nichtantritt
-- auch der 1. Teil; die Nachbesetzung wartet auf die Bestätigung der Position.
CREATE OR REPLACE FUNCTION public.continuity_claims_apply()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    UPDATE public.placements
       SET continuity_state = 'claim_accepted',
           retention_state  = CASE WHEN retention_state = 'released' THEN retention_state ELSE 'forfeited' END,
           placement_state  = CASE WHEN NEW.kind = 'non_start' THEN 'cancelled'
                                   WHEN placement_state = 'started' THEN 'ended_early'
                                   ELSE placement_state END,
           ended_at         = coalesce(ended_at, NEW.separation_date),
           end_reason       = coalesce(end_reason, NEW.category),
           research_kind    = 'continuity',
           research_state   = 'awaiting_position'
     WHERE id = NEW.placement_id;

    UPDATE public.recruiter_payout_tranches
       SET status = 'forfeited', forfeited_at = now(),
           forfeit_reason = 'Nachbesetzung anerkannt (' || NEW.category || ')'
     WHERE placement_id = NEW.placement_id
       AND tranche_type = 'retention'
       AND status IN ('pending', 'due');

    IF NEW.kind = 'non_start' THEN
      UPDATE public.recruiter_payout_tranches
         SET status = 'forfeited', forfeited_at = now(),
             forfeit_reason = 'Kein Antritt (' || NEW.category || ')'
       WHERE placement_id = NEW.placement_id
         AND tranche_type = 'initial'
         AND status IN ('pending', 'due');
    END IF;

  ELSIF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
    UPDATE public.placements
       SET continuity_state = 'claim_rejected',
           client_sphere_at = CASE WHEN NEW.client_sphere THEN coalesce(client_sphere_at, now()) ELSE client_sphere_at END
     WHERE id = NEW.placement_id;

  ELSIF NEW.status IN ('submitted', 'in_review') AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.placements
       SET continuity_state = 'claim_open'
     WHERE id = NEW.placement_id AND continuity_state IN ('running', 'not_applicable');
  END IF;
  RETURN NEW;
END;
$$;

-- Einbehalt erst nach Zeitraum plus Meldefrist; sofort frei, wenn Matchunt
-- festgestellt hat, dass der Grund beim Kunden liegt.
CREATE OR REPLACE FUNCTION public.placements_guard_retention()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.retention_state = 'released' AND OLD.retention_state = 'withheld' THEN
    IF NEW.client_sphere_at IS NULL AND NEW.retention_release_date IS NOT NULL
       AND (now() AT TIME ZONE 'Europe/Berlin')::date < NEW.retention_release_date THEN
      RAISE EXCEPTION 'Der Einbehalt wird erst am % frei (Zeitraum plus Meldefrist).', NEW.retention_release_date USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (SELECT 1 FROM public.continuity_claims WHERE placement_id = NEW.id AND status IN ('submitted', 'in_review')) THEN
      RAISE EXCEPTION 'Der Einbehalt bleibt gebunden, solange ein gemeldeter Fall offen ist.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Keine Gutschrift, bevor der Kunde gezahlt hat; Auslobung erst mit dem
-- Antritt der Ersatzbesetzung (Tranche hängt an der neuen Besetzung).
CREATE OR REPLACE FUNCTION public.recruiter_tranches_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  p    public.placements%ROWTYPE;
  orig public.placements%ROWTYPE;
BEGIN
  IF NEW.status IN ('approved', 'paid') AND OLD.status NOT IN ('approved', 'paid') THEN
    SELECT * INTO p FROM public.placements WHERE id = NEW.placement_id;
    IF NEW.tranche_type = 'research_bounty' THEN
      IF p.start_fixed_at IS NULL AND p.placement_state NOT IN ('started', 'completed') THEN
        RAISE EXCEPTION 'Die Auslobung ist erst nach dem Antritt der Ersatzbesetzung auszahlbar.' USING ERRCODE = 'check_violation';
      END IF;
      IF p.replaces_placement_id IS NOT NULL THEN
        SELECT * INTO orig FROM public.placements WHERE id = p.replaces_placement_id;
        IF FOUND AND orig.invoice_state <> 'paid' THEN
          RAISE EXCEPTION 'Die Auslobung ist nicht auszahlbar: die ursprüngliche Rechnung ist nicht bezahlt.' USING ERRCODE = 'check_violation';
        END IF;
      END IF;
      IF coalesce(p.client_fee_cents, 0) > 0 AND p.invoice_state <> 'paid' THEN
        RAISE EXCEPTION 'Die Auslobung ist nicht auszahlbar: die Rechnung über den Unterschied ist nicht bezahlt.' USING ERRCODE = 'check_violation';
      END IF;
    ELSE
      IF p.invoice_state <> 'paid' THEN
        RAISE EXCEPTION 'Tranche % ist nicht auszahlbar: die Kundenrechnung steht auf "%" statt "paid".', NEW.tranche_type, p.invoice_state USING ERRCODE = 'check_violation';
      END IF;
      IF NEW.tranche_type = 'retention' AND p.retention_state <> 'released' THEN
        RAISE EXCEPTION 'Der Einbehalt ist nicht auszahlbar: er steht auf "%" statt "released".', p.retention_state USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;
  IF NEW.status = 'paid' AND NEW.paid_at IS NULL THEN
    NEW.paid_at := now();
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6) Rechnungen: neue Arten, Mahnstufe, „Bestellnummer folgt“, Storno-Bezug
-- ---------------------------------------------------------------------------
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_invoice_type_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_invoice_type_check
  CHECK (invoice_type = ANY (ARRAY['placement_fee', 'credit_note', 'cancellation', 'research_option', 'salary_difference']));
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS dunning_level           smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reminder_sent_at        timestamptz,
  ADD COLUMN IF NOT EXISTS po_follows              boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancel_reason           text,
  ADD COLUMN IF NOT EXISTS cancelled_at            timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by_invoice_id uuid,
  ADD COLUMN IF NOT EXISTS tax_case                text,
  ADD COLUMN IF NOT EXISTS research_offer_id       uuid;
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_tax_case_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_tax_case_check
  CHECK (tax_case IS NULL OR tax_case IN ('domestic', 'reverse_charge', 'not_taxable'));
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_cancel_reason_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_cancel_reason_check
  CHECK (cancel_reason IS NULL OR length(cancel_reason) <= 500);

-- Einzelne Zahlungseingänge (Teilzahlungen sichtbar, K10/K11, A6)
CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id          uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount_cents        bigint NOT NULL CHECK (amount_cents > 0),
  paid_on             date NOT NULL,
  source              text NOT NULL DEFAULT 'manual' CHECK (source IN ('bank', 'manual')),
  bank_transaction_id uuid,
  note                text CHECK (note IS NULL OR length(note) <= 1000),
  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.invoice_payments TO service_role;
GRANT SELECT ON public.invoice_payments TO authenticated;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS invoice_payments_invoice_idx ON public.invoice_payments (invoice_id, paid_on);

-- Erinnerung (Stufe 0, automatisch) und Mahnungen (1, 2, 3 = Inkasso/Anwalt)
CREATE TABLE IF NOT EXISTS public.invoice_reminders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  level          smallint NOT NULL CHECK (level BETWEEN 0 AND 3),
  sent_at        timestamptz,
  sent_to        text,
  pay_until      date,
  open_cents     bigint,
  interest_cents bigint NOT NULL DEFAULT 0,
  fee_cents      bigint NOT NULL DEFAULT 0,
  note           text CHECK (note IS NULL OR length(note) <= 2000),
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, level)
);
GRANT ALL ON public.invoice_reminders TO service_role;
GRANT SELECT ON public.invoice_reminders TO authenticated;
ALTER TABLE public.invoice_reminders ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 7) Kontoauszug (A6)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bank_imports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name   text NOT NULL,
  format      text NOT NULL CHECK (format IN ('camt053', 'csv')),
  period_from date,
  period_to   date,
  row_count   integer NOT NULL DEFAULT 0,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.bank_imports TO service_role;
ALTER TABLE public.bank_imports ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id         uuid REFERENCES public.bank_imports(id) ON DELETE SET NULL,
  booked_on         date NOT NULL,
  amount_cents      bigint NOT NULL,
  counterparty      text,
  counterparty_iban text,
  purpose           text,
  fingerprint       text NOT NULL UNIQUE,
  status            text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'booked', 'hidden')),
  invoice_id        uuid,
  credit_note_id    uuid,
  booked_at         timestamptz,
  booked_by         uuid,
  created_at        timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.bank_transactions TO service_role;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS bank_transactions_status_idx ON public.bank_transactions (status, booked_on DESC);

-- ---------------------------------------------------------------------------
-- 8) Gutschriften an Headhunter (A7, H11, H12)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_note_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period         text NOT NULL UNIQUE CHECK (period ~ '^\d{4}-\d{2}$'),
  status         text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'paid')),
  issued_at      timestamptz NOT NULL DEFAULT now(),
  issued_by      uuid,
  sepa_path      text,
  sepa_created_at timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.credit_note_runs TO service_role;
ALTER TABLE public.credit_note_runs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.recruiter_credit_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       uuid REFERENCES public.credit_note_runs(id) ON DELETE SET NULL,
  recruiter_id uuid NOT NULL,
  number       text NOT NULL UNIQUE,
  status       text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'paid', 'cancelled')),
  issued_on    date NOT NULL,
  period       text NOT NULL,
  pay_until    date,
  recipient    jsonb NOT NULL DEFAULT '{}'::jsonb,
  tax_mode     text NOT NULL CHECK (tax_mode IN ('standard', 'small_business', 'foreign')),
  vat_rate     numeric NOT NULL DEFAULT 0,
  net_cents    bigint NOT NULL,
  vat_cents    bigint NOT NULL DEFAULT 0,
  total_cents  bigint NOT NULL,
  lines        jsonb NOT NULL DEFAULT '[]'::jsonb,
  iban_masked  text,
  pdf_path     text,
  sent_at      timestamptz,
  paid_on      date,
  created_at   timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.recruiter_credit_notes TO service_role;
GRANT SELECT ON public.recruiter_credit_notes TO authenticated;
ALTER TABLE public.recruiter_credit_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Headhunter liest eigene Gutschriften" ON public.recruiter_credit_notes;
CREATE POLICY "Headhunter liest eigene Gutschriften" ON public.recruiter_credit_notes
  FOR SELECT TO authenticated USING (recruiter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS recruiter_credit_notes_recruiter_idx ON public.recruiter_credit_notes (recruiter_id, issued_on DESC);

ALTER TABLE public.recruiter_payout_tranches ADD COLUMN IF NOT EXISTS credit_note_id uuid;
CREATE INDEX IF NOT EXISTS recruiter_payout_tranches_credit_note_idx ON public.recruiter_payout_tranches (credit_note_id) WHERE credit_note_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.credit_note_objections (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id uuid NOT NULL REFERENCES public.recruiter_credit_notes(id) ON DELETE CASCADE,
  recruiter_id   uuid NOT NULL,
  topic          text NOT NULL CHECK (topic IN ('basis', 'percentage', 'vat', 'other')),
  note           text NOT NULL CHECK (length(note) BETWEEN 1 AND 2000),
  status         text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolution     text CHECK (resolution IS NULL OR length(resolution) <= 2000),
  created_at     timestamptz NOT NULL DEFAULT now(),
  resolved_at    timestamptz,
  resolved_by    uuid
);
GRANT ALL ON public.credit_note_objections TO service_role;
GRANT SELECT ON public.credit_note_objections TO authenticated;
ALTER TABLE public.credit_note_objections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Headhunter liest eigene Einwände" ON public.credit_note_objections;
CREATE POLICY "Headhunter liest eigene Einwände" ON public.credit_note_objections
  FOR SELECT TO authenticated USING (recruiter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 9) Angebot einer Nachbesetzung bei Core-Nichtantritt („Joker“, J1–J6)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.research_offers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id uuid NOT NULL UNIQUE REFERENCES public.placements(id) ON DELETE CASCADE,
  decision     text NOT NULL CHECK (decision IN ('offer', 'none')),
  price_cents  bigint CHECK (price_cents IS NULL OR price_cents >= 0),
  valid_until  date,
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'declined', 'expired', 'none')),
  note         text CHECK (note IS NULL OR length(note) <= 1000),
  decided_by   uuid,
  decided_at   timestamptz NOT NULL DEFAULT now(),
  answered_by  uuid,
  answered_at  timestamptz,
  invoice_id   uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.research_offers TO service_role;
ALTER TABLE public.research_offers ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 10) Faire Zusammenarbeit (F1–F3)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_cooperation_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL,              -- Firmenprofil (Inhaber der Organisation bzw. Kunde)
  stage      smallint CHECK (stage IS NULL OR stage BETWEEN 1 AND 5),
  kind       text NOT NULL CHECK (kind IN ('auto_reminder', 'call', 'hint', 'pause', 'resume', 'end', 'terminate', 'note')),
  job_id     uuid,
  note       text CHECK (note IS NULL OR length(note) <= 2000),
  deadline   date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.client_cooperation_events TO service_role;
ALTER TABLE public.client_cooperation_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS client_cooperation_events_owner_idx ON public.client_cooperation_events (owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.recruiter_client_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       uuid NOT NULL,
  recruiter_id uuid NOT NULL,
  topic        text NOT NULL CHECK (topic IN ('no_response', 'unfair', 'circumvention', 'wrong_info', 'other')),
  note         text NOT NULL CHECK (length(note) BETWEEN 1 AND 2000),
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'handled')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  handled_at   timestamptz,
  handled_by   uuid
);
GRANT ALL ON public.recruiter_client_reports TO service_role;
GRANT SELECT ON public.recruiter_client_reports TO authenticated;
ALTER TABLE public.recruiter_client_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Headhunter liest eigene Meldungen" ON public.recruiter_client_reports;
CREATE POLICY "Headhunter liest eigene Meldungen" ON public.recruiter_client_reports
  FOR SELECT TO authenticated USING (recruiter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 11) Monatsabschluss (A9)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_periods (
  period    text PRIMARY KEY CHECK (period ~ '^\d{4}-\d{2}$'),
  locked_at timestamptz NOT NULL DEFAULT now(),
  locked_by uuid
);
GRANT ALL ON public.accounting_periods TO service_role;
GRANT SELECT ON public.accounting_periods TO authenticated;
ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins lesen Monatsabschluss" ON public.accounting_periods;
CREATE POLICY "Admins lesen Monatsabschluss" ON public.accounting_periods
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 12) Rechnungen nur für Rollen mit Abrechnung (owner, admin, hr, finance).
--     Bisher lasen auch hiring_manager und viewer über can_access_job mit,
--     einschließlich pricing_snapshot.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_see_job_billing(_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.jobs j
     WHERE j.id = _job_id
       AND (
         (j.organization_id IS NULL AND j.client_id = auth.uid())
         OR (j.organization_id IS NOT NULL
             AND public.get_org_role(j.organization_id, auth.uid()) IN ('owner', 'admin', 'hr', 'finance'))
       )
  );
$$;
REVOKE ALL ON FUNCTION public.can_see_job_billing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_see_job_billing(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Kundenteam liest gestellte Rechnungen" ON public.invoices;
CREATE POLICY "Kundenteam liest gestellte Rechnungen" ON public.invoices
  FOR SELECT TO authenticated
  USING (status <> 'draft' AND ((job_id IS NULL AND client_id = auth.uid()) OR (job_id IS NOT NULL AND public.can_see_job_billing(job_id))));

DROP POLICY IF EXISTS "Kundenteam liest Zahlungen" ON public.invoice_payments;
CREATE POLICY "Kundenteam liest Zahlungen" ON public.invoice_payments
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.invoices i
     WHERE i.id = invoice_id AND i.status <> 'draft'
       AND ((i.job_id IS NULL AND i.client_id = auth.uid()) OR (i.job_id IS NOT NULL AND public.can_see_job_billing(i.job_id)))));

DROP POLICY IF EXISTS "Kundenteam liest Erinnerungen" ON public.invoice_reminders;
CREATE POLICY "Kundenteam liest Erinnerungen" ON public.invoice_reminders
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.invoices i
     WHERE i.id = invoice_id AND i.status <> 'draft'
       AND ((i.job_id IS NULL AND i.client_id = auth.uid()) OR (i.job_id IS NOT NULL AND public.can_see_job_billing(i.job_id)))));

-- ---------------------------------------------------------------------------
-- 13) Täglicher Lauf (Erinnerungen, Antritt, Einbehalt, Aufgaben, Fristen)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('buchhaltung-taeglich') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'buchhaltung-taeglich');
    PERFORM cron.schedule('buchhaltung-taeglich', '30 6 * * *', $job$
      SELECT net.http_post(
        url := 'https://dngycrrhbnwdohbftpzq.supabase.co/functions/v1/buchhaltung-taeglich',
        headers := jsonb_build_object('Content-Type', 'application/json',
                                      'x-cron-token', private.cron_token_for('buchhaltung-taeglich')),
        body := '{}'::jsonb);
    $job$);
  END IF;
END;
$$;
