// ─── Skills ──────────────────────────────────────────────────────

export const COMMON_SKILLS = [
  // Programming Languages
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'C++', 'Go', 'Rust', 'PHP', 'Ruby',
  'Kotlin', 'Swift', 'Scala', 'R', 'MATLAB', 'Perl', 'Dart', 'Elixir', 'Haskell', 'Lua',
  // Frontend
  'React', 'Angular', 'Vue.js', 'Next.js', 'Nuxt.js', 'Svelte', 'HTML', 'CSS', 'Tailwind CSS',
  'SASS/SCSS', 'Bootstrap', 'Material UI', 'Storybook', 'Webpack', 'Vite',
  // Backend
  'Node.js', 'Express.js', 'NestJS', 'Django', 'Flask', 'FastAPI', 'Spring Boot', 'ASP.NET',
  'Ruby on Rails', 'Laravel', 'Symfony', 'GraphQL', 'REST API', 'gRPC', 'Microservices',
  // Cloud & DevOps
  'AWS', 'Azure', 'Google Cloud', 'Docker', 'Kubernetes', 'Terraform', 'Ansible', 'Jenkins',
  'GitHub Actions', 'GitLab CI', 'CircleCI', 'ArgoCD', 'Helm', 'Prometheus', 'Grafana',
  // Data & AI
  'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Kafka', 'RabbitMQ',
  'Apache Spark', 'Hadoop', 'Airflow', 'dbt', 'Snowflake', 'BigQuery', 'Databricks',
  'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'NLP', 'Computer Vision',
  'LLM', 'RAG', 'Langchain', 'Pandas', 'NumPy', 'Scikit-learn',
  // Enterprise & ERP
  'SAP', 'SAP S/4HANA', 'SAP ABAP', 'SAP Fiori', 'Salesforce', 'ServiceNow', 'Oracle',
  'Microsoft Dynamics', 'Power BI', 'Tableau', 'Looker', 'JIRA', 'Confluence',
  // Security
  'Cybersecurity', 'Penetration Testing', 'SIEM', 'SOC', 'Identity Management', 'OAuth',
  'Zero Trust', 'Compliance', 'GDPR', 'ISO 27001',
  // Mobile
  'React Native', 'Flutter', 'iOS Development', 'Android Development', 'Xamarin',
  // Testing
  'Jest', 'Cypress', 'Selenium', 'Playwright', 'JUnit', 'pytest', 'TDD', 'BDD',
  // Methodologies & Soft Skills
  'Agile', 'Scrum', 'Kanban', 'DevOps', 'CI/CD', 'Git', 'Linux',
  'Projektmanagement', 'Stakeholder Management', 'Teamführung', 'Kommunikation',
  'Anforderungsmanagement', 'Business Analysis', 'Product Management', 'UX Design',
  'UI Design', 'Figma', 'Adobe Creative Suite',
  // Industry-specific
  'Embedded Systems', 'AUTOSAR', 'MATLAB/Simulink', 'PLC Programming', 'SCADA',
  'CAD', 'SolidWorks', 'AutoCAD', 'BIM', 'GMP', 'Regulatory Affairs',
  'Klinische Studien', 'Pharmakovigilanz', 'Medizintechnik', 'Finanzmodellierung',
  'Risikomanagement', 'Controlling', 'Buchhaltung', 'Steuerrecht',
  'Supply Chain Management', 'Logistik', 'Einkauf', 'Qualitätsmanagement',
  'Six Sigma', 'Lean Management', 'ITIL', 'TOGAF',
];

// ─── Languages ───────────────────────────────────────────────────

export const COMMON_LANGUAGES = [
  'Deutsch', 'Englisch', 'Französisch', 'Spanisch', 'Italienisch',
  'Niederländisch', 'Polnisch', 'Tschechisch', 'Türkisch', 'Russisch',
  'Chinesisch (Mandarin)', 'Japanisch', 'Portugiesisch', 'Arabisch', 'Koreanisch',
  'Ungarisch', 'Rumänisch', 'Bulgarisch', 'Kroatisch', 'Serbisch',
  'Griechisch', 'Schwedisch', 'Dänisch', 'Norwegisch', 'Finnisch',
  'Hindi', 'Ukrainisch', 'Hebräisch', 'Vietnamesisch', 'Thai',
];

