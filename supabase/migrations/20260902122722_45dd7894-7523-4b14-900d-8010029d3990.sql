-- ============================================================================
-- Nachlauf der Aufnahme · Rahmenvertrag und Einzelauftrag (2/3)
-- ----------------------------------------------------------------------------
-- BEFUND: 20260901100200 legte commercial_mandates als Vereinbarung JE AUFNAHME
--   an -- jede Position ein eigener Vertrag mit eigenen AGB, eigener
--   Unterschrift, eigenem Dokument. Die Unterschrift war einseitig: ein
--   signature_status, ein Unterzeichner, kein Gegenzeichner. Fuer den zweiten
--   Auftrag desselben Kunden haette der Kunde denselben Vertragstext ein
--   zweites Mal unterschreiben muessen.
--
-- ENTSCHEIDUNG (2026-09-02):
--   Der Rahmenvertrag wird EINMAL je Kunde geschlossen. Darunter haengen die
--   Einzelauftraege je Position. Ein zweiter Auftrag braucht keinen neuen
--   Rahmenvertrag, nur einen neuen Einzelauftrag.
--
--   Unterschrieben wird in fester Reihenfolge: erst der Kunde, dann Matchunt.
--   Erst die Gegenzeichnung macht den Vertrag wirksam. Vorher gibt es kein
--   'signed', das die Veroeffentlichung freischalten koennte -- die Reihenfolge
--   ist ein Trigger, keine Prozessbeschreibung.
--
--   Nach der Unterschrift des Kunden wird am Dokument nichts mehr geaendert.
--   Wer etwas aendern will, beendet die Fassung und legt eine neue zur erneuten
--   Unterschrift an. Auch das ist ein Trigger.
--
-- commercial_mandates behaelt seinen Namen -- Mandat ist der Einzelauftrag --
-- und bekommt: Bezug auf den Rahmenvertrag, Paket statt freiem Prozentsatz,
-- unveraenderlichen Preis-Snapshot, Berechnungsgrundlage in Cent, und den
-- zweistufigen Unterschriftslauf.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) Zentral gepflegter Vertragstext
-- ----------------------------------------------------------------------------
-- "Rechtliche Formulierungen zentral konfigurierbar": der Text lebt nicht im
-- Code und nicht im PDF-Generator, sondern hier, versioniert und mit Pruefsumme.
CREATE TABLE IF NOT EXISTS public.contract_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type     text NOT NULL CHECK (doc_type IN ('framework', 'assignment')),
  version      integer NOT NULL,
  is_active    boolean NOT NULL DEFAULT false,
  language     text NOT NULL DEFAULT 'de' CHECK (language IN ('de', 'en')),

  title        text NOT NULL,
  body_md      text NOT NULL,
  body_sha256  text NOT NULL,

  -- Die Vertragspartei auf unserer Seite. Steht hier und nicht im Code, damit
  -- eine Adressaenderung keine Auslieferung braucht.
  vendor_legal_name text NOT NULL DEFAULT 'Bluewater & Bridge GmbH',
  vendor_brand      text NOT NULL DEFAULT 'Matchunt',
  vendor_street     text NOT NULL DEFAULT 'Adlzreiterstraße 2',
  vendor_postal_code text NOT NULL DEFAULT '80337',
  vendor_city       text NOT NULL DEFAULT 'München',
  vendor_country    text NOT NULL DEFAULT 'DE',
  vendor_register   text NOT NULL DEFAULT 'HRB 288632',
  vendor_court      text NOT NULL DEFAULT 'Amtsgericht München',
  vendor_vat_id     text,

  agb_version  text NOT NULL,
  agb_sha256   text,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,

  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT contract_templates_type_version_key UNIQUE (doc_type, version, language)
);

CREATE UNIQUE INDEX IF NOT EXISTS contract_templates_active_idx
  ON public.contract_templates (doc_type, language) WHERE is_active;

