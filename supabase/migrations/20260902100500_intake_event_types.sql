-- ============================================================================
-- Ereignistypen fuer den Nachlauf der Aufnahme
-- ----------------------------------------------------------------------------
-- Der Funnel kennt bisher nur den Weg bis zur Unterschrift, und die auch nur
-- einseitig ('contract_signed'). Der neue Ablauf hat vier Schritte mehr:
-- Firmenpruefung, Rueckfragen, Freigabe zur Unterschrift und die
-- Gegenzeichnung. Ohne eigene Typen faenden sie im Trichter nicht statt --
-- und genau dort wuerde man sehen, wo Anfragen liegenbleiben.
-- ============================================================================

BEGIN;

ALTER TABLE public.intake_link_events DROP CONSTRAINT IF EXISTS intake_link_events_event_type_check;
ALTER TABLE public.intake_link_events
  ADD CONSTRAINT intake_link_events_event_type_check CHECK (event_type IN (
    'link_opened', 'intake_started', 'first_value', 'contact_provided',
    'email_verification_sent', 'email_verified', 'intake_completed',
    -- Firmenpruefung
    'company_check_started', 'company_verified', 'company_needs_review', 'company_failed',
    -- Paketwahl. Die alten Namen bleiben, damit bestehende Trichterdaten
    -- weiter zaehlen; 'terms_discussion_requested' entsteht nicht mehr neu.
    'terms_presented', 'terms_confirmed', 'terms_discussion_requested',
    'forwarded', 'resume_requested', 'submitted',
    -- Pruefung und Rueckfragen
    'accepted', 'changes_requested', 'rejected',
    'clarification_requested', 'clarification_answered',
    -- Unterschrift, zweistufig
    'contract_released', 'contract_sent', 'contract_signed', 'contract_countersigned',
    'contract_declined',
    'published', 'abandoned', 'purged'
  ));

COMMENT ON COLUMN public.intake_link_events.event_type IS
  'Schritte im Trichter. contract_signed = der Kunde hat unterschrieben, '
  'contract_countersigned = Matchunt hat gegengezeichnet und der Vertrag ist '
  'wirksam. Die beiden getrennt zu fuehren ist der Punkt: dazwischen liegt '
  'unsere eigene Bearbeitungszeit, und die will man sehen.';

COMMIT;