export const LANGUAGE_LEVELS = [
  { value: 'basic', label: 'Grundkenntnisse (A1-A2)' },
  { value: 'good', label: 'Gute Kenntnisse (B1)' },
  { value: 'fluent', label: 'Fließend (B2-C1)' },
  { value: 'business', label: 'Verhandlungssicher (C1-C2)' },
  { value: 'native', label: 'Muttersprache (C2)' },
];

// ─── Cities ──────────────────────────────────────────────────────

export const GERMAN_CITIES = [
  'Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt am Main', 'Stuttgart',
  'Düsseldorf', 'Leipzig', 'Dortmund', 'Essen', 'Bremen', 'Dresden',
  'Hannover', 'Nürnberg', 'Duisburg', 'Bochum', 'Wuppertal', 'Bielefeld',
  'Bonn', 'Münster', 'Mannheim', 'Karlsruhe', 'Augsburg', 'Wiesbaden',
  'Mönchengladbach', 'Gelsenkirchen', 'Aachen', 'Braunschweig', 'Kiel',
  'Chemnitz', 'Halle (Saale)', 'Magdeburg', 'Freiburg im Breisgau', 'Krefeld',
  'Mainz', 'Lübeck', 'Erfurt', 'Oberhausen', 'Rostock', 'Kassel',
  'Hagen', 'Potsdam', 'Saarbrücken', 'Hamm', 'Ludwigshafen', 'Oldenburg',
  'Osnabrück', 'Leverkusen', 'Heidelberg', 'Darmstadt', 'Solingen', 'Regensburg',
  'Herne', 'Paderborn', 'Neuss', 'Ingolstadt', 'Offenbach am Main', 'Würzburg',
  'Fürth', 'Ulm', 'Heilbronn', 'Pforzheim', 'Wolfsburg', 'Göttingen',
  'Bottrop', 'Reutlingen', 'Koblenz', 'Bremerhaven', 'Erlangen', 'Trier',
  'Remscheid', 'Jena', 'Salzgitter', 'Siegen', 'Gera', 'Hildesheim',
  // Österreich
  'Wien', 'Graz', 'Linz', 'Salzburg', 'Innsbruck',
  // Schweiz
  'Zürich', 'Basel', 'Bern', 'Genf', 'Lausanne',
  // Remote
  'Remote (DACH)', 'Remote (EU)', 'Remote (Weltweit)',
];

// ─── Industries ──────────────────────────────────────────────────

export const INDUSTRIES = [
  { value: 'it_software', label: 'IT & Software' },
  { value: 'automotive', label: 'Automotive & Mobilität' },
  { value: 'mechanical_engineering', label: 'Maschinenbau & Anlagenbau' },
  { value: 'electrical_engineering', label: 'Elektrotechnik & Elektronik' },
  { value: 'pharma_biotech', label: 'Pharma & Biotech' },
  { value: 'medtech', label: 'Medizintechnik' },
  { value: 'healthcare', label: 'Gesundheitswesen' },
  { value: 'finance_banking', label: 'Finanzen & Banking' },
  { value: 'insurance', label: 'Versicherung' },
  { value: 'consulting', label: 'Beratung & Consulting' },
  { value: 'ecommerce', label: 'E-Commerce & Retail' },
  { value: 'logistics', label: 'Logistik & Supply Chain' },
  { value: 'energy', label: 'Energie & Versorgung' },
  { value: 'renewable_energy', label: 'Erneuerbare Energien' },
  { value: 'construction', label: 'Bau & Immobilien' },
  { value: 'chemicals', label: 'Chemie & Werkstoffe' },
  { value: 'food_beverage', label: 'Lebensmittel & Getränke' },
  { value: 'media_entertainment', label: 'Medien & Entertainment' },
  { value: 'telecom', label: 'Telekommunikation' },
  { value: 'aerospace_defense', label: 'Luft- & Raumfahrt / Verteidigung' },
  { value: 'public_sector', label: 'Öffentlicher Sektor' },
  { value: 'education', label: 'Bildung & Forschung' },
  { value: 'legal', label: 'Recht & Steuern' },
  { value: 'hr_staffing', label: 'HR & Personaldienstleistung' },
  { value: 'travel_hospitality', label: 'Tourismus & Gastronomie' },
  { value: 'agriculture', label: 'Agrar & Umwelt' },
  { value: 'textile_fashion', label: 'Textil & Mode' },
  { value: 'gaming', label: 'Gaming & Spieleentwicklung' },
  { value: 'fintech', label: 'FinTech' },
  { value: 'proptech', label: 'PropTech' },
  { value: 'other', label: 'Sonstige' },
];