COMMENT ON TABLE public.contract_templates IS
  'Zentral gepflegte Vertragstexte, versioniert. Genau eine aktive Fassung je '
  'Dokumentart und Sprache. Eine Textaenderung erzeugt eine neue Version; '
  'bereits unterzeichnete Vertraege behalten ihre Fassung ueber den Snapshot.';
COMMENT ON COLUMN public.contract_templates.vendor_legal_name IS
  'Vertragspartei auf Matchunt-Seite. Matchunt ist eine Marke der '
  'Bluewater & Bridge GmbH; im Vertrag steht die Gesellschaft.';

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage contract templates" ON public.contract_templates;
CREATE POLICY "Admins manage contract templates"
  ON public.contract_templates FOR ALL TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone signed in reads active contract templates" ON public.contract_templates;
CREATE POLICY "Anyone signed in reads active contract templates"
  ON public.contract_templates FOR SELECT TO authenticated
  USING (is_active);

DROP TRIGGER IF EXISTS trg_contract_templates_touch ON public.contract_templates;
CREATE TRIGGER trg_contract_templates_touch
  BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 2) Der Rahmenvertrag
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.framework_number_seq START 1000;

CREATE TABLE IF NOT EXISTS public.client_framework_agreements (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_number  text NOT NULL,

  organization_id   uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  -- Vor der Kontoanlage gibt es noch keine Organisation; dann traegt der
  -- Rahmenvertrag den Entwurf, aus dem er entstanden ist.
  origin_draft_id   uuid REFERENCES public.intake_drafts(id) ON DELETE SET NULL,
  client_user_id    uuid,

  template_id       uuid NOT NULL REFERENCES public.contract_templates(id),
  template_version  integer NOT NULL,
  version           integer NOT NULL DEFAULT 1,
  supersedes_id     uuid REFERENCES public.client_framework_agreements(id) ON DELETE SET NULL,

  -- Unveraenderliches Abbild: Vertragstext, AGB, Firmen- und Vertreterdaten.
  snapshot          jsonb NOT NULL,
  snapshot_sha256   text  NOT NULL,
  agb_version       text  NOT NULL,
  agb_sha256        text,

  -- ---- Zustand -------------------------------------------------------------
  -- draft            : erzeugt, noch nicht freigegeben
  -- pending_release  : Admin-Pruefung offen
  -- sent             : bei DocuSign, wartet auf den Kunden
  -- customer_signed  : Kunde hat unterschrieben, Gegenzeichnung offen
  -- active           : gegengezeichnet und wirksam
  -- declined/expired/voided/superseded/terminated : Endzustaende
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_release', 'sent', 'customer_signed',
                      'active', 'declined', 'expired', 'voided',
                      'superseded', 'terminated')),

  released_for_signature_at timestamptz,
  released_by               uuid,

  -- ---- Unterschriftslauf (DocuSign) ---------------------------------------
  signature_provider    text NOT NULL DEFAULT 'docusign',
  envelope_id           text,
  envelope_sent_at      timestamptz,

  customer_signer_name  text,
  customer_signer_email text,
  customer_signer_role  text,
  customer_signed_at    timestamptz,
  customer_ip_hash      text,

  countersigner_name    text,
  countersigner_user_id uuid,
  countersigned_at      timestamptz,

  declined_at    timestamptz,
  decline_reason text,
  expires_at     timestamptz,
  terminated_at  timestamptz,
  termination_reason text,

  document_path        text,
  document_sha256      text,
  signed_document_path text,
  signed_document_sha256 text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT client_framework_number_key UNIQUE (agreement_number),

  -- Ein Zustand ohne den zugehoerigen Nachweis ist eine Behauptung.
  CONSTRAINT framework_customer_signed_needs_proof
    CHECK (status NOT IN ('customer_signed', 'active')
           OR (customer_signed_at IS NOT NULL AND customer_signer_email IS NOT NULL)),
  CONSTRAINT framework_active_needs_countersignature
    CHECK (status <> 'active' OR countersigned_at IS NOT NULL),
  -- Die Reihenfolge steckt schon in den Daten: Gegenzeichnung nie ohne
  -- vorherige Kundenunterschrift, und nie davor.
  CONSTRAINT framework_countersign_after_customer
    CHECK (countersigned_at IS NULL
           OR (customer_signed_at IS NOT NULL AND countersigned_at >= customer_signed_at)),
  CONSTRAINT framework_sent_needs_release
    CHECK (status NOT IN ('sent', 'customer_signed', 'active')
           OR released_for_signature_at IS NOT NULL)
);

