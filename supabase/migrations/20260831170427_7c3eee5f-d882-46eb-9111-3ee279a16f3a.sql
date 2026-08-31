-- ============================================================================
-- Jobaufnahme-Links · Konditionsvorlagen und Vermittlungsvereinbarung (3/6)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) Die veroeffentlichte Regel
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commercial_terms_templates (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key                       text    NOT NULL DEFAULT 'standard',
  version                   integer NOT NULL,
  is_active                 boolean NOT NULL DEFAULT false,
  label                     text    NOT NULL,

  fee_percentage            numeric(5,2) NOT NULL,
  recruiter_fee_percentage  numeric(5,2) NOT NULL,
  min_fee_percentage        numeric(5,2),
  max_fee_percentage        numeric(5,2),
  min_recruiter_fee_percentage numeric(5,2),
  max_recruiter_fee_percentage numeric(5,2),
  fee_basis                 text NOT NULL DEFAULT 'annual_target_salary'
                              CHECK (fee_basis IN ('annual_target_salary', 'annual_gross_salary')),

  contracting_margin_percentage numeric(5,2),
  contracting_recruiter_share_percentage numeric(5,2),

  payment_terms_days        integer NOT NULL DEFAULT 14,
  guarantee_days            integer,
  refund_rule               text,
  vat_note                  text NOT NULL DEFAULT 'Alle Betraege verstehen sich zzgl. der gesetzlichen Umsatzsteuer.',

  requires_signature        boolean NOT NULL DEFAULT true,
  requires_kyb              boolean NOT NULL DEFAULT false,

  body_md                   text NOT NULL,
  body_sha256               text NOT NULL,
  agb_version               text NOT NULL,
  agb_sha256                text,

  published_at              timestamptz,
  created_by                uuid NOT NULL,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT commercial_terms_key_version_key UNIQUE (key, version),
  CONSTRAINT commercial_terms_recruiter_share
    CHECK (recruiter_fee_percentage <= fee_percentage),
  CONSTRAINT commercial_terms_band
    CHECK ((min_fee_percentage IS NULL OR max_fee_percentage IS NULL
            OR min_fee_percentage <= max_fee_percentage)
       AND (min_fee_percentage IS NULL OR fee_percentage >= min_fee_percentage)
       AND (max_fee_percentage IS NULL OR fee_percentage <= max_fee_percentage))
);

CREATE UNIQUE INDEX IF NOT EXISTS commercial_terms_active_key_idx
  ON public.commercial_terms_templates (key) WHERE is_active;

COMMENT ON TABLE public.commercial_terms_templates IS
  'Veroeffentlichte Konditionsregel, versioniert. Genau eine aktive Fassung je key.';
COMMENT ON COLUMN public.commercial_terms_templates.requires_signature IS
  'Ob vor der Veroeffentlichung eine unterzeichnete Vermittlungsvereinbarung vorliegen muss.';
COMMENT ON COLUMN public.commercial_terms_templates.requires_kyb IS
  'Ob zusaetzlich client_verifications.kyc_status = verified verlangt wird.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_terms_templates TO authenticated;
GRANT ALL ON public.commercial_terms_templates TO service_role;

ALTER TABLE public.commercial_terms_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone signed in reads active terms" ON public.commercial_terms_templates;
CREATE POLICY "Anyone signed in reads active terms"
  ON public.commercial_terms_templates FOR SELECT TO authenticated
  USING (is_active);

DROP POLICY IF EXISTS "Admins manage terms templates" ON public.commercial_terms_templates;
CREATE POLICY "Admins manage terms templates"
  ON public.commercial_terms_templates FOR ALL TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_terms_templates_touch ON public.commercial_terms_templates;
CREATE TRIGGER trg_terms_templates_touch
  BEFORE UPDATE ON public.commercial_terms_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.intake_links
  DROP CONSTRAINT IF EXISTS intake_links_terms_template_id_fkey;
ALTER TABLE public.intake_links
  ADD CONSTRAINT intake_links_terms_template_id_fkey
  FOREIGN KEY (terms_template_id)
  REFERENCES public.commercial_terms_templates(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 2) Die Vermittlungsvereinbarung
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.mandate_number_seq START 1000;

