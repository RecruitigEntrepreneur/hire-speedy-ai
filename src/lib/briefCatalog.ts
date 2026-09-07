/**
 * Der Fragenkatalog der Jobaufnahme — mit dem Ort, an dem jede Frage steht.
 *
 * =====================================================================
 * DER WORTLAUT GEHOERT MARKO. DIE TECHNIK HAENGT NUR DARAN.
 * =====================================================================
 * Jedes `text`-Feld ist woertlich aus dem Briefing-Leitfaden uebernommen, den
 * Marko aus gefuehrten Vermittlungsgespraechen zusammengetragen hat. Nicht
 * umformuliert, nicht gekuerzt, nicht "verbessert". Eine Frage aus einem
 * echten Gespraech traegt Erfahrung, die ein Sprachmodell nicht hat -- "Sind
 * bei Ihnen in der Angebotsphase schon einmal Kandidaten abgesprungen? Falls
 * ja, warum?" denkt sich keine KI aus.
 *
 * =====================================================================
 * DER ORT IST TEIL DER FRAGE
 * =====================================================================
 * Eine erste Fassung hat alle Fragen in eine Warteschlange rechts gelegt.
 * Das war falsch, und es fiel sofort auf: "In was fuer eine Range befindet
 * sich das Fixgehalt?" wurde rechts gefragt, waehrend links das Feld "Gehalt
 * von / bis" stand. Derselbe Wert, zweimal erhoben.
 *
 * Die Aufnahmeseite hat drei Orte mit verschiedenen Aufgaben:
 *   das Positionsprofil links -- WERTE, immer sichtbar, jederzeit korrigierbar
 *   der Firmenblock links oben -- was zur FIRMA gehoert, einmal, dann vererbt
 *   das Gespraech rechts     -- ERFAHRUNG, ein Gedanke nach dem anderen
 *
 * Die Regel: eine Frage bleibt GANZ und geht dorthin, wo ihr SCHWERSTER Teil
 * hingehoert.
 *   - Ist das ein Wert, den jemand in ein Formularfeld tippen wuerde, steht
 *     die Frage links und ihr Wortlaut wird die Beschriftung des Feldes.
 *   - Ist das Erfahrung, die niemand von sich aus in ein Feld schreibt, steht
 *     sie rechts im Gespraech.
 * Nach dieser Regel steht das Fixgehalt links am vorhandenen Feld, und "welche
 * negativen Auswirkungen, falls sie laenger offenbleibt" steht rechts -- das
 * erfaehrt kein Formular je.
 *
 * =====================================================================
 * WAS NICHT GEFRAGT WIRD
 * =====================================================================
 * `sources` sagt, woher ein Wert auch ohne Frage kommen darf: aus der Anzeige
 * (`ad`), aus Website und Impressum (`enrich`), aus dem Firmenprofil des
 * Kunden ab der zweiten Stelle (`inherit`), oder abgeleitet aus einer anderen
 * freien Antwort (`derive`). Gemessen an echten Anzeigen traegt `ad` wenig:
 * Vakanzgrund, Ueberstunden und Frist stehen praktisch nie drin, fuer
 * Zeiterfassung, Betriebsrat, Befristung, Monatsgehaelter und Bonus hat der
 * Parser gar kein Feld. Der Hebel ist die Vererbung ab Stelle zwei, nicht die
 * Anzeige.
 *
 * =====================================================================
 * WO DIE KI NOCH ARBEITET
 * =====================================================================
 * Nicht mehr beim Erfinden von Fragen. Sie erntet aus einer freien Antwort die
 * Zeilen, die darin mitbeantwortet wurden, meldet Widersprueche statt sie zu
 * ueberschreiben, und stellt hoechstens EINE Nachfrage -- sichtbar als solche
 * gekennzeichnet.
 *
 * =====================================================================
 * GESTRICHEN
 * =====================================================================
 * "Durchschnittsalter im Team" steht im Leitfaden und ist hier nicht
 * aufgenommen. Die Spalte jobs.team_avg_age ist am 05.09.2026 geloescht
 * worden, samt der Prompt-Zeile in parse-job-url, die das Modell anwies, aus
 * "junges dynamisches Team" die Spanne "25-35" HERZUSTELLEN. Ein AGG-Merkmal,
 * aus einer Werbefloskel erzeugt und gespeichert. Wer die Information fachlich
 * braucht, fragt nach der Erfahrung im Team, nicht nach dem Alter.
 */

export type BriefLevel = 'company' | 'position' | 'process';
export type BriefForm = 'chips' | 'multi' | 'range' | 'number' | 'date' | 'text' | 'ai';
export type RevealClass = 'safe' | 'gated';
export type BriefSource = 'ad' | 'enrich' | 'inherit' | 'derive';

