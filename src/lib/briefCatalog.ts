/**
 * Der Fragenkatalog der Jobaufnahme.
 *
 * =====================================================================
 * DER WORTLAUT GEHOERT MARKO. DIE TECHNIK HAENGT NUR DARAN.
 * =====================================================================
 * Jedes `text`-Feld unten ist woertlich aus dem Briefing-Leitfaden
 * uebernommen, den Marko aus gefuehrten Vermittlungsgespraechen
 * zusammengetragen hat. Nicht umformuliert, nicht gekuerzt, nicht
 * "verbessert".
 *
 * Ein frueherer Entwurf dieser Datei hat genau das getan -- die Fragen in
 * eigene Formulierungen uebersetzt und Antwortvorgaben dazuerfunden. Das
 * Ergebnis klang glatt und war schlechter: eine Frage aus einem echten
 * Gespraech traegt Erfahrung, die ein Sprachmodell nicht hat. "Sind bei Ihnen
 * in der Angebotsphase schon einmal Kandidaten abgesprungen? Falls ja, warum?"
 * denkt sich keine KI aus, und keine Umformulierung macht sie besser.
 *
 * Wer hier etwas aendert, aendert Markos Text. Das ist eine Absprache, keine
 * Empfehlung.
 *
 * ---------------------------------------------------------------------
 * WARUM ES DIESE DATEI GIBT
 * ---------------------------------------------------------------------
 * BEFUND (04.09.2026): Die Aufnahme hatte kein Ziel. `intake-questions` ist
 * zustandslos und entschied in jedem Aufruf neu, was noch fehlt;
 * `weighted_completeness` war eine Zahl, die das Modell selbst schaetzte.
 * Gemessen an einer echten Stelle: 97 Fragen ohne Abschluss, danach EIN
 * Muss-Kriterium in der Datenbank, Fortschritt 65 -> 85 -> 40 -> 85.
 *
 * Hier steht stattdessen, was gefragt wird und wo die Antwort landet. Daraus
 * folgt ohne Modellurteil: der Fortschritt wird GERECHNET, das Briefing ENDET,
 * und der Kunde sieht, wie viel noch kommt.
 *
 * ---------------------------------------------------------------------
 * AUFBAU: FRAGE -> ANTWORTZEILEN
 * ---------------------------------------------------------------------
 * Markos Fragen sind fuers Telefon geschrieben und fragen oft drei Dinge auf
 * einmal ("Warum ist die Stelle vakant? Bis wann muss sie besetzt sein und
 * welche negativen Auswirkungen ...?"). Genau so bleiben sie stehen -- der
 * Bildschirm zeigt die Frage einmal im Original und darunter eine
 * Antwortzeile je Teil. Kuerzen waere Informationsverlust: die drei Teile sind
 * eine Ueberlegung, keine drei Fragen.
 *
 * ---------------------------------------------------------------------
 * WAS NICHT GEFRAGT WIRD
 * ---------------------------------------------------------------------
 * `sources` sagt, woher eine Antwort auch ohne Frage kommen darf:
 *   ad      Der Parser liest es aus der Stellenanzeige.
 *   enrich  Website und Impressum.
 *   inherit Firmenprofil des Kunden -- ab der zweiten Stelle.
 *   derive  Faellt aus einer anderen freien Antwort ab (die KI erntet es).
 * Sind alle Pflichtzeilen einer Frage aus Quellen gefuellt, entfaellt sie.
 * Sind nur einige gefuellt, steht das Bekannte als Bestaetigung da und gefragt
 * wird der Rest.
 *
 * ---------------------------------------------------------------------
 * WO DIE KI NOCH ARBEITET
 * ---------------------------------------------------------------------
 * Nicht mehr beim Erfinden von Fragen. Sie tut zwei Dinge:
 *   1. ERNTEN -- aus einer freien Antwort die Zeilen fuellen, die darin
 *      mitbeantwortet wurden.
 *   2. EINE NACHFRAGE -- wenn eine Antwort etwas offen laesst, das fuer die
 *      Suche zaehlt. Hoechstens eine je Frage, sichtbar als Nachfrage
 *      gekennzeichnet, damit sie nicht mit Markos Fragen verwechselt wird.
 *
 * ---------------------------------------------------------------------
 * GESTRICHEN
 * ---------------------------------------------------------------------
 * "Durchschnittsalter im Team" steht im Leitfaden, ist hier aber bewusst
 * NICHT aufgenommen: ein AGG-Merkmal, das erhoben und gespeichert im
 * Streitfall wie eine Altersvorgabe aussieht. `jobs.team_avg_age` existiert
 * und wird heute von parse-job-url ungefragt aus Anzeigen befuellt -- die
 * Spalte gehoert geloescht.
 */

