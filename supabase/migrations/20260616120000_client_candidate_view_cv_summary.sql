-- ============================================================================
-- Triple-Blind · Welle A.2 — cv_ai_summary an denselben Reveal-Schalter hängen
-- Kontext: KERNPROZESS_PLAN.md · Welle B-Vorbereitung
--
-- Problem: candidates.cv_ai_summary (KI-Bio, enthält Klarnamen/Arbeitgeber) wurde
--          von Client-Screens (z.B. Bewerber-Pipeline) ROH gelesen — am Blind vorbei.
-- Lösung:  cv_ai_summary in client_candidate_view aufnehmen, vor identity_unlocked
--          serverseitig gescrubbt (gleiches Muster wie client_fit_assessment_view).
--
-- Rein additiv: CREATE OR REPLACE VIEW hängt nur EINE Spalte am Ende an; alle
-- bestehenden Spalten bleiben in identischer Reihenfolge erhalten.
-- ============================================================================

CREATE OR REPLACE VIEW public.client_candidate_view AS
SELECT
  -- Keys & Submission-Kontext
  s.id                          AS submission_id,
  s.candidate_id,
  s.job_id,
  j.client_id,
  s.status,
  s.stage,
  s.match_score,
  s.identity_unlocked,
  s.recruiter_notes,

  -- Job-Kontext (eigener Job des Clients -> nicht blind-relevant)
  j.title                       AS job_title,
  j.industry                    AS job_industry,
  j.company_name                AS job_company_name,

  -- Anonyme/immer sichtbare Profil-Felder
  c.job_title                   AS candidate_role,
  c.seniority,
  c.skills,
  c.certifications,
  c.language_skills,
  c.industry_experience,
  c.target_roles,
  c.notice_period,
  c.availability_date,
  c.remote_preference,
  c.relocation_willing,
  c.remote_days_preferred,

  -- Abgeleitete (grobe) Felder — immer sichtbar, NIE Rohwert
  public.anon_region_broad(c.city)               AS region_broad,
  public.anon_experience_band(c.experience_years) AS experience_band,
  public.anon_salary_band(COALESCE(c.expected_salary, c.salary_expectation_max)) AS salary_band,

  -- Reveal-abhängige Klardaten — NULL bis identity_unlocked
  CASE WHEN s.identity_unlocked THEN c.full_name        END AS full_name,
  CASE WHEN s.identity_unlocked THEN c.email            END AS email,
  CASE WHEN s.identity_unlocked THEN c.phone            END AS phone,
  CASE WHEN s.identity_unlocked THEN c.cv_url           END AS cv_url,
  CASE WHEN s.identity_unlocked THEN c.linkedin_url     END AS linkedin_url,
  CASE WHEN s.identity_unlocked THEN c.city             END AS city,
  CASE WHEN s.identity_unlocked THEN c.experience_years END AS experience_years,

  -- NEU: KI-Bio reveal-gated. Vor Reveal Name + Arbeitgeber serverseitig scrubben.
  CASE
    WHEN s.identity_unlocked THEN c.cv_ai_summary
    ELSE public.scrub_identity_tokens(
           public.scrub_identity_tokens(c.cv_ai_summary, nm.toks, 'der Kandidat'),
           emp.toks, '[ein Unternehmen]')
  END AS cv_ai_summary,

  -- NEU: nicht-identitätstragende Listen-Metadaten (für Pipeline/Sortierung)
  s.submitted_at,
  s.created_at
FROM submissions s
JOIN jobs j        ON j.id = s.job_id
JOIN candidates c  ON c.id = s.candidate_id
-- Namens-Tokens: voller Name zuerst, dann Einzelteile (>=3 Zeichen)
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

GRANT SELECT ON public.client_candidate_view TO authenticated;
