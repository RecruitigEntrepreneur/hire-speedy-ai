import { NOTICE_OPTIONS, noticeParts } from '@/lib/candidateDossier';

/**
 * Frage an den Headhunter: welche Vorschläge der Kunde im Fenster sieht.
 *
 * Nur, was das Profil noch nicht beantwortet und was noch nicht gefragt wurde.
 * „Warum wechseln“ steht nach der Interview-Pflicht im Profil, der Vorschlag
 * erscheint nur bei älteren Einreichungen ohne diese Angabe.
 */

export interface QuestionContext {
  /** Wechselgrund aus dem Gespräch (Kundentext). */
  changeMotivation: string | null;
  /** Kündigungsfrist als gespeicherter Wert, z. B. „3_months_eoq“. */
  noticePeriod: string | null;
  /** Gehaltswunsch als Spanne aus der Kunden-Ansicht, z. B. „85–95 T€“. */
  salaryWish: string | null;
  /** Höchstbetrag der Stelle in Euro. */
  budgetMax: number | null;
  /** Offene Punkte der Einschätzung (gap_analysis, beide gespeicherten Formen). */
  gaps: unknown[];
  /** Bereits gestellte Fragen des Kunden zu dieser Einreichung. */
  asked: string[];
}

export interface QuestionSuggestion {
  /** Text auf dem Knopf. */
  label: string;
  /** Text, der ins Feld übernommen wird. */
  text: string;
}

export const Q_SALARY = 'Ist beim Gehalt Spielraum?';
export const Q_NOTICE = 'Lässt sich die Kündigungsfrist verkürzen?';
export const Q_MOTIVATION = 'Warum möchte der Kandidat wechseln?';
export const Q_INTERVIEW = 'Wann wäre ein Interview möglich?';

const MAX_GAPS = 2;
const SEVERITY_ORDER: Record<string, number> = { critical: 0, significant: 1, moderate: 1, minor: 2 };

const norm = (s: string) => s.toLowerCase().replace(/[^a-zäöüß0-9]+/g, ' ').trim();

/** Untere Grenze der Gehaltsspanne in Euro („85–95 T€“ → 85000). */
export function salaryWishMin(band: string | null): number | null {
  const m = band?.match(/(\d+)\s*(?:[–-]\s*\d+\s*)?T€/);
  return m ? Number(m[1]) * 1000 : null;
}

/**
 * Kündigungsfrist in Monaten (Wochen anteilig), null wenn unbekannt.
 * Nimmt den Wert („3_months_eoq“) oder die Beschriftung („3 Monate zum Quartalsende“),
 * denn die Interview-Notiz speichert die Beschriftung.
 */
export function noticeMonths(notice: string | null): number | null {
  const cleaned = notice?.trim().replace(/^Kündigungsfrist\s+/i, '') ?? null;
  const value = NOTICE_OPTIONS.find((o) => o.label === cleaned)?.value ?? cleaned;
  const { duration } = noticeParts(value);
  if (!duration) {
    // Freitext wie „3 Monate Kündigungsfrist“ oder „6 Wochen“
    const m = cleaned?.match(/(\d+)\s*(Monat|Woche)/i);
    if (m) return m[2].toLowerCase().startsWith('woche') ? Number(m[1]) / 4 : Number(m[1]);
    if (cleaned && /sofort/i.test(cleaned)) return 0;
    return null;
  }
  if (duration === 'immediate') return 0;
  const m = duration.match(/^(\d+)_(weeks?|months?)$/);
  if (!m) return null;
  return m[2].startsWith('week') ? Number(m[1]) / 4 : Number(m[1]);
}

type Gap = { text: string; severity: string };

/**
 * Die KI schreibt Lücken als ganzen Satz („Verrechnungspreisdokumentation … wird gefordert,
 * ist im Profil jedoch nicht belegt.“). Für den Knopf reicht das Thema vor der Begründung.
 */
export function gapTopic(text: string): string {
  let t = text.trim().replace(/[.!?]+$/, '');
  const cut = [':', ',', ';', ' wird ', ' ist ', ' fehlt', ' – ', ' - ']
    .map((c) => t.indexOf(c))
    .filter((i) => i > 10)
    .sort((a, b) => a - b)[0];
  if (cut !== undefined) t = t.slice(0, cut).trim();
  if (t.length > 70) t = `${t.slice(0, 70).replace(/\s+\S*$/, '')} …`;
  return t;
}

/** gap_analysis kommt in zwei Formen: {gap, severity} (KI) oder {requirement, gap_severity} (alt). */
export function readGaps(raw: unknown[]): Gap[] {
  return (raw ?? [])
    .map((g) => {
      const o = (g ?? {}) as Record<string, unknown>;
      const text = String(o.gap ?? o.requirement ?? '').trim();
      const severity = String(o.severity ?? o.gap_severity ?? 'minor');
      return { text, severity };
    })
    .filter((g) => g.text.length > 0);
}

export function questionSuggestions(ctx: QuestionContext): { common: QuestionSuggestion[]; fromAssessment: QuestionSuggestion[] } {
  const asked = new Set(ctx.asked.map(norm));
  const open = (q: QuestionSuggestion) => !asked.has(norm(q.text));

  const common: QuestionSuggestion[] = [];
  const wishMin = salaryWishMin(ctx.salaryWish);
  if (wishMin != null && ctx.budgetMax != null && wishMin > ctx.budgetMax) common.push({ label: Q_SALARY, text: Q_SALARY });
  const months = noticeMonths(ctx.noticePeriod);
  if (months != null && months >= 3) common.push({ label: Q_NOTICE, text: Q_NOTICE });
  if (!ctx.changeMotivation?.trim()) common.push({ label: Q_MOTIVATION, text: Q_MOTIVATION });
  common.push({ label: Q_INTERVIEW, text: Q_INTERVIEW });

  const fromAssessment = readGaps(ctx.gaps)
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 2) - (SEVERITY_ORDER[b.severity] ?? 2))
    .slice(0, MAX_GAPS)
    .map((g) => gapTopic(g.text))
    .map((topic) => ({ label: `${topic}?`, text: `Können Sie dazu mehr sagen: ${topic}?` }));

  return { common: common.filter(open), fromAssessment: fromAssessment.filter(open) };
}
