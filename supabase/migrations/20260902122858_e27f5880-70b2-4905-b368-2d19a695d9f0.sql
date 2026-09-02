-- ============================================================================
-- Nachlauf der Aufnahme · Prozesszustaende und Veroeffentlichungssperre (3/3)
-- ----------------------------------------------------------------------------
-- Der Ablauf, den dieses Skript in der Datenbank verankert:
--
--   Aufnahme -> E-Mail-Bestaetigung -> Firmenpruefung -> Paketwahl
--     -> Admin-Freigabe -> ggf. Rueckfragen -> Freigabe zur Unterschrift
--     -> Unterschrift Kunde -> Gegenzeichnung Matchunt -> Stelle frei
--
-- Die oeffentliche Aufnahme ist eine BEWERBUNG UM ZUSAMMENARBEIT, kein
-- angenommener Auftrag. Das ist nicht nur eine Formulierung: an keiner Stelle
-- vor der Gegenzeichnung existiert ein Zustand, aus dem heraus die Stelle
-- veroeffentlicht werden koennte.
--
-- BEFUND zur bisherigen Sperre: jobs_guard_privileged_columns (20260901100300,
--   Zeile 195) laesst 'published' zu, sobald signature_status = 'signed' ist.
--   Das war der einseitige Lauf. Mit der Gegenzeichnung genuegt 'signed' nicht
--   mehr -- ein vom Kunden unterschriebener, von Matchunt nicht angenommener
--   Vertrag ist nicht wirksam, und eine Stelle darunter waere unbezahlt
--   ausgeschrieben.
--
-- ENTSCHEIDUNG (2026-09-02): Die Paketwahl kommt NACH der Aufnahme und nach der
--   Firmenpruefung, nicht waehrend der Aufnahme. Und die Moeglichkeit,
--   individuelle Konditionen zu erfragen, entfaellt ersatzlos -- es gibt drei
--   Pakete, sonst nichts.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) Firmenpruefung als eigene Spur
-- ----------------------------------------------------------------------------
ALTER TABLE public.intake_drafts
  ADD COLUMN IF NOT EXISTS company_state text NOT NULL DEFAULT 'not_checked'
    CHECK (company_state IN ('not_checked', 'checking', 'verified',
                             'needs_review', 'failed')),
  ADD COLUMN IF NOT EXISTS company_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS company_cleared_at timestamptz,
  ADD COLUMN IF NOT EXISTS company_cleared_by uuid,

  -- Paketwahl. Steht am Entwurf, weil sie zwischen Firmenpruefung und
  -- Admin-Freigabe passiert -- vor dem Einzelauftrag.
  ADD COLUMN IF NOT EXISTS selected_package_key text
    CHECK (selected_package_key IS NULL
           OR selected_package_key IN ('core', 'continuity_90', 'continuity_180')),
  ADD COLUMN IF NOT EXISTS selected_package_version integer,
  ADD COLUMN IF NOT EXISTS package_selected_at timestamptz,
  -- Die Schaetzgrundlage, die dem Kunden bei der Wahl angezeigt wurde.
  ADD COLUMN IF NOT EXISTS estimate_basis_cents bigint;

COMMENT ON COLUMN public.intake_drafts.company_state IS
  'Firmenpruefung: not_checked -> checking -> verified | needs_review | failed. '
  'needs_review heisst: die Pruefung hat Abweichungen gefunden, ein Mensch '
  'entscheidet. Die Pruefung entscheidet nie selbst ueber die Annahme.';
COMMENT ON COLUMN public.intake_drafts.selected_package_key IS
  'Vom Kunden gewaehltes Paket. Genau drei moeglich. Die Auswahl erfolgt NACH '
  'der Aufnahme und nach der Firmenpruefung, nicht waehrend der Aufnahme.';
