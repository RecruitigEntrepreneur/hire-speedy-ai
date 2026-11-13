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

// ---------------------------------------------------------------------------
// Sprache der Mails (Mehrsprachigkeit 13.11.2026): Headhunter lesen in ihrer Profilsprache
// (du). Ohne Angabe Deutsch, wortgleich wie bisher. Ohne Abhängigkeiten, weil das
// Frontend diese Datei mitliest.
// ---------------------------------------------------------------------------

/** Sprachen der Liga-Mails; de-AT/de-CH lesen Deutsch (de-CH ohne ß). */
export type LigaLang = 'de' | 'de-AT' | 'de-CH' | 'en' | 'sv' | 'nb';
const L4 = (lang: LigaLang | null | undefined, de: string, en: string, sv: string, nb: string) => {
  if (lang === 'en') return en;
  if (lang === 'sv') return sv;
  if (lang === 'nb') return nb;
  return lang === 'de-CH' ? de.replace(/ß/g, 'ss') : de;
};
const AWARD_LABEL_OTHER: Record<LigaAwardKind, [string, string, string]> = {
  season_winner: ['Headhunter of the Season', 'Säsongens headhunter', 'Sesongens headhunter'],
  top_performer: ['Top Performer', 'Top Performer', 'Top Performer'],
  newcomer: ['Rising Star of the Season', 'Säsongens klättrare', 'Sesongens klatrer'],
  accurate: ['Sharpshooter', 'Träffsäker', 'Treffsikker'],
};
/** Name der Auszeichnung in der Sprache des Lesers */
export const awardLabelIn = (kind: LigaAwardKind, lang?: LigaLang | null) => {
  const o = AWARD_LABEL_OTHER[kind];
  return o ? L4(lang, AWARD_LABEL[kind], o[0], o[1], o[2]) : AWARD_LABEL[kind];
};
const criteriaIn = (lang?: LigaLang | null) => L4(lang, AWARD_CRITERIA,
  'What counts are results with clients in the quarter: interviews, offers, hires and hires that last.',
  'Det som räknas är resultat hos kunden under kvartalet: intervjuer, erbjudanden, anställningar och anställningar som håller.',
  'Det som teller, er resultater hos kunden i kvartalet: intervjuer, tilbud, ansettelser og ansettelser som varer.');