-- Genau ein wirksamer Rahmenvertrag je Kunde. Das ist der Kern von "einmal
-- pro Kunde": zwei gleichzeitig wirksame Rahmenvertraege waeren zwei
-- Rechtsgrundlagen fuer denselben Kunden.
CREATE UNIQUE INDEX IF NOT EXISTS client_framework_one_active_idx
  ON public.client_framework_agreements (organization_id)
  WHERE status = 'active' AND organization_id IS NOT NULL;

-- Und hoechstens ein laufender Unterschriftsvorgang je Kunde.
CREATE UNIQUE INDEX IF NOT EXISTS client_framework_one_open_idx
  ON public.client_framework_agreements (organization_id)
  WHERE status IN ('draft', 'pending_release', 'sent', 'customer_signed')
    AND organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS client_framework_draft_idx
  ON public.client_framework_agreements (origin_draft_id) WHERE origin_draft_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS client_framework_envelope_idx
  ON public.client_framework_agreements (envelope_id) WHERE envelope_id IS NOT NULL;

COMMENT ON TABLE public.client_framework_agreements IS
  'Rahmenvertrag, einmal je Kunde. Die Einzelauftraege je Position haengen '
  'darunter. Unterschrieben wird in fester Reihenfolge: erst der Kunde '
  '(customer_signed), dann Matchunt (active). Erst active ist wirksam.';

