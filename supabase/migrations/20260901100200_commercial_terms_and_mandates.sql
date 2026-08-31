-- ============================================================================
-- Jobaufnahme-Links · Konditionsvorlagen und Vermittlungsvereinbarung (3/6)
-- ----------------------------------------------------------------------------
-- BEFUND: Es gibt kein Konditionsmodell. Die Fee lebt ausschliesslich in
--   jobs.fee_percentage / jobs.recruiter_fee_percentage mit den Spalten-
--   Defaults 20.00 / 15.00 aus der Urmigration (20251204171610:44-45) und wird
--   an genau einer Stelle gesetzt: JobApprovalDialog.tsx:115-126, mit
--   hartkodierten useState-Defaults 20/15 und Slidergrenzen 15-30 / 10-25.
--   AdminSettings.tsx ist eine Attrappe -- fetchSettings laedt nichts,
--   handleSaveSettings wartet 500 ms und toastet ohne jeden DB-Zugriff.
--   Der Kunde sieht die Kondition erst NACH der Freigabe, obwohl AGB Paragraph 9
--   zusagt, sie werde "vor Beginn des jeweiligen Vermittlungsprozesses
--   transparent in der Plattform ausgewiesen".
--
--   Und: AGB Paragraph 9 sowie Paragraph 12 (4) verweisen zweimal auf eine
--   "mandatsbezogene Vereinbarung" -- im Schema existiert kein Objekt dafuer.
--   client_verifications.digital_signature ist ein getippter Name ohne Bezug
--   zu irgendeiner Kondition, terms_version wird hart als '1.0' uebergeben,
--   waehrend die AGB-Seite "Stand: Juni 2026" traegt.
--
-- ENTSCHEIDUNG (2026-08-31):
--   (a) Eine aktive Standardvorlage je key, mit veroeffentlichter Bandbreite.
--       Ein persoenlicher Link darf davon abweichen, aber nur INNERHALB der
--       Bandbreite -- durchgesetzt per Trigger, nicht per UI-Konvention.
--   (b) Die Konditionen sind bei der Darstellung freibleibend. Die Bestaetigung
--       des Kunden ist SEIN Angebot, nicht der Vertragsschluss. Matchunt nimmt
--       an. Sonst waere Matchunt an jeden gebunden, der das Formular ausfuellt.
--   (c) Der Vertrag wird unterschrieben. Versand laeuft vorerst manuell ueber
--       DocuSign; das System erzeugt das Dokument aus dem bestaetigten Snapshot
--       und fuehrt den Zustand. Die Zustaende sind exakt die, die eine spaetere
--       DocuSign-API setzen wuerde -- die Ablösung ist ein Austausch, kein Umbau.
--
-- Versionierung nach dem einzigen im Repo vorhandenen Muster: matching_config
-- (UNIQUE INDEX ... WHERE active). Bestaetigte Inhalte werden nie ueberschrieben:
-- eine Konditionsaenderung erzeugt eine neue Zeile, die alte geht auf
-- 'superseded'. Ein BEFORE-UPDATE-Trigger verhindert jede stille Aenderung.
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

  -- Festanstellung
  fee_percentage            numeric(5,2) NOT NULL,
  recruiter_fee_percentage  numeric(5,2) NOT NULL,
  min_fee_percentage        numeric(5,2),
  max_fee_percentage        numeric(5,2),
  min_recruiter_fee_percentage numeric(5,2),
  max_recruiter_fee_percentage numeric(5,2),
  fee_basis                 text NOT NULL DEFAULT 'annual_target_salary'
                              CHECK (fee_basis IN ('annual_target_salary', 'annual_gross_salary')),

  -- Contracting: Marge auf den Tagessatz statt Prozent vom Jahresgehalt.
  -- Ohne diese Spalten haette eine Freelance-Stelle gar keine Kondition --
  -- employment_type='freelance' setzt salary_min/max hart auf NULL
  -- (JobIntakeStudio.tsx:348-349).
  contracting_margin_percentage numeric(5,2),
  contracting_recruiter_share_percentage numeric(5,2),

  payment_terms_days        integer NOT NULL DEFAULT 14,
  guarantee_days            integer,
  refund_rule               text,
  vat_note                  text NOT NULL DEFAULT 'Alle Betraege verstehen sich zzgl. der gesetzlichen Umsatzsteuer.',

  -- Was vor der Veroeffentlichung erfuellt sein muss. Als Flags, damit die
  -- Verschaerfung eine Konfigurationsaenderung ist und kein Release.
  requires_signature        boolean NOT NULL DEFAULT true,
  requires_kyb              boolean NOT NULL DEFAULT false,

  -- Der Klartext, den der Kunde sieht, plus Pruefsumme.
  body_md                   text NOT NULL,
  body_sha256               text NOT NULL,
  -- Die AGB-Fassung, auf die sich die Vorlage bezieht.
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

