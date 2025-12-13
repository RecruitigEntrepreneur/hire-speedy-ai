import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🚀 Starting complete data seed...');

    // Step 1: Get Leon (client) and Marko (recruiter)
    const LEON_EMAIL = 'leon.benko92@gmail.com';
    const MARKO_EMAIL = 'marko.benko@malmalhigh.de';
    
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, email, full_name')
      .in('email', [LEON_EMAIL, MARKO_EMAIL]);

    const leon = profiles?.find(p => p.email === LEON_EMAIL);
    const marko = profiles?.find(p => p.email === MARKO_EMAIL);

    if (!leon || !marko) {
      throw new Error('Leon or Marko not found in profiles');
    }

    console.log(`✅ Found Leon: ${leon.user_id}, Marko: ${marko.user_id}`);

    // Step 2: Get Leon's jobs and reduce to 5
    const { data: leonJobs } = await supabase
      .from('jobs')
      .select('id, title')
      .eq('client_id', leon.user_id)
      .order('created_at', { ascending: true });

    console.log(`📋 Leon has ${leonJobs?.length || 0} jobs`);

    // Keep first 5 jobs, delete the rest
    const jobsToKeep = leonJobs?.slice(0, 5) || [];
    const jobsToDelete = leonJobs?.slice(5) || [];

    if (jobsToDelete.length > 0) {
      // First delete related submissions
      const deleteJobIds = jobsToDelete.map(j => j.id);
      await supabase.from('submissions').delete().in('job_id', deleteJobIds);
      await supabase.from('jobs').delete().in('id', deleteJobIds);
      console.log(`🗑️ Deleted ${jobsToDelete.length} jobs`);
    }

    // Update remaining 5 jobs with clear titles
    const jobTitles = [
      { title: 'Senior Frontend Developer', department: 'Engineering', employment_type: 'permanent', seniority_level: 'senior', salary_min: 70000, salary_max: 95000, remote_policy: 'hybrid' },
      { title: 'DevOps Engineer', department: 'Infrastructure', employment_type: 'permanent', seniority_level: 'senior', salary_min: 75000, salary_max: 100000, remote_policy: 'remote' },
      { title: 'Product Manager', department: 'Product', employment_type: 'permanent', seniority_level: 'mid', salary_min: 65000, salary_max: 85000, remote_policy: 'hybrid' },
      { title: 'Data Engineer', department: 'Data', employment_type: 'permanent', seniority_level: 'senior', salary_min: 70000, salary_max: 95000, remote_policy: 'hybrid' },
      { title: 'UX/UI Designer', department: 'Design', employment_type: 'permanent', seniority_level: 'mid', salary_min: 55000, salary_max: 75000, remote_policy: 'onsite' },
    ];

    for (let i = 0; i < jobsToKeep.length && i < jobTitles.length; i++) {
      await supabase
        .from('jobs')
        .update({
          title: jobTitles[i].title,
          department: jobTitles[i].department,
          employment_type: jobTitles[i].employment_type,
          seniority_level: jobTitles[i].seniority_level,
          salary_min: jobTitles[i].salary_min,
          salary_max: jobTitles[i].salary_max,
          remote_policy: jobTitles[i].remote_policy,
          status: 'published',
        })
        .eq('id', jobsToKeep[i].id);
    }
    console.log(`✅ Updated ${jobsToKeep.length} jobs with clear titles`);

    // Step 3: Delete test candidates and old data
    await supabase.from('candidates').delete().ilike('full_name', '%Test%');
    await supabase.from('candidates').delete().ilike('full_name', '%Kandi%');

    // Step 4: Create 10 complete candidate profiles under Marko
    const candidatesData = [
      {
        full_name: 'Anna Weber',
        email: 'anna.weber@example.com',
        phone: '+49 176 12345001',
        job_title: 'Senior Frontend Developer',
        company: 'TechStartup GmbH',
        city: 'Berlin',
        experience_years: 7,
        current_salary: 72000,
        expected_salary: 88000,
        salary_expectation_min: 82000,
        salary_expectation_max: 95000,
        notice_period: '3 Monate',
        work_model: 'hybrid',
        remote_days_preferred: 3,
        seniority: 'senior',
        skills: ['React', 'TypeScript', 'Node.js', 'GraphQL', 'AWS'],
        linkedin_url: 'https://linkedin.com/in/anna-weber',
        summary: 'Erfahrene Frontend-Entwicklerin mit Fokus auf React und TypeScript. Leidenschaftlich für Clean Code und User Experience.',
      },
      {
        full_name: 'Thomas Schmidt',
        email: 'thomas.schmidt@example.com',
        phone: '+49 176 12345002',
        job_title: 'DevOps Engineer',
        company: 'CloudScale AG',
        city: 'München',
        experience_years: 6,
        current_salary: 78000,
        expected_salary: 92000,
        salary_expectation_min: 85000,
        salary_expectation_max: 100000,
        notice_period: '3 Monate',
        work_model: 'remote',
        remote_days_preferred: 5,
        seniority: 'senior',
        skills: ['Kubernetes', 'Docker', 'Terraform', 'AWS', 'CI/CD'],
        linkedin_url: 'https://linkedin.com/in/thomas-schmidt',
        summary: 'DevOps Engineer mit tiefem Verständnis für Cloud-Infrastrukturen und Automatisierung.',
      },
      {
        full_name: 'Julia Müller',
        email: 'julia.mueller@example.com',
        phone: '+49 176 12345003',
        job_title: 'Product Manager',
        company: 'SaaS Solutions GmbH',
        city: 'Hamburg',
        experience_years: 5,
        current_salary: 68000,
        expected_salary: 82000,
        salary_expectation_min: 75000,
        salary_expectation_max: 88000,
        notice_period: '2 Monate',
        work_model: 'hybrid',
        remote_days_preferred: 2,
        seniority: 'mid',
        skills: ['Agile', 'Scrum', 'JIRA', 'Product Strategy', 'User Research'],
        linkedin_url: 'https://linkedin.com/in/julia-mueller',
        summary: 'Produktmanagerin mit starkem Fokus auf B2B SaaS und datengetriebene Entscheidungen.',
      },
      {
        full_name: 'Michael Braun',
        email: 'michael.braun@example.com',
        phone: '+49 176 12345004',
        job_title: 'Data Engineer',
        company: 'DataDriven Inc.',
        city: 'Frankfurt',
        experience_years: 6,
        current_salary: 75000,
        expected_salary: 90000,
        salary_expectation_min: 82000,
        salary_expectation_max: 95000,
        notice_period: '3 Monate',
        work_model: 'hybrid',
        remote_days_preferred: 3,
        seniority: 'senior',
        skills: ['Python', 'Apache Spark', 'Airflow', 'SQL', 'Snowflake'],
        linkedin_url: 'https://linkedin.com/in/michael-braun',
        summary: 'Data Engineer mit Expertise in Big Data Pipelines und Cloud Data Warehouses.',
      },
      {
        full_name: 'Sarah Fischer',
        email: 'sarah.fischer@example.com',
        phone: '+49 176 12345005',
        job_title: 'UX/UI Designer',
        company: 'DesignStudio Berlin',
        city: 'Berlin',
        experience_years: 4,
        current_salary: 58000,
        expected_salary: 70000,
        salary_expectation_min: 65000,
        salary_expectation_max: 75000,
        notice_period: '6 Wochen',
        work_model: 'onsite',
        remote_days_preferred: 1,
        seniority: 'mid',
        skills: ['Figma', 'Adobe XD', 'User Research', 'Prototyping', 'Design Systems'],
        linkedin_url: 'https://linkedin.com/in/sarah-fischer',
        summary: 'Kreative UX/UI Designerin mit Liebe zum Detail und nutzerzentriertem Denken.',
      },
      {
        full_name: 'Maximilian Koch',
        email: 'max.koch@example.com',
        phone: '+49 176 12345006',
        job_title: 'Full-Stack Developer',
        company: 'WebFactory GmbH',
        city: 'Köln',
        experience_years: 5,
        current_salary: 65000,
        expected_salary: 78000,
        salary_expectation_min: 72000,
        salary_expectation_max: 85000,
        notice_period: '3 Monate',
        work_model: 'hybrid',
        remote_days_preferred: 2,
        seniority: 'mid',
        skills: ['React', 'Node.js', 'PostgreSQL', 'TypeScript', 'Docker'],
        linkedin_url: 'https://linkedin.com/in/max-koch',
        summary: 'Full-Stack Entwickler mit breitem Technologiespektrum und Startup-Erfahrung.',
      },
      {
        full_name: 'Laura Hoffmann',
        email: 'laura.hoffmann@example.com',
        phone: '+49 176 12345007',
        job_title: 'Backend Developer',
        company: 'Enterprise Systems AG',
        city: 'Stuttgart',
        experience_years: 8,
        current_salary: 82000,
        expected_salary: 95000,
        salary_expectation_min: 88000,
        salary_expectation_max: 105000,
        notice_period: '3 Monate',
        work_model: 'hybrid',
        remote_days_preferred: 3,
        seniority: 'senior',
        skills: ['Java', 'Spring Boot', 'Microservices', 'Kafka', 'PostgreSQL'],
        linkedin_url: 'https://linkedin.com/in/laura-hoffmann',
        summary: 'Erfahrene Backend-Entwicklerin mit Fokus auf skalierbare Microservices-Architekturen.',
      },
      {
        full_name: 'Daniel Wagner',
        email: 'daniel.wagner@example.com',
        phone: '+49 176 12345008',
        job_title: 'Cloud Architect',
        company: 'CloudFirst Consulting',
        city: 'Düsseldorf',
        experience_years: 9,
        current_salary: 95000,
        expected_salary: 115000,
        salary_expectation_min: 105000,
        salary_expectation_max: 125000,
        notice_period: '3 Monate',
        work_model: 'remote',
        remote_days_preferred: 5,
        seniority: 'senior',
        skills: ['AWS', 'Azure', 'GCP', 'Terraform', 'Architecture'],
        linkedin_url: 'https://linkedin.com/in/daniel-wagner',
        summary: 'Cloud Architect mit Multi-Cloud Expertise und Erfahrung in Enterprise-Transformationen.',
      },
      {
        full_name: 'Felix Klein',
        email: 'felix.klein@example.com',
        phone: '+49 176 12345009',
        job_title: 'Frontend Developer',
        company: 'Agentur Digital',
        city: 'Leipzig',
        experience_years: 3,
        current_salary: 52000,
        expected_salary: 62000,
        salary_expectation_min: 58000,
        salary_expectation_max: 68000,
        notice_period: '6 Wochen',
        work_model: 'hybrid',
        remote_days_preferred: 2,
        seniority: 'mid',
        skills: ['Vue.js', 'TypeScript', 'Tailwind', 'Nuxt', 'JavaScript'],
        linkedin_url: 'https://linkedin.com/in/felix-klein',
        summary: 'Aufstrebender Frontend-Entwickler mit Fokus auf Vue.js und moderne Web-Technologien.',
      },
      {
        full_name: 'Maria Schulz',
        email: 'maria.schulz@example.com',
        phone: '+49 176 12345010',
        job_title: 'Engineering Manager',
        company: 'TechCorp International',
        city: 'Berlin',
        experience_years: 12,
        current_salary: 110000,
        expected_salary: 130000,
        salary_expectation_min: 120000,
        salary_expectation_max: 145000,
        notice_period: '3 Monate',
        work_model: 'hybrid',
        remote_days_preferred: 2,
        seniority: 'senior',
        skills: ['Team Leadership', 'Agile', 'Technical Strategy', 'Hiring', 'Mentoring'],
        linkedin_url: 'https://linkedin.com/in/maria-schulz',
        summary: 'Engineering Manager mit 12 Jahren Erfahrung in Tech-Leadership und Teamaufbau.',
      },
    ];

    // Delete existing candidates first
    await supabase.from('candidates').delete().eq('recruiter_id', marko.user_id);
    console.log('🗑️ Deleted existing candidates');

    // Insert new candidates
    const candidateInserts = candidatesData.map(c => ({
      ...c,
      recruiter_id: marko.user_id,
      candidate_status: 'active',
      availability_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    }));

    const { data: insertedCandidates, error: candidateError } = await supabase
      .from('candidates')
      .insert(candidateInserts)
      .select();

    if (candidateError) {
      console.error('Candidate insert error:', candidateError);
      throw candidateError;
    }

    console.log(`✅ Created ${insertedCandidates?.length} candidates`);

    // Step 5: Create experiences, educations, skills, languages, projects for each candidate
    const experiencesData = [
      // Anna Weber
      [
        { company_name: 'TechStartup GmbH', job_title: 'Senior Frontend Developer', start_date: '2021-03-01', is_current: true, location: 'Berlin', description: 'Lead Frontend Development mit React und TypeScript. Aufbau eines Design Systems und Mentoring von Junior-Entwicklern.' },
        { company_name: 'WebAgency Berlin', job_title: 'Frontend Developer', start_date: '2018-06-01', end_date: '2021-02-28', location: 'Berlin', description: 'Entwicklung von Kundenwebsites mit React, Vue.js und WordPress.' },
        { company_name: 'Digital Solutions GmbH', job_title: 'Junior Developer', start_date: '2016-09-01', end_date: '2018-05-31', location: 'Potsdam', description: 'Einstieg in die Webentwicklung mit JavaScript und PHP.' },
      ],
      // Thomas Schmidt
      [
        { company_name: 'CloudScale AG', job_title: 'DevOps Engineer', start_date: '2020-01-15', is_current: true, location: 'München', description: 'Aufbau und Wartung von Kubernetes-Clustern, CI/CD Pipelines und Infrastructure as Code.' },
        { company_name: 'ITSystemhaus München', job_title: 'System Administrator', start_date: '2017-04-01', end_date: '2019-12-31', location: 'München', description: 'Verwaltung von Linux-Servern und Einführung von Docker.' },
        { company_name: 'Consulting Partners', job_title: 'IT Consultant', start_date: '2015-08-01', end_date: '2017-03-31', location: 'Nürnberg', description: 'IT-Beratung für mittelständische Unternehmen.' },
      ],
      // Julia Müller
      [
        { company_name: 'SaaS Solutions GmbH', job_title: 'Product Manager', start_date: '2021-06-01', is_current: true, location: 'Hamburg', description: 'Produktverantwortung für B2B SaaS Plattform mit 50k+ Nutzern.' },
        { company_name: 'E-Commerce Startup', job_title: 'Associate Product Manager', start_date: '2019-02-01', end_date: '2021-05-31', location: 'Hamburg', description: 'Produktentwicklung im E-Commerce Bereich.' },
        { company_name: 'Beratungsfirma XY', job_title: 'Business Analyst', start_date: '2017-09-01', end_date: '2019-01-31', location: 'Hamburg', description: 'Anforderungsanalyse und Projektmanagement.' },
      ],
      // Michael Braun
      [
        { company_name: 'DataDriven Inc.', job_title: 'Data Engineer', start_date: '2020-09-01', is_current: true, location: 'Frankfurt', description: 'Aufbau von Data Pipelines mit Spark und Airflow für Real-Time Analytics.' },
        { company_name: 'Analytics GmbH', job_title: 'Data Analyst', start_date: '2018-03-01', end_date: '2020-08-31', location: 'Frankfurt', description: 'Datenanalyse und Reporting mit Python und SQL.' },
        { company_name: 'Fintech Startup', job_title: 'Junior Data Engineer', start_date: '2016-07-01', end_date: '2018-02-28', location: 'Darmstadt', description: 'Erste Erfahrungen mit Big Data Technologien.' },
      ],
      // Sarah Fischer
      [
        { company_name: 'DesignStudio Berlin', job_title: 'UX/UI Designer', start_date: '2021-04-01', is_current: true, location: 'Berlin', description: 'Design von Web- und Mobile-Applikationen für diverse Kunden.' },
        { company_name: 'Creative Agency', job_title: 'UI Designer', start_date: '2019-08-01', end_date: '2021-03-31', location: 'Berlin', description: 'UI Design für E-Commerce und Corporate Websites.' },
        { company_name: 'Freelance', job_title: 'Graphic Designer', start_date: '2018-01-01', end_date: '2019-07-31', location: 'Berlin', description: 'Freelance Grafikdesign für Startups.' },
      ],
      // Maximilian Koch
      [
        { company_name: 'WebFactory GmbH', job_title: 'Full-Stack Developer', start_date: '2020-02-01', is_current: true, location: 'Köln', description: 'Entwicklung von Webanwendungen mit React und Node.js.' },
        { company_name: 'Digitalagentur Köln', job_title: 'Web Developer', start_date: '2018-06-01', end_date: '2020-01-31', location: 'Köln', description: 'Frontend- und Backend-Entwicklung.' },
        { company_name: 'Startup Bonn', job_title: 'Working Student', start_date: '2016-10-01', end_date: '2018-05-31', location: 'Bonn', description: 'Werkstudent in der Webentwicklung.' },
      ],
      // Laura Hoffmann
      [
        { company_name: 'Enterprise Systems AG', job_title: 'Backend Developer', start_date: '2019-04-01', is_current: true, location: 'Stuttgart', description: 'Entwicklung von Microservices mit Java und Spring Boot.' },
        { company_name: 'Software AG', job_title: 'Java Developer', start_date: '2016-03-01', end_date: '2019-03-31', location: 'Stuttgart', description: 'Java-Entwicklung für Enterprise-Anwendungen.' },
        { company_name: 'IT-Dienstleister', job_title: 'Junior Developer', start_date: '2014-09-01', end_date: '2016-02-29', location: 'Karlsruhe', description: 'Einstieg in die Java-Entwicklung.' },
      ],
      // Daniel Wagner
      [
        { company_name: 'CloudFirst Consulting', job_title: 'Cloud Architect', start_date: '2020-06-01', is_current: true, location: 'Düsseldorf', description: 'Architektur und Migration von Enterprise-Workloads in die Cloud.' },
        { company_name: 'Global Tech Corp', job_title: 'Senior DevOps Engineer', start_date: '2017-01-01', end_date: '2020-05-31', location: 'Düsseldorf', description: 'DevOps Leadership und Cloud-Transformation.' },
        { company_name: 'Mittelstand IT', job_title: 'System Engineer', start_date: '2013-08-01', end_date: '2016-12-31', location: 'Essen', description: 'Systemadministration und erste Cloud-Projekte.' },
      ],
      // Felix Klein
      [
        { company_name: 'Agentur Digital', job_title: 'Frontend Developer', start_date: '2022-03-01', is_current: true, location: 'Leipzig', description: 'Vue.js Entwicklung für Kundenprojekte.' },
        { company_name: 'Web Startup Leipzig', job_title: 'Junior Developer', start_date: '2020-09-01', end_date: '2022-02-28', location: 'Leipzig', description: 'Erste Berufserfahrung in der Webentwicklung.' },
      ],
      // Maria Schulz
      [
        { company_name: 'TechCorp International', job_title: 'Engineering Manager', start_date: '2020-01-01', is_current: true, location: 'Berlin', description: 'Führung eines 15-köpfigen Engineering-Teams.' },
        { company_name: 'Scale-Up Berlin', job_title: 'Tech Lead', start_date: '2016-06-01', end_date: '2019-12-31', location: 'Berlin', description: 'Technische Leitung und Teamaufbau.' },
        { company_name: 'Startup Factory', job_title: 'Senior Developer', start_date: '2012-03-01', end_date: '2016-05-31', location: 'Berlin', description: 'Full-Stack Entwicklung und erste Führungsaufgaben.' },
      ],
    ];

    const educationsData = [
      [{ institution: 'Technische Universität Berlin', degree: 'Bachelor of Science', field_of_study: 'Informatik', graduation_year: 2016, grade: '1.8' }],
      [{ institution: 'Hochschule München', degree: 'Bachelor of Engineering', field_of_study: 'Wirtschaftsinformatik', graduation_year: 2015, grade: '2.0' }],
      [{ institution: 'Universität Hamburg', degree: 'Master of Science', field_of_study: 'Business Administration', graduation_year: 2017, grade: '1.5' }, { institution: 'Universität Hamburg', degree: 'Bachelor of Science', field_of_study: 'BWL', graduation_year: 2015, grade: '1.9' }],
      [{ institution: 'Goethe-Universität Frankfurt', degree: 'Master of Science', field_of_study: 'Data Science', graduation_year: 2016, grade: '1.3' }],
      [{ institution: 'Universität der Künste Berlin', degree: 'Bachelor of Arts', field_of_study: 'Kommunikationsdesign', graduation_year: 2018, grade: '1.7' }],
      [{ institution: 'Universität Köln', degree: 'Bachelor of Science', field_of_study: 'Medieninformatik', graduation_year: 2018, grade: '2.1' }],
      [{ institution: 'Universität Stuttgart', degree: 'Master of Science', field_of_study: 'Softwaretechnik', graduation_year: 2014, grade: '1.4' }],
      [{ institution: 'RWTH Aachen', degree: 'Master of Science', field_of_study: 'Informatik', graduation_year: 2013, grade: '1.2' }, { institution: 'RWTH Aachen', degree: 'Bachelor of Science', field_of_study: 'Informatik', graduation_year: 2011, grade: '1.6' }],
      [{ institution: 'Universität Leipzig', degree: 'Bachelor of Science', field_of_study: 'Informatik', graduation_year: 2020, grade: '2.0' }],
      [{ institution: 'Freie Universität Berlin', degree: 'Diplom', field_of_study: 'Informatik', graduation_year: 2010, grade: '1.3' }],
    ];

    const skillsData = [
      // Anna Weber
      [
        { skill_name: 'React', category: 'frontend', level: 'expert' },
        { skill_name: 'TypeScript', category: 'frontend', level: 'expert' },
        { skill_name: 'JavaScript', category: 'frontend', level: 'expert' },
        { skill_name: 'CSS/SCSS', category: 'frontend', level: 'senior' },
        { skill_name: 'Tailwind', category: 'frontend', level: 'senior' },
        { skill_name: 'Node.js', category: 'backend', level: 'mid' },
        { skill_name: 'GraphQL', category: 'backend', level: 'senior' },
        { skill_name: 'REST APIs', category: 'backend', level: 'senior' },
        { skill_name: 'Git', category: 'tools', level: 'expert' },
        { skill_name: 'Jest', category: 'testing', level: 'senior' },
        { skill_name: 'Cypress', category: 'testing', level: 'mid' },
        { skill_name: 'AWS', category: 'cloud', level: 'mid' },
      ],
      // Thomas Schmidt
      [
        { skill_name: 'Kubernetes', category: 'devops', level: 'expert' },
        { skill_name: 'Docker', category: 'devops', level: 'expert' },
        { skill_name: 'Terraform', category: 'devops', level: 'senior' },
        { skill_name: 'AWS', category: 'cloud', level: 'expert' },
        { skill_name: 'Azure', category: 'cloud', level: 'mid' },
        { skill_name: 'CI/CD', category: 'devops', level: 'expert' },
        { skill_name: 'Jenkins', category: 'devops', level: 'senior' },
        { skill_name: 'GitHub Actions', category: 'devops', level: 'senior' },
        { skill_name: 'Linux', category: 'systems', level: 'expert' },
        { skill_name: 'Python', category: 'backend', level: 'mid' },
        { skill_name: 'Bash', category: 'systems', level: 'senior' },
        { skill_name: 'Prometheus', category: 'monitoring', level: 'senior' },
      ],
      // Julia Müller
      [
        { skill_name: 'Agile/Scrum', category: 'methodology', level: 'expert' },
        { skill_name: 'JIRA', category: 'tools', level: 'expert' },
        { skill_name: 'Confluence', category: 'tools', level: 'senior' },
        { skill_name: 'Product Strategy', category: 'product', level: 'senior' },
        { skill_name: 'User Research', category: 'product', level: 'senior' },
        { skill_name: 'A/B Testing', category: 'product', level: 'mid' },
        { skill_name: 'SQL', category: 'data', level: 'mid' },
        { skill_name: 'Figma', category: 'design', level: 'mid' },
        { skill_name: 'Stakeholder Management', category: 'soft-skills', level: 'senior' },
        { skill_name: 'Roadmap Planning', category: 'product', level: 'senior' },
      ],
      // Michael Braun
      [
        { skill_name: 'Python', category: 'backend', level: 'expert' },
        { skill_name: 'Apache Spark', category: 'data', level: 'expert' },
        { skill_name: 'Airflow', category: 'data', level: 'senior' },
        { skill_name: 'SQL', category: 'data', level: 'expert' },
        { skill_name: 'Snowflake', category: 'data', level: 'senior' },
        { skill_name: 'AWS', category: 'cloud', level: 'senior' },
        { skill_name: 'Kafka', category: 'data', level: 'mid' },
        { skill_name: 'dbt', category: 'data', level: 'senior' },
        { skill_name: 'Databricks', category: 'data', level: 'mid' },
        { skill_name: 'PostgreSQL', category: 'database', level: 'senior' },
      ],
      // Sarah Fischer
      [
        { skill_name: 'Figma', category: 'design', level: 'expert' },
        { skill_name: 'Adobe XD', category: 'design', level: 'senior' },
        { skill_name: 'Sketch', category: 'design', level: 'mid' },
        { skill_name: 'User Research', category: 'ux', level: 'senior' },
        { skill_name: 'Prototyping', category: 'ux', level: 'senior' },
        { skill_name: 'Design Systems', category: 'design', level: 'senior' },
        { skill_name: 'Usability Testing', category: 'ux', level: 'mid' },
        { skill_name: 'Adobe Illustrator', category: 'design', level: 'mid' },
        { skill_name: 'HTML/CSS', category: 'frontend', level: 'mid' },
        { skill_name: 'Accessibility', category: 'ux', level: 'mid' },
      ],
      // Maximilian Koch
      [
        { skill_name: 'React', category: 'frontend', level: 'senior' },
        { skill_name: 'Node.js', category: 'backend', level: 'senior' },
        { skill_name: 'PostgreSQL', category: 'database', level: 'mid' },
        { skill_name: 'TypeScript', category: 'frontend', level: 'senior' },
        { skill_name: 'Docker', category: 'devops', level: 'mid' },
        { skill_name: 'MongoDB', category: 'database', level: 'mid' },
        { skill_name: 'Express.js', category: 'backend', level: 'senior' },
        { skill_name: 'REST APIs', category: 'backend', level: 'senior' },
        { skill_name: 'Git', category: 'tools', level: 'senior' },
        { skill_name: 'Jest', category: 'testing', level: 'mid' },
      ],
      // Laura Hoffmann
      [
        { skill_name: 'Java', category: 'backend', level: 'expert' },
        { skill_name: 'Spring Boot', category: 'backend', level: 'expert' },
        { skill_name: 'Microservices', category: 'architecture', level: 'senior' },
        { skill_name: 'Kafka', category: 'data', level: 'senior' },
        { skill_name: 'PostgreSQL', category: 'database', level: 'senior' },
        { skill_name: 'Docker', category: 'devops', level: 'senior' },
        { skill_name: 'Kubernetes', category: 'devops', level: 'mid' },
        { skill_name: 'REST APIs', category: 'backend', level: 'expert' },
        { skill_name: 'JUnit', category: 'testing', level: 'senior' },
        { skill_name: 'Maven', category: 'tools', level: 'senior' },
      ],
      // Daniel Wagner
      [
        { skill_name: 'AWS', category: 'cloud', level: 'expert' },
        { skill_name: 'Azure', category: 'cloud', level: 'expert' },
        { skill_name: 'GCP', category: 'cloud', level: 'senior' },
        { skill_name: 'Terraform', category: 'devops', level: 'expert' },
        { skill_name: 'Architecture', category: 'architecture', level: 'expert' },
        { skill_name: 'Security', category: 'security', level: 'senior' },
        { skill_name: 'Kubernetes', category: 'devops', level: 'senior' },
        { skill_name: 'Cost Optimization', category: 'cloud', level: 'senior' },
        { skill_name: 'Migration', category: 'cloud', level: 'expert' },
        { skill_name: 'Python', category: 'backend', level: 'mid' },
      ],
      // Felix Klein
      [
        { skill_name: 'Vue.js', category: 'frontend', level: 'senior' },
        { skill_name: 'TypeScript', category: 'frontend', level: 'mid' },
        { skill_name: 'Tailwind', category: 'frontend', level: 'senior' },
        { skill_name: 'Nuxt', category: 'frontend', level: 'mid' },
        { skill_name: 'JavaScript', category: 'frontend', level: 'senior' },
        { skill_name: 'CSS/SCSS', category: 'frontend', level: 'senior' },
        { skill_name: 'Git', category: 'tools', level: 'mid' },
        { skill_name: 'Vite', category: 'tools', level: 'mid' },
      ],
      // Maria Schulz
      [
        { skill_name: 'Team Leadership', category: 'leadership', level: 'expert' },
        { skill_name: 'Agile/Scrum', category: 'methodology', level: 'expert' },
        { skill_name: 'Technical Strategy', category: 'leadership', level: 'senior' },
        { skill_name: 'Hiring', category: 'leadership', level: 'expert' },
        { skill_name: 'Mentoring', category: 'leadership', level: 'expert' },
        { skill_name: 'Architecture', category: 'architecture', level: 'senior' },
        { skill_name: 'Stakeholder Management', category: 'soft-skills', level: 'expert' },
        { skill_name: 'Budget Planning', category: 'leadership', level: 'senior' },
        { skill_name: 'React', category: 'frontend', level: 'mid' },
        { skill_name: 'Node.js', category: 'backend', level: 'mid' },
      ],
    ];

    const languagesData = [
      [{ language: 'Deutsch', proficiency: 'native' }, { language: 'Englisch', proficiency: 'fluent' }, { language: 'Spanisch', proficiency: 'basic' }],
      [{ language: 'Deutsch', proficiency: 'native' }, { language: 'Englisch', proficiency: 'fluent' }],
      [{ language: 'Deutsch', proficiency: 'native' }, { language: 'Englisch', proficiency: 'fluent' }, { language: 'Französisch', proficiency: 'conversational' }],
      [{ language: 'Deutsch', proficiency: 'native' }, { language: 'Englisch', proficiency: 'fluent' }],
      [{ language: 'Deutsch', proficiency: 'native' }, { language: 'Englisch', proficiency: 'fluent' }, { language: 'Italienisch', proficiency: 'basic' }],
      [{ language: 'Deutsch', proficiency: 'native' }, { language: 'Englisch', proficiency: 'conversational' }],
      [{ language: 'Deutsch', proficiency: 'native' }, { language: 'Englisch', proficiency: 'fluent' }, { language: 'Russisch', proficiency: 'conversational' }],
      [{ language: 'Deutsch', proficiency: 'native' }, { language: 'Englisch', proficiency: 'fluent' }, { language: 'Niederländisch', proficiency: 'conversational' }],
      [{ language: 'Deutsch', proficiency: 'native' }, { language: 'Englisch', proficiency: 'conversational' }],
      [{ language: 'Deutsch', proficiency: 'native' }, { language: 'Englisch', proficiency: 'fluent' }, { language: 'Polnisch', proficiency: 'native' }],
    ];

    const projectsData = [
      // Anna Weber
      [
        { project_name: 'E-Commerce Plattform Relaunch', client_name: 'Fashion AG', client_industry: 'Retail', project_type: 'Relaunch', team_size: 8, technologies: ['React', 'TypeScript', 'Node.js', 'AWS'], achievements: ['Performance +40%', 'Conversion Rate +25%', 'Mobile Traffic +60%'], responsibilities: ['Lead Frontend Development', 'Code Reviews', 'Performance Optimization'], is_highlight: true, start_date: '2023-01-01', end_date: '2023-09-30', duration_months: 9 },
        { project_name: 'Design System Entwicklung', client_name: 'TechStartup GmbH', client_industry: 'Tech', project_type: 'Internal', team_size: 4, technologies: ['React', 'Storybook', 'Figma'], achievements: ['50+ wiederverwendbare Komponenten', 'Development Speed +30%'], responsibilities: ['Architektur', 'Dokumentation'], is_highlight: false, start_date: '2022-06-01', end_date: '2022-12-31', duration_months: 7 },
      ],
      // Thomas Schmidt
      [
        { project_name: 'Cloud Migration AWS', client_name: 'Versicherung AG', client_industry: 'Insurance', project_type: 'Migration', team_size: 12, technologies: ['AWS', 'Kubernetes', 'Terraform', 'Jenkins'], achievements: ['Kosten -35%', 'Deployment Zeit -80%', '99.99% Uptime'], responsibilities: ['Infrastructure Architecture', 'CI/CD Setup', 'Team Training'], is_highlight: true, start_date: '2022-03-01', end_date: '2023-06-30', duration_months: 16 },
      ],
      // Julia Müller
      [
        { project_name: 'SaaS Platform Launch', client_name: 'SaaS Solutions GmbH', client_industry: 'SaaS', project_type: 'Product Launch', team_size: 15, technologies: ['React', 'Node.js', 'PostgreSQL'], achievements: ['1000 Kunden in 6 Monaten', 'NPS Score 72', 'Churn Rate 2%'], responsibilities: ['Product Strategy', 'User Research', 'Roadmap'], is_highlight: true, start_date: '2022-01-01', end_date: '2023-03-31', duration_months: 15 },
      ],
      // Michael Braun
      [
        { project_name: 'Real-Time Analytics Pipeline', client_name: 'Fintech Corp', client_industry: 'Finance', project_type: 'Data Engineering', team_size: 6, technologies: ['Spark', 'Kafka', 'Snowflake', 'Airflow'], achievements: ['10x schnellere Datenverarbeitung', 'Echtzeit-Dashboards', 'Cost -50%'], responsibilities: ['Pipeline Architecture', 'Data Modeling', 'Performance Tuning'], is_highlight: true, start_date: '2023-02-01', end_date: '2024-01-31', duration_months: 12 },
      ],
      // Sarah Fischer
      [
        { project_name: 'Mobile App Redesign', client_name: 'Health Startup', client_industry: 'Healthcare', project_type: 'Redesign', team_size: 5, technologies: ['Figma', 'Principle', 'Zeplin'], achievements: ['User Satisfaction +45%', 'App Store Rating 4.8', 'Daily Active Users +30%'], responsibilities: ['UX Research', 'UI Design', 'Prototyping'], is_highlight: true, start_date: '2023-04-01', end_date: '2023-10-31', duration_months: 7 },
      ],
      // Maximilian Koch
      [
        { project_name: 'B2B Portal', client_name: 'Industrie GmbH', client_industry: 'Manufacturing', project_type: 'Development', team_size: 4, technologies: ['React', 'Node.js', 'PostgreSQL', 'Docker'], achievements: ['Digitalisierung von 20 Prozessen', 'Zeitersparnis 15h/Woche'], responsibilities: ['Full-Stack Development', 'API Design'], is_highlight: true, start_date: '2023-06-01', end_date: '2024-02-29', duration_months: 9 },
      ],
      // Laura Hoffmann
      [
        { project_name: 'Microservices Transformation', client_name: 'Bank AG', client_industry: 'Banking', project_type: 'Modernization', team_size: 20, technologies: ['Java', 'Spring Boot', 'Kafka', 'Kubernetes'], achievements: ['Deployment-Frequenz 10x', 'MTTR -70%', 'Skalierbarkeit +500%'], responsibilities: ['Backend Architecture', 'Service Design', 'Code Reviews'], is_highlight: true, start_date: '2021-06-01', end_date: '2023-12-31', duration_months: 31 },
      ],
      // Daniel Wagner
      [
        { project_name: 'Multi-Cloud Strategy', client_name: 'Automotive Corp', client_industry: 'Automotive', project_type: 'Consulting', team_size: 8, technologies: ['AWS', 'Azure', 'Terraform', 'Kubernetes'], achievements: ['Cloud Readiness Assessment', 'Migration Roadmap', 'Vendor Lock-in Vermeidung'], responsibilities: ['Solution Architecture', 'Strategy Consulting', 'Team Enablement'], is_highlight: true, start_date: '2023-01-01', end_date: '2024-06-30', duration_months: 18 },
      ],
      // Felix Klein
      [
        { project_name: 'Kundenportal', client_name: 'Energieversorger', client_industry: 'Energy', project_type: 'Development', team_size: 3, technologies: ['Vue.js', 'Nuxt', 'Tailwind'], achievements: ['Online-Vertragsabschlüsse +200%', 'Support-Anfragen -40%'], responsibilities: ['Frontend Development', 'Component Design'], is_highlight: true, start_date: '2023-09-01', end_date: '2024-05-31', duration_months: 9 },
      ],
      // Maria Schulz
      [
        { project_name: 'Engineering Team Scale-Up', client_name: 'TechCorp International', client_industry: 'Tech', project_type: 'Team Building', team_size: 15, technologies: ['Agile', 'OKRs', 'Hiring'], achievements: ['Team von 5 auf 15 skaliert', 'Onboarding-Zeit -50%', 'Team Retention 95%'], responsibilities: ['Hiring Strategy', 'Team Structure', 'Performance Management'], is_highlight: true, start_date: '2020-01-01', is_current: true, duration_months: 48 },
      ],
    ];

    const interviewNotesData = [
      // Anna Weber
      { status: 'completed', career_ultimate_goal: 'CTO in einem wachstumsstarken Tech-Unternehmen', career_3_5_year_plan: 'Tech Lead Position, Team aufbauen, Architektur-Entscheidungen treffen', career_what_worked: 'Eigenverantwortliche Projekte, moderne Tech-Stacks, flache Hierarchien', career_what_didnt_work: 'Zu viel Legacy-Code, wenig Innovation', current_positive: 'Gutes Team, moderne Technologien, Remote-Möglichkeiten', current_negative: 'Begrenzte Wachstumsmöglichkeiten, keine Führungsrolle in Sicht', change_motivation: 'Suche nach mehr technischer Verantwortung und Teamleitung', change_motivation_tags: ['Karriere', 'Führung', 'Technologie'], salary_current: '72.000 €', salary_desired: '88.000 €', salary_minimum: '82.000 €', notice_period: '3 Monate', earliest_start_date: '2025-04-01', summary_motivation: 'Klare Karriereziele, hohe intrinsische Motivation, sucht Herausforderung', summary_salary: 'Aktuell 72k, Wunsch 88k - marktüblich für Senior Frontend', summary_cultural_fit: 'Passt gut zu agilen Scale-ups, legt Wert auf Code-Qualität', summary_key_requirements: 'React/TypeScript Stack, Tech Lead Perspektive, moderne Tooling', summary_notice: '3 Monate Kündigungsfrist', would_recommend: true, recommendation_notes: 'Starke Kandidatin mit klaren Vorstellungen und excellenter technischer Expertise' },
      // Thomas Schmidt
      { status: 'completed', career_ultimate_goal: 'Principal Engineer oder VP Engineering im DevOps/Platform Bereich', career_3_5_year_plan: 'Platform Team aufbauen, Architektur-Standards definieren', career_what_worked: 'Hands-on Projekte, Cloud-Transformation, Automatisierung', career_what_didnt_work: 'Zu viel Ops, zu wenig Dev, veraltete Prozesse', current_positive: 'Vielfältige Cloud-Projekte, gutes Gehalt', current_negative: 'Wenig strategische Arbeit, reaktiv statt proaktiv', change_motivation: 'Möchte strategischer arbeiten und Team führen', change_motivation_tags: ['Strategie', 'Führung', 'Technologie'], salary_current: '78.000 €', salary_desired: '92.000 €', salary_minimum: '85.000 €', notice_period: '3 Monate', earliest_start_date: '2025-04-01', summary_motivation: 'Erfahrener DevOps mit Führungsambitionen', summary_salary: '78k aktuell, 92k Wunsch - im Markt angemessen', summary_cultural_fit: 'Remote-first bevorzugt, passt zu modernen Tech-Organisationen', summary_key_requirements: 'Kubernetes, AWS, Terraform, Team-Verantwortung', summary_notice: '3 Monate', would_recommend: true, recommendation_notes: 'Sehr kompetent, klare Kommunikation, bereit für nächsten Karriereschritt' },
      // Julia Müller
      { status: 'completed', career_ultimate_goal: 'VP Product oder CPO', career_3_5_year_plan: 'Senior PM, dann Head of Product', career_what_worked: 'Datengetriebene Entscheidungen, enge Zusammenarbeit mit Engineering', career_what_didnt_work: 'Zu viel Feature-Factory, wenig Strategy', current_positive: 'Spannendes Produkt, gutes Team', current_negative: 'Wenig Impact auf Strategie, zu viele Stakeholder', change_motivation: 'Suche mehr strategischen Einfluss', change_motivation_tags: ['Strategie', 'Impact', 'Growth'], salary_current: '68.000 €', salary_desired: '82.000 €', salary_minimum: '75.000 €', notice_period: '2 Monate', earliest_start_date: '2025-03-01', summary_motivation: 'Ambitionierte PM mit Strategie-Fokus', summary_salary: '68k -> 82k - realistischer Sprung', summary_cultural_fit: 'Passt zu B2B SaaS Unternehmen', summary_key_requirements: 'B2B Product, Strategy-Rolle, Ownership', summary_notice: '2 Monate', would_recommend: true, recommendation_notes: 'Strukturierte Denkerin, exzellente Kommunikation' },
      // Michael Braun
      { status: 'completed', career_ultimate_goal: 'Head of Data Engineering', career_3_5_year_plan: 'Lead Data Engineer, dann Team-Aufbau', career_what_worked: 'Komplexe Datenprojekte, Cloud-native Architekturen', career_what_didnt_work: 'Zu viel ETL-Wartung, wenig Innovation', current_positive: 'Gutes Salary, spannende Daten', current_negative: 'Legacy-Systeme, langsame Prozesse', change_motivation: 'Modernere Tech, mehr Verantwortung', change_motivation_tags: ['Technologie', 'Verantwortung', 'Modern'], salary_current: '75.000 €', salary_desired: '90.000 €', salary_minimum: '82.000 €', notice_period: '3 Monate', earliest_start_date: '2025-04-01', summary_motivation: 'Starker Data Engineer mit Führungspotential', summary_salary: '75k -> 90k - marktgerecht', summary_cultural_fit: 'Passt zu datengetriebenen Unternehmen', summary_key_requirements: 'Modern Data Stack, Spark/Airflow, Cloud', summary_notice: '3 Monate', would_recommend: true, recommendation_notes: 'Technisch stark, gute Soft Skills' },
      // Sarah Fischer
      { status: 'completed', career_ultimate_goal: 'Design Director', career_3_5_year_plan: 'Senior Designer, dann Design Lead', career_what_worked: 'User-centric Design, Design Systems', career_what_didnt_work: 'Zu wenig Research-Budget, Feature-Fokus', current_positive: 'Kreative Freiheit, nettes Team', current_negative: 'Wenig strategischer Einfluss', change_motivation: 'Mehr Impact, bessere Design Maturity', change_motivation_tags: ['Impact', 'Design Maturity', 'Growth'], salary_current: '58.000 €', salary_desired: '70.000 €', salary_minimum: '65.000 €', notice_period: '6 Wochen', earliest_start_date: '2025-02-15', summary_motivation: 'Talentierte Designerin sucht Wachstum', summary_salary: '58k -> 70k - angemessen für Berlin', summary_cultural_fit: 'Passt zu design-orientierten Unternehmen', summary_key_requirements: 'Figma, User Research, Design System', summary_notice: '6 Wochen', would_recommend: true, recommendation_notes: 'Kreativ, nutzerorientiert, proaktiv' },
      // Maximilian Koch
      { status: 'completed', career_ultimate_goal: 'Tech Lead Full-Stack', career_3_5_year_plan: 'Senior Developer, mehr Backend-Expertise', career_what_worked: 'Breites Skillset, Startup-Erfahrung', career_what_didnt_work: 'Zu wenig Spezialisierung möglich', current_positive: 'Abwechslungsreiche Projekte', current_negative: 'Wenig Mentoring, keine klare Karriere', change_motivation: 'Suche strukturierteres Umfeld', change_motivation_tags: ['Struktur', 'Mentoring', 'Wachstum'], salary_current: '65.000 €', salary_desired: '78.000 €', salary_minimum: '72.000 €', notice_period: '3 Monate', earliest_start_date: '2025-04-01', summary_motivation: 'Solider Full-Stack mit Potential', summary_salary: '65k -> 78k - realistisch', summary_cultural_fit: 'Passt zu Tech-Unternehmen mit guter Struktur', summary_key_requirements: 'React, Node.js, moderne Practices', summary_notice: '3 Monate', would_recommend: true, recommendation_notes: 'Lernwillig, teamfähig, vielseitig' },
      // Laura Hoffmann
      { status: 'completed', career_ultimate_goal: 'Principal Engineer oder Engineering Director', career_3_5_year_plan: 'Staff Engineer, Architektur-Verantwortung', career_what_worked: 'Microservices, Performance-Optimierung', career_what_didnt_work: 'Zu wenig Innovation, politische Entscheidungen', current_positive: 'Stabilität, gutes Gehalt', current_negative: 'Langsame Prozesse, wenig Agilität', change_motivation: 'Moderneres Umfeld, mehr Impact', change_motivation_tags: ['Modern', 'Impact', 'Agilität'], salary_current: '82.000 €', salary_desired: '95.000 €', salary_minimum: '88.000 €', notice_period: '3 Monate', earliest_start_date: '2025-04-01', summary_motivation: 'Erfahrene Backend-Entwicklerin mit Architektur-Fokus', summary_salary: '82k -> 95k - marktgerecht für Senior', summary_cultural_fit: 'Passt zu modernen Tech-Unternehmen', summary_key_requirements: 'Java/Spring, Microservices, Architektur', summary_notice: '3 Monate', would_recommend: true, recommendation_notes: 'Exzellente technische Skills, reif für Staff-Rolle' },
      // Daniel Wagner
      { status: 'completed', career_ultimate_goal: 'CTO oder VP Engineering', career_3_5_year_plan: 'Principal Architect, dann C-Level', career_what_worked: 'Strategische Projekte, Multi-Cloud', career_what_didnt_work: 'Zu viel Consulting, wenig Ownership', current_positive: 'Vielfältige Projekte, hohes Gehalt', current_negative: 'Kein langfristiger Impact', change_motivation: 'Suche feste Position mit Ownership', change_motivation_tags: ['Ownership', 'Strategie', 'Langfristig'], salary_current: '95.000 €', salary_desired: '115.000 €', salary_minimum: '105.000 €', notice_period: '3 Monate', earliest_start_date: '2025-04-01', summary_motivation: 'Erfahrener Architect sucht Ownership', summary_salary: '95k -> 115k - marktüblich für Cloud Architect', summary_cultural_fit: 'Passt zu Enterprise oder Scale-up', summary_key_requirements: 'Multi-Cloud, Strategie, Team-Lead', summary_notice: '3 Monate', would_recommend: true, recommendation_notes: 'Top-Kandidat für Senior-Architektur-Rollen' },
      // Felix Klein
      { status: 'completed', career_ultimate_goal: 'Senior Frontend Developer', career_3_5_year_plan: 'Mid-Level festigen, dann Senior', career_what_worked: 'Vue.js Projekte, schnelles Lernen', career_what_didnt_work: 'Zu wenig Mentoring in erster Stelle', current_positive: 'Gutes Team, interessante Projekte', current_negative: 'Begrenzte Tech-Stack Vielfalt', change_motivation: 'Suche breitere Erfahrung', change_motivation_tags: ['Lernen', 'Breite', 'Wachstum'], salary_current: '52.000 €', salary_desired: '62.000 €', salary_minimum: '58.000 €', notice_period: '6 Wochen', earliest_start_date: '2025-02-15', summary_motivation: 'Motivierter Junior/Mid mit Potential', summary_salary: '52k -> 62k - angemessen', summary_cultural_fit: 'Passt zu wachsenden Teams mit Mentoring', summary_key_requirements: 'Vue.js oder React, TypeScript, Mentoring', summary_notice: '6 Wochen', would_recommend: true, recommendation_notes: 'Gutes Potential, lernwillig, motiviert' },
      // Maria Schulz
      { status: 'completed', career_ultimate_goal: 'VP Engineering oder CTO', career_3_5_year_plan: 'Director Engineering, größere Org', career_what_worked: 'Team-Aufbau, Hiring, Kultur', career_what_didnt_work: 'Zu enge Scope, wenig Budget', current_positive: 'Gutes Team, Vertrauen der Führung', current_negative: 'Begrenzte Ressourcen, wenig Wachstum', change_motivation: 'Größere Organisation, mehr Scope', change_motivation_tags: ['Scope', 'Wachstum', 'Herausforderung'], salary_current: '110.000 €', salary_desired: '130.000 €', salary_minimum: '120.000 €', notice_period: '3 Monate', earliest_start_date: '2025-04-01', summary_motivation: 'Erfahrene Engineering Manager sucht größeren Scope', summary_salary: '110k -> 130k - marktgerecht für EM', summary_cultural_fit: 'Passt zu Scale-ups und größeren Tech-Orgs', summary_key_requirements: 'Team Leadership, Hiring, Technical Strategy', summary_notice: '3 Monate', would_recommend: true, recommendation_notes: 'Exzellente Führungskraft mit technischem Background' },
    ];

    // Insert all data for each candidate
    for (let i = 0; i < insertedCandidates!.length; i++) {
      const candidate = insertedCandidates![i];
      const candidateId = candidate.id;

      // Experiences
      if (experiencesData[i]) {
        const expInserts = experiencesData[i].map((exp, idx) => ({
          ...exp,
          candidate_id: candidateId,
          sort_order: idx,
        }));
        await supabase.from('candidate_experiences').insert(expInserts);
      }

      // Educations
      if (educationsData[i]) {
        const eduInserts = educationsData[i].map((edu, idx) => ({
          ...edu,
          candidate_id: candidateId,
          sort_order: idx,
        }));
        await supabase.from('candidate_educations').insert(eduInserts);
      }

      // Skills
      if (skillsData[i]) {
        const skillInserts = skillsData[i].map(skill => ({
          ...skill,
          candidate_id: candidateId,
        }));
        await supabase.from('candidate_skills').insert(skillInserts);
      }

      // Languages
      if (languagesData[i]) {
        const langInserts = languagesData[i].map(lang => ({
          ...lang,
          candidate_id: candidateId,
        }));
        await supabase.from('candidate_languages').insert(langInserts);
      }

      // Projects
      if (projectsData[i]) {
        const projInserts = projectsData[i].map((proj, idx) => ({
          ...proj,
          candidate_id: candidateId,
          sort_order: idx,
        }));
        await supabase.from('candidate_projects').insert(projInserts);
      }

      // Interview Notes
      if (interviewNotesData[i]) {
        await supabase.from('candidate_interview_notes').insert({
          ...interviewNotesData[i],
          candidate_id: candidateId,
          recruiter_id: marko.user_id,
          interview_date: new Date(Date.now() - (30 - i * 3) * 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      // CV Document (simulated)
      await supabase.from('candidate_documents').insert({
        candidate_id: candidateId,
        document_type: 'cv',
        version: 1,
        file_name: `${candidate.full_name.replace(' ', '_')}_CV.pdf`,
        file_url: `https://example.com/cvs/${candidateId}.pdf`,
        file_size: 245000 + Math.floor(Math.random() * 100000),
        mime_type: 'application/pdf',
        is_current: true,
        uploaded_by: marko.user_id,
      });

      console.log(`✅ Created complete data for ${candidate.full_name}`);
    }

    // Step 6: Create submissions across all pipeline stages
    const jobs = jobsToKeep;
    const candidates = insertedCandidates!;
    const stages = [
      'submitted', 'submitted',
      'opt_in_pending', 'opt_in_pending',
      'opt_in_accepted', 'opt_in_accepted',
      'screening', 'screening',
      'interview', 'interview',
    ];

    // Delete old submissions
    await supabase.from('submissions').delete().eq('recruiter_id', marko.user_id);

    const submissions = [];
    for (let i = 0; i < candidates.length && i < stages.length; i++) {
      const jobIndex = i % jobs.length;
      submissions.push({
        candidate_id: candidates[i].id,
        job_id: jobs[jobIndex].id,
        recruiter_id: marko.user_id,
        status: stages[i],
        match_score: 70 + Math.floor(Math.random() * 25),
        notes: `Kandidat ${candidates[i].full_name} für Position ${jobs[jobIndex].title}`,
        submitted_at: new Date(Date.now() - (20 - i * 2) * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    const { error: subError } = await supabase.from('submissions').insert(submissions);
    if (subError) {
      console.error('Submission insert error:', subError);
    }
    console.log(`✅ Created ${submissions.length} submissions across pipeline stages`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Complete test data seeded successfully',
        summary: {
          jobs_kept: jobsToKeep.length,
          jobs_deleted: jobsToDelete.length,
          candidates_created: insertedCandidates?.length || 0,
          submissions_created: submissions.length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error seeding data:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