export type BriefLevel = 'company' | 'position' | 'process';
export type BriefForm = 'chips' | 'multi' | 'range' | 'number' | 'date' | 'text' | 'ai';
export type RevealClass = 'safe' | 'gated';
export type BriefSource = 'ad' | 'enrich' | 'inherit' | 'derive';

/** Eine Antwortzeile unter der Frage. Traegt genau EIN Feld. */
export interface BriefSlot {
  key: string;
  /** Kurze Beschriftung der Zeile -- aus Markos Teilfrage abgeleitet. */
  label: string;
  form: BriefForm;
  chips?: string[];
  /** Zielspalte in `jobs`. `null` = Spalte fehlt noch. */
  column: string | null;
  required: boolean;
  weight: 1 | 2 | 3;
  reveal: RevealClass;
  sources: BriefSource[];
  /** Zeile nur zeigen, wenn diese andere Zeile so beantwortet wurde. */
  askIf?: { key: string; equals: string };
  only?: 'full-time' | 'freelance';
}

export interface BriefQuestion {
  key: string;
  /** 1 = ohne die kann der Recruiter nicht anfangen. 3 = macht ihn besser. */
  rank: 1 | 2 | 3;
  level: BriefLevel;
  chapter: string;
  /** Optionaler Vorspann, ebenfalls von Marko. */
  intro?: string;
  /** MARKOS WORTLAUT. Nicht aendern. */
  text: string;
  /** Ein Satz fuer den Kunden: warum das dem Recruiter hilft. */
  why: string;
  slots: BriefSlot[];
}

/* ==================================================================== *
 * RANG 1 — ohne diese Antworten kann der Headhunter nicht anfangen
 * ==================================================================== */

