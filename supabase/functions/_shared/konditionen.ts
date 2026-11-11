// Konditionen der Headhunter und Geldfluss je Besetzung (Umbau 11.11.2026).
//
// Reine Funktionen ohne Importe: Edge Functions (Deno) und die Web-App
// (src/…, Import ohne Endung) rechnen mit derselben Datei.
//
// Fassung 1 (bis zur Umstellung):  Continuity 10 % bei Antritt, 5 % nach der Garantie,
//                                   Auslobung 8 bzw. 11 %.
// Fassung 2 (abgesegnet 10.11.):   Continuity 5 % bei Antritt, 10 % nach der Garantie,
//                                   Auslobung 15 % für die Nachbesetzung.
// Core ist in beiden Fassungen gleich: 15 % in einem Teil, nur mit Antritt.
//
// Alle Prozentsätze beziehen sich auf das Bruttojahreszielgehalt.

export type PackageKey = 'core' | 'continuity_90' | 'continuity_180';
export type ConditionsVersion = 1 | 2;

export interface Split {
  /** Kunde zahlt */
  clientPct: number;
  /** 1. Teil, bei Antritt */
  initialPct: number;
  /** 2. Teil, nach Ablauf der Garantie plus Meldefrist */
  retentionPct: number;
  /** Matchunt, wenn nichts passiert */
  matchuntPct: number;
  /** Auslobung für die Nachbesetzung (an wen auch immer besetzt) */
  bountyPct: number;
  /** Garantie in Tagen ab dem ersten Arbeitstag (null = keine Nachbesetzung) */
  continuityDays: number | null;
}

export const CONDITIONS: Record<ConditionsVersion, Record<PackageKey, Split>> = {
  1: {
    core:           { clientPct: 20, initialPct: 15, retentionPct: 0,  matchuntPct: 5,  bountyPct: 0,  continuityDays: null },
    continuity_90:  { clientPct: 23, initialPct: 10, retentionPct: 5,  matchuntPct: 8,  bountyPct: 8,  continuityDays: 90 },
    continuity_180: { clientPct: 26, initialPct: 10, retentionPct: 5,  matchuntPct: 11, bountyPct: 11, continuityDays: 180 },
  },
  2: {
    core:           { clientPct: 20, initialPct: 15, retentionPct: 0,  matchuntPct: 5,  bountyPct: 0,  continuityDays: null },
    continuity_90:  { clientPct: 23, initialPct: 5,  retentionPct: 10, matchuntPct: 8,  bountyPct: 15, continuityDays: 90 },
    continuity_180: { clientPct: 26, initialPct: 5,  retentionPct: 10, matchuntPct: 11, bountyPct: 15, continuityDays: 180 },
  },
};

export const CONDITIONS_LABEL: Record<ConditionsVersion, string> = {
  1: 'Fassung 1',
  2: 'Fassung 2',
};

/** Meldefrist des Kunden nach Ablauf der Garantie (Datenblatt). */
export const CLAIM_NOTICE_DAYS = 14;
/** Werktage, die der Kunde einer Antrittsmeldung des Headhunters widersprechen kann (R2). */
export const START_OBJECTION_WORKDAYS = 3;
/** Tage nach dem ersten Arbeitstag, nach denen der Antritt ohne abweichende Meldung feststeht (R2). */
export const START_SILENCE_DAYS = 14;
/** Zahlungsziel einer Gutschrift: Tage nach Erstellung (H12 „Geld 7 Tage danach“). */
export const CREDIT_NOTE_PAY_DAYS = 7;
/** Erinnerung an den Kunden: Tage nach Fälligkeit (K13). */
export const REMINDER_AFTER_DUE_DAYS = 7;
/** Joker: Standardwerte (J6), je Fall änderbar. */
export const JOKER_DEFAULT_PCT = 5;
export const JOKER_VALID_DAYS = 14;
/** Kontowechsel gilt nach so vielen Stunden (H13). */
export const ACCOUNT_CHANGE_HOURS = 48;

export const isPackageKey = (v: unknown): v is PackageKey => v === 'core' || v === 'continuity_90' || v === 'continuity_180';

