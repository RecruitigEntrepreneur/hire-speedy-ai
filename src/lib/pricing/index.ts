/**
 * Die Rechnung hinter einem Auftrag — ohne Claim und mit.
 *
 * Eine Stelle, an der Kundenhonorar, Recruiter-Tranchen, Matchunt-Anteil und
 * Re-Search-Bounty entstehen. Vorher lag dieselbe Rechnung in vier Varianten im
 * Code (useRecruiterStats, useUnifiedTaskInbox, useRecruiterInterviewAgenda,
 * FeeCalculatorCard) und in zwei widersprüchlichen Fassungen im Backend
 * (process-offer-response rechnete den Recruiter-Anteil als Quote des
 * Honorars, AdminPlacements zog pauschal 20 % Plattformanteil ab).
 */
import { PACKAGES, type PackageDefinition, type PackageKey } from './packages';
import { applyPercent, eurosToCents, type Cents } from './money';

export * from './money';
export * from './packages';

/**
 * Unveränderliches Abbild eines Pakets zum Zeitpunkt der Auswahl.
 *
 * Wird beim Einzelauftrag gespeichert. Spätere Änderungen an den offiziellen
 * Paketen dürfen bestehende Aufträge, Placements und entstandene
 * Zahlungsansprüche nicht rückwirkend verändern — deshalb wird gerechnet, was
 * im Snapshot steht, nie was heute in PACKAGES steht.
 */
export interface PricingSnapshot {
  packageKey: PackageKey;
  packageVersion: number;
  publicName: string;
  clientFeePct: number;
  continuityDays: number | null;
  recruiterInitialPct: number;
  recruiterRetentionPct: number;
  matchuntPct: number;
  researchBountyPct: number;
  matchuntOnClaimPct: number;
  researchMaxActiveDays: number | null;
  claimNoticeDays: number;
  eligibleClaimCategories: string[];
  excludedClaimCategories: string[];
  /** Wann der Snapshot entstand — für den Nachweis. */
  capturedAt: string;
}

export function snapshotOf(pkg: PackageDefinition, at: Date = new Date()): PricingSnapshot {
  return {
    packageKey: pkg.key,
    packageVersion: pkg.version,
    publicName: pkg.publicName,
    clientFeePct: pkg.clientFeePct,
    continuityDays: pkg.continuityDays,
    recruiterInitialPct: pkg.recruiterInitialPct,
    recruiterRetentionPct: pkg.recruiterRetentionPct,
    matchuntPct: pkg.matchuntPct,
    researchBountyPct: pkg.researchBountyPct,
    matchuntOnClaimPct: pkg.matchuntOnClaimPct,
    researchMaxActiveDays: pkg.researchMaxActiveDays,
    claimNoticeDays: pkg.claimNoticeDays,
    eligibleClaimCategories: [...pkg.eligibleClaimCategories],
    excludedClaimCategories: [...pkg.excludedClaimCategories],
    capturedAt: at.toISOString(),
  };
}

/** Die Aufteilung ohne Continuity-Fall. */
export interface FeeBreakdown {
  /** Berechnungsgrundlage: Bruttojahreszielgehalt in Cent. */
  grossAnnualTargetCompensationCents: Cents;
  /** Was der Kunde netto zahlt. */
  clientFeeCents: Cents;
  /** Nach vollständigem Kundenzahlungseingang fällig. */
  recruiterInitialCents: Cents;
  /** Zurückgehalten bis zum Ablauf von Continuity- und Meldefrist. */
  recruiterRetentionCents: Cents;
  /** Was der Recruiter insgesamt bekommt, wenn kein Fall eintritt. */
  recruiterTotalCents: Cents;
  /** Was Matchunt verbleibt, wenn kein Fall eintritt. */
  matchuntCents: Cents;
}

export function computeFees(
  grossAnnualTargetCompensation: number,
  snapshot: PricingSnapshot,
): FeeBreakdown {
  const gross = eurosToCents(grossAnnualTargetCompensation);
  const recruiterInitial = applyPercent(gross, snapshot.recruiterInitialPct);
  const recruiterRetention = applyPercent(gross, snapshot.recruiterRetentionPct);

  // Der Matchunt-Anteil ist der Rest, nicht ein eigener Prozentsatz. Sonst
  // könnten drei einzeln gerundete Beträge in Summe neben dem Kundenhonorar
  // liegen — und genau dieser Cent wäre in der Abrechnung nirgends zu Hause.
  const clientFee = applyPercent(gross, snapshot.clientFeePct);
  const matchunt = clientFee - recruiterInitial - recruiterRetention;

  return {
    grossAnnualTargetCompensationCents: gross,
    clientFeeCents: clientFee,
    recruiterInitialCents: recruiterInitial,
    recruiterRetentionCents: recruiterRetention,
    recruiterTotalCents: recruiterInitial + recruiterRetention,
    matchuntCents: matchunt,
  };
}

