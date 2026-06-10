-- ============================================================================
-- Triple-Blind P0 · WELLE A (rein additiv — bricht nichts)
-- Kontext: MATCHUNT_GODMODE_ANALYSIS.md Kap. 3/3b
--
-- Ziel: Den Blind in die DATENBANK verlegen. Diese Migration legt die neue,
--       sichere Lese-Schicht an (Views + SQL-Anonymisierung). Sie ENTZIEHT noch
--       KEINE Rechte — das passiert erst in Welle C, nachdem das Frontend (Welle B)
--       auf die Views umgestellt und in Lovable publiziert wurde.
--
-- Sicherheitsmodell der Views:
--   * Normale Views laufen mit OWNER-Rechten (definer) und umgehen damit die RLS
--     der Basistabellen. Die Views erzwingen Zugriff deshalb SELBST:
--       - Zeilen-Ownership via WHERE (client_id = auth.uid() bzw. recruiter-Check)
--       - Spalten-Maskierung via CASE WHEN s.identity_unlocked / company_revealed
--   * So liefert die DB vor dem Reveal NULL statt Klartext — auch im Network-Tab.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Anonymisierungs-Helfer (Port von src/lib/anonymization.ts nach SQL)
--    IMMUTABLE/pure, damit überall (Views, RPCs) konsistent nutzbar.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.anon_region_broad(city text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN city IS NULL OR btrim(city) = '' THEN 'DACH'
    WHEN lower(city) ~ 'münchen|munich|augsburg|nürnberg|regensburg|stuttgart|ulm|freiburg|karlsruhe' THEN 'Süddeutschland'
    WHEN lower(city) ~ 'berlin|hamburg|bremen|hannover|kiel|rostock|lübeck|schwerin' THEN 'Norddeutschland'
    WHEN lower(city) ~ 'köln|düsseldorf|dortmund|essen|frankfurt|bonn|aachen|wiesbaden|mainz' THEN 'Westdeutschland'
    WHEN lower(city) ~ 'dresden|leipzig|chemnitz|erfurt|magdeburg|potsdam' THEN 'Ostdeutschland'
    WHEN lower(city) ~ 'wien|vienna|graz|linz|salzburg|innsbruck|klagenfurt|österreich|austria' THEN 'Österreich'
    WHEN lower(city) ~ 'zürich|zurich|basel|bern|genf|geneva|lausanne|schweiz|switzerland' THEN 'Schweiz'
    WHEN lower(city) ~ 'amsterdam|netherlands|niederlande' THEN 'EU - Benelux'
    WHEN lower(city) ~ 'paris|france|frankreich' THEN 'EU - Frankreich'
    WHEN lower(city) ~ 'london|uk|england' THEN 'UK'
    WHEN lower(city) ~ 'spain|spanien|madrid|barcelona' THEN 'EU - Südeuropa'
    WHEN lower(city) ~ 'poland|polen|warsaw|krakow' THEN 'EU - Osteuropa'
    WHEN lower(city) ~ 'germany|deutschland' THEN 'Deutschland'
    ELSE 'DACH'
  END;
$$;

CREATE OR REPLACE FUNCTION public.anon_experience_band(years integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN years IS NULL THEN 'Nicht angegeben'
    WHEN years < 2  THEN '0-2 Jahre'
    WHEN years < 5  THEN '3-5 Jahre'
    WHEN years < 10 THEN '6-10 Jahre'
    WHEN years < 15 THEN '10-15 Jahre'
    ELSE '15+ Jahre'
  END;
$$;

CREATE OR REPLACE FUNCTION public.anon_salary_band(salary numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN salary IS NULL OR salary <= 0 THEN 'Nicht freigegeben'
    ELSE '€' || ((floor(salary / 10000) * 10000) / 1000)::int || 'k - €'
             || ((floor(salary / 10000) * 10000 + 10000) / 1000)::int || 'k'
  END;
$$;

GRANT EXECUTE ON FUNCTION public.anon_region_broad(text)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.anon_experience_band(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.anon_salary_band(numeric)    TO authenticated;

-- ----------------------------------------------------------------------------
-- 2) client_candidate_view — Kandidaten-Sicht für Clients (pro Submission).
--    Ownership: nur Kandidaten, die auf einen Job DES Clients eingereicht sind.
--    PII (Name/E-Mail/Telefon/CV/LinkedIn, Stadt, exakte Erfahrung) ist NULL,
--    solange s.identity_unlocked = false. Gehalt grundsätzlich nur als Band.
-- ----------------------------------------------------------------------------
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
  CASE WHEN s.identity_unlocked THEN c.experience_years END AS experience_years
FROM submissions s
JOIN jobs j        ON j.id = s.job_id
JOIN candidates c  ON c.id = s.candidate_id
WHERE j.client_id = auth.uid();

-- ----------------------------------------------------------------------------
-- 3) client_candidate_experiences_view — Werdegang für Clients.
--    Arbeitgebernamen sind bis zum Reveal verborgen (Re-ID-Schutz).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.client_candidate_experiences_view AS
SELECT
  ce.id,
  s.id          AS submission_id,   -- pro Submission filtern (verhindert Duplikate)
  ce.candidate_id,
  ce.job_title,
  ce.start_date,
  ce.end_date,
  ce.is_current,
  ce.sort_order,
  s.identity_unlocked,
  CASE WHEN s.identity_unlocked THEN ce.company_name END AS company_name,
  CASE WHEN s.identity_unlocked THEN ce.description  END AS description
FROM candidate_experiences ce
JOIN submissions s ON s.candidate_id = ce.candidate_id
JOIN jobs j        ON j.id = s.job_id
WHERE j.client_id = auth.uid();

-- ----------------------------------------------------------------------------
-- 4) recruiter_jobs_view — Job-Sicht für Recruiter (Client->Recruiter-Blind).
--    company_name/company_culture nur sichtbar, wenn der Recruiter für diesen
--    Job eine Submission mit company_revealed = true hat. Sonst NULL.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.recruiter_jobs_view AS
SELECT
  j.id,
  j.title,
  j.status,
  j.industry,
  j.location,
  j.salary_min,
  j.salary_max,
  j.company_size_band,
  j.client_id,
  -- Firmen-Identität nur nach Reveal (eigene Submission dieses Recruiters)
  CASE WHEN rev.revealed THEN j.company_name    ELSE NULL END AS company_name,
  CASE WHEN rev.revealed THEN j.company_culture ELSE NULL END AS company_culture,
  COALESCE(rev.revealed, false) AS company_revealed
FROM jobs j
LEFT JOIN LATERAL (
  SELECT true AS revealed
  FROM submissions s
  WHERE s.job_id = j.id
    AND s.recruiter_id = auth.uid()
    AND s.company_revealed = true
  LIMIT 1
) rev ON true
WHERE public.has_role(auth.uid(), 'recruiter')
  AND j.status = 'published';

-- ----------------------------------------------------------------------------
-- 5) Zugriff: PostgREST liest als Rolle 'authenticated'. Die Views erzwingen
--    Ownership/Maskierung selbst (s.o.), daher ist GRANT SELECT sicher.
-- ----------------------------------------------------------------------------
GRANT SELECT ON public.client_candidate_view             TO authenticated;
GRANT SELECT ON public.client_candidate_experiences_view TO authenticated;
GRANT SELECT ON public.recruiter_jobs_view               TO authenticated;
