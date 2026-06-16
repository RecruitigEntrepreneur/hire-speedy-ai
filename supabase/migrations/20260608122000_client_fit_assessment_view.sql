-- ============================================================================
-- Triple-Blind P0 · Fit-Analyse reveal-gaten (Option 2: nach Bestätigung Klartext)
-- Kontext: MATCHUNT_GODMODE_ANALYSIS.md §3.11
--
-- Modell (binär): Vor Bestätigung des Kandidaten -> Gutachten anonym anzeigen;
--                 nach Bestätigung (s.identity_unlocked = true) -> Klartext inkl. Name.
--
-- Prinzip: Das Gutachten wird in candidate_fit_assessments ROH (mit Namen/Arbeitgeber)
--          gespeichert -- nichts wird zerstört. Der Client liest ausschließlich über
--          diese View, die den Freitext NUR vor dem Reveal serverseitig scrubbt.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Generischer Token-Scrubber (literal, case-sensitiv; reicht, da die KI-Texte
--    exakt die gespeicherte Schreibweise nutzen). Wiederverwendbar für weitere
--    KI-Text-Funktionen (client-candidate-summary etc.).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.scrub_identity_tokens(p_text text, p_tokens text[], p_repl text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  t        text;
  out_text text := p_text;
BEGIN
  IF p_text IS NULL THEN RETURN NULL; END IF;
  FOREACH t IN ARRAY COALESCE(p_tokens, ARRAY[]::text[]) LOOP
    IF t IS NOT NULL AND length(btrim(t)) >= 3 THEN
      out_text := replace(out_text, btrim(t), p_repl);
    END IF;
  END LOOP;
  RETURN out_text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.scrub_identity_tokens(text, text[], text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2) client_fit_assessment_view — Fit-Analyse für den Client, reveal-gated.
--    identity_unlocked=true  -> Rohtext (echter Name/Arbeitgeber)
--    identity_unlocked=false -> Freitext serverseitig gescrubbt
--    Numerische Felder (Scores) sind nie identitätstragend -> immer roh.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.client_fit_assessment_view AS
SELECT
  a.id,
  a.submission_id,
  a.candidate_id,
  a.job_id,
  s.identity_unlocked,
  a.overall_verdict,
  a.overall_score,
  a.verdict_confidence,
  a.dimension_scores,
  -- nicht-identitätstragende Metadaten: unverändert durchreichen
  a.model_used,
  a.prompt_version,
  a.generation_time_ms,
  a.generated_by,
  a.generated_at,
  a.created_at,
  a.updated_at,
  a.input_data_hash,

  CASE WHEN s.identity_unlocked THEN a.executive_summary
       ELSE public.scrub_identity_tokens(public.scrub_identity_tokens(a.executive_summary, nm.toks, 'der Kandidat'), emp.toks, '[ein Unternehmen]')
  END AS executive_summary,

  CASE WHEN s.identity_unlocked THEN a.rejection_reasoning
       ELSE public.scrub_identity_tokens(public.scrub_identity_tokens(a.rejection_reasoning, nm.toks, 'der Kandidat'), emp.toks, '[ein Unternehmen]')
  END AS rejection_reasoning,

  CASE WHEN s.identity_unlocked THEN a.requirement_assessments
       ELSE public.scrub_identity_tokens(public.scrub_identity_tokens(a.requirement_assessments::text, nm.toks, 'der Kandidat'), emp.toks, '[ein Unternehmen]')::jsonb
  END AS requirement_assessments,

  CASE WHEN s.identity_unlocked THEN a.gap_analysis
       ELSE public.scrub_identity_tokens(public.scrub_identity_tokens(a.gap_analysis::text, nm.toks, 'der Kandidat'), emp.toks, '[ein Unternehmen]')::jsonb
  END AS gap_analysis,

  CASE WHEN s.identity_unlocked THEN a.bonus_qualifications
       ELSE public.scrub_identity_tokens(public.scrub_identity_tokens(a.bonus_qualifications::text, nm.toks, 'der Kandidat'), emp.toks, '[ein Unternehmen]')::jsonb
  END AS bonus_qualifications,

  CASE WHEN s.identity_unlocked THEN a.career_trajectory
       ELSE public.scrub_identity_tokens(public.scrub_identity_tokens(a.career_trajectory::text, nm.toks, 'der Kandidat'), emp.toks, '[ein Unternehmen]')::jsonb
  END AS career_trajectory,

  CASE WHEN s.identity_unlocked THEN a.implicit_competencies
       ELSE public.scrub_identity_tokens(public.scrub_identity_tokens(a.implicit_competencies::text, nm.toks, 'der Kandidat'), emp.toks, '[ein Unternehmen]')::jsonb
  END AS implicit_competencies,

  CASE WHEN s.identity_unlocked THEN a.motivation_fit
       ELSE public.scrub_identity_tokens(public.scrub_identity_tokens(a.motivation_fit::text, nm.toks, 'der Kandidat'), emp.toks, '[ein Unternehmen]')::jsonb
  END AS motivation_fit
FROM candidate_fit_assessments a
JOIN submissions s ON s.id = a.submission_id
JOIN jobs       j ON j.id = s.job_id
JOIN candidates c ON c.id = a.candidate_id
-- Namens-Tokens: voller Name zuerst, dann Einzelteile (>=3)
CROSS JOIN LATERAL (
  SELECT ARRAY[c.full_name] || ARRAY(
    SELECT p FROM unnest(string_to_array(COALESCE(c.full_name, ''), ' ')) p WHERE length(p) >= 3
  ) AS toks
) nm
-- Arbeitgeber-Tokens: aktueller + frühere Arbeitgeber
CROSS JOIN LATERAL (
  SELECT ARRAY(
    SELECT DISTINCT x FROM (
      SELECT c.company AS x
      UNION
      SELECT ce.company_name FROM candidate_experiences ce WHERE ce.candidate_id = c.id
    ) q WHERE x IS NOT NULL AND length(btrim(x)) >= 3
  ) AS toks
) emp
WHERE j.client_id = auth.uid();

GRANT SELECT ON public.client_fit_assessment_view TO authenticated;
