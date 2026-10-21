/**
 * Matchunt Liga (Konzept und Wireframes freigegeben 20.10.2026): Beschriftungen,
 * Regeln und Texte, die Browser und Server gleich brauchen. Ohne Abhängigkeiten,
 * damit Deno und Vite die Datei direkt laden.
 *
 * Leitplanken: Name nie „Bundesliga“; jede Aussage nach außen nennt die Saison
 * und die Kriterien; die Liga ändert nichts an Plätzen und Konditionen.
 */

export type LigaAwardKind = 'season_winner' | 'top_performer' | 'newcomer' | 'accurate';
export type LigaEventKind =
  | 'interview_first' | 'interview_more' | 'offer' | 'placement' | 'placement_holds'
  | 'fast_hit' | 'accuracy_bonus' | 'no_show' | 'placement_ended';

/** Punkte je Ereignis und Schwellen; was eine Saison nicht setzt, gilt aus DEFAULT_RULES. */
export interface LigaRules {
  interview_first: number;
  interview_more: number;
  offer: number;
  placement: number;
  placement_holds: number;
  fast_hit: number;
  fast_days: number;
  accuracy_bonus: number;
  accuracy_quote: number;
  accuracy_min: number;
  no_show: number;
  placement_ended: number;
  accurate_award_min: number;
}

export const DEFAULT_RULES: LigaRules = {
  interview_first: 3, interview_more: 2, offer: 5, placement: 15, placement_holds: 10,
  fast_hit: 2, fast_days: 5, accuracy_bonus: 10, accuracy_quote: 0.35, accuracy_min: 5,
  no_show: -3, placement_ended: -10, accurate_award_min: 10,
};

/** Die jüngste Auszeichnung eines Headhunters (liga_awards_of). */
export interface LigaAwardBadge {
  award: LigaAwardKind;
  season_label: string;
  rank: number;
  participants: number;
}

export const AWARD_LABEL: Record<LigaAwardKind, string> = {
  season_winner: 'Headhunter der Saison',
  top_performer: 'Top Performer',
  newcomer: 'Aufsteiger der Saison',
  accurate: 'Treffsicher',
};

/** Wer die Auszeichnung bekommt, in einem Satz (Preise, Regeln, Admin). */
export const AWARD_WHO: Record<LigaAwardKind, (topN: number, newcomerMonths: number, accurateMin: number) => string> = {
  season_winner: () => 'Platz 1',
  top_performer: (n) => `Plätze 1–${n}`,
  newcomer: (_n, m) => `bester Neuling, unter ${m} Monaten dabei`,
  accurate: (_n, _m, min) => `höchste Interview-Quote, ab ${min} Einreichungen`,
};

/** „✦ Top Performer Q3 2026“: so steht die Auszeichnung auf Abzeichen und Signatur. */
export const awardLine = (a: Pick<LigaAwardBadge, 'award' | 'season_label'>) => `✦ ${AWARD_LABEL[a.award]} ${a.season_label}`;

/** Der Satz für die Prüfseite: Saison, Platz und Kriterien, damit die Aussage überprüfbar ist. */
export const awardSentence = (a: LigaAwardBadge) =>
  `${AWARD_LABEL[a.award]} ${a.season_label}: Platz ${a.rank} von ${a.participants} der Matchunt Liga.`;

export const AWARD_CRITERIA = 'Gewertet werden Ergebnisse beim Kunden im Quartal: Interviews, Angebote, Einstellungen und Einstellungen, die halten.';

export const EVENT_LABEL: Record<LigaEventKind, string> = {
  interview_first: 'Kunden-Interview, 1. Runde',
  interview_more: 'Weitere Interview-Runde',
  offer: 'Angebot des Kunden',
  placement: 'Einstellung',
  placement_holds: 'Einstellung hält die Garantiezeit',
  fast_hit: 'Schneller Treffer',
  accuracy_bonus: 'Treffsicherheits-Bonus',
  no_show: 'Kandidat nicht erschienen',
  placement_ended: 'Einstellung endet in der Garantiezeit',
};

/** Regeltabelle (H4, A3): Reihenfolge, Text, woher die Punkte kommen. */
export const RULE_ROWS: { key: LigaEventKind; label: (r: LigaRules) => string; source: string }[] = [
  { key: 'interview_first', label: () => 'Kunden-Interview, 1. Runde', source: 'Interview hat stattgefunden, kein Nichterscheinen' },
  { key: 'interview_more', label: () => 'Jede weitere Runde', source: 'weitere Runde derselben Bewerbung' },
  { key: 'offer', label: () => 'Angebot des Kunden', source: 'Angebot verschickt' },
  { key: 'placement', label: () => 'Einstellung', source: 'Einstellung angelegt, nicht storniert' },
  { key: 'placement_holds', label: () => 'Einstellung hält die Garantiezeit', source: 'Garantiezeit bestanden' },
  { key: 'fast_hit', label: (r) => `Schneller Treffer (≤ ${r.fast_days} Werktage nach „Ich suche“, führt zum Interview)`, source: 'erste Einreichung nach „Ich suche“' },
  { key: 'accuracy_bonus', label: (r) => `Treffsicherheit (Quote ≥ ${Math.round(r.accuracy_quote * 100)} %, ≥ ${r.accuracy_min} Einreichungen)`, source: 'einmal je Saison' },
  { key: 'no_show', label: () => 'Kandidat erscheint nicht', source: 'Nichterscheinen, Kandidat' },
  { key: 'placement_ended', label: () => 'Einstellung endet in der Garantiezeit', source: 'vorzeitig beendet' },
];

