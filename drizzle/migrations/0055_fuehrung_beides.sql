-- ============================================================================
-- Führung disziplinarisch UND fachlich (05.11.2026)
--
-- Bisher ging nur eine Auswahl: Wer 4 Menschen disziplinarisch und 12 fachlich
-- führt, verlor eine der beiden Zahlen. leadership_scope bleibt die höchste Stufe
-- und leadership_team_size ihre Zahl, alte Leser bleiben also richtig. Neu:
-- zusätzlich fachlich geführt, mit eigener Zahl (nur neben 'disciplinary').
-- ============================================================================

ALTER TABLE public.candidate_interview_notes
  ADD COLUMN IF NOT EXISTS leadership_also_functional boolean,
  ADD COLUMN IF NOT EXISTS leadership_functional_size integer;

-- ----------------------------------------------------------------------------
-- Gespräch mit dem Headhunter für den Kunden: wie 20261009140000, am Ende die
-- beiden neuen Spalten. Weiterhin nicht enthalten: heutiges Gehalt,
-- Mindestgehalt, gesperrte Firmen, andere Bewerbungen, Empfehlungsstufe,
-- Kritik am Arbeitgeber, Gegenangebot-Einschätzung.
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.client_candidate_interview_view;
CREATE VIEW public.client_candidate_interview_view AS
SELECT
  s.id AS submission_id,
  s.job_id,
  n.interview_date,
  n.interview_type,
  n.change_motivation_tags,
  n.offer_requirements,
  n.notice_period,
  n.earliest_start_date,
  n.leadership_scope,
  n.leadership_team_size,
  -- Nur das Wunschgehalt. salary_expectation_min ist die Schmerzgrenze (candidateDossier.ts).
  public.salary_wish_band(n.salary_desired, c.expected_salary, NULL) AS salary_wish,
  CASE WHEN s.identity_unlocked THEN COALESCE(NULLIF(btrim(n.summary_motivation), ''), n.change_motivation)
       ELSE public.scrub_identity_tokens(public.scrub_identity_tokens(COALESCE(NULLIF(btrim(n.summary_motivation), ''), n.change_motivation), nm.toks, 'der Kandidat'), emp.toks, '[ein Unternehmen]')
  END AS change_motivation,
  CASE WHEN s.identity_unlocked THEN n.why_now
       ELSE public.scrub_identity_tokens(public.scrub_identity_tokens(n.why_now, nm.toks, 'der Kandidat'), emp.toks, '[ein Unternehmen]')
  END AS why_now,
  n.leadership_also_functional,
  n.leadership_functional_size
FROM submissions s
JOIN candidates c ON c.id = s.candidate_id
LEFT JOIN LATERAL (
  SELECT * FROM candidate_interview_notes x
   WHERE x.candidate_id = s.candidate_id
     AND COALESCE(x.status, '') <> 'superseded'
   ORDER BY x.updated_at DESC NULLS LAST, x.created_at DESC
   LIMIT 1
) n ON true
CROSS JOIN LATERAL (
  SELECT ARRAY[c.full_name] || ARRAY(
    SELECT p FROM unnest(string_to_array(COALESCE(c.full_name, ''), ' ')) p WHERE length(p) >= 3
  ) AS toks
) nm
CROSS JOIN LATERAL (SELECT public.employer_tokens(c.id) AS toks) emp
WHERE public.can_access_job(s.job_id)
  AND COALESCE(n.presentation_consent, true);

GRANT SELECT ON public.client_candidate_interview_view TO authenticated, service_role;
