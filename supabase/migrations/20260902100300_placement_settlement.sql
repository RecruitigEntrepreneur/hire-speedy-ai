-- ============================================================================
-- Nachlauf der Aufnahme · Abrechnung, Continuity und Ersatzsuche (4/4)
-- ----------------------------------------------------------------------------
-- BEFUND: placements traegt total_fee / platform_fee / recruiter_payout als
--   freie DECIMAL(12,2) -- drei Zahlen ohne Herkunft. Kein Paket, kein
--   Einbehalt, kein Continuity-Zeitraum, keine Frist. invoices existiert seit
--   20251204182100 und wird nirgends erzeugt. payout_requests.amount ist
--   ebenfalls frei. Und die Rechnung selbst lebte in vier Fassungen:
--   process-offer-response nahm den Recruiter-Anteil als Quote des Honorars,
--   AdminPlacements zog pauschal 20 Prozent Plattformanteil ab.
--
-- ENTSCHEIDUNG (2026-09-02): Die Spuren werden getrennt gefuehrt. Ein einziges
--   status-Feld waere genau das Split-Brain, das jobs.status heute hat --
--   sieben Werte, drei Komponenten, je eigene Auslegung. Hier gibt es
--   stattdessen fuenf Spuren, die sich nicht gegenseitig ueberschreiben:
--     placement_state  -- laeuft die Beschaeftigung?
--     continuity_state -- laeuft der Anspruchszeitraum, ist ein Fall gemeldet?
--     retention_state  -- ist die einbehaltene Tranche noch gebunden?
--     invoice_state    -- ist die Rechnung gestellt, bezahlt, ueberfaellig?
--     research_state   -- laeuft ein erneuter Suchlauf?
--
--   Abgerechnet wird nach dem BRUTTOJAHRESZIELGEHALT AUS DEM UNTERZEICHNETEN
--   ARBEITSVERTRAG, nicht nach der Schaetzung aus der Aufnahme. Die Schaetzung
--   stand nur auf der Paketkarte.
--
--   Die einbehaltene Tranche wird NICHT am Ende des Continuity-Zeitraums frei,
--   sondern erst nach Ablauf der Meldefrist. Wer am Tag 90 ausscheidet, hat
--   danach noch 14 Tage Zeit, das zu melden -- eine am Tag 90 ausgezahlte
--   Tranche stuende fuer diesen Fall nicht mehr zur Verfuegung.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) Das Placement bekommt Paket, Grundlage und Fristen
-- ----------------------------------------------------------------------------
ALTER TABLE public.placements
  ADD COLUMN IF NOT EXISTS mandate_id uuid
    REFERENCES public.commercial_mandates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS package_key     text
    CHECK (package_key IS NULL OR package_key IN ('core','continuity_90','continuity_180')),
  ADD COLUMN IF NOT EXISTS package_version integer,
  ADD COLUMN IF NOT EXISTS pricing_snapshot jsonb,

  -- Die Abrechnungsgrundlage aus dem unterzeichneten Arbeitsvertrag.
  ADD COLUMN IF NOT EXISTS gross_annual_target_compensation_cents bigint,
  ADD COLUMN IF NOT EXISTS compensation_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS compensation_verified_by uuid,

  -- Betraege in ganzen Cent, aus Grundlage und Snapshot gerechnet.
  ADD COLUMN IF NOT EXISTS client_fee_cents          bigint,
  ADD COLUMN IF NOT EXISTS recruiter_initial_cents   bigint,
  ADD COLUMN IF NOT EXISTS recruiter_retention_cents bigint,
  ADD COLUMN IF NOT EXISTS matchunt_cents            bigint,

  -- Fristen. first_working_day ist der Ankerpunkt fuer alles Weitere.
  ADD COLUMN IF NOT EXISTS first_working_day     date,
  ADD COLUMN IF NOT EXISTS continuity_end_date   date,
  ADD COLUMN IF NOT EXISTS retention_release_date date,

  -- ---- Die fuenf Spuren ----------------------------------------------------
  ADD COLUMN IF NOT EXISTS placement_state text NOT NULL DEFAULT 'agreed'
    CHECK (placement_state IN ('agreed', 'started', 'ended_early', 'completed', 'cancelled')),
  ADD COLUMN IF NOT EXISTS continuity_state text NOT NULL DEFAULT 'not_applicable'
    CHECK (continuity_state IN ('not_applicable', 'running', 'passed',
                                'claim_open', 'claim_accepted', 'claim_rejected')),
  ADD COLUMN IF NOT EXISTS retention_state text NOT NULL DEFAULT 'not_applicable'
    CHECK (retention_state IN ('not_applicable', 'withheld', 'released', 'forfeited')),
  ADD COLUMN IF NOT EXISTS invoice_state text NOT NULL DEFAULT 'not_invoiced'
    CHECK (invoice_state IN ('not_invoiced', 'invoiced', 'paid', 'overdue',
                             'disputed', 'written_off')),
  ADD COLUMN IF NOT EXISTS research_state text NOT NULL DEFAULT 'not_applicable'
    CHECK (research_state IN ('not_applicable', 'running', 'paused',
                              'succeeded', 'exhausted', 'cancelled')),

  ADD COLUMN IF NOT EXISTS ended_at date,
  ADD COLUMN IF NOT EXISTS end_reason text;