/** Die Aufteilung bei gültigem Claim und erfolgreicher Ersatzvermittlung. */
export interface ClaimBreakdown {
  /** Bereits verdient, wird nicht zurückgefordert. */
  originalRecruiterKeepsCents: Cents;
  /** Verfällt für den ursprünglichen Recruiter und wird Teil der Bounty. */
  forfeitedRetentionCents: Cents;
  /** Auslobung für den erneuten Suchlauf. */
  researchBountyCents: Cents;
  /** Was Matchunt bei erfolgreicher Ersatzvermittlung verbleibt. */
  matchuntCents: Cents;
  /** Immer 0 — der Kunde zahlt kein zweites Honorar. */
  additionalClientInvoiceCents: Cents;
}

export function computeClaimOutcome(
  grossAnnualTargetCompensation: number,
  snapshot: PricingSnapshot,
): ClaimBreakdown {
  const gross = eurosToCents(grossAnnualTargetCompensation);
  const clientFee = applyPercent(gross, snapshot.clientFeePct);
  const kept = applyPercent(gross, snapshot.recruiterInitialPct);
  const forfeited = applyPercent(gross, snapshot.recruiterRetentionPct);
  const bounty = applyPercent(gross, snapshot.researchBountyPct);

  return {
    originalRecruiterKeepsCents: kept,
    forfeitedRetentionCents: forfeited,
    researchBountyCents: bounty,
    // Wieder als Rest, damit die Summe exakt aufgeht.
    matchuntCents: clientFee - kept - bounty,
    additionalClientInvoiceCents: 0,
  };
}

/**
 * Unverbindliche Schätzung für die Paketkarten.
 *
 * Beruht auf dem Zielgehalt aus der Aufnahme. Abgerechnet wird später anhand
 * des tatsächlichen Bruttojahreszielgehalts aus dem unterzeichneten
 * Arbeitsvertrag — das steht so auch auf der Karte.
 */
export function estimateForClient(
  grossAnnualTargetCompensation: number | null,
  pkg: PackageDefinition,
): { feeCents: Cents | null; isEstimate: true } {
  if (!grossAnnualTargetCompensation || grossAnnualTargetCompensation <= 0) {
    return { feeCents: null, isEstimate: true };
  }
  return {
    feeCents: applyPercent(eurosToCents(grossAnnualTargetCompensation), pkg.clientFeePct),
    isEstimate: true,
  };
}

/** Mitte eines Gehaltsbands — die Aufnahme erhebt min und max. */
export function midpointOfBand(min: number | null, max: number | null): number | null {
  if (min && max) return Math.round((min + max) / 2);
  return min || max || null;
}

/** Ob ein gemeldeter Grund einen Continuity-Fall auslösen kann. */
export function isEligibleClaim(category: string, snapshot: PricingSnapshot): boolean {
  if (snapshot.excludedClaimCategories.includes(category)) return false;
  return snapshot.eligibleClaimCategories.includes(category);
}

/**
 * Wann die einbehaltene Tranche frühestens ausgezahlt werden darf.
 *
 * Nicht am Ende des Continuity-Zeitraums: wer am letzten Tag ausscheidet, hat
 * danach noch die volle Meldefrist. Würde am Tag 90 ausgezahlt, stünde die
 * Tranche bei einem am Tag 97 gemeldeten Fall nicht mehr zur Verfügung.
 */
export function retentionReleaseDate(firstWorkingDay: Date, snapshot: PricingSnapshot): Date | null {
  if (snapshot.continuityDays == null) return null;
  const d = new Date(firstWorkingDay);
  d.setUTCDate(d.getUTCDate() + snapshot.continuityDays + snapshot.claimNoticeDays);
  return d;
}

/** Letzter Tag, an dem ein Ausscheiden noch in den Anspruchszeitraum fällt. */
export function continuityEndDate(firstWorkingDay: Date, snapshot: PricingSnapshot): Date | null {
  if (snapshot.continuityDays == null) return null;
  const d = new Date(firstWorkingDay);
  d.setUTCDate(d.getUTCDate() + snapshot.continuityDays);
  return d;
}

/** Fristende für die Meldung eines Falls. */
export function claimDeadline(knownAt: Date, snapshot: PricingSnapshot): Date {
  const d = new Date(knownAt);
  d.setUTCDate(d.getUTCDate() + snapshot.claimNoticeDays);
  return d;
}

export const snapshotForKey = (key: PackageKey): PricingSnapshot => snapshotOf(PACKAGES[key]);