/** Prüfregeln aus A10: Kunde = 1. + 2. Teil + Matchunt; Kunde = 1. Teil + Auslobung + Matchunt im Fall (nur Continuity). */
export function splitChecks(s: Split) {
  const normal = s.initialPct + s.retentionPct + s.matchuntPct === s.clientPct;
  const onClaim = s.continuityDays == null ? true : s.initialPct + s.bountyPct + matchuntOnClaimPct(s) === s.clientPct;
  return { normal, onClaim, ok: normal && onClaim };
}

/** Matchunt, wenn die Besetzung nach dem Antritt endet und nachbesetzt wird. */
export const matchuntOnClaimPct = (s: Split) => (s.continuityDays == null ? s.matchuntPct : s.clientPct - s.initialPct - s.bountyPct);
/** Matchunt, wenn die Person nicht antritt und nachbesetzt wird. */
export const matchuntOnNonStartPct = (s: Split) => (s.continuityDays == null ? s.clientPct : s.clientPct - s.bountyPct);

export function splitFor(pkg: PackageKey, version: ConditionsVersion): Split {
  return CONDITIONS[version][pkg];
}

const cents = (grossCents: number, pct: number) => Math.round((grossCents * pct) / 100);

/** Beträge einer Besetzung in Cent. */
export function amountsFor(pkg: PackageKey, version: ConditionsVersion, grossCents: number) {
  const s = splitFor(pkg, version);
  const client = cents(grossCents, s.clientPct);
  const initial = cents(grossCents, s.initialPct);
  const retention = cents(grossCents, s.retentionPct);
  return {
    clientCents: client,
    initialCents: initial,
    retentionCents: retention,
    matchuntCents: client - initial - retention,
    bountyCents: cents(grossCents, s.bountyPct),
    recruiterTotalCents: initial + retention,
  };
}

/**
 * Auslobung für die Nachbesetzung.
 * - Fremder Headhunter besetzt: volle Auslobung.
 * - Ursprünglicher Headhunter besetzt: insgesamt höchstens sein normaler Anteil
 *   (Deckel, R4): Auslobung minus das, was er aus der ersten Besetzung behält.
 * - Höheres Gehalt der Ersatzbesetzung: Anteil an der Nachberechnung im
 *   Verhältnis Beteiligung/Kundensatz (R4, Entscheidung 10.11.).
 */
export function bountyFor(opts: {
  bountyCents: number;
  sameRecruiter: boolean;
  /** Was der ursprüngliche Headhunter aus der ersten Besetzung behält (1. Teil, 0 bei Nichtantritt) */
  keptByOriginalCents: number;
  /** Nachberechnetes Kundenhonorar auf den Unterschied (0, wenn nicht höher) */
  differenceFeeCents?: number;
  split: Split;
}) {
  const diffShare = opts.differenceFeeCents && opts.split.clientPct > 0
    ? Math.round((opts.differenceFeeCents * (opts.split.initialPct + opts.split.retentionPct)) / opts.split.clientPct)
    : 0;
  // Normaler Anteil des ursprünglichen Headhunters (1. + 2. Teil) auf derselben Grundlage wie die Auslobung.
  // Joker bei Core: Auslobung = voller Anteil.
  const sharePct = opts.split.initialPct + opts.split.retentionPct;
  const normalShare = opts.split.bountyPct > 0 ? Math.round((opts.bountyCents * sharePct) / opts.split.bountyPct) : opts.bountyCents;
  const base = opts.sameRecruiter
    ? Math.max(0, Math.min(opts.bountyCents, normalShare - opts.keptByOriginalCents))
    : opts.bountyCents;
  return base + diffShare;
}

/** Honorar auf den Unterschied, wenn die Ersatzbesetzung mehr verdient (V7). */
export function differenceFeeCents(originalGrossCents: number, replacementGrossCents: number, clientPct: number) {
  const diff = replacementGrossCents - originalGrossCents;
  return diff > 0 ? cents(diff, clientPct) : 0;
}

/**
 * Welche Fassung gilt für einen Headhunter an einem Tag?
 * - Ohne aktive Fassung 2 (kein Stichtag gesetzt): Fassung 1.
 * - Zugestimmt (H2) bis zu diesem Tag: Fassung 2.
 * - Vertrag ab dem Stichtag unterschrieben (neuer Headhunter): Fassung 2.
 * - Ab dem Tag, an dem Fassung 2 für alle gilt (§ 18 Abs. 2): Fassung 2.
 * Für eine Besetzung zählt der Tag, an dem die Stelle aktiviert wurde.
 */