COMMENT ON COLUMN public.placements.gross_annual_target_compensation_cents IS
  'Bruttojahreszielgehalt aus dem UNTERZEICHNETEN ARBEITSVERTRAG, in Cent. '
  'Grundlage der Abrechnung. Die Schaetzung aus der Aufnahme stand nur auf der '
  'Paketkarte und wird hier nicht verwendet.';
COMMENT ON COLUMN public.placements.retention_release_date IS
  'Continuity-Zeitraum PLUS Meldefrist. Nicht das Ende des Zeitraums: wer am '
  'letzten Tag ausscheidet, hat danach noch die volle Meldefrist -- eine frueher '
  'ausgezahlte Tranche stuende dafuer nicht mehr zur Verfuegung.';
COMMENT ON COLUMN public.placements.placement_state IS
  'Eine von fuenf getrennten Spuren. Ein einziges Sammelfeld waere das '
  'Split-Brain, das jobs.status heute hat.';

CREATE INDEX IF NOT EXISTS placements_mandate_idx
  ON public.placements (mandate_id) WHERE mandate_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS placements_retention_due_idx
  ON public.placements (retention_release_date)
  WHERE retention_state = 'withheld';
CREATE INDEX IF NOT EXISTS placements_continuity_idx
  ON public.placements (continuity_end_date)
  WHERE continuity_state = 'running';

-- Die Betraege muessen aufgehen -- dieselbe Regel wie am Auftrag.
ALTER TABLE public.placements DROP CONSTRAINT IF EXISTS placements_split_adds_up;
ALTER TABLE public.placements
  ADD CONSTRAINT placements_split_adds_up
  CHECK (client_fee_cents IS NULL
         OR client_fee_cents = coalesce(recruiter_initial_cents, 0)
                             + coalesce(recruiter_retention_cents, 0)
                             + coalesce(matchunt_cents, 0));

-- Ein Einbehalt ohne Freigabedatum waere unbefristet gebunden.
ALTER TABLE public.placements DROP CONSTRAINT IF EXISTS placements_retention_needs_date;
ALTER TABLE public.placements
  ADD CONSTRAINT placements_retention_needs_date
  CHECK (retention_state <> 'withheld' OR retention_release_date IS NOT NULL);

-- ----------------------------------------------------------------------------
-- 2) Fristen und Betraege werden gerechnet, nicht eingetragen
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.placements_derive()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE
  s          jsonb;
  grundlage  numeric;
  cont_days  integer;
  notice     integer;
