-- =====================================================
-- Fix: Allow clients to READ candidate_experiences
-- for candidates submitted to their jobs
-- =====================================================

-- Clients can view experiences for candidates submitted to their jobs
CREATE POLICY "Clients can view experiences for submitted candidates"
ON public.candidate_experiences FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.submissions s
  JOIN public.jobs j ON j.id = s.job_id
  WHERE s.candidate_id = candidate_experiences.candidate_id
  AND j.client_id = auth.uid()
));

-- =====================================================
-- Seed: candidate_experiences test data
-- =====================================================

-- Clear existing (idempotent)
DELETE FROM public.candidate_experiences
WHERE candidate_id IN (
  'aaaa1111-1111-1111-1111-111111111111',
  'aaaa2222-2222-2222-2222-222222222222',
  'aaaa6666-6666-6666-6666-666666666666',
  'aaaa8888-8888-8888-8888-888888888888',
  'aaaa3333-3333-3333-3333-333333333333',
  'aaaa4444-4444-4444-4444-444444444444',
  'aaaa5555-5555-5555-5555-555555555555'
);

-- Thomas Müller (aaaa1111) - Senior Full-Stack Developer
INSERT INTO public.candidate_experiences (candidate_id, company_name, job_title, start_date, end_date, is_current, description, sort_order) VALUES
('aaaa1111-1111-1111-1111-111111111111', 'TechCorp GmbH', 'Senior Full-Stack Developer', '2021-03-01', NULL, true,
'Technische Leitung eines 8-köpfigen Entwicklerteams. Migration von Monolith zu Microservices.', 1),
('aaaa1111-1111-1111-1111-111111111111', 'Startup Hub München', 'Full-Stack Developer', '2018-06-01', '2021-02-28', false,
'B2B SaaS-Produkte. REST APIs und React-Frontends.', 2),
('aaaa1111-1111-1111-1111-111111111111', 'WebAgency Pro', 'Junior Developer', '2015-09-01', '2018-05-31', false,
'Kundenwebsites und E-Commerce Projekte.', 3);

-- Sarah Schmidt (aaaa2222) - Frontend Lead
INSERT INTO public.candidate_experiences (candidate_id, company_name, job_title, start_date, end_date, is_current, description, sort_order) VALUES
('aaaa2222-2222-2222-2222-222222222222', 'DigitalAgency Berlin', 'Frontend Lead', '2020-09-01', NULL, true,
'Leitung des Frontend-Teams. Aufbau eines Design Systems.', 1),
('aaaa2222-2222-2222-2222-222222222222', 'E-Commerce Solutions GmbH', 'Senior Frontend Developer', '2018-04-01', '2020-08-31', false,
'React-basierte Shop-Frontends. Performance-Optimierung.', 2),
('aaaa2222-2222-2222-2222-222222222222', 'Creative Labs Berlin', 'Frontend Developer', '2017-01-01', '2018-03-31', false,
'Websites und Web-Applikationen für Startups.', 3);

-- Product Manager (aaaa3333)
INSERT INTO public.candidate_experiences (candidate_id, company_name, job_title, start_date, end_date, is_current, description, sort_order) VALUES
('aaaa3333-3333-3333-3333-333333333333', 'SaaS Innovations GmbH', 'Senior Product Manager', '2021-01-01', NULL, true,
'Produktverantwortung für B2B-Plattform mit 50k Nutzern.', 1),
('aaaa3333-3333-3333-3333-333333333333', 'Digital Ventures AG', 'Product Manager', '2018-08-01', '2020-12-31', false,
'Product Discovery und Roadmap-Ownership.', 2),
('aaaa3333-3333-3333-3333-333333333333', 'Beratungshaus Hamburg', 'Business Analyst', '2016-03-01', '2018-07-31', false,
'Anforderungsanalyse und Prozessoptimierung.', 3);

-- UX Designer (aaaa4444)
INSERT INTO public.candidate_experiences (candidate_id, company_name, job_title, start_date, end_date, is_current, description, sort_order) VALUES
('aaaa4444-4444-4444-4444-444444444444', 'Design Studio Berlin', 'Lead UX Designer', '2022-02-01', NULL, true,
'UX-Strategie und Design System für FinTech-Produkt.', 1),
('aaaa4444-4444-4444-4444-444444444444', 'Agentur Kreativ GmbH', 'UX Designer', '2019-06-01', '2022-01-31', false,
'User Research und Prototyping für diverse Kunden.', 2);

-- DevOps Engineer (aaaa5555)
INSERT INTO public.candidate_experiences (candidate_id, company_name, job_title, start_date, end_date, is_current, description, sort_order) VALUES
('aaaa5555-5555-5555-5555-555555555555', 'Cloud Infrastructure AG', 'Senior DevOps Engineer', '2020-04-01', NULL, true,
'Kubernetes-Cluster-Management. CI/CD-Pipelines für 30+ Microservices.', 1),
('aaaa5555-5555-5555-5555-555555555555', 'Hosting Provider GmbH', 'System Administrator', '2017-01-01', '2020-03-31', false,
'Linux-Server-Administration und Monitoring.', 2),
('aaaa5555-5555-5555-5555-555555555555', 'IT-Dienstleister Köln', 'Junior Admin', '2015-06-01', '2016-12-31', false,
'Helpdesk und Netzwerk-Administration.', 3);

-- Anna Hoffmann (aaaa6666) - Data Scientist
INSERT INTO public.candidate_experiences (candidate_id, company_name, job_title, start_date, end_date, is_current, description, sort_order) VALUES
('aaaa6666-6666-6666-6666-666666666666', 'DataInsights AG', 'Senior Data Scientist', '2021-01-01', NULL, true,
'ML-Modelle für Finanzdienstleister. Teamleitung 4 Data Scientists.', 1),
('aaaa6666-6666-6666-6666-666666666666', 'Research Institute Frankfurt', 'Data Scientist', '2018-03-01', '2020-12-31', false,
'Predictive Analytics und Industriekooperationen.', 2),
('aaaa6666-6666-6666-6666-666666666666', 'Goethe Universität Frankfurt', 'PhD Researcher', '2015-10-01', '2018-02-28', false,
'Promotion in Statistik / Machine Learning.', 3);

-- Maria Schulz (aaaa8888) - Senior Product Manager
INSERT INTO public.candidate_experiences (candidate_id, company_name, job_title, start_date, end_date, is_current, description, sort_order) VALUES
('aaaa8888-8888-8888-8888-888888888888', 'FinTech Solutions Hamburg', 'Senior Product Manager', '2022-02-01', NULL, true,
'B2B Payment-Produkt. ARR von €500k auf €3M gesteigert.', 1),
('aaaa8888-8888-8888-8888-888888888888', 'E-Commerce GmbH', 'Product Manager', '2019-06-01', '2022-01-31', false,
'Product Discovery für Marketplace-Plattform. Churn -35%.', 2),
('aaaa8888-8888-8888-8888-888888888888', 'Consulting AG', 'Associate Product Manager', '2017-09-01', '2019-05-31', false,
'Digitalisierungsprojekte für Mittelstand.', 3);
