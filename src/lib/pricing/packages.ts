/**
 * Die drei Matchunt-Pakete — eine Quelle für Kunde, Recruiter, Admin und Abrechnung.
 *
 * Diese Datei ist die kanonische Definition. Die Migration
 * 20260902100000_commercial_packages.sql seedet exakt dieselben Werte in
 * public.commercial_packages; die Konstanten hier existieren, damit Rechnung
 * und Tests ohne Datenbank laufen. Weichen beide voneinander ab, schlägt
 * src/lib/pricing/packages.test.ts fehl.
 *
 * WICHTIG — alle Prozentangaben sind PROZENTPUNKTE DES BRUTTOJAHRESZIELGEHALTS,
 * nicht Anteile am Matchunt-Honorar. Bei 100.000 € und Core sind 15 %
 * Recruiter-Anteil also 15.000 €, nicht 15 % von 20.000 €. Genau dieser Fehler
 * steckt heute in src/pages/admin/AdminPlacements.tsx:136-139 und in
 * supabase/functions/process-offer-response/index.ts:126-128, wo der
 * Recruiter-Anteil als Quote des Gesamthonorars gerechnet wird.
 */

export type PackageKey = 'core' | 'continuity_90' | 'continuity_180';

/** Gründe, die einen Continuity-Fall auslösen können. */
export const CLAIM_CATEGORIES_ELIGIBLE = [
  'no_show',              // Kandidat tritt die Stelle nicht an
  'candidate_resigned',   // Kandidat kündigt selbst
  'employer_performance', // Kündigung wegen Leistung
  'employer_conduct',     // Kündigung wegen Verhalten
  'employer_aptitude',    // Kündigung wegen fachlicher Eignung
  'employer_fit',         // Kündigung wegen persönlicher Passung
  'mutual_candidate_reason', // einvernehmlich aus kandidatenbezogenem Grund
] as const;

/** Gründe, die ausdrücklich NICHT vom Continuity-Modell umfasst sind. */
export const CLAIM_CATEGORIES_EXCLUDED = [
  'redundancy',            // Stellenabbau
  'restructuring',         // Restrukturierung
  'position_eliminated',   // Position abgeschafft
  'economic_dismissal',    // wirtschaftlich/organisatorisch bedingt
  'role_materially_changed', // Aufgaben, Gehalt, Ort oder Bedingungen nachträglich verändert
  'client_breach',         // Vertragsverletzung des Kunden
  'client_unlawful',       // rechtswidriges Verhalten des Kunden
  'payment_default',       // Zahlung nicht vollständig oder nicht fristgerecht
  'client_non_cooperation', // fehlende Mitwirkung am erneuten Suchlauf
] as const;

export type ClaimCategory =
  | (typeof CLAIM_CATEGORIES_ELIGIBLE)[number]
  | (typeof CLAIM_CATEGORIES_EXCLUDED)[number];

export interface PackageDefinition {
  key: PackageKey;
  version: number;
  /** Was der Kunde sieht. */
  publicName: string;
  publicSummary: string;
  publicBullets: string[];

  // ---- Kundenseite -------------------------------------------------------
  /** Erfolgshonorar in Prozentpunkten des Bruttojahreszielgehalts. */
  clientFeePct: number;
  /** Anspruchszeitraum in Kalendertagen ab erstem Arbeitstag. null = keine Continuity. */
  continuityDays: number | null;

  // ---- Interne Verteilung — NIE dem Kunden zeigen ------------------------
  /** Nach vollständigem Kundenzahlungseingang fällig. */
  recruiterInitialPct: number;
  /** Zurückgehalten bis zum Ablauf der Continuity- und Meldefrist. */
  recruiterRetentionPct: number;
  /** Was Matchunt ohne Continuity-Fall verbleibt. */
  matchuntPct: number;
  /** Bounty für den erneuten Suchlauf bei gültigem Claim. */
  researchBountyPct: number;
  /** Was Matchunt bei erfolgreicher Ersatzvermittlung verbleibt. */
  matchuntOnClaimPct: number;

  // ---- Fristen -----------------------------------------------------------
  /** Höchstdauer des erneuten Suchlaufs in aktiven Suchtagen. */
  researchMaxActiveDays: number | null;
  /** Frist zur Meldung eines Falls ab Kenntnis des Ausscheidens. */
  claimNoticeDays: number;

  eligibleClaimCategories: readonly string[];
  excludedClaimCategories: readonly string[];
}