export function conditionsVersionAt(input: {
  at: string; // ISO-Datum oder Zeitstempel
  activeFrom: string | null; // Stichtag Fassung 2
  forcedFrom: string | null; // Fassung 2 gilt für alle ab
  consentedAt: string | null;
  contractSignedAt: string | null;
}): ConditionsVersion {
  const day = (v: string | null) => (v ? v.slice(0, 10) : null);
  const at = day(input.at)!;
  const active = day(input.activeFrom);
  if (!active || at < active) return 1;
  const consent = day(input.consentedAt);
  if (consent && consent <= at) return 2;
  const signed = day(input.contractSignedAt);
  if (signed && signed >= active) return 2;
  const forced = day(input.forcedFrom);
  if (forced && at >= forced) return 2;
  return 1;
}

/** Fassung, die in einem Preis-Snapshot steckt (Altfälle ohne Kennung = 1). */
export function versionOfSnapshot(snapshot: Record<string, unknown> | null | undefined): ConditionsVersion {
  return Number((snapshot as any)?.conditionsVersion) === 2 ? 2 : 1;
}

/** Snapshot einer Besetzung mit der Aufteilung der Fassung (überschreibt die Headhunter-Anteile). */
export function snapshotWithConditions(base: Record<string, unknown>, pkg: PackageKey, version: ConditionsVersion) {
  const s = splitFor(pkg, version);
  return {
    ...base,
    conditionsVersion: version,
    recruiterInitialPct: s.initialPct,
    recruiterRetentionPct: s.retentionPct,
    matchuntPct: s.matchuntPct,
    researchBountyPct: s.bountyPct,
    matchuntOnClaimPct: matchuntOnClaimPct(s),
  };
}

// ---------------------------------------------------------------------------
// Anzeige für Headhunter (H3–H6): „8.250 € bei Antritt, Rest nach 90 Tagen“
// ---------------------------------------------------------------------------

export const euro = (c: number) => `${Math.round(c / 100).toLocaleString('de-DE')} €`;

export interface EarningPlan {
  totalCents: number;
  initialCents: number;
  retentionCents: number;
  continuityDays: number | null;
  /** Kurzzeile unter dem Betrag */
  line: string;
  /** Zeile im Kopf der Stelle mit beiden Beträgen */
  detail: string;
}

export function earningPlan(pkg: PackageKey, version: ConditionsVersion, grossCents: number): EarningPlan {
  const a = amountsFor(pkg, version, grossCents);
  const s = splitFor(pkg, version);
  const total = a.initialCents + a.retentionCents;
  if (!s.continuityDays || a.retentionCents === 0) {
    return { totalCents: total, initialCents: total, retentionCents: 0, continuityDays: null, line: 'ganz bei Antritt', detail: 'ganz bei Antritt' };
  }
  return {
    totalCents: total,
    initialCents: a.initialCents,
    retentionCents: a.retentionCents,
    continuityDays: s.continuityDays,
    line: `${euro(a.initialCents)} bei Antritt, Rest nach ${s.continuityDays} Tagen`,
    detail: `${euro(a.initialCents)} bei Antritt · ${euro(a.retentionCents)} nach ${s.continuityDays} Tagen`,
  };
}

/** Prozent-Anteil des Headhunters am Zielgehalt (z. B. 15). */
export const recruiterPct = (pkg: PackageKey, version: ConditionsVersion) => {
  const s = splitFor(pkg, version);
  return s.initialPct + s.retentionPct;
};

// ---------------------------------------------------------------------------
// Datum: Werktage (Mo–Fr, ohne Feiertage) und Tage
// ---------------------------------------------------------------------------

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function addWorkdays(iso: string, n: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left -= 1;
  }
  return d.toISOString().slice(0, 10);
}

/** Erste Gutschrift, in der ein heute fälliger Posten landet: Lauf Anfang des Folgemonats. */
export function nextRunLabel(todayIso: string): string {
  const d = new Date(`${todayIso.slice(0, 10)}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1, 1);
  return `Anfang ${d.toLocaleDateString('de-DE', { month: 'long', timeZone: 'UTC' })}`;
}
