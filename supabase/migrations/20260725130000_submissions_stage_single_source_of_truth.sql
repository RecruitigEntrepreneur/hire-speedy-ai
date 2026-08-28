-- ============================================================================
-- Welle 2 / Datenwahrheit: submissions.stage wird die einzige Wahrheit
-- ----------------------------------------------------------------------------
-- Ausgangslage (gemessen an 29 Submissions, Details in
-- WELLE2_DATENWAHRHEIT_ANALYSE.md):
--
--   status kam am 04.12.2025 17:16, stage um 18:21 "for Kanban pipeline".
--   Beide sind freies text ohne CHECK, ohne Enum, ohne Trigger — nichts hielt
--   sie synchron. Ergebnis: 16 von 29 Zeilen (55 %) widersprachen sich.
--
--   Ursache: Der Kunde lehnt ueber ExposeQuickDecisionWidget ab und schreibt
--   dabei NUR status='rejected'. Der Recruiter holt das Opt-In ein und schreibt
--   dabei NUR stage. Keiner der Pfade fasst das jeweils andere Feld an.
--
--   Richtung der Korrektur: Von den 16 widerspruechlichen Zeilen tragen 14
--   einen rejection_reason. Die Absage ist real — status hatte recht, stage
--   wurde nie nachgezogen.
--
-- Zielbild:
--   stage  = Wahrheit, kanonisches Vokabular, per CHECK erzwungen
--   status = abgeleiteter Spiegel, per Trigger gepflegt
--
--   Dadurch bricht keines der ~99 Widgets, die .status lesen; sie werden
--   spaeter schrittweise auf stage umgestellt statt in einem Big Bang.
--
-- ACHTUNG — bekannte Nebenwirkung (bewusst akzeptiert, siehe Report):
--   fraud-detection schreibt status='blocked'/'flagged'. Diese Werte lassen
--   sich aus keiner stage ableiten und werden vom Trigger beim naechsten
--   Stage-Wechsel ueberschrieben. Aktuell traegt 0 Submissions diese Werte,
--   heute geht also nichts verloren. Die Funktion ist aber ueber /admin/fraud
--   manuell ausloesbar — die saubere Loesung (eigene Spalte fraud_state) ist
--   als offener Punkt vermerkt und NICHT Teil dieser Migration.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Bestand normalisieren
-- ----------------------------------------------------------------------------

-- 1a) Die widerspruechlichen Zeilen: status sagt abgelehnt, stage steht noch
--     auf einem aktiven Wert. status hat recht (14 von 16 mit rejection_reason).
UPDATE public.submissions
   SET stage = 'client_rejected'
 WHERE status = 'rejected'
   AND stage NOT IN ('rejected', 'client_rejected', 'withdrawn');

-- 1b) Alt-Vokabular auf das kanonische Set abbilden. Bewusst
--     informationserhaltend: interview_1/_2 werden zu interview_completed,
--     hired zu placed, offer_pending zu offer.
UPDATE public.submissions SET stage = 'interview_completed' WHERE stage IN ('interview_1', 'interview_2', 'interviewed');
UPDATE public.submissions SET stage = 'offer'               WHERE stage IN ('offer_pending', 'offer_extended', 'offer_accepted');
UPDATE public.submissions SET stage = 'placed'              WHERE stage IN ('hired');
UPDATE public.submissions SET stage = 'in_review'           WHERE stage IN ('reviewing', 'screening', 'pending');

-- 1c) Alles, was danach noch unbekannt ist, faellt auf 'submitted' zurueck,
--     damit der CHECK unten nicht an Altlasten scheitert.
UPDATE public.submissions
   SET stage = 'submitted'
 WHERE stage IS NULL
    OR stage NOT IN (
      'submitted', 'in_review', 'interview_requested', 'candidate_opted_in',
      'interview_scheduled', 'interview_counter_proposed', 'interview_declined',
      'interview_completed', 'offer', 'placed', 'rejected', 'client_rejected',
      'withdrawn'
    );

-- ----------------------------------------------------------------------------
-- 2) Kanonisches Vokabular erzwingen — damit sich das Problem nicht neu bildet
-- ----------------------------------------------------------------------------