CREATE OR REPLACE FUNCTION public.framework_set_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN
  IF NEW.agreement_number IS NULL OR NEW.agreement_number = '' THEN
    NEW.agreement_number := 'RV-' || to_char(now(), 'YYYY') || '-'
      || lpad(nextval('public.framework_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_framework_number ON public.client_framework_agreements;
CREATE TRIGGER trg_framework_number
  BEFORE INSERT ON public.client_framework_agreements
  FOR EACH ROW EXECUTE FUNCTION public.framework_set_number();

DROP TRIGGER IF EXISTS trg_framework_touch ON public.client_framework_agreements;
CREATE TRIGGER trg_framework_touch
  BEFORE UPDATE ON public.client_framework_agreements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 3) Reihenfolge und Unveraenderlichkeit des Rahmenvertrags
-- ----------------------------------------------------------------------------
-- Ohne diesen Trigger waere "erst der Kunde, dann Matchunt" eine Aussage im
-- Konzept. Ein Fehlgriff im Admin-UI oder ein doppelt zugestellter Webhook
-- koennte einen Vertrag wirksam setzen, den der Kunde nie unterschrieben hat.
CREATE OR REPLACE FUNCTION public.framework_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE
  erlaubt text[];
BEGIN
  -- (a) Zustandsuebergaenge. Was hier nicht steht, ist verboten.
  erlaubt := CASE OLD.status
    WHEN 'draft'           THEN ARRAY['draft','pending_release','voided']
    WHEN 'pending_release' THEN ARRAY['pending_release','sent','draft','voided']
    WHEN 'sent'            THEN ARRAY['sent','customer_signed','declined','expired','voided']
    WHEN 'customer_signed' THEN ARRAY['customer_signed','active','voided']
    WHEN 'active'          THEN ARRAY['active','superseded','terminated']
    ELSE ARRAY[OLD.status]   -- Endzustaende bleiben
  END;

  IF NOT (NEW.status = ANY (erlaubt)) THEN
    RAISE EXCEPTION 'Rahmenvertrag %: Uebergang % -> % ist nicht vorgesehen.',
      OLD.agreement_number, OLD.status, NEW.status USING ERRCODE = 'check_violation';
  END IF;

  -- (b) Gegenzeichnung nur nach der Kundenunterschrift.
  IF NEW.countersigned_at IS NOT NULL AND NEW.customer_signed_at IS NULL THEN
    RAISE EXCEPTION 'Rahmenvertrag %: Matchunt zeichnet zuletzt -- ohne Kundenunterschrift keine Gegenzeichnung.',
      OLD.agreement_number USING ERRCODE = 'check_violation';
  END IF;

  -- (c) Nach der Kundenunterschrift wird am Dokument nichts mehr geaendert.
  --     Wer aendern will, beendet die Fassung und legt eine neue an.
  IF OLD.customer_signed_at IS NOT NULL THEN
    IF NEW.snapshot_sha256    IS DISTINCT FROM OLD.snapshot_sha256
    OR NEW.snapshot           IS DISTINCT FROM OLD.snapshot
    OR NEW.template_id        IS DISTINCT FROM OLD.template_id
    OR NEW.template_version   IS DISTINCT FROM OLD.template_version
    OR NEW.agb_version        IS DISTINCT FROM OLD.agb_version
    OR NEW.document_sha256    IS DISTINCT FROM OLD.document_sha256
    OR NEW.customer_signed_at IS DISTINCT FROM OLD.customer_signed_at
    OR NEW.customer_signer_email IS DISTINCT FROM OLD.customer_signer_email
    OR NEW.organization_id    IS DISTINCT FROM OLD.organization_id
    THEN
      RAISE EXCEPTION 'Rahmenvertrag % ist vom Kunden unterzeichnet und unveraenderlich. Fuer eine Aenderung die Fassung beenden und eine neue zur erneuten Unterschrift anlegen.',
        OLD.agreement_number USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- (d) Endzustaende brauchen ihren Zeitstempel.
  IF NEW.status = 'terminated' AND NEW.terminated_at IS NULL THEN
    NEW.terminated_at := now();
  END IF;
  IF NEW.status = 'declined' AND NEW.declined_at IS NULL THEN
    NEW.declined_at := now();
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_framework_guard ON public.client_framework_agreements;
CREATE TRIGGER trg_framework_guard
  BEFORE UPDATE ON public.client_framework_agreements
  FOR EACH ROW EXECUTE FUNCTION public.framework_guard();

ALTER TABLE public.client_framework_agreements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage framework agreements" ON public.client_framework_agreements;
CREATE POLICY "Admins manage framework agreements"
  ON public.client_framework_agreements FOR ALL TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Der Kunde sieht seinen eigenen Rahmenvertrag, nur lesend.
DROP POLICY IF EXISTS "Clients read own framework agreement" ON public.client_framework_agreements;
CREATE POLICY "Clients read own framework agreement"
  ON public.client_framework_agreements FOR SELECT TO authenticated
  USING (client_user_id = auth.uid()
         OR (organization_id IS NOT NULL AND organization_id IN (
               SELECT o.id FROM public.organizations o WHERE o.owner_id = auth.uid())));

-- ----------------------------------------------------------------------------
-- 4) Der Einzelauftrag: Paket statt freiem Prozentsatz
-- ----------------------------------------------------------------------------
ALTER TABLE public.commercial_mandates
  ADD COLUMN IF NOT EXISTS framework_agreement_id uuid
    REFERENCES public.client_framework_agreements(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS package_key      text,
  ADD COLUMN IF NOT EXISTS package_version  integer,
  -- Unveraenderliches Abbild des Pakets zum Zeitpunkt der Auswahl. Es wird
  -- daraus gerechnet, nicht aus commercial_packages -- sonst wuerde eine
  -- Preisaenderung bestehende Auftraege rueckwirkend veraendern.
  ADD COLUMN IF NOT EXISTS pricing_snapshot        jsonb,
  ADD COLUMN IF NOT EXISTS pricing_snapshot_sha256 text,
  ADD COLUMN IF NOT EXISTS package_selected_at     timestamptz,

  -- Die Berechnungsgrundlage. Steht explizit hier und nicht nur im built-JSON
  -- des Entwurfs: aus dem JSON kann sie sich aendern, aus dieser Spalte nicht.
  ADD COLUMN IF NOT EXISTS gross_annual_target_compensation_cents bigint,
  ADD COLUMN IF NOT EXISTS compensation_basis text
    CHECK (compensation_basis IS NULL
           OR compensation_basis IN ('intake_estimate', 'signed_employment_contract')),

  -- Die Betraege in ganzen Cent. Bei der Auswahl aus der Schaetzung, bei der
  -- Abrechnung aus dem unterzeichneten Arbeitsvertrag neu gerechnet.
  ADD COLUMN IF NOT EXISTS client_fee_cents          bigint,
  ADD COLUMN IF NOT EXISTS recruiter_initial_cents   bigint,
  ADD COLUMN IF NOT EXISTS recruiter_retention_cents bigint,
  ADD COLUMN IF NOT EXISTS matchunt_cents            bigint,

  -- Zweistufiger Unterschriftslauf, parallel zum Rahmenvertrag.
  ADD COLUMN IF NOT EXISTS released_for_signature_at timestamptz,
  ADD COLUMN IF NOT EXISTS released_by               uuid,
  ADD COLUMN IF NOT EXISTS customer_signed_at        timestamptz,
  ADD COLUMN IF NOT EXISTS customer_signer_name      text,
  ADD COLUMN IF NOT EXISTS customer_signer_email     text,
  ADD COLUMN IF NOT EXISTS countersigned_at          timestamptz,
  ADD COLUMN IF NOT EXISTS countersigner_name        text,
  ADD COLUMN IF NOT EXISTS countersigner_user_id     uuid,
  ADD COLUMN IF NOT EXISTS envelope_id               text;

-- Der Auftrag zeigt auf eine tatsaechlich existierende Paketfassung.
ALTER TABLE public.commercial_mandates
  DROP CONSTRAINT IF EXISTS commercial_mandates_package_fkey;
ALTER TABLE public.commercial_mandates
  ADD CONSTRAINT commercial_mandates_package_fkey
  FOREIGN KEY (package_key, package_version)
  REFERENCES public.commercial_packages (package_key, version);

-- Kein viertes Paket, auch nicht ueber den Umweg eines Auftrags.
ALTER TABLE public.commercial_mandates
  DROP CONSTRAINT IF EXISTS commercial_mandates_package_key_check;
ALTER TABLE public.commercial_mandates
  ADD CONSTRAINT commercial_mandates_package_key_check
  CHECK (package_key IS NULL
         OR package_key IN ('core', 'continuity_90', 'continuity_180'));

-- Ein bestaetigter Auftrag ohne Paket und Snapshot waere ein Auftrag ohne Preis.
ALTER TABLE public.commercial_mandates
  DROP CONSTRAINT IF EXISTS commercial_mandates_confirmed_needs_package;
ALTER TABLE public.commercial_mandates
  ADD CONSTRAINT commercial_mandates_confirmed_needs_package
  CHECK (client_confirmed_at IS NULL
         OR (package_key IS NOT NULL
             AND package_version IS NOT NULL
             AND pricing_snapshot IS NOT NULL
             AND pricing_snapshot_sha256 IS NOT NULL
             AND gross_annual_target_compensation_cents IS NOT NULL
             AND client_fee_cents IS NOT NULL));

-- Betraege sind nie negativ, und die Summe geht auf.
ALTER TABLE public.commercial_mandates
  DROP CONSTRAINT IF EXISTS commercial_mandates_amounts_nonnegative;
ALTER TABLE public.commercial_mandates
  ADD CONSTRAINT commercial_mandates_amounts_nonnegative
  CHECK (coalesce(gross_annual_target_compensation_cents, 0) >= 0
     AND coalesce(client_fee_cents, 0) >= 0
     AND coalesce(recruiter_initial_cents, 0) >= 0
     AND coalesce(recruiter_retention_cents, 0) >= 0
     AND coalesce(matchunt_cents, 0) >= 0);

ALTER TABLE public.commercial_mandates
  DROP CONSTRAINT IF EXISTS commercial_mandates_split_adds_up;
ALTER TABLE public.commercial_mandates
  ADD CONSTRAINT commercial_mandates_split_adds_up
  CHECK (client_fee_cents IS NULL
         OR client_fee_cents = coalesce(recruiter_initial_cents, 0)
                             + coalesce(recruiter_retention_cents, 0)
                             + coalesce(matchunt_cents, 0));

-- Gegenzeichnung auch hier nur nach der Kundenunterschrift.
ALTER TABLE public.commercial_mandates
  DROP CONSTRAINT IF EXISTS commercial_mandates_countersign_after_customer;
ALTER TABLE public.commercial_mandates
  ADD CONSTRAINT commercial_mandates_countersign_after_customer
  CHECK (countersigned_at IS NULL
         OR (customer_signed_at IS NOT NULL AND countersigned_at >= customer_signed_at));

-- Ein Einzelauftrag ohne Rahmenvertrag darf nicht zur Unterschrift.
ALTER TABLE public.commercial_mandates
  DROP CONSTRAINT IF EXISTS commercial_mandates_signature_needs_framework;
ALTER TABLE public.commercial_mandates
  ADD CONSTRAINT commercial_mandates_signature_needs_framework
  CHECK (released_for_signature_at IS NULL OR framework_agreement_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS commercial_mandates_framework_idx
  ON public.commercial_mandates (framework_agreement_id)
  WHERE framework_agreement_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS commercial_mandates_envelope_idx
  ON public.commercial_mandates (envelope_id) WHERE envelope_id IS NOT NULL;

COMMENT ON COLUMN public.commercial_mandates.pricing_snapshot IS
  'Unveraenderliches Abbild des Pakets bei der Auswahl. Abgerechnet wird '
  'hieraus, nie aus commercial_packages -- sonst wuerde eine Preisaenderung '
  'bestehende Auftraege rueckwirkend veraendern.';
COMMENT ON COLUMN public.commercial_mandates.gross_annual_target_compensation_cents IS
  'Berechnungsgrundlage in ganzen Cent. Alle Prozentsaetze des Pakets sind '
  'Prozentpunkte HIERVON, nicht Anteile am Kundenhonorar.';
COMMENT ON COLUMN public.commercial_mandates.compensation_basis IS
  'intake_estimate = Schaetzung aus der Aufnahme (unverbindlich). '
  'signed_employment_contract = Bruttojahreszielgehalt aus dem unterzeichneten '
  'Arbeitsvertrag; danach wird abgerechnet.';

-- ----------------------------------------------------------------------------
-- 5) Der Preis kommt aus dem Paket, nicht aus einer Eingabe
-- ----------------------------------------------------------------------------
-- "Der Admin darf fuer eine einzelne Anfrage keinen abweichenden Prozentsatz
-- eintragen." Das ist hier durchgesetzt und nicht im Formular: der Snapshot
-- muss zu einer echten Paketfassung passen, und die Betraege muessen aus ihm
-- folgen.
CREATE OR REPLACE FUNCTION public.commercial_mandates_check_pricing()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE
  p public.commercial_packages%ROWTYPE;
  grundlage numeric;
  erwartet_fee bigint;
  erwartet_init bigint;
  erwartet_ret bigint;
BEGIN
  IF NEW.package_key IS NULL THEN
    RETURN NEW;   -- Auftrag ohne Paketwahl -- noch nichts zu pruefen.
  END IF;

  SELECT * INTO p FROM public.commercial_packages
   WHERE package_key = NEW.package_key AND version = NEW.package_version;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paket %/% existiert nicht.', NEW.package_key, NEW.package_version
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Der Snapshot muss das Paket abbilden, nicht etwas anderes.
  IF NEW.pricing_snapshot IS NOT NULL THEN
    IF (NEW.pricing_snapshot->>'clientFeePct')::numeric IS DISTINCT FROM p.client_fee_pct
    OR (NEW.pricing_snapshot->>'recruiterInitialPct')::numeric IS DISTINCT FROM p.recruiter_initial_pct
    OR (NEW.pricing_snapshot->>'recruiterRetentionPct')::numeric IS DISTINCT FROM p.recruiter_retention_pct
    OR (NEW.pricing_snapshot->>'matchuntPct')::numeric IS DISTINCT FROM p.matchunt_pct
    OR (NEW.pricing_snapshot->>'researchBountyPct')::numeric IS DISTINCT FROM p.research_bounty_pct
    THEN
      RAISE EXCEPTION 'Preis-Snapshot weicht vom Paket %/% ab. Individuelle Konditionen sind nicht vorgesehen.',
        NEW.package_key, NEW.package_version USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Und die Betraege muessen aus der Grundlage folgen. Gerechnet wird in
  -- numeric, nicht in float -- ein halber Cent Abweichung waere hier ein
  -- Zahlungsanspruch, der nirgends gedeckt ist.
  IF NEW.gross_annual_target_compensation_cents IS NOT NULL
     AND NEW.client_fee_cents IS NOT NULL THEN
    grundlage     := NEW.gross_annual_target_compensation_cents::numeric;
    erwartet_fee  := round(grundlage * p.client_fee_pct          / 100);
    erwartet_init := round(grundlage * p.recruiter_initial_pct   / 100);
    erwartet_ret  := round(grundlage * p.recruiter_retention_pct / 100);

    IF NEW.client_fee_cents <> erwartet_fee THEN
      RAISE EXCEPTION 'Kundenhonorar % Cent passt nicht zu % Prozent aus % Cent Grundlage (erwartet % Cent).',
        NEW.client_fee_cents, p.client_fee_pct, NEW.gross_annual_target_compensation_cents, erwartet_fee
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.recruiter_initial_cents IS NOT NULL AND NEW.recruiter_initial_cents <> erwartet_init THEN
      RAISE EXCEPTION 'Initialtranche % Cent passt nicht zu % Prozent aus der Grundlage (erwartet % Cent).',
        NEW.recruiter_initial_cents, p.recruiter_initial_pct, erwartet_init
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.recruiter_retention_cents IS NOT NULL AND NEW.recruiter_retention_cents <> erwartet_ret THEN
      RAISE EXCEPTION 'Einbehalt % Cent passt nicht zu % Prozent aus der Grundlage (erwartet % Cent).',
        NEW.recruiter_retention_cents, p.recruiter_retention_pct, erwartet_ret
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Die alten Prozentspalten bleiben als Anzeige erhalten, werden aber aus dem
  -- Paket gefuellt statt eingegeben.
  NEW.fee_percentage           := p.client_fee_pct;
  NEW.recruiter_fee_percentage := p.recruiter_initial_pct + p.recruiter_retention_pct;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_mandates_pricing ON public.commercial_mandates;
CREATE TRIGGER trg_mandates_pricing
  BEFORE INSERT OR UPDATE ON public.commercial_mandates
  FOR EACH ROW EXECUTE FUNCTION public.commercial_mandates_check_pricing();

-- ----------------------------------------------------------------------------
-- 6) Das Bandmodell abschalten
-- ----------------------------------------------------------------------------
-- Mit drei festen Paketen gibt es keine Bandbreite mehr, in der ein Link
-- abweichen koennte. Der Trigger bleibt als Funktion bestehen, damit alte
-- Migrationen weiter anwendbar sind, wird aber nicht mehr ausgeloest.
DROP TRIGGER IF EXISTS trg_intake_links_fee_band ON public.intake_links;

