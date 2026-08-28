/**
 * Eine Quelle fuer das Stage-Vokabular der Pipeline.
 *
 * Hintergrund: Migration 20260725130000 macht submissions.stage zur einzigen
 * Wahrheit — kanonisches Vokabular per CHECK, status als abgeleiteter Spiegel.
 * Solange die Migration nicht angewandt ist, stehen im Bestand noch
 * Alt-Vokabular (interview_1, hired, screening …) UND Zeilen, deren status
 * bereits 'rejected' sagt, waehrend stage auf einem aktiven Wert stehen
 * geblieben ist.
 *
 * normalizeStage() spiegelt die Normalisierung der Migration im Frontend.
 * Dadurch zeigt die Oberflaeche schon heute dasselbe Bild, das nach dem Deploy
 * in der Datenbank steht — und keine abgelehnten Kandidaten mehr in aktiven
 * Spalten.
 */

export const CANONICAL_STAGES = [
  'submitted',
  'in_review',
  'interview_requested',
  'candidate_opted_in',
  'interview_scheduled',
  'interview_counter_proposed',
  'interview_declined',
  'interview_completed',
  'offer',
  'placed',
  'rejected',
  'client_rejected',
  'withdrawn',
] as const;

export type CanonicalStage = (typeof CANONICAL_STAGES)[number];

/** Stages, die einen beendeten Vorgang bezeichnen. */
const CLOSED: readonly string[] = ['rejected', 'client_rejected', 'withdrawn', 'interview_declined'];

/** Alt-Vokabular → kanonisch. Gleiche Abbildung wie Schritt 1b der Migration. */
const LEGACY_MAP: Record<string, CanonicalStage> = {
  interview_1: 'interview_completed',
  interview_2: 'interview_completed',
  interviewed: 'interview_completed',
  offer_pending: 'offer',
  offer_extended: 'offer',
  offer_accepted: 'offer',
  hired: 'placed',
  reviewing: 'in_review',
  screening: 'in_review',
  pending: 'in_review',
  new: 'submitted',
  forwarded: 'in_review',
};

export function isClosedStage(stage: string): boolean {
  return CLOSED.includes(stage);
}

/**
 * Liefert die kanonische Stage einer Submission.
 *
 * @param stage  submissions.stage (kann Alt-Vokabular oder null sein)
 * @param status submissions.status — der abgeleitete Spiegel. Sagt er
 *   'rejected', waehrend stage noch aktiv ist, gewinnt die Absage: von den 16
 *   widerspruechlichen Zeilen im Bestand tragen 14 einen rejection_reason, die
 *   Absage ist also real und stage wurde nur nie nachgezogen (Schritt 1a der
 *   Migration, gleiche Begruendung).
 */
export function normalizeStage(
  stage: string | null | undefined,
  status?: string | null,
): CanonicalStage {
  const mapped = (stage && (LEGACY_MAP[stage] ?? stage)) || 'submitted';
  const canonical = (CANONICAL_STAGES as readonly string[]).includes(mapped)
    ? (mapped as CanonicalStage)
    : 'submitted';

  if (status === 'rejected' && !isClosedStage(canonical)) return 'client_rejected';
  if (status === 'hired' && canonical !== 'placed') return 'placed';

  return canonical;
}

export interface StageColumn {
  key: CanonicalStage;
  label: string;
  color: string;
  /** Beendete Phasen zeigt die Pipeline hinter den aktiven. */
  closed?: boolean;
}

/** Spaltenreihenfolge der Pipeline — deckt das kanonische Set vollstaendig ab. */
export const STAGE_COLUMNS: StageColumn[] = [
  { key: 'submitted', label: 'Eingereicht', color: 'bg-blue-500' },
  { key: 'in_review', label: 'In Prüfung', color: 'bg-amber-500' },
  { key: 'interview_requested', label: 'Interview angefragt', color: 'bg-orange-500' },
  { key: 'candidate_opted_in', label: 'Opt-In erteilt', color: 'bg-cyan-500' },
  { key: 'interview_scheduled', label: 'Termin steht', color: 'bg-purple-500' },
  { key: 'interview_counter_proposed', label: 'Gegenvorschlag', color: 'bg-violet-500' },
  { key: 'interview_completed', label: 'Interview geführt', color: 'bg-indigo-500' },
  { key: 'offer', label: 'Angebot', color: 'bg-emerald-500' },
  { key: 'placed', label: 'Vermittelt', color: 'bg-green-600' },
  { key: 'interview_declined', label: 'Interview abgelehnt', color: 'bg-muted-foreground', closed: true },
  { key: 'client_rejected', label: 'Vom Kunden abgelehnt', color: 'bg-destructive', closed: true },
  { key: 'rejected', label: 'Abgelehnt', color: 'bg-destructive', closed: true },
  { key: 'withdrawn', label: 'Zurückgezogen', color: 'bg-muted-foreground', closed: true },
];

export const stageLabel = (stage: string): string =>
  STAGE_COLUMNS.find((c) => c.key === stage)?.label ?? stage;
