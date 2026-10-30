-- ============================================================================
-- Besetzungen und Rechnungen für Kunden (Etappe 1, 25.10.2026)
-- ----------------------------------------------------------------------------
-- Kunden-Seiten „Besetzungen“ (statt Angebote + Placements) und „Rechnungen“
-- (eigener Bereich für Buchhaltung). Gelesen und geschrieben wird über die
-- Function `placement` (Service-Rolle); deshalb keine neuen Leseregeln.
--
--   placements      Meldungen nach der Unterschrift: Start verschoben
--                   (Rahmenvertrag § 10 Abs. 2), Erklärung zum Nichtantritt
--                   (§ 8 Abs. 8), Ausscheiden (§ 9; der Continuity-Fall selbst
--                   landet wie vorgesehen in continuity_claims), Bestellnummer
--                   und Kostenstelle
--   invoices        Bestellnummer und Kostenstelle stehen auf der Rechnung
--   company_profiles  Rechnungsdaten des Kunden: weitere Empfänger (cc),
--                   Bestellnummer Pflicht, Standard-Kostenstelle
-- ============================================================================

ALTER TABLE public.placements
  ADD COLUMN IF NOT EXISTS start_moved_at timestamptz,
  ADD COLUMN IF NOT EXISTS start_moved_by uuid,
  ADD COLUMN IF NOT EXISTS start_moved_note text
    CHECK (start_moved_note IS NULL OR length(start_moved_note) <= 500),
  ADD COLUMN IF NOT EXISTS non_start_document_path text,
  ADD COLUMN IF NOT EXISTS non_start_document_at timestamptz,
  ADD COLUMN IF NOT EXISTS departure_reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS departure_reported_by uuid,
  ADD COLUMN IF NOT EXISTS departure_category text
    CHECK (departure_category IS NULL OR length(departure_category) <= 60),
  ADD COLUMN IF NOT EXISTS departure_event_on date,
  ADD COLUMN IF NOT EXISTS departure_last_day date,
  ADD COLUMN IF NOT EXISTS departure_known_on date,
  ADD COLUMN IF NOT EXISTS departure_note text
    CHECK (departure_note IS NULL OR length(departure_note) <= 1000),
  ADD COLUMN IF NOT EXISTS purchase_order text
    CHECK (purchase_order IS NULL OR length(purchase_order) <= 80),
  ADD COLUMN IF NOT EXISTS cost_center text
    CHECK (cost_center IS NULL OR length(cost_center) <= 80);

COMMENT ON COLUMN public.placements.departure_event_on IS
  'Tag, an dem die Kündigung zuging oder die Aufhebung geschlossen wurde (§ 9 Abs. 1); der letzte Arbeitstag steht in departure_last_day.';

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS purchase_order text
    CHECK (purchase_order IS NULL OR length(purchase_order) <= 80),
  ADD COLUMN IF NOT EXISTS cost_center text
    CHECK (cost_center IS NULL OR length(cost_center) <= 80);

ALTER TABLE public.company_profiles
  ADD COLUMN IF NOT EXISTS billing_cc_emails text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS purchase_order_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_cost_center text
    CHECK (default_cost_center IS NULL OR length(default_cost_center) <= 80);

COMMENT ON COLUMN public.company_profiles.purchase_order_required IS
  'Ohne Bestellnummer gibt Matchunt die Rechnung nicht frei; nach der Unterschrift fragt eine Kunden-Aufgabe die Nummer ab.';

GRANT ALL ON public.placements TO service_role;
GRANT ALL ON public.invoices TO service_role;
GRANT ALL ON public.company_profiles TO service_role;