-- Und die abweichenden Prozentsaetze am Link verschwinden. Ein Link traegt
-- kuenftig hoechstens eine Paketempfehlung, keinen eigenen Preis.
UPDATE public.intake_links
   SET fee_percentage = NULL, recruiter_fee_percentage = NULL
 WHERE fee_percentage IS NOT NULL OR recruiter_fee_percentage IS NOT NULL;

ALTER TABLE public.intake_links
  ADD COLUMN IF NOT EXISTS suggested_package_key text
    CHECK (suggested_package_key IS NULL
           OR suggested_package_key IN ('core', 'continuity_90', 'continuity_180'));

COMMENT ON COLUMN public.intake_links.suggested_package_key IS
  'Optionale Vorauswahl fuer persoenliche Links. Der Kunde kann sie aendern -- '
  'sie ist eine Empfehlung, kein Preis. Abweichende Prozentsaetze je Link gibt '
  'es seit dem Drei-Paket-Modell nicht mehr.';

CREATE OR REPLACE FUNCTION public.intake_links_check_fee_band()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN
  -- Abgeschaltet mit dem Drei-Paket-Modell (2026-09-02). Bleibt als leere
  -- Funktion bestehen, weil 20260901100200 sie referenziert.
  RETURN NEW;
END;
$fn$;