COMMENT ON COLUMN public.intake_drafts.estimate_basis_cents IS
  'Bruttojahreszielgehalt in Cent, das der Paketkarte zugrunde lag. '
  'Unverbindliche Schaetzung -- abgerechnet wird nach dem unterzeichneten '
  'Arbeitsvertrag.';

-- Eine Paketwahl ohne Fassung waere ein Preis ohne Stand.
ALTER TABLE public.intake_drafts
  DROP CONSTRAINT IF EXISTS intake_drafts_package_needs_version;
ALTER TABLE public.intake_drafts
  ADD CONSTRAINT intake_drafts_package_needs_version
  CHECK (selected_package_key IS NULL
         OR (selected_package_version IS NOT NULL AND package_selected_at IS NOT NULL));

ALTER TABLE public.intake_drafts
  DROP CONSTRAINT IF EXISTS intake_drafts_package_fkey;
ALTER TABLE public.intake_drafts
  ADD CONSTRAINT intake_drafts_package_fkey
  FOREIGN KEY (selected_package_key, selected_package_version)
  REFERENCES public.commercial_packages (package_key, version);

-- ----------------------------------------------------------------------------
-- 2) Keine individuellen Konditionen mehr
-- ----------------------------------------------------------------------------
-- 'discussion_requested' war der Zustand hinter dem Knopf "Konditionen
-- besprechen". Den gibt es nicht mehr. Bestandsdaten werden zurueckgesetzt,
-- bevor die Constraint enger wird -- sonst schlaegt die Migration bei jedem
-- Kunden fehl, der gestern auf diesen Knopf gedrueckt hat.
UPDATE public.intake_drafts
   SET commercial_state = 'not_started'
 WHERE commercial_state = 'discussion_requested';

ALTER TABLE public.intake_drafts DROP CONSTRAINT IF EXISTS intake_drafts_commercial_state_check;
ALTER TABLE public.intake_drafts
  ADD CONSTRAINT intake_drafts_commercial_state_check
  CHECK (commercial_state IN ('not_started', 'presented', 'confirmed', 'declined'));

