-- =====================================================
-- VOLLSTÄNDIGE TESTDATEN FÜR 4 KANDIDATEN
-- Thomas Müller, Sarah Schmidt, Anna Hoffmann, Maria Schulz
-- =====================================================

-- Kandidaten IDs
-- Thomas Müller: aaaa1111-1111-1111-1111-111111111111
-- Sarah Schmidt: aaaa2222-2222-2222-2222-222222222222
-- Anna Hoffmann: aaaa6666-6666-6666-6666-666666666666
-- Maria Schulz: aaaa8888-8888-8888-8888-888888888888

-- =====================================================
-- 1. UPDATE KANDIDATEN-BASISDATEN
-- =====================================================

UPDATE public.candidates SET
  job_title = 'Senior Full-Stack Developer',
  company = 'TechCorp GmbH',
  city = 'München',
  current_salary = 85000,
  expected_salary = 95000,
  experience_years = 8,
  skills = ARRAY['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'AWS', 'Docker', 'GraphQL', 'Redis'],
  notice_period = '3 Monate',
  availability_date = '2026-04-01',
  cv_ai_summary = 'Erfahrener Full-Stack Entwickler mit 8+ Jahren Erfahrung in modernen Web-Technologien. Führte mehrere erfolgreiche Migrationsprojekte und Architektur-Modernisierungen durch. Bekannt für sauberen Code und Mentoring-Fähigkeiten.',
  cv_ai_bullets = '["Led migration of legacy monolith to microservices architecture", "Reduced API response times by 60% through optimization", "Mentored team of 5 junior developers", "Implemented CI/CD pipeline reducing deployment time by 80%"]'::jsonb,
  seniority = 'senior',
  remote_preference = 'hybrid',
  summary = 'Technischer Lead mit Fokus auf skalierbare Architekturen und Developer Experience. Sucht eine Position mit mehr strategischem Einfluss und Produktverantwortung.'
WHERE id = 'aaaa1111-1111-1111-1111-111111111111';

UPDATE public.candidates SET
  job_title = 'Frontend Lead',
  company = 'DigitalAgency Berlin',
  city = 'Berlin',
  current_salary = 78000,
  expected_salary = 88000,
  experience_years = 6,
  skills = ARRAY['React', 'Vue.js', 'TypeScript', 'GraphQL', 'Jest', 'Playwright', 'Design Systems', 'Figma'],
  notice_period = '2 Monate',
  availability_date = '2026-03-15',
  cv_ai_summary = 'Frontend-Expertin mit Fokus auf User Experience und moderne UI-Architekturen. Hat erfolgreich ein Design System aufgebaut und ein 4-köpfiges Frontend-Team geleitet.',
  cv_ai_bullets = '["Built component library used across 12+ projects", "Improved Core Web Vitals scores by 40%", "Led accessibility initiative achieving WCAG 2.1 AA compliance", "Speaker at React Berlin Meetup"]'::jsonb,
  seniority = 'senior',
  remote_preference = 'remote',
  summary = 'Leidenschaftliche Frontend-Entwicklerin mit Auge fürs Detail. Sucht ein innovatives Produktunternehmen mit starker Engineering-Kultur.'
WHERE id = 'aaaa2222-2222-2222-2222-222222222222';

UPDATE public.candidates SET
  job_title = 'Senior Data Scientist',
  company = 'DataInsights AG',
  city = 'Frankfurt',
  current_salary = 88000,
  expected_salary = 100000,
  experience_years = 7,
  skills = ARRAY['Python', 'TensorFlow', 'PyTorch', 'SQL', 'Spark', 'Kubernetes', 'MLOps', 'Statistics'],
  notice_period = '3 Monate',
  availability_date = '2026-04-15',
  cv_ai_summary = 'Data Scientist mit PhD in Statistik und starkem Fokus auf produktionsreife ML-Systeme. Entwickelte Fraud Detection Modelle mit 95%+ Accuracy.',
  cv_ai_bullets = '["Developed fraud detection model saving €2M annually", "Built real-time recommendation engine serving 1M+ users", "Published 3 papers in peer-reviewed journals", "Led data science team of 4"]'::jsonb,
  seniority = 'senior',
  remote_preference = 'hybrid',
  summary = 'Sucht eine Rolle mit mehr Impact und der Möglichkeit, ML-Strategie auf Unternehmensebene mitzugestalten.'
WHERE id = 'aaaa6666-6666-6666-6666-666666666666';

UPDATE public.candidates SET
  job_title = 'Senior Product Manager',
  company = 'FinTech Solutions',
  city = 'Hamburg',
  current_salary = 70000,
  expected_salary = 82000,
  experience_years = 5,
  skills = ARRAY['Product Strategy', 'Agile', 'Data Analysis', 'Roadmapping', 'User Research', 'SQL', 'Jira', 'Figma'],
  notice_period = '2 Monate',
  availability_date = '2026-03-01',
  cv_ai_summary = 'Produktorientierte Managerin mit FinTech-Hintergrund. Hat erfolgreich 3 Produkte von 0 auf 1 aufgebaut und den ARR von €500k auf €3M skaliert.',
  cv_ai_bullets = '["Launched 3 products from concept to market", "Increased ARR from €500k to €3M in 2 years", "Reduced customer churn by 35%", "Led cross-functional team of 8"]'::jsonb,
  seniority = 'senior',
  remote_preference = 'hybrid',
  summary = 'Sucht eine Rolle mit mehr Ownership und der Möglichkeit, strategische Produktentscheidungen zu treffen.'
WHERE id = 'aaaa8888-8888-8888-8888-888888888888';

-- =====================================================
-- 2. BERUFSERFAHRUNG (candidate_experiences)
-- =====================================================

-- Alte Einträge löschen
DELETE FROM public.candidate_experiences 
WHERE candidate_id IN (
  'aaaa1111-1111-1111-1111-111111111111',
  'aaaa2222-2222-2222-2222-222222222222',
  'aaaa6666-6666-6666-6666-666666666666',
  'aaaa8888-8888-8888-8888-888888888888'
);

-- Thomas Müller - Erfahrungen
INSERT INTO public.candidate_experiences (candidate_id, company_name, job_title, start_date, end_date, is_current, description, sort_order) VALUES
('aaaa1111-1111-1111-1111-111111111111', 'TechCorp GmbH', 'Senior Full-Stack Developer', '2021-03-01', NULL, true, 
'Technische Leitung eines 8-köpfigen Entwicklerteams. Verantwortlich für Architekturentscheidungen und Code-Qualität. Migration von Monolith zu Microservices-Architektur.', 1),
('aaaa1111-1111-1111-1111-111111111111', 'Startup Hub München', 'Full-Stack Developer', '2018-06-01', '2021-02-28', false, 
'Entwicklung von B2B SaaS-Produkten. Implementierung von REST APIs und React-Frontends. Einführung von automatisierten Tests.', 2),
('aaaa1111-1111-1111-1111-111111111111', 'WebAgency Pro', 'Junior Developer', '2015-09-01', '2018-05-31', false, 
'Kundenwebsites und E-Commerce Projekte. Erste Erfahrungen mit agilen Methoden.', 3);

-- Sarah Schmidt - Erfahrungen
INSERT INTO public.candidate_experiences (candidate_id, company_name, job_title, start_date, end_date, is_current, description, sort_order) VALUES
('aaaa2222-2222-2222-2222-222222222222', 'DigitalAgency Berlin', 'Frontend Lead', '2020-09-01', NULL, true, 
'Leitung des Frontend-Teams (4 Entwickler). Aufbau eines Design Systems. Verantwortlich für Performance und Accessibility.', 1),
('aaaa2222-2222-2222-2222-222222222222', 'E-Commerce Solutions GmbH', 'Senior Frontend Developer', '2018-04-01', '2020-08-31', false, 
'Entwicklung von React-basierten Shop-Frontends. Performance-Optimierung und A/B-Testing.', 2),
('aaaa2222-2222-2222-2222-222222222222', 'Creative Labs Berlin', 'Frontend Developer', '2017-01-01', '2018-03-31', false, 
'Websites und Web-Applikationen für Startups. Erste Erfahrungen mit Vue.js.', 3);

-- Anna Hoffmann - Erfahrungen
INSERT INTO public.candidate_experiences (candidate_id, company_name, job_title, start_date, end_date, is_current, description, sort_order) VALUES
('aaaa6666-6666-6666-6666-666666666666', 'DataInsights AG', 'Senior Data Scientist', '2021-01-01', NULL, true, 
'Entwicklung und Deployment von ML-Modellen für Finanzdienstleister. Teamleitung von 4 Data Scientists. MLOps-Strategie.', 1),
('aaaa6666-6666-6666-6666-666666666666', 'Research Institute Frankfurt', 'Data Scientist', '2018-03-01', '2020-12-31', false, 
'Angewandte Forschung im Bereich Predictive Analytics. Zusammenarbeit mit Industriepartnern.', 2),
('aaaa6666-6666-6666-6666-666666666666', 'Goethe Universität Frankfurt', 'PhD Researcher', '2015-10-01', '2018-02-28', false, 
'Promotion in Statistik mit Fokus auf Machine Learning. 3 peer-reviewed Publikationen.', 3);

-- Maria Schulz - Erfahrungen
INSERT INTO public.candidate_experiences (candidate_id, company_name, job_title, start_date, end_date, is_current, description, sort_order) VALUES
('aaaa8888-8888-8888-8888-888888888888', 'FinTech Solutions Hamburg', 'Senior Product Manager', '2022-02-01', NULL, true, 
'Verantwortlich für B2B Payment-Produkt. Roadmap-Ownership und Stakeholder-Management. ARR von €500k auf €3M gesteigert.', 1),
('aaaa8888-8888-8888-8888-888888888888', 'E-Commerce GmbH', 'Product Manager', '2019-06-01', '2022-01-31', false, 
'Product Discovery und Delivery für Marketplace-Plattform. Churn-Reduktion um 35%.', 2),
('aaaa8888-8888-8888-8888-888888888888', 'Consulting AG', 'Associate Product Manager', '2017-09-01', '2019-05-31', false, 
'Digitalisierungsprojekte für mittelständische Unternehmen. Erste Produkterfahrung.', 3);

-- =====================================================
-- 3. AUSBILDUNG (candidate_educations)
-- =====================================================

-- Alte Einträge löschen
DELETE FROM public.candidate_educations 
WHERE candidate_id IN (
  'aaaa1111-1111-1111-1111-111111111111',
  'aaaa2222-2222-2222-2222-222222222222',
  'aaaa6666-6666-6666-6666-666666666666',
  'aaaa8888-8888-8888-8888-888888888888'
);

INSERT INTO public.candidate_educations (candidate_id, institution, degree, field_of_study, graduation_year, grade, sort_order) VALUES
('aaaa1111-1111-1111-1111-111111111111', 'Technische Universität München', 'M.Sc.', 'Informatik', 2015, '1.3', 1),
('aaaa1111-1111-1111-1111-111111111111', 'Technische Universität München', 'B.Sc.', 'Informatik', 2013, '1.7', 2),
('aaaa2222-2222-2222-2222-222222222222', 'HTW Berlin', 'B.Sc.', 'Medieninformatik', 2017, '1.5', 1),
('aaaa6666-6666-6666-6666-666666666666', 'Goethe Universität Frankfurt', 'Ph.D.', 'Statistik', 2018, 'magna cum laude', 1),
('aaaa6666-6666-6666-6666-666666666666', 'Goethe Universität Frankfurt', 'M.Sc.', 'Statistik', 2015, '1.1', 2),
('aaaa8888-8888-8888-8888-888888888888', 'WHU Otto Beisheim School', 'MBA', 'Business Administration', 2017, '1.4', 1),
('aaaa8888-8888-8888-8888-888888888888', 'Universität Hamburg', 'B.Sc.', 'Wirtschaftswissenschaften', 2015, '1.8', 2);

-- =====================================================
-- 4. INTERVIEW NOTES (candidate_interview_notes)
-- =====================================================

-- Alte Einträge löschen
DELETE FROM public.candidate_interview_notes 
WHERE candidate_id IN (
  'aaaa1111-1111-1111-1111-111111111111',
  'aaaa2222-2222-2222-2222-222222222222',
  'aaaa6666-6666-6666-6666-666666666666',
  'aaaa8888-8888-8888-8888-888888888888'
);

INSERT INTO public.candidate_interview_notes (
  candidate_id, recruiter_id, interview_date, status,
  change_motivation, why_now, current_positive, current_negative,
  salary_current, salary_desired, salary_minimum,
  notice_period, earliest_start_date,
  would_recommend, recommendation_notes,
  summary_motivation, summary_salary, summary_cultural_fit, summary_key_requirements
) VALUES
(
  'aaaa1111-1111-1111-1111-111111111111', 
  '00000000-0000-0000-0000-000000000001',
  '2026-01-10', 'completed',
  'Sucht mehr strategischen Einfluss und Produktverantwortung. Möchte von reiner Entwicklung zu Architektur-Entscheidungen wechseln.',
  'Aktuelles Projekt endet Q1 2026. Firma macht Restrukturierung.',
  'Tolle Kollegen, gutes Gehalt, interessante Technologien',
  'Wenig Innovation, Legacy-Systeme, politische Entscheidungen',
  '85.000 €', '95.000 €', '90.000 €',
  '3 Monate', '2026-04-01',
  true, 'Sehr erfahrener Kandidat mit starkem technischen Background. Klar in seiner Kommunikation, reflektiert über Karriereziele.',
  'Klare Wechselmotivation: Mehr strategischer Einfluss gewünscht', '85k aktuell, 95k gewünscht, flexibel ab 90k', 'Strukturiert, teamorientiert, technisch exzellent', 'Lead-Rolle, moderne Technologien, Produkteinfluss'
),
(
  'aaaa2222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000001', 
  '2026-01-11', 'completed',
  'Agentur-Leben wird zu stressig. Sucht ein Produktunternehmen mit nachhaltiger Entwicklung.',
  'Letzte drei Monate waren besonders stressig. Hat sich Zeit für Reflexion genommen.',
  'Kreative Freiheit, diverse Projekte, tolles Team',
  'Ständiger Deadline-Druck, keine Zeit für Qualität, keine Produktvision',
  '78.000 €', '88.000 €', '82.000 €',
  '2 Monate', '2026-03-15',
  true, 'Sehr talentierte Frontend-Entwicklerin. Design-affin und technisch stark. Perfekt für User-facing Produkte.',
  'Wechsel von Agentur zu Produkt gewünscht', '78k aktuell, 88k gewünscht', 'Kreativ, detailorientiert, User-fokussiert', 'Produktunternehmen, Design System Ownership, Remote-freundlich'
),
(
  'aaaa6666-6666-6666-6666-666666666666',
  '00000000-0000-0000-0000-000000000001',
  '2026-01-09', 'completed',
  'Möchte ML-Strategie auf Unternehmensebene mitgestalten. Sucht mehr Business-Impact.',
  'Hat gerade Paper veröffentlicht und Projekt abgeschlossen. Guter Zeitpunkt für Veränderung.',
  'Forschungsfreiheit, gutes Team, interessante Projekte',
  'Zu weit weg vom Business, wenig Einfluss auf Produktentscheidungen',
  '88.000 €', '100.000 €', '95.000 €',
  '3 Monate', '2026-04-15',
  true, 'Exzellenter technischer Background mit PhD. Sehr strukturiert und analytisch. Gute Präsentationsfähigkeiten.',
  'Mehr Business-Impact gewünscht', '88k aktuell, 100k gewünscht', 'Analytisch, strukturiert, wissenschaftlich', 'ML-Lead Rolle, Business-Nähe, innovative Projekte'
),
(
  'aaaa8888-8888-8888-8888-888888888888',
  '00000000-0000-0000-0000-000000000001',
  '2026-01-08', 'completed',
  'Sucht mehr Ownership und strategische Verantwortung. Möchte von Feature-PM zu Produkt-Lead wechseln.',
  'Firma wurde übernommen, neue Strategie passt nicht zu ihren Karrierezielen.',
  'Gelernt wie man skaliert, starkes Team, gutes Mentoring',
  'Nach Übernahme: Fokus nur noch auf Effizienz, keine Innovation',
  '70.000 €', '82.000 €', '78.000 €',
  '2 Monate', '2026-03-01',
  true, 'Starke PM mit nachweisbaren Erfolgen. Zahlenaffin und gleichzeitig nutzerorientiert. Kommunikationsstark.',
  'Mehr Ownership nach Firmenübernahme gewünscht', '70k aktuell, 82k gewünscht', 'Kommunikativ, zahlenaffin, nutzerorientiert', 'Produkt-Ownership, Strategieeinfluss, Wachstumsumfeld'
);

-- =====================================================
-- 5. CLIENT SUMMARIES (candidate_client_summary)
-- =====================================================

-- Alte Einträge löschen
DELETE FROM public.candidate_client_summary 
WHERE candidate_id IN (
  'aaaa1111-1111-1111-1111-111111111111',
  'aaaa2222-2222-2222-2222-222222222222',
  'aaaa6666-6666-6666-6666-666666666666',
  'aaaa8888-8888-8888-8888-888888888888'
);

-- Finde die Submission IDs
INSERT INTO public.candidate_client_summary (
  candidate_id, submission_id,
  executive_summary, recommendation, recommendation_score,
  key_selling_points, change_motivation_summary,
  risk_factors, positive_factors, job_hopper_analysis,
  generated_at, model_version
)
SELECT 
  c.id as candidate_id,
  s.id as submission_id,
  'Erfahrener Senior Full-Stack Developer mit 8+ Jahren Expertise in modernen Web-Technologien. Hat erfolgreich eine Migration von Monolith zu Microservices geleitet und API-Response-Zeiten um 60% verbessert. Starker technischer Leader mit nachgewiesenen Mentoring-Fähigkeiten.' as executive_summary,
  'strong_yes' as recommendation,
  92 as recommendation_score,
  '["8+ Jahre Full-Stack Erfahrung", "Microservices-Architektur Expertise", "Team-Lead Erfahrung", "AWS & DevOps Know-how"]'::jsonb as key_selling_points,
  'Sucht mehr strategischen Einfluss und Produktverantwortung. Aktuelle Firma durchläuft Restrukturierung - klarer, nachvollziehbarer Wechselgrund.' as change_motivation_summary,
  '[{"factor": "Gehaltserwartung über Budget", "severity": "low", "detail": "95k gewünscht, aber flexibel ab 90k"}, {"factor": "Kündigungsfrist 3 Monate", "severity": "low", "detail": "Standardfrist, planbar"}]'::jsonb as risk_factors,
  '[{"factor": "Technische Exzellenz", "strength": "high", "detail": "Nachgewiesene Performance-Optimierungen und Architektur-Expertise"}, {"factor": "Führungserfahrung", "strength": "high", "detail": "Hat Team von 5 Entwicklern gementort"}, {"factor": "Moderne Tech-Stack", "strength": "medium", "detail": "React, TypeScript, Node.js, AWS - perfekt für moderne Projekte"}]'::jsonb as positive_factors,
  '{"is_job_hopper": false, "avg_tenure_months": 36, "concern_level": "low", "explanation": "Durchschnittliche Verweildauer von 3 Jahren zeigt Stabilität und Loyalität."}'::jsonb as job_hopper_analysis,
  NOW() as generated_at,
  'v2.0' as model_version
FROM public.candidates c
JOIN public.submissions s ON s.candidate_id = c.id
WHERE c.id = 'aaaa1111-1111-1111-1111-111111111111'
LIMIT 1;

INSERT INTO public.candidate_client_summary (
  candidate_id, submission_id,
  executive_summary, recommendation, recommendation_score,
  key_selling_points, change_motivation_summary,
  risk_factors, positive_factors, job_hopper_analysis,
  generated_at, model_version
)
SELECT 
  c.id as candidate_id,
  s.id as submission_id,
  'Talentierte Frontend Lead mit 6 Jahren Erfahrung und starkem Fokus auf User Experience. Hat erfolgreich ein Design System aufgebaut und Core Web Vitals um 40% verbessert. Führungserfahrung mit 4-köpfigem Team.' as executive_summary,
  'yes' as recommendation,
  85 as recommendation_score,
  '["Design System Expertise", "Performance-Optimierung", "Accessibility (WCAG 2.1 AA)", "React & Vue.js Erfahrung"]'::jsonb as key_selling_points,
  'Möchte von Agentur zu Produktunternehmen wechseln für nachhaltigere Entwicklung. Sucht weniger Deadline-Druck und mehr Qualitätsfokus.' as change_motivation_summary,
  '[{"factor": "Remote-Präferenz", "severity": "medium", "detail": "Bevorzugt 100% Remote, hybrid möglich"}, {"factor": "Agentur-Background", "severity": "low", "detail": "Wechsel zu Produktunternehmen - Einarbeitungszeit für Produktdenken"}]'::jsonb as risk_factors,
  '[{"factor": "Design-affin", "strength": "high", "detail": "Starke Brücke zwischen Design und Development"}, {"factor": "Performance-Expertin", "strength": "high", "detail": "Nachweisliche Core Web Vitals Verbesserungen"}, {"factor": "Kommunikationsstark", "strength": "medium", "detail": "Sprecherin bei React Berlin Meetup"}]'::jsonb as positive_factors,
  '{"is_job_hopper": false, "avg_tenure_months": 26, "concern_level": "low", "explanation": "Stabile Karriereentwicklung mit sinnvollen Wechseln für Wachstum."}'::jsonb as job_hopper_analysis,
  NOW() as generated_at,
  'v2.0' as model_version
FROM public.candidates c
JOIN public.submissions s ON s.candidate_id = c.id
WHERE c.id = 'aaaa2222-2222-2222-2222-222222222222'
LIMIT 1;

INSERT INTO public.candidate_client_summary (
  candidate_id, submission_id,
  executive_summary, recommendation, recommendation_score,
  key_selling_points, change_motivation_summary,
  risk_factors, positive_factors, job_hopper_analysis,
  generated_at, model_version
)
SELECT 
  c.id as candidate_id,
  s.id as submission_id,
  'Exzellente Senior Data Scientist mit PhD in Statistik und 7 Jahren Erfahrung. Hat produktionsreife ML-Systeme entwickelt, die €2M jährlich einsparen. Führungserfahrung und peer-reviewed Publikationen.' as executive_summary,
  'strong_yes' as recommendation,
  94 as recommendation_score,
  '["PhD in Statistik", "€2M Fraud Detection ROI", "MLOps-Expertise", "Team-Lead Erfahrung"]'::jsonb as key_selling_points,
  'Möchte ML-Strategie auf Unternehmensebene mitgestalten. Sucht mehr Business-Impact und weniger reine Forschung.' as change_motivation_summary,
  '[{"factor": "Hohe Gehaltserwartung", "severity": "medium", "detail": "100k gewünscht, Minimum 95k - marktgerecht für Profil"}, {"factor": "3 Monate Kündigungsfrist", "severity": "low", "detail": "Planbar, da aktuelles Projekt endet Q2"}]'::jsonb as risk_factors,
  '[{"factor": "Akademische Exzellenz", "strength": "high", "detail": "PhD mit 3 peer-reviewed Publikationen"}, {"factor": "Business Impact", "strength": "high", "detail": "Nachweislicher ROI von €2M durch Fraud Detection"}, {"factor": "MLOps-Erfahrung", "strength": "high", "detail": "Produktionsreife ML-Systeme für 1M+ User"}]'::jsonb as positive_factors,
  '{"is_job_hopper": false, "avg_tenure_months": 32, "concern_level": "low", "explanation": "Sehr stabile Karriere mit logischen Übergängen von Akademie zu Industrie."}'::jsonb as job_hopper_analysis,
  NOW() as generated_at,
  'v2.0' as model_version
FROM public.candidates c
JOIN public.submissions s ON s.candidate_id = c.id
WHERE c.id = 'aaaa6666-6666-6666-6666-666666666666'
LIMIT 1;

INSERT INTO public.candidate_client_summary (
  candidate_id, submission_id,
  executive_summary, recommendation, recommendation_score,
  key_selling_points, change_motivation_summary,
  risk_factors, positive_factors, job_hopper_analysis,
  generated_at, model_version
)
SELECT 
  c.id as candidate_id,
  s.id as submission_id,
  'Erfahrene Senior Product Managerin mit 5 Jahren Erfahrung im FinTech-Bereich. Hat ARR von €500k auf €3M skaliert und Churn um 35% reduziert. Starke Kombination aus analytischen und kommunikativen Fähigkeiten.' as executive_summary,
  'yes' as recommendation,
  87 as recommendation_score,
  '["0-to-1 Produkterfahrung", "ARR von €500k auf €3M", "35% Churn-Reduktion", "FinTech-Expertise"]'::jsonb as key_selling_points,
  'Nach Firmenübernahme sucht sie mehr Ownership und strategische Verantwortung. Klarer Wechselgrund mit nachvollziehbarer Motivation.' as change_motivation_summary,
  '[{"factor": "Kürzere Verweildauer bei letzter Stelle", "severity": "low", "detail": "Wechsel nach 2 Jahren wegen Firmenübernahme - nachvollziehbar"}, {"factor": "FinTech-Fokus", "severity": "low", "detail": "Starker FinTech-Background, aber anpassungsfähig an andere Branchen"}]'::jsonb as risk_factors,
  '[{"factor": "Nachweisbare Erfolge", "strength": "high", "detail": "Konkrete KPIs: ARR-Wachstum, Churn-Reduktion"}, {"factor": "Zahlen-affin", "strength": "high", "detail": "Starke analytische Fähigkeiten mit SQL-Kenntnissen"}, {"factor": "Kommunikationsstark", "strength": "medium", "detail": "Führung von cross-funktionalem Team mit 8 Personen"}]'::jsonb as positive_factors,
  '{"is_job_hopper": false, "avg_tenure_months": 28, "concern_level": "low", "explanation": "Karrierewechsel folgen klarem Aufwärtstrend mit nachvollziehbaren Gründen."}'::jsonb as job_hopper_analysis,
  NOW() as generated_at,
  'v2.0' as model_version
FROM public.candidates c
JOIN public.submissions s ON s.candidate_id = c.id
WHERE c.id = 'aaaa8888-8888-8888-8888-888888888888'
LIMIT 1;