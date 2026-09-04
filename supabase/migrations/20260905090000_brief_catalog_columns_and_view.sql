-- ============================================================================
-- Der Fragenkatalog bekommt seine zwei fehlenden Spalten -- und der Headhunter
-- bekommt endlich zu sehen, was der Kunde erzaehlt hat
-- ============================================================================
-- BEFUND (04.09.2026): Fuer den Briefing-Leitfaden existierten bereits 25
-- passende Spalten in `jobs` -- career_example, negative_impact_if_unfilled,
-- trainable_skills, works_council_meeting_schedule und andere. Kein
-- Aufnahmepfad hat je eine davon geschrieben, und KEINE EINZIGE steht in
-- recruiter_jobs_view. Wir haetten sie alle fuellen koennen, und der
-- Headhunter haette nichts gesehen.
--
-- Diese Migration tut drei Dinge:
--   1. legt die zwei Spalten an, die wirklich fehlen,
--   2. loescht eine Spalte, die es nicht geben sollte,
--   3. hebt die Katalogfelder in die Recruiter-Sicht -- getrennt nach dem,
--      was die Firma verraten wuerde, und dem, was nur die Rolle beschreibt.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Zwei fehlende Spalten
-- ---------------------------------------------------------------------------
-- 85.000 auf zwoelf Monate ist etwas anderes als auf vierzehn. Ohne diese Zahl
-- ist jede Gehaltsspanne zwischen zwei Stellen unvergleichbar, und der
-- Recruiter nennt dem Kandidaten ein Paket, das es so nicht gibt.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS salary_months numeric;

COMMENT ON COLUMN public.jobs.salary_months IS
  'Auf wie viele Monatsgehaelter sich das Jahresfixum verteilt (12, 13, 13.5, 14). '
  'Firmenstandard, wird ab der zweiten Stelle desselben Kunden vererbt.';

-- Befristet oder nicht. Bewusst NICHT employment_type (das ist Voll-/Teilzeit)
-- und nicht contract_type (das traegt bereits Festanstellung vs. Contracting).
-- Beide mit einer dritten Bedeutung zu ueberladen waere genau die Sorte
-- Doppelnutzung, die spaeter niemand mehr aufloest.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS contract_limitation text;

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_contract_limitation_check;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_contract_limitation_check
  CHECK (contract_limitation IS NULL
         OR contract_limitation IN ('unbefristet', 'befristet_mit_aussicht', 'befristet', 'projekt'));

COMMENT ON COLUMN public.jobs.contract_limitation IS
  'Befristung des Arbeitsvertrags. Getrennt von employment_type (Voll-/Teilzeit) '
  'und contract_type (Festanstellung vs. Contracting).';

-- ---------------------------------------------------------------------------
-- 2. team_avg_age faellt weg
-- ---------------------------------------------------------------------------
-- Das Durchschnittsalter ist ein AGG-Merkmal. Schlimmer als die blosse
-- Existenz der Spalte war, wie sie gefuellt wurde: parse-job-url wies das
-- Modell woertlich an, aus einer Stimmungsfloskel eine Altersspanne zu machen
-- ("junges dynamisches Team" -> "25-35"). Damit erzeugten wir aus einer
-- Werbezeile, die in fast jeder deutschen Anzeige steht, ein gespeichertes
-- Altersziel -- und rechneten es im alten Aufnahmepfad sogar in die
-- Vollstaendigkeit ein.
--
-- Die Anweisung im Prompt ist im selben Zug entfernt worden; ohne das Loeschen
-- der Spalte waere sie beim naechsten Schema-Abgleich wieder aufgetaucht.
ALTER TABLE public.jobs DROP COLUMN IF EXISTS team_avg_age;

-- ---------------------------------------------------------------------------
-- 3. recruiter_jobs_view: die Katalogfelder erreichen den Headhunter
-- ---------------------------------------------------------------------------
-- Basis ist die produktiv laufende Fassung (20260829120000). Unveraendert
-- bleiben: KEIN security_invoker (Recruiter haben keine RLS auf jobs, die
-- View muss mit Owner-Rechten laufen), die Rollenpruefung in der View, und
-- der Ausschluss identitaetstragender Spalten -- client_id, office_address,
-- office_lat/lng, briefing_notes, intake_briefing, intake_payload,
-- draft_state. Dort stehen unredigierte Kundenangaben.
--
-- Neu ist die Trennung der Katalogfelder in zwei Klassen:
--   SAFE   beschreibt die ROLLE. Ein Vakanzgrund oder eine Teamgroesse
--          identifiziert kein Unternehmen -- ohne sie kann der Recruiter aber
--          kein Gespraech fuehren.
--   GATED  kann die Firma verraten ("Werk in Tschechien uebernommen",
--          "Dachterrasse mit Elbblick"). Diese Felder folgen derselben Sperre
--          wie description und requirements: erst nach company_revealed auf
--          einer eigenen Submission.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.recruiter_jobs_view;

