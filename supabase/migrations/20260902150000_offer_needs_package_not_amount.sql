-- ============================================================================
-- Ein Angebot braucht das Paket, nicht den Betrag
-- ----------------------------------------------------------------------------
-- BEFUND (live gefunden beim Durchlauf am 02.09.2026): Das Absenden einer
--   Beauftragungsanfrage scheiterte mit
--     violates check constraint "commercial_mandates_confirmed_needs_package"
--
--   Die Constraint aus 20260902100100 verlangte beim bestaetigten Angebot
--   ausser Paket und Preis-Snapshot auch
--     gross_annual_target_compensation_cents IS NOT NULL
--     client_fee_cents IS NOT NULL
--
--   Das ist ein Denkfehler. Zum Zeitpunkt des Angebots gibt es keinen Betrag,
--   sondern nur eine Schaetzung aus dem Gehaltsband der Aufnahme -- und die
--   ist ausdruecklich unverbindlich. Abgerechnet wird nach dem
--   Bruttojahreszielgehalt aus dem UNTERZEICHNETEN ARBEITSVERTRAG; das steht
--   so im Einzelauftrag, Paragraph 2 Absatz 2.
--
--   Ein Kunde, der kein Gehaltsband angibt -- und das ist erlaubt, das Feld
--   ist optional --, konnte damit ueberhaupt nicht beauftragen. Ausgeloest
--   wurde es zusaetzlich durch einen Lesefehler in intake-packages, der das
--   Gehaltsband auch dann nicht fand, wenn es angegeben war.
--
-- ENTSCHEIDUNG: Verbindlich ist am Angebot der PROZENTSATZ, nicht der Betrag.
--   Paket und Preis-Snapshot bleiben Pflicht -- sie sind die Vereinbarung.
--   Die Betraege bleiben optional, bis das Placement sie aus dem
--   Arbeitsvertrag kennt (placements.gross_annual_target_compensation_cents,
--   Trigger placements_derive).
--
--   Die uebrigen Sicherungen bleiben unberuehrt: sind Betraege gesetzt, muss
--   die Verteilung weiterhin exakt aufgehen (commercial_mandates_split_adds_up)
--   und zum Paket passen (Trigger commercial_mandates_check_pricing).
-- ============================================================================

BEGIN;

ALTER TABLE public.commercial_mandates
  DROP CONSTRAINT IF EXISTS commercial_mandates_confirmed_needs_package;
ALTER TABLE public.commercial_mandates
  ADD CONSTRAINT commercial_mandates_confirmed_needs_package
  CHECK (client_confirmed_at IS NULL
         OR (package_key IS NOT NULL
             AND package_version IS NOT NULL
             AND pricing_snapshot IS NOT NULL
             AND pricing_snapshot_sha256 IS NOT NULL));

COMMENT ON CONSTRAINT commercial_mandates_confirmed_needs_package
  ON public.commercial_mandates IS
  'Ein bestaetigtes Angebot braucht Paket und Preis-Snapshot -- den Prozentsatz. '
  'Der Betrag gehoert NICHT dazu: er steht erst mit dem unterzeichneten '
  'Arbeitsvertrag fest, die Zahl auf der Paketkarte war eine Schaetzung.';

COMMIT;