BEGIN
  s := NEW.pricing_snapshot;
  IF s IS NULL THEN
    RETURN NEW;   -- Bestandsplacement ohne Paket -- unveraendert durchlassen.
  END IF;

  cont_days := nullif(s->>'continuityDays', '')::integer;
  notice    := coalesce(nullif(s->>'claimNoticeDays', '')::integer, 14);

  -- Fristen ab dem ersten Arbeitstag.
  IF NEW.first_working_day IS NOT NULL AND cont_days IS NOT NULL THEN
    NEW.continuity_end_date    := NEW.first_working_day + cont_days;
    -- Zeitraum PLUS Meldefrist, nicht nur Zeitraum.
    NEW.retention_release_date := NEW.first_working_day + cont_days + notice;
  ELSIF cont_days IS NULL THEN
    NEW.continuity_end_date    := NULL;
    NEW.retention_release_date := NULL;
  END IF;

  -- Betraege aus der Grundlage. numeric, nicht float: ein halber Cent waere
  -- hier ein Zahlungsanspruch ohne Deckung.
  IF NEW.gross_annual_target_compensation_cents IS NOT NULL THEN
    grundlage := NEW.gross_annual_target_compensation_cents::numeric;
    NEW.client_fee_cents          := round(grundlage * (s->>'clientFeePct')::numeric / 100);
    NEW.recruiter_initial_cents   := round(grundlage * (s->>'recruiterInitialPct')::numeric / 100);
    NEW.recruiter_retention_cents := round(grundlage * (s->>'recruiterRetentionPct')::numeric / 100);
    -- Matchunt als Rest, damit die Summe exakt aufgeht.
    NEW.matchunt_cents := NEW.client_fee_cents
                        - NEW.recruiter_initial_cents
                        - NEW.recruiter_retention_cents;

    -- Die alten Freitextspalten mitfuehren, damit Bestandsansichten weiter
    -- stimmen statt still zu veralten.
    NEW.total_fee        := round(NEW.client_fee_cents::numeric / 100, 2);
    NEW.platform_fee     := round(NEW.matchunt_cents::numeric / 100, 2);
    NEW.recruiter_payout := round((NEW.recruiter_initial_cents
                                 + NEW.recruiter_retention_cents)::numeric / 100, 2);
  END IF;

  -- Spuren, die sich aus dem Paket ergeben.
  IF cont_days IS NULL THEN
    NEW.continuity_state := 'not_applicable';
    IF coalesce(NEW.recruiter_retention_cents, 0) = 0 THEN
      NEW.retention_state := 'not_applicable';
    END IF;
  ELSIF NEW.placement_state = 'started' AND NEW.continuity_state = 'not_applicable' THEN
    NEW.continuity_state := 'running';
    IF NEW.retention_state = 'not_applicable' THEN
      NEW.retention_state := 'withheld';
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_placements_derive ON public.placements;
CREATE TRIGGER trg_placements_derive
  BEFORE INSERT OR UPDATE ON public.placements
  FOR EACH ROW EXECUTE FUNCTION public.placements_derive();

COMMENT ON FUNCTION public.placements_derive() IS
  'Rechnet Fristen und Betraege aus Grundlage und Preis-Snapshot. Damit gibt es '
  'nur noch eine Rechnung statt der vier Fassungen in process-offer-response, '
  'AdminPlacements, useRecruiterStats und FeeCalculatorCard.';