// ─── Benefits ────────────────────────────────────────────────────

// ─── Benefits (flat arrays kept for backward compat) ────────────

export const BENEFITS_PERMANENT = [
  'Flexible Arbeitszeiten', 'Home Office', 'Firmenwagen', 'Jobticket / ÖPNV-Zuschuss',
  'Betriebliche Altersvorsorge', 'Weiterbildungsbudget', 'Fitnessstudio / Sportangebote',
  'Kantine / Essenszuschuss', 'Sabbatical', 'Kinderbetreuung', '30+ Urlaubstage',
  'Bonus / Tantieme', 'Aktienoptionen / ESOP', 'Firmenlaptop (Privatnutzung)',
  'Firmenhandy', 'Dienstrad / JobRad', 'Mentoring-Programm', 'Team-Events',
  'Gesundheitsmanagement', 'Relocation-Support', 'Workation', 'Dog-friendly Office',
  'Parkplatz', 'VWL (Vermögenswirksame Leistungen)', 'Unfallversicherung',
];

export const BENEFITS_FREELANCE = [
  'Remote möglich', 'Flexible Zeiteinteilung', 'Verlängerungsoption',
  'Modernste Technologie', 'Agiles Umfeld', 'Direkter Kundenkontakt',
  'Referenzprojekt möglich', 'Co-Working Space', 'Equipment gestellt',
  'Reisekostenübernahme', 'Weiterbildung inklusive',
];

// ─── Categorized Benefits for clickable Builder ─────────────────

export interface BenefitCategory {
  id: string;
  label: string;
  icon: string;
  items: string[];
}

