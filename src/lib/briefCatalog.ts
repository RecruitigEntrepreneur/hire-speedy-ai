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
/**
 * `short` ist eine einzeilige Eingabe: eine Uhrzeitspanne ist kein Aufsatz,
 * und ein zweizeiliges Textfeld daneben laedt zu einem ein.
 */
export type BriefForm = 'chips' | 'multi' | 'range' | 'number' | 'date' | 'short' | 'text' | 'ai';
export type RevealClass = 'safe' | 'gated';
/**
 * Woher der Wert einer Zeile kommen KANN.
 *
 * 'ad' ist seit dem 09.09.2026 kein Wunsch mehr, sondern eine Zusage: das
 * Parser-Schema fragt jedes dieser Felder ab, und catalogFromParsed ordnet es
 * zu -- notfalls ueber Schlagworte, damit die Anzeige den Chip nicht woertlich
 * treffen muss. Vorher trugen 16 von 39 Zeilen 'ad', und zwei davon hatten
 * ueberhaupt keinen Weg dorthin.
 */
export type BriefSource = 'ad' | 'enrich' | 'inherit' | 'derive';

/**
 * Wo die Frage auf dem Bildschirm steht.
 *   eckdaten/verguetung/skills — Bloecke des Positionsprofils links
 *   arbeitszeit                — Firmenblock links, einmal je Kunde
 *   dialog                     — das Gespraech rechts
 *   dashboard                  — gar nicht in der Aufnahme (aendert sich waehrend der Suche)
 */
export type BriefPlace =
  | 'firma' | 'eckdaten' | 'verguetung' | 'skills' | 'arbeitszeit' | 'dialog' | 'dashboard';

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
  /**
   * Zeigen, wenn die andere Zeile diesen CHIP-TEXT traegt (nicht den
   * Speicherwert). Eine Liste heisst "einer davon" -- die Kernzeit-Nachfrage
   * gilt fuer drei Antworten, und drei fast gleiche Zeilen mit je einer
   * Bedingung waeren dieselbe Regel dreimal.
   */
  askIf?: { key: string; equals: string | string[] };
  /** Umkehrung: Zeile nur zeigen, wenn die andere NICHT so beantwortet ist. */
  askIfNot?: { key: string; equals: string | string[] };
  /**
   * Zeile nur zeigen, solange die genannte Zeile LEER ist.
   *
   * Fuer den Rueckfall: die Groessenbaender erscheinen nur, wenn keine
   * Mitarbeiterzahl dasteht. Steht eine da, ist das Band abgeleitet und eine
   * zweite Auswahl daneben waere die Einladung, sich selbst zu widersprechen.
   */
  askIfLeer?: string;
  /** Beispiel im leeren Feld. Nur fuer `short`/`text` sinnvoll. */
  placeholder?: string;
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
  /**
   * Diese Zeile wird LINKS im Formular gerendert, nicht im Katalog.
   *
   * Vorher stand dafuer eine fest verdrahtete Zweierliste in CatalogFields
   * (`salary_range || day_rate_range`). Jede weitere Formularzeile, die in den
   * Katalog aufgenommen wurde, waere damit doppelt auf dem Bildschirm
   * gelandet. Der Katalog spiegelt sie ueber knownFromForm und zaehlt sie in
   * der Vollstaendigkeit mit -- er erhebt sie nur nicht noch einmal.
   */
  imFormular?: boolean;
  /** Contracting-Fassung von Beschriftung und Auswahl. */
  labelFreelance?: string;
  chipsFreelance?: string[];
  chipValuesFreelance?: Record<string, string | number | boolean>;
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
  /**
   * Kurzfassung fuer ein FORMULAR.
   *
   * Markos `text` ist fuer das Telefonat geschrieben und traegt dort seinen
   * Vorspann ("basierend auf dem, was wir gerade besprochen haben"). Ueber
   * einer statischen Liste behauptet dieser Satz ein Gespraech, das nicht
   * stattgefunden hat -- und 62 Woerter ueber zwei Listenzeilen sind eine
   * Wand. Wo eine Katalogfrage links als Formular steht, rendert die
   * Oberflaeche `kurz`; `text` und `intro` bleiben unangetastet, weil sie im
   * Gespraech gelten.
   */
  kurz?: string;
  /**
   * Contracting-Fassung von `text` bzw. `kurz`.
   *
   * BEFUND (08.09.2026, Durchklick): Der Contracting-Zweig unterschied
   * strukturell (24 statt 26 Angaben, `only` auf Slot-Ebene), aber der
   * WORTLAUT blieb Festanstellung. Einem Projektleiter, der einen
   * Freiberufler fuer neun Monate sucht, stand woertlich da: "Wer hat
   * LANGFRISTIG Erfolg bei Ihnen IM UNTERNEHMEN", "Welche Schritte
   * unternehmen Sie, um Mitarbeiter zu foerdern, insbesondere
   * Gehaltsentwicklung und Karrierechancen", "Wie ist der ARBEITSVERTRAG
   * gestaltet".
   *
   * Ein zweiter Katalog waere der Anfang von zwei Wahrheiten. Deshalb
   * Ueberschreibungen an derselben Zeile: wo nichts steht, gilt Markos
   * Wortlaut fuer beide Welten.
   */
  textFreelance?: string;
  kurzFreelance?: string;
  /** Ganze Frage nur fuer diese Vertragsart. */
  only?: 'full-time' | 'freelance';
  why: string;
  slots: BriefSlot[];
}

/* ==================================================================== *
 * LINKS — WERTE. Markos Wortlaut wird zur Beschriftung.
 * ==================================================================== */

/**
 * Jedes Groessensignal auf die fuenf Banden des Katalogs.
 *
 * BEFUND (07.09.2026): Die Mitarbeiterzahl liegt an DREI Stellen vor, bevor
 * irgendjemand fragt -- im Impressum (`Anreicherung.headcount`), im Link bzw.
 * Entwurf (`company_size`) und in der Anzeige (`company_size_estimate`). Alle
 * drei kamen in unterschiedlicher Form: Zahl, "51-200", "Konzern". Keine
 * einzige wurde uebernommen; `company_size_band` blieb leer, und der
 * Headhunter las in seinem Expose "Unternehmensgroesse: Nicht angegeben".
 *
 * Eine Spanne wird ueber ihre Mitte eingeordnet: "200-500" ist ein
 * 350-Personen-Haus, nicht ein 200er. Ein offenes Ende ("1000+", "mehr als
 * 500") zaehlt eine Person darueber, damit es in die naechsthoehere Bande
 * faellt statt auf der Grenze zu sitzen.
 */
export const GROESSENBANDEN = ['bis 50', '50–250', '250–1.000', '1.000–5.000', 'mehr als 5.000'] as const;

