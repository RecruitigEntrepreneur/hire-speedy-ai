/**
 * Nur Entwicklung: Beispiel-Ergebnis von extract-candidate-cv für Katharinas Test-Lebenslauf,
 * solange die Function nicht veröffentlicht ist. Aktiv nur mit `npm run dev` UND
 * localStorage.cvImportMock = '1'. Inhalt = das, was validateCv aus einer korrekten
 * KI-Antwort macht (siehe evals/cv/cv-extraction.test.ts).
 */

import type { CvExtraction } from '@/lib/cvImport';

export function cvImportMock(): CvExtraction {
  return {
    version: 'cv-v1',
    contact: {
      full_name: 'Katharina Brenner', email: 'marko.benko@bluewater-bridge.de', phone: '+49 170 1234567', city: 'München',
      linkedin_url: 'linkedin.com/in/katharina-brenner-finance', github_url: 'github.com/kbrenner-bi', portfolio_url: '', website_url: 'www.kbrenner-finance.de',
    },
    removed_sensitive: ['Geburtsdatum', 'Familienstand', 'Staatsangehörigkeit'],
    fields: {
      job_title: { value: 'Teamleiterin Rechnungswesen und Controlling', source: 'cv', quote: 'Teamleiterin Rechnungswesen und Controlling' },
      company: { value: 'Isar Maschinenbau AG', source: 'cv', quote: 'Isar Maschinenbau AG, München' },
      seniority: { value: 'senior', source: 'suggestion', quote: '' },
      leadership_scope: { value: 'disciplinary', source: 'cv', quote: 'Disziplinarische Führung von 4 Mitarbeitenden' },
      leadership_team_size: { value: 4, source: 'cv', quote: 'Führung von 4 Mitarbeitenden' },
      experience_years: { value: 12, source: 'derived', quote: 'aus 3 Stationen berechnet' },
      certificates: { value: ['Geprüfte Bilanzbuchhalterin (IHK)', 'Certified Management Accountant (CMA)', 'SAP Certified Associate – S/4HANA for Management Accounting'], source: 'cv', quote: 'Geprüfte Bilanzbuchhalterin (IHK), 2019' },
      industries: { value: ['Maschinen- und Anlagenbau', 'Personaldienstleistung', 'Groß- und Einzelhandel'], source: 'cv', quote: 'Personaldienstleistung, 38 Niederlassungen' },
      expected_salary: { value: 85000, source: 'cv', quote: '85.000 € brutto p. a.' },
      salary_minimum: { value: 80000, source: 'cv', quote: 'Untergrenze 80.000 €' },
      current_salary: { value: 76000, source: 'cv', quote: 'aktuell 76.000 €' },
      notice_period: { value: '3_months_eoq', source: 'cv', quote: '3 Monate zum Quartalsende' },
      availability_date: { value: '2027-04-01', source: 'cv', quote: 'verfügbar ab 01.04.2027' },
      remote_preference: { value: 'hybrid', source: 'cv', quote: 'Hybrid (2–3 Tage Büro)' },
      max_commute_minutes: { value: 45, source: 'cv', quote: 'maximal 45 Minuten Pendelzeit' },
      employment_type: { value: 'fulltime', source: 'cv', quote: 'Vollzeit, unbefristet' },
      relocation_willing: { value: false, source: 'cv', quote: 'Nicht geplant, lebe in München' },
      work_permit: { value: 'citizen', source: 'cv', quote: 'EU-Bürgerin, keine Arbeitserlaubnis nötig' },
      target_roles: { value: ['Finance Manager', 'Leitung Rechnungswesen und Controlling', 'Head of Accounting'], source: 'cv', quote: 'Finance Manager, Leitung Rechnungswesen und Controlling oder Head of Accounting' },
      target_industries: { value: ['Personaldienstleistung', 'Beratung', 'Industrie'], source: 'cv', quote: 'Personaldienstleistung, Beratung, Industrie' },
      blocked_companies: { value: ['Baltic Freight AG'], source: 'cv', quote: 'Baltic Freight AG (direkter Wettbewerber meines Arbeitgebers)' },
      change_motivation: { value: 'Nach der Übernahme durch einen Finanzinvestor fehlt die Entwicklungsperspektive; sucht mehr Gestaltungsspielraum und Verantwortung für Rechnungswesen und Controlling.', source: 'cv', quote: 'Ich suche mehr Gestaltungsspielraum und Verantwortung für Rechnungswesen und Controlling.' },
      career_3_5_year_plan: { value: 'In 3–5 Jahren kaufmännische Leitung in einem mittelständischen Unternehmen', source: 'cv', quote: 'In 3–5 Jahren kaufmännische Leitung in einem mittelständischen Unternehmen.' },
    },
    stations: [
      { job_title: 'Teamleiterin Rechnungswesen und Controlling', company_name: 'Isar Maschinenbau AG', location: 'München', industry: 'Maschinen- und Anlagenbau', start: '2021-04', end: null, is_current: true, description: 'Disziplinarische Führung von 4 Mitarbeitenden (Buchhaltung und Controlling)\nEigenständige Erstellung der Monats-, Quartals- und Jahresabschlüsse nach HGB\nKonzernreporting nach IFRS, Konzernkonsolidierung mit LucaNet\nKostenstellen- und Kostenträgerrechnung in SAP FI/CO (CO-OM, CO-PA)\nBudgetplanung und Forecast für ein Volumen von 180 Mio. €\nTeilprojektleitung Finance bei der Einführung von SAP S/4HANA (Go-live 2023)\nAbschlussdauer von 8 auf 5 Arbeitstage verkürzt' },
      { job_title: 'Controllerin', company_name: 'PersonalPlus Zeitarbeit GmbH', location: 'München', industry: 'Personaldienstleistung', start: '2017-09', end: '2021-03', is_current: false, description: 'Monatsabschlüsse nach HGB und Niederlassungsreporting\nProvisionsabrechnung für Niederlassungsleitungen und Vertrieb, Pflege der Provisionslogik\nDeckungsbeitragsrechnung je Kunde und Niederlassung\nBuchhaltung mit DATEV Unternehmen online, Kreditoren und Debitoren\nAufbau eines Power-BI-Reportings für die Geschäftsführung' },
      { job_title: 'Junior Controllerin', company_name: 'Elbtal Handel GmbH', location: 'Hamburg', industry: 'Groß- und Einzelhandel', start: '2014-08', end: '2017-08', is_current: false, description: 'Monatsreporting und Kostenstellenrechnung, Unterstützung beim Jahresabschluss\nAuswertungen mit Excel (Pivot, SVERWEIS, VBA) und SAP FI' },
    ],
    educations: [
      { institution: 'Universität Hamburg', degree: 'M.Sc. Betriebswirtschaftslehre', field_of_study: 'Controlling und Finanzen', graduation_year: 2014, grade: '1,7' },
      { institution: 'Universität Bremen', degree: 'B.Sc. Betriebswirtschaftslehre', field_of_study: '', graduation_year: 2012, grade: '2,0' },
    ],
    skills: [
      { name: 'HGB', years: 10, quote: 'HGB (10 Jahre)' }, { name: 'IFRS', years: 4, quote: 'IFRS (4 Jahre)' },
      { name: 'Konzernkonsolidierung', years: null, quote: 'Konzernkonsolidierung' }, { name: 'SAP FI/CO', years: 9, quote: 'SAP FI/CO (9 Jahre)' },
      { name: 'SAP S/4HANA', years: null, quote: 'SAP S/4HANA' }, { name: 'DATEV Unternehmen online', years: null, quote: 'DATEV Unternehmen online' },
      { name: 'LucaNet', years: null, quote: 'LucaNet' }, { name: 'Power BI', years: null, quote: 'Power BI' },
      { name: 'Excel (Pivot, Power Query, VBA)', years: null, quote: 'Pivot, Power Query, VBA' }, { name: 'Kostenrechnung', years: null, quote: 'Kostenstellen- und Kostenträgerrechnung' },
      { name: 'Budgetplanung und Forecast', years: null, quote: 'Budgetplanung und Forecast' },
    ],
    languages: [
      { language: 'Deutsch', level: 'Muttersprache', quote: 'Deutsch Muttersprache' },
      { language: 'Englisch', level: 'C1', quote: 'Englisch verhandlungssicher (C1)' },
      { language: 'Spanisch', level: 'A2', quote: 'Spanisch Grundkenntnisse (A2)' },
    ],
    suggestions: {
      summary: 'Finance Managerin mit über 10 Jahren Erfahrung in Rechnungswesen und Controlling, davon 4 Jahre in der Personaldienstleistung. Erstellt Monats- und Jahresabschlüsse nach HGB eigenständig und führt ein Team von 4 Mitarbeitenden. Erfahrung mit IFRS-Konzernreporting, SAP FI/CO und S/4HANA-Einführung.',
      highlights: ['Abschlussdauer von 8 auf 5 Arbeitstage verkürzt', 'Teilprojektleitung Finance bei S/4HANA-Einführung', 'Geprüfte Bilanzbuchhalterin (IHK)'],
      career_directions: ['Kaufmännische Leitung', 'Head of Finance', 'Leitung Rechnungswesen und Controlling'],
    },
    rejected_quotes: 0,
    raw_text: '(Beispieldaten)',
  };
}