-- ----------------------------------------------------------------------------
-- 3) Der Continuity-Fall
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.continuity_claims (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id  uuid NOT NULL REFERENCES public.placements(id) ON DELETE CASCADE,
  mandate_id    uuid REFERENCES public.commercial_mandates(id) ON DELETE SET NULL,

  category      text NOT NULL,
  description   text,

  -- Der Tag des Ausscheidens, der Tag der Kenntnis, der Tag der Meldung.
  -- Drei verschiedene Daten; die Frist laeuft ab Kenntnis.
  separation_date date NOT NULL,
  known_at        date NOT NULL,
  reported_at     timestamptz NOT NULL DEFAULT now(),
  deadline        date NOT NULL,

  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'in_review', 'accepted', 'rejected', 'withdrawn')),
  rejection_reason text,
  decided_at  timestamptz,
  decided_by  uuid,

  evidence    jsonb NOT NULL DEFAULT '[]'::jsonb,
  reported_by uuid,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- Genau ein anerkannter Fall je Placement. Das Paket sagt "einmaliger
  -- erneuter Suchlauf" -- zwei anerkannte Faelle waeren zwei Auslobungen aus
  -- einem Honorar.
  CONSTRAINT continuity_claims_dates_ordered
    CHECK (known_at >= separation_date),
  CONSTRAINT continuity_claims_rejected_needs_reason
    CHECK (status <> 'rejected' OR rejection_reason IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS continuity_claims_one_accepted_idx
  ON public.continuity_claims (placement_id) WHERE status = 'accepted';
CREATE INDEX IF NOT EXISTS continuity_claims_placement_idx
  ON public.continuity_claims (placement_id, created_at DESC);
CREATE INDEX IF NOT EXISTS continuity_claims_open_idx
  ON public.continuity_claims (status, deadline) WHERE status IN ('submitted', 'in_review');

COMMENT ON TABLE public.continuity_claims IS
  'Gemeldete Continuity-Faelle. Hoechstens einer je Placement kann anerkannt '
  'werden -- das Paket sagt "einmaliger erneuter Suchlauf", zwei anerkannte '
  'Faelle waeren zwei Auslobungen aus einem Honorar.';
COMMENT ON COLUMN public.continuity_claims.known_at IS
  'Tag der Kenntnis. Die Meldefrist laeuft ab hier, nicht ab dem Tag des '
  'Ausscheidens -- der Kunde erfaehrt eine Kuendigung nicht immer am selben Tag.';

ALTER TABLE public.continuity_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage continuity claims" ON public.continuity_claims;
CREATE POLICY "Admins manage continuity claims"
  ON public.continuity_claims FOR ALL TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_continuity_claims_touch ON public.continuity_claims;
CREATE TRIGGER trg_continuity_claims_touch
  BEFORE UPDATE ON public.continuity_claims
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 4) Ein Fall wird gegen das Paket geprueft, nicht gegen eine Liste im Code
-- ----------------------------------------------------------------------------
-- Welche Gruende zaehlen, steht im Preis-Snapshot des Placements. Damit gilt
-- fuer einen alten Auftrag die Liste, die bei seinem Abschluss galt -- und
-- nicht die, die heute gilt.
CREATE OR REPLACE FUNCTION public.continuity_claims_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE
  p          public.placements%ROWTYPE;
  s          jsonb;
  cont_days  integer;
  notice     integer;
  frist      date;
BEGIN
  SELECT * INTO p FROM public.placements WHERE id = NEW.placement_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Placement % existiert nicht.', NEW.placement_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  s := p.pricing_snapshot;
  IF s IS NULL THEN
    RAISE EXCEPTION 'Placement % hat keinen Preis-Snapshot -- ohne Paket gibt es keinen Anspruch.', p.id
      USING ERRCODE = 'check_violation';
  END IF;

  cont_days := nullif(s->>'continuityDays', '')::integer;
  notice    := coalesce(nullif(s->>'claimNoticeDays', '')::integer, 14);

  -- (a) Ohne Continuity gibt es keinen Fall.
  IF cont_days IS NULL THEN
    RAISE EXCEPTION 'Paket % kennt keine Continuity-Leistung -- ein Fall ist nicht vorgesehen.',
      coalesce(s->>'publicName', s->>'packageKey') USING ERRCODE = 'check_violation';
  END IF;

  -- (b) Der Grund muss anspruchsbegruendend sein und darf nicht ausgeschlossen.
  --     Ausschluss schlaegt Zulassung -- die strengere Regel gewinnt.
  IF s->'excludedClaimCategories' ? NEW.category THEN
    RAISE EXCEPTION 'Grund "%" ist im Paket ausdruecklich ausgeschlossen.', NEW.category
      USING ERRCODE = 'check_violation';
  END IF;
  IF NOT (s->'eligibleClaimCategories' ? NEW.category) THEN
    RAISE EXCEPTION 'Grund "%" begruendet in diesem Paket keinen Anspruch.', NEW.category
      USING ERRCODE = 'check_violation';
  END IF;

  -- (c) Das Ausscheiden muss in den Anspruchszeitraum fallen.
  IF p.first_working_day IS NULL THEN
    RAISE EXCEPTION 'Placement % hat keinen ersten Arbeitstag -- der Zeitraum laesst sich nicht bestimmen.', p.id
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.separation_date < p.first_working_day THEN
    RAISE EXCEPTION 'Das Ausscheiden (%) liegt vor dem ersten Arbeitstag (%).',
      NEW.separation_date, p.first_working_day USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.separation_date > p.first_working_day + cont_days THEN
    RAISE EXCEPTION 'Das Ausscheiden (%) liegt nach dem Ende des Zeitraums (%).',
      NEW.separation_date, p.first_working_day + cont_days USING ERRCODE = 'check_violation';
  END IF;

  -- (d) Die Meldung muss innerhalb der Frist ab Kenntnis erfolgen.
  frist := NEW.known_at + notice;
  IF NEW.deadline IS NULL OR NEW.deadline <> frist THEN
    NEW.deadline := frist;     -- gerechnet, nicht eingetragen
  END IF;
  IF NEW.reported_at::date > frist THEN
    RAISE EXCEPTION 'Die Meldefrist ist am % abgelaufen (Kenntnis am %, % Tage Frist).',
      frist, NEW.known_at, notice USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_continuity_claims_validate ON public.continuity_claims;
