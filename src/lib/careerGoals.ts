// „Was wollen Sie in Ihrer Karriere ultimativ erreichen?“: Vorschläge je Person statt
// fester nächster Schritte. Zwei Reihen: beruflich (Rolle, Ebene, Richtung) und
// persönlich (sicherer Arbeitgeber, ankommen, weniger Stress …). Feste Regeln aus
// Titel, Erfahrung, Führung, Stör-Knöpfen, Auslöser und Werdegang, keine KI. Die
// passendsten stehen gestrichelt vorn, mit dem Grund. Gespeichert wird wie bisher
// kommagetrennt in career_ultimate_goal.

import { belowLevel, type RoleFamily } from '@/lib/roleFamily';

export type GoalKind = 'beruflich' | 'persoenlich';

export interface GoalEntry {
  kind: GoalKind;
  /** Für „Langfristiges Ziel: …“ im Kundentext. Fehlt = der Knopf selbst, null = nie zum Kunden. */
  client?: string | null;
  /** Thema: gleiches Thema steht im Kundentext nur einmal (wie pair bei gefällt/stört). */
  theme?: string;
}

export interface GoalSuggestion {
  label: string;
  /** Grund, warum der Vorschlag vorn steht (z. B. „stört: Übernahme“). */
  reason?: string;
  top: boolean;
}

export interface GoalSuggestions {
  beruflich: GoalSuggestion[];
  persoenlich: GoalSuggestion[];
  /** Die persönliche Reihe passt besser und steht oben. */
  persoenlichZuerst: boolean;
}

const P = (client: string | null, theme?: string): GoalEntry => ({ kind: 'persoenlich', client, theme });
const B = (client?: string | null, theme?: string): GoalEntry => ({ kind: 'beruflich', client, theme });

/** Persönliche Ziele: was viele auf die Frage antworten, ohne eine Rolle zu nennen. */
export const PERSONAL_GOALS: Record<string, GoalEntry> = {
  'Sicherer Arbeitgeber': P('ein sicherer Arbeitgeber', 'stabil'),
  'Langfristig ankommen': P('ein Arbeitgeber zum Ankommen', 'ankommen'),
  'Weniger Stress': P('eine gesunde Arbeitsbelastung', 'last'),
  'Planbare Arbeitszeiten': P('planbare Arbeitszeiten', 'schicht'),
  'Mehr Zeit fürs Privatleben': P('mehr Zeit fürs Privatleben', 'privat'),
  'Nah am Wohnort': P('ein Arbeitsplatz nah am Wohnort', 'weg'),
  'Sinnvolle Arbeit': P('eine sinnstiftende Aufgabe', 'sinn'),
  'Flexibel arbeiten': P('flexibles Arbeiten', 'flex'),
  // Geld geht nie zum Kunden (wie Gehalt bei gefällt/stört).
  'Mehr verdienen': P(null, 'gehalt'),
};

/**
 * Berufliche Ziele. client fehlt = der Knopf selbst ist der Text („Langfristiges Ziel:
 * Bereichsleitung.“). null = nie zum Kunden: Wer „eigene Firma“ sagt, wird beim Kunden
 * sonst als Abgänger auf Zeit gelesen.
 */