/**
 * Wo die Frage auf dem Bildschirm steht.
 *   eckdaten/verguetung/skills — Bloecke des Positionsprofils links
 *   arbeitszeit                — Firmenblock links, einmal je Kunde
 *   dialog                     — das Gespraech rechts
 *   dashboard                  — gar nicht in der Aufnahme (aendert sich waehrend der Suche)
 */
export type BriefPlace =
  | 'eckdaten' | 'verguetung' | 'skills' | 'arbeitszeit' | 'dialog' | 'dashboard';

/** Wie der Wert in die Spalte geschrieben wird. */
export type BriefStore = 'text' | 'number' | 'array' | 'json' | 'bool' | 'range';

/** Eine Antwortzeile. Traegt genau EIN Feld. */
export interface BriefSlot {
  key: string;
  /** Beschriftung der Zeile — aus Markos Teilfrage. */
  label: string;
  form: BriefForm;
  chips?: string[];
  /** Chip-Text -> Wert fuer die Spalte, wo beides auseinandergeht. */
  chipValues?: Record<string, string | number | boolean>;
  /** Zielspalte in `jobs`. */
  column: string | null;
  store: BriefStore;
  required: boolean;
  weight: 1 | 2 | 3;
  reveal: RevealClass;
  sources: BriefSource[];
  askIf?: { key: string; equals: string };
  only?: 'full-time' | 'freelance';
  /**
   * Ohne diese Zeile geht es nicht weiter zu den Kontaktdaten.
   *
   * BEWUSST WENIGE. Alle acht untersuchten ATS folgen der Regel "der Ablauf
   * blockiert nicht, der Ausgang blockiert" -- und die untersuchten
   * Personalvermittler fragen vor dem ersten Menschen im Schnitt fuenf Felder.
   * Wer hier zu viel sperrt, baut die Wand wieder auf, die wir gerade
   * abgeraeumt haben.
   *
   * Gesperrt wird nur, was ein Recruiter zwingend braucht, um ueberhaupt
   * anzufangen -- und was auf der Vereinbarung steht. Alles Weitere bleibt
   * Empfehlung und laesst sich nachreichen.
   */
  blocksSubmit?: boolean;
}

export interface BriefQuestion {
  key: string;
  place: BriefPlace;
  level: BriefLevel;
  /** Reihenfolge innerhalb des Ortes. */
  order: number;
  chapter: string;
  intro?: string;
  /** MARKOS WORTLAUT. Nicht aendern. */
  text: string;
  why: string;
  slots: BriefSlot[];
}

/* ==================================================================== *
 * LINKS — WERTE. Markos Wortlaut wird zur Beschriftung.
 * ==================================================================== */

