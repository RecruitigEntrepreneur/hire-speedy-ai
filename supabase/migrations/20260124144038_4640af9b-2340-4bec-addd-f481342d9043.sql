-- ============================================
-- TECH DOMAINS TABLE
-- Externalize domain configuration from Edge Function
-- ============================================

CREATE TABLE IF NOT EXISTS public.tech_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_key TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  display_name_de TEXT,
  primary_skills TEXT[] DEFAULT '{}',
  secondary_skills TEXT[] DEFAULT '{}',
  title_keywords TEXT[] DEFAULT '{}',
  transferable_to TEXT[] DEFAULT '{}',
  incompatible_with TEXT[] DEFAULT '{}',
  weight NUMERIC DEFAULT 1.0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.tech_domains ENABLE ROW LEVEL SECURITY;

-- Admin-only write access
CREATE POLICY "Admins can manage tech_domains" ON public.tech_domains
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Everyone can read active domains
CREATE POLICY "Anyone can read active tech_domains" ON public.tech_domains
  FOR SELECT USING (active = true);

-- Seed data from TECH_DOMAINS in calculate-match-v3-1
INSERT INTO public.tech_domains (domain_key, display_name, display_name_de, primary_skills, title_keywords, transferable_to, incompatible_with) VALUES
('embedded_hardware', 'Embedded/Hardware', 'Embedded/Hardware', 
  ARRAY['fpga', 'vhdl', 'verilog', 'embedded', 'hardware', 'pcb', 'altium', 'cadence', 'xilinx', 'arm', 'microcontroller', 'rtos', 'tia portal', 'beckhoff', 'twincat', 'sps', 'plc', 'elektronik', 'firmware', 'asic'],
  ARRAY['hardware', 'embedded', 'fpga', 'firmware', 'elektronik'],
  ARRAY['iot', 'firmware', 'devops'],
  ARRAY['backend_cloud', 'frontend_web', 'data_ml', 'product_management', 'design', 'finance_accounting']
),
('backend_cloud', 'Backend/Cloud', 'Backend/Cloud',
  ARRAY['java', 'spring', 'spring boot', 'aws', 'azure', 'gcp', 'kubernetes', 'docker', 'microservices', 'postgresql', 'mongodb', 'redis', 'kafka', 'api', 'rest', 'graphql', 'node.js', 'python', 'go', 'golang', 'rust'],
  ARRAY['backend', 'java', 'cloud', 'api', 'developer', 'engineer'],
  ARRAY['devops', 'data_ml', 'frontend_web'],
  ARRAY['embedded_hardware', 'design', 'product_management', 'finance_accounting']
),
('frontend_web', 'Frontend/Web', 'Frontend/Web',
  ARRAY['react', 'vue', 'angular', 'typescript', 'javascript', 'css', 'html', 'next.js', 'nuxt', 'tailwind', 'webpack', 'vite', 'sass', 'redux', 'mobx', 'zustand', 'svelte'],
  ARRAY['frontend', 'react', 'web', 'vue', 'angular', 'ui developer'],
  ARRAY['mobile', 'backend_cloud'],
  ARRAY['embedded_hardware', 'data_ml', 'finance_accounting']
),
('data_ml', 'Data/ML', 'Data/ML',
  ARRAY['python', 'tensorflow', 'pytorch', 'pandas', 'spark', 'sql', 'machine learning', 'data science', 'ai', 'deep learning', 'numpy', 'scikit-learn', 'jupyter', 'databricks', 'airflow'],
  ARRAY['data', 'ml', 'machine learning', 'ai', 'data scientist', 'data engineer'],
  ARRAY['backend_cloud']::TEXT[],
  ARRAY['embedded_hardware', 'frontend_web', 'design', 'finance_accounting']
),
('devops', 'DevOps/SRE', 'DevOps/SRE',
  ARRAY['docker', 'kubernetes', 'terraform', 'ansible', 'ci/cd', 'jenkins', 'github actions', 'linux', 'bash', 'aws', 'azure', 'gcp', 'helm', 'prometheus', 'grafana'],
  ARRAY['devops', 'sre', 'platform', 'infrastructure', 'cloud engineer'],
  ARRAY['backend_cloud', 'embedded_hardware'],
  ARRAY['design', 'product_management', 'finance_accounting']
),
('mobile', 'Mobile', 'Mobile',
  ARRAY['swift', 'kotlin', 'react native', 'flutter', 'ios', 'android', 'objective-c', 'xamarin', 'ionic', 'swiftui', 'jetpack compose'],
  ARRAY['mobile', 'ios', 'android', 'app developer'],
  ARRAY['frontend_web']::TEXT[],
  ARRAY['embedded_hardware', 'data_ml', 'devops', 'finance_accounting']
),
('design', 'Design/UX', 'Design/UX',
  ARRAY['figma', 'sketch', 'adobe xd', 'ui', 'ux', 'prototyping', 'user research', 'design system', 'wireframing', 'photoshop', 'illustrator'],
  ARRAY['designer', 'ux', 'ui', 'design', 'product designer'],
  ARRAY['frontend_web', 'product_management'],
  ARRAY['embedded_hardware', 'backend_cloud', 'data_ml', 'devops', 'finance_accounting']
),
('product_management', 'Product Management', 'Produktmanagement',
  ARRAY['product management', 'roadmap', 'okr', 'agile', 'scrum', 'stakeholder', 'user stories', 'jira', 'confluence', 'product owner', 'backlog', 'sprint planning'],
  ARRAY['product manager', 'product owner', 'pm', 'po'],
  ARRAY['design']::TEXT[],
  ARRAY['embedded_hardware', 'backend_cloud', 'data_ml', 'devops', 'mobile', 'finance_accounting']
),
('security', 'Security', 'Security',
  ARRAY['security', 'cybersecurity', 'penetration testing', 'soc', 'siem', 'vulnerability', 'compliance', 'iso 27001', 'gdpr', 'firewall', 'encryption', 'oauth'],
  ARRAY['security', 'cyber', 'penetration', 'information security'],
  ARRAY['devops', 'backend_cloud'],
  ARRAY['design', 'product_management', 'finance_accounting']
),
('sap_erp', 'SAP/ERP', 'SAP/ERP',
  ARRAY['abap', 'sap hana', 'sap fiori', 's/4hana', 'sap mm', 'sap sd', 'sap fi', 'sap co', 'sap hr', 'sap basis', 'sap entwicklung', 'sap customizing'],
  ARRAY['sap', 'erp', 'abap', 's/4hana'],
  ARRAY['backend_cloud', 'finance_accounting'],
  ARRAY['embedded_hardware', 'frontend_web', 'design', 'mobile', 'data_ml']
),
('finance_accounting', 'Finance/Accounting', 'Finance/Buchhaltung',
  ARRAY['buchhaltung', 'finanzbuchhaltung', 'bilanzbuchhaltung', 'buchhalter', 'fibu', 'controlling', 'jahresabschluss', 'datev', 'hgb', 'ifrs', 'steuerrecht', 'rechnungswesen'],
  ARRAY['buchhalter', 'accountant', 'finance', 'controlling', 'controller', 'accounting'],
  ARRAY['sap_erp']::TEXT[],
  ARRAY['data_ml', 'frontend_web', 'mobile', 'embedded_hardware', 'design', 'devops', 'security', 'backend_cloud']
),
('hr_recruiting', 'HR/Recruiting', 'HR/Recruiting',
  ARRAY['recruiting', 'hr', 'human resources', 'personalwesen', 'bewerbermanagement', 'onboarding', 'personalentwicklung', 'arbeitsrecht', 'talent acquisition', 'personio'],
  ARRAY['recruiter', 'hr', 'human resources', 'talent', 'people', 'personalreferent'],
  ARRAY[]::TEXT[],
  ARRAY['data_ml', 'backend_cloud', 'frontend_web', 'embedded_hardware', 'devops', 'security']
),
('marketing_sales', 'Marketing/Sales', 'Marketing/Vertrieb',
  ARRAY['marketing', 'sales', 'vertrieb', 'crm', 'hubspot', 'salesforce', 'content marketing', 'seo', 'sem', 'social media', 'lead generation', 'account management'],
  ARRAY['marketing', 'sales', 'vertrieb', 'account manager', 'business development'],
  ARRAY['product_management']::TEXT[],
  ARRAY['data_ml', 'backend_cloud', 'embedded_hardware', 'devops', 'security']
);

