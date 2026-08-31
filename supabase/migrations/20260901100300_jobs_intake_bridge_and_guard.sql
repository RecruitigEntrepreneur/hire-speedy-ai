-- ============================================================================
-- Jobaufnahme-Links · Bruecke zu jobs, Statusguard, Freigabe-Gate (4/6)
-- ----------------------------------------------------------------------------
-- BEFUND 1: jobs.status ist TEXT DEFAULT 'draft' OHNE CHECK und ohne Enum
--   (20251204171610:45). Ein Grep ueber alle 130 Migrationen findet keine
--   einzige Constraint darauf. Tatsaechlich vorkommende Werte: draft,
--   pending_approval, pending_client_approval, published, paused, closed,
--   filled. AdminJobs.tsx:110-120 kennt zwei davon nicht und zeigt sie stumm
--   als "Entwurf".
--
-- BEFUND 2 (der teure): Die UPDATE-Policy lautet
--   FOR UPDATE USING (public.can_edit_job(id)) WITH CHECK (public.can_edit_job(id))
--   -- ohne Spalten- oder Statusbeschraenkung. Postgres-RLS kennt keine
--   Spaltenrechte und einen Trigger gibt es nicht. Ein Kunde kann per PATCH
--   status='published' setzen UND seine eigene fee_percentage bestimmen. Das
--   ist der einzige kommerzielle Kontrollpunkt des Systems, und er ist offen.
--
-- ENTSCHEIDUNG: EIN BEFORE-UPDATE-Trigger, ausdruecklich nicht die
--   WITH-CHECK-Subquery. Begruendung steht in ONBOARDING_INTAKE_MASTERANALYSE
--   F.3: die Policy-Variante ist durch Namensverdeckung wirkungslos und legt
--   mit "infinite recursion detected in policy for relation jobs" jedes UPDATE
--   lahm. Der Trigger aendert ausserdem KEINE bestehende Policy -- relevant,
--   weil 20260710130000 und 20260710230444 dieselben jobs-Policies doppelt
--   definieren und nicht ableitbar ist, welche Fassung produktiv gilt.
--
-- BEFUND 3: Es gibt kein Freigabe-Gate. JobApprovalDialog.tsx:115-126 setzt
--   status='published' ohne jede Vorbedingung.
--
-- ENTSCHEIDUNG: Eine Stelle, die aus einer Jobaufnahme-Anfrage stammt, wird
--   erst veroeffentlicht, wenn die Vermittlungsvereinbarung angenommen und
--   unterzeichnet ist. Durchgesetzt in der Datenbank, nicht im Dialog.
--   Bestandsjobs ohne Mandat bleiben unberuehrt.
--
-- Rein additiv: neue Spalten, ein CHECK, ein Trigger. Keine Policy wird
-- angefasst, keine View neu definiert.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) Herkunft und Vertragsbezug am Job
-- ----------------------------------------------------------------------------
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS intake_draft_id uuid REFERENCES public.intake_drafts(id)      ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS intake_link_id  uuid REFERENCES public.intake_links(id)       ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mandate_id      uuid REFERENCES public.commercial_mandates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source          text,
  ADD COLUMN IF NOT EXISTS owner_user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS jobs_intake_link_idx  ON public.jobs (intake_link_id) WHERE intake_link_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS jobs_intake_draft_idx ON public.jobs (intake_draft_id) WHERE intake_draft_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS jobs_source_idx       ON public.jobs (source) WHERE source IS NOT NULL;
CREATE INDEX IF NOT EXISTS jobs_owner_idx        ON public.jobs (owner_user_id) WHERE owner_user_id IS NOT NULL;

COMMENT ON COLUMN public.jobs.source IS
  'Herkunft der Stelle: dashboard_studio | create_job_wizard | guest_intake | ats_import. '
  'Bisher lag das nur als nicht indizierter JSON-Schluessel in intake_payload.source.';
COMMENT ON COLUMN public.jobs.owner_user_id IS
  'Zustaendiger Matchunt-Betreuer. Nicht approved_by -- das ist der pruefende Admin.';
COMMENT ON COLUMN public.jobs.mandate_id IS
  'Die Vermittlungsvereinbarung zu dieser Stelle. Ist sie gesetzt, verlangt der '
  'Statusguard vor der Veroeffentlichung eine angenommene und unterzeichnete Fassung.';

-- Gegenrichtung: der Entwurf zeigt auf den Job (Spalte in Migration 2 angelegt).
-- Der FK dort ist bereits gesetzt.

-- ----------------------------------------------------------------------------
-- 1b) Contracting-Spalten absichern
-- ----------------------------------------------------------------------------
-- 20260829120000_contracting_terms_and_draft_state.sql (Lovable-Prompt 6) traegt
-- keinen Erledigt-Marker und ist in der generierten types.ts nicht sichtbar --
-- day_rate_min und draft_state existieren produktiv also nicht. accept_intake_draft
-- (Migration 5) schreibt aber Contracting-Konditionen. Statt eine Reihenfolge
-- zwischen zwei Lovable-Prompts zu erzwingen, werden die Spalten hier idempotent
-- angelegt: laeuft Prompt 6 spaeter doch noch, ist er ein No-op.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS day_rate_min              integer,
  ADD COLUMN IF NOT EXISTS day_rate_max              integer,
  ADD COLUMN IF NOT EXISTS contract_duration_months  integer,
  ADD COLUMN IF NOT EXISTS utilization_days_per_week integer,
  ADD COLUMN IF NOT EXISTS extension_possible        boolean,
  ADD COLUMN IF NOT EXISTS draft_state               jsonb;

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_day_rate_range_check;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_day_rate_range_check
  CHECK (day_rate_min IS NULL OR day_rate_max IS NULL OR day_rate_min <= day_rate_max);

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_utilization_check;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_utilization_check
  CHECK (utilization_days_per_week IS NULL OR utilization_days_per_week BETWEEN 1 AND 5);

