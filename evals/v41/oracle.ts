/**
 * Musterantworten einer fachlich korrekten KI für die 25 Headhunter-Fälle.
 *
 * Damit prüfen wir OHNE KI-Zugang, ob alles um die KI herum stimmt: Profile
 * zusammenbauen, Zitate prüfen, Vorauswahl, Stufenregeln. Liefert die KI genau
 * diese Antworten, muss jede Stufe stimmen. Wie nah die echte KI an diese
 * Musterantworten kommt, misst später run-v41-catalogue.ts.
 *
 * Zitate stehen wörtlich im Kandidatenteil (Skills, Zertifikate, Branchen,
 * Titel, Berufsjahre) – sonst verwirft verifyJudgement sie.
 */

import type { Family, Seniority } from '../../supabase/functions/_shared/match-v41/profiles';
import type { ReqStatus } from '../../supabase/functions/_shared/match-v41/judge';

export interface OracleRequirement {
  text: string;
  kind: string;
  class: 'must' | 'nice' | 'trainable';
  alternatives?: string[];
  min_years?: number | null;
  regulated?: boolean;
  evidence: string[];
}

export interface Oracle {
  job: {
    families: Family[];
    seniority?: Seniority | null;
    /** Nur wenn die Anzeige keine Kunden-Einstufung hat; sonst aus unverzichtbar/verhandelbar/lernbar. */
    requirements?: OracleRequirement[];
    customer_facing?: string[];
    dropped?: string[];
  };
  cand: { families: Family[] };
  judge: {
    role_fit: 'same' | 'adjacent' | 'different' | 'unknown';
    seniority_fit: 'fits' | 'one_off' | 'far_off' | 'unknown';
    /** Kriteriumstext → [Status, wörtliches Zitat]. Nicht genannt = unknown. */
    verdicts: Record<string, [ReqStatus, string?]>;
  };
}

const must = (text: string, evidence: string[] = [text], extra: Partial<OracleRequirement> = {}): OracleRequirement =>
  ({ text, kind: 'competence', class: 'must', evidence, ...extra });