const LINKS: BriefQuestion[] = [
  {
    key: 'verguetung',
    place: 'verguetung',
    level: 'position',
    order: 10,
    chapter: 'Vergütung',
    text: 'In was für eine Range befindet sich das Fixgehalt?',
    why: 'Ohne Band kann kein Recruiter ansprechen — es ist die erste Frage jedes Kandidaten.',
    slots: [
      // Das Feld steht seit jeher links. Es hier nur zu FUEHREN statt neu zu
      // bauen ist der ganze Punkt: gefragt wird nichts doppelt.
      {
        key: 'salary_range', label: 'Gehalt von / bis (€)', form: 'range',
        column: 'salary_min', store: 'range',
        required: true, weight: 3, reveal: 'safe', sources: ['ad'], only: 'full-time',
        blocksSubmit: true,
      },
      // Das Gegenstueck fuer Contracting. Es fehlte, obwohl knownFromForm den
      // Wert schon spiegelte -- ein toter Schluessel: der Tagessatz wurde in
      // ProfileSections erhoben, zaehlte aber gegen kein Pflichtfeld. Bei einer
      // Contracting-Stelle fehlte damit die wichtigste Zahl in der
      // Vollstaendigkeit, und das Briefing galt als fertig ohne sie.
      {
        key: 'day_rate_range', label: 'Tagessatz von / bis (€)', form: 'range',
        column: 'day_rate_min', store: 'range',
        required: true, weight: 3, reveal: 'safe', sources: ['ad'], only: 'freelance',
        blocksSubmit: true,
      },
      {
        key: 'salary_months', label: 'Wie viele Monatsgehälter gibt es?', form: 'chips',
        chips: ['12', '12 + Urlaubsgeld', '13', '13,5', '14'],
        chipValues: { '12': 12, '12 + Urlaubsgeld': 12.5, '13': 13, '13,5': 13.5, '14': 14 },
        column: 'salary_months', store: 'number',
        required: true, weight: 2, reveal: 'safe', sources: ['inherit'], only: 'full-time',
      },
      {
        key: 'bonus_structure',
        label: 'Gibt es einen Bonus, wenn ja was ist der variable Anteil? (wovon ist dieser abhängig)',
        form: 'text', column: 'bonus_structure', store: 'text',
        required: true, weight: 2, reveal: 'safe', sources: ['inherit'], only: 'full-time',
      },
    ],
  },
  {
    key: 'kriterien',
    place: 'skills',
    level: 'position',
    order: 20,
    chapter: 'Skills',
    intro: 'Basierend auf dem, was wir gerade besprochen haben in Bezug auf Arbeitsalltag und Herausforderungen:',
    text: 'Welche 3 Kriterien muss der Kandidat erfüllen, damit Sie ihn direkt produktiv einsetzen können und 100 % kennenlernen wollen?',
    why: 'Macht aus einer Wunschliste eine Suchvorgabe. Alles andere ist verhandelbar.',
    slots: [
      // KEINE zweite Liste. Der Kunde markiert drei der Muss-Chips, die aus
      // der Anzeige ohnehin schon dastehen -- sonst tippt er dasselbe zweimal.
      {
        key: 'must_have_criteria', label: 'Die drei, ohne die es nicht geht', form: 'multi',
        column: 'must_have_criteria', store: 'array',
        required: true, weight: 3, reveal: 'safe', sources: [],
      },
      {
        key: 'trainable_skills', label: 'Was kann nachgeschult werden?', form: 'multi',
        column: 'trainable_skills', store: 'array',
        required: true, weight: 3, reveal: 'safe', sources: [],
      },
    ],
  },
  {
    key: 'team',
    place: 'eckdaten',
    level: 'position',
    order: 30,
    chapter: 'Eckdaten',
    text: 'Wie strukturiert sich die Abteilung von der Position?',
    why: 'Ein Alleinkämpfer-Job braucht einen anderen Menschen als eine Rolle im 15er-Team.',
    slots: [
      {
        key: 'team_size', label: 'Teamgröße', form: 'chips',
        chips: ['Alleinstellung', '2–5', '6–15', 'mehr als 15'],
        chipValues: { 'Alleinstellung': 1, '2–5': 4, '6–15': 10, 'mehr als 15': 20 },
        column: 'team_size', store: 'number',
        required: true, weight: 2, reveal: 'safe', sources: ['ad', 'derive'],
      },
      {
        key: 'remote_days', label: 'Homeoffice-Tage pro Woche', form: 'chips',
        chips: ['0', '1', '2', '3', 'frei wählbar'],
        chipValues: { '0': 0, '1': 1, '2': 2, '3': 3, 'frei wählbar': 5 },
        // Schreibt onsite_days_required (5 minus Homeoffice-Tage). Diese
        // Spalte steht seit jeher in recruiter_jobs_view und war IMMER leer,
        // weil built.remoteDays nirgends eine Eingabe hatte.
        column: 'onsite_days_required', store: 'number',
        required: true, weight: 3, reveal: 'safe', sources: ['ad', 'inherit'],
      },
      {
        key: 'contract_limitation', label: 'Ist der Vertrag unbefristet?', form: 'chips',
        chips: ['Unbefristet', 'Befristet mit Aussicht', 'Befristet', 'Projektvertrag'],
        chipValues: {
          'Unbefristet': 'unbefristet', 'Befristet mit Aussicht': 'befristet_mit_aussicht',
          'Befristet': 'befristet', 'Projektvertrag': 'projekt',
        },
        column: 'contract_limitation', store: 'text',
        required: true, weight: 2, reveal: 'safe', sources: ['ad'],
      },
    ],
  },
  {
    key: 'arbeitszeit',
    place: 'arbeitszeit',
    level: 'company',
    order: 40,
    chapter: 'Arbeitszeit & Prozess',
    text: 'Wie gestalten sich die Arbeitszeiten (Kernarbeitszeit) im Unternehmen? Wie gehen Sie mit Homeoffice und Überstunden um?',
    why: 'Der häufigste Absagegrund im Endspurt — Kandidaten fragen früh danach.',
    slots: [
      {
        key: 'core_hours', label: 'Kernarbeitszeit', form: 'chips',
        chips: ['Gleitzeit ohne Kernzeit', 'Gleitzeit mit Kernzeit', 'Feste Arbeitszeiten', 'Vertrauensarbeitszeit', 'Schichtbetrieb'],
        column: 'core_hours', store: 'text',
        required: true, weight: 2, reveal: 'safe', sources: ['ad', 'inherit'],
      },
      {
        key: 'overtime_policy', label: 'Überstunden werden …', form: 'chips',
        chips: ['ausgeglichen (Freizeit)', 'ausgezahlt', 'mit dem Gehalt abgegolten', 'fallen kaum an'],
        column: 'overtime_policy', store: 'text',
        required: true, weight: 2, reveal: 'safe', sources: ['inherit'],
      },
      {
        key: 'time_tracking_method', label: 'Wie wird die Zeit erfasst in Ihrem Unternehmen?', form: 'chips',
        chips: ['digital', 'selbst aufgeschrieben', 'Stempeluhr', 'gar nicht'],
        column: 'time_tracking_method', store: 'text',
        required: false, weight: 1, reveal: 'safe', sources: ['inherit'],
      },
    ],
  },
  {
    key: 'gremien',
    place: 'arbeitszeit',
    level: 'company',
    order: 50,
    chapter: 'Arbeitszeit & Prozess',
    text: 'Existiert in Ihrem Unternehmen ein Betriebsrat? (Falls ja, wann tagt dieser Betriebsrat?)',
    why: 'Bestimmt die Dauer bis zur Zusage stärker als jeder andere Prozessschritt.',
    slots: [
      {
        key: 'works_council', label: 'Betriebsrat', form: 'chips',
        chips: ['Ja', 'Nein'], chipValues: { Ja: true, Nein: false },
        column: 'works_council', store: 'bool',
        required: true, weight: 2, reveal: 'safe', sources: ['inherit'],
      },
      {
        key: 'works_council_meeting_schedule', label: 'Wann tagt er?', form: 'chips',
        chips: ['Wöchentlich', 'Alle zwei Wochen', 'Monatlich', 'Nach Bedarf'],
        column: 'works_council_meeting_schedule', store: 'text',
        required: false, weight: 1, reveal: 'safe', sources: ['inherit'],
        askIf: { key: 'works_council', equals: 'Ja' },
      },
    ],
  },
  {
    key: 'vertragstempo',
    place: 'arbeitszeit',
    level: 'company',
    order: 60,
    chapter: 'Arbeitszeit & Prozess',
    text: 'Wie lange benötigen Sie für die Erstellung des Vertrags? (Wird dieser digital versendet?)',
    why: 'Zwischen Zusage und Vertrag verliert man Kandidaten an schnellere Wettbewerber.',
    slots: [
      // Zwei Angaben, zwei Zeilen. In einer Zeile bildeten "1 Woche, digital"
      // und "1 Woche, per Post" beide auf 7 ab -- die Auswahl vergleicht ueber
      // den Spaltenwert, also leuchteten beide Chips zugleich, und ob digital
      // oder per Post verschickt wird, war nirgends mehr gespeichert.
      {
        key: 'contract_creation_days', label: 'Vom Ja bis zum Vertrag', form: 'chips',
        chips: ['2 Tage', '1 Woche', '2 Wochen', 'länger'],
        chipValues: { '2 Tage': 2, '1 Woche': 7, '2 Wochen': 14, 'länger': 21 },
        column: 'contract_creation_days', store: 'number',
        required: true, weight: 2, reveal: 'safe', sources: ['inherit'],
      },
      {
        key: 'contract_sent_digitally', label: 'Wird dieser digital versendet?', form: 'chips',
        chips: ['Ja', 'Nein'], chipValues: { Ja: true, Nein: false },
        column: 'contract_sent_digitally', store: 'bool',
        required: false, weight: 1, reveal: 'safe', sources: ['inherit'],
      },
    ],
  },
];