export const CAREER_GOALS: Record<string, GoalEntry> = {
  // nach Ebene
  'Senior-Rolle': B('eine Senior-Rolle'),
  'Mehr Verantwortung': B('mehr Verantwortung'),
  'Erste Führungsrolle': B('eine erste Führungsrolle'),
  'Fachexpertise ausbauen': B('mehr Fachexpertise'),
  'Teamleitung': B(),
  'Fachkarriere ohne Führung': B('eine Fachkarriere ohne Führungsverantwortung'),
  'Projektverantwortung': B(),
  'Abteilungsleitung': B(),
  'Bereichsleitung': B(),
  'Strategische Rolle': B('eine strategische Rolle'),
  'Etwas aufbauen': B('eine Aufbaurolle'),
  'Geschäftsführung': B(),
  'Wissen weitergeben': B('Wissen und Erfahrung weitergeben'),
  'International arbeiten': B('internationale Verantwortung'),
  'Selbstständig beraten': B(null),
  'Eigene Firma': B(null),
  // nach Titel
  'Agile Coach': B(),
  'Product Owner': B(),
  'Head of Agile': B(),
  'Software-Architektur': B(),
  'Engineering Manager': B(),
  'CTO': B(),
  'Head of Product': B(),
  'Leitung Controlling': B(),
  'Business Partner': B(),
  'Kaufmännische Leitung': B(),
  'CFO': B(),
  'Leitung Rechnungswesen': B(),
  'Leitung Finanzen': B(),
  'Vertriebsleitung': B(),
  'Vertriebsdirektor': B('eine Vertriebsdirektion'),
  'Gesamtvertrieb DACH': B('der Gesamtvertrieb DACH'),
  'Stationsleitung': B(),
  'Praxisanleitung': B(),
  'Fachweiterbildung': B('eine Fachweiterbildung'),
  'Pflegedienstleitung': B(),
  'Studium Pflegemanagement': B('ein Studium im Pflegemanagement'),
  'HR Business Partner': B(),
  'Personalleitung': B(),
  'Einkaufsleitung': B(),
  'Leitung PMO': B(),
  'Technische Leitung': B(),
  'Betriebsleitung': B(),
  'Meister': B('der Meister'),
  'Größeres Unternehmen führen': B('die Führung eines größeren Unternehmens'),
  'Beiratsmandate': B(),
  'Interim-Management': B(),
  // Beteiligung ist Vergütung: nie zum Kunden.
  'Beteiligung am Unternehmen': B(null),
};

export const ALL_GOALS: Record<string, GoalEntry> = { ...CAREER_GOALS, ...PERSONAL_GOALS };

/** Titel → passende berufliche Ziele (erste Regel, die passt, zuerst). */
const TITLE_GOALS: [RegExp, string[]][] = [
  [/scrum|agile/i, ['Agile Coach', 'Product Owner', 'Head of Agile']],
  [/geschäftsführ|\bceo\b|managing director|vorstand/i, ['Größeres Unternehmen führen', 'Beiratsmandate', 'Interim-Management', 'Beteiligung am Unternehmen']],
  [/product owner|produktmanag|product manag/i, ['Head of Product', 'Product Owner']],
  [/entwickl|developer|engineer|software|programmier|devops|architekt/i, ['Software-Architektur', 'Engineering Manager', 'CTO']],
  [/controll/i, ['Leitung Controlling', 'Business Partner', 'Kaufmännische Leitung', 'CFO']],
  [/buchhalt|accounting|bilanz|finanz|rechnungswesen/i, ['Leitung Rechnungswesen', 'Leitung Finanzen', 'CFO']],
  [/vertrieb|sales|account manag|außendienst|key account/i, ['Vertriebsleitung', 'Vertriebsdirektor', 'Gesamtvertrieb DACH', 'Geschäftsführung']],
  [/pflege|krankenschwester|krankenpfleg|altenpfleg|gesundheits/i, ['Stationsleitung', 'Fachweiterbildung', 'Praxisanleitung', 'Pflegedienstleitung', 'Studium Pflegemanagement']],
  [/personal|\bhr\b|recruit|people/i, ['HR Business Partner', 'Personalleitung']],
  [/einkauf|procurement|beschaffung/i, ['Einkaufsleitung']],
  [/projekt|project/i, ['Projektverantwortung', 'Leitung PMO', 'Bereichsleitung']],
  [/elektron|elektrik|mechatron|mechanik|techniker|ingenieur|instandhalt|produktion/i, ['Technische Leitung', 'Betriebsleitung', 'Meister']],
];

type Stage = 'early' | 'mid' | 'senior' | 'late';
/** Nach Erfahrung, getrennt für Leute mit und ohne Führung (ohne Führung nie gleich „Geschäftsführung“). */
const STAGE_GOALS: Record<'leader' | 'expert', Record<Stage, string[]>> = {
  leader: {
    early: ['Mehr Verantwortung', 'Teamleitung', 'Fachexpertise ausbauen'],
    mid: ['Abteilungsleitung', 'Strategische Rolle', 'Fachkarriere ohne Führung'],
    senior: ['Abteilungsleitung', 'Bereichsleitung', 'Strategische Rolle', 'Etwas aufbauen', 'Fachkarriere ohne Führung'],
    late: ['Bereichsleitung', 'Geschäftsführung', 'Etwas aufbauen', 'Fachkarriere ohne Führung', 'Wissen weitergeben', 'Selbstständig beraten'],
  },
  expert: {
    early: ['Senior-Rolle', 'Mehr Verantwortung', 'Erste Führungsrolle', 'Fachexpertise ausbauen'],
    mid: ['Teamleitung', 'Fachkarriere ohne Führung', 'Projektverantwortung'],
    senior: ['Teamleitung', 'Fachkarriere ohne Führung', 'Projektverantwortung', 'Strategische Rolle'],
    late: ['Teamleitung', 'Fachkarriere ohne Führung', 'Wissen weitergeben', 'Projektverantwortung', 'Selbstständig beraten'],
  },
};
/** Führungs-Ziele über der heutigen Rolle (für „führt schon …“). */
const LEAD_GOAL = /leitung|direktor|head|geschäftsführung|führen|manager|cto|cfo/i;
const ALWAYS = ['Eigene Firma', 'International arbeiten'];
/** Liegt unter der Ebene von jemandem, der schon führt oder lange dabei ist. */
const ENTRY_LEVEL = new Set(['Senior-Rolle', 'Erste Führungsrolle', 'Mehr Verantwortung', 'Fachexpertise ausbauen']);

