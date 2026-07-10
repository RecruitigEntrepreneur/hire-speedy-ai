/**
 * Deutsche Optionslisten für das Unternehmensprofil (Masterprompt §11).
 * Bewusst hier zentralisiert: dieselben Listen speisen später das Positions-Intake
 * (Phase 3, Prefill aus dem Profil) — eine Quelle der Wahrheit, keine Dubletten.
 */

export interface CompanyContact {
  first_name: string;
  last_name: string;
  position: string;
  email: string;
  phone: string;
  role: string;
}

export interface OfficeLocation {
  name: string;
  city: string;
  country: string;
  address?: string;
  type: string;
}

// — A. Unternehmensdaten —
export const INDUSTRIES = [
  'Industrie', 'Maschinenbau', 'Automotive', 'Medizintechnik', 'Pharma', 'Healthcare',
  'IT / Software', 'SaaS', 'Consulting', 'Finance / Banking', 'Insurance', 'Handel / Retail',
  'E-Commerce', 'Logistik', 'Bau / Immobilien', 'Energie', 'Öffentlicher Sektor', 'FMCG',
  'Lebensmittel', 'Chemie', 'Telekommunikation', 'Medien', 'Personalberatung / Recruiting',
  'Bildung / Weiterbildung', 'Sonstiges',
];

export const COMPANY_SIZE_BUCKETS = [
  '1–10', '11–50', '51–100', '101–250', '251–500',
  '501–1.000', '1.001–5.000', '5.001–10.000', '10.000+', 'Keine Angabe',
];

export const LOCATION_TYPES = [
  'Hauptsitz', 'Niederlassung', 'Produktionsstandort', 'Logistikstandort',
  'Vertriebsstandort', 'Remote-Standort', 'Projektstandort', 'Sonstiges',
];

// — B. Employer Branding —
export const EMPLOYER_SELLING_POINTS = [
  'Starkes Wachstum', 'Sicherer Arbeitgeber', 'Marktführer', 'Internationales Umfeld',
  'Moderne Führungskultur', 'Kurze Entscheidungswege', 'Hoher Gestaltungsspielraum',
  'Innovative Produkte', 'Spannende Transformation', 'Digitale Arbeitsweise', 'Familiäre Kultur',
  'Mittelständische Stabilität', 'Konzernstrukturen', 'Attraktive Vergütung', 'Flexible Arbeitszeiten',
  'Weiterbildungsmöglichkeiten', 'Aufstiegsmöglichkeiten', 'Hohe Eigenverantwortung',
  'Sinnstiftende Arbeit', 'Krisensichere Branche', 'Direkter Einfluss auf Unternehmensentwicklung',
  'Moderne Technologien', 'Starke Teamkultur',
];

// — C. Kultur & Fit —
export const CULTURE_ATTRIBUTES = [
  'Familiär', 'Professionell', 'Dynamisch', 'Schnell wachsend', 'Strukturiert', 'Hands-on',
  'Unternehmerisch', 'International', 'Bodenständig', 'Leistungsorientiert', 'Innovationsgetrieben',
  'Konzernnah', 'Mittelständisch', 'Start-up-orientiert', 'Kollaborativ', 'Direkt', 'Wertschätzend',
  'Ergebnisorientiert', 'Veränderungsstark', 'Traditionell', 'Modern', 'Datengetrieben',
  'Kundenorientiert', 'Qualitätsorientiert', 'Pragmatisch', 'Agil', 'Stabilitätsorientiert',
];

export const PERSONALITY_FIT = [
  'Kommunikativ', 'Analytisch', 'Strukturiert', 'Hands-on', 'Unternehmerisch', 'Durchsetzungsstark',
  'Empathisch', 'Strategisch', 'Operativ stark', 'Belastbar', 'Veränderungsbereit', 'Bodenständig',
  'Lösungsorientiert', 'Detailgenau', 'Zahlenaffin', 'Kreativ', 'Proaktiv', 'Loyal', 'Selbstständig',
  'Teamorientiert', 'Präsentationsstark', 'Konfliktfähig', 'Serviceorientiert', 'Diskret', 'Souverän',
  'Pragmatisch', 'Beratungsstark', 'Umsetzungsstark',
];

// — D. Benefits & Rahmenbedingungen —
export const BENEFITS = [
  'Flexible Arbeitszeiten', 'Homeoffice', 'Remote Work', '30 Tage Urlaub', 'Mehr als 30 Tage Urlaub',
  'Firmenwagen', 'Firmenhandy', 'Laptop', 'Bonus / variable Vergütung', 'Betriebliche Altersvorsorge',
  'JobRad', 'Deutschlandticket / Fahrtkostenzuschuss', 'Essenszuschuss', 'Kantine', 'Weiterbildung',
  'Zertifizierungen', 'Sprachkurse', 'Gesundheitsangebote', 'Fitnessstudio-Zuschuss', 'Mitarbeiterrabatte',
  'Teamevents', 'Sabbatical', 'Kinderbetreuung', 'Relocation Support', 'Firmenkreditkarte',
  'Aktien / VSOP / Beteiligung', 'Moderne Büroausstattung', 'Coaching / Mentoring', 'Firmenparkplatz',
  'ÖPNV-Zuschuss', 'Gesundheitsbudget', 'Workation', 'Sonstiges',
];

export const REMOTE_POLICIES = [
  'Vor Ort', 'Hybrid', 'Remote', 'Remote innerhalb Deutschlands', 'Remote innerhalb der EU',
  'Weltweit remote', 'Nach Absprache',
];

export const WORK_STYLES = [
  'Strukturiert / prozessgetrieben', 'Agil / iterativ', 'Hands-on / pragmatisch',
  'Datengetrieben', 'Ergebnisorientiert', 'Flexibel / hybrid',
];

// — F. Hiring-Prozess —
export const HIRING_PROCESS_STEPS = [
  'Telefoninterview', 'Videointerview', 'HR-Gespräch', 'Fachgespräch', 'Gespräch mit Führungskraft',
  'Gespräch mit Geschäftsführung', 'Teamkennenlernen', 'Case Study', 'Assessment', 'Probearbeitstag',
  'Referenzprüfung', 'Vertragsgespräch', 'Sonstiges',
];

export const FEEDBACK_SPEEDS = [
  'Innerhalb von 24 Stunden', 'Innerhalb von 48 Stunden', 'Innerhalb von 3 Werktagen',
  'Innerhalb von 5 Werktagen', 'Nach Absprache',
];

export const HIRING_DURATIONS = [
  'Weniger als 1 Woche', '1–2 Wochen', '2–4 Wochen', '4–6 Wochen', '6–8 Wochen',
  'Mehr als 8 Wochen', 'Rollenabhängig',
];

// — H. Ansprechpartner & Rollen —
export const CONTACT_ROLES = [
  'Hauptansprechpartner', 'HR-Ansprechpartner', 'Fachlicher Ansprechpartner',
  'Geschäftsführung', 'Vertrags-/Rechnungskontakt', 'Dashboard Admin',
];

/** Gewichtung des Profilqualität-Scores (Masterprompt §13), Summe = 100. */
export const QUALITY_WEIGHTS = {
  identification: 20,   // Firma eindeutig identifiziert (company_name + website/industry)
  description: 15,      // Unternehmensbeschreibung
  industry_locations: 15, // Branche + Standorte
  benefits: 10,         // Benefits
  selling_points: 15,   // Arbeitgeberargumente
  culture_fit: 10,      // Kultur + Fit
  contacts: 10,         // Ansprechpartner
  market: 5,            // No-Go / Zielunternehmen
} as const;