/* ==================================================================== *
 * RECHTS — DAS GESPRAECH. Erfahrung, die kein Formular je erfaehrt.
 * ==================================================================== */

const GESPRAECH: BriefQuestion[] = [
  {
    key: 'vakanz',
    place: 'dialog',
    level: 'position',
    order: 10,
    chapter: 'Timing & Vertrag',
    text: 'Warum ist die Stelle vakant? Bis wann muss sie besetzt sein und welche negativen Auswirkungen könnte es haben, falls sie länger offenbleibt?',
    why: 'Bestimmt Story, Dringlichkeit und Risiko — und steht in keiner Anzeige.',
    slots: [
      {
        key: 'vacancy_reason', label: 'Warum vakant', form: 'chips',
        chips: ['Wachstum / neu geschaffen', 'Nachbesetzung', 'Ablösung', 'Elternzeit-Vertretung', 'Nachfolge / Ruhestand'],
        column: 'vacancy_reason', store: 'text',
        required: true, weight: 3, reveal: 'safe', sources: ['ad'],
      },
      {
        key: 'hiring_deadline', label: 'Bis wann besetzt', form: 'chips',
        chips: ['So schnell wie möglich', 'In 1–3 Monaten', 'In 3–6 Monaten', 'Zeitlich flexibel'],
        column: 'hiring_urgency', store: 'text',
        required: true, weight: 2, reveal: 'safe', sources: ['ad'],
      },
      {
        key: 'negative_impact_if_unfilled', label: 'Negative Auswirkungen bei Verzug', form: 'ai',
        column: 'negative_impact_if_unfilled', store: 'text',
        required: true, weight: 2, reveal: 'gated', sources: [],
      },
    ],
  },
  {
    key: 'alltag',
    place: 'dialog',
    level: 'position',
    order: 20,
    chapter: 'Rolle & Scope',
    text: 'Können Sie mir ein Bild des Arbeitsalltags des Kandidaten malen?',
    why: 'Der Recruiter erzählt diesen Alltag im Kandidatengespräch. Ohne ihn bleibt die Rolle abstrakt.',
    slots: [
      {
        key: 'daily_routine', label: 'Der Arbeitsalltag', form: 'ai',
        column: 'daily_routine', store: 'text',
        required: true, weight: 3, reveal: 'gated', sources: ['ad'],
      },
      // Beide fallen meist aus der Alltagsschilderung ab. Sie stehen hier, um
      // GEERNTET zu werden -- gefragt werden sie nur, wenn nichts davon kam.
      {
        key: 'task_focus', label: 'Was ist der Schwerpunkt der Position?', form: 'chips',
        chips: ['Operativ / hands-on', 'Steuernd / koordinierend', 'Aufbauend / verändernd', 'Führend / entwickelnd'],
        column: 'task_focus', store: 'text',
        required: true, weight: 3, reveal: 'safe', sources: ['ad', 'derive'],
      },
      {
        key: 'task_breakdown', label: 'Wie ist die prozentuale Gewichtung der Aufgaben?', form: 'ai',
        column: 'task_breakdown', store: 'json',
        required: false, weight: 2, reveal: 'safe', sources: ['derive'],
      },
    ],
  },
  {
    key: 'entscheidung',
    place: 'dialog',
    level: 'position',
    order: 30,
    chapter: 'Prozess & Entscheider',
    text: 'An wen berichtet der Kandidat und ist jemand außer Ihnen in den finalen Entscheidungsprozess involviert?',
    why: 'Wer das weiß, argumentiert im Gespräch auf die richtige Person hin.',
    slots: [
      {
        key: 'reports_to', label: 'Berichtet an', form: 'chips',
        chips: ['Geschäftsführung', 'Bereichsleitung', 'Abteilungsleitung', 'Teamleitung'],
        column: 'reports_to', store: 'text',
        required: true, weight: 2, reveal: 'safe', sources: ['ad', 'derive'],
      },
      {
        key: 'decision_makers', label: 'Außerdem in der finalen Entscheidung', form: 'multi',
        chips: ['Niemand — ich entscheide', 'Geschäftsführung', 'HR', 'Fachbereich', 'Das Team'],
        column: 'decision_makers', store: 'array',
        required: true, weight: 2, reveal: 'safe', sources: [],
      },
    ],
  },
  {
    key: 'passung',
    place: 'dialog',
    level: 'company',
    order: 40,
    chapter: 'Arbeitsmodell & Kultur',
    text: 'Welche Art Mensch hat langfristig Erfolg bei Ihnen im Unternehmen, oder einfacher gesagt: wer hatte in der Vergangenheit keinen Erfolg?',
    why: 'Beschreibt den Menschen, nach dem gesucht wird — und erspart Gespräche, die nicht enden können.',
    slots: [
      {
        key: 'success_profile', label: 'Hat langfristig Erfolg', form: 'ai',
        column: 'success_profile', store: 'text',
        required: true, weight: 3, reveal: 'safe', sources: ['inherit'],
      },
      {
        key: 'failure_profile', label: 'Hatte keinen Erfolg', form: 'ai',
        column: 'failure_profile', store: 'text',
        required: true, weight: 3, reveal: 'safe', sources: ['inherit', 'derive'],
      },
    ],
  },
  {
    key: 'usp',
    place: 'dialog',
    level: 'position',
    order: 50,
    chapter: 'Sell & Story (EVP)',
    text: 'Welche Alleinstellungsmerkmale können Sie als Unternehmen anbieten und welche Vorteile bietet die Position selbst, die möglicherweise nur ein Experte zu schätzen weiß, wie zum Beispiel keine Kaltakquise bei Vertriebspositionen?',
    why: 'Das Argument, mit dem der Recruiter jemanden überzeugt, der gar nicht sucht.',
    slots: [
      {
        key: 'unique_selling_points', label: 'Alleinstellungsmerkmale des Unternehmens', form: 'ai',
        column: 'unique_selling_points', store: 'array',
        required: true, weight: 2, reveal: 'gated', sources: ['ad', 'inherit'],
      },
      {
        key: 'position_advantages', label: 'Vorteile der Position, die nur ein Experte schätzt', form: 'ai',
        column: 'position_advantages', store: 'array',
        required: true, weight: 2, reveal: 'gated', sources: [],
      },
    ],
  },
  {
    key: 'kultur',
    place: 'dialog',
    level: 'company',
    order: 60,
    chapter: 'Arbeitsmodell & Kultur',
    text: 'Wie beschreiben Sie Ihre Unternehmenskultur?',
    why: 'Der Recruiter muss sie glaubhaft schildern, ohne die Firma zu nennen.',
    slots: [
      {
        key: 'company_culture', label: 'Unternehmenskultur', form: 'ai',
        column: 'company_culture', store: 'text',
        required: true, weight: 2, reveal: 'gated', sources: ['ad', 'inherit'],
      },
    ],
  },
  {
    key: 'foerderung',
    place: 'dialog',
    level: 'company',
    order: 70,
    chapter: 'Sell & Story (EVP)',
    text: 'Welche konkreten Schritte unternehmen Sie im Unternehmen, um Mitarbeiter zu fördern, insbesondere in Bezug auf Gehaltsentwicklung und Karrierechancen?',
    why: 'Ohne Antwort wirkt die Stelle als Sackgasse.',
    slots: [
      {
        key: 'career_path', label: 'Konkrete Schritte', form: 'ai',
        column: 'career_path', store: 'text',
        required: true, weight: 2, reveal: 'safe', sources: ['ad', 'inherit'],
      },
      {
        key: 'career_example', label: 'Geben Sie mir doch bitte hierzu ein konkretes Beispiel!', form: 'ai',
        column: 'career_example', store: 'text',
        required: false, weight: 2, reveal: 'gated', sources: ['inherit', 'derive'],
      },
    ],
  },
  {
    key: 'vertrag',
    place: 'dialog',
    level: 'position',
    order: 80,
    chapter: 'Timing & Vertrag',
    text: 'Wie ist der Arbeitsvertrag gestaltet? Gibt es möglicherweise Themen darin, die sensibel sind oder die Kandidaten abschrecken könnten?',
    why: 'Besser der Recruiter weiß es vorher, als der Kandidat springt beim Unterschreiben ab.',
    slots: [
      {
        key: 'contract_sensitive_topics', label: 'Sensible Themen', form: 'multi',
        chips: ['Nichts davon', 'Wettbewerbsverbot', 'Rückzahlungsklausel (Weiterbildung)', 'Bereitschaftsdienst', 'Reisepflicht'],
        column: 'contract_sensitive_topics', store: 'text',
        required: true, weight: 2, reveal: 'safe', sources: [],
      },
    ],
  },
  {
    // Rang 3 und optional: ab der zweiten Stelle vererbt, und beim Erstkontakt
    // steht sie am Ende. Sie sperrt nichts -- der Kunde kann uebergeben, ohne
    // sie beantwortet zu haben.
    key: 'branche',
    place: 'dialog',
    level: 'company',
    order: 90,
    chapter: 'Sell & Story (EVP)',
    text: 'Was läuft aktuell gut in Ihrer Branche? Mit welchen Herausforderungen sind Sie aktuell in Ihrer Branche konfrontiert?',
    why: 'Das Argument, mit dem der Recruiter einen zufriedenen Kandidaten überhaupt erreicht.',
    slots: [
      {
        key: 'industry_opportunities', label: 'Was läuft gut', form: 'ai',
        column: 'industry_opportunities', store: 'text',
        required: false, weight: 1, reveal: 'gated', sources: ['inherit'],
      },
      {
        key: 'industry_challenges', label: 'Herausforderungen', form: 'ai',
        column: 'industry_challenges', store: 'text',
        required: false, weight: 1, reveal: 'gated', sources: ['inherit'],
      },
    ],
  },
];

