-- =====================================================
-- V3 MATCHING ENGINE: Big-Tech Style Architecture
-- =====================================================

-- 1. SKILL TAXONOMY TABLE
CREATE TABLE public.skill_taxonomy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name text UNIQUE NOT NULL,
  aliases text[] DEFAULT ARRAY[]::text[],
  category text,
  parent_skill_id uuid REFERENCES public.skill_taxonomy(id),
  related_skills text[] DEFAULT ARRAY[]::text[],
  transferability_from jsonb DEFAULT '{}',
  seniority_weight numeric DEFAULT 1.0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_skill_taxonomy_canonical ON public.skill_taxonomy(canonical_name);
CREATE INDEX idx_skill_taxonomy_category ON public.skill_taxonomy(category);
CREATE INDEX idx_skill_taxonomy_aliases ON public.skill_taxonomy USING GIN(aliases);

ALTER TABLE public.skill_taxonomy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view skill taxonomy"
ON public.skill_taxonomy FOR SELECT USING (true);

CREATE POLICY "Admins can manage skill taxonomy"
ON public.skill_taxonomy FOR ALL USING (has_role(auth.uid(), 'admin'));

-- 2. MATCHING CONFIG TABLE
CREATE TABLE public.matching_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  name text,
  description text,
  weights jsonb NOT NULL DEFAULT '{"fit": 0.60, "constraints": 0.40, "fit_breakdown": {"skills": 0.50, "experience": 0.30, "industry": 0.20}, "constraint_breakdown": {"salary": 0.40, "commute": 0.35, "startDate": 0.25}}',
  gate_thresholds jsonb NOT NULL DEFAULT '{"salary_warn_percent": 15, "salary_fail_percent": 35, "commute_warn_minutes": 45, "commute_fail_minutes": 75, "availability_warn_days": 60, "availability_fail_days": 120}',
  active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_matching_config_active ON public.matching_config(active) WHERE active = true;

ALTER TABLE public.matching_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active matching config"
ON public.matching_config FOR SELECT USING (active = true);

CREATE POLICY "Admins can manage matching configs"
ON public.matching_config FOR ALL USING (has_role(auth.uid(), 'admin'));

-- 3. MATCH OUTCOMES TABLE
CREATE TABLE public.match_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid REFERENCES public.submissions(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  candidate_id uuid REFERENCES public.candidates(id) ON DELETE CASCADE,
  match_version text NOT NULL DEFAULT 'v3',
  predicted_fit_score numeric,
  predicted_constraint_score numeric,
  predicted_overall_score numeric,
  predicted_deal_probability numeric,
  gate_results jsonb DEFAULT '{}',
  actual_outcome text,
  outcome_stage text,
  rejection_reason text,
  rejection_category text,
  days_to_outcome integer,
  created_at timestamptz DEFAULT now(),
  outcome_recorded_at timestamptz
);

CREATE INDEX idx_match_outcomes_submission ON public.match_outcomes(submission_id);
CREATE INDEX idx_match_outcomes_job ON public.match_outcomes(job_id);
CREATE INDEX idx_match_outcomes_outcome ON public.match_outcomes(actual_outcome);
CREATE INDEX idx_match_outcomes_version ON public.match_outcomes(match_version);

ALTER TABLE public.match_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recruiters can view their match outcomes"
ON public.match_outcomes FOR SELECT
USING (EXISTS (SELECT 1 FROM submissions s WHERE s.id = match_outcomes.submission_id AND s.recruiter_id = auth.uid()));

CREATE POLICY "Clients can view match outcomes for their jobs"
ON public.match_outcomes FOR SELECT
USING (EXISTS (SELECT 1 FROM jobs j WHERE j.id = match_outcomes.job_id AND j.client_id = auth.uid()));

CREATE POLICY "Admins can manage all match outcomes"
ON public.match_outcomes FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can manage match outcomes"
ON public.match_outcomes FOR ALL USING (true) WITH CHECK (true);