export const ORACLE: Record<string, Oracle> = {
  M01: {
    job: { families: ['customer_service'], customer_facing: ['de'] },
    cand: { families: ['customer_service'] },
    judge: {
      role_fit: 'same', seniority_fit: 'fits',
      verdicts: {
        'DSGVO im Gesundheitswesen': ['met', 'Datenschutz im Gesundheitswesen (DSGVO)'],
        'Medizinische Terminologie': ['met', 'Medizinische Grundkenntnisse / Nomenklatur'],
        'Erfahrung im telefonischen Patienten- oder Kundenservice': ['met', 'Telefonischer Kundenservice'],
        'Erfahrung mit einem KIS (z. B. Orbis)': ['met', 'Orbis KIS'],
      },
    },
  },
  M02: {
    job: {
      families: ['software_dev'], seniority: 'senior',
      requirements: [must('Java'), must('Spring Boot'), must('Microservices')],
    },
    cand: { families: ['customer_service'] },
    judge: {
      role_fit: 'different', seniority_fit: 'far_off',
      verdicts: { Java: ['not_met'], 'Spring Boot': ['not_met'], Microservices: ['not_met'] },
    },
  },
  M03: {
    job: { families: ['customer_service'], customer_facing: ['de'] },
    cand: { families: ['customer_service'] },
    judge: {
      role_fit: 'same', seniority_fit: 'fits',
      verdicts: {
        'Erfahrung in der Patientenaufnahme': ['met', 'Patientenaufnahme'],
        'Medizinische Terminologie': ['met', 'Medizinische Terminologie'],
        'Abrechnungskenntnisse EBM/GOÄ': ['met', 'Abrechnung EBM/GOÄ'],
      },
    },
  },
  M04: {
    job: { families: ['data_analytics'] },
    cand: { families: ['data_analytics'] },
    judge: {
      role_fit: 'same', seniority_fit: 'fits',
      verdicts: {
        Python: ['met', 'Python'],
        'Machine Learning': ['met', 'scikit-learn'],
        SQL: ['met', 'SQL'],
        'Erfahrung mit Data Science im Produktumfeld': ['met', 'Senior Data Scientist'],
      },
    },
  },
  M05: {
    job: { families: ['data_analytics'] },
    cand: { families: ['data_analytics'] },
    judge: {
      role_fit: 'same', seniority_fit: 'fits',
      verdicts: { Python: ['met', 'Python'], NLP: ['met', 'NLP'], SQL: ['met', 'SQL'] },
    },
  },
  M06: {
    job: { families: ['data_analytics'] },
    cand: { families: ['data_analytics'] },
    judge: {
      role_fit: 'same', seniority_fit: 'fits',
      verdicts: {
        Python: ['met', 'Python'],
        SQL: ['met', 'SQL'],
        'Airflow oder vergleichbares Orchestrierungstool': ['met', 'Airflow'],
        'Cloud Data Warehouse (BigQuery, Snowflake oder Redshift)': ['met', 'BigQuery'],
        '5+ Jahre Data Engineering': ['partial', 'Berufsjahre: 4'],
      },
    },
  },
  M07: {
    job: {
      families: ['finance_accounting'], seniority: 'mid',
      requirements: [
        { text: 'Abgeschlossene Ausbildung oder vergleichbare Qualifikation', kind: 'qualification', class: 'must', evidence: ['abgeschlossene Ausbildung oder vergleichbare Qualifikation'] },
        { text: 'Mehrjährige Berufserfahrung in der Buchhaltung', kind: 'experience', class: 'must', min_years: 2, evidence: ['mehrjährige Berufserfahrung im Bereich Buchhaltung'] },
        { text: 'Umfangreiche Kenntnisse der Rechnungslegung', kind: 'competence', class: 'must', evidence: ['umfangreiche Kenntnisse der Rechnungslegung'] },
      ],
      dropped: ['schnelle Auffassungsgabe', 'Fähigkeit, sich in komplexe Fragestellungen reinzudenken'],
    },
    cand: { families: ['finance_accounting'] },
    judge: {
      role_fit: 'same', seniority_fit: 'fits',
      verdicts: {
        'Abgeschlossene Ausbildung oder vergleichbare Qualifikation': ['met', 'Steuerfachangestellte'],
        'Mehrjährige Berufserfahrung in der Buchhaltung': ['met', 'Berufsjahre: 9'],
        'Umfangreiche Kenntnisse der Rechnungslegung': ['met', 'Monatsabschluss'],
      },
    },
  },
  M08: {
    job: { families: ['finance_accounting'] },
    cand: { families: ['finance_accounting'] },
    judge: {
      role_fit: 'same', seniority_fit: 'one_off',
      verdicts: { 'Bilanzbuchhalter IHK oder Steuerfachwirt': ['not_met'] },
    },
  },
  M09: {
    job: { families: ['finance_accounting'], customer_facing: [] },
    cand: { families: ['finance_accounting'] },
    judge: {
      role_fit: 'same', seniority_fit: 'fits',
      verdicts: {
        'Abgeschlossene kaufmännische Ausbildung': ['met', 'Steuerfachangestellter'],
        'Mehrjährige Erfahrung in der Finanzbuchhaltung': ['met', 'Berufsjahre: 12'],
        DATEV: ['met', 'DATEV'],
        'Erfahrung mit Jahresabschlussvorbereitung': ['met', 'Monats- und Jahresabschluss HGB'],
      },
    },
  },
  M10: {
    job: { families: ['controlling'] },
    cand: { families: ['controlling'] },
    judge: {
      role_fit: 'same', seniority_fit: 'fits',
      verdicts: {
        'SAP CO': ['met', 'SAP CO-OM'],
        'Kostenstellen- und Kostenträgerrechnung': ['met', 'Kostenstellenrechnung, Kostenträgerrechnung'],
        'Erfahrung im produzierenden Gewerbe': ['met', 'Automobilzulieferer'],
      },
    },
  },
  M11: {
    job: { families: ['controlling'] },
    cand: { families: ['quality'] },
    judge: {
      role_fit: 'different', seniority_fit: 'fits',
      verdicts: { 'SAP CO': ['not_met'], 'Erfahrung im produzierenden Gewerbe': ['met', 'Automobilzulieferer'] },
    },
  },
  M12: {
    job: { families: ['controlling'] },
    cand: { families: ['controlling', 'management'] },
    judge: {
      role_fit: 'same', seniority_fit: 'fits',
      verdicts: { 'SAP CO': ['met', 'SAP CO'], Monatsreporting: ['met', 'Monatsreporting'] },
    },
  },
  M13: {
    job: { families: ['software_dev'] },
    cand: { families: ['software_dev'] },
    judge: {
      role_fit: 'same', seniority_fit: 'one_off',
      verdicts: { Java: ['not_met'], 'Spring Boot': ['not_met'] },
    },
  },
  M14: {
    job: { families: ['software_dev'] },
    cand: { families: ['software_dev'] },
    judge: {
      role_fit: 'same', seniority_fit: 'fits',
      verdicts: {
        Java: ['met', 'Java'], 'Spring Boot': ['met', 'Spring Boot'], Microservices: ['met', 'Microservices'],
        Kafka: ['met', 'Kafka'], Kubernetes: ['met', 'Kubernetes'],
      },
    },
  },
  M15: {
    job: { families: ['software_dev'] },
    cand: { families: ['software_dev'] },
    judge: {
      role_fit: 'same', seniority_fit: 'unknown',
      verdicts: {
        Python: ['met', 'Python'], 'Django oder FastAPI': ['met', 'Django'],
        'REST-APIs': ['met', 'REST'], 'SQL-Datenbanken': ['met', 'PostgreSQL'],
      },
    },
  },
  M16: {
    job: { families: ['software_dev'] },
    cand: { families: ['software_dev'] },
    judge: {
      role_fit: 'same', seniority_fit: 'fits',
      verdicts: { Go: ['met', 'Go'], Kubernetes: ['met', 'Kubernetes'], 'Verteilte Systeme': ['met', 'Verteilte Systeme'] },
    },
  },
  M17: {
    job: { families: ['software_dev'] },
    cand: { families: ['software_dev'] },
    judge: {
      role_fit: 'same', seniority_fit: 'fits',
      verdicts: {
        'Kotlin oder Java': ['met', 'Kotlin'], 'Spring Boot': ['met', 'Spring Boot'],
        'Relationale Datenbanken': ['met', 'PostgreSQL'],
      },
    },
  },
  M18: {
    job: { families: ['sales_field'], customer_facing: ['de'] },
    cand: { families: ['sales_field'] },
    judge: {
      role_fit: 'same', seniority_fit: 'fits',
      verdicts: {
        'Mehrjährige Erfahrung im B2B-SaaS-Vertrieb': ['met', 'B2B SaaS'],
        'Neukundengewinnung im Enterprise-Segment': ['met', 'Enterprise Sales'],
        'Deutsch verhandlungssicher': ['met', 'DE native'],
        'MEDDIC oder vergleichbare Vertriebsmethodik': ['met', 'MEDDIC'],
      },
    },
  },
  M19: {
    job: { families: ['sales_field'] },
    cand: { families: ['sales_inside'] },
    judge: {
      role_fit: 'adjacent', seniority_fit: 'fits',
      verdicts: { 'Erfahrung im Außendienst': ['not_met'], 'Branchenkenntnis Maschinenbau': ['met', 'Maschinenbau'] },
    },
  },
  M20: {
    job: { families: ['sales_field'] },
    cand: { families: ['sales_field'] },
    judge: {
      role_fit: 'same', seniority_fit: 'fits',
      verdicts: {
        'Vertrieb von Medizinprodukten an Kliniken': ['met', 'Klinikvertrieb'],
        'Erfahrung mit Einkaufsgemeinschaften': ['met', 'Einkaufsgemeinschaften'],
      },
    },
  },
  M21: {
    job: { families: ['healthcare_nursing'], customer_facing: ['de'] },
    cand: { families: ['healthcare_nursing'] },
    judge: {
      role_fit: 'same', seniority_fit: 'fits',
      verdicts: {
        'Examen als Pflegefachfrau/Pflegefachmann oder vergleichbare Ausbildung': ['met', 'Examen Gesundheits- und Krankenpflege'],
        'Bereitschaft zum Schichtdienst': ['met', 'Schichtdienst'],
        'Fachweiterbildung Intensiv/Anästhesie': ['met', 'Fachweiterbildung Anästhesie- und Intensivpflege'],
      },
    },
  },
  M22: {
    job: { families: ['healthcare_nursing'], customer_facing: ['de'] },
    cand: { families: ['healthcare_nursing'] },
    judge: {
      role_fit: 'same', seniority_fit: 'fits',
      verdicts: {
        'Examen oder Anerkennung als Pflegefachkraft': ['met', 'Berufsurkunde Pflegefachfrau (Anerkennung)'],
        'Deutsch B2': ['met', 'telc Deutsch B2 Pflege'],
      },
    },
  },
  M23: {
    job: { families: ['healthcare_nursing'], customer_facing: ['de'] },
    cand: { families: ['administration'] },
    judge: {
      role_fit: 'different', seniority_fit: 'fits',
      verdicts: { 'Examinierte Pflegefachkraft (Altenpflege oder generalistisch)': ['not_met'] },
    },
  },
  M24: {
    job: { families: ['engineering'] },
    cand: { families: ['engineering'] },
    judge: {
      role_fit: 'same', seniority_fit: 'fits',
      verdicts: {
        'CAD (Creo oder SolidWorks)': ['met', 'Creo Parametric'],
        'Abgeschlossenes Studium Maschinenbau oder Techniker': ['met', 'Staatlich geprüfter Techniker Maschinenbau'],
        'Erfahrung im Sondermaschinenbau': ['met', 'Sondermaschinenbau'],
        'Erfahrung mit PDM-Systemen': ['met', 'Windchill PDM'],
      },
    },
  },
  M25: {
    job: { families: ['engineering'], customer_facing: ['de'] },
    cand: { families: ['engineering'] },
    judge: {
      role_fit: 'same', seniority_fit: 'fits',
      verdicts: {
        'Erfahrung in der Messtechnik': ['met', 'Industrielle Messtechnik'],
        'Kundenschulungen und Vor-Ort-Support bei deutschen Mittelstandskunden': ['partial', 'Kundenschulungen'],
      },
    },
  },
};