export const BENEFITS_CATEGORIZED: BenefitCategory[] = [
  {
    id: 'work_life',
    label: 'Work-Life-Balance',
    icon: '⚖️',
    items: [
      'Flexible Arbeitszeiten', 'Home Office', 'Gleitzeit', '4-Tage-Woche',
      '30+ Urlaubstage', 'Sabbatical', 'Workation', 'Vertrauensarbeitszeit',
      'Teilzeit-Option', 'Kernarbeitszeit frei wählbar',
    ],
  },
  {
    id: 'financial',
    label: 'Vergütung & Finanzen',
    icon: '💰',
    items: [
      'Bonus / Tantieme', 'Aktienoptionen / ESOP', '13. Monatsgehalt',
      'Gewinnbeteiligung', 'VWL (Vermögenswirksame Leistungen)',
      'Betriebliche Altersvorsorge', 'Gehaltserhöhung nach Probezeit',
      'Signing Bonus', 'Inflationsausgleich',
    ],
  },
  {
    id: 'mobility',
    label: 'Mobilität',
    icon: '🚗',
    items: [
      'Firmenwagen', 'Dienstrad / JobRad', 'Jobticket / ÖPNV-Zuschuss',
      'Parkplatz', 'E-Ladesäulen', 'Fahrtkostenzuschuss',
      'Bahncard', 'Carsharing-Zugang',
    ],
  },
  {
    id: 'health',
    label: 'Gesundheit & Sport',
    icon: '🏋️',
    items: [
      'Fitnessstudio / Sportangebote', 'Gesundheitsmanagement',
      'Ergonomischer Arbeitsplatz', 'Mental-Health-Angebote',
      'Betriebsarzt', 'Unfallversicherung', 'Zusatz-Krankenversicherung',
      'Massagen im Büro', 'Obstkorb & gesunde Snacks',
    ],
  },
  {
    id: 'development',
    label: 'Weiterentwicklung',
    icon: '🚀',
    items: [
      'Weiterbildungsbudget', 'Konferenz-Besuche', 'Mentoring-Programm',
      'Interne Akademie', 'Zertifizierungs-Förderung', 'Hackathons',
      'Innovationszeit (20% Projekte)', 'Karrierepfad transparent',
      'Leadership-Programm', 'Auslandseinsätze',
    ],
  },
  {
    id: 'office',
    label: 'Büro & Ausstattung',
    icon: '🏢',
    items: [
      'Firmenlaptop (Privatnutzung)', 'Firmenhandy',
      'Monitore & Peripherie frei wählbar', 'Kantine / Essenszuschuss',
      'Dog-friendly Office', 'Barista-Kaffee', 'Dachterrasse / Lounge',
      'Ruhezonen', 'Gaming Room', 'Co-Working Spaces',
    ],
  },
  {
    id: 'family',
    label: 'Familie & Soziales',
    icon: '👨‍👩‍👧',
    items: [
      'Kinderbetreuung', 'Elternzeit-Zuschuss', 'Familienfreundliche Arbeitszeiten',
      'Pflegefreistellung', 'Geburtstagsfrei', 'Volunteer-Tage',
      'Team-Events', 'Sommerfest & Weihnachtsfeier',
    ],
  },
  {
    id: 'relocation',
    label: 'Onboarding & Relocation',
    icon: '🌍',
    items: [
      'Relocation-Support', 'Visa-Unterstützung', 'Sprachkurse',
      'Buddy-Programm', 'Strukturiertes Onboarding',
      'Welcome Package', 'Wohnungssuchehilfe',
    ],
  },
];

// Quick-add presets for common benefit packages
export const BENEFIT_PRESETS: { label: string; icon: string; benefits: string[] }[] = [
  {
    label: 'Startup-Paket',
    icon: '🦄',
    benefits: [
      'Aktienoptionen / ESOP', 'Flexible Arbeitszeiten', 'Home Office',
      'Weiterbildungsbudget', 'Firmenlaptop (Privatnutzung)', 'Team-Events',
      'Obstkorb & gesunde Snacks', 'Hackathons', 'Innovationszeit (20% Projekte)',
    ],
  },
  {
    label: 'Konzern-Paket',
    icon: '🏛️',
    benefits: [
      'Betriebliche Altersvorsorge', '13. Monatsgehalt', 'Bonus / Tantieme',
      '30+ Urlaubstage', 'Kantine / Essenszuschuss', 'Jobticket / ÖPNV-Zuschuss',
      'Gesundheitsmanagement', 'VWL (Vermögenswirksame Leistungen)', 'Betriebsarzt',
    ],
  },
  {
    label: 'Remote-First',
    icon: '🏠',
    benefits: [
      'Home Office', 'Flexible Arbeitszeiten', 'Firmenlaptop (Privatnutzung)',
      'Monitore & Peripherie frei wählbar', 'Co-Working Spaces', 'Workation',
      'Weiterbildungsbudget', 'Mental-Health-Angebote', 'Team-Events',
    ],
  },
  {
    label: 'Familien-Fokus',
    icon: '👨‍👩‍👧',
    benefits: [
      'Kinderbetreuung', 'Familienfreundliche Arbeitszeiten', 'Teilzeit-Option',
      '30+ Urlaubstage', 'Home Office', 'Geburtstagsfrei', 'Elternzeit-Zuschuss',
      'Pflegefreistellung', 'Betriebliche Altersvorsorge',
    ],
  },
];

// ─── Certifications ──────────────────────────────────────────────