export const mergeRules = (rules: Partial<LigaRules> | null | undefined): LigaRules => ({ ...DEFAULT_RULES, ...(rules ?? {}) });

/** „+15“ / „−3“ / „0“ mit echtem Minuszeichen. */
export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

/** Ohne Einwilligung kein Name: „Headhunter aus Köln“, sonst nur „Headhunter“. */
export const ligaName = (name: string | null | undefined, city: string | null | undefined) =>
  (name && name.trim()) || (city && city.trim() ? `Headhunter aus ${city.trim()}` : 'Headhunter');

export const quotePct = (q: number | null | undefined) => (q === null || q === undefined ? '–' : `${Math.round(Number(q) * 100)} %`);

// ---------------------------------------------------------------------------
// Wochenstand am Montag (Zusatz 2): nur Stand und Fakten, keine Aufforderung.
// ---------------------------------------------------------------------------

export interface LigaWeeklyRow {
  recruiter_id: string;
  email: string | null;
  full_name: string | null;
  season_label: string;
  days_left: number;
  rank: number;
  participants: number;
  points: number;
  previous_rank: number | null;
  gap_above: number | null;
  top_n: number;
  /** Nächste Einstellung, die in dieser Saison die Garantiezeit besteht. */
  next_hold: string | null;
  hold_points: number;
}

const dmy = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
};

const escape = (v: unknown) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Betreff und Kernzeilen der Wochenmail. Der Rahmen kommt vom Server (layout). */
export function weeklyContent(r: LigaWeeklyRow): { subject: string; heading: string; lines: string[] } {
  const moved = r.previous_rank === null ? 0 : r.previous_rank - r.rank;
  const heading = moved > 0
    ? `Du bist auf Platz ${r.rank} gestiegen (▲ ${moved})`
    : moved < 0
      ? `Du stehst auf Platz ${r.rank} (▼ ${Math.abs(moved)})`
      : `Du stehst auf Platz ${r.rank}`;
  const lines = [
    `${r.points} Punkte · Platz ${r.rank} von ${r.participants} · Saison ${r.season_label}, noch ${r.days_left} ${r.days_left === 1 ? 'Tag' : 'Tage'}.`,
  ];
  if (r.gap_above !== null && r.rank > 1) lines.push(`Bis Platz ${r.rank - 1} fehlen ${r.gap_above} ${r.gap_above === 1 ? 'Punkt' : 'Punkte'}.`);
  if (r.next_hold) lines.push(`Deine Einstellung ist ab ${dmy(r.next_hold)} über die Garantiezeit (${signed(r.hold_points)}).`);
  if (r.rank <= r.top_n) lines.push(`Du liegst unter den ersten ${r.top_n}. Wer dort am Saisonende steht, wird Top Performer.`);
  return { subject: `Matchunt Liga: ${heading}`, heading, lines };
}

export const weeklyBodyHtml = (r: LigaWeeklyRow) => {
  const c = weeklyContent(r);
  return `<p>Hallo${r.full_name ? ` ${escape(r.full_name.split(/\s+/)[0])}` : ''},</p>`
    + c.lines.map((l) => `<p>${escape(l)}</p>`).join('');
};

// ---------------------------------------------------------------------------
// Glückwunsch nach dem Saisonabschluss (A5 „Mail mit Urkunde und LinkedIn-Vorlage“)
// ---------------------------------------------------------------------------

export interface LigaAwardMailRow {
  full_name: string | null;
  awards: LigaAwardKind[];
  season_label: string;
  rank: number;
  participants: number;
  points: number;
  prizes: string[] | null;
}

/** Betreff, Überschrift und Absätze; die Urkunde lädt der Headhunter im Partnerstatus. */
export function awardMailContent(r: LigaAwardMailRow): { subject: string; heading: string; paragraphs: string[] } {
  const main = r.awards[0] ?? 'top_performer';
  const heading = `Du bist ${AWARD_LABEL[main]} ${r.season_label}`;
  const paragraphs = [
    `Glückwunsch: Platz ${r.rank} von ${r.participants} in der Matchunt Liga, ${r.points} Punkte.`,
  ];
  if (r.awards.length > 1) paragraphs.push(`Deine Auszeichnungen: ${r.awards.map((a) => AWARD_LABEL[a]).join(', ')}.`);
  if (r.prizes && r.prizes.length) paragraphs.push(`Dein Preis: ${r.prizes.join(' · ')}. Wir melden uns dazu bei dir.`);
  paragraphs.push('Dein Abzeichen steht ab jetzt auf deiner Prüfseite. Im Partnerstatus findest du den Signatur-Baustein mit Auszeichnung, die Urkunde als PDF und einen Text für LinkedIn.');
  paragraphs.push(AWARD_CRITERIA);
  return { subject: `Matchunt Liga: ${heading}`, heading, paragraphs };
}

export const awardMailBodyHtml = (r: LigaAwardMailRow) => {
  const c = awardMailContent(r);
  return `<p>Hallo${r.full_name ? ` ${escape(r.full_name.split(/\s+/)[0])}` : ''},</p>`
    + c.paragraphs.map((p) => `<p>${escape(p)}</p>`).join('');
};
