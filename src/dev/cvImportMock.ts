/**
 * Nur Entwicklung: Beispiel-Ergebnis von extract-candidate-cv für Katharinas Test-Lebenslauf,
 * solange die Function nicht veröffentlicht ist. Aktiv nur mit `npm run dev` UND
 * localStorage.cvImportMock = '1'. Inhalt = das, was validateCv aus einer korrekten
 * KI-Antwort macht (siehe evals/cv/cv-extraction.test.ts).
 */

import type { CvExtraction } from '@/lib/cvImport';

// Für die Ablage (09.11.2026): je Dateiname ein anderer Test-Kandidat, damit mehrere unterscheidbar sind.
const VARIANTEN: { stichwort: string; name: string; email: string }[] = [
  { stichwort: 'mueller', name: 'Test Thomas Müller', email: 'marko.benko+thomas@bluewater-bridge.de' },
  { stichwort: 'hoffmann', name: 'Test Lena Hoffmann', email: 'marko.benko+lena@bluewater-bridge.de' },
  { stichwort: 'weber', name: 'Test Jonas Weber', email: 'marko.benko+jonas@bluewater-bridge.de' },
  { stichwort: 'schulz', name: 'Test Paula Schulz', email: 'marko.benko+paula@bluewater-bridge.de' },
  { stichwort: 'koch', name: 'Test Ben Koch', email: 'marko.benko+ben@bluewater-bridge.de' },
  // 12.11.2026: neuer Kandidat und einer ohne E-Mail für das Hochladen-Fenster
  { stichwort: 'neumann', name: 'Test Clara Neumann', email: 'marko.benko+clara@bluewater-bridge.de' },
  { stichwort: 'yildiz', name: 'Test Emre Yildiz', email: '' },
];

export function cvImportMock(dateiname = ''): CvExtraction {
  // 12.11.2026: eigener Lebenslauf mit eigenem Profil (testdaten/ablage-test/Test_Lebenslauf_Sophie_Wagner.pdf).
  if (dateiname.toLowerCase().includes('wagner')) return cvImportMockWagner();
  const cv = cvImportMockBrenner();
  const v = VARIANTEN.find((x) => dateiname.toLowerCase().includes(x.stichwort));
  return v ? { ...cv, contact: { ...cv.contact, full_name: v.name, email: v.email } } : cv;
}

