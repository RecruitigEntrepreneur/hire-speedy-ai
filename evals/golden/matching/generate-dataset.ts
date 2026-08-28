/**
 * Generator für das synthetische Golden-Dataset v1.
 *
 * KOMPLETT SYNTHETISCH (is_synthetic: true überall) — wird durch echte,
 * pseudonymisierte Submission-Outcomes ergänzt/ersetzt, sobald DB-Zugang
 * besteht (Entscheidung 2026-07-17: echt + synthetisch).
 *
 * Design:
 * - 14 Jobs über die Domänen der Plattform (IT, Finance, SAP, HR, Sales,
 *   Design, PM, Security — Spiegel der TECH_DOMAINS im Matcher).
 * - Pro Job: Positives (hired=3, interviewed/shortlisted=2) und explizit
 *   abgelehnte Hard-Negatives mit fachlicher Begründung.
 * - Easy Negatives entstehen strukturell: Jeder Job wird gegen den GESAMTEN
 *   Kandidatenpool gerankt (inkl. aller anderen Job-Pools + Distraktoren).
 * - Edge-Cases: Quereinsteiger, dünner CV, überqualifiziert, Nachbar-Skills,
 *   Visa, Sprachlücke, Remote-only vs. Präsenz, Gehalts-Blowout,
 *   Muss-Kriterien als Satzfragmente (Produktions-Realität).
 *
 * Deterministisch: keine Zufallszahlen, keine Systemzeit. Datumslogik relativ
 * zu reference_date. Aufruf: npx tsx evals/golden/matching/generate-dataset.ts
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GoldenCandidate,
  GoldenDataset,
  GoldenDatasetSchema,
  GoldenJob,
  GoldenLabel,
} from './schema';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(HERE, 'dataset.v1.json');

const REFERENCE_DATE = '2026-07-17T12:00:00.000Z';

// ---------------------------------------------------------------------------
// Helpers mit realistischen Defaults
// ---------------------------------------------------------------------------

type CandidateInput = Partial<GoldenCandidate> & { id: string; persona: string; job_title: string; skills: string[] };

function cand(input: CandidateInput): GoldenCandidate {
  return {
    is_synthetic: true,
    experience_years: 5,
    seniority: 'mid',
    expected_salary: null,
    salary_expectation_min: null,
    availability_in_days: 30,
    remote_preference: 'hybrid',
    work_model: null,
    city: 'München',
    max_commute_minutes: 45,
    industry_experience: [],
    languages: [
      { language: 'de', level: 'native' },
      { language: 'en', level: 'b2' },
    ],
    certifications: [],
    visa_required: false,
    ...input,
  };
}

type JobInput = Partial<GoldenJob> & { id: string; title: string; skills: string[] };

function job(input: JobInput): GoldenJob {
  return {
    is_synthetic: true,
    industry: null,
    must_haves: [],
    nice_to_haves: [],
    salary_min: null,
    salary_max: null,
    experience_level: 'mid',
    experience_min: null,
    experience_max: null,
    visa_sponsorship: false,
    remote_type: 'hybrid',
    work_model: null,
    onsite_required: false,
    required_languages: [],
    required_certifications: [],
    location: null,
    skill_requirements: [],
    ...input,
  };
}

interface JobBlock {
  job: GoldenJob;
  labels: { candidate: GoldenCandidate; label: GoldenLabel['label']; reason?: string }[];
}

// ---------------------------------------------------------------------------
// Job-Blöcke: Job + gelabelte Kandidaten
// ---------------------------------------------------------------------------

const BLOCKS: JobBlock[] = [
  // 1) Senior Backend (Java) — mit Sprach-Anforderung (Landmine im Live-Zustand)
  {
    job: job({
      id: 'job-backend-senior',
      title: 'Senior Backend Entwickler (Java)',
      industry: 'software',
      skills: ['Java', 'Spring Boot', 'PostgreSQL', 'Kafka', 'AWS'],
      must_haves: ['Java', 'Spring Boot', 'SQL'],
      nice_to_haves: ['Kafka', 'Kubernetes'],
      salary_min: 75000,
      salary_max: 95000,
      experience_level: 'senior',
      experience_min: 5,
      experience_max: 12,
      location: 'München',
      required_languages: [{ code: 'de', minLevel: 'c1' }],
    }),
    labels: [
      {
        candidate: cand({
          id: 'cand-backend-01',
          persona: 'Perfekter Senior-Java-Entwickler, alle Must-haves direkt',
          job_title: 'Senior Java Entwickler',
          skills: ['Java', 'Spring Boot', 'PostgreSQL', 'Kafka', 'Docker', 'AWS'],
          experience_years: 8,
          seniority: 'senior',
          expected_salary: 88000,
          industry_experience: ['software'],
        }),
        label: 'hired',
      },
      {
        candidate: cand({
          id: 'cand-backend-02',
          persona: 'Kotlin/Java-Entwickler — Nachbar-Skills, transferierbar',
          job_title: 'Backend Developer',
          skills: ['Kotlin', 'Java', 'Spring', 'MySQL', 'Docker'],
          experience_years: 6,
          seniority: 'senior',
          expected_salary: 82000,
        }),
        label: 'interviewed',
      },
      {
        candidate: cand({
          id: 'cand-backend-sparse',
          persona: 'Dünner CV: nur zwei Skills gepflegt, aber passender Titel/Erfahrung',
          job_title: 'Java Entwickler',
          skills: ['Java', 'SQL'],
          experience_years: 7,
          seniority: 'senior',
          expected_salary: 80000,
        }),
        label: 'shortlisted',
      },
      {
        candidate: cand({
          id: 'cand-backend-visa',
          persona: 'Starker Backend-Entwickler, braucht Visa-Sponsoring (Job bietet keins)',
          job_title: 'Senior Backend Engineer',
          skills: ['Java', 'Spring Boot', 'PostgreSQL', 'Kubernetes'],
          experience_years: 7,
          seniority: 'senior',
          expected_salary: 85000,
          visa_required: true,
          languages: [{ language: 'en', level: 'c1' }],
        }),
        label: 'rejected',
        reason: 'Kein Visa-Sponsoring für diese Stelle; zudem Deutsch unter C1',
      },
      {
        candidate: cand({
          id: 'cand-backend-salary',
          persona: 'Passender Java-Senior, Gehaltsvorstellung 25% über Budget',
          job_title: 'Senior Java Entwickler',
          skills: ['Java', 'Spring Boot', 'PostgreSQL', 'AWS'],
          experience_years: 10,
          seniority: 'senior',
          expected_salary: 119000,
        }),
        label: 'rejected',
        reason: 'Gehaltsvorstellung deutlich über Budget-Maximum',
      },
      {
        candidate: cand({
          id: 'cand-backend-embedded',
          persona: 'Embedded-Ingenieur mit Java-Hobby — falsche Domäne',
          job_title: 'Embedded Software Engineer',
          skills: ['C', 'C++', 'RTOS', 'Microcontroller', 'Java'],
          experience_years: 9,
          seniority: 'senior',
          expected_salary: 78000,
        }),
        label: 'rejected',
        reason: 'Kern-Erfahrung Embedded, kein produktives Backend-Cloud-Profil',
      },
    ],
  },

  // 2) Mid Frontend (React) — remote
  {
    job: job({
      id: 'job-frontend-mid',
      title: 'Frontend Entwickler React (m/w/d)',
      industry: 'software',
      skills: ['React', 'TypeScript', 'CSS', 'Vite'],
      must_haves: ['React', 'TypeScript'],
      nice_to_haves: ['Next.js', 'Tailwind'],
      salary_min: 55000,
      salary_max: 70000,
      experience_level: 'mid',
      experience_min: 2,
      experience_max: 6,
      remote_type: 'remote',
      location: 'Berlin',
    }),
    labels: [
      {
        candidate: cand({
          id: 'cand-frontend-01',
          persona: 'React/TypeScript-Entwicklerin, exakter Fit',
          job_title: 'Frontend Developer',
          skills: ['ReactJS', 'TypeScript', 'Next.js', 'Tailwind', 'CSS'],
          experience_years: 4,
          city: 'Berlin',
          expected_salary: 63000,
          remote_preference: 'remote',
        }),
        label: 'hired',
      },
      {
        candidate: cand({
          id: 'cand-frontend-vue',
          persona: 'Vue-Entwickler — Nachbar-Framework, wechselwillig',
          job_title: 'Frontend Entwickler',
          skills: ['Vue.js', 'JavaScript', 'TypeScript', 'Nuxt.js', 'CSS'],
          experience_years: 5,
          expected_salary: 60000,
          remote_preference: 'remote',
          city: 'Leipzig',
        }),
        label: 'interviewed',
      },
      {
        candidate: cand({
          id: 'cand-frontend-junior',
          persona: 'Ambitionierte Junior-Entwicklerin, knapp unter Mid-Level',
          job_title: 'Junior Frontend Developer',
          skills: ['React', 'JavaScript', 'CSS', 'HTML'],
          experience_years: 2,
          seniority: 'junior',
          expected_salary: 48000,
          remote_preference: 'remote',
          city: 'Dresden',
        }),
        label: 'shortlisted',
      },
      {
        candidate: cand({
          id: 'cand-frontend-designer',
          persona: 'UI-Designerin mit Figma, kann kein React — falsches Profil',
          job_title: 'UI Designerin',
          skills: ['Figma', 'UI Design', 'Prototyping', 'CSS'],
          experience_years: 6,
          expected_salary: 58000,
        }),
        label: 'rejected',
        reason: 'Design-Profil ohne Entwicklungs-Skills; React fehlt komplett',
      },
      {
        candidate: cand({
          id: 'cand-frontend-salary',
          persona: 'Guter React-Entwickler, will 95k bei 70k-Budget',
          job_title: 'Senior Frontend Engineer',
          skills: ['React', 'TypeScript', 'Next.js', 'GraphQL'],
          experience_years: 8,
          seniority: 'senior',
          expected_salary: 95000,
          remote_preference: 'remote',
        }),
        label: 'rejected',
        reason: 'Gehalt 35% über Budget, zudem überqualifiziert für Mid-Level',
      },
    ],
  },

  // 3) ML Engineer — bietet Visa-Sponsoring
  {
    job: job({
      id: 'job-data-ml',
      title: 'Machine Learning Engineer',
      industry: 'software',
      skills: ['Python', 'PyTorch', 'MLOps', 'SQL'],
      must_haves: ['Python', 'Machine Learning'],
      nice_to_haves: ['PyTorch', 'MLflow', 'AWS'],
      salary_min: 70000,
      salary_max: 90000,
      experience_level: 'senior',
      experience_min: 4,
      experience_max: 10,
      visa_sponsorship: true,
      location: 'München',
    }),
    labels: [
      {
        candidate: cand({
          id: 'cand-ml-01',
          persona: 'ML-Engineer mit Produktions-Erfahrung, exakter Fit',
          job_title: 'Machine Learning Engineer',
          skills: ['Python', 'PyTorch', 'Machine Learning', 'MLflow', 'SQL', 'Docker'],
          experience_years: 6,
          seniority: 'senior',
          expected_salary: 85000,
        }),
        label: 'hired',
      },
      {
        candidate: cand({
          id: 'cand-ml-dataeng',
          persona: 'Data Engineer mit ML-Ambition — angrenzendes Profil',
          job_title: 'Data Engineer',
          skills: ['Python', 'Spark', 'Airflow', 'SQL', 'dbt', 'Machine Learning'],
          experience_years: 5,
          seniority: 'senior',
          expected_salary: 78000,
        }),
        label: 'interviewed',
      },
      {
        candidate: cand({
          id: 'cand-ml-visa',
          persona: 'ML-PhD aus dem Ausland, braucht Visa (Job sponsert!)',
          job_title: 'ML Research Engineer',
          skills: ['Python', 'PyTorch', 'Deep Learning', 'NLP', 'Machine Learning'],
          experience_years: 4,
          seniority: 'senior',
          expected_salary: 80000,
          visa_required: true,
          languages: [{ language: 'en', level: 'c2' }],
        }),
        label: 'shortlisted',
      },
      {
        candidate: cand({
          id: 'cand-ml-bi',
          persona: 'BI-Analyst mit Power BI — kein ML-Engineering',
          job_title: 'BI Analyst',
          skills: ['Power BI', 'SQL', 'Excel', 'Tableau'],
          experience_years: 7,
          expected_salary: 65000,
        }),
        label: 'rejected',
        reason: 'Reporting-Profil ohne ML-Engineering-Erfahrung',
      },
    ],
  },

  // 4) DevOps — Präsenzpflicht (testet Onsite-Kill)
  {
    job: job({
      id: 'job-devops',
      title: 'DevOps Engineer (Kubernetes)',
      industry: 'software',
      skills: ['Kubernetes', 'Terraform', 'AWS', 'CI/CD', 'Linux'],
      must_haves: ['Kubernetes', 'Terraform', 'CI/CD'],
      nice_to_haves: ['Helm', 'Prometheus'],
      salary_min: 65000,
      salary_max: 85000,
      experience_level: 'senior',
      experience_min: 4,
      experience_max: 10,
      onsite_required: true,
      remote_type: 'onsite',
      location: 'Frankfurt',
    }),
    labels: [
      {
        candidate: cand({
          id: 'cand-devops-01',
          persona: 'DevOps-Engineer, K8s in Produktion, Frankfurt lokal',
          job_title: 'DevOps Engineer',
          skills: ['K8s', 'Terraform', 'AWS', 'GitHub Actions', 'Helm', 'Linux'],
          experience_years: 6,
          seniority: 'senior',
          expected_salary: 80000,
          city: 'Frankfurt',
        }),
        label: 'hired',
      },
      {
        candidate: cand({
          id: 'cand-devops-backend',
          persona: 'Backend-Entwickler mit starkem K8s-Anteil — Plattform-Wechsel',
          job_title: 'Backend Engineer (Platform)',
          skills: ['Go', 'Kubernetes', 'Docker', 'Terraform', 'CI/CD'],
          experience_years: 5,
          seniority: 'senior',
          expected_salary: 78000,
          city: 'Mainz',
        }),
        label: 'interviewed',
      },
      {
        candidate: cand({
          id: 'cand-devops-remote',
          persona: 'Sehr guter DevOps, will ausschließlich remote (Job hat Präsenzpflicht)',
          job_title: 'Senior DevOps Engineer',
          skills: ['Kubernetes', 'Terraform', 'GCP', 'ArgoCD', 'Prometheus'],
          experience_years: 8,
          seniority: 'senior',
          expected_salary: 84000,
          remote_preference: 'remote_only',
          city: 'Rostock',
        }),
        label: 'rejected',
        reason: 'Remote-only, Stelle hat Präsenzpflicht in Frankfurt',
      },
      {
        candidate: cand({
          id: 'cand-devops-junior',
          persona: 'Junior-Admin mit ersten Docker-Schritten — zu früh',
          job_title: 'Junior Systemadministrator',
          skills: ['Linux', 'Docker', 'Bash'],
          experience_years: 1,
          seniority: 'junior',
          expected_salary: 45000,
          city: 'Frankfurt',
        }),
        label: 'rejected',
        reason: 'Zwei Seniority-Stufen unter Anforderung, kein K8s/Terraform',
      },
    ],
  },

  // 5) Embedded — inkompatible Domäne als Hard-Negative
  {
    job: job({
      id: 'job-embedded',
      title: 'Embedded Software Entwickler (C/RTOS)',
      industry: 'automotive',
      skills: ['C', 'Embedded', 'RTOS', 'CAN Bus', 'Microcontroller'],
      must_haves: ['C', 'Embedded'],
      nice_to_haves: ['CAN Bus', 'AUTOSAR'],
      salary_min: 60000,
      salary_max: 80000,
      experience_level: 'mid',
      experience_min: 3,
      experience_max: 8,
      onsite_required: true,
      remote_type: 'onsite',
      location: 'Stuttgart',
    }),
    labels: [
      {
        candidate: cand({
          id: 'cand-embedded-01',
          persona: 'Embedded-Entwickler Automotive, exakter Fit',
          job_title: 'Embedded Software Engineer',
          skills: ['C', 'C++', 'Embedded', 'RTOS', 'CAN Bus', 'STM32'],
          experience_years: 5,
          expected_salary: 72000,
          city: 'Stuttgart',
          industry_experience: ['automotive'],
        }),
        label: 'hired',
      },
      {
        candidate: cand({
          id: 'cand-embedded-elektronik',
          persona: 'Elektronik-Ingenieurin mit Firmware-Anteil',
          job_title: 'Hardware-Entwicklerin',
          skills: ['Elektronik', 'Firmware', 'C', 'PCB', 'Oscilloscope'],
          experience_years: 4,
          expected_salary: 65000,
          city: 'Esslingen',
        }),
        label: 'shortlisted',
      },
      {
        candidate: cand({
          id: 'cand-embedded-java',
          persona: 'Java-Cloud-Entwickler — inkompatible Domäne',
          job_title: 'Java Backend Entwickler',
          skills: ['Java', 'Spring Boot', 'AWS', 'Microservices'],
          experience_years: 6,
          seniority: 'senior',
          expected_salary: 75000,
        }),
        label: 'rejected',
        reason: 'Backend-Cloud-Profil, keinerlei Embedded-Erfahrung',
      },
      {
        candidate: cand({
          id: 'cand-embedded-sps',
          persona: 'SPS-Techniker ohne C-Programmierung',
          job_title: 'SPS Programmierer',
          skills: ['SPS', 'TIA Portal', 'Siemens S7'],
          experience_years: 8,
          expected_salary: 62000,
          city: 'Ludwigsburg',
        }),
        label: 'rejected',
        reason: 'Automatisierungstechnik ohne Embedded-C-Entwicklung',
      },
    ],
  },

  // 6) iOS — Nachbar-Skills (React Native)
  {
    job: job({
      id: 'job-mobile-ios',
      title: 'iOS Entwickler (Swift)',
      industry: 'software',
      skills: ['Swift', 'SwiftUI', 'iOS', 'Xcode'],
      must_haves: ['Swift', 'iOS'],
      nice_to_haves: ['SwiftUI', 'Combine'],
      salary_min: 60000,
      salary_max: 75000,
      experience_level: 'mid',
      experience_min: 3,
      experience_max: 8,
      location: 'Hamburg',
    }),
    labels: [
      {
        candidate: cand({
          id: 'cand-ios-01',
          persona: 'iOS-Entwicklerin mit App-Store-Track-Record',
          job_title: 'iOS Developer',
          skills: ['Swift', 'SwiftUI', 'iOS', 'Xcode', 'Combine'],
          experience_years: 5,
          expected_salary: 70000,
          city: 'Hamburg',
        }),
        label: 'hired',
      },
      {
        candidate: cand({
          id: 'cand-ios-rn',
          persona: 'React-Native-Entwickler mit iOS-Grundlagen — Nachbar-Stack',
          job_title: 'Mobile Developer',
          skills: ['React Native', 'TypeScript', 'iOS', 'Android'],
          experience_years: 4,
          expected_salary: 64000,
          city: 'Bremen',
        }),
        label: 'interviewed',
      },
      {
        candidate: cand({
          id: 'cand-ios-backend',
          persona: 'Python-Backend-Entwickler ohne Mobile-Erfahrung',
          job_title: 'Backend Developer',
          skills: ['Python', 'Django', 'PostgreSQL', 'REST API'],
          experience_years: 6,
          seniority: 'senior',
          expected_salary: 72000,
        }),
        label: 'rejected',
        reason: 'Kein Mobile-Stack; Swift/iOS fehlen vollständig',
      },
    ],
  },

  // 7) Finanzbuchhalter — Muss-Kriterium als Satzfragment + Sprach-Anforderung
  {
    job: job({
      id: 'job-buchhalter',
      title: 'Finanzbuchhalter (m/w/d)',
      industry: 'steuerberatung',
      skills: ['DATEV', 'Finanzbuchhaltung', 'Umsatzsteuer'],
      must_haves: ['Mehrjährige Berufserfahrung in der Buchhaltung', 'DATEV'],
      nice_to_haves: ['Jahresabschluss nach HGB', 'Lohnbuchhaltung'],
      salary_min: 45000,
      salary_max: 55000,
      experience_level: 'mid',
      experience_min: 3,
      experience_max: 10,
      onsite_required: true,
      remote_type: 'onsite',
      location: 'Köln',
      required_languages: [{ code: 'de', minLevel: 'c2' }],
    }),
    labels: [
      {
        candidate: cand({
          id: 'cand-fibu-01',
          persona: 'Bilanzbuchhalterin mit DATEV, exakter Fit',
          job_title: 'Bilanzbuchhalterin',
          skills: ['Fibu', 'DATEV', 'Jahresabschluss', 'HGB', 'Umsatzsteuer'],
          experience_years: 7,
          expected_salary: 52000,
          city: 'Köln',
          certifications: ['Bilanzbuchhalter IHK'],
          industry_experience: ['steuerberatung'],
        }),
        label: 'hired',
      },
      {
        candidate: cand({
          id: 'cand-fibu-stfa',
          persona: 'Steuerfachangestellte — Synonym-Familie Buchhaltung',
          job_title: 'Steuerfachangestellte',
          skills: ['Buchführung', 'DATEV', 'Steuererklärung', 'Umsatzsteuer'],
          experience_years: 5,
          expected_salary: 48000,
          city: 'Leverkusen',
        }),
        label: 'interviewed',
      },
      {
        candidate: cand({
          id: 'cand-fibu-kreditor',
          persona: 'Kreditorenbuchhalter, will breitere Fibu-Rolle',
          job_title: 'Kreditorenbuchhalter',
          skills: ['Kreditorenbuchhaltung', 'SAP FI', 'Rechnungsprüfung'],
          experience_years: 4,
          expected_salary: 46000,
          city: 'Bonn',
        }),
        label: 'shortlisted',
      },
      {
        candidate: cand({
          id: 'cand-fibu-english',
          persona: 'Erfahrener Accountant, spricht kein Deutsch (Job verlangt C2)',
          job_title: 'Accountant',
          skills: ['Accounting', 'General Ledger', 'IFRS', 'Excel'],
          experience_years: 8,
          expected_salary: 54000,
          languages: [{ language: 'en', level: 'native' }],
          city: 'Köln',
        }),
        label: 'rejected',
        reason: 'Mandanten-Kommunikation auf Deutsch (C2) zwingend, nicht vorhanden',
      },
      {
        candidate: cand({
          id: 'cand-fibu-leiter',
          persona: 'Leiter Rechnungswesen — deutlich überqualifiziert, zu teuer',
          job_title: 'Leiter Rechnungswesen',
          skills: ['Rechnungswesen', 'Konsolidierung', 'HGB', 'IFRS', 'DATEV', 'Führung'],
          experience_years: 18,
          seniority: 'head',
          expected_salary: 95000,
          city: 'Köln',
        }),
        label: 'rejected',
        reason: 'Überqualifiziert; Gehaltsvorstellung 70% über Budget',
      },
    ],
  },

  // 8) Controller — Quereinsteiger als Positive
  {
    job: job({
      id: 'job-controller',
      title: 'Controller (m/w/d)',
      industry: 'maschinenbau',
      skills: ['Controlling', 'Kostenrechnung', 'Excel', 'Power BI'],
      must_haves: ['Controlling', 'Kostenrechnung'],
      nice_to_haves: ['Power BI', 'SAP CO'],
      salary_min: 60000,
      salary_max: 75000,
      experience_level: 'senior',
      experience_min: 4,
      experience_max: 12,
      location: 'Düsseldorf',
    }),
    labels: [
      {
        candidate: cand({
          id: 'cand-controlling-01',
          persona: 'Senior-Controllerin Industrie, exakter Fit',
          job_title: 'Senior Controllerin',
          skills: ['Controlling', 'Kostenrechnung', 'Budgetierung', 'SAP CO', 'Power BI'],
          experience_years: 8,
          seniority: 'senior',
          expected_salary: 72000,
          city: 'Düsseldorf',
          industry_experience: ['maschinenbau'],
        }),
        label: 'hired',
      },
      {
        candidate: cand({
          id: 'cand-controlling-quereinsteiger',
          persona: 'Quereinsteiger: Finanzbuchhalter mit Controlling-Weiterbildung',
          job_title: 'Finanzbuchhalter',
          skills: ['Finanzbuchhaltung', 'Kostenrechnung', 'Excel', 'SAP FI', 'Reporting'],
          experience_years: 6,
          seniority: 'senior',
          expected_salary: 62000,
          city: 'Neuss',
        }),
        label: 'interviewed',
      },
      {
        candidate: cand({
          id: 'cand-controlling-junior',
          persona: 'Junior-Controller, 2 Stufen unter Anforderung',
          job_title: 'Junior Controller',
          skills: ['Controlling', 'Excel'],
          experience_years: 1,
          seniority: 'junior',
          expected_salary: 45000,
        }),
        label: 'rejected',
        reason: 'Deutlich zu junior für Senior-Rolle',
      },
      {
        candidate: cand({
          id: 'cand-controlling-vertrieb',
          persona: 'Vertriebler ohne Finanz-Hintergrund',
          job_title: 'Account Manager',
          skills: ['Vertrieb', 'CRM', 'Salesforce', 'Key Account'],
          experience_years: 7,
          seniority: 'senior',
          expected_salary: 68000,
        }),
        label: 'rejected',
        reason: 'Kein Controlling-/Finanz-Profil',
      },
    ],
  },

  // 9) SAP FI/CO — Finance→SAP-Transfer als Positive
  {
    job: job({
      id: 'job-sap-fi',
      title: 'SAP FI/CO Consultant',
      industry: 'consulting',
      skills: ['SAP FI', 'SAP CO', 'S/4HANA', 'Customizing'],
      must_haves: ['SAP FI', 'Customizing'],
      nice_to_haves: ['S/4HANA', 'ABAP Grundlagen'],
      salary_min: 80000,
      salary_max: 100000,
      experience_level: 'senior',
      experience_min: 5,
      experience_max: 15,
      remote_type: 'remote',
      location: 'Remote (DE)',
    }),
    labels: [
      {
        candidate: cand({
          id: 'cand-sap-01',
          persona: 'SAP-FI/CO-Consultant mit S/4HANA-Projekten',
          job_title: 'SAP FI/CO Consultant',
          skills: ['SAP FI', 'SAP CO', 'S/4HANA', 'SAP Customizing', 'Buchhaltung'],
          experience_years: 9,
          seniority: 'senior',
          expected_salary: 95000,
          remote_preference: 'remote',
        }),
        label: 'hired',
      },
      {
        candidate: cand({
          id: 'cand-sap-keyuser',
          persona: 'Buchhalter und SAP-FI-Key-User — Beratungs-Quereinstieg',
          job_title: 'Finanzbuchhalter / SAP Key User',
          skills: ['Buchhaltung', 'SAP FI', 'Jahresabschluss', 'Prozessoptimierung'],
          experience_years: 7,
          seniority: 'senior',
          expected_salary: 82000,
          remote_preference: 'remote',
        }),
        label: 'shortlisted',
      },
      {
        candidate: cand({
          id: 'cand-sap-sd',
          persona: 'SAP-SD-Consultant — falsches Modul',
          job_title: 'SAP SD Consultant',
          skills: ['SAP SD', 'SAP MM', 'Customizing', 'S/4HANA'],
          experience_years: 8,
          seniority: 'senior',
          expected_salary: 92000,
          remote_preference: 'remote',
        }),
        label: 'rejected',
        reason: 'Vertriebsmodul statt Finance; FI/CO-Tiefe fehlt',
      },
      {
        candidate: cand({
          id: 'cand-sap-java',
          persona: 'Java-Entwickler ohne SAP-Bezug',
          job_title: 'Software Engineer',
          skills: ['Java', 'Spring', 'REST API', 'Docker'],
          experience_years: 6,
          seniority: 'senior',
          expected_salary: 85000,
        }),
        label: 'rejected',
        reason: 'Kein SAP-Profil',
      },
    ],
  },

  // 10) HR Business Partner
  {
    job: job({
      id: 'job-hr-bp',
      title: 'HR Business Partner (m/w/d)',
      industry: 'software',
      skills: ['Personalentwicklung', 'Arbeitsrecht', 'Personio', 'HR'],
      must_haves: ['HR', 'Arbeitsrecht'],
      nice_to_haves: ['Personio', 'Employer Branding'],
      salary_min: 55000,
      salary_max: 70000,
      experience_level: 'mid',
      experience_min: 3,
      experience_max: 10,
      location: 'Berlin',
    }),
    labels: [
      {
        candidate: cand({
          id: 'cand-hr-01',
          persona: 'HR-Generalistin mit Arbeitsrecht-Schwerpunkt',
          job_title: 'HR Business Partnerin',
          skills: ['HR', 'Arbeitsrecht', 'Personalentwicklung', 'Personio', 'Onboarding'],
          experience_years: 6,
          expected_salary: 64000,
          city: 'Berlin',
        }),
        label: 'hired',
      },
      {
        candidate: cand({
          id: 'cand-hr-recruiter',
          persona: 'Recruiterin, will in die HR-Generalisten-Rolle',
          job_title: 'Talent Acquisition Managerin',
          skills: ['Recruiting', 'Bewerbermanagement', 'Employer Branding', 'HR'],
          experience_years: 4,
          expected_salary: 58000,
          city: 'Potsdam',
        }),
        label: 'shortlisted',
      },
      {
        candidate: cand({
          id: 'cand-hr-sales',
          persona: 'Sales-Manager ohne HR-Erfahrung',
          job_title: 'Sales Manager',
          skills: ['Vertrieb', 'CRM', 'Lead Generation'],
          experience_years: 8,
          seniority: 'senior',
          expected_salary: 68000,
        }),
        label: 'rejected',
        reason: 'Kein HR-Hintergrund',
      },
    ],
  },

  // 11) Key Account Manager B2B SaaS
  {
    job: job({
      id: 'job-sales-kam',
      title: 'Key Account Manager B2B SaaS',
      industry: 'software',
      skills: ['Key Account', 'B2B SaaS', 'CRM', 'Verhandlungsführung'],
      must_haves: ['Key Account', 'B2B SaaS Kenntnisse'],
      nice_to_haves: ['HubSpot', 'Salesforce'],
      salary_min: 60000,
      salary_max: 80000,
      experience_level: 'senior',
      experience_min: 4,
      experience_max: 12,
      remote_type: 'remote',
      location: 'Remote (DE)',
    }),
    labels: [
      {
        candidate: cand({
          id: 'cand-sales-01',
          persona: 'KAM mit SaaS-Track-Record, exakter Fit',
          job_title: 'Key Account Manager',
          skills: ['Key Account', 'B2B SaaS', 'Salesforce', 'Verhandlungsführung', 'Account Management'],
          experience_years: 7,
          seniority: 'senior',
          expected_salary: 75000,
          remote_preference: 'remote',
        }),
        label: 'hired',
      },
      {
        candidate: cand({
          id: 'cand-sales-bdm',
          persona: 'Business Development Manager, Software-Umfeld',
          job_title: 'Business Development Manager',
          skills: ['Business Development', 'Lead Generation', 'CRM', 'HubSpot', 'SaaS'],
          experience_years: 5,
          seniority: 'senior',
          expected_salary: 68000,
          remote_preference: 'remote',
        }),
        label: 'interviewed',
      },
      {
        candidate: cand({
          id: 'cand-sales-marketing',
          persona: 'Marketing-Managerin — verwandtes, aber anderes Feld',
          job_title: 'Marketing Managerin',
          skills: ['Content Marketing', 'SEO', 'Social Media', 'Marketing'],
          experience_years: 6,
          seniority: 'senior',
          expected_salary: 62000,
        }),
        label: 'rejected',
        reason: 'Marketing- statt Vertriebsprofil; kein Account-Ownership',
      },
    ],
  },

  // 12) Senior UX Designer
  {
    job: job({
      id: 'job-design-ux',
      title: 'Senior UX Designer',
      industry: 'software',
      skills: ['UX Design', 'Figma', 'User Research', 'Prototyping'],
      must_haves: ['UX Design', 'Figma'],
      nice_to_haves: ['Design System', 'Usability Testing'],
      salary_min: 60000,
      salary_max: 78000,
      experience_level: 'senior',
      experience_min: 4,
      experience_max: 10,
      location: 'München',
    }),
    labels: [
      {
        candidate: cand({
          id: 'cand-ux-01',
          persona: 'Senior-UX-Designerin, Research-getrieben',
          job_title: 'Senior UX Designerin',
          skills: ['UX Design', 'Figma', 'User Research', 'Prototyping', 'Design System'],
          experience_years: 7,
          seniority: 'senior',
          expected_salary: 74000,
        }),
        label: 'hired',
      },
      {
        candidate: cand({
          id: 'cand-ux-ui',
          persona: 'UI-Designer mit UX-Ambition',
          job_title: 'UI Designer',
          skills: ['UI Design', 'Figma', 'Sketch', 'Wireframing'],
          experience_years: 5,
          expected_salary: 62000,
          city: 'Augsburg',
        }),
        label: 'interviewed',
      },
      {
        candidate: cand({
          id: 'cand-ux-frontend',
          persona: 'Frontend-Entwickler mit CSS-Gefühl, kein Designer',
          job_title: 'Frontend Developer',
          skills: ['React', 'CSS', 'Tailwind', 'HTML'],
          experience_years: 5,
          expected_salary: 65000,
        }),
        label: 'rejected',
        reason: 'Entwicklungs- statt Design-Profil; keine Research-/Konzept-Erfahrung',
      },
      {
        candidate: cand({
          id: 'cand-ux-print',
          persona: 'Grafikdesignerin Print ohne digitale Produkt-Erfahrung',
          job_title: 'Grafikdesignerin',
          skills: ['Photoshop', 'Illustrator', 'InDesign', 'Print'],
          experience_years: 10,
          seniority: 'senior',
          expected_salary: 55000,
        }),
        label: 'rejected',
        reason: 'Print-Fokus; UX-Methoden und Figma fehlen',
      },
    ],
  },

  // 13) Product Owner — Muss-Kriterium als Satzfragment OHNE Keyword-Abdeckung
  {
    job: job({
      id: 'job-po',
      title: 'Product Owner (m/w/d)',
      industry: 'software',
      skills: ['Product Owner', 'Scrum', 'Backlog', 'Stakeholder Management'],
      must_haves: ['Mehrjährige Erfahrung im agilen Produktmanagement', 'Scrum'],
      nice_to_haves: ['Jira', 'OKR'],
      salary_min: 65000,
      salary_max: 85000,
      experience_level: 'senior',
      experience_min: 4,
      experience_max: 12,
      location: 'Berlin',
    }),
    labels: [
      {
        candidate: cand({
          id: 'cand-po-01',
          persona: 'Product Owner mit B2B-SaaS-Erfahrung, exakter Fit',
          job_title: 'Product Owner',
          skills: ['Product Owner', 'Scrum', 'Backlog', 'User Stories', 'Jira', 'Produktmanagement'],
          experience_years: 6,
          seniority: 'senior',
          expected_salary: 78000,
          city: 'Berlin',
        }),
        label: 'hired',
      },
      {
        candidate: cand({
          id: 'cand-po-design',
          persona: 'Produktdesignerin, wechselt Richtung Product Ownership',
          job_title: 'Product Designerin',
          skills: ['UX Design', 'User Research', 'Product Management', 'Stakeholder Management'],
          experience_years: 5,
          seniority: 'senior',
          expected_salary: 70000,
          city: 'Berlin',
        }),
        label: 'shortlisted',
      },
      {
        candidate: cand({
          id: 'cand-po-bauleiter',
          persona: 'Projektleiter Bau — Titel-Verwechslung, fachfremd',
          job_title: 'Projektmanager Hochbau',
          skills: ['Projektmanagement', 'Bauleitung', 'VOB', 'Terminplanung'],
          experience_years: 12,
          seniority: 'senior',
          expected_salary: 80000,
        }),
        label: 'rejected',
        reason: 'Bauprojekte statt Software-Produktmanagement',
      },
      {
        candidate: cand({
          id: 'cand-po-scrummaster',
          persona: 'Scrum Master ohne Produktverantwortung',
          job_title: 'Scrum Master',
          skills: ['Scrum', 'Kanban', 'Moderation', 'Jira'],
          experience_years: 5,
          seniority: 'senior',
          expected_salary: 68000,
          city: 'Berlin',
        }),
        label: 'rejected',
        reason: 'Prozess- statt Produktrolle; kein Backlog-Ownership',
      },
    ],
  },

  // 14) Security Engineer — Pflicht-Zertifikat (testet License-Kill)
  {
    job: job({
      id: 'job-security',
      title: 'Security Engineer (SOC)',
      industry: 'software',
      skills: ['SIEM', 'SOC', 'Incident Response', 'Security'],
      must_haves: ['SIEM', 'Security'],
      nice_to_haves: ['Splunk', 'Zero Trust'],
      salary_min: 70000,
      salary_max: 90000,
      experience_level: 'mid',
      experience_min: 3,
      experience_max: 9,
      required_certifications: ['CISSP'],
      location: 'Frankfurt',
    }),
    labels: [
      {
        candidate: cand({
          id: 'cand-sec-01',
          persona: 'SOC-Analystin mit CISSP und Splunk',
          job_title: 'SOC Analystin',
          skills: ['SIEM', 'Splunk', 'Incident Response', 'Security', 'SOC'],
          experience_years: 5,
          expected_salary: 82000,
          city: 'Frankfurt',
          certifications: ['CISSP'],
        }),
        label: 'hired',
      },
      {
        candidate: cand({
          id: 'cand-sec-devops',
          persona: 'DevOps-Engineer mit Security-Fokus und CISSP',
          job_title: 'DevSecOps Engineer',
          skills: ['DevSecOps', 'Kubernetes', 'Security', 'SIEM', 'Terraform'],
          experience_years: 6,
          seniority: 'senior',
          expected_salary: 86000,
          city: 'Darmstadt',
          certifications: ['CISSP'],
        }),
        label: 'interviewed',
      },
      {
        candidate: cand({
          id: 'cand-sec-compliance',
          persona: 'Compliance-Officer ohne technisches Security-Profil und ohne CISSP',
          job_title: 'Compliance Officer',
          skills: ['Compliance', 'ISO 27001', 'GDPR', 'Audit'],
          experience_years: 7,
          seniority: 'senior',
          expected_salary: 75000,
        }),
        label: 'rejected',
        reason: 'Governance- statt Engineering-Profil; CISSP fehlt',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Distraktoren: fachfremde Profile ohne Labels (strukturelle Easy Negatives)
// ---------------------------------------------------------------------------

const DISTRACTORS: GoldenCandidate[] = [
  cand({ id: 'dist-koch', persona: 'Distraktor: Koch', job_title: 'Koch', skills: ['Küchenleitung', 'HACCP', 'Menüplanung'], experience_years: 10, expected_salary: 38000 }),
  cand({ id: 'dist-pflege', persona: 'Distraktor: Pflegefachkraft', job_title: 'Pflegefachkraft', skills: ['Grundpflege', 'Dokumentation', 'Medikamentengabe'], experience_years: 8, expected_salary: 42000 }),
  cand({ id: 'dist-lagerist', persona: 'Distraktor: Lagerist', job_title: 'Fachkraft Lagerlogistik', skills: ['Kommissionierung', 'Staplerschein', 'SAP WM'], experience_years: 6, expected_salary: 34000 }),
  cand({ id: 'dist-kfz', persona: 'Distraktor: KFZ-Mechatroniker', job_title: 'KFZ-Mechatroniker', skills: ['Fahrzeugdiagnose', 'Wartung', 'Elektrik'], experience_years: 9, expected_salary: 40000 }),
  cand({ id: 'dist-lehrer', persona: 'Distraktor: Lehrer', job_title: 'Gymnasiallehrer', skills: ['Unterricht', 'Didaktik', 'Korrekturen'], experience_years: 12, seniority: 'senior', expected_salary: 60000 }),
  cand({ id: 'dist-anwalt', persona: 'Distraktor: Rechtsanwältin', job_title: 'Rechtsanwältin', skills: ['Vertragsrecht', 'Prozessführung', 'Legal Research'], experience_years: 7, seniority: 'senior', expected_salary: 85000 }),
  cand({ id: 'dist-friseur', persona: 'Distraktor: Friseurin', job_title: 'Friseurmeisterin', skills: ['Schneiden', 'Colorationen', 'Kundenberatung'], experience_years: 15, expected_salary: 30000 }),
  cand({ id: 'dist-uebersetzer', persona: 'Distraktor: Übersetzerin', job_title: 'Übersetzerin', skills: ['Übersetzung', 'Lektorat', 'CAT-Tools'], experience_years: 6, expected_salary: 42000, languages: [{ language: 'de', level: 'native' }, { language: 'en', level: 'c2' }, { language: 'fr', level: 'c1' }] }),
  cand({ id: 'dist-bauleiter', persona: 'Distraktor: Bauleiter', job_title: 'Bauleiter', skills: ['Bauleitung', 'VOB', 'Ausschreibung'], experience_years: 11, seniority: 'senior', expected_salary: 72000 }),
  cand({ id: 'dist-barkeeper', persona: 'Distraktor: Barkeeper', job_title: 'Barkeeper', skills: ['Cocktails', 'Service', 'Kasse'], experience_years: 4, expected_salary: 28000 }),
];

// ---------------------------------------------------------------------------
// Zusammenbau + Validierung
// ---------------------------------------------------------------------------

function main(): void {
  const jobs = BLOCKS.map((b) => b.job);
  const candidates = [...BLOCKS.flatMap((b) => b.labels.map((l) => l.candidate)), ...DISTRACTORS];
  const labels: GoldenLabel[] = BLOCKS.flatMap((b) =>
    b.labels.map((l) => ({
      job_id: b.job.id,
      candidate_id: l.candidate.id,
      label: l.label,
      ...(l.reason ? { reason: l.reason } : {}),
    })),
  );

  const ids = new Set<string>();
  for (const c of candidates) {
    if (ids.has(c.id)) throw new Error(`Doppelte Kandidaten-ID: ${c.id}`);
    ids.add(c.id);
  }

  const dataset: GoldenDataset = {
    version: 'v1',
    is_synthetic: true,
    reference_date: REFERENCE_DATE,
    description:
      'Synthetisches Golden-Dataset für Matching-Evals (Handarbeit, deterministisch). ' +
      'Labels: hired/interviewed/shortlisted = Positives, rejected = Hard-Negatives mit Begründung. ' +
      'Distraktoren ohne Label wirken als Easy Negatives, da pro Job der gesamte Pool gerankt wird.',
    jobs,
    candidates,
    labels,
  };

  const parsed = GoldenDatasetSchema.parse(dataset);
  writeFileSync(OUT_PATH, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');

  const pos = labels.filter((l) => l.label !== 'rejected').length;
  const neg = labels.filter((l) => l.label === 'rejected').length;
  console.log(
    `dataset.v1.json geschrieben: ${jobs.length} Jobs, ${candidates.length} Kandidaten, ` +
      `${pos} Positives, ${neg} Hard-Negatives, ${DISTRACTORS.length} Distraktoren`,
  );
}

main();