COMMENT ON COLUMN public.intake_drafts.commercial_state IS
  'Paketwahl: not_started -> presented -> confirmed | declined. '
  '''discussion_requested'' ist am 2026-09-02 entfallen -- es gibt drei Pakete '
  'und keine Verhandlung.';

-- Eingereicht wird erst, wenn Aufnahme, Identitaet, Firma und Paket stehen.
-- Die bisherige Constraint verlangte nur Aufnahme und E-Mail.
ALTER TABLE public.intake_drafts DROP CONSTRAINT IF EXISTS intake_drafts_submit_requires_verified;
ALTER TABLE public.intake_drafts
  ADD CONSTRAINT intake_drafts_submit_requires_verified
  CHECK (review_state NOT IN ('pending_admin', 'accepted')
         OR (capture_state = 'complete'
             AND identity_state = 'email_verified'
             AND company_state IN ('verified', 'needs_review')
             AND selected_package_key IS NOT NULL));

-- ----------------------------------------------------------------------------
-- 3) Der Pruefbericht zur Firma
-- ----------------------------------------------------------------------------
-- Die Pruefung liefert einen BERICHT, keine Entscheidung: Ergebnisse,
-- Abweichungen, Quellen, Risikohinweise, Empfehlung. Wer annimmt, ist ein
-- Mensch. Deshalb gibt es hier kein Feld "angenommen".
CREATE TABLE IF NOT EXISTS public.company_verification_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id    uuid NOT NULL REFERENCES public.intake_drafts(id) ON DELETE CASCADE,

  -- Was geprueft wurde, so wie es der Kunde angegeben hat.
  claimed     jsonb NOT NULL,
  -- Was die Pruefung gefunden hat.
  findings    jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Wo es herkommt: [{source, url, retrieved_at, confidence}].
  sources     jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Abweichungen zwischen Angabe und Fund: [{field, claimed, found, severity}].
  deviations  jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_notes  jsonb NOT NULL DEFAULT '[]'::jsonb,

  recommendation text NOT NULL
    CHECK (recommendation IN ('accept', 'review', 'reject')),
  confidence  numeric(4,3) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  summary     text,

  -- Nachvollziehbarkeit des Laufs.
  model       text,
  prompt_version text,
  duration_ms integer,
  error       text,

  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_verification_draft_idx
  ON public.company_verification_reports (draft_id, created_at DESC);

COMMENT ON TABLE public.company_verification_reports IS
  'Bericht der automatisierten Firmenpruefung. Enthaelt Ergebnisse, '
  'Abweichungen, Quellen, Risikohinweise und eine Empfehlung -- aber keine '
  'Entscheidung. Ueber die Annahme entscheidet ein Mensch.';
COMMENT ON COLUMN public.company_verification_reports.recommendation IS
  'Empfehlung an den Admin, nicht Ergebnis. accept = keine Auffaelligkeiten, '
  'review = Abweichungen gefunden, reject = harte Widersprueche.';

ALTER TABLE public.company_verification_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read verification reports" ON public.company_verification_reports;
CREATE POLICY "Admins read verification reports"
  ON public.company_verification_reports FOR ALL TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ----------------------------------------------------------------------------
-- 4) Rueckfragen an den Kunden
-- ----------------------------------------------------------------------------
-- Der Admin fragt nach, der Kunde antwortet ueber einen eigenen Link mit
-- eng begrenztem Umfang -- er oeffnet die Rueckfrage, nicht den Entwurf.
-- Token wie ueberall: 32 Byte CSPRNG, gespeichert wird nur der Hash.
CREATE TABLE IF NOT EXISTS public.intake_clarifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id     uuid NOT NULL REFERENCES public.intake_drafts(id) ON DELETE CASCADE,

  -- Worauf sich die Rueckfrage bezieht. Der Link gibt genau diese Felder frei.
  scope_fields text[] NOT NULL DEFAULT '{}',
  question     text NOT NULL,
  answer       text,

  status       text NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open', 'answered', 'resolved', 'withdrawn', 'expired')),

  token_hash   text NOT NULL,
  expires_at   timestamptz NOT NULL,
  opened_at    timestamptz,
  answered_at  timestamptz,
  resolved_at  timestamptz,
  resolved_by  uuid,

  asked_by     uuid NOT NULL,
  -- Fassung des Entwurfs, auf die sich die Rueckfrage bezog. Ohne sie liesse
  -- sich hinterher nicht sagen, worauf der Kunde geantwortet hat.
  draft_revision integer,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT intake_clarifications_token_key UNIQUE (token_hash),
  CONSTRAINT intake_clarifications_answered_needs_answer
    CHECK (status NOT IN ('answered', 'resolved') OR answer IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS intake_clarifications_draft_idx
  ON public.intake_clarifications (draft_id, created_at DESC);
CREATE INDEX IF NOT EXISTS intake_clarifications_open_idx
  ON public.intake_clarifications (status, expires_at) WHERE status = 'open';

COMMENT ON TABLE public.intake_clarifications IS
  'Rueckfragen des Admins an den Kunden. Der Antwortlink hat engen Umfang: er '
  'gibt die Felder aus scope_fields frei, nicht den gesamten Entwurf. '
  'Gespeichert wird nur der Token-Hash, nie das Token selbst.';
COMMENT ON COLUMN public.intake_clarifications.scope_fields IS
  'Die Felder, die dieser Link bearbeitbar macht. Leer = nur Textantwort, '
  'keine Aenderung am Entwurf.';

ALTER TABLE public.intake_clarifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage clarifications" ON public.intake_clarifications;
CREATE POLICY "Admins manage clarifications"
  ON public.intake_clarifications FOR ALL TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_clarifications_touch ON public.intake_clarifications;
CREATE TRIGGER trg_clarifications_touch
  BEFORE UPDATE ON public.intake_clarifications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 5) Annahme setzt ein Angebot voraus
-- ----------------------------------------------------------------------------
-- Ohne das koennte ein Auftrag auf 'accepted' stehen, den der Kunde nie
-- bestaetigt hat -- und damit das Freigabe-Gate passieren, ohne dass je
-- jemand ein Angebot abgegeben haette.
ALTER TABLE public.commercial_mandates
  DROP CONSTRAINT IF EXISTS commercial_mandates_accepted_needs_offer;
ALTER TABLE public.commercial_mandates
  ADD CONSTRAINT commercial_mandates_accepted_needs_offer
  CHECK (status <> 'accepted' OR client_confirmed_at IS NOT NULL);

-- ----------------------------------------------------------------------------
-- 6) Die Veroeffentlichungssperre, zweistufig
-- ----------------------------------------------------------------------------
-- Bisher genuegte signature_status = 'signed' -- der einseitige Lauf. Jetzt
-- muessen BEIDE unterschrieben haben und der Rahmenvertrag wirksam sein.
-- Ein vom Kunden unterschriebener, von Matchunt nicht angenommener Vertrag ist
-- nicht wirksam; eine Stelle darunter waere unbezahlt ausgeschrieben.
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
    -- organization_id nur schuetzen, wenn schon eine gesetzt ist (siehe
    -- 20260901100300: org_attach_owner_jobs zieht sie im Kundenkontext nach).
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
        RAISE EXCEPTION 'Einzelauftrag % nicht gefunden.', NEW.mandate_id
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      IF m.status <> 'accepted' THEN
        RAISE EXCEPTION
          'Stelle nicht freigebbar: Einzelauftrag % steht auf "%" statt "accepted".',
          m.mandate_number, m.status USING ERRCODE = 'check_violation';
      END IF;

      -- Das Paket ist Pflicht. Ein Auftrag ohne Paket hat keinen Preis.
      IF m.package_key IS NULL OR m.pricing_snapshot IS NULL THEN
        RAISE EXCEPTION
          'Stelle nicht freigebbar: Einzelauftrag % hat kein Paket und keinen Preis-Snapshot.',
          m.mandate_number USING ERRCODE = 'check_violation';
      END IF;

      -- Beide Unterschriften. Erst die Gegenzeichnung macht den Vertrag wirksam.
      IF m.customer_signed_at IS NULL THEN
        RAISE EXCEPTION
          'Stelle nicht freigebbar: Einzelauftrag % ist vom Kunden nicht unterzeichnet.',
          m.mandate_number USING ERRCODE = 'check_violation';
      END IF;
      IF m.countersigned_at IS NULL THEN
        RAISE EXCEPTION
          'Stelle nicht freigebbar: Einzelauftrag % ist von Matchunt nicht gegengezeichnet.',
          m.mandate_number USING ERRCODE = 'check_violation';
      END IF;

      -- Und der Rahmenvertrag darunter muss wirksam sein.
      IF m.framework_agreement_id IS NULL THEN
        RAISE EXCEPTION
          'Stelle nicht freigebbar: Einzelauftrag % haengt an keinem Rahmenvertrag.',
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

    ELSIF NEW.intake_draft_id IS NOT NULL THEN
      RAISE EXCEPTION
        'Stelle stammt aus einer Beauftragungsanfrage, hat aber keinen Einzelauftrag.'
        USING ERRCODE = 'check_violation';
    END IF;
    -- Bestandsjobs ohne intake_draft_id/mandate_id laufen unveraendert durch.
  END IF;

  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.jobs_guard_privileged_columns() IS
  'Schuetzt privilegierte Spalten gegen den Kunden und haelt die '
  'Veroeffentlichungssperre. Seit 2026-09-02 zweistufig: Einzelauftrag '
  'angenommen UND vom Kunden unterzeichnet UND von Matchunt gegengezeichnet, '
  'dazu ein wirksamer Rahmenvertrag. Ein einseitig unterschriebener Vertrag '
  'reicht nicht.';

COMMIT;