CREATE TRIGGER trg_continuity_claims_validate
  BEFORE INSERT ON public.continuity_claims
  FOR EACH ROW EXECUTE FUNCTION public.continuity_claims_validate();

-- ----------------------------------------------------------------------------
-- 5) Ein anerkannter Fall laesst die Tranche verfallen
-- ----------------------------------------------------------------------------
-- Damit ist der Zusammenhang aus dem Paketmodell in der Datenbank verankert:
-- die einbehaltene Tranche verschwindet nicht, sie finanziert die Auslobung.
CREATE OR REPLACE FUNCTION public.continuity_claims_apply()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    UPDATE public.placements
       SET continuity_state = 'claim_accepted',
           retention_state  = CASE WHEN retention_state = 'released'
                                   THEN retention_state       -- schon ausgezahlt
                                   ELSE 'forfeited' END,
           placement_state  = CASE WHEN placement_state = 'started'
                                   THEN 'ended_early' ELSE placement_state END,
           ended_at         = coalesce(ended_at, NEW.separation_date),
           end_reason       = coalesce(end_reason, NEW.category),
           research_state   = 'running'
     WHERE id = NEW.placement_id;

  ELSIF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
    UPDATE public.placements
       SET continuity_state = 'claim_rejected'
     WHERE id = NEW.placement_id;

  ELSIF NEW.status IN ('submitted', 'in_review') AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.placements
       SET continuity_state = 'claim_open'
     WHERE id = NEW.placement_id AND continuity_state IN ('running', 'not_applicable');
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_continuity_claims_apply ON public.continuity_claims;
CREATE TRIGGER trg_continuity_claims_apply
  AFTER UPDATE ON public.continuity_claims
  FOR EACH ROW EXECUTE FUNCTION public.continuity_claims_apply();

-- Wird die Tranche bereits ausgezahlt, bevor die Frist abgelaufen ist, waere
-- sie fuer einen spaeter gemeldeten Fall nicht mehr da.
CREATE OR REPLACE FUNCTION public.placements_guard_retention()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN
  IF NEW.retention_state = 'released' AND OLD.retention_state = 'withheld' THEN
    IF NEW.retention_release_date IS NOT NULL
       AND CURRENT_DATE < NEW.retention_release_date THEN
      RAISE EXCEPTION
        'Der Einbehalt wird erst am % frei (Continuity-Zeitraum plus Meldefrist), heute ist der %.',
        NEW.retention_release_date, CURRENT_DATE USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (SELECT 1 FROM public.continuity_claims
                WHERE placement_id = NEW.id AND status IN ('submitted', 'in_review')) THEN
      RAISE EXCEPTION
        'Der Einbehalt bleibt gebunden, solange ein gemeldeter Fall offen ist.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_placements_guard_retention ON public.placements;