-- 4. SEED SKILL TAXONOMY
INSERT INTO public.skill_taxonomy (canonical_name, aliases, category, related_skills, transferability_from) VALUES
('JavaScript', ARRAY['JS', 'ECMAScript', 'ES6', 'ES2015']::text[], 'Programming Language', ARRAY['TypeScript', 'Node.js', 'React']::text[], '{"TypeScript": 85}'),
('TypeScript', ARRAY['TS']::text[], 'Programming Language', ARRAY['JavaScript', 'Node.js', 'Angular']::text[], '{"JavaScript": 70}'),
('Python', ARRAY['Python3', 'Py']::text[], 'Programming Language', ARRAY['Django', 'FastAPI', 'Flask']::text[], '{}'),
('Java', ARRAY['Java SE', 'Java EE', 'JDK']::text[], 'Programming Language', ARRAY['Spring', 'Kotlin']::text[], '{"Kotlin": 75, "C#": 60}'),
('C#', ARRAY['CSharp', 'C Sharp', '.NET']::text[], 'Programming Language', ARRAY['.NET', 'ASP.NET']::text[], '{"Java": 65}'),
('Go', ARRAY['Golang']::text[], 'Programming Language', ARRAY['Kubernetes', 'Docker']::text[], '{}'),
('Rust', ARRAY[]::text[], 'Programming Language', ARRAY['C++', 'Systems Programming']::text[], '{"C++": 50}'),
('PHP', ARRAY['PHP7', 'PHP8']::text[], 'Programming Language', ARRAY['Laravel', 'Symfony']::text[], '{}'),
('Ruby', ARRAY[]::text[], 'Programming Language', ARRAY['Rails', 'Ruby on Rails']::text[], '{}'),
('Swift', ARRAY[]::text[], 'Programming Language', ARRAY['iOS', 'Xcode']::text[], '{"Objective-C": 60}'),
('Kotlin', ARRAY[]::text[], 'Programming Language', ARRAY['Android', 'Java']::text[], '{"Java": 75}'),
('React', ARRAY['ReactJS', 'React.js']::text[], 'Frontend Framework', ARRAY['JavaScript', 'TypeScript', 'Redux', 'Next.js']::text[], '{"Vue": 70, "Angular": 55}'),
('Vue', ARRAY['Vue.js', 'VueJS', 'Vue 3']::text[], 'Frontend Framework', ARRAY['JavaScript', 'Nuxt.js']::text[], '{"React": 70, "Angular": 60}'),
('Angular', ARRAY['AngularJS', 'Angular 2+']::text[], 'Frontend Framework', ARRAY['TypeScript', 'RxJS']::text[], '{"React": 55, "Vue": 60}'),
('Next.js', ARRAY['NextJS']::text[], 'Frontend Framework', ARRAY['React', 'Vercel']::text[], '{"React": 90}'),
('Svelte', ARRAY['SvelteKit']::text[], 'Frontend Framework', ARRAY['JavaScript']::text[], '{"React": 60, "Vue": 65}'),
('Node.js', ARRAY['NodeJS', 'Node']::text[], 'Backend Runtime', ARRAY['Express', 'NestJS', 'JavaScript']::text[], '{}'),
('Express', ARRAY['Express.js', 'ExpressJS']::text[], 'Backend Framework', ARRAY['Node.js']::text[], '{"Fastify": 80, "Koa": 75}'),
('NestJS', ARRAY['Nest.js']::text[], 'Backend Framework', ARRAY['Node.js', 'TypeScript']::text[], '{"Express": 70}'),
('Django', ARRAY[]::text[], 'Backend Framework', ARRAY['Python', 'Django REST']::text[], '{"Flask": 70, "FastAPI": 65}'),
('FastAPI', ARRAY[]::text[], 'Backend Framework', ARRAY['Python']::text[], '{"Django": 60, "Flask": 70}'),
('Spring', ARRAY['Spring Boot', 'Spring Framework']::text[], 'Backend Framework', ARRAY['Java', 'Kotlin']::text[], '{}'),
('Laravel', ARRAY[]::text[], 'Backend Framework', ARRAY['PHP']::text[], '{"Symfony": 70}'),
('Rails', ARRAY['Ruby on Rails', 'RoR']::text[], 'Backend Framework', ARRAY['Ruby']::text[], '{}'),
('PostgreSQL', ARRAY['Postgres', 'PG']::text[], 'Database', ARRAY['SQL', 'TimescaleDB']::text[], '{"MySQL": 80, "SQL Server": 70}'),
('MySQL', ARRAY['MariaDB']::text[], 'Database', ARRAY['SQL']::text[], '{"PostgreSQL": 80}'),
('MongoDB', ARRAY['Mongo']::text[], 'Database', ARRAY['NoSQL', 'Mongoose']::text[], '{"DynamoDB": 60}'),
('Redis', ARRAY[]::text[], 'Database', ARRAY['Caching', 'NoSQL']::text[], '{}'),
('Elasticsearch', ARRAY['ES', 'Elastic']::text[], 'Database', ARRAY['Search', 'Kibana']::text[], '{}'),
('AWS', ARRAY['Amazon Web Services']::text[], 'Cloud Platform', ARRAY['EC2', 'S3', 'Lambda']::text[], '{"Azure": 65, "GCP": 60}'),
('Azure', ARRAY['Microsoft Azure']::text[], 'Cloud Platform', ARRAY['Azure DevOps']::text[], '{"AWS": 65, "GCP": 60}'),
('GCP', ARRAY['Google Cloud', 'Google Cloud Platform']::text[], 'Cloud Platform', ARRAY['BigQuery', 'Firebase']::text[], '{"AWS": 60, "Azure": 60}'),
('Docker', ARRAY[]::text[], 'DevOps', ARRAY['Kubernetes', 'Containerization']::text[], '{}'),
('Kubernetes', ARRAY['K8s']::text[], 'DevOps', ARRAY['Docker', 'Helm']::text[], '{}'),
('Terraform', ARRAY['TF']::text[], 'DevOps', ARRAY['Infrastructure as Code', 'AWS']::text[], '{"Pulumi": 70, "CloudFormation": 65}'),
('CI/CD', ARRAY['Continuous Integration', 'Continuous Deployment']::text[], 'DevOps', ARRAY['Jenkins', 'GitHub Actions', 'GitLab CI']::text[], '{}'),
('Machine Learning', ARRAY['ML']::text[], 'Data Science', ARRAY['Python', 'TensorFlow', 'PyTorch']::text[], '{}'),
('Data Science', ARRAY['Data Analytics']::text[], 'Data Science', ARRAY['Python', 'R', 'SQL']::text[], '{}'),
('TensorFlow', ARRAY['TF AI']::text[], 'AI Framework', ARRAY['Python', 'Machine Learning']::text[], '{"PyTorch": 70}'),
('PyTorch', ARRAY[]::text[], 'AI Framework', ARRAY['Python', 'Machine Learning']::text[], '{"TensorFlow": 70}'),
('iOS Development', ARRAY['iOS', 'iPhone Development']::text[], 'Mobile', ARRAY['Swift', 'Objective-C', 'Xcode']::text[], '{}'),
('Android Development', ARRAY['Android']::text[], 'Mobile', ARRAY['Kotlin', 'Java']::text[], '{}'),
('React Native', ARRAY['RN']::text[], 'Mobile', ARRAY['React', 'JavaScript', 'Mobile']::text[], '{"Flutter": 55}'),
('Flutter', ARRAY[]::text[], 'Mobile', ARRAY['Dart', 'Mobile']::text[], '{"React Native": 55}'),
('Microservices', ARRAY['Microservice Architecture']::text[], 'Architecture', ARRAY['Docker', 'Kubernetes', 'API']::text[], '{}'),
('REST API', ARRAY['RESTful', 'REST']::text[], 'Architecture', ARRAY['API Design', 'HTTP']::text[], '{"GraphQL": 50}'),
('GraphQL', ARRAY[]::text[], 'Architecture', ARRAY['API', 'Apollo']::text[], '{"REST API": 50}'),
('Agile', ARRAY['Scrum', 'Kanban']::text[], 'Methodology', ARRAY['Sprint', 'Product Management']::text[], '{}'),
('TDD', ARRAY['Test-Driven Development']::text[], 'Methodology', ARRAY['Unit Testing', 'Jest']::text[], '{}'),
('SQL', ARRAY['Structured Query Language']::text[], 'Database', ARRAY['PostgreSQL', 'MySQL']::text[], '{}'),
('SAP', ARRAY['SAP ERP', 'SAP S/4HANA']::text[], 'Enterprise', ARRAY['ABAP', 'SAP HANA']::text[], '{}'),
('Salesforce', ARRAY['SFDC', 'Salesforce CRM']::text[], 'Enterprise', ARRAY['Apex', 'Lightning']::text[], '{}');

-- 5. SEED DEFAULT MATCHING CONFIG
INSERT INTO public.matching_config (version, name, description, active, weights, gate_thresholds) VALUES
('v3.0', 'Default V3 Config', 'Initial production config for V3 matching engine', true,
'{"fit": 0.60, "constraints": 0.40, "fit_breakdown": {"skills": 0.50, "experience": 0.30, "industry": 0.20}, "constraint_breakdown": {"salary": 0.40, "commute": 0.35, "startDate": 0.25}}',
'{"salary_warn_percent": 15, "salary_fail_percent": 35, "commute_warn_minutes": 45, "commute_fail_minutes": 75, "availability_warn_days": 60, "availability_fail_days": 120, "min_skill_match_percent": 30}');