/**
 * Kein Feilschen, keine Zwischenstufen, kein vierter Tarif.
 *
 * Zwei Invarianten müssen für jedes Paket gelten — sie sind unten getestet und
 * zusätzlich als CHECK-Constraint in der Migration hinterlegt:
 *
 *   (1) ohne Claim:  clientFee = recruiterInitial + recruiterRetention + matchunt
 *   (2) mit Claim:   clientFee = recruiterInitial + researchBounty + matchuntOnClaim
 *
 * Aus (1) und (2) folgt, dass die einbehaltene Tranche nicht verschwindet: sie
 * wird Bestandteil der Bounty. Bei Continuity 90 sind das 5 Punkte aus der
 * Retention plus 3 Punkte Continuity-Aufpreis, macht 8.
 */
export const PACKAGES: Record<PackageKey, PackageDefinition> = {
  core: {
    key: 'core',
    version: 1,
    publicName: 'Matchunt Core',
    publicSummary: 'Erfolgshonorar ohne Continuity-Leistung.',
    publicBullets: [
      '20 % des Bruttojahreszielgehalts, fällig erst bei erfolgreicher Vermittlung',
      'Keine Fixkosten, kein Retainer',
      'Kein erneuter Suchlauf bei späterem Ausscheiden',
    ],
    clientFeePct: 20,
    continuityDays: null,
    recruiterInitialPct: 15,
    recruiterRetentionPct: 0,
    matchuntPct: 5,
    researchBountyPct: 0,
    matchuntOnClaimPct: 5,
    researchMaxActiveDays: null,
    claimNoticeDays: 14,
    eligibleClaimCategories: [],
    excludedClaimCategories: CLAIM_CATEGORIES_EXCLUDED,
  },

  continuity_90: {
    key: 'continuity_90',
    version: 1,
    publicName: 'Matchunt Continuity 90',
    publicSummary: 'Erfolgshonorar mit einmaligem erneutem Suchlauf in den ersten 90 Tagen.',
    publicBullets: [
      '23 % des Bruttojahreszielgehalts, fällig erst bei erfolgreicher Vermittlung',
      'Einmaliger erneuter Suchlauf, wenn die Person in den ersten 90 Tagen ausscheidet',
      'Kein zweites Vermittlungshonorar für den erneuten Suchlauf',
      'Keine Garantie, dass eine Ersatzbesetzung zustande kommt',
    ],
    clientFeePct: 23,
    continuityDays: 90,
    recruiterInitialPct: 10,
    recruiterRetentionPct: 5,
    matchuntPct: 8,
    researchBountyPct: 8,
    matchuntOnClaimPct: 5,
    researchMaxActiveDays: 60,
    claimNoticeDays: 14,
    eligibleClaimCategories: CLAIM_CATEGORIES_ELIGIBLE,
    excludedClaimCategories: CLAIM_CATEGORIES_EXCLUDED,
  },

  continuity_180: {
    key: 'continuity_180',
    version: 1,
    publicName: 'Matchunt Continuity 180',
    publicSummary: 'Erfolgshonorar mit einmaligem erneutem Suchlauf in den ersten 180 Tagen.',
    publicBullets: [
      '26 % des Bruttojahreszielgehalts, fällig erst bei erfolgreicher Vermittlung',
      'Einmaliger erneuter Suchlauf, wenn die Person in den ersten 180 Tagen ausscheidet',
      'Kein zweites Vermittlungshonorar für den erneuten Suchlauf',
      'Keine Garantie, dass eine Ersatzbesetzung zustande kommt',
    ],
    clientFeePct: 26,
    continuityDays: 180,
    recruiterInitialPct: 10,
    recruiterRetentionPct: 5,
    matchuntPct: 11,
    researchBountyPct: 11,
    matchuntOnClaimPct: 5,
    researchMaxActiveDays: 90,
    claimNoticeDays: 14,
    eligibleClaimCategories: CLAIM_CATEGORIES_ELIGIBLE,
    excludedClaimCategories: CLAIM_CATEGORIES_EXCLUDED,
  },
};

/** Reihenfolge in der Kundenansicht. */
export const PACKAGE_ORDER: PackageKey[] = ['core', 'continuity_90', 'continuity_180'];

export const isPackageKey = (value: unknown): value is PackageKey =>
  typeof value === 'string' && value in PACKAGES;

/**
 * Was der Kunde sehen darf — und nur das.
 *
 * Recruiter-Anteil, Matchunt-Marge, einbehaltene Tranche und Re-Search-Bounty
 * sind ausdrücklich nicht enthalten. Wer diese Funktion benutzt, kann sie
 * nicht versehentlich durchreichen.
 */
export function clientFacingPackage(pkg: PackageDefinition) {
  return {
    key: pkg.key,
    version: pkg.version,
    name: pkg.publicName,
    summary: pkg.publicSummary,
    bullets: pkg.publicBullets,
    feePercent: pkg.clientFeePct,
    continuityDays: pkg.continuityDays,
    claimNoticeDays: pkg.claimNoticeDays,
  };
}
export type ClientFacingPackage = ReturnType<typeof clientFacingPackage>;
