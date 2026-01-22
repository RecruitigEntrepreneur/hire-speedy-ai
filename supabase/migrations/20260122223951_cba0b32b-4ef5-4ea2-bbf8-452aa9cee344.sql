-- Add new fields for Triple-Blind V1 standard
ALTER TABLE candidate_client_summary 
ADD COLUMN IF NOT EXISTS role_archetype TEXT,
ADD COLUMN IF NOT EXISTS primary_domain TEXT,
ADD COLUMN IF NOT EXISTS fit_assessment TEXT DEFAULT 'grenzwertig',
ADD COLUMN IF NOT EXISTS change_motivation_status TEXT DEFAULT 'unbekannt';

-- Add comment for documentation
COMMENT ON COLUMN candidate_client_summary.role_archetype IS 'Anonymized role archetype like "Senior Backend Engineer"';
COMMENT ON COLUMN candidate_client_summary.primary_domain IS 'Primary technical/professional domain like "Cloud & Backend"';
COMMENT ON COLUMN candidate_client_summary.fit_assessment IS 'geeignet | grenzwertig | nicht_geeignet';
COMMENT ON COLUMN candidate_client_summary.change_motivation_status IS 'unbekannt | gering | mittel | hoch';