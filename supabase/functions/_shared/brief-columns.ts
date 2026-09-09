/**
 * Fragenkatalog -> jobs-Spalten.
 *
 * BEFUND (08.09.2026): `draftToJobRow` las `dyn.catalog.known` ueberhaupt
 * nicht. Von 37 Zielspalten des Katalogs schrieb es SECHS. Alles, was der
 * Kunde im Fragenkatalog beantwortet -- Monatsgehaelter, Betriebsrat, Alltag,
 * Kultur, Karriere, Muss-Kriterien, Teamgroesse, Kernzeiten -- blieb im
 * Entwurfs-JSON liegen und wurde beim Anlegen der Stelle verworfen. Der
 * Headhunter sah davon nichts; `format-job-for-recruiters` gibt bis heute
 * "Unternehmensgroesse: Nicht angegeben" aus, obwohl die Zahl erhoben wurde.
 *
 * SPIEGEL: Diese Tabelle muss deckungsgleich mit `ALL_SLOTS` aus
 * src/lib/briefCatalog.ts sein. Deno kann nicht aus src/ importieren, deshalb
 * die Doppelung -- und deshalb der Test in src/lib/briefColumns.test.ts, der
 * beide Seiten gegeneinander haelt. Wer den Katalog aendert und diese Datei
 * nicht, bekommt einen roten Test, keinen stillen Datenverlust.
 *
 * ZWEITE HAELFTE: Die Spalten hier landen nur dann wirklich in `jobs`, wenn
 * `accept_intake_draft` sie in seine INSERT-Liste aufnimmt -- die RPC hat eine
 * FEST VERDRAHTETE Spaltenliste und ignoriert alles andere still. Siehe die
 * Migration, die zu dieser Datei gehoert.
 */

export type BriefStore = 'text' | 'number' | 'array' | 'json' | 'bool' | 'range';

export interface BriefColumn {
  /** Schluessel im Fragenkatalog. */
  key: string;
  /** Zielspalte in `jobs`. */
  column: string;
  store: BriefStore;
  /** Nur fuer diese Vertragsart. */
  only?: 'full-time' | 'freelance';
}

/**
 * Zwei Slots stehen bewusst NICHT in dieser Tabelle:
 *
 *   `salary_range` / `day_rate_range` -- sie sind Formularfelder links, und
 *   `draftToJobRow` schreibt sie bereits aus `built` bzw. `freelance`. Der
 *   Katalog spiegelt sie nur (knownFromForm). Sie hier ein zweites Mal zu
 *   schreiben hiesse, zwei Quellen fuer dieselbe Zahl zu haben.
 *
 *   `bonus_basis` -- hat `column: null`, es gibt keine Spalte dafuer.
 */
export const BRIEF_COLUMNS: BriefColumn[] = [
  // Verguetung
  { key: 'salary_months', column: 'salary_months', store: 'number', only: 'full-time' },
  { key: 'bonus_structure', column: 'bonus_structure', store: 'text', only: 'full-time' },

  // Anforderungen
  { key: 'must_have_criteria', column: 'must_have_criteria', store: 'array' },
  { key: 'trainable_skills', column: 'trainable_skills', store: 'array' },

  // Team und Vertrag
  { key: 'team_size', column: 'team_size', store: 'number' },
  { key: 'remote_days', column: 'onsite_days_required', store: 'number' },
  { key: 'contract_limitation', column: 'contract_limitation', store: 'text', only: 'full-time' },

  // Arbeitszeit
  { key: 'core_hours', column: 'core_hours', store: 'text' },
  { key: 'core_hours_detail', column: 'core_hours_detail', store: 'text' },
  { key: 'overtime_policy', column: 'overtime_policy', store: 'text', only: 'full-time' },
  { key: 'time_tracking_method', column: 'time_tracking_method', store: 'text' },

  // Gremien und Vertragstempo
  { key: 'works_council', column: 'works_council', store: 'bool', only: 'full-time' },
  { key: 'works_council_meeting_schedule', column: 'works_council_meeting_schedule', store: 'text', only: 'full-time' },
  { key: 'contract_creation_days', column: 'contract_creation_days', store: 'number' },
  { key: 'contract_sent_digitally', column: 'contract_sent_digitally', store: 'bool' },

  // Vakanz
  { key: 'vacancy_reason', column: 'vacancy_reason', store: 'text' },
  { key: 'hiring_deadline', column: 'hiring_urgency', store: 'text' },
  { key: 'negative_impact_if_unfilled', column: 'negative_impact_if_unfilled', store: 'text' },

  // Rolle
  { key: 'daily_routine', column: 'daily_routine', store: 'text' },
  { key: 'task_focus', column: 'task_focus', store: 'text' },
  { key: 'task_breakdown', column: 'task_breakdown', store: 'json' },

  // Entscheidung
  { key: 'reports_to', column: 'reports_to', store: 'text' },
  { key: 'decision_makers', column: 'decision_makers', store: 'array' },

  // Passung, Verkauf, Kultur
  { key: 'success_profile', column: 'success_profile', store: 'text' },
  { key: 'failure_profile', column: 'failure_profile', store: 'text' },
  { key: 'unique_selling_points', column: 'unique_selling_points', store: 'array' },
  { key: 'position_advantages', column: 'position_advantages', store: 'array' },
  { key: 'company_culture', column: 'company_culture', store: 'text' },
  { key: 'career_path', column: 'career_path', store: 'text', only: 'full-time' },
  { key: 'career_example', column: 'career_example', store: 'text', only: 'full-time' },

  // Vertrag und Branche
  { key: 'contract_sensitive_topics', column: 'contract_sensitive_topics', store: 'text' },
  { key: 'industry_opportunities', column: 'industry_opportunities', store: 'text' },
  { key: 'industry_challenges', column: 'industry_challenges', store: 'text' },

  // Firma und Pipeline
  { key: 'company_size_band', column: 'company_size_band', store: 'text' },
  { key: 'candidates_in_pipeline', column: 'candidates_in_pipeline', store: 'number' },
  { key: 'candidates_dropped_reason', column: 'candidates_dropped_reason', store: 'text' },
];