/* ==================================================================== *
 * DASHBOARD — nicht in der Aufnahme
 * ==================================================================== *
 * Diese Werte veraendern sich waehrend der Suche. Einer von der Aufnahme ist
 * nach zwei Wochen falsch, und die Absprungsfrage lohnt erst, wenn es etwas
 * zu berichten gibt.
 */

export const DASHBOARD_FRAGEN: BriefQuestion[] = [
  {
    key: 'pipeline',
    place: 'dashboard',
    level: 'process',
    order: 10,
    chapter: 'Risiken & Ehrlichkeit',
    text: 'Wie viele Kandidaten haben Sie aktuell im Prozess, bzw. hatten im Prozess? Sind bei Ihnen in der Angebotsphase schon einmal Kandidaten abgesprungen? Falls ja, warum?',
    why: 'Sagt dem Recruiter, gegen wen er antritt und welchen Einwand er vorwegnehmen muss.',
    slots: [
      {
        key: 'candidates_in_pipeline', label: 'Aktuell im Prozess', form: 'number',
        column: 'candidates_in_pipeline', store: 'number',
        required: false, weight: 1, reveal: 'safe', sources: [],
      },
      {
        key: 'candidates_dropped_reason', label: 'Absprünge in der Angebotsphase', form: 'ai',
        column: 'candidates_dropped_reason', store: 'text',
        required: false, weight: 3, reveal: 'safe', sources: [],
      },
    ],
  },
];

