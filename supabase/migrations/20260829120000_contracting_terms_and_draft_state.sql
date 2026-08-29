-- ============================================================================
-- Contracting-Konditionen und Entwurfsstand: Schluss mit dem stillen Verfall
-- ----------------------------------------------------------------------------
-- BEFUND: Der Contracting-Zweig der Jobaufnahme erhebt fuenf Konditionen
--   (Tagessatz von/bis, Laufzeit, Auslastung, Verlaengerung), fuer die es in
--   Produktion keine Spalte gibt. src/components/dashboard/JobIntakeStudio.tsx
--   setzt salary_min/salary_max bei employment_type='freelance' hart auf NULL
--   und legt die Konditionen in intake_payload.contracting ab -- eine Spalte,
--   die produktiv ebenfalls fehlt. Ergebnis: eine Contracting-Stelle geht ganz
--   ohne Verguetungsangabe an die Recruiter, und der Kunde merkt es nicht.
--
--   Dasselbe Muster beim Entwurf: "Spaeter weiter" schreibt den kompletten
--   Studio-Zustand nach intake_payload.draft_state. Fehlt die Spalte, faellt
--   src/lib/intakeCapture.ts still auf einen Insert ohne die erweiterten Felder
--   zurueck -- der Kunde bekommt "Entwurf gespeichert" und findet beim
--   Fortsetzen ein leeres Briefing vor.
--
-- ENTSCHEIDUNG: Typisierte Spalten statt JSONB. Der Tagessatz ist eine
--   Verguetung und gehoert in ein Feld, das der Matcher und das Recruiter-Expose
--   lesen koennen -- nicht in einen Blob.
--
-- Rein additiv. Keine bestehende Zeile wird veraendert.
-- ============================================================================

BEGIN;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS day_rate_min              integer,
  ADD COLUMN IF NOT EXISTS day_rate_max              integer,
  ADD COLUMN IF NOT EXISTS contract_duration_months  integer,
  ADD COLUMN IF NOT EXISTS utilization_days_per_week integer,
  ADD COLUMN IF NOT EXISTS extension_possible        boolean,
  ADD COLUMN IF NOT EXISTS draft_state               jsonb;

COMMENT ON COLUMN public.jobs.day_rate_min IS
  'Tagessatz-Untergrenze in EUR fuer employment_type = freelance. Bei Festanstellung NULL.';
COMMENT ON COLUMN public.jobs.day_rate_max IS
  'Tagessatz-Obergrenze in EUR fuer employment_type = freelance. Bei Festanstellung NULL.';
COMMENT ON COLUMN public.jobs.contract_duration_months IS
  'Geplante Laufzeit des Einsatzes in Monaten.';
COMMENT ON COLUMN public.jobs.utilization_days_per_week IS
  'Geplante Auslastung in Tagen pro Woche (1-5).';
COMMENT ON COLUMN public.jobs.extension_possible IS
  'Ob eine Verlaengerung ueber die Laufzeit hinaus in Aussicht steht.';
COMMENT ON COLUMN public.jobs.draft_state IS
  'Vollstaendiger Studio-Zustand eines Entwurfs (built, answers, flexibility, '
  'revealSetup, dyn). Ausschliesslich fuer "Spaeter weiter" -- niemals Teil der '
  'recruiter_jobs_view, weil hier unredigierte Kundenangaben stehen.';

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_day_rate_range_check;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_day_rate_range_check
  CHECK (day_rate_min IS NULL OR day_rate_max IS NULL OR day_rate_min <= day_rate_max);

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_utilization_check;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_utilization_check
  CHECK (utilization_days_per_week IS NULL
         OR utilization_days_per_week BETWEEN 1 AND 5);

-- ----------------------------------------------------------------------------
-- recruiter_jobs_view: die Konditionen muessen beim Recruiter ankommen.
-- Sonst ist der Tagessatz zwar gespeichert, aber niemand sieht ihn -- der
-- Verfall waere nur eine Ebene tiefer gerutscht.
--
-- Basis ist die produktiv laufende Fassung (20260725132524). Unveraendert
-- bleiben: kein security_invoker, Rollenpruefung und Maskierung in der View,
-- client_id/office_address/decision_makers/briefing_notes/intake_briefing sind
-- weiterhin NICHT enthalten. draft_state ebenfalls nicht.
-- ----------------------------------------------------------------------------
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
  CASE WHEN rev.revealed THEN j.company_name    ELSE NULL END AS company_name,
  CASE WHEN rev.revealed THEN j.company_culture ELSE NULL END AS company_culture,
  CASE WHEN rev.revealed THEN j.description     ELSE NULL END AS description,
  CASE WHEN rev.revealed THEN j.requirements    ELSE NULL END AS requirements,
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
  'Reveal-gated Job-Sicht fuer Recruiter. Identitaetstragende Spalten (client_id, '
  'office_address, office_lat/lng, decision_makers, briefing_notes, '
  'intake_briefing, draft_state) sind nicht enthalten. company_name, '
  'company_culture, description und requirements erst nach company_revealed = true '
  'auf einer eigenen Submission. Contracting-Konditionen sind ungated: ein '
  'Tagessatz identifiziert kein Unternehmen, aber ohne ihn kann kein Recruiter '
  'einen Freiberufler ansprechen.';

COMMIT;