/** Slots, die der Katalog fuehrt, die aber absichtlich keine Spalte bekommen. */
export const OHNE_SPALTE = [
  // Formularfelder -- draftToJobRow schreibt sie aus `built` bzw. `freelance`.
  'salary_range', 'day_rate_range',
  'contract_duration_months', 'utilization_days_per_week', 'extension_possible',
  // Ohne Zielspalte.
  'bonus_basis',
];

/**
 * Zwei Werte brauchen unterwegs eine Umrechnung, weil der Chip etwas anderes
 * fragt, als die Spalte speichert. Beides steht hier und NUR hier -- vorher
 * war die Homeoffice-Umrechnung im Parser-Mapping versteckt, was dazu fuehrte,
 * dass bei "zwei Tage Homeoffice" der Chip 3 markiert war.
 */
const UMRECHNUNG: Record<string, (v: unknown) => unknown> = {
  // Der Chip fragt Homeoffice-Tage, die Spalte speichert Tage VOR ORT.
  remote_days: (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return undefined;
    return Math.max(0, 5 - Math.min(5, n));
  },
  // Der Chip traegt Klartext, die Spalte hat einen CHECK auf drei Werte:
  // jobs_hiring_urgency_check IN ('standard','urgent','hot').
  hiring_deadline: (v) => {
    const t = String(v ?? '').toLowerCase();
    if (t.includes('schnell')) return 'hot';
    if (t.includes('1–3') || t.includes('1-3')) return 'urgent';
    if (t.includes('3–6') || t.includes('3-6') || t.includes('flexibel')) return 'standard';
    return undefined;
  },
};

type Known = Record<string, { value: unknown } | undefined>;

const leer = (v: unknown) =>
  v === null || v === undefined || (typeof v === 'string' && !v.trim()) ||
  (Array.isArray(v) && v.length === 0);

/**
 * Die Antworten des Kunden als jobs-Spalten.
 *
 * Bewusst werden AUCH unbestaetigte Werte geschrieben (`from: 'ad'`): sie
 * stammen aus derselben Quelle wie die Felder, die `draftToJobRow` schon
 * heute aus `built` uebernimmt. Wer nur Bestaetigtes schriebe, verloere bei
 * einem Kunden, der eine Frage nie oeffnet, die Angabe ganz -- und genau das
 * ist der Fehler, den diese Datei behebt.
 */
export function catalogToJobRow(
  known: Known | null | undefined,
  contract: string | null | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!known || typeof known !== 'object') return out;
  const vertrag = contract === 'freelance' ? 'freelance' : 'full-time';

  for (const spalte of BRIEF_COLUMNS) {
    if (spalte.only && spalte.only !== vertrag) continue;

    const roh = known[spalte.key]?.value;
    if (leer(roh)) continue;

    const wert = UMRECHNUNG[spalte.key] ? UMRECHNUNG[spalte.key](roh) : roh;
    if (leer(wert)) continue;

    switch (spalte.store) {
      case 'number': {
        // NICHT runden: `salary_months` ist numeric, und der Chip
        // "12 + Urlaubsgeld" traegt 12,5. Ein Math.round haette daraus 13
        // gemacht -- ein halbes Monatsgehalt, das niemand zugesagt hat.
        // Die Ganzzahl-Spalten runden in SQL ueber ::numeric::integer.
        const n = Number(wert);
        if (Number.isFinite(n)) out[spalte.column] = n;
        break;
      }
      case 'bool':
        if (typeof wert === 'boolean') out[spalte.column] = wert;
        else if (wert === 'Ja' || wert === 'ja') out[spalte.column] = true;
        else if (wert === 'Nein' || wert === 'nein') out[spalte.column] = false;
        break;
      case 'array': {
        const a = (Array.isArray(wert) ? wert : [wert])
          .map((x) => String(x ?? '').trim())
          .filter(Boolean);
        if (a.length) out[spalte.column] = a;
        break;
      }
      case 'json':
        if (typeof wert === 'object') out[spalte.column] = wert;
        break;
      default: {
        const t = String(wert).trim();
        if (t) out[spalte.column] = t;
      }
    }
  }
  return out;
}