export interface GoalInput {
  job_title: string;
  experience_years: number | null;
  leadership_scope: string | null;
  leadership_team_size: number | null;
  /** Angetippte Stör-Knöpfe (Knopfnamen). */
  negative: string[];
  /** Angetippte Auslöser. */
  incidents: string[];
  career?: { freelance?: boolean; formerLeaderOnly?: boolean; shortStints?: number };
  /** Rollenfamilie: Geschäftsführung bekommt nie Bereichs- oder Abteilungsleitung. */
  family?: RoleFamily;
}

const stageOf = (years: number | null): Stage => {
  const y = years ?? 0;
  return y >= 20 ? 'late' : y >= 12 ? 'senior' : y >= 5 ? 'mid' : 'early';
};

/** Nächste Führungsstufe für jemanden, der schon führt. */
function nextLeadStep(scope: string | null, size: number | null, title: string): string | null {
  if (scope === 'functional') return /entwickl|developer|engineer|software|scrum|agile/i.test(title) ? 'Engineering Manager' : 'Teamleitung';
  if (scope !== 'disciplinary') return null;
  if ((size ?? 0) > 50) return 'Geschäftsführung';
  if ((size ?? 0) > 15) return 'Bereichsleitung';
  return 'Abteilungsleitung';
}

const firstOf = (list: string[], wanted: string[]) => wanted.find((w) => list.includes(w)) ?? null;

/** „Vertriebsleitung“ für einen Vertriebsleiter ist kein Ziel, sondern die heutige Rolle. */
const stem = (w: string) => w.toLowerCase().replace(/[^a-zäöüß]/g, '').replace(/(ungen|ung|erin|innen|in|er)$/, '');
export function sameRole(goal: string, title: string): boolean {
  const g = stem(goal.split(/\s+/)[0]);
  return g.length >= 5 && title.split(/[\s/,-]+/).some((w) => stem(w) === g);
}