CREATE TRIGGER trg_placements_guard_retention
  BEFORE UPDATE ON public.placements
  FOR EACH ROW EXECUTE FUNCTION public.placements_guard_retention();

-- ----------------------------------------------------------------------------
-- 6) Der erneute Suchlauf
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.research_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id      uuid NOT NULL REFERENCES public.continuity_claims(id) ON DELETE CASCADE,
  placement_id  uuid NOT NULL REFERENCES public.placements(id) ON DELETE CASCADE,
  job_id        uuid REFERENCES public.jobs(id) ON DELETE SET NULL,

  -- Die Auslobung. Steht in Cent fest, sobald der Fall anerkannt ist.
  bounty_cents  bigint NOT NULL CHECK (bounty_cents > 0),

  -- Aktive Suchtage: Tage, an denen der Kunde mitwirkt. Tage ohne
  -- Rueckmeldung zaehlen nicht -- sonst liefe die Frist gegen uns, waehrend
  -- niemand auf Kandidaten reagiert.
  max_active_days     integer NOT NULL CHECK (max_active_days > 0),
  active_days_used    integer NOT NULL DEFAULT 0 CHECK (active_days_used >= 0),
  started_on          date,
  last_counted_on     date,
  paused_since        date,
  pause_reason        text,

  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'paused', 'succeeded', 'exhausted', 'cancelled')),

  -- Wer sucht. Kann ein anderer sein als der urspruengliche Recruiter.
  assigned_recruiter_id uuid,
  original_recruiter_id uuid,

  succeeded_placement_id uuid REFERENCES public.placements(id) ON DELETE SET NULL,
  succeeded_at  timestamptz,
  ended_at      timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT research_one_per_claim UNIQUE (claim_id),
  CONSTRAINT research_days_within_limit CHECK (active_days_used <= max_active_days),
  CONSTRAINT research_succeeded_needs_placement
    CHECK (status <> 'succeeded' OR succeeded_placement_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS research_assignments_running_idx
  ON public.research_assignments (status, last_counted_on) WHERE status = 'running';

COMMENT ON TABLE public.research_assignments IS
  'Der erneute Suchlauf nach einem anerkannten Continuity-Fall. Einer je Fall. '
  'Der Kunde zahlt dafuer kein zweites Honorar; bezahlt wird aus der Auslobung, '
  'die sich aus der verfallenen Tranche und dem Continuity-Aufpreis speist.';
COMMENT ON COLUMN public.research_assignments.active_days_used IS
  'Nur Tage, an denen der Kunde mitwirkt. Tage ohne Rueckmeldung zaehlen nicht '
  '-- sonst liefe die Frist ab, waehrend niemand auf Kandidaten reagiert.';

ALTER TABLE public.research_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage research assignments" ON public.research_assignments;
CREATE POLICY "Admins manage research assignments"
  ON public.research_assignments FOR ALL TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_research_touch ON public.research_assignments;
CREATE TRIGGER trg_research_touch
  BEFORE UPDATE ON public.research_assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 7) Die Auszahlung des Recruiters in Tranchen