-- ----------------------------------------------------------------------------
-- 7) Der Einzelauftrag haengt am Vertragstext, nicht mehr am Bandmodell
-- ----------------------------------------------------------------------------
-- commercial_mandates.template_id zeigte auf commercial_terms_templates -- die
-- Vorlage MIT Bandbreite. Solange dieser Fremdschluessel NOT NULL ist, laesst
-- sich kein Auftrag anlegen, ohne dass eine Bandvorlage existiert. Das
-- Bandmodell ist abgeloest, also zeigt der Auftrag jetzt auf contract_templates.
ALTER TABLE public.commercial_mandates
  ADD COLUMN IF NOT EXISTS contract_template_id uuid
    REFERENCES public.contract_templates(id);

-- Bestehende Auftraege bekommen die aktive Einzelauftragsfassung.
UPDATE public.commercial_mandates m
   SET contract_template_id = t.id
  FROM public.contract_templates t
 WHERE t.doc_type = 'assignment' AND t.is_active AND t.language = 'de'
   AND m.contract_template_id IS NULL;

-- Die alte Spalte bleibt fuer die Historie, verliert aber ihre Pflicht.
ALTER TABLE public.commercial_mandates ALTER COLUMN template_id DROP NOT NULL;
ALTER TABLE public.commercial_mandates ALTER COLUMN template_version DROP NOT NULL;