/** Vorschläge für „Was wollen Sie in Ihrer Karriere ultimativ erreichen?“. */
export function careerGoalSuggestions(f: GoalInput): GoalSuggestions {
  const stage = stageOf(f.experience_years);
  const years = f.experience_years ?? 0;
  const leads = f.leadership_scope === 'disciplinary' || f.leadership_scope === 'functional';
  const titleGoals = [...new Set(TITLE_GOALS.filter(([re]) => re.test(f.job_title)).flatMap(([, g]) => g))].filter((g) => !sameRole(g, f.job_title));

  // Beruflich: Titel, dann Ebene, dann immer Gültiges; nie unter der heutigen Ebene.
  const tops = new Map<string, string>();
  // Führt schon: die nächste Stufe über der heutigen Rolle, aus dem Titel, sonst allgemein.
  const titleLead = f.leadership_scope === 'disciplinary' ? titleGoals.find((g) => LEAD_GOAL.test(g)) : undefined;
  const genericLead = nextLeadStep(f.leadership_scope, f.leadership_team_size, f.job_title);
  const lead = titleLead ?? (genericLead && !sameRole(genericLead, f.job_title) ? genericLead : null);
  if (lead) tops.set(lead, f.leadership_scope === 'functional' ? 'führt fachlich' : `führt ${f.leadership_team_size ?? 'ein Team'}`);
  if (f.negative.includes('Kein Einfluss auf Technik')) tops.set('Software-Architektur', 'stört: kein Einfluss auf Technik');
  if (f.negative.includes('Keine Entwicklung') && !lead) tops.set(stage === 'early' ? 'Mehr Verantwortung' : stage === 'mid' ? 'Teamleitung' : 'Abteilungsleitung', 'stört: keine Entwicklung');
  if (f.negative.includes('Wenig Gestaltungsspielraum') || f.negative.includes('Zu viel operative Detailarbeit')) tops.set('Strategische Rolle', 'stört: wenig Gestaltung');
  if (f.career?.formerLeaderOnly && !leads) tops.set('Teamleitung', 'hat früher geführt');
  if (f.career?.freelance) tops.set('Selbstständig beraten', 'war selbstständig');
  const titleTop = titleGoals.find((g) => !tops.has(g));
  if (titleTop && tops.size < 3) tops.set(titleTop, 'Titel');

  const blocked = (g: string) =>
    (ENTRY_LEVEL.has(g) && (leads || years >= 8)) ||
    (g === 'Teamleitung' && f.leadership_scope === 'disciplinary') ||
    (g === 'Erste Führungsrolle' && leads);
  const order = [...tops.keys(), ...titleGoals, ...STAGE_GOALS[leads ? 'leader' : 'expert'][stage], ...(years >= 15 ? ['Wissen weitergeben'] : []), ...ALWAYS];
  const beruflich = [...new Set(order)]
    .filter((g) => !blocked(g) && !sameRole(g, f.job_title) && !(f.family && belowLevel(f.family, g)))
    .slice(0, 10)
    .map((g) => ({ label: g, reason: tops.get(g), top: tops.has(g) && [...tops.keys()].indexOf(g) < 3 }));

  // Persönlich: immer dieselbe Reihe, gestrichelt, wenn es zu den Angaben passt.
  const neg = (labels: string[]) => firstOf(f.negative, labels);
  const inc = (labels: string[]) => firstOf(f.incidents, labels);
  const why = new Map<string, string>();
  const unsicher = neg(['Übernahme', 'Umstrukturierung', 'Verkauf geplant']) ?? inc(['Stellenabbau', 'Übernahme', 'Neuorganisation', 'Verkauf geplant']);
  if (unsicher) why.set('Sicherer Arbeitgeber', `${f.negative.includes(unsicher) ? 'stört' : 'Auslöser'}: ${unsicher}`);
  if (years >= 20) why.set('Langfristig ankommen', `${years} J.`);
  else if ((f.career?.shortStints ?? 0) >= 2) why.set('Langfristig ankommen', 'viele kurze Stationen');
  const last = neg(['Arbeitslast', 'Bereitschaftsdienst', 'Ständiges Einspringen', 'Personalmangel']);
  if (last) why.set('Weniger Stress', `stört: ${last}`);
  const zeiten = neg(['Schlechte Dienstplanung', 'Nachtdienste', 'Wochenenddienste']);
  if (zeiten) why.set('Planbare Arbeitszeiten', `stört: ${zeiten}`);
  const privat = neg(['Viel Reisen']);
  if (privat) why.set('Mehr Zeit fürs Privatleben', `stört: ${privat}`);
  if (f.negative.includes('Arbeitsweg')) why.set('Nah am Wohnort', 'stört: Arbeitsweg');
  if (f.negative.includes('Remote gestrichen')) why.set('Flexibel arbeiten', 'stört: Remote gestrichen');
  const geld = neg(['Gehalt', 'Gehalt unter Markt', 'Bezahlung', 'Vergütung', 'Fixum zu niedrig', 'Provision gekürzt']);
  if (geld) why.set('Mehr verdienen', `stört: ${geld}`);
  const personalOrder = [...why.keys(), ...Object.keys(PERSONAL_GOALS)];
  const persoenlich = [...new Set(personalOrder)].map((g) => ({ label: g, reason: why.get(g), top: why.has(g) }));

  const topsB = beruflich.filter((g) => g.top).length;
  const topsP = persoenlich.filter((g) => g.top && g.label !== 'Mehr verdienen').length;
  return { beruflich, persoenlich, persoenlichZuerst: topsP > topsB };
}

/** Text für „Langfristiges Ziel: …“, oder null (nie zum Kunden). Unbekannte Knöpfe (z. B. Wunschrollen) wie getippt. */
export function goalClientText(label: string): string | null {
  const e = ALL_GOALS[label];
  if (!e) return label;
  return e.client === null ? null : e.client ?? label;
}

/** Thema eines Ziels (für „gleiches Thema nur einmal“), sonst undefined. */
export const goalTheme = (label: string): string | undefined => ALL_GOALS[label]?.theme;