const RANG_1: BriefQuestion[] = [
  {
    key: 'kriterien',
    rank: 1,
    level: 'position',
    chapter: 'Muss & Kann & Anti-Profil',
    intro:
      'Basierend auf dem, was wir gerade besprochen haben in Bezug auf Arbeitsalltag und Herausforderungen:',
    text:
      'Welche 3 Kriterien muss der Kandidat erfüllen, damit Sie ihn direkt produktiv einsetzen können und 100 % kennenlernen wollen?',
    why: 'Macht aus einer Wunschliste eine Suchvorgabe. Alles andere ist verhandelbar.',
    slots: [
      {
        key: 'must_have_criteria',
        label: 'Die 3 Kriterien',
        form: 'multi',
        column: 'must_have_criteria',
        required: true,
        weight: 3,
        reveal: 'safe',
        sources: ['ad'],
      },
      {
        key: 'trainable_skills',
        label: 'Was kann nachgeschult werden?',
        form: 'multi',
        column: 'trainable_skills',
        required: true,
        weight: 3,
        reveal: 'safe',
        sources: [],
      },
      {
        key: 'nice_to_have_criteria',
        label: 'Gibt es andere Kriterien, die nicht essentiell aber „nice to have" sind?',
        form: 'multi',
        column: 'nice_to_have_criteria',
        required: false,
        weight: 1,
        reveal: 'safe',
        sources: ['ad'],
      },
    ],
  },
  {
    key: 'budget',
    rank: 1,
    level: 'position',
    chapter: 'Vergütung & Flexibilität',
    text: 'In was für eine Range befindet sich das Fixgehalt?',
    why: 'Ohne Band kann kein Recruiter ansprechen — es ist die erste Frage jedes Kandidaten.',
    slots: [
      {
        key: 'salary_range',
        label: 'Range Fixgehalt',
        form: 'range',
        column: 'salary_min',
        required: true,
        weight: 3,
        reveal: 'safe',
        sources: ['ad'],
        only: 'full-time',
      },
      {
        key: 'day_rate_range',
        label: 'Range Tagessatz',
        form: 'range',
        column: 'day_rate_min',
        required: true,
        weight: 3,
        reveal: 'safe',
        sources: ['ad'],
        only: 'freelance',
      },
      {
        key: 'salary_months',
        label: 'Wie viele Monatsgehälter gibt es?',
        form: 'chips',
        chips: ['12', '12 + Urlaubsgeld', '13', '13,5', '14'],
        column: null, // Migration noetig
        required: true,
        weight: 2,
        reveal: 'safe',
        sources: ['inherit'],
        only: 'full-time',
      },
      {
        key: 'bonus_structure',
        label: 'Gibt es einen Bonus, wenn ja was ist der variable Anteil? (wovon ist dieser abhängig)',
        form: 'ai',
        column: 'bonus_structure',
        required: true,
        weight: 2,
        reveal: 'safe',
        sources: ['ad', 'inherit'],
        only: 'full-time',
      },
    ],
  },
  {
    key: 'vakanz',
    rank: 1,
    level: 'position',
    chapter: 'Timing & Vertrag',
    text:
      'Warum ist die Stelle vakant? Bis wann muss sie besetzt sein und welche negativen Auswirkungen könnte es haben, falls sie länger offenbleibt?',
    why: 'Bestimmt Story, Dringlichkeit und Risiko — und steht in keiner Anzeige.',
    slots: [
      {
        key: 'vacancy_reason',
        label: 'Warum vakant',
        form: 'chips',
        chips: [
          'Wachstum / neu geschaffen',
          'Nachbesetzung',
          'Ablösung',
          'Elternzeit-Vertretung',
          'Nachfolge / Ruhestand',
        ],
        column: 'vacancy_reason',
        required: true,
        weight: 3,
        reveal: 'safe',
        sources: ['ad'],
      },
      {
        key: 'hiring_deadline',
        label: 'Bis wann besetzt',
        form: 'chips',
        chips: ['So schnell wie möglich', 'In 1–3 Monaten', 'In 3–6 Monaten', 'Zeitlich flexibel'],
        column: 'deadline',
        required: true,
        weight: 2,
        reveal: 'safe',
        sources: ['ad'],
      },
      {
        key: 'negative_impact_if_unfilled',
        label: 'Negative Auswirkungen',
        form: 'ai',
        column: 'negative_impact_if_unfilled',
        required: false,
        weight: 1,
        reveal: 'gated',
        sources: ['derive'],
      },
    ],
  },
  {
    key: 'alltag',
    rank: 1,
    level: 'position',
    chapter: 'Rolle & Scope',
    text: 'Können Sie mir ein Bild des Arbeitsalltags des Kandidaten malen?',
    why: 'Der Recruiter erzählt diesen Alltag im Kandidatengespräch. Ohne ihn bleibt die Rolle abstrakt.',
    slots: [
      {
        key: 'daily_routine',
        label: 'Arbeitsalltag',
        form: 'ai',
        column: 'daily_routine',
        required: true,
        weight: 3,
        reveal: 'gated',
        sources: ['ad'],
      },
      {
        key: 'task_breakdown',
        label: 'Wie ist die prozentuale Gewichtung der Aufgaben?',
        form: 'ai',
        column: 'task_breakdown',
        required: false,
        weight: 2,
        reveal: 'safe',
        sources: ['derive'],
      },
      {
        key: 'task_focus',
        label: 'Was ist der Schwerpunkt der Position?',
        form: 'chips',
        chips: [
          'Operativ / hands-on',
          'Steuernd / koordinierend',
          'Aufbauend / verändernd',
          'Führend / entwickelnd',
        ],
        column: 'task_focus',
        required: true,
        weight: 3,
        reveal: 'safe',
        sources: ['ad', 'derive'],
      },
    ],
  },
];