-- ----------------------------------------------------------------------------
-- BEFUND: payout_requests.amount ist ein freies DECIMAL ohne Herkunft und ohne
--   Bedingung. Damit laesst sich nicht sagen, WOFUER gezahlt wird und WANN es
--   faellig ist -- und der Einbehalt haette gar keinen Ort.
CREATE TABLE IF NOT EXISTS public.recruiter_payout_tranches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id  uuid NOT NULL REFERENCES public.placements(id) ON DELETE CASCADE,
  recruiter_id  uuid NOT NULL,

  tranche_type  text NOT NULL
    CHECK (tranche_type IN ('initial', 'retention', 'research_bounty')),
  amount_cents  bigint NOT NULL CHECK (amount_cents > 0),

  -- Woran die Faelligkeit haengt. Als Text, damit sie in der Auszahlungsliste
  -- lesbar ist statt aus dem Code erschlossen werden zu muessen.
  due_condition text NOT NULL,
  due_date      date,

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'due', 'approved', 'paid', 'forfeited', 'cancelled')),

  payout_request_id uuid REFERENCES public.payout_requests(id) ON DELETE SET NULL,
  approved_at timestamptz,
  approved_by uuid,
  paid_at     timestamptz,
  forfeited_at timestamptz,
  forfeit_reason text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Je Placement und Recruiter hoechstens eine Tranche jeder Art.
  CONSTRAINT recruiter_tranche_unique UNIQUE (placement_id, recruiter_id, tranche_type),
  CONSTRAINT recruiter_tranche_paid_needs_time
    CHECK (status <> 'paid' OR paid_at IS NOT NULL),
  CONSTRAINT recruiter_tranche_forfeited_needs_reason
    CHECK (status <> 'forfeited' OR forfeit_reason IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS recruiter_tranches_recruiter_idx
  ON public.recruiter_payout_tranches (recruiter_id, status, due_date);
CREATE INDEX IF NOT EXISTS recruiter_tranches_due_idx
  ON public.recruiter_payout_tranches (due_date) WHERE status = 'pending';

COMMENT ON TABLE public.recruiter_payout_tranches IS
  'Die Auszahlung des Recruiters, aufgeteilt nach Anlass. Ersetzt das freie '
  'payout_requests.amount als Quelle: hier steht, wofuer gezahlt wird und '
  'woran die Faelligkeit haengt.';
COMMENT ON COLUMN public.recruiter_payout_tranches.due_condition IS
  'Klartext der Faelligkeitsbedingung, z. B. "nach vollstaendigem '
  'Zahlungseingang des Kunden" oder "nach Ablauf von Continuity- und '
  'Meldefrist". Steht hier, damit die Auszahlungsliste sie zeigen kann.';

ALTER TABLE public.recruiter_payout_tranches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage payout tranches" ON public.recruiter_payout_tranches;
CREATE POLICY "Admins manage payout tranches"
  ON public.recruiter_payout_tranches FOR ALL TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Der Recruiter sieht seine eigenen Tranchen, nur lesend.
DROP POLICY IF EXISTS "Recruiters read own tranches" ON public.recruiter_payout_tranches;
CREATE POLICY "Recruiters read own tranches"
  ON public.recruiter_payout_tranches FOR SELECT TO authenticated
  USING (recruiter_id = auth.uid());

DROP TRIGGER IF EXISTS trg_tranches_touch ON public.recruiter_payout_tranches;
CREATE TRIGGER trg_tranches_touch
  BEFORE UPDATE ON public.recruiter_payout_tranches
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Eine Tranche wird nicht ausgezahlt, bevor ihre Bedingung eingetreten ist.
CREATE OR REPLACE FUNCTION public.recruiter_tranches_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE p public.placements%ROWTYPE;
BEGIN
  IF NEW.status IN ('approved', 'paid') AND OLD.status NOT IN ('approved', 'paid') THEN
    SELECT * INTO p FROM public.placements WHERE id = NEW.placement_id;

    -- Kein Geld an den Recruiter, bevor der Kunde bezahlt hat.
    IF p.invoice_state <> 'paid' THEN
      RAISE EXCEPTION
        'Tranche % ist nicht auszahlbar: die Kundenrechnung steht auf "%" statt "paid".',
        NEW.tranche_type, p.invoice_state USING ERRCODE = 'check_violation';
    END IF;

    -- Und der Einbehalt zusaetzlich nicht vor Ablauf der Frist.
    IF NEW.tranche_type = 'retention' AND p.retention_state <> 'released' THEN
      RAISE EXCEPTION
        'Der Einbehalt ist nicht auszahlbar: er steht auf "%" statt "released".',
        p.retention_state USING ERRCODE = 'check_violation';
    END IF;

    -- Die Auslobung erst nach erfolgreicher Ersatzvermittlung.
    IF NEW.tranche_type = 'research_bounty' AND p.research_state <> 'succeeded' THEN
      RAISE EXCEPTION
        'Die Auslobung ist nicht auszahlbar: der erneute Suchlauf steht auf "%" statt "succeeded".',
        p.research_state USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.status = 'paid' AND NEW.paid_at IS NULL THEN
    NEW.paid_at := now();
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_tranches_guard ON public.recruiter_payout_tranches;
CREATE TRIGGER trg_tranches_guard
  BEFORE UPDATE ON public.recruiter_payout_tranches
  FOR EACH ROW EXECUTE FUNCTION public.recruiter_tranches_guard();

-- ----------------------------------------------------------------------------
-- 8) Die Rechnung an den Kunden
-- ----------------------------------------------------------------------------
-- invoices existiert seit 20251204182100 und wurde nie erzeugt. Es fehlten
-- der Bezug zum Auftrag, die Zahlungsfrist und die Art der Rechnung.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS mandate_id uuid
    REFERENCES public.commercial_mandates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoice_type text NOT NULL DEFAULT 'placement_fee'
    CHECK (invoice_type IN ('placement_fee', 'credit_note')),
  ADD COLUMN IF NOT EXISTS amount_cents      bigint,
  ADD COLUMN IF NOT EXISTS tax_amount_cents  bigint,
  ADD COLUMN IF NOT EXISTS total_amount_cents bigint,
  ADD COLUMN IF NOT EXISTS payment_terms_days integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS issued_at date,
  ADD COLUMN IF NOT EXISTS pricing_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS corrects_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.invoices.amount_cents IS
  'Betrag in ganzen Cent. Die alten numeric-Spalten bleiben fuer Bestandsdaten '
  'bestehen und werden mitgefuehrt; gerechnet wird in Cent.';
