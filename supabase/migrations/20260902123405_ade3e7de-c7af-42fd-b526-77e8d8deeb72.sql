-- ============================================================================
-- Die Firmenpruefung entscheidet nicht
-- ----------------------------------------------------------------------------
-- BEFUND an der eigenen Arbeit: 20260902100200 liess zum Absenden nur
--   company_state IN ('verified', 'needs_review') zu. Damit haette ein
--   'failed' den Kunden endgueltig blockiert -- und 'failed' entsteht schon
--   bei einer USt-IdNr., die nicht zum Laendermuster passt. Also bei einem
--   Tippfehler.
--
--   Das widerspricht der Vorgabe. Die Pruefung liefert einen BERICHT mit einer
--   Empfehlung; ueber die Annahme entscheidet ein Mensch. Eine automatische
--   Pruefung, die den Vorgang endgueltig beendet, ist keine Empfehlung mehr.
--
--   Dazu kam: es gab keinen Weg zurueck. company_cleared_at und
--   company_cleared_by existierten, aber nichts setzte sie.
--
-- FIX: Die Bedingung lautet jetzt "die Pruefung ist GELAUFEN", nicht "die
--   Pruefung hat zugestimmt". Blockiert wird nur, solange sie noch aussteht
--   oder gerade laeuft -- denn dann fehlt dem Admin die Grundlage.
--
--   Ein 'failed' erreicht die Pruefliste und faellt dort auf. Genau dort
--   gehoert die Entscheidung hin.
-- ============================================================================

BEGIN;

ALTER TABLE public.intake_drafts DROP CONSTRAINT IF EXISTS intake_drafts_submit_requires_verified;
ALTER TABLE public.intake_drafts
  ADD CONSTRAINT intake_drafts_submit_requires_verified
  CHECK (review_state NOT IN ('pending_admin', 'accepted')
         OR (capture_state = 'complete'
             AND identity_state = 'email_verified'
             -- Gelaufen, nicht zugestimmt: 'failed' darf einreichen und faellt
             -- in der Pruefliste auf.
             AND company_state NOT IN ('not_checked', 'checking')
             AND selected_package_key IS NOT NULL));

COMMENT ON COLUMN public.intake_drafts.company_state IS
  'Firmenpruefung: not_checked -> checking -> verified | needs_review | failed. '
  'Keiner dieser Zustaende ist eine Entscheidung. Eingereicht werden darf, '
  'sobald die Pruefung GELAUFEN ist -- auch bei failed. Ueber die Annahme '
  'entscheidet der Admin, mit dem Bericht vor sich.';

COMMENT ON COLUMN public.intake_drafts.company_cleared_at IS
  'Wann ein Mensch die Firmenangaben trotz Befunden freigegeben hat. Getrennt '
  'von company_checked_at gefuehrt: das eine ist die Maschine, das andere die '
  'Entscheidung.';

COMMIT;