/** Ziel-Knöpfe, die als Wunschrolle taugen (in „Wunschstelle“ gleich vorgeschlagen). */
export function goalsAsRoles(labels: string[]): string[] {
  return labels.filter((l) => (CAREER_GOALS[l] && /leitung|leiter|head|lead|manager|direktor|cto|cfo|coach|owner|architektur|geschäftsführung|business partner|meister/i.test(l)) || isRoleGoal(l));
}

// ---------------------------------------------------------------------------
// Eigene Worte beim Ziel verstehen
// ---------------------------------------------------------------------------
// Wie bei „stört“: je Satzteil die passenden Ziel-Knöpfe, mit dem Satzteil als Beleg.
// Eine getippte Rolle („Head of Data“, „Leiter Einkauf“, „CFO“) wird ein eigener Knopf.

const NEIN = /\b(nicht|kein\w*|ohne|nie)\b/i;

/** Was Kandidaten sagen → Ziel-Knopf. Reihenfolge zählt: Genaueres zuerst. */
export const GOAL_RECOGNIZE: [RegExp, string][] = [
  [/ohne (personal|führung|mitarbeiter)|nicht (mehr )?führen|kein(e)? (chef|führung)|fachlich ganz oben|experte|expertin|spezialist/i, 'Fachkarriere ohne Führung'],
  [/abteilung (leiten|führen|übernehmen)|abteilungsleit/i, 'Abteilungsleitung'],
  [/bereich (leiten|verantworten|führen)|bereichsleit/i, 'Bereichsleitung'],
  [/geschäftsführ|\bceo\b|ganz nach oben|vorstand/i, 'Geschäftsführung'],
  [/personal führen|eigenes team|team (führen|leiten)|chef werden|führungsrolle|führungsposition|teamleit/i, 'Teamleitung'],
  [/mehr verantwortung|mehr entscheiden|mehr zu sagen/i, 'Mehr Verantwortung'],
  [/etwas aufbauen|aufbauen|von null|neu aufbauen/i, 'Etwas aufbauen'],
  [/strategisch|mitgestalten|gestalten/i, 'Strategische Rolle'],
  [/wissen weitergeben|mentor|dozent|trainer|ausbilden|lehren|unterrichten/i, 'Wissen weitergeben'],
  [/ausland|international|weltweit|global/i, 'International arbeiten'],
  [/berater|beratung|consult/i, 'Selbstständig beraten'],
  [/selbstständig|selbständig|eigenes ding|eigene firma|eigenes unternehmen|gründen|start-?up gründen/i, 'Eigene Firma'],
  [/beirat|aufsichtsrat/i, 'Beiratsmandate'],
  [/interim/i, 'Interim-Management'],
  [/sicher(er|en|es)? (job|arbeitgeber|arbeitsplatz|stelle)|unbefristet|öffentliche[rn]? dienst|krisenfest|sicherheit/i, 'Sicherer Arbeitgeber'],
  [/bis zur rente|ankommen|nicht mehr wechseln|langfristig bleiben|für immer/i, 'Langfristig ankommen'],
  [/weniger (druck|stress)|gesund bleiben|burn ?out|entspannter|ruhiger/i, 'Weniger Stress'],
  [/familie|kinder|privatleben|teilzeit|4-tage|vier-tage|mehr freizeit|work-life/i, 'Mehr Zeit fürs Privatleben'],
  [/keine (schicht|nacht|wochenend)|geregelte (zeiten|arbeitszeiten)|planbar/i, 'Planbare Arbeitszeiten'],
  [/näher an zuhause|nah am wohnort|nicht mehr pendeln|kürzerer weg|vor ort wohnen/i, 'Nah am Wohnort'],
  [/home ?office|flexibel|remote|von zu hause|mobil arbeiten/i, 'Flexibel arbeiten'],
  [/sinnvoll|sinnstiftend|etwas bewegen|impact|was bewirken|purpose/i, 'Sinnvolle Arbeit'],
  [/mehr geld|mehr verdienen|finanziell|gehalt|reich werden/i, 'Mehr verdienen'],
];