/* ==================================================================== *
 * RANG 2 — braucht der Headhunter im Kandidatengespräch
 * ==================================================================== */

const RANG_2: BriefQuestion[] = [
  {
    key: 'entscheidung',
    rank: 2,
    level: 'position',
    chapter: 'Prozess & Entscheider',
    text:
      'An wen berichtet der Kandidat und ist jemand außer Ihnen in den finalen Entscheidungsprozess involviert?',
    why: 'Wer das weiß, argumentiert im Gespräch auf die richtige Person hin.',
    slots: [
      {
        key: 'reports_to',
        label: 'Berichtet an',
        form: 'chips',
        chips: ['Geschäftsführung', 'Bereichsleitung', 'Abteilungsleitung', 'Teamleitung'],
        column: 'reports_to',
        required: true,
        weight: 2,
        reveal: 'safe',
        sources: ['ad'],
      },
      {
        key: 'decision_makers',
        label: 'Außerdem in der finalen Entscheidung',
        form: 'multi',
        chips: ['Niemand — ich entscheide', 'Geschäftsführung', 'HR', 'Fachbereich', 'Das Team'],
        column: 'decision_makers',
        required: true,
        weight: 2,
        reveal: 'safe',
        sources: [],
      },
    ],
  },
  {
    key: 'passung',
    rank: 2,
    level: 'company',
    chapter: 'Arbeitsmodell & Kultur',
    text:
      'Welche Art Mensch hat langfristig Erfolg bei Ihnen im Unternehmen, oder einfacher gesagt: wer hatte in der Vergangenheit keinen Erfolg?',
    why: 'Beschreibt den Menschen, nach dem gesucht wird — und erspart Gespräche, die nicht enden können.',
    slots: [
      {
        key: 'success_profile',
        label: 'Hat langfristig Erfolg',
        form: 'ai',
        column: 'success_profile',
        required: true,
        weight: 3,
        reveal: 'safe',
        sources: ['inherit', 'derive'],
      },
      {
        key: 'failure_profile',
        label: 'Hatte keinen Erfolg',
        form: 'ai',
        column: 'failure_profile',
        required: true,
        weight: 3,
        reveal: 'safe',
        sources: ['inherit'],
      },
    ],
  },
  {
    key: 'usp',
    rank: 2,
    level: 'position',
    chapter: 'Sell & Story (EVP)',
    text:
      'Welche Alleinstellungsmerkmale können Sie als Unternehmen anbieten und welche Vorteile bietet die Position selbst, die möglicherweise nur ein Experte zu schätzen weiß, wie zum Beispiel keine Kaltakquise bei Vertriebspositionen?',
    why: 'Das Argument, mit dem der Recruiter jemanden überzeugt, der gar nicht sucht.',
    slots: [
      {
        key: 'unique_selling_points',
        label: 'Alleinstellungsmerkmale des Unternehmens',
        form: 'ai',
        column: 'unique_selling_points',
        required: true,
        weight: 2,
        reveal: 'gated',
        sources: ['ad', 'inherit'],
      },
      {
        key: 'position_advantages',
        label: 'Vorteile der Position, die nur ein Experte schätzt',
        form: 'ai',
        column: 'position_advantages',
        required: true,
        weight: 2,
        reveal: 'gated',
        sources: [],
      },
    ],
  },
  {
    key: 'arbeitszeit',
    rank: 2,
    level: 'company',
    chapter: 'Arbeitsmodell & Kultur',
    text:
      'Wie gestalten sich die Arbeitszeiten (Kernarbeitszeit) im Unternehmen? Wie gehen Sie mit Homeoffice und Überstunden um?',
    why: 'Der häufigste Absagegrund im Endspurt — Kandidaten fragen früh danach.',
    slots: [
      {
        key: 'core_hours',
        label: 'Kernarbeitszeit',
        form: 'chips',
        chips: [
          'Gleitzeit ohne Kernzeit',
          'Gleitzeit mit Kernzeit',
          'Feste Arbeitszeiten',
          'Vertrauensarbeitszeit',
          'Schichtbetrieb',
        ],
        column: 'core_hours',
        required: true,
        weight: 2,
        reveal: 'safe',
        sources: ['ad', 'inherit'],
      },
      {
        key: 'onsite_days_required',
        label: 'Homeoffice',
        form: 'chips',
        chips: ['Kein Homeoffice', '1 Tag', '2 Tage', '3 Tage', 'Frei wählbar / remote'],
        column: 'onsite_days_required',
        required: true,
        weight: 3,
        reveal: 'safe',
        sources: ['ad', 'inherit'],
      },
      {
        key: 'overtime_policy',
        label: 'Überstunden',
        form: 'chips',
        chips: ['ausgeglichen (Freizeit)', 'ausgezahlt', 'mit dem Gehalt abgegolten', 'fallen kaum an'],
        column: 'overtime_policy',
        required: true,
        weight: 2,
        reveal: 'safe',
        sources: ['inherit'],
      },
      {
        key: 'time_tracking_method',
        label: 'Wie wird die Zeit erfasst in Ihrem Unternehmen?',
        form: 'chips',
        chips: ['digital', 'selbst aufgeschrieben', 'Stempeluhr', 'gar nicht'],
        column: 'time_tracking_method',
        required: false,
        weight: 1,
        reveal: 'safe',
        sources: ['inherit'],
      },
    ],
  },
  {
    key: 'vertrag',
    rank: 2,
    level: 'position',
    chapter: 'Timing & Vertrag',
    text:
      'Wie ist der Arbeitsvertrag gestaltet? Ist er unbefristet und gibt es möglicherweise Themen darin, die sensibel sind oder die Kandidaten abschrecken könnten?',
    why: 'Besser der Recruiter weiß es vorher, als der Kandidat springt beim Unterschreiben ab.',
    slots: [
      {
        key: 'contract_type_kind',
        label: 'Vertragsart',
        form: 'chips',
        chips: ['Unbefristet', 'Befristet mit Aussicht', 'Befristet', 'Projektvertrag'],
        column: 'contract_type',
        required: true,
        weight: 2,
        reveal: 'safe',
        sources: ['ad'],
      },
      {
        key: 'contract_sensitive_topics',
        label: 'Sensible Themen im Vertrag',
        form: 'multi',
        chips: [
          'Nichts davon',
          'Wettbewerbsverbot',
          'Rückzahlungsklausel (Weiterbildung)',
          'Bereitschaftsdienst',
          'Reisepflicht',
        ],
        column: 'contract_sensitive_topics',
        required: true,
        weight: 2,
        reveal: 'safe',
        sources: [],
      },
    ],
  },
];