-- Genau eine aktive Fassung je key (Muster matching_config).
CREATE UNIQUE INDEX IF NOT EXISTS commercial_terms_active_key_idx
  ON public.commercial_terms_templates (key) WHERE is_active;

COMMENT ON TABLE public.commercial_terms_templates IS
  'Veroeffentlichte Konditionsregel, versioniert. Genau eine aktive Fassung je key. '
  'Ersetzt die hartkodierten 20/15 aus JobApprovalDialog.tsx:76-77 und die '
  'nicht speichernde Attrappe in AdminSettings.tsx.';
COMMENT ON COLUMN public.commercial_terms_templates.requires_signature IS
  'Ob vor der Veroeffentlichung eine unterzeichnete Vermittlungsvereinbarung '
  'vorliegen muss. Entscheidung 2026-08-31: true (DocuSign, vorerst manuell).';
COMMENT ON COLUMN public.commercial_terms_templates.requires_kyb IS
  'Ob zusaetzlich client_verifications.kyc_status = verified verlangt wird. '
  'Standard false: KYB laeuft parallel und blockiert laut J.2.6 nur die '
  'Rechnungsstellung, nicht die Aufnahme.';

-- Die aktive Fassung ist fuer jeden angemeldeten Nutzer lesbar -- sie ist die
-- veroeffentlichte Regel, kein Geheimnis. Nur der Admin pflegt sie.
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

-- Der bislang lose Verweis vom Link auf die Vorlage bekommt seinen FK.
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
  -- Fortlaufend und sprechend: MV-2026-001042. Referenz auf Dokument,
  -- in DocuSign und spaeter auf der Rechnung.
  mandate_number   text NOT NULL,

  draft_id         uuid REFERENCES public.intake_drafts(id) ON DELETE CASCADE,
  job_id           uuid REFERENCES public.jobs(id)          ON DELETE SET NULL,
  organization_id  uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  client_user_id   uuid,

  template_id      uuid NOT NULL REFERENCES public.commercial_terms_templates(id),
  template_version integer NOT NULL,

  -- Die verbindlichen Werte dieses Mandats.
  fee_percentage            numeric(5,2) NOT NULL,
  recruiter_fee_percentage  numeric(5,2) NOT NULL,
  fee_basis                 text NOT NULL,
  contracting_margin_percentage numeric(5,2),
  payment_terms_days        integer NOT NULL,
  guarantee_days            integer,
  refund_rule               text,

  -- Vollstaendiges, unveraenderliches Abbild dessen, was der Kunde gesehen hat:
  -- Konditionstext, AGB-Volltext, Firmen- und Kontaktdaten, Stellenbezeichnung.
  snapshot         jsonb NOT NULL,
  snapshot_sha256  text  NOT NULL,
  agb_version      text  NOT NULL,
  agb_sha256       text,

  status           text NOT NULL DEFAULT 'proposed'
                     CHECK (status IN ('proposed', 'client_confirmed', 'accepted',
                                       'declined', 'superseded', 'withdrawn')),
  supersedes_id    uuid REFERENCES public.commercial_mandates(id) ON DELETE SET NULL,

  -- ---- Angebot des Kunden (protokolliert) ---------------------------------
  client_confirmed_at         timestamptz,
  client_confirmed_name       text,
  client_confirmed_email      text,
  client_confirmed_ip_hash    text,
  client_confirmed_user_agent text,
  -- Zustimmung zu den AGB, getrennt protokolliert.
  agb_accepted_at             timestamptz,

  -- ---- Annahme durch Matchunt ---------------------------------------------
  accepted_at      timestamptz,
  accepted_by      uuid,
  declined_at      timestamptz,
  declined_by      uuid,
  decline_reason   text,

  -- ---- Unterschrift (DocuSign, vorerst manuell) ---------------------------
  signature_provider  text NOT NULL DEFAULT 'docusign',
  signature_status    text NOT NULL DEFAULT 'not_required'
                        CHECK (signature_status IN ('not_required', 'pending',
                                                    'sent', 'signed', 'declined',
                                                    'expired', 'voided')),
  signature_envelope_id text,          -- DocuSign Envelope-ID, manuell erfasst
  signature_sent_at     timestamptz,
  signature_sent_by     uuid,
  signature_signed_at   timestamptz,
  signature_recorded_by uuid,          -- wer den Eingang vermerkt hat
  signature_signer_name text,
  signature_note        text,
  signed_document_path  text,          -- Storage-Pfad des unterzeichneten PDF

  -- Das von uns erzeugte Vertragsdokument.
  document_path    text,
  document_sha256  text,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT commercial_mandates_number_key UNIQUE (mandate_number),
  CONSTRAINT commercial_mandates_recruiter_share
    CHECK (recruiter_fee_percentage <= fee_percentage),
  -- Bestaetigt heisst: mit Nachweis. Ohne Zeitstempel und Adresse ist es keine
  -- Bestaetigung, sondern eine Behauptung.
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