/** Rolle im Text: „Head of Data“, „Leiter Einkauf“, „Chief Revenue Officer“, „CFO“, „Lead Architect“. */
const ROLE_IN_TEXT = /\b(head of(?: [a-zäöüß&-]+){1,2}|(?:leiter|leiterin|leitung)(?: (?:des |der )?[a-zäöüß&-]+){1}|chief(?: [a-z-]+){1,2} officer|vp(?: of)?(?: [a-zäöüß&-]+){1,2}|director(?: of)?(?: [a-zäöüß&-]+){1,2}|c[a-z]o|(?:lead |senior |principal )?[a-zäöüß-]*architekt(?:in)?|[a-zäöüß-]+-?manager(?:in)?|engineering manager|product owner)\b/i;
const ROLE_FULL = new RegExp(`^${ROLE_IN_TEXT.source.replace(/^\\b|\\b$/g, '')}$`, 'i');
const ROLE_WORDS_BLOCK = /^(ich|mal|gern|gerne|werden|sein|mein|meine|der|die|das|ein|eine)$/i;

/** Getippte Rolle, die ein eigener Ziel-Knopf ist (kein Katalog-Knopf). */
export function isRoleGoal(label: string): boolean {
  const t = label.trim();
  return !!t && t.split(/\s+/).length <= 5 && ROLE_FULL.test(t) && !t.split(/\s+/).some((w) => ROLE_WORDS_BLOCK.test(w));
}

const titleCase = (t: string) => t.split(/\s+/).map((w) => (/^(of|und|des|der|für)$/i.test(w) ? w.toLowerCase() : /^c[a-z]o$/i.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');

export interface GoalUnderstood { label: string; quote: string; source: 'wort' | 'gelernt' | 'ki'; isNew?: boolean }

/** Satzteile der eigenen Worte (wie bei „stört“). */
export function goalClauses(own: string): string[] {
  return own
    .split(/[,;.!?\n]+|\s+(?:und|aber|weil|sowie|außerdem|danach|vorher|später|irgendwann)\s+/i)
    .map((c) => c.trim().replace(/^(und|aber|weil|sowie|außerdem|danach|vorher|später|irgendwann)\s+/i, ''))
    .filter((c) => c.replace(/[^a-zäöüß]/gi, '').length >= 3);
}

/**
 * Was in den eigenen Worten zum Ziel steckt: erst eine getippte Rolle, dann das
 * Wörterbuch, dann gelernte Wendungen. Schon Angetipptes fällt weg; höchstens 4.
 */
export function understandGoalWords(own: string, chosen: string[] = [], learned: { phrase: string; label: string }[] = []): GoalUnderstood[] {
  const has = (l: string) => chosen.some((c) => c.trim().toLowerCase() === l.toLowerCase());
  const hits: GoalUnderstood[] = [];
  const add = (u: GoalUnderstood) => { if (!has(u.label) && !hits.some((h) => h.label.toLowerCase() === u.label.toLowerCase())) hits.push(u); };
  for (const clause of goalClauses(own)) {
    const quote = clause.split(/\s+/).length > 8 ? `${clause.split(/\s+/).slice(0, 8).join(' ')} …` : clause;
    // „Head of Data werden“: Füllwörter am Ende gehören nicht zur Rolle.
    const words = (ROLE_IN_TEXT.exec(clause)?.[1] ?? '').split(/\s+/).filter(Boolean);
    while (words.length > 1 && ROLE_WORDS_BLOCK.test(words[words.length - 1])) words.pop();
    const role = words.join(' ');
    if (role && !words.some((w) => ROLE_WORDS_BLOCK.test(w)) && !NEIN.test(clause)) {
      const known = Object.keys(ALL_GOALS).find((g) => g.toLowerCase() === role.toLowerCase());
      add(known ? { label: known, quote: role, source: 'wort' } : { label: titleCase(role), quote: role, source: 'wort', isNew: true });
    }
    for (const [re, label] of GOAL_RECOGNIZE) {
      if (!re.test(clause)) continue;
      // „kein Chef werden“ ist keine Teamleitung.
      if (NEIN.test(clause) && label !== 'Fachkarriere ohne Führung' && label !== 'Weniger Stress' && label !== 'Planbare Arbeitszeiten' && label !== 'Langfristig ankommen') continue;
      add({ label, quote, source: 'wort' });
    }
    const n = clause.toLowerCase().replace(/[^a-zäöüß\s-]/g, ' ').replace(/\s+/g, ' ').trim();
    for (const l of learned) if (ALL_GOALS[l.label] && n.includes(l.phrase)) add({ label: l.label, quote, source: 'gelernt' });
  }
  return hits.slice(0, 4);
}