/* ==================================================================== *
 * RANG 3 — macht den Headhunter besser, geht aber auch ohne
 * ==================================================================== */

const RANG_3: BriefQuestion[] = [
  {
    key: 'kultur',
    rank: 3,
    level: 'company',
    chapter: 'Arbeitsmodell & Kultur',
    text: 'Wie beschreiben Sie Ihre Unternehmenskultur?',
    why: 'Der Recruiter muss sie glaubhaft schildern, ohne die Firma zu nennen.',
    slots: [
      {
        key: 'company_culture',
        label: 'Unternehmenskultur',
        form: 'ai',
        column: 'company_culture',
        required: true,
        weight: 2,
        reveal: 'gated',
        sources: ['ad', 'inherit'],
      },
    ],
  },
  {
    key: 'foerderung',
    rank: 3,
    level: 'company',
    chapter: 'Sell & Story (EVP)',
    text:
      'Welche konkreten Schritte unternehmen Sie im Unternehmen, um Mitarbeiter zu fördern, insbesondere in Bezug auf Gehaltsentwicklung und Karrierechancen?',
    why: 'Ohne Antwort wirkt die Stelle als Sackgasse.',
    slots: [
      {
        key: 'career_path',
        label: 'Konkrete Schritte',
        form: 'ai',
        column: 'career_path',
        required: true,
        weight: 2,
        reveal: 'safe',
        sources: ['ad', 'inherit'],
      },
      {
        key: 'career_example',
        label: 'Geben Sie mir doch bitte hierzu ein konkretes Beispiel!',
        form: 'ai',
        column: 'career_example',
        required: false,
        weight: 2,
        reveal: 'gated',
        sources: ['inherit', 'derive'],
      },
    ],
  },
  {
    key: 'abteilung',
    rank: 3,
    level: 'position',
    chapter: 'Rolle & Scope',
    text: 'Wie strukturiert sich die Abteilung von der Position? Wie ist das Organigramm strukturiert?',
    why: 'Zeigt, ob jemand Zuarbeit bekommt oder alles selbst macht.',
    slots: [
      {
        key: 'team_size',
        label: 'Teamgröße',
        form: 'chips',
        chips: ['Alleinstellung', '2–5 Personen', '6–15 Personen', 'mehr als 15'],
        column: 'team_size',
        required: true,
        weight: 2,
        reveal: 'safe',
        sources: ['ad', 'derive'],
      },
      {
        key: 'department_structure',
        label: 'Aufbau der Abteilung',
        form: 'ai',
        column: 'department_structure',
        required: false,
        weight: 2,
        reveal: 'safe',
        sources: ['ad', 'derive'],
      },
    ],
  },
  {
    key: 'gremien',
    rank: 3,
    level: 'company',
    chapter: 'Prozess & Entscheider',
    text: 'Existiert in Ihrem Unternehmen ein Betriebsrat? (Falls ja, wann tagt dieser Betriebsrat?)',
    why: 'Bestimmt die Dauer bis zur Zusage stärker als jeder andere Prozessschritt.',
    slots: [
      {
        key: 'works_council',
        label: 'Betriebsrat',
        form: 'chips',
        chips: ['Ja', 'Nein'],
        column: 'works_council',
        required: true,
        weight: 2,
        reveal: 'safe',
        sources: ['enrich', 'inherit'],
      },
      {
        key: 'works_council_meeting_schedule',
        label: 'Wann tagt er?',
        form: 'chips',
        chips: ['Wöchentlich', 'Alle zwei Wochen', 'Monatlich', 'Nach Bedarf'],
        column: 'works_council_meeting_schedule',
        required: false,
        weight: 1,
        reveal: 'safe',
        sources: ['inherit'],
        askIf: { key: 'works_council', equals: 'Ja' },
      },
    ],
  },
  {
    key: 'vertragstempo',
    rank: 3,
    level: 'company',
    chapter: 'Prozess & Entscheider',
    text: 'Wie lange benötigen Sie für die Erstellung des Vertrags? (Wird dieser digital versendet?)',
    why: 'Zwischen Zusage und Vertrag verliert man Kandidaten an schnellere Wettbewerber.',
    slots: [
      {
        key: 'contract_creation_days',
        label: 'Dauer bis zum Vertrag',
        form: 'chips',
        chips: [
          'in 2 Tagen, digital',
          'in einer Woche, digital',
          'in einer Woche, per Post',
          'länger als eine Woche',
        ],
        column: 'contract_creation_days',
        required: true,
        weight: 2,
        reveal: 'safe',
        sources: ['inherit'],
      },
    ],
  },
  {
    key: 'branche',
    rank: 3,
    level: 'company',
    chapter: 'Sell & Story (EVP)',
    text:
      'Was läuft aktuell gut in Ihrer Branche? Mit welchen Herausforderungen sind Sie aktuell in Ihrer Branche konfrontiert?',
    why: 'Das Argument, mit dem der Recruiter einen zufriedenen Kandidaten überhaupt erreicht.',
    slots: [
      {
        key: 'industry_opportunities',
        label: 'Was läuft gut',
        form: 'ai',
        column: 'industry_opportunities',
        required: false,
        weight: 1,
        reveal: 'gated',
        sources: ['inherit'],
      },
      {
        key: 'industry_challenges',
        label: 'Herausforderungen',
        form: 'ai',
        column: 'industry_challenges',
        required: false,
        weight: 1,
        reveal: 'gated',
        sources: ['inherit'],
      },
    ],
  },
];

