-- ============================================================================
-- Ein Rahmenvertrag je Kunde -- danach nur noch Beauftragung im System
-- ============================================================================
-- Bisher trug jede Position ihren eigenen Vertrag: eigener Snapshot, eigener
-- DocuSign-Lauf, eigene Gegenzeichnung. Der Kunde unterschrieb bei der zweiten
-- Stelle dasselbe noch einmal.
--
-- Neu: die Konditionen werden EINMAL im Rahmenvertrag gewaehlt und stehen
-- danach fest. Der Rahmenvertrag beschreibt selbst, wie Auftraege erteilt
-- werden -- naemlich ueber dieses System. Jede weitere Position ist damit eine
-- Beauftragung UNTER dem Rahmenvertrag: ein protokollierter Vorgang mit
-- Zeitpunkt, Person, Konditionen-Abbild und Textfassung, keine zweite
-- Unterschrift.
--
-- Additiv. Bestehende Vorgaenge mit unterschriebenem Einzelauftrag bleiben
-- gueltig und laufen unveraendert durch die Freigabesperre.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Die Konditionen gehoeren an den Rahmenvertrag
-- ---------------------------------------------------------------------------
-- Sie standen bisher am Einzelauftrag. Dort waren sie je Position waehlbar --
-- genau das soll es nicht mehr geben.
ALTER TABLE public.client_framework_agreements
  ADD COLUMN IF NOT EXISTS package_key             text,
  ADD COLUMN IF NOT EXISTS package_version         integer,
  ADD COLUMN IF NOT EXISTS pricing_snapshot        jsonb,
  ADD COLUMN IF NOT EXISTS pricing_snapshot_sha256 text,
  ADD COLUMN IF NOT EXISTS package_selected_at     timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_framework_package_fkey'
  ) THEN
    ALTER TABLE public.client_framework_agreements
      ADD CONSTRAINT client_framework_package_fkey
      FOREIGN KEY (package_key, package_version)
      REFERENCES public.commercial_packages (package_key, version);
  END IF;
END $$;

-- Ein wirksamer Rahmenvertrag ohne Konditionen waere eine Rechtsgrundlage
-- ohne Preis. Bestandszeilen sind davon nicht betroffen: sie sind entweder
-- noch nicht 'active' oder wurden im alten Modell ohne Paket wirksam -- fuer
-- die greift weiterhin der Einzelauftrag-Pfad in der Freigabesperre.
ALTER TABLE public.client_framework_agreements
  DROP CONSTRAINT IF EXISTS framework_active_needs_pricing;

COMMENT ON COLUMN public.client_framework_agreements.package_key IS
  'Einmal gewaehlte Kondition, gilt fuer alle Positionen unter diesem '
  'Rahmenvertrag. Nicht je Position waehlbar.';
COMMENT ON COLUMN public.client_framework_agreements.pricing_snapshot IS
  'Unveraenderliches Abbild des Pakets zum Zeitpunkt der Wahl. Preise werden '
  'daraus gerechnet, nie aus commercial_packages -- sonst wuerde eine spaetere '
  'Preisaenderung rueckwirkend gelten.';

-- ---------------------------------------------------------------------------
-- 2. Der Einzelauftrag wird zum Auftragsnachweis
-- ---------------------------------------------------------------------------
-- Die Unterschriftsspalten bleiben stehen: Vorgaenge aus dem alten Modell
-- muessen weiter lesbar und pruefbar sein. Neu befuellt werden sie nicht mehr.
ALTER TABLE public.commercial_mandates
  ADD COLUMN IF NOT EXISTS ordered_at          timestamptz,
  ADD COLUMN IF NOT EXISTS ordered_by_name     text,
  ADD COLUMN IF NOT EXISTS ordered_by_email    text,
  ADD COLUMN IF NOT EXISTS ordered_ip_hash     text,
  ADD COLUMN IF NOT EXISTS ordered_user_agent  text,
  -- Unter welcher Fassung des Rahmenvertragstexts bestellt wurde. Ohne diese
  -- Angabe liesse sich spaeter nicht mehr zeigen, welche Auftragsregel galt.
  ADD COLUMN IF NOT EXISTS order_terms_version integer;

COMMENT ON COLUMN public.commercial_mandates.ordered_at IS
  'Zeitpunkt der Beauftragung im System. Der Rahmenvertrag definiert diesen '
  'Vorgang als verbindliche Auftragserteilung -- er ersetzt die Unterschrift '
  'je Position.';

-- Ein Auftrag im neuen Modell braucht seinen Nachweis vollstaendig.
ALTER TABLE public.commercial_mandates
  DROP CONSTRAINT IF EXISTS mandate_order_needs_proof;