COMMENT ON COLUMN public.invoices.invoice_type IS
  'credit_note = Gutschrift. Eine gestellte Rechnung wird nicht geaendert, '
  'sondern durch eine Gutschrift korrigiert -- dieselbe Regel wie beim '
  'unterzeichneten Vertrag.';

-- Zahlungsziel und Cent-Betraege werden gerechnet.
CREATE OR REPLACE FUNCTION public.invoices_derive()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN
  IF NEW.issued_at IS NULL THEN
    NEW.issued_at := CURRENT_DATE;
  END IF;
  IF NEW.due_date IS NULL THEN
    NEW.due_date := NEW.issued_at + coalesce(NEW.payment_terms_days, 14);
  END IF;

  -- Cent fuehrt, numeric folgt -- damit Bestandsansichten weiter stimmen.
  IF NEW.amount_cents IS NOT NULL THEN
    NEW.amount := round(NEW.amount_cents::numeric / 100, 2);
    NEW.tax_amount := round(coalesce(NEW.tax_amount_cents, 0)::numeric / 100, 2);
    NEW.total_amount := round(coalesce(NEW.total_amount_cents,
                              NEW.amount_cents + coalesce(NEW.tax_amount_cents, 0))::numeric / 100, 2);
    IF NEW.total_amount_cents IS NULL THEN
      NEW.total_amount_cents := NEW.amount_cents + coalesce(NEW.tax_amount_cents, 0);
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_invoices_derive ON public.invoices;
CREATE TRIGGER trg_invoices_derive
  BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.invoices_derive();

-- Eine gestellte Rechnung wird nicht mehr veraendert.
CREATE OR REPLACE FUNCTION public.invoices_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN
  IF OLD.issued_at IS NOT NULL AND OLD.status <> 'draft' THEN
    IF NEW.amount_cents IS DISTINCT FROM OLD.amount_cents
    OR NEW.total_amount_cents IS DISTINCT FROM OLD.total_amount_cents
    OR NEW.invoice_number IS DISTINCT FROM OLD.invoice_number
    OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
    OR NEW.pricing_snapshot IS DISTINCT FROM OLD.pricing_snapshot THEN
      RAISE EXCEPTION
        'Rechnung % ist gestellt und unveraenderlich. Fuer eine Korrektur eine Gutschrift anlegen (invoice_type = credit_note).',
        OLD.invoice_number USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_invoices_guard ON public.invoices;
CREATE TRIGGER trg_invoices_guard
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.invoices_guard();

COMMIT;