CREATE VIEW public.recruiter_jobs_view AS
SELECT
  j.id, j.title, j.status, j.industry, j.location,
  j.remote_type, j.employment_type, j.experience_level,
  j.salary_min, j.salary_max, j.fee_percentage, j.recruiter_fee_percentage,
  j.skills, j.must_haves, j.nice_to_haves, j.screening_questions,
  j.company_size_band, j.funding_stage, j.hiring_urgency, j.urgency,
  j.tech_environment, j.required_languages, j.required_certifications,
  j.onsite_required, j.onsite_days_required, j.remote_policy,
  j.benefits, j.deadline, j.created_at, j.updated_at,
  j.formatted_content, j.job_summary,
  j.embedding,
  j.day_rate_min, j.day_rate_max, j.contract_duration_months,
  j.utilization_days_per_week, j.extension_possible,

  -- ---- Katalogfelder, SAFE: beschreiben die Rolle, nicht die Firma --------
  j.vacancy_reason,               -- warum die Stelle offen ist
  j.reports_to,                   -- an wen berichtet wird
  j.team_size,
  j.department_structure,
  j.task_focus,                   -- Schwerpunkt der Position
  j.task_breakdown,               -- Gewichtung der Aufgaben
  j.must_have_criteria,           -- die drei Kriterien fuer den Direkteinsatz
  j.trainable_skills,             -- was nachgeschult werden kann
  j.nice_to_have_criteria,
  j.decision_makers,
  j.success_profile,              -- wer beim Kunden Erfolg hat
  j.failure_profile,              -- und wer nicht
  j.core_hours,
  j.overtime_policy,
  j.time_tracking_method,
  j.works_council,
  j.works_council_meeting_schedule,
  j.contract_creation_days,
  j.contract_limitation,
  j.contract_sensitive_topics,
  j.bonus_structure,
  j.salary_months,
  j.career_path,                  -- Entwicklungswege sind generisch genug

  -- ---- Reveal-gesperrt: identisch behandelt wie description/requirements --
  CASE WHEN rev.revealed THEN j.company_name    ELSE NULL END AS company_name,
  CASE WHEN rev.revealed THEN j.company_culture ELSE NULL END AS company_culture,
  CASE WHEN rev.revealed THEN j.description     ELSE NULL END AS description,
  CASE WHEN rev.revealed THEN j.requirements    ELSE NULL END AS requirements,
  -- Ein Arbeitsalltag nennt Projekte, Standorte und Namen; ein konkretes
  -- Karrierebeispiel nennt Personen; Alleinstellungsmerkmale nennen Produkte.
  CASE WHEN rev.revealed THEN j.daily_routine   ELSE NULL END AS daily_routine,
  CASE WHEN rev.revealed THEN j.career_example  ELSE NULL END AS career_example,
  CASE WHEN rev.revealed THEN j.unique_selling_points ELSE NULL END AS unique_selling_points,
  CASE WHEN rev.revealed THEN j.position_advantages   ELSE NULL END AS position_advantages,
  CASE WHEN rev.revealed THEN j.negative_impact_if_unfilled ELSE NULL END AS negative_impact_if_unfilled,
  CASE WHEN rev.revealed THEN j.industry_opportunities ELSE NULL END AS industry_opportunities,
  CASE WHEN rev.revealed THEN j.industry_challenges    ELSE NULL END AS industry_challenges,

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

GRANT SELECT ON public.recruiter_jobs_view TO authenticated;

COMMENT ON VIEW public.recruiter_jobs_view IS
  'Reveal-gated Job-Sicht fuer Recruiter. Identitaetstragende Spalten '
  '(client_id, office_address, office_lat/lng, briefing_notes, intake_briefing, '
  'intake_payload, draft_state) sind nicht enthalten. '
  'Die Felder des Briefing-Katalogs sind in zwei Klassen geteilt: was die ROLLE '
  'beschreibt (Vakanzgrund, Berichtsweg, Teamgroesse, die drei Muss-Kriterien, '
  'Nachschulbares, Erfolgs- und Misserfolgsprofil, Arbeitszeit, Betriebsrat, '
  'Vertrag) ist ungated -- ohne diese Angaben kann der Recruiter kein '
  'Kandidatengespraech fuehren. Was die FIRMA verraten wuerde (company_name, '
  'company_culture, description, requirements, daily_routine, career_example, '
  'unique_selling_points, position_advantages, negative_impact_if_unfilled, '
  'industry_*) erscheint erst nach company_revealed = true auf einer eigenen '
  'Submission.';

COMMIT;
