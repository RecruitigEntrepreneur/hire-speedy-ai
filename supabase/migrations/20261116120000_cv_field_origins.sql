-- ============================================================================
-- Herkunft aus dem Lebenslauf (09.11.2026)
--
-- Im Interview war nicht zu sehen, welche Antworten schon aus dem Lebenslauf
-- kamen und welche noch offen sind. Beim Anlegen aus dem Lebenslauf merkt sich
-- die App je Feld den gelesenen Wert und das Zitat:
--   { "expected_salary": { "source": "cv", "quote": "85.000 € brutto p. a.", "value": 85000 } }
-- Das Interview zeigt „Lebenslauf“ nur, solange der Wert in der Akte noch genau
-- diesem Wert entspricht. Gleiche Sichtbarkeit wie cv_raw_text (Tabellenrechte
-- und RLS der Tabelle candidates gelten unverändert).
-- ============================================================================

ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS cv_field_origins jsonb;

COMMENT ON COLUMN public.candidates.cv_field_origins IS
  'Je Akte-Feld: Wert und Zitat, wie sie beim Anlegen aus dem Lebenslauf gelesen wurden (source cv/derived). Nur Anzeige im Interview.';