COMMENT ON COLUMN public.jobs.draft_state IS
  'Vollstaendiger Studio-Zustand eines Entwurfs. Niemals Teil der recruiter_jobs_view.';

-- ----------------------------------------------------------------------------
-- 2) Statusvokabular endlich verbindlich
-- ----------------------------------------------------------------------------
-- Erst den Bestand normalisieren, sonst scheitert die Constraint an
-- Altzeilen. 'pending_client_terms' kommt aus der gelockten Statusmaschine
-- (F.3): angenommen, aber Vertrag noch nicht unterzeichnet.
UPDATE public.jobs
   SET status = 'draft'
 WHERE status IS NULL
    OR status NOT IN ('draft', 'pending_client_approval', 'pending_approval',
                      'pending_client_terms', 'published', 'paused', 'filled', 'closed');

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_status_check CHECK (status IN (
    'draft',                    -- in Arbeit beim Kunden
    'pending_client_approval',  -- interne Freigabe beim Kunden (Hiring Manager)
    'pending_approval',         -- bei Matchunt zur Pruefung
    'pending_client_terms',     -- inhaltlich angenommen, Vertrag offen
    'published',                -- fuer Recruiter sichtbar
    'paused',
    'filled',
    'closed'
  ));

-- ----------------------------------------------------------------------------
-- 3) Der Guard
-- ----------------------------------------------------------------------------
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
BEGIN
  v_is_service := auth.uid() IS NULL;             -- Service-Role / Migration / psql
  v_is_admin   := NOT v_is_service AND public.has_role(auth.uid(), 'admin');

  -- ---- a) Privilegierte Spalten gegen den Kunden schuetzen -----------------
  IF NOT v_is_admin AND NOT v_is_service THEN
    NEW.client_id                := OLD.client_id;
    -- organization_id nur schuetzen, wenn schon eine gesetzt ist. Der
    -- Bestandstrigger org_attach_owner_jobs zieht sie beim Aktivieren einer
    -- Organisation von NULL auf die neue Org nach und laeuft dabei im
    -- Rechtekontext des Kunden -- ein pauschales Zurueckschreiben haette
    -- diesen Pfad still ausgehebelt.
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

    -- Statuswechsel des Kunden: alles ausser der Veroeffentlichung aus dem
    -- Nichts. paused -> published ist erlaubt, weil die Stelle dafuer bereits
    -- einmal freigegeben war.
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
  -- Genau hier steht die Anforderung "erst wenn Aufnahme vollstaendig,
  -- Identitaet verifiziert, kommerzielle Voraussetzungen erfuellt, Auftrag
  -- angenommen und Admin freigegeben hat". Die ersten drei sind beim Uebergang
  -- in jobs bereits erzwungen (accept_intake_draft prueft sie), die vierte
  -- haengt am Mandat, die fuenfte ist dieser Aufruf selbst.
  IF NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published' THEN
    IF NEW.mandate_id IS NOT NULL THEN
      SELECT * INTO m FROM public.commercial_mandates WHERE id = NEW.mandate_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Vermittlungsvereinbarung % nicht gefunden.', NEW.mandate_id
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      IF m.status <> 'accepted' THEN
        RAISE EXCEPTION
          'Stelle nicht freigebbar: Vermittlungsvereinbarung % steht auf "%" statt "accepted".',
          m.mandate_number, m.status
          USING ERRCODE = 'check_violation';
      END IF;

      IF m.signature_status NOT IN ('signed', 'not_required') THEN
        RAISE EXCEPTION
          'Stelle nicht freigebbar: Vertrag % ist nicht unterzeichnet (Stand "%").',
          m.mandate_number, m.signature_status
          USING ERRCODE = 'check_violation';
      END IF;

    ELSIF NEW.intake_draft_id IS NOT NULL THEN
      -- Aus einer Aufnahme-Anfrage entstanden, aber ohne Vertrag: nie freigeben.
      RAISE EXCEPTION
        'Stelle stammt aus einer Beauftragungsanfrage, hat aber keine Vermittlungsvereinbarung.'
        USING ERRCODE = 'check_violation';
    END IF;
    -- Bestandsjobs ohne intake_draft_id/mandate_id laufen unveraendert durch.
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_jobs_guard ON public.jobs;
CREATE TRIGGER trg_jobs_guard
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.jobs_guard_privileged_columns();

COMMENT ON FUNCTION public.jobs_guard_privileged_columns() IS
  'Schuetzt client_id, Konditionen und Freigabefelder gegen Schreibzugriffe der '
  'Kundenseite und erzwingt, dass eine aus einer Beauftragungsanfrage entstandene '
  'Stelle erst nach angenommener und unterzeichneter Vermittlungsvereinbarung '
  'veroeffentlicht wird. Bewusst ein BEFORE-UPDATE-Trigger und keine '
  'WITH-CHECK-Subquery (Rekursionsfalle, siehe ONBOARDING_INTAKE_MASTERANALYSE F.3).';

-- ----------------------------------------------------------------------------
-- 4) Gegenrichtung: Mandat kennt seinen Job
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS commercial_mandates_job_lookup_idx
  ON public.commercial_mandates (job_id, status);

COMMIT;