export const BRIEF_QUESTIONS: BriefQuestion[] = [...LINKS, ...GESPRAECH];

/** Nur das Gespraech rechts. */
export const DIALOG_QUESTIONS = GESPRAECH;

/** Die Bloecke links, je Ort. */
export const questionsAt = (place: BriefPlace) =>
  BRIEF_QUESTIONS.filter((q) => q.place === place).sort((a, b) => a.order - b.order);

export const ALL_SLOTS = [...BRIEF_QUESTIONS, ...DASHBOARD_FRAGEN].flatMap((q) =>
  q.slots.map((s) => ({ ...s, question: q.key, place: q.place, level: q.level })),
);

/**
 * Wird nur angereichert, nie gefragt: die Mitarbeiterzahl holen wir aus dem
 * Impressum, der Kunde bestaetigt sie im Firmenblock.
 */
export const NUR_ANREICHERN: BriefSlot[] = [
  {
    key: 'company_size_band', label: 'Wie viele Mitarbeiter beschäftigen Sie aktuell?',
    form: 'chips', chips: ['bis 50', '50–250', '250–1.000', '1.000–5.000', 'mehr als 5.000'],
    column: 'company_size_band', store: 'text',
    required: false, weight: 2, reveal: 'safe', sources: ['ad', 'enrich', 'inherit'],
  },
];

