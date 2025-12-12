-- Phase 1: Profiles erweitern für dynamische Template-Variablen
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role_title TEXT DEFAULT 'Talent Acquisition Manager';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS years_experience INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS placements_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS professional_tone TEXT DEFAULT 'Empathisch, souverän, klar, strukturiert';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_voice TEXT DEFAULT 'Premium Beratung, High-Touch Betreuung';

-- Phase 3: AI Assessment Tabelle
CREATE TABLE IF NOT EXISTS candidate_ai_assessment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  
  -- Risiken
  risk_factors JSONB DEFAULT '[]',
  risk_level TEXT DEFAULT 'medium',
  
  -- Chancen
  opportunity_factors JSONB DEFAULT '[]',
  opportunity_level TEXT DEFAULT 'medium',
  
  -- Key Highlights (für Kunden)
  key_highlights JSONB DEFAULT '[]',
  
  -- Scores
  overall_score INTEGER DEFAULT 50,
  placement_probability INTEGER DEFAULT 50,
  
  -- AI Details
  technical_fit INTEGER,
  culture_fit INTEGER,
  communication_score INTEGER,
  recommendation TEXT,
  reasoning TEXT,
  
  -- Metadaten
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  model_version TEXT DEFAULT 'v1',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS für AI Assessment
ALTER TABLE candidate_ai_assessment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all AI assessments"
ON candidate_ai_assessment FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Recruiters can manage AI assessments for their candidates"
ON candidate_ai_assessment FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM candidates c
  WHERE c.id = candidate_ai_assessment.candidate_id
  AND c.recruiter_id = auth.uid()
));

-- Trigger für updated_at
CREATE TRIGGER update_candidate_ai_assessment_updated_at
BEFORE UPDATE ON candidate_ai_assessment
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Phase 4: Dokumentenverwaltung mit Versioning
CREATE TABLE IF NOT EXISTS candidate_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  
  document_type TEXT NOT NULL, -- 'cv', 'cv_anonymized', 'certificate', 'portfolio', 'reference'
  version INTEGER DEFAULT 1,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  
  is_current BOOLEAN DEFAULT true,
  notes TEXT,
  
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS für Documents
ALTER TABLE candidate_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all documents"
ON candidate_documents FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Recruiters can manage documents for their candidates"
ON candidate_documents FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM candidates c
  WHERE c.id = candidate_documents.candidate_id
  AND c.recruiter_id = auth.uid()
));

-- Phase 5: Strukturierte Projektdaten
CREATE TABLE IF NOT EXISTS candidate_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  
  project_name TEXT NOT NULL,
  client_name TEXT,
  client_industry TEXT,
  project_type TEXT, -- 'rollout', 'migration', 'implementation', 'consulting', 'transformation'
  
  -- Metriken
  budget_range TEXT,
  team_size INTEGER,
  duration_months INTEGER,
  locations_count INTEGER,
  devices_count INTEGER,
  
  -- Details
  technologies JSONB DEFAULT '[]',
  responsibilities JSONB DEFAULT '[]',
  achievements JSONB DEFAULT '[]',
  
  -- Zeitraum
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,
  
  -- Ordnung
  sort_order INTEGER DEFAULT 0,
  is_highlight BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS für Projects
ALTER TABLE candidate_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all projects"
ON candidate_projects FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Recruiters can manage projects for their candidates"
ON candidate_projects FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM candidates c
  WHERE c.id = candidate_projects.candidate_id
  AND c.recruiter_id = auth.uid()
));

-- Trigger für updated_at
CREATE TRIGGER update_candidate_projects_updated_at
BEFORE UPDATE ON candidate_projects
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Index für bessere Performance
CREATE INDEX IF NOT EXISTS idx_candidate_ai_assessment_candidate_id ON candidate_ai_assessment(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_documents_candidate_id ON candidate_documents(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_projects_candidate_id ON candidate_projects(candidate_id);