ALTER TABLE public.submissions
  ALTER COLUMN stage SET DEFAULT 'submitted';

ALTER TABLE public.submissions
  DROP CONSTRAINT IF EXISTS submissions_stage_check;

ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_stage_check CHECK (stage IN (
    'submitted',                    -- eingereicht, wartet auf Sichtung
    'in_review',                    -- beim Kunden in Pruefung
    'interview_requested',          -- Kunde will Interview, Opt-In ausstehend
    'candidate_opted_in',           -- Kandidat hat zugestimmt
    'interview_scheduled',          -- Termin steht
    'interview_counter_proposed',   -- Gegenvorschlag laeuft
    'interview_declined',           -- Interview abgelehnt
    'interview_completed',          -- Interview gefuehrt, Debrief offen
    'offer',                        -- Angebot liegt vor
    'placed',                       -- vermittelt
    'rejected',                     -- vom Recruiter/Kandidaten beendet
    'client_rejected',              -- vom Kunden abgelehnt
    'withdrawn'                     -- zurueckgezogen
  ));

-- ----------------------------------------------------------------------------
-- 3) status als abgeleiteten Spiegel pflegen
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submissions_status_from_stage(p_stage text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_stage
    WHEN 'submitted'                  THEN 'submitted'
    WHEN 'in_review'                  THEN 'in_review'
    WHEN 'interview_requested'        THEN 'interview'
    WHEN 'candidate_opted_in'         THEN 'interview'
    WHEN 'interview_scheduled'        THEN 'interview'
    WHEN 'interview_counter_proposed' THEN 'interview'
    WHEN 'interview_declined'         THEN 'rejected'
    WHEN 'interview_completed'        THEN 'interview'
    WHEN 'offer'                      THEN 'offer'
    WHEN 'placed'                     THEN 'placed'
    WHEN 'rejected'                   THEN 'rejected'
    WHEN 'client_rejected'            THEN 'rejected'
    WHEN 'withdrawn'                  THEN 'rejected'
    ELSE 'submitted'
  END;
$$;

CREATE OR REPLACE FUNCTION public.sync_submission_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.status := public.submissions_status_from_stage(NEW.stage);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_submission_status ON public.submissions;

-- Bewusst OHNE Spaltenliste (kein "UPDATE OF stage"): Wuerde der Trigger nur
-- bei Stage-Aenderungen feuern, koennte Altcode weiterhin ausschliesslich
-- status schreiben und die Felder erneut auseinanderlaufen lassen — genau der
-- Pfad, der die 16 Widersprueche erzeugt hat (ExposeQuickDecisionWidget,
-- process-rejection, fraud-detection). So wird status bei JEDEM Schreibvorgang
-- aus stage neu abgeleitet und ein direkter status-Write bleibt wirkungslos.
CREATE TRIGGER trg_sync_submission_status
BEFORE INSERT OR UPDATE ON public.submissions
FOR EACH ROW
EXECUTE FUNCTION public.sync_submission_status();

-- 3a) Bestand einmalig angleichen (der Trigger greift erst ab jetzt).
UPDATE public.submissions
   SET status = public.submissions_status_from_stage(stage)
 WHERE status IS DISTINCT FROM public.submissions_status_from_stage(stage);

-- ----------------------------------------------------------------------------
-- 4) Gegenprobe: nach dieser Migration darf es keinen Widerspruch mehr geben
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n
    FROM public.submissions
   WHERE status IS DISTINCT FROM public.submissions_status_from_stage(stage);

  IF n > 0 THEN
    RAISE EXCEPTION 'Nach der Migration widersprechen sich noch % Submissions', n;
  END IF;
END $$;

COMMENT ON COLUMN public.submissions.stage IS
  'Einzige Wahrheit fuer den Prozessfortschritt. Kanonisches Vokabular per '
  'CHECK erzwungen.';

COMMENT ON COLUMN public.submissions.status IS
  'ABGELEITET aus stage via trg_sync_submission_status — nicht direkt '
  'beschreiben. Existiert nur noch fuer Altcode; neue Lesestellen nutzen stage.';
