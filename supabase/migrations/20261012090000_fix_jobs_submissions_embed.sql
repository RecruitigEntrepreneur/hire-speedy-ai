-- ============================================================================
-- Hotfix (12.10.2026): zweite Beziehung jobs <-> submissions entfernen
-- ============================================================================
-- 20261008120000 hat jobs.closed_hire_submission_id als Fremdschlüssel auf
-- submissions angelegt. Seitdem kennt die API zwei Beziehungen zwischen den
-- beiden Tabellen; jede Abfrage, die eine Stelle in eine Einreichung einbettet
-- (oder umgekehrt) ohne Hinweis, scheitert mit PGRST201 („more than one
-- relationship was found for 'submissions' and 'jobs'“) -- etwa die
-- Interview-Anfrage, Pipeline, Platzierungen und Zusammenfassungen.
--
-- Die Spalte bleibt als einfache Angabe (welche Einreichung eingestellt wurde);
-- geschrieben wird sie nur von client_close_job, das die Einreichung prüft.
-- ============================================================================

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_closed_hire_submission_id_fkey;

-- Die API soll das neue Schema sofort kennen.
NOTIFY pgrst, 'reload schema';