-- Trigger for updated_at
CREATE TRIGGER update_tech_domains_updated_at
  BEFORE UPDATE ON public.tech_domains
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SKILL SYNONYMS TABLE
-- For improved skill matching
-- ============================================

CREATE TABLE IF NOT EXISTS public.skill_synonyms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT NOT NULL,
  synonym TEXT NOT NULL,
  confidence NUMERIC DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  bidirectional BOOLEAN DEFAULT true,
  category TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(canonical_name, synonym)
);

-- Enable RLS
ALTER TABLE public.skill_synonyms ENABLE ROW LEVEL SECURITY;

-- Admin-only write access
CREATE POLICY "Admins can manage skill_synonyms" ON public.skill_synonyms
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Everyone can read active synonyms
CREATE POLICY "Anyone can read active skill_synonyms" ON public.skill_synonyms
  FOR SELECT USING (active = true);

-- Index for fast lookups
CREATE INDEX idx_skill_synonyms_canonical ON public.skill_synonyms(canonical_name);
CREATE INDEX idx_skill_synonyms_synonym ON public.skill_synonyms(synonym);

-- Seed synonym data
INSERT INTO public.skill_synonyms (canonical_name, synonym, category) VALUES
('javascript', 'js', 'frontend'),
('javascript', 'ecmascript', 'frontend'),
('javascript', 'es6', 'frontend'),
('typescript', 'ts', 'frontend'),
('react', 'reactjs', 'frontend'),
('react', 'react.js', 'frontend'),
('vue', 'vuejs', 'frontend'),
('vue', 'vue.js', 'frontend'),
('angular', 'angularjs', 'frontend'),
('angular', 'ng', 'frontend'),
('next.js', 'nextjs', 'frontend'),
('next.js', 'next', 'frontend'),
('node.js', 'nodejs', 'backend'),
('node.js', 'node', 'backend'),
('python', 'python3', 'backend'),
('python', 'py', 'backend'),
('java', 'java 8', 'backend'),
('java', 'java 11', 'backend'),
('java', 'java 17', 'backend'),
('c#', 'csharp', 'backend'),
('c#', '.net', 'backend'),
('c#', 'dotnet', 'backend'),
('go', 'golang', 'backend'),
('ruby', 'ruby on rails', 'backend'),
('ruby', 'rails', 'backend'),
('postgresql', 'postgres', 'database'),
('postgresql', 'psql', 'database'),
('mysql', 'mariadb', 'database'),
('mongodb', 'mongo', 'database'),
('elasticsearch', 'elastic', 'database'),
('aws', 'amazon web services', 'cloud'),
('gcp', 'google cloud', 'cloud'),
('gcp', 'google cloud platform', 'cloud'),
('azure', 'microsoft azure', 'cloud'),
('kubernetes', 'k8s', 'devops'),
('kubernetes', 'kube', 'devops'),
('docker', 'container', 'devops'),
('ci/cd', 'cicd', 'devops'),
('ci/cd', 'continuous integration', 'devops'),
('terraform', 'tf', 'devops'),
('tailwind', 'tailwindcss', 'frontend'),
('sass', 'scss', 'frontend'),
('react native', 'reactnative', 'mobile'),
('react native', 'rn', 'mobile'),
('flutter', 'dart', 'mobile'),
('machine learning', 'ml', 'data'),
('machine learning', 'ai', 'data'),
('deep learning', 'dl', 'data'),
('tensorflow', 'keras', 'data'),
('pytorch', 'torch', 'data'),
('buchhaltung', 'accounting', 'finance'),
('controlling', 'controller', 'finance'),
('agile', 'scrum', 'methodology'),
('git', 'github', 'tools'),
('git', 'gitlab', 'tools');

-- Trigger for updated_at
CREATE TRIGGER update_skill_synonyms_updated_at
  BEFORE UPDATE ON public.skill_synonyms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();