const dateIn = (iso: string, lang?: LigaLang | null) => {
  if (!lang || lang === 'de' || lang === 'de-AT' || lang === 'de-CH') return dmy(iso);
  const loc = lang === 'en' ? 'en-GB' : lang === 'sv' ? 'sv-SE' : 'nb-NO';
  return new Intl.DateTimeFormat(loc, { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${iso.slice(0, 10)}T12:00:00Z`));
};

/** Betreff und Kernzeilen der Wochenmail. Der Rahmen kommt vom Server (layout). */
export function weeklyContent(r: LigaWeeklyRow, lang?: LigaLang | null): { subject: string; heading: string; lines: string[] } {
  if (lang === 'en' || lang === 'sv' || lang === 'nb') return weeklyContentOther(r, lang);
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
  if (lang === 'de-CH') return { subject: `Matchunt Liga: ${heading}`, heading, lines: lines.map((l) => l.replace(/ß/g, 'ss')) };
  return { subject: `Matchunt Liga: ${heading}`, heading, lines };
}

function weeklyContentOther(r: LigaWeeklyRow, lang: 'en' | 'sv' | 'nb'): { subject: string; heading: string; lines: string[] } {
  const T = (en: string, sv: string, nb: string) => L4(lang, '', en, sv, nb);
  const moved = r.previous_rank === null ? 0 : r.previous_rank - r.rank;
  const heading = moved > 0
    ? T(`You have climbed to place ${r.rank} (▲ ${moved})`, `Du har klättrat till plats ${r.rank} (▲ ${moved})`, `Du har klatret til plass ${r.rank} (▲ ${moved})`)
    : moved < 0
      ? T(`You are in place ${r.rank} (▼ ${Math.abs(moved)})`, `Du ligger på plats ${r.rank} (▼ ${Math.abs(moved)})`, `Du ligger på plass ${r.rank} (▼ ${Math.abs(moved)})`)
      : T(`You are in place ${r.rank}`, `Du ligger på plats ${r.rank}`, `Du ligger på plass ${r.rank}`);
  const one = r.days_left === 1;
  const lines = [
    T(`${r.points} points · place ${r.rank} of ${r.participants} · season ${r.season_label}, ${r.days_left} ${one ? 'day' : 'days'} left.`,
      `${r.points} poäng · plats ${r.rank} av ${r.participants} · säsong ${r.season_label}, ${r.days_left} ${one ? 'dag' : 'dagar'} kvar.`,
      `${r.points} poeng · plass ${r.rank} av ${r.participants} · sesong ${r.season_label}, ${r.days_left} ${one ? 'dag' : 'dager'} igjen.`),
  ];
  if (r.gap_above !== null && r.rank > 1) {
    const p1 = r.gap_above === 1;
    lines.push(T(`${r.gap_above} ${p1 ? 'point' : 'points'} to place ${r.rank - 1}.`, `${r.gap_above} ${p1 ? 'poäng' : 'poäng'} kvar till plats ${r.rank - 1}.`, `${r.gap_above} ${p1 ? 'poeng' : 'poeng'} igjen til plass ${r.rank - 1}.`));
  }
  if (r.next_hold) {
    const d = dateIn(r.next_hold, lang);
    lines.push(T(`Your hire passes the guarantee period on ${d} (${signed(r.hold_points)}).`, `Din anställning klarar garantitiden från ${d} (${signed(r.hold_points)}).`, `Ansettelsen din har passert garantiperioden fra ${d} (${signed(r.hold_points)}).`));
  }
  if (r.rank <= r.top_n) lines.push(T(`You are among the top ${r.top_n}. Whoever is there at the end of the season becomes Top Performer.`, `Du ligger bland de ${r.top_n} första. Den som ligger där när säsongen slutar blir Top Performer.`, `Du er blant de ${r.top_n} første. Den som ligger der ved sesongslutt, blir Top Performer.`));
  return { subject: `Matchunt Liga: ${heading}`, heading, lines };
}

const hello = (lang?: LigaLang | null) => L4(lang, 'Hallo', 'Hi', 'Hej', 'Hei');

export const weeklyBodyHtml = (r: LigaWeeklyRow, lang?: LigaLang | null) => {
  const c = weeklyContent(r, lang);
  return `<p>${hello(lang)}${r.full_name ? ` ${escape(r.full_name.split(/\s+/)[0])}` : ''},</p>`
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
export function awardMailContent(r: LigaAwardMailRow, lang?: LigaLang | null): { subject: string; heading: string; paragraphs: string[] } {
  if (lang === 'en' || lang === 'sv' || lang === 'nb') {
    const T = (en: string, sv: string, nb: string) => L4(lang, '', en, sv, nb);
    const main = r.awards[0] ?? 'top_performer';
    const label = (a: LigaAwardKind) => awardLabelIn(a, lang);
    const heading = T(`You are ${label(main)} ${r.season_label}`, `Du är ${label(main)} ${r.season_label}`, `Du er ${label(main)} ${r.season_label}`);
    const paragraphs = [T(`Congratulations: place ${r.rank} of ${r.participants} in the Matchunt Liga, ${r.points} points.`, `Grattis: plats ${r.rank} av ${r.participants} i Matchunt Liga, ${r.points} poäng.`, `Gratulerer: plass ${r.rank} av ${r.participants} i Matchunt Liga, ${r.points} poeng.`)];
    if (r.awards.length > 1) paragraphs.push(T(`Your awards: ${r.awards.map(label).join(', ')}.`, `Dina utmärkelser: ${r.awards.map(label).join(', ')}.`, `Utmerkelsene dine: ${r.awards.map(label).join(', ')}.`));
    if (r.prizes && r.prizes.length) paragraphs.push(T(`Your prize: ${r.prizes.join(' · ')}. We will get in touch with you about it.`, `Ditt pris: ${r.prizes.join(' · ')}. Vi hör av oss till dig om det.`, `Premien din: ${r.prizes.join(' · ')}. Vi tar kontakt med deg om den.`));
    paragraphs.push(T('Your badge is now shown on your verification page. In Partner status you will find the signature block with the award, the certificate as a PDF and a text for LinkedIn.',
      'Ditt märke visas nu på din verifieringssida. Under Partnerstatus hittar du signaturblocket med utmärkelsen, diplomet som PDF och en text för LinkedIn.',
      'Merket ditt vises nå på verifiseringssiden din. Under Partnerstatus finner du signaturblokken med utmerkelsen, diplomet som PDF og en tekst til LinkedIn.'));
    paragraphs.push(criteriaIn(lang));
    return { subject: `Matchunt Liga: ${heading}`, heading, paragraphs };
  }
  const main = r.awards[0] ?? 'top_performer';
  const heading = `Du bist ${AWARD_LABEL[main]} ${r.season_label}`;
  const paragraphs = [
    `Glückwunsch: Platz ${r.rank} von ${r.participants} in der Matchunt Liga, ${r.points} Punkte.`,
  ];
  if (r.awards.length > 1) paragraphs.push(`Deine Auszeichnungen: ${r.awards.map((a) => AWARD_LABEL[a]).join(', ')}.`);
  if (r.prizes && r.prizes.length) paragraphs.push(`Dein Preis: ${r.prizes.join(' · ')}. Wir melden uns dazu bei dir.`);
  paragraphs.push('Dein Abzeichen steht ab jetzt auf deiner Prüfseite. Im Partnerstatus findest du den Signatur-Baustein mit Auszeichnung, die Urkunde als PDF und einen Text für LinkedIn.');
  paragraphs.push(AWARD_CRITERIA);
  if (lang === 'de-CH') return { subject: `Matchunt Liga: ${heading}`, heading, paragraphs: paragraphs.map((p) => p.replace(/ß/g, 'ss')) };
  return { subject: `Matchunt Liga: ${heading}`, heading, paragraphs };
}

export const awardMailBodyHtml = (r: LigaAwardMailRow, lang?: LigaLang | null) => {
  const c = awardMailContent(r, lang);
  return `<p>${hello(lang)}${r.full_name ? ` ${escape(r.full_name.split(/\s+/)[0])}` : ''},</p>`
    + c.paragraphs.map((p) => `<p>${escape(p)}</p>`).join('');
};