/* ==================================================================== *
 * PROZESS — nicht in der Aufnahme, sondern im Dashboard
 * ==================================================================== *
 * Diese Werte veraendern sich waehrend der Suche. Ein Wert von der Aufnahme
 * ist nach zwei Wochen falsch, und die Absprungsfrage lohnt sich erst, wenn
 * es etwas zu berichten gibt.
 */

export const PROZESS_FRAGEN: BriefQuestion[] = [
  {
    key: 'pipeline',
    rank: 2,
    level: 'process',
    chapter: 'Risiken & Ehrlichkeit',
    text:
      'Wie viele Kandidaten haben Sie aktuell im Prozess, bzw. hatten im Prozess? Sind bei Ihnen in der Angebotsphase schon einmal Kandidaten abgesprungen? Falls ja, warum?',
    why: 'Sagt dem Recruiter, gegen wen er antritt und welchen Einwand er vorwegnehmen muss.',
    slots: [
      {
        key: 'candidates_in_pipeline',
        label: 'Aktuell im Prozess',
        form: 'number',
        column: 'candidates_in_pipeline',
        required: false,
        weight: 1,
        reveal: 'safe',
        sources: [],
      },
      {
        key: 'candidates_dropped_reason',
        label: 'Absprünge in der Angebotsphase',
        form: 'ai',
        column: 'candidates_dropped_reason',
        required: false,
        weight: 3,
        reveal: 'safe',
        sources: [],
      },
    ],
  },
];