-- Hoechstens ein offenes und ein bestaetigtes Angebot je Entwurf. Verhindert,
-- dass zwei Konditionsstaende gleichzeitig gelten.
CREATE UNIQUE INDEX IF NOT EXISTS commercial_mandates_one_open_idx
  ON public.commercial_mandates (draft_id) WHERE status = 'proposed';
CREATE UNIQUE INDEX IF NOT EXISTS commercial_mandates_one_live_idx
  ON public.commercial_mandates (draft_id) WHERE status IN ('client_confirmed', 'accepted');

COMMENT ON TABLE public.commercial_mandates IS
  'Die mandatsbezogene Vereinbarung, die AGB Paragraph 9 und Paragraph 12 (4) '
  'zusagen und die im Schema bisher fehlte. Die Bestaetigung des Kunden ist sein '
  'Angebot; Matchunt nimmt gesondert an. Eine Konditionsaenderung erzeugt eine '
  'neue Zeile mit supersedes_id -- bestaetigte Inhalte werden nie ueberschrieben.';
COMMENT ON COLUMN public.commercial_mandates.snapshot IS
  'Unveraenderliches Abbild dessen, was der Kunde gesehen hat: Konditionstext, '
  'AGB-Volltext, Firmen-/Kontaktdaten, Stellenbezeichnung. Grundlage des '
  'Vertragsdokuments und des Nachweises.';
COMMENT ON COLUMN public.commercial_mandates.signature_status IS
  'Unterschriftslauf. Versand laeuft vorerst manuell ueber DocuSign; die Zustaende '
  'sind so gewaehlt, dass eine spaetere DocuSign-Anbindung sie unveraendert setzt.';

-- Vertragsnummer automatisch.
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
-- Ohne das waere "bereits bestaetigte Inhalte duerfen nicht unbemerkt
-- ueberschrieben werden" eine Absichtserklaerung. Postgres-RLS kennt keine
-- Spaltenrechte, also muss es ein Trigger sein.
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

  -- Ein unterzeichneter Vertrag wird nicht mehr angefasst; nur der Weg zurueck
  -- ueber 'voided' bleibt offen und ist protokollpflichtig.
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
-- "Der Admin darf sich nur innerhalb der veroeffentlichten Regel bewegen"
-- (ONBOARDING_INTAKE_MASTERANALYSE.md, gelockt). Heute ist es ein freier
-- Slider von 15 bis 30 Prozent.
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
ALTER TABLE public.commercial_mandates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage mandates" ON public.commercial_mandates;
CREATE POLICY "Admins manage mandates"
  ON public.commercial_mandates FOR ALL TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Der Kunde darf seinen eigenen Vertrag sehen -- nur lesen, und nur den eigenen.
-- Ohne das haette er nach der Kontoanlage keinen Zugriff auf das, was er
-- unterschrieben hat.
DROP POLICY IF EXISTS "Clients read their own mandate" ON public.commercial_mandates;
CREATE POLICY "Clients read their own mandate"
  ON public.commercial_mandates FOR SELECT TO authenticated
  USING (
    client_user_id = auth.uid()
    OR (organization_id IS NOT NULL
        AND public.get_org_role(organization_id, auth.uid()) IN ('owner', 'admin', 'finance'))
  );

-- ----------------------------------------------------------------------------
-- 6) Erste Fassung der Regel -- aus dem heutigen Bestand, nichts erfunden
-- ----------------------------------------------------------------------------
-- Werte und Bandbreite kommen aus dem, was heute produktiv gilt:
-- Defaults 20/15 (20251204171610:44-45), Slidergrenzen 15-30 und 10-25
-- (JobApprovalDialog.tsx:319, :338). Zahlungsziel 14 Tage netto aus AGB
-- Paragraph 12 (3). Nichts davon ist eine neue Preisentscheidung -- die
-- Bandbreite bildet nur ab, was der Slider ohnehin zuliess.
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