ALTER TABLE public.commercial_mandates
  ADD CONSTRAINT mandate_order_needs_proof
  CHECK (ordered_at IS NULL
         OR (ordered_by_email IS NOT NULL AND framework_agreement_id IS NOT NULL));

CREATE INDEX IF NOT EXISTS commercial_mandates_framework_idx
  ON public.commercial_mandates (framework_agreement_id)
  WHERE framework_agreement_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Den wirksamen Rahmenvertrag eines Kunden finden
-- ---------------------------------------------------------------------------
-- Vor der Kontoanlage gibt es keine Organisation. Dann traegt die per Code
-- VERIFIZIERTE E-Mail-Domain die Zuordnung; die USt-IdNr. bestaetigt sie
-- zusaetzlich. Freemail zaehlt nie: eine gmail-Adresse ist kein Unternehmen.
-- Widerspricht die USt-IdNr., wird nichts zugeordnet -- lieber ein Vertrag zu
-- viel als ein fremder Rahmenvertrag.
CREATE OR REPLACE FUNCTION public.active_framework_for_draft(_draft_id uuid)
RETURNS public.client_framework_agreements
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  d  public.intake_drafts%ROWTYPE;
  rv public.client_framework_agreements%ROWTYPE;
BEGIN
  SELECT * INTO d FROM public.intake_drafts WHERE id = _draft_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Sicherster Weg: der Entwurf haengt bereits an einer Organisation.
  IF d.matched_organization_id IS NOT NULL THEN
    SELECT * INTO rv FROM public.client_framework_agreements
     WHERE organization_id = d.matched_organization_id
       AND status = 'active'
     ORDER BY created_at DESC LIMIT 1;
    IF FOUND THEN RETURN rv; END IF;
  END IF;

  -- Sonst die verifizierte Domain. Ohne bestaetigte E-Mail keine Zuordnung:
  -- sonst genuegte eine behauptete Adresse, um unter fremden Konditionen zu
  -- bestellen.
  IF d.company_domain IS NULL OR COALESCE(d.is_freemail, false)
     OR d.identity_state <> 'email_verified' THEN
    RETURN NULL;
  END IF;

  SELECT rv2.* INTO rv
    FROM public.client_framework_agreements rv2
   WHERE rv2.status = 'active'
     AND lower(rv2.snapshot #>> '{client,company_domain}') = lower(d.company_domain)
     -- USt-IdNr. muss passen, wenn beide Seiten eine tragen.
     AND (
          d.company_vat_id IS NULL
       OR rv2.snapshot #>> '{client,company_vat_id}' IS NULL
       OR upper(regexp_replace(rv2.snapshot #>> '{client,company_vat_id}', '\s', '', 'g'))
        = upper(regexp_replace(d.company_vat_id, '\s', '', 'g'))
     )
   ORDER BY rv2.created_at DESC
   LIMIT 1;

  RETURN rv;   -- NULL, wenn nichts gefunden
END;
$fn$;

COMMENT ON FUNCTION public.active_framework_for_draft(uuid) IS
  'Findet den wirksamen Rahmenvertrag zu einem Aufnahme-Entwurf: erst ueber '
  'die Organisation, sonst ueber die verifizierte Firmendomain mit '
  'USt-IdNr.-Abgleich. Freemail und unbestaetigte Adressen ordnen nie zu.';

REVOKE ALL ON FUNCTION public.active_framework_for_draft(uuid) FROM public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Freigabesperre: die Unterschrift zaehlt am Rahmenvertrag
-- ---------------------------------------------------------------------------
-- Neu gilt: der Rahmenvertrag ist wirksam (beidseitig unterschrieben), traegt
-- die Konditionen, und die Position wurde unter ihm beauftragt. Der alte Weg
-- -- unterschriebener Einzelauftrag -- bleibt gueltig, sonst laegen laufende
-- Vorgaenge fest.
CREATE OR REPLACE FUNCTION public.jobs_guard_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_is_admin   boolean;
  v_is_service boolean;
  m            public.commercial_mandates%ROWTYPE;
  rv           public.client_framework_agreements%ROWTYPE;
BEGIN
  v_is_service := auth.uid() IS NULL;             -- Service-Role / Migration / psql
  v_is_admin   := NOT v_is_service AND public.has_role(auth.uid(), 'admin');

  -- ---- a) Privilegierte Spalten gegen den Kunden schuetzen -----------------
  IF NOT v_is_admin AND NOT v_is_service THEN
    NEW.client_id                := OLD.client_id;
    IF OLD.organization_id IS NOT NULL THEN
      NEW.organization_id := OLD.organization_id;
    END IF;
    NEW.fee_percentage           := OLD.fee_percentage;
    NEW.recruiter_fee_percentage := OLD.recruiter_fee_percentage;
    NEW.approved_by              := OLD.approved_by;
    NEW.approved_at              := OLD.approved_at;
    NEW.mandate_id               := OLD.mandate_id;
    NEW.intake_draft_id          := OLD.intake_draft_id;
    NEW.intake_link_id           := OLD.intake_link_id;
    NEW.owner_user_id            := OLD.owner_user_id;
    NEW.source                   := OLD.source;

    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status = 'published'
       AND OLD.status <> 'paused' THEN
      RAISE EXCEPTION
        'Eine Stelle wird ausschliesslich durch Matchunt veroeffentlicht (Wechsel % nach %).',
        OLD.status, NEW.status
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  -- ---- b) Freigabe-Gate: gilt fuer alle, auch fuer Admins ------------------
  IF NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published' THEN
    IF NEW.mandate_id IS NOT NULL THEN
      SELECT * INTO m FROM public.commercial_mandates WHERE id = NEW.mandate_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Auftrag % nicht gefunden.', NEW.mandate_id
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      IF m.status <> 'accepted' THEN
        RAISE EXCEPTION
          'Stelle nicht freigebbar: Auftrag % steht auf "%" statt "accepted".',
          m.mandate_number, m.status USING ERRCODE = 'check_violation';
      END IF;

      -- Ein Auftrag ohne Paket hat keinen Preis -- unabhaengig vom Modell.
      IF m.package_key IS NULL OR m.pricing_snapshot IS NULL THEN
        RAISE EXCEPTION
          'Stelle nicht freigebbar: Auftrag % hat kein Paket und keinen Preis-Snapshot.',
          m.mandate_number USING ERRCODE = 'check_violation';
      END IF;

      -- Der Rahmenvertrag darunter ist in beiden Modellen Pflicht.
      IF m.framework_agreement_id IS NULL THEN
        RAISE EXCEPTION
          'Stelle nicht freigebbar: Auftrag % haengt an keinem Rahmenvertrag.',
          m.mandate_number USING ERRCODE = 'check_violation';
      END IF;
      SELECT * INTO rv FROM public.client_framework_agreements
       WHERE id = m.framework_agreement_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Rahmenvertrag % nicht gefunden.', m.framework_agreement_id
          USING ERRCODE = 'foreign_key_violation';
      END IF;
      IF rv.status <> 'active' THEN
        RAISE EXCEPTION
          'Stelle nicht freigebbar: Rahmenvertrag % steht auf "%" statt "active".',
          rv.agreement_number, rv.status USING ERRCODE = 'check_violation';
      END IF;

      -- Ab hier trennen sich die beiden Modelle.
      IF m.ordered_at IS NOT NULL THEN
        -- Neues Modell: die Unterschrift steckt im Rahmenvertrag, die
        -- Beauftragung im protokollierten Vorgang. Der Nachweis muss
        -- vollstaendig sein, sonst ist der Auftrag nicht belegbar.
        IF m.ordered_by_email IS NULL THEN
          RAISE EXCEPTION
            'Stelle nicht freigebbar: Auftrag % hat keinen Besteller.',
            m.mandate_number USING ERRCODE = 'check_violation';
        END IF;
      ELSE
        -- Altes Modell: der Einzelauftrag traegt beide Unterschriften selbst.
        IF m.customer_signed_at IS NULL THEN
          RAISE EXCEPTION
            'Stelle nicht freigebbar: Auftrag % ist weder beauftragt noch vom Kunden unterzeichnet.',
            m.mandate_number USING ERRCODE = 'check_violation';
        END IF;
        IF m.countersigned_at IS NULL THEN
          RAISE EXCEPTION
            'Stelle nicht freigebbar: Auftrag % ist von Matchunt nicht gegengezeichnet.',
            m.mandate_number USING ERRCODE = 'check_violation';
        END IF;
      END IF;

    ELSIF NEW.intake_draft_id IS NOT NULL THEN
      RAISE EXCEPTION
        'Stelle stammt aus einer Beauftragungsanfrage, hat aber keinen Auftrag.'
        USING ERRCODE = 'check_violation';
    END IF;
    -- Bestandsjobs ohne intake_draft_id/mandate_id laufen unveraendert durch.
  END IF;

  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.jobs_guard_privileged_columns() IS
  'Schuetzt privilegierte Spalten gegen den Kunden und haelt die '
  'Veroeffentlichungssperre. Seit 2026-09-03 zwei zulaessige Wege: entweder '
  'ein unter einem wirksamen Rahmenvertrag beauftragter Auftrag (ordered_at '
  'gesetzt, Besteller protokolliert) oder -- fuer Altvorgaenge -- ein '
  'beidseitig unterschriebener Einzelauftrag. In beiden Faellen muss der '
  'Rahmenvertrag wirksam sein und der Auftrag ein Paket mit Preis-Snapshot '
  'tragen.';

COMMIT;