/* ==================================================================== *
 * Ableitungen
 * ==================================================================== */

export interface SlotState {
  value: unknown;
  /** 'answer' = der Kunde hat es selbst gesagt. */
  from: BriefSource | 'answer';
}
export type Known = Record<string, SlotState | undefined>;

export const hatWert = (k: Known, key: string) => {
  const v = k[key]?.value;
  if (Array.isArray(v)) return v.length > 0;
  if (v && typeof v === 'object') return Object.values(v).some((x) => String(x ?? '').trim());
  return v !== null && v !== undefined && String(v).trim() !== '';
};

const sichtbar = (q: BriefQuestion, known: Known, contract: 'full-time' | 'freelance') =>
  q.slots.filter(
    (s) =>
      (!s.only || s.only === contract) &&
      (!s.askIf || String(known[s.askIf.key]?.value ?? '') === s.askIf.equals),
  );

/**
 * Die naechste GESPRAECHSFRAGE — oder null, wenn das Gespraech durch ist.
 * Fragen links stehen als Formular und werden hier nicht durchlaufen.
 */
export function nextQuestion(
  known: Known,
  contract: 'full-time' | 'freelance',
  gestellt: string[] = [],
): { frage: BriefQuestion; fragen: BriefSlot[]; bestaetigen: BriefSlot[] } | null {
  for (const q of DIALOG_QUESTIONS) {
    if (gestellt.includes(q.key)) continue;
    const alle = sichtbar(q, known, contract);
    const offen = alle.filter((s) => !hatWert(known, s.key));
    if (!offen.some((s) => s.required)) continue;
    return { frage: q, fragen: offen, bestaetigen: alle.filter((s) => hatWert(known, s.key)) };
  }
  return null;
}

/**
 * Der Fortschritt — gerechnet, nicht geschaetzt.
 *
 * Genau hier lag der Defekt: die Zahl kam aus dem Modell und konnte im selben
 * Durchgang von 85 auf 40 fallen. Diese Funktion kann das nicht.
 *
 * Gezaehlt wird ueber ALLE Orte -- ein leeres Pflichtfeld links ist genauso
 * eine Luecke wie eine unbeantwortete Gespraechsfrage. `dialog` liefert
 * zusaetzlich die Zahl fuer die Zeile "x von 9" im Gespraech.
 */
export function completeness(known: Known, contract: 'full-time' | 'freelance') {
  const pflicht = BRIEF_QUESTIONS.flatMap((q) =>
    sichtbar(q, known, contract).filter((s) => s.required).map((s) => ({ ...s, q })),
  );
  const summe = pflicht.reduce((n, s) => n + s.weight, 0);
  const erreicht = pflicht.filter((s) => hatWert(known, s.key)).reduce((n, s) => n + s.weight, 0);
  const offen = pflicht.filter((s) => !hatWert(known, s.key));
  const imGespraech = pflicht.filter((s) => s.q.place === 'dialog');
  return {
    pct: summe === 0 ? 100 : Math.round((erreicht / summe) * 100),
    offen,
    feldGesamt: pflicht.length,
    feldOffen: offen.length,
    dialogGesamt: new Set(imGespraech.map((s) => s.q.key)).size,
    dialogOffen: new Set(offen.filter((s) => s.q.place === 'dialog').map((s) => s.q.key)).size,
  };
}