export const CERTIFICATIONS_COMMON = [
  // Cloud
  'AWS Certified Solutions Architect', 'AWS Certified Developer', 'AWS Certified DevOps Engineer',
  'Azure Solutions Architect', 'Azure Developer Associate', 'Azure Administrator',
  'Google Cloud Professional Cloud Architect', 'Google Cloud Professional Data Engineer',
  // Project Management
  'PMP (Project Management Professional)', 'PRINCE2', 'Scrum Master (PSM/CSM)',
  'Product Owner (PSPO/CSPO)', 'SAFe Agilist', 'ITIL Foundation', 'ITIL Expert',
  // Security
  'CISSP', 'CISM', 'CEH (Certified Ethical Hacker)', 'CompTIA Security+',
  'ISO 27001 Lead Auditor',
  // Data
  'Certified Data Engineer', 'Certified Analytics Professional',
  'Databricks Certified', 'Snowflake SnowPro',
  // Software
  'ISTQB (Software Testing)', 'TOGAF', 'Certified Kubernetes Administrator (CKA)',
  'Docker Certified Associate', 'Terraform Associate',
  // SAP
  'SAP Certified Application Associate', 'SAP Certified Technology Associate',
  // Finance
  'CFA (Chartered Financial Analyst)', 'CPA', 'CAIA',
  // Industry
  'Six Sigma Green Belt', 'Six Sigma Black Belt', 'Lean Management',
  'GMP Zertifizierung', 'TÜV Functional Safety',
  'Wirtschaftsprüfer', 'Steuerberater', 'Fachanwalt',
];

// ─── Exclusion Criteria ──────────────────────────────────────────

export const EXCLUSION_PRESETS = [
  'Keine Reisebereitschaft', 'Keine Schichtarbeit', 'Keine Nachtschicht',
  'Keine Rufbereitschaft', 'Keine Zeitarbeit-Erfahrung',
  'Kein Consulting-Hintergrund', 'Keine Berufsanfänger',
  'Kein Wechsel aus gleicher Branche',
  'Keine Freelancer (nur Festanstellung)', 'Keine Konkurrenz-Mitarbeiter',
  'Keine Kandidaten ohne Studium', 'Keine Kandidaten ohne Deutschkenntnisse',
  'Keine Befristung gewünscht', 'Keine Teilzeit möglich',
];

// ─── Interview Templates ─────────────────────────────────────────

export interface InterviewTemplate {
  id: string;
  label: string;
  stages: number;
  description: string;
  steps: string[];
}

export const INTERVIEW_TEMPLATES: InterviewTemplate[] = [
  {
    id: 'standard_2',
    label: 'Standard (2 Runden)',
    stages: 2,
    description: 'Klassischer 2-stufiger Prozess',
    steps: ['Erstgespräch (HR/Hiring Manager)', 'Finalgespräch (Team/GF)'],
  },
  {
    id: 'technical_3',
    label: 'Technisch (3 Runden)',
    stages: 3,
    description: 'Mit technischer Prüfung',
    steps: ['Erstgespräch (HR)', 'Technisches Interview / Live-Coding', 'Finalgespräch (Team/GF)'],
  },
  {
    id: 'executive_4',
    label: 'Executive (4 Runden)',
    stages: 4,
    description: 'Umfassend für Senior/Lead Positionen',
    steps: ['Erstgespräch (HR)', 'Fachgespräch (Abteilungsleitung)', 'Case Study / Präsentation', 'Finalgespräch (Vorstand/GF)'],
  },
  {
    id: 'fast_track',
    label: 'Fast Track (1 Runde)',
    stages: 1,
    description: 'Schnelle Entscheidung in einem Gespräch',
    steps: ['Kombiniertes Gespräch (HR + Fachseite)'],
  },
  {
    id: 'anue_standard',
    label: 'ANÜ Standard (1-2 Runden)',
    stages: 2,
    description: 'Typisch für Zeitarbeit',
    steps: ['Profil-Review durch Disponenten', 'Vorstellungsgespräch beim Entleiher'],
  },
];

// ─── Salary Benchmarks (DE, brutto/Jahr in €) ───────────────────

