-- Erweiterte Kandidatenfelder für vollständige Kandidatenmaske

-- Stammdaten
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS nationality text;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS residence_status text;

-- Beruflicher Fokus
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS specializations jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS industry_experience jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS soft_skills jsonb DEFAULT '[]'::jsonb;

-- Projektmetriken (für Exposé)
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS project_metrics jsonb DEFAULT '{}'::jsonb;

-- Exposé-Bausteine
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS expose_title text;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS expose_summary text;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS expose_highlights jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS expose_project_highlights jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS expose_certifications jsonb DEFAULT '[]'::jsonb;

-- Kommentare für Dokumentation
COMMENT ON COLUMN public.candidates.nationality IS 'Nationalität des Kandidaten';
COMMENT ON COLUMN public.candidates.residence_status IS 'Aufenthaltsstatus: citizen, permanent, work_visa, student_visa, pending';
COMMENT ON COLUMN public.candidates.specializations IS 'Spezialisierungen als Array von Strings';
COMMENT ON COLUMN public.candidates.industry_experience IS 'Branchenerfahrung als Array von Strings';
COMMENT ON COLUMN public.candidates.soft_skills IS 'Soft Skills als Array von Strings';
COMMENT ON COLUMN public.candidates.project_metrics IS 'Projektmetriken: max_team_size, max_budget, locations_managed, units_delivered';
COMMENT ON COLUMN public.candidates.expose_title IS 'Exposé-Titel für Kundenexport';
COMMENT ON COLUMN public.candidates.expose_summary IS 'Kurzprofil für Exposé';
COMMENT ON COLUMN public.candidates.expose_highlights IS 'Qualifikations-Highlights für Exposé';
COMMENT ON COLUMN public.candidates.expose_project_highlights IS 'Projekt-Highlights für Exposé';
COMMENT ON COLUMN public.candidates.expose_certifications IS 'Wichtige Zertifizierungen für Exposé';