function cvImportMockBrenner(): CvExtraction {
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

/** Test Sophie Wagner: Vertrieb Medizintechnik. Zitate stehen wörtlich so im Test-PDF. */
function cvImportMockWagner(): CvExtraction {
  return {
    version: 'cv-v1',
    contact: {
      full_name: 'Test Sophie Wagner', email: 'marko.benko+sophie@bluewater-bridge.de', phone: '+49 170 0000001', city: 'München',
      linkedin_url: 'linkedin.com/in/test-sophie-wagner', github_url: '', portfolio_url: '', website_url: '',
    },
    removed_sensitive: [],
    fields: {
      job_title: { value: 'Senior Key Account Managerin', source: 'cv', quote: 'Senior Key Account Managerin' },
      company: { value: 'Alpenmed Medizintechnik GmbH', source: 'cv', quote: 'Alpenmed Medizintechnik GmbH, München' },
      seniority: { value: 'senior', source: 'suggestion', quote: '' },
      leadership_scope: { value: 'functional', source: 'cv', quote: 'Fachliche Führung von 3 Außendienstmitarbeitenden' },
      leadership_team_size: { value: 3, source: 'cv', quote: 'Fachliche Führung von 3 Außendienstmitarbeitenden' },
      experience_years: { value: 10, source: 'derived', quote: 'aus 3 Stationen berechnet' },
      certificates: { value: ['Medizinprodukteberaterin nach § 83 MPDG'], source: 'cv', quote: 'Medizinprodukteberaterin nach § 83 MPDG, 2017' },
      industries: { value: ['Medizintechnik', 'Labordiagnostik'], source: 'cv', quote: 'B2B-Vertrieb von Medizinprodukten an Kliniken und Einkaufsgemeinschaften' },
      expected_salary: { value: 95000, source: 'cv', quote: 'Gehaltsvorstellung 95.000 € brutto p. a. zuzüglich variabler Anteil' },
      notice_period: { value: '3_months_eom', source: 'cv', quote: 'Kündigungsfrist 3 Monate zum Monatsende' },
      availability_date: { value: '2027-03-01', source: 'cv', quote: 'verfügbar ab 01.03.2027' },
      remote_preference: { value: 'hybrid', source: 'cv', quote: 'Hybrid, 2 Tage Büro, Raum München' },
      target_roles: { value: ['Vertriebsleitung', 'Head of Sales DACH'], source: 'cv', quote: 'Nächster Schritt: Vertriebsleitung oder Head of Sales DACH' },
      change_motivation: { value: 'Möchte ein eigenes Vertriebsteam aufbauen und führen.', source: 'cv', quote: 'Ich möchte ein eigenes Vertriebsteam aufbauen und führen.' },
    },
    stations: [
      { job_title: 'Senior Key Account Managerin', company_name: 'Alpenmed Medizintechnik GmbH', location: 'München', industry: 'Medizintechnik', start: '2022-03', end: null, is_current: true, description: 'Verantwortung für 14 Klinikverbünde in Bayern und Österreich mit 11 Mio. € Jahresumsatz\nAusschreibungen und Rahmenverträge mit Einkaufsgemeinschaften\nFachliche Führung von 3 Außendienstmitarbeitenden\nUmsatzplus von 18 % im Jahr 2024\nEinführung von Salesforce im Vertrieb Süd' },
      { job_title: 'Key Account Managerin', company_name: 'Nordwind Diagnostics GmbH', location: 'Hamburg', industry: 'Labordiagnostik', start: '2019-01', end: '2022-02', is_current: false, description: 'Betreuung von Kliniken und Laborverbünden in Norddeutschland\n9 neue Klinikkunden in drei Jahren gewonnen\nProduktvorführungen und Schulungen für Labor- und Pflegeteams' },
      { job_title: 'Vertriebsmitarbeiterin Innendienst', company_name: 'Sanitas Medical Supply GmbH', location: 'Hamburg', industry: 'Medizintechnik', start: '2016-09', end: '2018-12', is_current: false, description: 'Angebotserstellung und Auftragsabwicklung für Kliniken und Pflegeheime\nPflege der Kundendaten im CRM' },
    ],
    educations: [
      { institution: 'Hochschule für Angewandte Wissenschaften Hamburg', degree: 'B.A. International Business', field_of_study: 'International Business', graduation_year: 2016, grade: '2,1' },
    ],
    skills: [
      { name: 'Key Account Management', years: null, quote: 'Key Account Management' },
      { name: 'Ausschreibungen und Rahmenverträge', years: null, quote: 'Ausschreibungen und Rahmenverträge' },
      { name: 'Salesforce', years: 5, quote: 'Salesforce (5 Jahre)' },
      { name: 'Microsoft Excel und PowerPoint', years: null, quote: 'Microsoft Excel und PowerPoint' },
    ],
    languages: [
      { language: 'Deutsch', level: 'Muttersprache', quote: 'Deutsch Muttersprache' },
      { language: 'Englisch', level: 'C1', quote: 'Englisch verhandlungssicher (C1)' },
      { language: 'Französisch', level: 'B1', quote: 'Französisch gute Kenntnisse (B1)' },
    ],
    suggestions: {
      summary: 'Key Account Managerin mit 10 Jahren Erfahrung im B2B-Vertrieb von Medizinprodukten an Kliniken und Einkaufsgemeinschaften in Deutschland und Österreich. Gewinnt Ausschreibungen, verhandelt Rahmenverträge und führt ein Team von 3 Außendienstmitarbeitenden fachlich.',
      highlights: ['Umsatzplus von 18 % im Jahr 2024', '9 neue Klinikkunden in drei Jahren gewonnen', 'Einführung von Salesforce im Vertrieb Süd'],
      career_directions: ['Vertriebsleitung', 'Head of Sales DACH'],
    },
    rejected_quotes: 0,
    raw_text: '(Testlebenslauf Sophie Wagner)',
  };
}
