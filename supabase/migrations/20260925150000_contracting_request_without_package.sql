-- ============================================================================
-- Contracting-Anfrage ohne Paket
--
-- Befund (Live, 25.09.2026, Kanna Medics): Die drei Pakete sind Festanstellung
-- (Prozent vom Bruttojahreszielgehalt). Ein Kunde mit Contracting bekam sie
-- trotzdem angeboten -- und danach einen Vertrag, der nicht passt.
--
-- Contracting hat keine Paketwahl: es gilt eine Kondition (Tagessatz, davon
-- 78 % an den Spezialisten, 22 % Matchunt; Text in
-- supabase/functions/_shared/contracting-konditionen.ts). Die Anfrage darf
-- deshalb ohne Paket eingereicht werden -- aber NUR bei Contracting.
-- Alle anderen Bedingungen bleiben unverändert.
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
             AND (selected_package_key IS NOT NULL OR contract_type = 'freelance')));

COMMIT;