export const istFertig = (known: Known, contract: 'full-time' | 'freelance') =>
  completeness(known, contract).offen.length === 0;

/** Chip-Beschriftung -> Wert fuer die Spalte. */
export const chipWert = (slot: BriefSlot, chip: string) => slot.chipValues?.[chip] ?? chip;

/** Spalten, die es noch nicht gibt. */
export const FEHLENDE_SPALTEN = ALL_SLOTS.filter((s) => s.column === null).map((s) => s.key);

/* ------------------------------------------------------------------ */

export interface CatalogState {
  known: Known;
  askedQuestions: string[];
  askedFollowups: string[];
  conflicts: { slot: string; existing: string; neu: string; note?: string }[];
  envelopePatch: Record<string, unknown>;
  /** Gerechnet, nicht geschaetzt. Wandert per Autosave in intake_drafts. */
  completeness: number;
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

/* ==================================================================== *
 * Das vorhandene Formular speist den Katalog
 * ==================================================================== *
 * WICHTIG, und der Grund fuer diese Funktion: die linke Spalte erhebt seit
 * jeher Gehalt, Muss- und Kann-Kriterien, Standort und Arbeitsmodell. Der
 * Katalog fuehrt dieselben Felder. Wuerde er sie NOCH EINMAL als eigene
 * Eingabe rendern, staende derselbe Wert zweimal auf dem Bildschirm -- genau
 * der Fehler, der die erste Fassung dieses Katalogs unbrauchbar gemacht hat
 * ("In was fuer eine Range befindet sich das Fixgehalt?" rechts, waehrend
 * links "Gehalt von / bis" stand).
 *
 * Deshalb: das Formular bleibt, wie es ist, und sein Zustand wird hier in
 * `known` uebersetzt. Neu gebaut werden nur die Felder, die es links noch
 * NICHT gibt.
 */
export function knownFromForm(args: {
  built: Record<string, any> | null;
  freelance?: Record<string, any> | null;
  contract: 'full-time' | 'freelance';
}): Known {
  const { built, freelance, contract } = args;
  const out: Known = {};
  if (!built) return out;
  const setz = (key: string, value: unknown, from: SlotState['from'] = 'answer') => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value) && value.length === 0) return;
    if (typeof value === 'string' && !value.trim()) return;
    out[key] = { value, from };
  };

  if (contract === 'freelance') {
    if (freelance?.dayRateMin || freelance?.dayRateMax) {
      setz('day_rate_range', { min: freelance.dayRateMin, max: freelance.dayRateMax });
    }
  } else if (built.salary_min || built.salary_max) {
    setz('salary_range', { min: built.salary_min, max: built.salary_max });
  }

  // Die Muss-Liste aus der Anzeige ist NICHT dasselbe wie "die drei, ohne die
  // es nicht geht" -- sie ist die Wunschliste, aus der der Kunde die drei
  // markiert. Deshalb wird must_have_criteria hier bewusst NICHT gesetzt.
  setz('nice_to_have_criteria', built.nice_to_haves, 'ad');

  return out;
}

/**
 * Die Luecken, die den Uebergang zu den Kontaktdaten sperren.
 *
 * Vorher sperrte nur der Jobtitel (`disabled={!built.title.trim()}`) -- alles
 * andere war Empfehlung, und ein Kunde konnte ohne Gehaltsband und ohne
 * Standort bis zur Beauftragung durchlaufen. Der Recruiter bekam dann eine
 * Stelle, mit der er niemanden ansprechen kann.
 *
 * Umgekehrt gilt die Regel aus der Marktrecherche: der Ablauf blockiert nicht,
 * der Ausgang blockiert -- und auch dort nur mit dem Noetigsten. Deshalb ist
 * `blocksSubmit` an genau den Zeilen gesetzt, ohne die eine Ansprache
 * unmoeglich ist. Der Rest bleibt nachreichbar.
 */
export function blockingGaps(known: Known, contract: 'full-time' | 'freelance') {
  return BRIEF_QUESTIONS.flatMap((q) =>
    q.slots
      .filter(
        (s) =>
          s.blocksSubmit &&
          (!s.only || s.only === contract) &&
          !hatWert(known, s.key),
      )
      .map((s) => ({ key: s.key, label: s.label, frage: q.key })),
  );
}
