-- ============================================================================
-- Triple-Blind P0 · WELLE C — die eigentliche Härtung (Tür abschließen)
-- Kontext: KERNPROZESS_PLAN.md
--
-- Bis hierher (Welle A/B) lesen alle Client-Screens NUR noch über die
-- reveal-gated Views (client_candidate_view / client_candidate_experiences_view).
-- Diese Migration entzieht dem Client den DIREKTEN Rohzugriff auf die
-- Basistabellen. Ab jetzt gilt fail-closed: jeder (auch künftige/übersehene)
-- Client-Lesepfad auf die rohe Tabelle liefert NICHTS statt PII zu lecken.
--
-- WICHTIG — Deploy-Reihenfolge: ERST muss das Frontend (Welle B) live sein, das
-- aus den Views liest. DANN diese Migration anwenden. Sonst zeigen noch nicht
-- umgestellte Client-Screens leere Daten.
--
-- Sicherheit der Views bleibt erhalten: Die Views laufen mit OWNER-Rechten
-- (definer) und umgehen die RLS der Basistabellen — sie funktionieren also
-- weiter, auch nachdem die Client-Policy entzogen ist.
--
-- NICHT betroffen (bleiben erhalten):
--   * "Recruiters can manage their own candidates"            (recruiter_id = auth.uid())
--   * "Admins can view all candidates"
--   * "Recruiters can manage experiences for their candidates"
--   * sämtliche Schreibpfade (insert/update) der Recruiter
-- ============================================================================

-- Client darf rohe Kandidaten-PII nicht mehr direkt lesen (nur noch via View).
DROP POLICY IF EXISTS "Clients can view candidates for their jobs" ON public.candidates;

-- Client darf rohen Werdegang (Arbeitgebernamen) nicht mehr direkt lesen.
DROP POLICY IF EXISTS "Clients can view experiences for submitted candidates" ON public.candidate_experiences;

-- ----------------------------------------------------------------------------
-- Verifikation nach Deploy (manuell im SQL-Editor, als Client-Session):
--   -- sollte 0 Zeilen / permission liefern:
--   SELECT full_name, email FROM public.candidates LIMIT 1;
--   -- sollte weiterhin gated funktionieren (PII NULL vor Opt-In):
--   SELECT full_name, region_broad FROM public.client_candidate_view LIMIT 1;
-- ----------------------------------------------------------------------------