CREATE TABLE IF NOT EXISTS public.commercial_mandates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_number   text NOT NULL,

  draft_id         uuid REFERENCES public.intake_drafts(id) ON DELETE CASCADE,
  job_id           uuid REFERENCES public.jobs(id)          ON DELETE SET NULL,
  organization_id  uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  client_user_id   uuid,

  template_id      uuid NOT NULL REFERENCES public.commercial_terms_templates(id),
  template_version integer NOT NULL,

  fee_percentage            numeric(5,2) NOT NULL,
  recruiter_fee_percentage  numeric(5,2) NOT NULL,
  fee_basis                 text NOT NULL,
  contracting_margin_percentage numeric(5,2),
  payment_terms_days        integer NOT NULL,
  guarantee_days            integer,
  refund_rule               text,

  snapshot         jsonb NOT NULL,
  snapshot_sha256  text  NOT NULL,
  agb_version      text  NOT NULL,
  agb_sha256       text,

  status           text NOT NULL DEFAULT 'proposed'
                     CHECK (status IN ('proposed', 'client_confirmed', 'accepted',
                                       'declined', 'superseded', 'withdrawn')),
  supersedes_id    uuid REFERENCES public.commercial_mandates(id) ON DELETE SET NULL,

  client_confirmed_at         timestamptz,
  client_confirmed_name       text,
  client_confirmed_email      text,
  client_confirmed_ip_hash    text,
  client_confirmed_user_agent text,
  agb_accepted_at             timestamptz,

  accepted_at      timestamptz,
  accepted_by      uuid,
  declined_at      timestamptz,
  declined_by      uuid,
  decline_reason   text,

  signature_provider  text NOT NULL DEFAULT 'docusign',
  signature_status    text NOT NULL DEFAULT 'not_required'
                        CHECK (signature_status IN ('not_required', 'pending',
                                                    'sent', 'signed', 'declined',
                                                    'expired', 'voided')),
  signature_envelope_id text,
  signature_sent_at     timestamptz,
  signature_sent_by     uuid,
  signature_signed_at   timestamptz,
  signature_recorded_by uuid,
  signature_signer_name text,
  signature_note        text,
  signed_document_path  text,

  document_path    text,
  document_sha256  text,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT commercial_mandates_number_key UNIQUE (mandate_number),
  CONSTRAINT commercial_mandates_recruiter_share
    CHECK (recruiter_fee_percentage <= fee_percentage),
  CONSTRAINT commercial_mandates_confirmed_needs_proof
    CHECK (client_confirmed_at IS NULL
           OR (client_confirmed_email IS NOT NULL AND agb_accepted_at IS NOT NULL)),
  CONSTRAINT commercial_mandates_signed_needs_time
    CHECK (signature_status <> 'signed' OR signature_signed_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS commercial_mandates_draft_idx
  ON public.commercial_mandates (draft_id, created_at DESC);
CREATE INDEX IF NOT EXISTS commercial_mandates_job_idx
  ON public.commercial_mandates (job_id) WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS commercial_mandates_org_idx
  ON public.commercial_mandates (organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS commercial_mandates_signature_idx
  ON public.commercial_mandates (signature_status, signature_sent_at DESC)
  WHERE signature_status IN ('pending', 'sent');

CREATE UNIQUE INDEX IF NOT EXISTS commercial_mandates_one_open_idx
  ON public.commercial_mandates (draft_id) WHERE status = 'proposed';
CREATE UNIQUE INDEX IF NOT EXISTS commercial_mandates_one_live_idx
  ON public.commercial_mandates (draft_id) WHERE status IN ('client_confirmed', 'accepted');

COMMENT ON TABLE public.commercial_mandates IS
  'Die mandatsbezogene Vereinbarung. Die Bestaetigung des Kunden ist sein '
  'Angebot; Matchunt nimmt gesondert an.';
COMMENT ON COLUMN public.commercial_mandates.snapshot IS
  'Unveraenderliches Abbild dessen, was der Kunde gesehen hat.';
COMMENT ON COLUMN public.commercial_mandates.signature_status IS
  'Unterschriftslauf, vorerst manuell ueber DocuSign.';

CREATE OR REPLACE FUNCTION public.commercial_mandates_set_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF NEW.mandate_number IS NULL OR NEW.mandate_number = '' THEN
    NEW.mandate_number := 'MV-' || to_char(now(), 'YYYY') || '-'
                          || lpad(nextval('public.mandate_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_mandates_number ON public.commercial_mandates;
CREATE TRIGGER trg_mandates_number
  BEFORE INSERT ON public.commercial_mandates
  FOR EACH ROW EXECUTE FUNCTION public.commercial_mandates_set_number();

-- ----------------------------------------------------------------------------
-- 3) Unveraenderlichkeit nach der Bestaetigung
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.commercial_mandates_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF OLD.client_confirmed_at IS NOT NULL THEN
    IF NEW.snapshot_sha256          IS DISTINCT FROM OLD.snapshot_sha256
    OR NEW.fee_percentage           IS DISTINCT FROM OLD.fee_percentage
    OR NEW.recruiter_fee_percentage IS DISTINCT FROM OLD.recruiter_fee_percentage
    OR NEW.fee_basis                IS DISTINCT FROM OLD.fee_basis
    OR NEW.payment_terms_days       IS DISTINCT FROM OLD.payment_terms_days
    OR NEW.guarantee_days           IS DISTINCT FROM OLD.guarantee_days
    OR NEW.refund_rule              IS DISTINCT FROM OLD.refund_rule
    OR NEW.template_version         IS DISTINCT FROM OLD.template_version
    OR NEW.agb_version              IS DISTINCT FROM OLD.agb_version
    OR NEW.client_confirmed_at      IS DISTINCT FROM OLD.client_confirmed_at
    OR NEW.client_confirmed_email   IS DISTINCT FROM OLD.client_confirmed_email
    THEN
      RAISE EXCEPTION 'Vom Kunden bestaetigte Konditionen sind unveraenderlich (Mandat %). Fuer eine Aenderung eine neue Version mit supersedes_id anlegen.', OLD.mandate_number
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF OLD.signature_status = 'signed'
     AND NEW.signature_status NOT IN ('signed', 'voided') THEN
    RAISE EXCEPTION 'Ein unterzeichneter Vertrag kann nur auf "voided" gesetzt werden (Mandat %).', OLD.mandate_number
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_mandates_guard ON public.commercial_mandates;
CREATE TRIGGER trg_mandates_guard
  BEFORE UPDATE ON public.commercial_mandates
  FOR EACH ROW EXECUTE FUNCTION public.commercial_mandates_guard();

DROP TRIGGER IF EXISTS trg_mandates_touch ON public.commercial_mandates;
CREATE TRIGGER trg_mandates_touch
  BEFORE UPDATE ON public.commercial_mandates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 4) Bandbreite am Link durchsetzen
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.intake_links_check_fee_band()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE t public.commercial_terms_templates%ROWTYPE;
BEGIN
  IF NEW.fee_percentage IS NULL AND NEW.recruiter_fee_percentage IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.terms_template_id IS NULL THEN
    RAISE EXCEPTION 'Abweichende Konditionen brauchen eine Konditionsvorlage.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO t FROM public.commercial_terms_templates WHERE id = NEW.terms_template_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Konditionsvorlage % existiert nicht.', NEW.terms_template_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF NEW.fee_percentage IS NOT NULL
     AND ((t.min_fee_percentage IS NOT NULL AND NEW.fee_percentage < t.min_fee_percentage)
       OR (t.max_fee_percentage IS NOT NULL AND NEW.fee_percentage > t.max_fee_percentage)) THEN
    RAISE EXCEPTION 'Honorar % Prozent liegt ausserhalb der veroeffentlichten Bandbreite (% bis % Prozent).',
      NEW.fee_percentage, t.min_fee_percentage, t.max_fee_percentage
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.recruiter_fee_percentage IS NOT NULL
     AND ((t.min_recruiter_fee_percentage IS NOT NULL AND NEW.recruiter_fee_percentage < t.min_recruiter_fee_percentage)
       OR (t.max_recruiter_fee_percentage IS NOT NULL AND NEW.recruiter_fee_percentage > t.max_recruiter_fee_percentage)) THEN
    RAISE EXCEPTION 'Recruiter-Anteil % Prozent liegt ausserhalb der veroeffentlichten Bandbreite (% bis % Prozent).',
      NEW.recruiter_fee_percentage, t.min_recruiter_fee_percentage, t.max_recruiter_fee_percentage
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_intake_links_fee_band ON public.intake_links;
CREATE TRIGGER trg_intake_links_fee_band
  BEFORE INSERT OR UPDATE ON public.intake_links
  FOR EACH ROW EXECUTE FUNCTION public.intake_links_check_fee_band();

-- ----------------------------------------------------------------------------
-- 5) RLS
-- ----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_mandates TO authenticated;
GRANT ALL ON public.commercial_mandates TO service_role;

ALTER TABLE public.commercial_mandates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage mandates" ON public.commercial_mandates;
CREATE POLICY "Admins manage mandates"
  ON public.commercial_mandates FOR ALL TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Clients read their own mandate" ON public.commercial_mandates;
CREATE POLICY "Clients read their own mandate"
  ON public.commercial_mandates FOR SELECT TO authenticated
  USING (
    client_user_id = auth.uid()
    OR (organization_id IS NOT NULL
        AND public.get_org_role(organization_id, auth.uid()) IN ('owner', 'admin', 'finance'))
  );

-- ----------------------------------------------------------------------------
-- 6) Erste Fassung der Regel
-- ----------------------------------------------------------------------------
INSERT INTO public.commercial_terms_templates (
  key, version, is_active, label,
  fee_percentage, recruiter_fee_percentage,
  min_fee_percentage, max_fee_percentage,
  min_recruiter_fee_percentage, max_recruiter_fee_percentage,
  fee_basis, contracting_margin_percentage, contracting_recruiter_share_percentage,
  payment_terms_days, guarantee_days, refund_rule,
  requires_signature, requires_kyb,
  agb_version, body_md, body_sha256,
  published_at, created_by
)
SELECT
  'standard', 1, true, 'Standardkonditionen (Erfolgsbasis)',
  20.00, 15.00, 15.00, 30.00, 10.00, 25.00,
  'annual_target_salary', NULL, NULL,
  14, 90,
  'Scheidet die vermittelte Person innerhalb von 90 Tagen ab Eintritt aus einem Grund aus, den das Unternehmen nicht zu vertreten hat, wird einmalig kostenfrei nachbesetzt. Ist eine Nachbesetzung nicht moeglich, werden 50 Prozent des Honorars erstattet.',
  true, false,
  '2026-06',
  E'## Konditionen\n\n**Erfolgshonorar:** 20 % des vereinbarten Zieljahresgehalts (Grundgehalt zzgl. vertraglich zugesagter variabler Bestandteile).\n\n**Faelligkeit:** Das Honorar entsteht ausschliesslich im Erfolgsfall, also mit Unterzeichnung des Anstellungsvertrags durch die vermittelte Person. Zahlungsziel 14 Tage netto ohne Abzug.\n\n**Keine Fixkosten:** Ausschreibung, Aufnahme und Vorauswahl sind kostenfrei. Es faellt kein Retainer und keine Grundgebuehr an.\n\n**Nachbesetzung:** Scheidet die vermittelte Person innerhalb von 90 Tagen ab Eintritt aus einem Grund aus, den das Unternehmen nicht zu vertreten hat, besetzen wir einmalig kostenfrei nach. Ist das nicht moeglich, erstatten wir 50 % des Honorars.\n\n**Umsatzsteuer:** Alle Betraege verstehen sich zzgl. der gesetzlichen Umsatzsteuer.\n\nErgaenzend gelten die Allgemeinen Geschaeftsbedingungen in der Fassung 2026-06.',
  'seed-v1-standard-2026-06',
  now(),
  COALESCE(
    (SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'
      ORDER BY ur.created_at LIMIT 1),
    '00000000-0000-0000-0000-000000000000'::uuid
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.commercial_terms_templates WHERE key = 'standard'
);

COMMIT;