COMMENT ON COLUMN public.commercial_mandates.template_id IS
  'ABGELOEST (2026-09-02). Verwies auf commercial_terms_templates, die Vorlage '
  'mit Bandbreite. Bleibt fuer die Historie bestehender Auftraege. Neue '
  'Auftraege verwenden contract_template_id.';
COMMENT ON COLUMN public.commercial_mandates.contract_template_id IS
  'Der Vertragstext des Einzelauftrags aus contract_templates (doc_type = '
  '''assignment''). Zentral gepflegt und versioniert.';

COMMENT ON TABLE public.commercial_terms_templates IS
  'ABGELOEST (2026-09-02) durch commercial_packages. Das Bandmodell -- eine '
  'Vorlage mit Mindest- und Hoechstsatz, Abweichung je Link -- ist mit den drei '
  'festen Paketen gegenstandslos. Die Tabelle bleibt bestehen, weil bestehende '
  'Auftraege ueber template_id darauf zeigen; sie wird nicht mehr gelesen.';

-- Ein bestaetigter Auftrag braucht seinen Vertragstext.
ALTER TABLE public.commercial_mandates
  DROP CONSTRAINT IF EXISTS commercial_mandates_confirmed_needs_template;
ALTER TABLE public.commercial_mandates
  ADD CONSTRAINT commercial_mandates_confirmed_needs_template
  CHECK (client_confirmed_at IS NULL
         OR contract_template_id IS NOT NULL
         OR template_id IS NOT NULL);

COMMIT;