export interface SalaryBenchmark {
  min: number;
  max: number;
  median: number;
}

export const SALARY_BENCHMARKS: Record<string, SalaryBenchmark> = {
  junior: { min: 38000, max: 52000, median: 45000 },
  mid: { min: 50000, max: 72000, median: 60000 },
  senior: { min: 65000, max: 95000, median: 78000 },
  lead: { min: 80000, max: 120000, median: 95000 },
  director: { min: 100000, max: 160000, median: 125000 },
};

// Daily rates for Freelancers (€/Tag)
export const RATE_BENCHMARKS: Record<string, SalaryBenchmark> = {
  junior: { min: 400, max: 650, median: 520 },
  mid: { min: 600, max: 900, median: 750 },
  senior: { min: 850, max: 1300, median: 1050 },
  lead: { min: 1100, max: 1600, median: 1300 },
  director: { min: 1400, max: 2200, median: 1700 },
};

// ANÜ hourly rates (€/h Verrechnungssatz inkl. Marge)
export const ANUE_RATE_BENCHMARKS: Record<string, SalaryBenchmark> = {
  junior: { min: 25, max: 40, median: 32 },
  mid: { min: 35, max: 55, median: 45 },
  senior: { min: 50, max: 80, median: 62 },
  lead: { min: 65, max: 100, median: 80 },
  director: { min: 80, max: 130, median: 100 },
};

// ─── Coaching Tips ───────────────────────────────────────────────

export interface CoachingTip {
  field: string;
  check: (data: Record<string, unknown>) => boolean;
  message: string;
  impact: string;
}

// Impact percentages aligned with matching_config.weights:
// fit: 60% (skills: 50%=30pt, experience: 30%=18pt, industry: 20%=12pt)
// constraints: 40% (salary: 40%=16pt, commute: 35%=14pt, startDate: 25%=10pt)
// Hard kills: language, visa, onsite — binary pass/fail
export const COACHING_TIPS: CoachingTip[] = [
  {
    field: 'must_haves',
    check: (d) => !Array.isArray(d.must_haves) || (d.must_haves as string[]).length === 0,
    message: 'Must-Have Skills hinzufügen',
    impact: '+30% Fit-Score (Skills)',
  },
  {
    field: 'salary_min',
    check: (d) => d.salary_min === null && d.rate_min === null,
    message: 'Gehalts-/Satzangabe ergänzen',
    impact: '+16% Constraint-Score',
  },
  {
    field: 'experience_years_min',
    check: (d) => d.experience_years_min === null || d.experience_years_min === undefined,
    message: 'Mindesterfahrung angeben',
    impact: '+18% Fit-Score (Erfahrung)',
  },
  {
    field: 'required_languages',
    check: (d) => !Array.isArray(d.required_languages) || (d.required_languages as unknown[]).length === 0,
    message: 'Sprachanforderungen definieren',
    impact: 'Hard Kill Gate',
  },
  {
    field: 'success_profile',
    check: (d) => !d.success_profile,
    message: 'Erfolgsprofil beschreiben',
    impact: '+8% Recruiter-Score',
  },
  {
    field: 'failure_profile',
    check: (d) => !d.failure_profile,
    message: 'Scheiterprofil ergänzen',
    impact: '+8% Recruiter-Score',
  },
  {
    field: 'vacancy_reason',
    check: (d) => !d.vacancy_reason,
    message: 'Vakanz-Grund angeben',
    impact: '+5% Recruiter-Score',
  },
  {
    field: 'interview_process',
    check: (d) => !d.interview_process,
    message: 'Interview-Prozess definieren',
    impact: '+5% Recruiter-Score',
  },
  {
    field: 'company_culture',
    check: (d) => !d.company_culture,
    message: 'Unternehmenskultur beschreiben',
    impact: '+5% Recruiter-Score',
  },
  {
    field: 'description',
    check: (d) => !d.description || (d.description as string).length < 50,
    message: 'Stellenbeschreibung ausführlicher gestalten',
    impact: '+10% Profil-Score',
  },
];
