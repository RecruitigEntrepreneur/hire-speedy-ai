-- ============================================================================
-- Welle 1 / Schritt 1: recruiter_jobs_view härten und vollständig machen
-- ----------------------------------------------------------------------------
-- Ausgangslage:
--   Die Policy "Recruiters can view published jobs" auf public.jobs erlaubt
--   Recruitern SELECT auf ALLE Spalten jedes veröffentlichten Jobs. RLS kann
--   grundsätzlich nur Zeilen filtern, keine Spalten. Damit lieferte die API
--   company_name, client_id und office_address im Klartext aus — die
--   Anonymisierung im Frontend war rein kosmetisch.
--
--   Die recruiter_jobs_view aus Welle A (20260608121000) maskierte zwar
--   korrekt, hatte aber nur 12 Spalten und wurde vom Frontend nirgends
--   genutzt.
--
-- Diese Migration erweitert die View auf alle Spalten, die das Recruiter-UI
-- tatsächlich braucht, und teilt sie in drei Klassen:
--
--   A) Immer sichtbar   — nicht identifizierende Sachdaten
--   B) Reveal-gated     — erst wenn der Recruiter für DIESEN Job eine
--                         Submission mit company_revealed = true hat
--   C) Nie ausgeliefert — Identitätsvektoren, gar nicht erst in der View
--
-- Zu C) gehören insbesondere client_id, office_address, office_lat/lng,
-- decision_makers, briefing_notes und intake_briefing. client_id wurde im
-- Frontend ausschließlich für einen company_profiles-Fetch benutzt, der durch
-- RLS ohnehin schon 0 Zeilen liefert (toter Code, wird mit ausgebaut).
--
-- Zu B) gehören neben company_name/company_culture neu auch description und
-- requirements: Die Rohtexte nennen Standortzahlen und Ortsdetails, über die
-- sich der Kunde trivial identifizieren lässt. Vor dem Reveal wird deshalb
-- nur die für Recruiter aufbereitete Fassung (formatted_content, job_summary)
-- ausgeliefert.
--
-- HINWEIS (bekannte Restlücke): In 4 von 20 Bestandsjobs enthält auch die
-- aufbereitete Fassung noch Ortsdetails ("Rhein-Main", "Taunus"). Der
-- Firmenname selbst steckt in keiner. Das Bereinigen der aufbereiteten Texte
-- ist eine eigene Aufgabe (KI-Redaktionslauf) und NICHT Teil dieser Migration.
--
-- Die View läuft bewusst mit den Rechten des Owners (kein security_invoker),
-- erzwingt die Rollenprüfung und die Maskierung also selbst. Nur dadurch
-- funktioniert sie weiter, wenn in Schritt 3 der Direktzugriff auf public.jobs
-- entzogen wird.
-- ============================================================================

DROP VIEW IF EXISTS public.recruiter_jobs_view;

CREATE VIEW public.recruiter_jobs_view AS
SELECT
  -- ---------------------------------------------------------------- A) offen
  j.id,
  j.title,
  j.status,
  j.industry,
  j.location,
  j.remote_type,
  j.employment_type,
  j.experience_level,
  j.salary_min,
  j.salary_max,
  j.fee_percentage,
  j.recruiter_fee_percentage,
  j.skills,
  j.must_haves,
  j.nice_to_haves,
  j.screening_questions,
  j.company_size_band,
  j.funding_stage,
  j.hiring_urgency,
  j.urgency,
  j.tech_environment,
  j.required_languages,
  j.required_certifications,
  j.onsite_required,
  j.onsite_days_required,
  j.remote_policy,
  j.benefits,
  j.deadline,
  j.created_at,
  j.updated_at,

  -- Für Recruiter aufbereitete (redigierte) Fassung — ersetzt vor dem Reveal
  -- die Rohtexte description/requirements.
  j.formatted_content,
  j.job_summary,

  -- Embedding für die Ähnlichkeitssuche (useSimilarCandidates). Enthält keine
  -- lesbare Identität.
  j.embedding,

  -- ---------------------------------------------------------- B) reveal-gated
  CASE WHEN rev.revealed THEN j.company_name    ELSE NULL END AS company_name,
  CASE WHEN rev.revealed THEN j.company_culture ELSE NULL END AS company_culture,
  CASE WHEN rev.revealed THEN j.description     ELSE NULL END AS description,
  CASE WHEN rev.revealed THEN j.requirements    ELSE NULL END AS requirements,

  COALESCE(rev.revealed, false) AS company_revealed

  -- ------------------------------------------------------------- C) entfernt
  -- client_id, office_address, office_lat, office_lng, decision_makers,
  -- briefing_notes, intake_briefing, approved_by, client_approved_by,
  -- client_approval_note: bewusst NICHT Teil dieser View.

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

GRANT SELECT ON public.recruiter_jobs_view TO authenticated;

COMMENT ON VIEW public.recruiter_jobs_view IS
  'Reveal-gated Job-Sicht für Recruiter. Identitätstragende Spalten (client_id, '
  'office_address, office_lat/lng, decision_makers, briefing_notes, '
  'intake_briefing) sind nicht enthalten. company_name, company_culture, '
  'description und requirements erst nach company_revealed = true auf einer '
  'eigenen Submission. Vor dem Reveal dienen formatted_content/job_summary als '
  'redigierte Fassung. Recruiter dürfen public.jobs nicht direkt lesen.';
