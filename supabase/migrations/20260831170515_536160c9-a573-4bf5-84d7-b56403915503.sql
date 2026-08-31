-- ============================================================================
-- Jobaufnahme-Links · Bruecke zu jobs, Statusguard, Freigabe-Gate (4/6)
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
  'Herkunft der Stelle: dashboard_studio | create_job_wizard | guest_intake | ats_import.';
COMMENT ON COLUMN public.jobs.owner_user_id IS
  'Zustaendiger Matchunt-Betreuer. Nicht approved_by -- das ist der pruefende Admin.';
COMMENT ON COLUMN public.jobs.mandate_id IS
  'Die Vermittlungsvereinbarung zu dieser Stelle.';

-- ----------------------------------------------------------------------------
-- 1b) Contracting-Spalten absichern
-- ----------------------------------------------------------------------------
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
UPDATE public.jobs
   SET status = 'draft'
 WHERE status IS NULL
    OR status NOT IN ('draft', 'pending_client_approval', 'pending_approval',
                      'pending_client_terms', 'published', 'paused', 'filled', 'closed');

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_status_check CHECK (status IN (
    'draft',
    'pending_client_approval',
    'pending_approval',
    'pending_client_terms',
    'published',
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
  v_is_service := auth.uid() IS NULL;
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
      RAISE EXCEPTION
        'Stelle stammt aus einer Beauftragungsanfrage, hat aber keine Vermittlungsvereinbarung.'
        USING ERRCODE = 'check_violation';
    END IF;
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
  'Kundenseite und erzwingt das Freigabe-Gate.';

-- ----------------------------------------------------------------------------
-- 4) Gegenrichtung: Mandat kennt seinen Job
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS commercial_mandates_job_lookup_idx
  ON public.commercial_mandates (job_id, status);

COMMIT;