/** Die Fragen der Aufnahme, in der Reihenfolge, in der sie gestellt werden. */
export const BRIEF_QUESTIONS: BriefQuestion[] = [...RANG_1, ...RANG_2, ...RANG_3];

/** Alle Zeilen, ueber alle Fragen -- fuer Fortschritt und Abbildung. */
export const ALL_SLOTS: (BriefSlot & { question: string; level: BriefLevel })[] =
  [...BRIEF_QUESTIONS, ...PROZESS_FRAGEN].flatMap((q) =>
    q.slots.map((s) => ({ ...s, question: q.key, level: q.level })),
  );

/**
 * Wird nur angereichert, nie gefragt.
 *
 * Steht bewusst ausserhalb der Fragen: die Mitarbeiterzahl holen wir uns aus
 * dem Impressum, der Kunde bestaetigt sie im Firmenblock. Eine Frage danach
 * waere verschenkte Aufmerksamkeit.
 */
export const NUR_ANREICHERN: BriefSlot[] = [
  {
    key: 'company_size_band',
    label: 'Wie viele Mitarbeiter beschäftigen Sie aktuell?',
    form: 'chips',
    chips: ['bis 50', '50–250', '250–1.000', '1.000–5.000', 'mehr als 5.000'],
    column: 'company_size_band',
    required: false,
    weight: 2,
    reveal: 'safe',
    sources: ['ad', 'enrich', 'inherit'],
  },
];

/* ==================================================================== *
 * Ableitungen
 * ==================================================================== */

export interface SlotState {
  value: unknown;
  /** Woher der Wert kommt. 'answer' = der Kunde hat geantwortet. */
  from: BriefSource | 'answer';
}
export type Known = Record<string, SlotState | undefined>;

const hat = (k: Known, key: string) => {
  const v = k[key]?.value;
  if (Array.isArray(v)) return v.length > 0;
  return v !== null && v !== undefined && String(v).trim() !== '';
};