export function sizeBand(signal: number | string | null | undefined): string | null {
  if (signal === null || signal === undefined) return null;
  const text = String(signal).trim();
  if (!text) return null;

  const zahlen = (text.match(/\d[\d.']*/g) ?? [])
    .map((z) => Number(z.replace(/[.']/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0);

  let n: number | null = null;
  if (zahlen.length >= 2) n = (zahlen[0] + zahlen[1]) / 2;
  else if (zahlen.length === 1) n = zahlen[0];

  if (n !== null) {
    if (/\+|mehr als|ueber |über |ab /i.test(text)) n += 1;
    if (n <= 50) return GROESSENBANDEN[0];
    if (n <= 250) return GROESSENBANDEN[1];
    if (n <= 1000) return GROESSENBANDEN[2];
    if (n <= 5000) return GROESSENBANDEN[3];
    return GROESSENBANDEN[4];
  }

  // Freitext ohne Zahl. Nur was eindeutig ist -- lieber nichts vorschlagen als
  // etwas Falsches, das der Kunde dann wegklicken muss.
  const t = text.toLowerCase();
  if (/start-?up|gr(ue|ü)ndung/.test(t)) return GROESSENBANDEN[0];
  if (/konzern|enterprise|gro(ss|ß)unternehmen/.test(t)) return GROESSENBANDEN[4];
  /* "Mittelstand" steht hier bewusst NICHT. Gemessen am 07.09.2026: eine
     Anzeige mit "340 Mitarbeitenden" wurde vom Parser als "Mittelstand"
     zurueckgegeben, und die Zuordnung auf "50-250" schlug einen falschen
     Wert vor, den der Kunde bestaetigt haette. Der deutsche Mittelstand
     reicht von 50 bis ueber 3.000 -- das ist keine Bande. */
  return null;
}

/**
 * Die eine Frage, die im Firmenblock steht.
 *
 * Sie war vorher als `NUR_ANREICHERN` deklariert -- ein Export, den nichts
 * importierte. Der Kommentar behauptete "der Kunde bestaetigt sie im
 * Firmenblock"; tatsaechlich gab es dort kein Feld dafuer. Die Zahl aus dem
 * Impressum stand in der Vorschlagsliste, wurde beim Uebernehmen verworfen,
 * und `company_size_band` blieb leer -- eine Spalte, die in
 * recruiter_jobs_view steht und die format-job-for-recruiters als
 * "Unternehmensgroesse: Nicht angegeben" ausgibt.
 *
 * Jetzt ist sie eine Frage wie jede andere: vorausgefuellt aus Impressum,
 * Link oder Anzeige, mit der Herkunft daneben, und der Kunde bestaetigt oder
 * korrigiert sie mit einem Klick.
 */
const FIRMA: BriefQuestion[] = [
  {
    key: 'firmengroesse',
    place: 'firma',
    level: 'company',
    order: 5,
    chapter: 'Unternehmen',
    text: 'Wie viele Mitarbeiter beschäftigen Sie aktuell?',
    why: 'Der Kandidat fragt es im ersten Gespräch, und der Recruiter braucht es für die Ansprache.',
    slots: [
      {
        /**
         * Die Zahl, nicht die Kategorie.
         *
         * BEFUND (09.09.2026): Die Anzeige sagte "rund 340 Mitarbeitende",
         * sizeBand() machte daraus "250-1.000", und die 340 war weg -- eine
         * Spanne mit Faktor vier. Darunter stand "aus der Anzeige -- bitte
         * pruefen", der Kunde bestaetigte also eine Spanne, die er nie genannt
         * hatte, und danach stand sie als seine Angabe da.
         *
         * Das Band bleibt trotzdem: es ist das, was der Recruiter VOR dem
         * Reveal liest. Eine genaue Kopfzahl neben Branche und Region ist
         * praktisch eine Adresse. Die Zahl steht deshalb reveal-gesperrt.
         */
        key: 'company_headcount', label: 'Mitarbeitende', form: 'number',
        column: 'company_headcount', store: 'number',
        required: false, weight: 2, reveal: 'gated', sources: ['ad', 'enrich', 'inherit'],
      },
      {
        // Rueckfall, wenn keine Zahl dasteht. Sonst wird das Band aus der
        // Zahl abgeleitet -- siehe bandAusKopfzahl.
        key: 'company_size_band', label: 'Größenklasse', form: 'chips',
        chips: [...GROESSENBANDEN],
        column: 'company_size_band', store: 'text',
        required: false, weight: 2, reveal: 'safe', sources: ['ad', 'enrich', 'inherit'],
        askIfLeer: 'company_headcount',
      },
    ],
  },
];

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
        blocksSubmit: true, imFormular: true,
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
        blocksSubmit: true, imFormular: true,
      },
      /*
        BEFUND (08.09.2026): Diese drei hatten Spalten in `jobs`, Eingabefelder
        im Formular -- und keinen Katalogeintrag. Sie zaehlten in keiner
        Vollstaendigkeit mit und sperrten nichts. Ein Contracting-Briefing galt
        als fertig, sobald der Tagessatz dastand: ohne Laufzeit, ohne
        Auslastung. Beides gehoert nach der Marktlage zu den Angaben, an denen
        ein Freiberufler eine Anfrage annimmt oder ablehnt.
      */
      {
        key: 'contract_duration_months', label: 'Laufzeit (Monate)', form: 'number',
        column: 'contract_duration_months', store: 'number',
        required: true, weight: 3, reveal: 'safe', sources: ['ad'], only: 'freelance',
        blocksSubmit: true, imFormular: true,
      },
      {
        key: 'utilization_days_per_week', label: 'Auslastung (Tage pro Woche)', form: 'number',
        column: 'utilization_days_per_week', store: 'number',
        required: true, weight: 3, reveal: 'safe', sources: ['ad'], only: 'freelance',
        blocksSubmit: true, imFormular: true,
      },
      {
        // Nicht sperrend: die Verlaengerung ist das staerkste Argument fuer den
        // Freiberufler, aber eine Aufnahme ohne sie ist trotzdem vermittelbar.
        key: 'extension_possible', label: 'Verlängerung möglich', form: 'chips',
        chips: ['Ja', 'Nein'], chipValues: { Ja: true, Nein: false },
        column: 'extension_possible', store: 'bool',
        required: false, weight: 2, reveal: 'safe', sources: ['ad'], only: 'freelance',
        imFormular: true,
      },
      {
        key: 'salary_months', label: 'Wie viele Monatsgehälter gibt es?', form: 'chips',
        chips: ['12', '12 + Urlaubsgeld', '13', '13,5', '14'],
        chipValues: { '12': 12, '12 + Urlaubsgeld': 12.5, '13': 13, '13,5': 13.5, '14': 14 },
        column: 'salary_months', store: 'number',
        required: true, weight: 2, reveal: 'safe', sources: ['ad', 'inherit'], only: 'full-time',
      },
      // Ein Bonus ist keine Erzaehlung, sondern eine Zahl und eine
      // Bezugsgroesse. Als Textfeld stand hier ein grosser Schreibkasten
      // mitten im Verguetungsblock -- zwei Klicks liefern dieselbe Auskunft
      // strukturierter, und der Block bleibt eine Uebersicht.
      {
        key: 'bonus_structure', label: 'Gibt es einen Bonus?', form: 'chips',
        chips: ['Nein', 'bis 10 %', 'bis 20 %', 'mehr als 20 %'],
        column: 'bonus_structure', store: 'text',
        required: true, weight: 2, reveal: 'safe', sources: ['ad', 'inherit'], only: 'full-time',
      },
      {
        key: 'bonus_basis', label: 'Wovon hängt er ab?', form: 'multi',
        chips: ['Unternehmensergebnis', 'Persönliche Ziele', 'Teamziele', 'Umsatz'],
        // Faellt beim Abbilden mit bonus_structure in eine Textzeile zusammen --
        // eine eigene Spalte waere fuer diese Detailtiefe zu viel.
        column: null, store: 'text',
        required: false, weight: 1, reveal: 'safe', sources: ['ad'], only: 'full-time',
        askIfNot: { key: 'bonus_structure', equals: 'Nein' },
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
    // Im Formular reicht das. Die drei Knoepfe heissen "unverzichtbar",
    // "verhandelbar" und "lernbar" -- sie erklaeren sich selbst.
    kurz: 'Wie hart ist jedes dieser Kriterien?',
    why: 'Macht aus einer Wunschliste eine Suchvorgabe. Alles andere ist verhandelbar.',
    slots: [
      // KEINE zweite Liste. Der Kunde markiert drei der Muss-Chips, die aus
      // der Anzeige ohnehin schon dastehen -- sonst tippt er dasselbe zweimal.
      {
        key: 'must_have_criteria', label: 'Die drei, ohne die es nicht geht', form: 'multi',
        column: 'must_have_criteria', store: 'array',
        required: true, weight: 3, reveal: 'safe', sources: ['ad'],
      },
      {
        key: 'trainable_skills', label: 'Was kann nachgeschult werden?', form: 'multi',
        column: 'trainable_skills', store: 'array',
        required: true, weight: 3, reveal: 'safe', sources: ['ad'],
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
    textFreelance: 'Wie ist das Projektteam aufgestellt, und wer arbeitet noch extern mit?',
    why: 'Ein Alleinkämpfer-Job braucht einen anderen Menschen als eine Rolle im 15er-Team.',
    slots: [
      {
        /**
         * Die Zahl, nicht das Band.
         *
         * BEFUND (09.09.2026): Die Chips speicherten Mittelwerte -- "6-15"
         * legte 10 ab, "mehr als 15" legte 20 ab. Der Recruiter las
         * "Teamgroesse 10" als Tatsache, und gesagt hatte das niemand.
         * Anders als bei der Firmengroesse gibt es hier kein
         * Anonymitaetsargument: ein Team von acht Leuten verraet kein
         * Unternehmen. Das Band hatte schlicht keinen Grund.
         */
        key: 'team_size', label: 'Teamgröße', form: 'number',
        placeholder: 'Anzahl Personen',
        column: 'team_size', store: 'number',
        required: true, weight: 2, reveal: 'safe', sources: ['ad', 'derive'],
      },
      {
        key: 'remote_days', label: 'Homeoffice-Tage pro Woche', form: 'chips',
        labelFreelance: 'Tage remote pro Woche',
        /**
         * Bis 5, und "frei waehlbar" traegt keine Zahl mehr.
         *
         * BEFUND (09.09.2026): Die Chips endeten bei 3, eine echte
         * Vollremote-Stelle hatte also gar keinen. Und "frei waehlbar" legte
         * die 5 ab -- daraus wurde onsite_days_required = 0, der Recruiter las
         * "null Tage vor Ort". "Frei waehlbar" heisst aber, dass der KANDIDAT
         * entscheidet, nicht dass die Stelle remote ist. Zwei verschiedene
         * Sachverhalte auf einem Speicherwert.
         *
         * "frei waehlbar" hat jetzt bewusst KEINEN chipValue: der Chip legt
         * seinen Text ab, `store: 'number'` verwirft ihn beim Schreiben, und
         * die Spalte bleibt leer statt falsch. Die Auskunft selbst geht ueber
         * remote_days_flexible raus (abgeleitet in draftToJobRow).
         */
        chips: ['0', '1', '2', '3', '4', '5', 'frei wählbar'],
        chipValues: { '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5 },
        // Schreibt onsite_days_required (5 minus Homeoffice-Tage). Diese
        // Spalte steht seit jeher in recruiter_jobs_view und war IMMER leer,
        // weil built.remoteDays nirgends eine Eingabe hatte.
        column: 'onsite_days_required', store: 'number',
        required: true, weight: 3, reveal: 'safe', sources: ['ad', 'inherit'],
      },
      {
        // Ein Dienstvertrag hat eine Laufzeit -- sie steht im Konditionsblock
        // direkt darunter. Die Frage stand im Contracting bis 08.09.2026
        // unmittelbar ueber "KONDITIONEN (CONTRACTING)".
        key: 'contract_limitation', label: 'Ist der Vertrag unbefristet?', form: 'chips',
        only: 'full-time',
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
    textFreelance: 'Wie frei teilt sich die Person die Zeit ein — und wie weisen Sie die Leistung nach?',
    why: 'Der häufigste Absagegrund im Endspurt — Kandidaten fragen früh danach.',
    slots: [
      {
        key: 'core_hours', label: 'Kernarbeitszeit', form: 'chips',
        chips: ['Gleitzeit ohne Kernzeit', 'Gleitzeit mit Kernzeit', 'Feste Arbeitszeiten', 'Vertrauensarbeitszeit', 'Schichtbetrieb'],
        labelFreelance: 'Anwesenheit',
        chipsFreelance: ['Frei einteilbar', 'Feste Termine, sonst frei',
                         'Kernzeiten einzuhalten', 'Schicht- oder Dienstplan'],
        column: 'core_hours', store: 'text',
        required: true, weight: 2, reveal: 'safe', sources: ['ad', 'inherit'],
      },
      {
        /**
         * "Gleitzeit mit Kernzeit" ist keine Auskunft, es ist eine Kategorie.
         * Der Kandidat fragt nach der Uhrzeit, und der Recruiter stand bisher
         * ohne da. Gefragt wird nur, wo es eine Uhrzeit ZU nennen gibt:
         * Vertrauensarbeitszeit und Gleitzeit ohne Kernzeit haben keine, dort
         * waere die Zeile eine Frage nach etwas, das es nicht gibt.
         *
         * Verglichen wird gegen den Chip-TEXT, deshalb stehen die Antworten
         * beider Vertragsarten in derselben Liste -- bei Contracting heissen
         * dieselben Faelle anders.
         */
        key: 'core_hours_detail', label: 'Von wann bis wann?', form: 'short',
        placeholder: 'z. B. 09:00–15:00',
        labelFreelance: 'Welche Zeiten genau?',
        column: 'core_hours_detail', store: 'text',
        required: false, weight: 1, reveal: 'safe', sources: ['ad', 'inherit'],
        askIf: {
          key: 'core_hours',
          equals: [
            'Gleitzeit mit Kernzeit', 'Feste Arbeitszeiten', 'Schichtbetrieb',
            'Kernzeiten einzuhalten', 'Feste Termine, sonst frei', 'Schicht- oder Dienstplan',
          ],
        },
      },
      {
        // Beim Tagessatz gibt es keine Ueberstunden -- Mehraufwand ist eine
        // Frage des Satzes, nicht der Regelung.
        key: 'overtime_policy', label: 'Überstunden werden …', form: 'chips',
        only: 'full-time',
        chips: ['ausgeglichen (Freizeit)', 'ausgezahlt', 'mit dem Gehalt abgegolten', 'fallen kaum an'],
        column: 'overtime_policy', store: 'text',
        required: true, weight: 2, reveal: 'safe', sources: ['ad', 'inherit'],
      },
      {
        key: 'time_tracking_method', label: 'Wie wird die Zeit erfasst in Ihrem Unternehmen?', form: 'chips',
        chips: ['digital', 'selbst aufgeschrieben', 'Stempeluhr', 'gar nicht'],
        labelFreelance: 'Wie wird die Leistung nachgewiesen?',
        chipsFreelance: ['Timesheet digital', 'Timesheet auf Papier', 'Monatsbericht', 'Keine Erfassung'],
        column: 'time_tracking_method', store: 'text',
        required: false, weight: 1, reveal: 'safe', sources: ['ad', 'inherit'],
      },
    ],
  },
  {
    key: 'gremien',
    // Ein Freiberufler unterliegt keiner Mitbestimmung -- und ein
    // Projektleiter weiss ohnehin nicht, wann das Gremium tagt.
    only: 'full-time',
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
        required: true, weight: 2, reveal: 'safe', sources: ['ad', 'inherit'],
      },
      {
        key: 'works_council_meeting_schedule', label: 'Wann tagt er?', form: 'chips',
        chips: ['Wöchentlich', 'Alle zwei Wochen', 'Monatlich', 'Nach Bedarf'],
        column: 'works_council_meeting_schedule', store: 'text',
        required: false, weight: 1, reveal: 'safe', sources: ['ad', 'inherit'],
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
        /**
         * BEFUND (09.09.2026): "laenger" legte 21 Tage ab. Der Kunde sagte
         * "laenger als zwei Wochen", gespeichert wurden drei -- es koennen drei
         * Monate sein. Mit genau dieser Zahl verspricht der Recruiter einem
         * Kandidaten mit konkurrierendem Angebot einen Zeitplan.
         *
         * Statt einer Folgezeile nur fuer "laenger" fragt das Feld jetzt
         * direkt die Tage. Eine Folgezeile haette einen zweiten Speicherort
         * fuer dieselbe Zahl gebraucht -- oder eine Ableitung, die den Chip
         * beim Tippen wieder abwaehlt.
         */
        key: 'contract_creation_days', label: 'Vom Ja bis zum Vertrag (Tage)', form: 'number',
        placeholder: 'z. B. 7',
        column: 'contract_creation_days', store: 'number',
        required: true, weight: 2, reveal: 'safe', sources: ['ad', 'inherit'],
      },
      {
        key: 'contract_sent_digitally', label: 'Wird dieser digital versendet?', form: 'chips',
        chips: ['Ja', 'Nein'], chipValues: { Ja: true, Nein: false },
        column: 'contract_sent_digitally', store: 'bool',
        required: false, weight: 1, reveal: 'safe', sources: ['ad', 'inherit'],
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
    textFreelance: 'Warum brauchen Sie die Kapazität von außen? Ab wann — und was passiert, wenn niemand da ist?',
    why: 'Bestimmt Story, Dringlichkeit und Risiko — und steht in keiner Anzeige.',
    slots: [
      {
        key: 'vacancy_reason', label: 'Warum vakant', form: 'chips',
        chips: ['Wachstum / neu geschaffen', 'Nachbesetzung', 'Ablösung', 'Elternzeit-Vertretung', 'Nachfolge / Ruhestand'],
        // Die KI-Nachfrage hat den Fehler selbst gemeldet: sie erkannte
        // "Neues Projekt" und fand keinen Chip dafuer.
        labelFreelance: 'Warum von außen',
        chipsFreelance: ['Neues Projekt', 'Lastspitze', 'Ausfall überbrücken',
                         'Know-how fehlt intern', 'Bis zur Festbesetzung'],
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
        key: 'negative_impact_if_unfilled', label: 'Negative Auswirkungen bei Verzug',
        chipsFreelance: ['Der Termin beim Kunden wackelt', 'Wir zahlen extern teurer dazu',
                         'Das Projekt verzögert sich', 'Die Anlage geht später in Betrieb',
                         'Interne Leute werden abgezogen'], form: 'ai',
        chips: [
          'Die Arbeit bleibt am Team hängen',
          'Wir zahlen extern dazu',
          'Projekte verzögern sich',
          'Das Team ist ohne Leitung',
          'Abschlüsse geraten in Verzug',
        ],
        column: 'negative_impact_if_unfilled', store: 'text',
        required: true, weight: 2, reveal: 'gated', sources: ['ad'],
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
        required: false, weight: 2, reveal: 'safe', sources: ['ad', 'derive'],
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
        // Im Projektgeschaeft berichtet niemand an eine Hierarchieebene. Die
        // KI hatte "Projektleiter Automatisierung" erkannt und fand nichts.
        chipsFreelance: ['Projektleitung', 'Fachbereichsleitung', 'Bereichsleitung', 'Geschäftsführung'],
        column: 'reports_to', store: 'text',
        required: true, weight: 2, reveal: 'safe', sources: ['ad', 'derive'],
      },
      {
        key: 'decision_makers', label: 'Außerdem in der finalen Entscheidung', form: 'multi',
        chips: ['Niemand — ich entscheide', 'Geschäftsführung', 'HR', 'Fachbereich', 'Das Team'],
        column: 'decision_makers', store: 'array',
        required: true, weight: 2, reveal: 'safe', sources: ['ad'],
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
    textFreelance: 'Was macht einen Externen bei Ihnen erfolgreich — und woran ist schon einer gescheitert?',
    why: 'Beschreibt den Menschen, nach dem gesucht wird — und erspart Gespräche, die nicht enden können.',
    slots: [
      {
        key: 'success_profile', label: 'Hat langfristig Erfolg', form: 'ai',
        labelFreelance: 'Liefert bei uns',
        chipsFreelance: [
          'Liefert ab Tag eins ohne Einarbeitung',
          'Holt die Fachbereiche ab',
          'Dokumentiert für die Übergabe',
          'Arbeitet selbstständig ohne Rückfragen',
        ],
        chips: [
          'Packt selbst an',
          'Kommt aus dem Mittelstand',
          'Arbeitet gern eigenverantwortlich',
          'Sucht kurze Wege statt Prozess',
        ],
        column: 'success_profile', store: 'text',
        required: true, weight: 3, reveal: 'safe', sources: ['ad', 'inherit'],
      },
      {
        key: 'failure_profile', label: 'Hatte keinen Erfolg', form: 'ai',
        labelFreelance: 'Hat bei uns nicht funktioniert',
        chipsFreelance: [
          'Brauchte zu lange bis zur Produktivität',
          'Hat beraten statt umgesetzt',
          'Hinterließ keine Dokumentation',
          'Kam mit unseren Prozessen nicht zurecht',
        ],
        chips: [
          'Wartet auf Anweisungen',
          'Kam aus dem Konzern und vermisste Zuarbeit',
          'Zu wenig Hands-on',
          'Passte menschlich nicht ins Team',
        ],
        column: 'failure_profile', store: 'text',
        required: true, weight: 3, reveal: 'safe', sources: ['ad', 'inherit', 'derive'],
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
    textFreelance: 'Was macht dieses Projekt attraktiv — Technik, Referenz, oder die Aussicht auf Anschluss?',
    why: 'Das Argument, mit dem der Recruiter jemanden überzeugt, der gar nicht sucht.',
    slots: [
      {
        key: 'unique_selling_points', label: 'Alleinstellungsmerkmale des Unternehmens', form: 'ai',
        labelFreelance: 'Was das Projekt attraktiv macht',
        chipsFreelance: [
          'Moderne Technik statt Altbestand',
          'Referenzfähiges Vorhaben',
          'Klarer Auftrag, keine Politik',
          'Aussicht auf Anschlussprojekte',
        ],
        column: 'unique_selling_points', store: 'array',
        required: true, weight: 2, reveal: 'gated', sources: ['ad', 'inherit'],
      },
      {
        key: 'position_advantages', label: 'Vorteile der Position, die nur ein Experte schätzt', form: 'ai',
        labelFreelance: 'Was nur ein Fachmann zu schätzen weiß',
        chipsFreelance: [
          'Entscheidungen ohne Gremienschleife',
          'Zugriff auf die Systeme ab Tag eins',
          'Fachlich sauber aufgesetztes Projekt',
          'Ansprechpartner mit Entscheidungsbefugnis',
        ],
        chips: [
          'Volle Verantwortung statt Zuarbeit',
          'Direkter Draht zur Geschäftsführung',
          'Aufbau statt Verwaltung',
          'Moderne Systeme im Einsatz',
        ],
        column: 'position_advantages', store: 'array',
        required: true, weight: 2, reveal: 'gated', sources: ['ad'],
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
    // Ein Externer auf zwoelf Monate wird nicht Teil der Kultur -- er muss
    // wissen, wie die Zusammenarbeit laeuft. Und die Frage stand bisher als
    // einzige ganz ohne Startvorschlag da; im Testlauf begann die Antwort
    // eines Projektleiters mit "Schwer zu sagen."
    textFreelance: 'Wie arbeitet man bei Ihnen zusammen — worauf sollte sich ein Externer einstellen?',
    why: 'Der Recruiter muss sie glaubhaft schildern, ohne die Firma zu nennen.',
    slots: [
      {
        key: 'company_culture', label: 'Unternehmenskultur', form: 'ai',
        labelFreelance: 'Zusammenarbeit im Projekt',
        chipsFreelance: [
          'Kurze Wege, wenig Abstimmung',
          'Feste Termine, klare Zuständigkeiten',
          'Konzernprozesse, viele Beteiligte',
          'Wir siezen uns',
          'Wir duzen uns',
        ],
        column: 'company_culture', store: 'text',
        required: true, weight: 2, reveal: 'gated', sources: ['ad', 'inherit'],
      },
    ],
  },
  {
    key: 'foerderung',
    // Es gibt keine Laufbahn auf neun Monate. Die Frage stand im Contracting
    // mit vollem Wortlaut da: "Gehaltsentwicklung und Karrierechancen".
    only: 'full-time',
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
        required: false, weight: 2, reveal: 'gated', sources: ['ad', 'inherit', 'derive'],
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
    textFreelance: 'Wie ist der Dienstvertrag gestaltet? Gibt es Klauseln, die Freiberufler abschrecken?',
    why: 'Besser der Recruiter weiß es vorher, als der Kandidat springt beim Unterschreiben ab.',
    slots: [
      {
        key: 'contract_sensitive_topics', label: 'Sensible Themen', form: 'multi',
        chips: ['Nichts davon', 'Wettbewerbsverbot', 'Rückzahlungsklausel (Weiterbildung)', 'Bereitschaftsdienst', 'Reisepflicht'],
        // Eine Rueckzahlungsklausel fuer Weiterbildung gibt es beim
        // Dienstvertrag nicht; dafuer Haftung und Vor-Ort-Pflicht.
        chipsFreelance: ['Nichts davon', 'Wettbewerbsverbot', 'Haftung / Versicherungsnachweis',
                         'Vor-Ort-Pflicht ohne Ausnahme', 'Reisepflicht'],
        column: 'contract_sensitive_topics', store: 'text',
        required: true, weight: 2, reveal: 'safe', sources: ['ad'],
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
        required: false, weight: 1, reveal: 'gated', sources: ['ad', 'inherit'],
      },
      {
        key: 'industry_challenges', label: 'Herausforderungen', form: 'ai',
        column: 'industry_challenges', store: 'text',
        required: false, weight: 1, reveal: 'gated', sources: ['ad', 'inherit'],
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
        required: false, weight: 1, reveal: 'safe', sources: ['ad'],
      },
      {
        key: 'candidates_dropped_reason', label: 'Absprünge in der Angebotsphase', form: 'ai',
        column: 'candidates_dropped_reason', store: 'text',
        required: false, weight: 3, reveal: 'safe', sources: ['ad'],
      },
    ],
  },
];

export const BRIEF_QUESTIONS: BriefQuestion[] = [...FIRMA, ...LINKS, ...GESPRAECH];

/** Nur das Gespraech rechts. */
export const DIALOG_QUESTIONS = GESPRAECH;

/** Die Bloecke links, je Ort. */
export type Vertrag = 'full-time' | 'freelance';

/* ------------------------------------------------------------------ *
 * Vertragsart-Aufloesung
 *
 * Alle Oberflaechen lesen Fragetext, Beschriftung und Auswahl ueber diese
 * vier Funktionen -- nie direkt ueber `q.text` oder `s.chips`. Sonst faellt
 * die Contracting-Fassung an genau der einen Stelle durch, die man vergisst.
 * ------------------------------------------------------------------ */

export const frageText = (q: BriefQuestion, c: Vertrag) =>
  (c === 'freelance' && q.textFreelance) || q.text;

export const frageKurz = (q: BriefQuestion, c: Vertrag) =>
  (c === 'freelance' && (q.kurzFreelance ?? q.textFreelance)) || q.kurz;

export const slotLabel = (s: BriefSlot, c: Vertrag) =>
  (c === 'freelance' && s.labelFreelance) || s.label;

export const slotChips = (s: BriefSlot, c: Vertrag) =>
  (c === 'freelance' && s.chipsFreelance) || s.chips;

export const slotChipWert = (s: BriefSlot, c: Vertrag, chip: string) => {
  const werte = (c === 'freelance' && s.chipValuesFreelance) || s.chipValues;
  return werte?.[chip] ?? chip;
};

export const questionsAt = (place: BriefPlace, contract: Vertrag = 'full-time') =>
  BRIEF_QUESTIONS
    .filter((q) => q.place === place && (!q.only || q.only === contract))
    .sort((a, b) => a.order - b.order);

export const ALL_SLOTS = [...BRIEF_QUESTIONS, ...DASHBOARD_FRAGEN].flatMap((q) =>
  // Eine Zeile erbt die Vertragsart ihrer Frage. Sonst saehe eine Auswertung
  // ueber ALL_SLOTS die Betriebsratszeilen als fuer beide Welten gueltig an,
  // obwohl die ganze Frage im Contracting entfaellt.
  q.slots.map((s) => ({
    ...s, only: s.only ?? q.only, question: q.key, place: q.place, level: q.level,
  })),
);

/* ==================================================================== *
 * Chip-Treffer
 * ==================================================================== */

/**
 * Freitext auf das Chip-Vokabular eines Slots -- oder gar nicht.
 *
 * BEFUND (07.09.2026, Durchklick): Der Parser liefert Saetze, die Chips
 * tragen ein festes Vokabular. Aus "Nachfolge fuer unseren langjaehrigen
 * Konstruktionsleiter, der in den Ruhestand geht" wurde ein Wert, den kein
 * Chip traf. Auf dem Bildschirm stand dann "aus der Anzeige gelesen -- bitte
 * pruefen" ueber fuenf unmarkierten Chips: der Kunde soll etwas pruefen, das
 * er nicht sieht. Schlimmer noch zaehlte `hatWert` die Zeile als gefuellt.
 *
 * Dieselbe Stelle betraf `core_hours` und `overtime_policy`. Deshalb keine
 * Einzelfallpflaster, sondern eine Regel: ein Wert fuer einen Chip-Slot muss
 * einen Chip treffen, sonst wird er verworfen. Lieber eine leere Frage als
 * eine, die faelschlich als beantwortet gilt.
 */
const SCHLAGWORTE: Record<string, [RegExp, string][]> = {
  vacancy_reason: [
    [/nachfolge|ruhestand|rente|pension/i, 'Nachfolge / Ruhestand'],
    [/elternzeit|mutterschutz|erziehungsurlaub/i, 'Elternzeit-Vertretung'],
    [/wachstum|neu geschaffen|expansion|aufbau|zusaetzlich/i, 'Wachstum / neu geschaffen'],
    [/abl(oe|ö)sung|ersetzt/i, 'Ablösung'],
    [/nachbesetz|ersatz|ausgeschieden|verlassen|gek(ue|ü)ndigt|vakan/i, 'Nachbesetzung'],
  ],
  core_hours: [
    [/schicht|dienstplan/i, 'Schicht- oder Dienstplan'],
    [/frei einteil|ohne feste zeiten|selbst einteil/i, 'Frei einteilbar'],
    [/schicht/i, 'Schichtbetrieb'],
    [/vertrauensarbeitszeit/i, 'Vertrauensarbeitszeit'],
    [/kernarbeitszeit|kernzeit/i, 'Kernzeiten einzuhalten'],
    [/kernarbeitszeit|kernzeit/i, 'Gleitzeit mit Kernzeit'],
    /* Gemessen am 07.09.2026: aus "Kernarbeitszeit 9 bis 15 Uhr" macht der
       Parser "9 bis 15 Uhr" -- das Wort faellt weg, das Zeitfenster bleibt.
       Ein Zeitfenster IM Feld core_hours IST die Kernzeit; ohne diese Zeile
       blieb die Reihe leer, obwohl die Anzeige es klar sagte. */
    [/\d{1,2}(:\d{2})?\s*(bis|-|–|—)\s*\d{1,2}(:\d{2})?\s*uhr/i, 'Gleitzeit mit Kernzeit'],
    [/gleitzeit|flexibel/i, 'Gleitzeit ohne Kernzeit'],
    [/feste? arbeitszeit|starr|fix/i, 'Feste Arbeitszeiten'],
  ],
  /* Gemessen am 07.09.2026: die Anzeige sagte "berichten direkt an den
     Technischen Geschaeftsfuehrer", der Parser gab genau das zurueck -- und
     ohne diese Liste fiel es durch. Markiert wurde die Zeile erst, als die
     KI-Ableitung nachtraeglich dasselbe herausfand. Der Umweg ueber ein
     zweites Modell fuer etwas, das woertlich in der Anzeige steht. */
  reports_to: [
    [/gesch(ae|ä)ftsf(ue|ü)hr|\bceo\b|\bcto\b|\bcfo\b|\bcoo\b|vorstand|inhaber|gesellschafter/i, 'Geschäftsführung'],
    [/bereichsleit|\bhead of\b|ressortleit|werkleit|standortleit/i, 'Bereichsleitung'],
    [/abteilungsleit|hauptabteilung|\bleiter der\b/i, 'Abteilungsleitung'],
    [/teamleit|gruppenleit|\bteam lead\b/i, 'Teamleitung'],
  ],
  overtime_policy: [
    [/kaum|selten|keine (ue|ü)berstunden/i, 'fallen kaum an'],
    [/abgegolten|mit dem gehalt|inklusive|pauschal/i, 'mit dem Gehalt abgegolten'],
    [/ausgezahlt|verg(ue|ü)tet|bezahlt/i, 'ausgezahlt'],
    [/ausgleich|freizeit|gleitzeitkonto|abgebummelt/i, 'ausgeglichen (Freizeit)'],
  ],

  /* Ab hier die Zeilen, die seit dem 09.09.2026 aus der Anzeige kommen
     koennen. Die Reihenfolge ist die Trefferreihenfolge: das Spezielle vor
     dem Allgemeinen. "befristet mit Aussicht auf Uebernahme" enthaelt das
     Wort "befristet" -- stuende `Befristet` oben, gewaenne es. */
  contract_limitation: [
    [/aussicht auf (ue|ü)bernahme|mit (ue|ü)bernahme|entfristung/i, 'Befristet mit Aussicht'],
    [/projektvertrag|projektbezogen|f(ue|ü)r die dauer des projekts/i, 'Projektvertrag'],
    [/unbefristet|dauerhaft|feste anstellung/i, 'Unbefristet'],
    [/befristet|zeitlich begrenzt|sachgrund|auf \d+ (jahre|monate)/i, 'Befristet'],
  ],
  time_tracking_method: [
    [/keine erfassung|gar nicht|vertrauensarbeitszeit ohne/i, 'gar nicht'],
    [/stempeluhr|terminal|badge|chip/i, 'Stempeluhr'],
    [/selbst|handschriftlich|auf papier|excel|stundenzettel/i, 'selbst aufgeschrieben'],
    [/digital|elektronisch|app|zeitwirtschaft|system/i, 'digital'],
  ],
  works_council_meeting_schedule: [
    [/w(oe|ö)chentlich|jede woche/i, 'Wöchentlich'],
    [/zwei wochen|vierzehnt(ae|ä)gig|alle 14 tage|zweiw(oe|ö)chentlich/i, 'Alle zwei Wochen'],
    [/monatlich|jeden monat|einmal im monat/i, 'Monatlich'],
    [/bedarf|anlassbezogen|unregelm(ae|ä)ssig|unregelmäßig/i, 'Nach Bedarf'],
  ],
  /* Mehrfachauswahl: jeder Eintrag der Anzeige wird einzeln zugeordnet,
     siehe chipTreffer. */
  decision_makers: [
    [/niemand|allein|nur ich|ich entscheide/i, 'Niemand — ich entscheide'],
    [/gesch(ae|ä)ftsf(ue|ü)hr|vorstand|inhaber|\bceo\b|gesellschafter/i, 'Geschäftsführung'],
    [/\bhr\b|personal|human resources|recruiting/i, 'HR'],
    [/fachbereich|fachabteilung|bereichsleit|abteilungsleit|leitung/i, 'Fachbereich'],
    [/\bteam\b|kollegen|mannschaft/i, 'Das Team'],
  ],
  contract_sensitive_topics: [
    [/wettbewerbsverbot|konkurrenzklausel|karenz/i, 'Wettbewerbsverbot'],
    [/r(ue|ü)ckzahl|bindungsfrist|fortbildungsvertrag/i, 'Rückzahlungsklausel (Weiterbildung)'],
    [/haftung|versicherungsnachweis|berufshaftpflicht/i, 'Haftung / Versicherungsnachweis'],
    [/bereitschaft|rufbereitschaft|on-?call/i, 'Bereitschaftsdienst'],
    [/vor-?ort-?pflicht|anwesenheitspflicht|kein homeoffice/i, 'Vor-Ort-Pflicht ohne Ausnahme'],
    [/reise|dienstreise|au(ss|ß)endienst|montage/i, 'Reisepflicht'],
    [/nichts davon|keine|unauff(ae|ä)llig/i, 'Nichts davon'],
  ],
  bonus_basis: [
    [/unternehmen|firmen|gesch(ae|ä)ftsergebnis|ebit|gewinn/i, 'Unternehmensergebnis'],
    [/pers(oe|ö)nlich|individuell|zielvereinbarung/i, 'Persönliche Ziele'],
    [/team/i, 'Teamziele'],
    [/umsatz|absatz|vertriebsziel/i, 'Umsatz'],
  ],
};

const SLOT_INDEX = new Map(ALL_SLOTS.map((s) => [s.key, s]));

export function chipTreffer(
  slotKey: string,
  roh: unknown,
  contract: Vertrag = 'full-time',
): unknown {
  const slot = SLOT_INDEX.get(slotKey);
  if (!slot) return roh;
  // Eine Zeile, die es in dieser Vertragsart nicht gibt, bekommt auch keinen
  // Wert. Sonst stand `career_path` im Entwurf einer Contracting-Aufnahme,
  // obwohl die Foerderungsfrage dort entfaellt.
  if (slot.only && slot.only !== contract) return undefined;
  const chips = slotChips(slot, contract);
  // Textfelder nehmen Freitext, wie sie sollen.
  if ((slot.form !== 'chips' && slot.form !== 'multi') || !chips) return roh;

  const wertVon = (chip: string) => slotChipWert(slot, contract, chip);
  if (chips.map(wertVon).some((w) => w === roh)) return roh;

  /** Ein einzelner Rohwert -> Chip, oder nichts. */
  const einer = (v: unknown): unknown => {
    const text = String(v ?? '').trim();
    if (!text) return undefined;
    const genau = chips.find((c) => c.toLowerCase() === text.toLowerCase());
    if (genau) return wertVon(genau);
    for (const [muster, chip] of SCHLAGWORTE[slotKey] ?? []) {
      // Ein Schlagwort zaehlt nur, wenn sein Chip in DIESER Vertragsart
      // ueberhaupt zur Auswahl steht.
      if (muster.test(text) && chips.includes(chip)) return wertVon(chip);
    }
    return undefined;
  };

  /**
   * Mehrfachauswahl: jeder Eintrag wird EINZELN zugeordnet.
   *
   * Vorher lief eine Liste durch String(roh) -- aus ["Bereichsleitung",
   * "Personalabteilung"] wurde der Text "Bereichsleitung,Personalabteilung",
   * und der erste passende Ausdruck gewann fuer die ganze Liste. Von zwei
   * genannten Entscheidern kam einer an.
   */
  if (slot.form === 'multi') {
    const liste = Array.isArray(roh) ? roh : [roh];
    const treffer = [...new Set(liste.map(einer).filter((x) => x !== undefined))];
    return treffer.length ? treffer : undefined;
  }

  return einer(roh);
}


/* ==================================================================== *
 * Ableitungen
 * ==================================================================== */

export interface SlotState {
  value: unknown;
  /** 'answer' = der Kunde hat es selbst gesagt. */
  from: BriefSource | 'answer';
}
export type Known = Record<string, SlotState | undefined>;

const belegt = (v: unknown) => {
  if (Array.isArray(v)) return v.length > 0;
  if (v && typeof v === 'object') return Object.values(v).some((x) => String(x ?? '').trim());
  return v !== null && v !== undefined && String(v).trim() !== '';
};

/** Steht ueberhaupt ein Wert da -- gleich welcher Herkunft? */
export const hatWert = (k: Known, key: string) => belegt(k[key]?.value);

/**
 * Gilt die Zeile als BEANTWORTET?
 *
 * Nur was der Kunde selbst gesagt hat ('answer') oder aus seinem eigenen
 * Firmenprofil stammt ('inherit'). Was aus der Anzeige gelesen ('ad') oder aus
 * einer anderen Antwort abgeleitet wurde ('derive'), ist ein VORSCHLAG -- die
 * Frage wird trotzdem gestellt, mit dem Wert schon drin.
 *
 * Gemessen, warum das noetig ist: die Ernte hat company_culture,
 * unique_selling_points und position_advantages aus der Stellenanzeige gezogen
 * und damit ZWEI von Markos Fragen stillgelegt -- der Kunde bekam sie nie zu
 * sehen. Im Bestaetigungskasten stand als Quelle "aus Ihrer Antwort
 * abgeleitet", obwohl er nichts geantwortet hatte. Eine Anzeige ist
 * Marketingtext; sie als Kundenaussage durchzuwinken ist genau der Defekt,
 * gegen den dieser Katalog gebaut wurde.
 */
export const istBeantwortet = (k: Known, key: string) => {
  const s = k[key];
  if (!s || !belegt(s.value)) return false;
  return s.from === 'answer' || s.from === 'inherit';
};

/**
 * Der Chip-Text zu einem gespeicherten Wert -- die Umkehrung von `chipWert`.
 *
 * BEFUND (08.09.2026): Die Frage "Existiert ein Betriebsrat? (Falls ja, wann
 * tagt dieser?)" liess sich zur Haelfte nicht beantworten. `works_council`
 * traegt `chipValues: { Ja: true, Nein: false }` -- ein Klick auf "Ja" legt
 * also den Boolean `true` ab. Die Folgezeile fragt aber
 * `askIf: { key: 'works_council', equals: 'Ja' }`, und der Vergleich lief ueber
 * `String(true) === 'Ja'`. Der ist nie wahr: die Zeile "Wann tagt er?" konnte
 * unter keinen Umstaenden erscheinen, waehrend die Frage danach auf dem
 * Bildschirm stand.
 *
 * Verglichen wird deshalb gegen den CHIP-TEXT, nicht gegen den Speicherwert.
 * Im Katalog steht dann `equals: 'Ja'` -- das, was der Kunde sieht. Wer eine
 * Bedingung schreibt, muss nicht wissen, was dahinter in der Spalte landet.
 */
export const chipWert = (slot: BriefSlot, chip: string) => slot.chipValues?.[chip] ?? chip;

const chipText = (slotKey: string, wert: unknown): string => {
  const slot = SLOT_INDEX.get(slotKey);
  if (!slot?.chips) return String(wert ?? '');
  return slot.chips.find((c) => chipWert(slot, c) === wert) ?? String(wert ?? '');
};

/** Ob eine bedingte Zeile gezeigt werden darf. */
export function bedingungGilt(known: Known, s: BriefSlot): boolean {
  const trifft = (bed: { key: string; equals: string | string[] }) => {
    const ist = chipText(bed.key, known[bed.key]?.value);
    return Array.isArray(bed.equals) ? bed.equals.includes(ist) : ist === bed.equals;
  };

  if (s.askIfLeer && hatWert(known, s.askIfLeer)) return false;
  if (s.askIf && !trifft(s.askIf)) return false;
  // Ohne Antwort auf die Leitzeile bleibt die Folgezeile verborgen:
  // "Wovon haengt er ab?" ergibt erst Sinn, wenn etwas anderes als "Nein" dasteht.
  if (s.askIfNot) {
    if (!hatWert(known, s.askIfNot.key)) return false;
    if (trifft(s.askIfNot)) return false;
  }
  return true;
}

const sichtbar = (q: BriefQuestion, known: Known, contract: 'full-time' | 'freelance') =>
  q.slots.filter((s) => (!s.only || s.only === contract) && bedingungGilt(known, s));

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
    if (q.only && q.only !== contract) continue;
    if (gestellt.includes(q.key)) continue;
    const alle = sichtbar(q, known, contract);
    const offen = alle.filter((s) => !istBeantwortet(known, s.key));
    if (!offen.some((s) => s.required)) continue;
    // `bestaetigen` traegt nur, was wirklich beantwortet ist. Vorbefuelltes
    // aus der Anzeige steht in `fragen` -- mit Wert, aber als Frage.
    return { frage: q, fragen: offen, bestaetigen: alle.filter((s) => istBeantwortet(known, s.key)) };
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
  const pflicht = BRIEF_QUESTIONS
    .filter((q) => !q.only || q.only === contract)
    .flatMap((q) =>
    sichtbar(q, known, contract).filter((s) => s.required).map((s) => ({ ...s, q })),
  );
  const summe = pflicht.reduce((n, s) => n + s.weight, 0);
  const erreicht = pflicht.filter((s) => istBeantwortet(known, s.key)).reduce((n, s) => n + s.weight, 0);
  const offen = pflicht.filter((s) => !istBeantwortet(known, s.key));
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

/** Spalten, die es noch nicht gibt. */
export const FEHLENDE_SPALTEN = ALL_SLOTS.filter((s) => s.column === null).map((s) => s.key);

/* ------------------------------------------------------------------ */

export interface CatalogState {
  known: Known;
  askedQuestions: string[];
  askedFollowups: string[];
  conflicts: { slot: string; existing: string; neu: string; note?: string }[];
  envelopePatch: Record<string, unknown>;
  /**
   * Skills, die zur Rolle passen, aber noch nicht in der Liste stehen.
   *
   * Der einzige Punkt, an dem das Modell noch etwas VORSCHLAEGT statt zu
   * ernten -- der Kunde entscheidet per Klick. Sie wurden beim Umbau auf den
   * Katalog versehentlich abgeschaltet: gefuellt hat sie allein
   * DynamicBriefing, und die neue Function lieferte sie gar nicht mehr. Der
   * Anzeigeblock stand weiter da und bekam fuer immer eine leere Liste.
   */
  skillSuggestions: { skill: string; because: string }[];
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
  skillSuggestions: [],
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
  /** Der Zustand je Kriterium: fix | negotiable | flexible. */
  flexibility?: Record<string, string | undefined> | null;
}): Known {
  const { built, freelance, contract, flexibility } = args;
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
    setz('contract_duration_months', freelance?.durationMonths);
    setz('utilization_days_per_week', freelance?.utilizationDaysPerWeek);
    // Der Haken hat einen Vorgabewert (true) -- er gilt erst als Angabe, wenn
    // die Konditionen ueberhaupt angefasst wurden. Sonst waere jede leere
    // Aufnahme sofort "Verlaengerung moeglich".
    if (freelance?.dayRateMin || freelance?.durationMonths) {
      setz('extension_possible', freelance?.extensionPossible);
    }
  } else if (built.salary_min || built.salary_max) {
    setz('salary_range', { min: built.salary_min, max: built.salary_max });
  }

  /**
   * Die eine Kriterienliste, aufgeteilt nach ihrem Zustand.
   *
   * Vorher war must_have_criteria hier bewusst NICHT gesetzt, weil die
   * Muss-Liste aus der Anzeige die Wunschliste ist und nicht "die drei, ohne
   * die es nicht geht". Seit die Einstufung direkt an der Liste passiert, ist
   * genau das jetzt beantwortbar: was der Kunde als unverzichtbar markiert,
   * IST seine Antwort auf Markos Frage -- und was er als lernbar markiert, ist
   * seine Antwort auf "was kann nachgeschult werden".
   */
  if (flexibility) {
    const alle = [...(built.must_haves ?? []), ...(built.nice_to_haves ?? [])]
      .map((x: unknown) => String(x ?? '').trim())
      .filter(Boolean);
    const nach = (w: string) => [...new Set(alle.filter((k) => flexibility[k] === w))];
    setz('must_have_criteria', nach('fix'));
    setz('trainable_skills', nach('flexible'));
    setz('nice_to_have_criteria', nach('negotiable'));
  }

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
  return BRIEF_QUESTIONS
    .filter((q) => !q.only || q.only === contract)
    .flatMap((q) =>
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

/**
 * Eine Katalogfrage nach ihrem Schluessel.
 *
 * Damit liest die Oberflaeche den Wortlaut aus dem Katalog, statt ihn
 * abzutippen. ProfileSections hatte Markos Frage als Literal im JSX stehen --
 * zwei Wahrheiten fuer denselben Satz, und wer den Katalog aendert, aendert
 * den Bildschirm nicht mit.
 */
export const frageNach = (key: string) =>
  [...BRIEF_QUESTIONS, ...DASHBOARD_FRAGEN].find((q) => q.key === key);