const sichtbareSlots = (q: BriefQuestion, known: Known, contract: 'full-time' | 'freelance') =>
  q.slots.filter(
    (s) =>
      (!s.only || s.only === contract) &&
      (!s.askIf || String(known[s.askIf.key]?.value ?? '') === s.askIf.equals),
  );

/**
 * Die naechste Frage -- oder null, wenn das Briefing fertig ist.
 *
 * Eine Frage entfaellt, sobald alle ihre Pflichtzeilen aus Quellen gefuellt
 * sind. Sind nur einige gefuellt, bleibt sie: `bestaetigen` zeigt das
 * Bekannte, `fragen` sind die offenen Zeilen.
 */
export function nextQuestion(
  known: Known,
  contract: 'full-time' | 'freelance',
  gestellt: string[] = [],
): { frage: BriefQuestion; fragen: BriefSlot[]; bestaetigen: BriefSlot[] } | null {
  for (const q of BRIEF_QUESTIONS) {
    if (gestellt.includes(q.key)) continue;
    const sichtbar = sichtbareSlots(q, known, contract);
    const offen = sichtbar.filter((s) => !hat(known, s.key));
    if (!offen.some((s) => s.required)) continue;
    return { frage: q, fragen: offen, bestaetigen: sichtbar.filter((s) => hat(known, s.key)) };
  }
  return null;
}

/**
 * Der Fortschritt -- gerechnet, nicht geschaetzt.
 *
 * Genau hier lag der Defekt: die Zahl kam aus dem Modell und konnte im selben
 * Durchgang von 85 auf 40 fallen. Diese Funktion kann das nicht.
 */
export function completeness(known: Known, contract: 'full-time' | 'freelance') {
  const pflicht = BRIEF_QUESTIONS.flatMap((q) =>
    sichtbareSlots(q, known, contract)
      .filter((s) => s.required)
      .map((s) => ({ ...s, question: q.key })),
  );
  const summe = pflicht.reduce((n, s) => n + s.weight, 0);
  const erreicht = pflicht.filter((s) => hat(known, s.key)).reduce((n, s) => n + s.weight, 0);
  const offen = pflicht.filter((s) => !hat(known, s.key));
  return {
    pct: summe === 0 ? 100 : Math.round((erreicht / summe) * 100),
    offen,
    /** "7 von 12" -- Fragen, nicht Zeilen. Das versteht der Kunde. */
    fragenGesamt: new Set(pflicht.map((s) => s.question)).size,
    fragenOffen: new Set(offen.map((s) => s.question)).size,
  };
}

export const istFertig = (known: Known, contract: 'full-time' | 'freelance') =>
  completeness(known, contract).offen.length === 0;

/** Spalten, die es noch nicht gibt. Grundlage fuer die Migration. */
export const FEHLENDE_SPALTEN = ALL_SLOTS.filter((s) => s.column === null).map((s) => s.key);

/**
 * Der Zustand des katalog-gefuehrten Briefings.
 *
 * Steht hier und nicht in CatalogBriefing.tsx: eine Komponentendatei, die
 * ausser Komponenten auch Konstanten exportiert, bricht Vite Fast Refresh
 * ("export is incompatible") -- und inhaltlich gehoert der Zustand ohnehin
 * zum Katalog, nicht zu seiner Darstellung.
 */
export interface CatalogState {
  known: Known;
  askedQuestions: string[];
  askedFollowups: string[];
  conflicts: { slot: string; existing: string; neu: string; note?: string }[];
  envelopePatch: Record<string, unknown>;
  /** Gerechnet, nicht geschaetzt. Wandert per Autosave in intake_drafts. */
  completeness: number;
  /** null = noch nicht geprueft, false = KI nicht erreichbar (der Katalog laeuft weiter). */
  aiAvailable: boolean | null;
  model?: string;
}

export const EMPTY_CATALOG_STATE: CatalogState = {
  known: {},
  askedQuestions: [],
  askedFollowups: [],
  conflicts: [],
  envelopePatch: {},
  completeness: 0,
  aiAvailable: null,
};
