/**
 * Match V4.1 – Engine, Stufe 1 (Vorfilter und strukturierter Fit). Geteilt von
 * Edge Functions und Eval-Harness. Entstanden als V3.2-Prototyp:
 *
 * Kopie der Scoring-Pipeline aus der eingefrorenen V3.1-Replika
 * (evals/adapters/v31-baseline/matcher.ts, verbatim aus
 * supabase/functions/calculate-match-v3-1/index.ts). Jede Abweichung ist
 * hinter einem Flag (F1–F8, siehe fixes.ts) versteckt und mit „// F<n>:"
 * kommentiert. Mit NO_FIXES ist das Ergebnis identisch zur Replika — das
 * beweist evals/adapters/v32/equivalence.test.ts für alle Paare beider
 * Golden-Datasets.
 *
 * Unverändert aus der Replika importiert (nicht kopiert): TECH_DOMAINS,
 * buildConfig, isProfileMinimallyComplete, extractSkillKeywords,
 * detectCandidateDomain/detectJobDomain (Legacy-Pfad). Unterschiede zur
 * Replika außerhalb der Flags: kein globaler Zustand (Synonym-Map und „jetzt"
 * kommen als Optionen rein), keine console.log-Aufrufe.
 */

import {
  TECH_DOMAINS,
  buildConfig,
  detectCandidateDomain as legacyDetectCandidateDomain,
  detectJobDomain as legacyDetectJobDomain,
  extractSkillKeywords as legacyExtractSkillKeywords,
  isProfileMinimallyComplete,
} from './legacy.ts';
import {
  type CandidateLanguage,
  type FamilyResult,
  type LanguageCheck,
  type LanguageRequirement,
  type V32Flags,
  NEUTRAL_SCORE,
  classifyJobFamilies,
  collectCandidateCertifications,
  collectCandidateLanguages,
  computeConfidence,
  deriveTitleEvidence,
  evaluateCertRequirement,
  evaluateLanguageRequirement,
  evaluateVisa,
  extractLanguageRequirementsFromText,
  familiesCoherent,
  hasSubstantiveOverlap,
  isLanguageContinuationFragment,
  legacySubstringMatch,
  levelFromText,
  resolveJobTargetDays,
  resolveStartDays,
  salarySignal,
  softStartDate,
  termContainedIn,
  termMatches,
  toLanguageRequirement,
} from '../match-v41/rules.ts';

export { buildConfig };

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;
type PolicyTier = 'hot' | 'standard' | 'maybe' | 'hidden';
type MatchFn = (a: string, b: string) => boolean;

export interface V32Options {
  flags: V32Flags;
  /** Fester Zeitpunkt (ms) statt Date.now() — Determinismus. */
  nowMs: number;
  synonymMap: Map<string, Set<string>>;
}

/** Zusatz-Diagnose von v3.2 (Teil des Ergebnisses unter `v32`). */
export interface V32Diagnostics {
  /** F5: Datenvollständigkeit 0–1; null, wenn F5 aus. */
  confidence: number | null;
  coverageKnown: boolean;
  risks: string[];
  languageChecks: { code: string; status: string; multiplier: number }[];
  certChecks: { cert: string; status: string }[];
  visa: string;
  family?: { candidate: FamilyResult; job: FamilyResult; coherent: boolean; substantiveOverlap: boolean };
  startDays: number | null;
  startSource: string;
  softMultiplier: number;
  familyMultiplier: number;
  tierCap?: PolicyTier;
  excludedBy?: string;
}

// Kopie aus der Replika (dort nicht exportiert): Keyword-Listen für lange Anforderungen.
const FINANCE_KEYWORDS = [
  'buchhaltung', 'finanzbuchhaltung', 'lohnbuchhaltung', 'bilanzbuchhaltung',
  'debitorenbuchhaltung', 'kreditorenbuchhaltung', 'anlagenbuchhaltung',
  'rechnungswesen', 'rechnungslegung', 'bilanzierung', 'jahresabschluss',
  'monatsabschluss', 'quartalsabschluss', 'controlling', 'finanzcontrolling',
  'kostenrechnung', 'budgetierung', 'kalkulation', 'hgb', 'ifrs', 'gaap',
  'datev', 'lexware', 'sage', 'addison', 'navision', 'sap fi', 'sap co',
  'steuerrecht', 'steuererklärung', 'umsatzsteuer', 'einkommensteuer',
  'lohnabrechnung', 'payroll', 'gehaltsabrechnung', 'entgeltabrechnung',
  'mahnwesen', 'forderungsmanagement', 'zahlungsverkehr', 'treasury',
  'accounts payable', 'accounts receivable', 'fibu', 'buchführung',
];
const IT_KEYWORDS = [
  'java', 'python', 'react', 'javascript', 'typescript', 'aws', 'docker',
  'kubernetes', 'postgresql', 'node.js', 'angular', 'vue', 'spring',
  'c#', 'c++', 'go', 'rust', 'terraform', 'jenkins', 'gitlab', 'azure',
];
const ALL_SKILL_KEYWORDS = [...FINANCE_KEYWORDS, ...IT_KEYWORDS];

function extractSkillKeywords(requirement: string, flags: V32Flags): string[] {
  if (!flags.F4) return legacyExtractSkillKeywords(requirement);
  // F4: Keyword muss als Token/Phrase (bzw. als Kompositum-Grundwort ≥ 6 Zeichen) vorkommen —
  // „go" steckt nicht mehr in „Google", „kategorie" oder „Algorithmen".
  return ALL_SKILL_KEYWORDS.filter((k) => termContainedIn(k, requirement));
}

function formatDomainName(domain: string): string {
  const names: Record<string, string> = {
    embedded_hardware: 'Embedded/Hardware', backend_cloud: 'Backend/Cloud', frontend_web: 'Frontend/Web',
    data_ml: 'Data/ML', devops: 'DevOps', mobile: 'Mobile', design: 'Design/UX',
    product_management: 'Product Management', security: 'Security', sap_erp: 'SAP/ERP',
    finance_accounting: 'Finance/Accounting', hr_recruiting: 'HR/Recruiting', marketing_sales: 'Marketing/Sales',
    other: 'Allgemein',
  };
  return names[domain] || domain;
}

// ============================================
// MAIN MATCH CALCULATION
// ============================================

export function calculateMatchV32(
  candidate: Any,
  job: Any,
  skillReqs: Any[],
  taxonomy: Any[],
  config: Any,
  mode: string,
  opts: V32Options,
): Any {
  const { flags } = opts;
  const jobId = job.id;
  const match: MatchFn = flags.F4 ? termMatches : legacySubstringMatch;

  const profileCheck = isProfileMinimallyComplete(candidate);
  if (!profileCheck.complete) {
    return {
      ...createExcludedResult(jobId, 0, `Profil unvollständig: ${profileCheck.missingFields.join(', ')} fehlen`),
      gateMultiplier: 0,
      gates: {
        hardKills: { visa: false, language: false, onsite: false, license: false, techDomain: false },
        dealbreakers: { salary: 1, startDate: 1, seniority: 1, workModel: 1, techDomain: 1 },
        multiplier: 0,
      },
      explainability: {
        topReasons: [],
        topRisks: ['Profil nicht auswertbar'],
        whyNot: `Profil unvollständig: ${profileCheck.missingFields.join(', ')} fehlen`,
        nextAction: 'Profil vervollständigen',
      },
      v32: baseDiagnostics({ confidence: 0, excludedBy: 'profile' }),
    };
  }

  // F1b: Sprach-Must-haves aus dem Freitext herauslösen (vor Hard-Kills und Skill-Scoring).
  const { skillMustHaves, textLanguageReqs } = splitLanguageMustHaves(job, flags);

  // Stage A: Hard Kills (+ weiche Befunde für Unbekanntes)
  const hardKill = evaluateHardKills(candidate, job, config.hard_kill_defaults, flags, match, textLanguageReqs);
  if (hardKill.killed) {
    return {
      ...createKilledResult(jobId, hardKill.reason || 'Hard Kill', hardKill.category),
      v32: baseDiagnostics({ ...hardKill.diag, confidence: 0, excludedBy: `kill:${hardKill.category}` }),
    };
  }

  // Stage A.2: Dealbreaker Multipliers
  const dealbreakers = calculateDealbreakers(candidate, job, config, opts);

  // Stage B: Fit Score
  const fitResult = calculateFitScore(candidate, { ...job, must_haves: skillMustHaves }, skillReqs, taxonomy, config, opts, match);

  // F5: unbekannte Coverage (keine Must-haves) ist kein Exclusion-Grund.
  const coverageExcluded = fitResult.coverageKnown && fitResult.mustHaveCoverage < 0.40;
  if (coverageExcluded && mode === 'strict') {
    return createExcludedResult(jobId, fitResult.mustHaveCoverage, `Must-have Coverage nur ${Math.round(fitResult.mustHaveCoverage * 100)}%`);
  }

  // Stage C: Constraints Score
  const constraintsResult = calculateConstraintsScore(candidate, job, config, opts);

  // F8: Berufsfeld-Kohärenz — fachfremd UND keine fachliche Skill-Überschneidung → hidden + starke Abwertung.
  let familyMultiplier = 1;
  let family: V32Diagnostics['family'];
  if (flags.F8) {
    const cf = classifyJobFamilies(candidate.job_title);
    const jf = classifyJobFamilies(job.title);
    const coherent = familiesCoherent(cf, jf);
    const substantiveOverlap = hasSubstantiveOverlap([
      ...(fitResult.details?.skills?.matched || []),
      ...(fitResult.details?.skills?.transferable || []),
    ]);
    family = { candidate: cf, job: jf, coherent, substantiveOverlap };
    if (!coherent && !substantiveOverlap) familyMultiplier = 0.15;
  }

  // Soft-Multiplikatoren aus F1/F1b (belegte Sprachlücken) wirken wie Dealbreaker.
  const softMultiplier = hardKill.softMultiplier;
  const gateMultiplier =
    softMultiplier === 1 && familyMultiplier === 1
      ? dealbreakers.multiplier // Legacy-Pfad exakt erhalten
      : Math.max(0.05, dealbreakers.multiplier * softMultiplier * familyMultiplier);

  const overallScore = Math.round(fitResult.score * config.weights.fit + constraintsResult.score * config.weights.constraints);
  const finalScore = Math.round(overallScore * gateMultiplier);

  // Stage D: Policy + v3.2-Obergrenzen
  let policy: PolicyTier = fitResult.coverageKnown
    ? determinePolicy(finalScore, fitResult.mustHaveCoverage, gateMultiplier, config)
    : determinePolicyUnknownCoverage(finalScore, config);
  let tierCap: PolicyTier | undefined;
  if (!fitResult.coverageKnown || hardKill.capMaybe) tierCap = 'maybe'; // F5 / F1 / F2
  if (familyMultiplier < 1) tierCap = 'hidden'; // F8
  if (tierCap) policy = capPolicy(policy, tierCap);

  const salary = salarySignal(candidate, job);
  const risks = [...hardKill.diag.risks];
  if (flags.F6 && salary.underBudgetRisk) risks.push('Gehaltsvorstellung deutlich unter Budget – Seniorität prüfen');
  if (family && familyMultiplier < 1) {
    risks.unshift(`Berufsfeld passt nicht: ${family.candidate.families.join('/')} → ${family.job.families.join('/')}, keine fachliche Skill-Überschneidung`);
  }

  const explainability = generateExplainability(candidate, fitResult, constraintsResult, dealbreakers, policy, flags, risks, {
    salaryKnown: salary.known,
    startKnown: constraintsResult.startKnown,
    coverageKnown: fitResult.coverageKnown,
    familyExcluded: familyMultiplier < 1,
  });

  const confidence = computeConfidence({
    hasSkills: Array.isArray(candidate.skills) && candidate.skills.length > 0,
    hasTitle: !!candidate.job_title?.trim(),
    hasExperience: typeof candidate.experience_years === 'number' && candidate.experience_years > 0,
    hasSeniority: !!candidate.seniority,
    salaryKnown: salary.known,
    startKnown: constraintsResult.startKnown,
    jobHasMustHaves: fitResult.coverageKnown,
    unknownChecks: hardKill.unknownChecks,
  });

  return {
    version: 'v3.2-proto',
    jobId,
    overall: finalScore,
    killed: false,
    excluded: policy === 'hidden',
    mustHaveCoverage: fitResult.mustHaveCoverage,
    gateMultiplier,
    policy,
    gates: {
      hardKills: {
        visa: false, language: false, onsite: false, license: false,
        techDomain: dealbreakers.domainMismatch?.isIncompatible || false,
      },
      dealbreakers: dealbreakers.factors,
      multiplier: gateMultiplier,
      domainMismatch: dealbreakers.domainMismatch,
    },
    fit: { score: fitResult.score, breakdown: fitResult.breakdown, details: fitResult.details },
    constraints: { score: constraintsResult.score, breakdown: constraintsResult.breakdown },
    explainability,
    v32: {
      ...baseDiagnostics(hardKill.diag),
      // F5: confidence nur mit Flag; sonst null (v3.1 kennt das Konzept nicht).
      confidence: flags.F5 ? confidence : null,
      coverageKnown: fitResult.coverageKnown,
      risks,
      family,
      startDays: constraintsResult.startDays,
      startSource: constraintsResult.startSource,
      softMultiplier,
      familyMultiplier,
      tierCap,
      excludedBy: familyMultiplier < 1 ? 'family' : policy === 'hidden' ? 'policy' : undefined,
    } satisfies V32Diagnostics as Any,
  };
}

function baseDiagnostics(partial: Partial<V32Diagnostics>): V32Diagnostics {
  return {
    confidence: 0, coverageKnown: true, risks: [], languageChecks: [], certChecks: [], visa: 'ok',
    startDays: null, startSource: 'unknown', softMultiplier: 1, familyMultiplier: 1, ...partial,
  };
}

const TIER_ORDER: PolicyTier[] = ['hidden', 'maybe', 'standard', 'hot'];
function capPolicy(policy: PolicyTier, cap: PolicyTier): PolicyTier {
  return TIER_ORDER.indexOf(policy) > TIER_ORDER.indexOf(cap) ? cap : policy;
}

// ============================================
// F1b: SPRACH-MUST-HAVES AUS FREITEXT
// ============================================

function splitLanguageMustHaves(job: Any, flags: V32Flags): { skillMustHaves: string[]; textLanguageReqs: LanguageRequirement[] } {
  const raw: string[] = job.must_haves || job.must_have_skills || [];
  if (!flags.F1b) return { skillMustHaves: job.must_haves, textLanguageReqs: [] };
  const skillMustHaves: string[] = [];
  const reqs: LanguageRequirement[] = [];
  let lastWasLanguage = false;
  for (const m of raw) {
    const found = extractLanguageRequirementsFromText(m);
    if (found.length > 0) {
      reqs.push(...found);
      lastWasLanguage = true;
      continue;
    }
    // „Gute Deutschkenntnisse", „C2-Level und besser", „in Wort und Schrift" — Komma-Split-Reste.
    if (lastWasLanguage && isLanguageContinuationFragment(m)) {
      const rank = levelFromText(m);
      const prev = reqs[reqs.length - 1];
      if (prev && rank > (prev.minRank ?? 0) && /\b[abc][12]\b/i.test(m)) prev.minRank = rank;
      continue;
    }
    lastWasLanguage = false;
    skillMustHaves.push(m);
  }
  // Strukturierte required_languages haben Vorrang: dort schon vorhandene Sprachen nicht doppelt prüfen.
  const structured = new Set((job.required_languages || []).map((r: Any) => toLanguageRequirement(r)?.code).filter(Boolean));
  const dedup = new Map<string, LanguageRequirement>();
  for (const r of reqs) {
    if (structured.has(r.code)) continue;
    const prev = dedup.get(r.code);
    if (!prev || (r.minRank ?? 0) > (prev.minRank ?? 0)) dedup.set(r.code, r);
  }
  return { skillMustHaves, textLanguageReqs: [...dedup.values()] };
}

// ============================================
// STAGE A: HARD KILLS
// ============================================

interface HardKillV32 {
  killed: boolean;
  reason?: string;
  category?: string;
  softMultiplier: number;
  capMaybe: boolean;
  unknownChecks: number;
  diag: Pick<V32Diagnostics, 'risks' | 'languageChecks' | 'certChecks' | 'visa'>;
}

function evaluateHardKills(
  candidate: Any,
  job: Any,
  defaults: Any,
  flags: V32Flags,
  match: MatchFn,
  textLanguageReqs: LanguageRequirement[],
): HardKillV32 {
  const res: HardKillV32 = {
    killed: false, softMultiplier: 1, capMaybe: false, unknownChecks: 0,
    diag: { risks: [], languageChecks: [], certChecks: [], visa: 'ok' },
  };
  const kill = (reason: string, category: string): HardKillV32 => ({ ...res, killed: true, reason, category });

  // Visa / Work Authorization
  if (flags.F3) {
    // F3: Kill NUR bei ausdrücklichem visa_sponsorship === false; fehlende Spalte/NULL = unbekannt.
    const visa = defaults.visa_required ? evaluateVisa(candidate, job) : 'ok';
    res.diag.visa = visa;
    if (visa === 'kill') return kill('Visum erforderlich, nicht angeboten', 'visa');
    if (visa === 'unknown') {
      res.unknownChecks++;
      res.diag.risks.push('Visum/Arbeitserlaubnis nötig – Sponsoring der Stelle unbekannt, klären');
    }
  } else if (defaults.visa_required && candidate.visa_required && !job.visa_sponsorship) {
    return kill('Visum erforderlich, nicht angeboten', 'visa');
  }

  // Required Languages
  if (flags.F1) {
    // F1: candidate_languages ∪ language_skills, ISO-/CEFR-normalisiert; unbekannt ≠ fehlend.
    const langs: CandidateLanguage[] | null = collectCandidateLanguages(candidate);
    const reqs: LanguageRequirement[] = [];
    if (defaults.language_required && Array.isArray(job.required_languages)) {
      for (const r of job.required_languages) {
        const req = toLanguageRequirement(r);
        if (req) reqs.push(req);
      }
    }
    if (defaults.language_required) reqs.push(...textLanguageReqs); // F1b: weich, nie Kill
    let anyUnknown = false;
    for (const req of reqs) {
      const check: LanguageCheck = evaluateLanguageRequirement(req, langs);
      res.diag.languageChecks.push({ code: req.code, status: check.status, multiplier: check.multiplier });
      if (check.kill) return kill(check.risk || `Sprache ${req.code} fehlt`, 'language');
      if (check.risk) res.diag.risks.push(check.risk);
      if (check.status === 'unknown_no_data' || check.status === 'unknown_level') anyUnknown = true;
      res.softMultiplier *= check.multiplier;
      if (check.capMaybe) res.capMaybe = true;
    }
    if (anyUnknown) res.unknownChecks++;
    res.softMultiplier = Math.max(0.3, res.softMultiplier);
  } else if (defaults.language_required && job.required_languages && Array.isArray(job.required_languages)) {
    // Legacy v3.1 (Replika Zeilen 808-828)
    const candidateLanguages = candidate.language_skills || [];
    for (const reqLang of job.required_languages) {
      const candidateLang = candidateLanguages.find((l: Any) =>
        l.language?.toLowerCase() === reqLang.code?.toLowerCase() ||
        l.code?.toLowerCase() === reqLang.code?.toLowerCase());
      if (!candidateLang) return kill(`Sprache ${reqLang.code} fehlt`, 'language');
      const levelOrder = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'native'];
      if (reqLang.minLevel) {
        const reqIdx = levelOrder.indexOf(reqLang.minLevel.toLowerCase());
        const candIdx = levelOrder.indexOf((candidateLang.level || 'a1').toLowerCase());
        if (candIdx < reqIdx) return kill(`${reqLang.code} mindestens ${reqLang.minLevel} erforderlich`, 'language');
      }
    }
  }

  // Onsite Required vs Remote-Only Candidate (unverändert)
  if (defaults.onsite_required && job.onsite_required) {
    const candidateRemoteOnly = candidate.remote_preference === 'remote_only' || candidate.work_model === 'remote_only';
    if (candidateRemoteOnly) return kill('Präsenzpflicht, Kandidat nur Remote', 'onsite');
  }

  // Required Certifications
  if (defaults.license_required && job.required_certifications && Array.isArray(job.required_certifications)) {
    if (flags.F2) {
      // F2: certifications ∪ certificates; ohne jegliche Zertifikatsdaten = unbekannt (kein Kill).
      const certs = collectCandidateCertifications(candidate);
      let anyUnknown = false;
      for (const reqCert of job.required_certifications) {
        const status = evaluateCertRequirement(reqCert, certs, match);
        res.diag.certChecks.push({ cert: reqCert, status });
        if (status === 'missing_listed') return kill(`Zertifikat ${reqCert} fehlt`, 'license');
        if (status === 'unknown_no_data') {
          anyUnknown = true;
          res.capMaybe = true;
          res.diag.risks.push(`Zertifikat ${reqCert} nicht belegt – prüfen`);
        }
      }
      if (anyUnknown) res.unknownChecks++;
    } else {
      const candidateCerts = candidate.certifications || [];
      for (const reqCert of job.required_certifications) {
        const hasCert = candidateCerts.some((c: string) =>
          c.toLowerCase().includes(reqCert.toLowerCase()) || reqCert.toLowerCase().includes(c.toLowerCase()));
        if (!hasCert) return kill(`Zertifikat ${reqCert} fehlt`, 'license');
      }
    }
  }

  return res;
}

// ============================================
// STAGE A.2: DEALBREAKER MULTIPLIERS
// ============================================

function calculateDealbreakers(candidate: Any, job: Any, config: Any, opts: V32Options): Any {
  const { flags, nowMs } = opts;
  let salaryMult = 1.0;
  let startDateMult = 1.0;
  let seniorityMult = 1.0;
  let workModelMult = 1.0;

  // Salary gap multiplier (unverändert)
  const candidateSalary = candidate.expected_salary || candidate.salary_expectation_min || 0;
  const jobSalaryMax = job.salary_max || 0;
  if (candidateSalary > 0 && jobSalaryMax > 0 && candidateSalary > jobSalaryMax) {
    const gapPercent = ((candidateSalary - jobSalaryMax) / jobSalaryMax) * 100;
    for (const range of config.dealbreaker_multipliers.salary) {
      if (gapPercent >= range.min && gapPercent < range.max) {
        salaryMult = range.multiplier;
        break;
      }
    }
  }

  // Start date multiplier
  if (flags.F7) {
    // F7: notice_period als Fallback, Ziel-Datum der Stelle, weiche Kurve (kein ×0.4 bei 3 Monaten).
    const start = resolveStartDays(candidate, nowMs, true);
    if (start.days !== null) startDateMult = softStartDate(start.days, resolveJobTargetDays(job, nowMs)).multiplier;
  } else if (candidate.availability_date) {
    const availDate = new Date(candidate.availability_date);
    const daysUntil = Math.ceil((availDate.getTime() - nowMs) / (1000 * 60 * 60 * 24));
    if (daysUntil > 14) {
      for (const range of config.dealbreaker_multipliers.start_date) {
        if (daysUntil >= range.min && daysUntil < range.max) {
          startDateMult = range.multiplier;
          break;
        }
      }
    }
  }

  // Seniority mismatch multiplier (unverändert)
  const seniorityLevels = ['junior', 'mid', 'senior', 'lead', 'head', 'director', 'vp', 'c-level'];
  const candIdx = seniorityLevels.indexOf((candidate.seniority || 'mid').toLowerCase());
  const jobIdx = seniorityLevels.indexOf((job.experience_level || 'mid').toLowerCase());
  if (candIdx >= 0 && jobIdx >= 0) {
    const gap = Math.abs(candIdx - jobIdx);
    if (gap > 0) {
      const mult = config.dealbreaker_multipliers.seniority.find((s: Any) => s.gap === gap);
      if (mult) seniorityMult = mult.multiplier;
      else if (gap >= 3) seniorityMult = 0.1;
    }
  }

  // Work model mismatch (unverändert)
  const jobRemote = job.remote_type === 'remote' || job.work_model === 'remote';
  const jobHybrid = job.remote_type === 'hybrid' || job.work_model === 'hybrid';
  const candidateRemote = candidate.remote_preference === 'remote' || candidate.work_model === 'remote';
  if (candidateRemote && !jobRemote && !jobHybrid) workModelMult = 0.25;
  else if (candidateRemote && jobHybrid) workModelMult = 0.7;

  // TECH DOMAIN MISMATCH
  let techDomainMult = 1.0;
  let domainMismatch: Any;
  // F4domain: Domain-Erkennung tokenbasiert (kein „pm" in „Development", kein „ai" in „Maintenance").
  const candidateDomain = flags.F4domain
    ? detectCandidateDomainV32(candidate.skills || [], candidate.job_title)
    : legacyDetectCandidateDomain(candidate.skills || [], candidate.job_title);
  const jobDomain = flags.F4domain ? detectJobDomainV32(job) : legacyDetectJobDomain(job);

  if (candidateDomain.confidence >= 0.15 && jobDomain.confidence >= 0.15) {
    const candidateDomainConfig = TECH_DOMAINS[candidateDomain.primary];
    if (candidateDomainConfig?.incompatible_with?.includes(jobDomain.primary)) {
      techDomainMult = 0.1;
      domainMismatch = {
        candidateDomain: formatDomainName(candidateDomain.primary),
        jobDomain: formatDomainName(jobDomain.primary),
        isIncompatible: true,
      };
    } else if (
      !candidateDomainConfig?.transferable_to?.includes(jobDomain.primary) &&
      candidateDomain.primary !== jobDomain.primary &&
      candidateDomain.primary !== 'other' &&
      jobDomain.primary !== 'other'
    ) {
      techDomainMult = 0.6;
      domainMismatch = {
        candidateDomain: formatDomainName(candidateDomain.primary),
        jobDomain: formatDomainName(jobDomain.primary),
        isIncompatible: false,
      };
    }
  }

  const finalMultiplier = salaryMult * startDateMult * seniorityMult * workModelMult * techDomainMult;
  return {
    multiplier: Math.max(0.05, finalMultiplier),
    factors: { salary: salaryMult, startDate: startDateMult, seniority: seniorityMult, workModel: workModelMult, techDomain: techDomainMult },
    domainMismatch,
  };
}

// F4domain: tokenbasierte Kopien von detectCandidateDomain/detectJobDomain (Logik sonst identisch).
function domainScoresFor(skills: string[]): Record<string, number> {
  const normalized = skills.map((s) => s.toLowerCase().trim());
  const scores: Record<string, number> = {};
  for (const [domain, cfg] of Object.entries(TECH_DOMAINS) as [string, Any][]) {
    let matchCount = 0;
    for (const skill of normalized) if (cfg.skills.some((ds: string) => termMatches(skill, ds))) matchCount++;
    scores[domain] = normalized.length > 0 ? matchCount / Math.max(normalized.length, 1) : 0;
  }
  return scores;
}

function titleHas(title: string, ...kws: string[]): boolean {
  return kws.some((k) => termContainedIn(k, title));
}

function finishDomain(scores: Record<string, number>) {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return {
    primary: sorted[0]?.[0] || 'other',
    secondary: sorted[1]?.[1] > 0.1 ? sorted[1][0] : null,
    confidence: sorted[0]?.[1] || 0,
    scores,
  };
}

function detectCandidateDomainV32(candidateSkills: string[], jobTitle?: string) {
  const s = domainScoresFor(candidateSkills || []);
  const bump = (d: string, v: number) => { s[d] = Math.max(s[d] || 0, v); };
  if (jobTitle) {
    const t = jobTitle;
    if (titleHas(t, 'hardware', 'embedded', 'fpga')) bump('embedded_hardware', 0.5);
    if (titleHas(t, 'backend', 'java', 'cloud')) bump('backend_cloud', 0.5);
    if (titleHas(t, 'frontend', 'react', 'web')) bump('frontend_web', 0.5);
    if (titleHas(t, 'data', 'ml', 'machine learning')) bump('data_ml', 0.5);
    if (titleHas(t, 'product', 'pm')) bump('product_management', 0.5);
    if (titleHas(t, 'design', 'designer', 'ux', 'ui')) bump('design', 0.5);
    if (titleHas(t, 'buchhalter', 'accountant', 'finanzbuchhalter', 'bilanzbuchhalter', 'controlling', 'controller',
      'steuerfachangestellte', 'tax', 'finance manager', 'accounting')) bump('finance_accounting', 0.7);
    if (titleHas(t, 'recruiter', 'hr', 'human resources', 'talent', 'personalreferent', 'people')) bump('hr_recruiting', 0.7);
    if (titleHas(t, 'sales', 'vertrieb', 'account manager', 'business development', 'marketing manager', 'key account')) bump('marketing_sales', 0.7);
  }
  return finishDomain(s);
}

function detectJobDomainV32(job: Any) {
  const s = domainScoresFor([...(job.skills || []), ...(job.must_haves || []), ...(job.nice_to_haves || [])]);
  const bump = (d: string, v: number) => { s[d] = Math.max(s[d] || 0, v); };
  const t = job.title || '';
  if (titleHas(t, 'hardware', 'embedded', 'fpga', 'firmware')) bump('embedded_hardware', 0.6);
  if (titleHas(t, 'backend', 'java', 'cloud', 'api')) bump('backend_cloud', 0.6);
  if (titleHas(t, 'frontend', 'react', 'web', 'vue')) bump('frontend_web', 0.6);
  if (titleHas(t, 'data', 'ml', 'machine learning', 'ai')) bump('data_ml', 0.6);
  if (titleHas(t, 'product manager', 'product owner')) bump('product_management', 0.7);
  if (titleHas(t, 'designer', 'ux', 'ui')) bump('design', 0.6);
  if (titleHas(t, 'devops', 'sre', 'platform')) bump('devops', 0.6);
  if (titleHas(t, 'mobile', 'ios', 'android')) bump('mobile', 0.6);
  if (titleHas(t, 'sap', 'erp', 'abap')) bump('sap_erp', 0.6);
  if (titleHas(t, 'security', 'cyber')) bump('security', 0.6);
  if (titleHas(t, 'buchhalter', 'accountant', 'finance', 'controlling', 'controller', 'accounting', 'treasury', 'audit')) bump('finance_accounting', 0.7);
  if (titleHas(t, 'recruiter', 'hr', 'human resources', 'talent', 'people', 'personalreferent')) bump('hr_recruiting', 0.7);
  if (titleHas(t, 'sales', 'vertrieb', 'account manager', 'business development', 'marketing', 'key account')) bump('marketing_sales', 0.7);
  return finishDomain(s);
}

// ============================================
// STAGE B: FIT SCORE
// ============================================

function calculateFitScore(candidate: Any, job: Any, skillReqs: Any[], taxonomy: Any[], config: Any, opts: V32Options, match: MatchFn) {
  const skillResult = calculateSkillScore(candidate, job, skillReqs, taxonomy, opts, match);
  const experienceScore = calculateExperienceScore(candidate, job);
  const seniorityScore = calculateSeniorityScore(candidate, job);
  const industryScore = calculateIndustryScore(candidate, job);

  const breakdown = config.weights.fit_breakdown;
  const totalWeight = breakdown.skills + breakdown.experience + breakdown.seniority + breakdown.industry;
  if (totalWeight === 0 || isNaN(totalWeight)) {
    return {
      score: 50,
      mustHaveCoverage: skillResult.mustHaveCoverage || 1.0,
      coverageKnown: skillResult.coverageKnown,
      breakdown: { skills: skillResult.score || 50, experience: experienceScore || 50, seniority: seniorityScore || 50, industry: industryScore || 50 },
      details: { skills: skillResult.details || { matched: [], transferable: [], missing: [], mustHaveMissing: [] } },
    };
  }
  const weightedScore =
    (skillResult.score || 0) * (breakdown.skills / totalWeight) +
    (experienceScore || 0) * (breakdown.experience / totalWeight) +
    (seniorityScore || 0) * (breakdown.seniority / totalWeight) +
    (industryScore || 0) * (breakdown.industry / totalWeight);
  return {
    score: isNaN(weightedScore) ? 50 : Math.round(weightedScore),
    mustHaveCoverage: skillResult.mustHaveCoverage,
    coverageKnown: skillResult.coverageKnown,
    breakdown: { skills: skillResult.score || 0, experience: experienceScore || 0, seniority: seniorityScore || 0, industry: industryScore || 0 },
    details: { skills: skillResult.details },
  };
}

function calculateSkillScore(candidate: Any, job: Any, skillReqs: Any[], taxonomy: Any[], opts: V32Options, match: MatchFn) {
  const { flags } = opts;
  const baseSkills: string[] = (candidate.skills || []).map((s: string) => s.toLowerCase());
  // F4: Jobtitel (+ Nominalisierung) als zusätzliche Evidenz — „Data Scientist" belegt „Data Science".
  const candidateSkills = flags.F4 ? [...baseSkills, ...deriveTitleEvidence(candidate.job_title)] : baseSkills;

  let mustHaves: Any[] = [];
  let niceHaves: Any[] = [];
  if (skillReqs.length > 0) {
    mustHaves = skillReqs.filter((sr) => sr.type === 'must');
    niceHaves = skillReqs.filter((sr) => sr.type === 'nice');
  } else {
    const mustHaveSkills = (job.must_haves || job.must_have_skills || []).map((s: string) => s.toLowerCase());
    const allSkills = (job.skills || []).map((s: string) => s.toLowerCase());
    const niceToHaveSkills = (job.nice_to_haves || []).map((s: string) => s.toLowerCase());
    mustHaves = mustHaveSkills.map((s: string) => ({ skill_name: s, type: 'must', weight: 1.0 }));
    const niceSkills = [...new Set([...niceToHaveSkills, ...allSkills.filter((s: string) => !mustHaveSkills.includes(s))])];
    niceHaves = niceSkills.map((s) => ({ skill_name: s, type: 'nice', weight: 0.5 }));
  }

  const matched: string[] = [];
  const transferable: string[] = [];
  const missing: string[] = [];
  const mustHaveMissing: string[] = [];
  let mustHaveCredit = 0;
  let mustHaveWeight = 0;
  let totalCredit = 0;
  let totalWeight = 0;

  for (const req of mustHaves) {
    const skillName = req.skill_name.toLowerCase();
    const weight = req.weight || 1.0;
    mustHaveWeight += weight;
    totalWeight += weight;
    const credit = getSkillCredit(skillName, candidateSkills, taxonomy, opts, match);
    if (credit.matchType === 'direct') {
      matched.push(skillName);
      mustHaveCredit += weight;
      totalCredit += weight;
    } else if (credit.matchType === 'transferable') {
      transferable.push(skillName);
      mustHaveCredit += weight * 0.7;
      totalCredit += weight * 0.7;
    } else {
      missing.push(skillName);
      mustHaveMissing.push(skillName);
    }
  }

  for (const req of niceHaves) {
    const skillName = req.skill_name.toLowerCase();
    const weight = (req.weight || 0.5) * 0.5;
    totalWeight += weight;
    const credit = getSkillCredit(skillName, candidateSkills, taxonomy, opts, match);
    if (credit.matchType === 'direct') {
      matched.push(skillName);
      totalCredit += weight;
    } else if (credit.matchType === 'transferable') {
      transferable.push(skillName);
      totalCredit += weight * 0.7;
    }
  }

  // F5: ohne Must-haves ist die Coverage UNBEKANNT (v3.1: 1.0 → jeder „erfüllt alles").
  const coverageKnown = !(flags.F5 && mustHaveWeight === 0);
  const mustHaveCoverage = mustHaveWeight > 0
    ? mustHaveCredit / mustHaveWeight
    : !coverageKnown
      ? 0.5 // F5: nur Anzeigewert; Policy nutzt coverageKnown=false
      : (candidateSkills.length === 0 ? 0 : 1.0);

  let overallScore = totalWeight > 0 ? (totalCredit / totalWeight) * 100 : (candidateSkills.length > 0 ? 50 : 0);
  // F5: ganz ohne Anforderungen ist der Skill-Fit neutral (50) — auch für leere Skill-Listen.
  if (flags.F5 && totalWeight === 0) overallScore = 50;

  return {
    score: Math.round(overallScore),
    mustHaveCoverage,
    coverageKnown,
    details: { matched: [...new Set(matched)], transferable: [...new Set(transferable)], missing: [...new Set(missing)], mustHaveMissing },
  };
}

function getSkillCredit(skillName: string, candidateSkills: string[], taxonomy: Any[], opts: V32Options, match: MatchFn) {
  const extractedKeywords = extractSkillKeywords(skillName, opts.flags);
  for (const keyword of extractedKeywords) {
    const keywordResult = matchSingleSkill(keyword, candidateSkills, taxonomy, opts, match);
    if (keywordResult.matchType !== 'missing') return keywordResult;
  }
  return matchSingleSkill(skillName, candidateSkills, taxonomy, opts, match);
}

/**
 * Kern-Matching. Struktur identisch zur Replika (Direkt → Synonyme →
 * Taxonomie-Aliase/Transfer → Reverse-Taxonomie). F4 ersetzt jedes
 * `x.includes(y) || y.includes(x)` durch `match()` (Token/Wortgrenze).
 */
function matchSingleSkill(skillName: string, candidateSkills: string[], taxonomy: Any[], opts: V32Options, match: MatchFn) {
  const syn = opts.synonymMap;
  const normalizedSkill = skillName.toLowerCase().trim();

  // STEP 1: direkt
  if (candidateSkills.some((cs) => match(cs, normalizedSkill))) return { credit: 1.0, matchType: 'direct' as const };

  // STEP 2: Synonym-Map (F4: kurze Synonyme < 4 Zeichen matchen durch termMatches nur als exaktes Token)
  const skillSynonyms = syn.get(normalizedSkill);
  if (skillSynonyms && skillSynonyms.size > 0) {
    for (const synonym of skillSynonyms) {
      if (candidateSkills.some((cs) => match(cs, synonym))) return { credit: 1.0, matchType: 'direct' as const };
    }
  }
  for (const candidateSkill of candidateSkills) {
    const candidateSynonyms = syn.get(candidateSkill);
    if (candidateSynonyms && skillSynonyms) {
      for (const candSyn of candidateSynonyms) if (skillSynonyms.has(candSyn)) return { credit: 1.0, matchType: 'direct' as const };
    }
  }

  // STEP 3: Taxonomie-Aliase + Transferability
  const taxEntry = taxonomy.find((t) => t.canonical_name?.toLowerCase() === normalizedSkill);
  if (taxEntry) {
    if (taxEntry.aliases) {
      const aliases = Array.isArray(taxEntry.aliases) ? taxEntry.aliases : [];
      if (aliases.some((a: string) => candidateSkills.some((cs) => match(cs, a.toLowerCase())))) {
        return { credit: 1.0, matchType: 'direct' as const };
      }
    }
    if (taxEntry.transferability_from && typeof taxEntry.transferability_from === 'object') {
      for (const [fromSkill, transferability] of Object.entries(taxEntry.transferability_from)) {
        const fromSkillLower = fromSkill.toLowerCase();
        if (candidateSkills.some((cs) => match(cs, fromSkillLower))) {
          return { credit: ((transferability as number) / 100) * 0.7, matchType: 'transferable' as const };
        }
      }
    }
  }

  // STEP 4: Reverse-Taxonomie
  for (const candidateSkill of candidateSkills) {
    const candidateTaxEntry = taxonomy.find((t) => t.canonical_name?.toLowerCase() === candidateSkill);
    if (candidateTaxEntry?.aliases) {
      const aliases = Array.isArray(candidateTaxEntry.aliases) ? candidateTaxEntry.aliases : [];
      if (aliases.some((a: string) => match(a.toLowerCase(), normalizedSkill))) return { credit: 1.0, matchType: 'direct' as const };
    }
    for (const taxItem of taxonomy) {
      if (taxItem.aliases && Array.isArray(taxItem.aliases)) {
        const hasAsAlias = taxItem.aliases.some((a: string) => a.toLowerCase() === candidateSkill);
        const isRequired = taxItem.canonical_name?.toLowerCase() === normalizedSkill;
        if (hasAsAlias && isRequired) return { credit: 1.0, matchType: 'direct' as const };
      }
    }
  }
  return { credit: 0, matchType: 'missing' as const };
}

function calculateExperienceScore(candidate: Any, job: Any): number {
  const candidateYears = candidate.experience_years || 0;
  const jobMinYears = job.experience_min || 0;
  const jobMaxYears = job.experience_max || 20;
  if (candidateYears >= jobMinYears && candidateYears <= jobMaxYears) return 100;
  if (candidateYears < jobMinYears) return Math.max(0, 100 - (jobMinYears - candidateYears) * 20);
  if (candidateYears > jobMaxYears + 5) return 70;
  return 85;
}

function calculateSeniorityScore(candidate: Any, job: Any): number {
  const seniorityLevels = ['junior', 'mid', 'senior', 'lead', 'head', 'director', 'vp', 'c-level'];
  const candIdx = seniorityLevels.indexOf((candidate.seniority || 'mid').toLowerCase());
  const jobIdx = seniorityLevels.indexOf((job.experience_level || 'mid').toLowerCase());
  if (candIdx < 0 || jobIdx < 0) return 75;
  const gap = Math.abs(candIdx - jobIdx);
  if (gap === 0) return 100;
  if (gap === 1) return 60;
  if (gap === 2) return 25;
  return 10;
}

function calculateIndustryScore(candidate: Any, job: Any): number {
  const candidateIndustries = (candidate.industry_experience || []) as string[];
  const jobIndustry = (job.industry || '').toLowerCase();
  if (!jobIndustry) return 75;
  const hasMatch = candidateIndustries.some((i) => i.toLowerCase().includes(jobIndustry) || jobIndustry.includes(i.toLowerCase()));
  return hasMatch ? 100 : 50;
}

// ============================================
// STAGE C: CONSTRAINTS SCORE
// ============================================

function calculateConstraintsScore(candidate: Any, job: Any, config: Any, opts: V32Options) {
  const { flags, nowMs } = opts;

  // Salary
  const candidateSalary = candidate.expected_salary || candidate.salary_expectation_min || 0;
  const jobSalaryMax = job.salary_max || 0;
  // F6: fehlt eine Seite, ist das Gehalt unbekannt → neutral statt 100.
  let salaryScore = flags.F6 ? NEUTRAL_SCORE : 100;
  if (candidateSalary > 0 && jobSalaryMax > 0) {
    if (candidateSalary <= jobSalaryMax) salaryScore = 100; // F6: Unter-Budget gibt KEINEN Bonus (nur Risk)
    else salaryScore = Math.max(0, 100 - ((candidateSalary - jobSalaryMax) / jobSalaryMax) * 100 * 3);
  }

  // Commute (unverändert)
  let commuteScore = 100;
  const isRemoteJob = job.remote_type === 'remote' || job.work_model === 'remote';
  const candidateRemote = candidate.remote_preference === 'remote' || candidate.work_model === 'remote';
  if (!(isRemoteJob || candidateRemote)) {
    const maxCommute = candidate.max_commute_minutes || 45;
    if (maxCommute > config.gate_thresholds.commute_fail_minutes) commuteScore = 40;
    else if (maxCommute > config.gate_thresholds.commute_warn_minutes) commuteScore = 70;
  }

  // Start Date
  // F7: availability_date → sonst notice_period; F6: unbekannt → neutral.
  const start = resolveStartDays(candidate, nowMs, flags.F7);
  let startDateScore = flags.F6 && start.days === null ? NEUTRAL_SCORE : 100;
  if (start.days !== null) {
    if (flags.F7) {
      startDateScore = softStartDate(start.days, resolveJobTargetDays(job, nowMs)).score;
    } else {
      const daysUntil = start.days;
      if (daysUntil <= 14) startDateScore = 100;
      else if (daysUntil <= 30) startDateScore = 90;
      else if (daysUntil <= 60) startDateScore = 70;
      else if (daysUntil <= 90) startDateScore = 50;
      else startDateScore = 30;
    }
  }

  const breakdown = config.weights.constraint_breakdown;
  const totalWeight = breakdown.salary + breakdown.commute + breakdown.startDate;
  const weightedScore =
    salaryScore * (breakdown.salary / totalWeight) +
    commuteScore * (breakdown.commute / totalWeight) +
    startDateScore * (breakdown.startDate / totalWeight);

  return {
    score: Math.round(weightedScore),
    breakdown: { salary: salaryScore, commute: commuteScore, startDate: startDateScore },
    startKnown: start.days !== null,
    startDays: start.days,
    startSource: start.source,
  };
}

// ============================================
// STAGE D: POLICY
// ============================================

function determinePolicy(score: number, coverage: number, multiplier: number, config: Any): PolicyTier {
  const policies = config.display_policies;
  if (score >= policies.hot.minScore && coverage >= policies.hot.minCoverage && (!policies.hot.requiresMultiplier1 || multiplier >= 0.95)) return 'hot';
  if (score >= policies.standard.minScore && coverage >= policies.standard.minCoverage) return 'standard';
  if (score >= policies.maybe.minScore && coverage >= policies.maybe.minCoverage) return 'maybe';
  return 'hidden';
}

/** F5: ohne Must-haves entscheidet nur der Score — höchstens 'maybe'. */
function determinePolicyUnknownCoverage(score: number, config: Any): PolicyTier {
  return score >= config.display_policies.maybe.minScore ? 'maybe' : 'hidden';
}

// ============================================
// EXPLAINABILITY (gekürzt auf die für Headhunter sichtbaren Texte)
// ============================================

function generateExplainability(
  candidate: Any,
  fitResult: Any,
  constraintsResult: Any,
  dealbreakers: Any,
  policy: PolicyTier,
  flags: V32Flags,
  extraRisks: string[],
  known: { salaryKnown: boolean; startKnown: boolean; coverageKnown: boolean; familyExcluded: boolean },
) {
  const topReasons: string[] = [];
  const topRisks: string[] = [];
  const matchedSkills = fitResult.details?.skills?.matched || [];

  if (matchedSkills.length > 0) topReasons.push(`${matchedSkills.length} direkte Skill-Matches: ${matchedSkills.slice(0, 3).join(', ')}`);
  if (fitResult.breakdown.experience >= 80) topReasons.push(`Erfahrung passt: ${candidate.experience_years || 0} Jahre`);
  // F6: Positiv-Text nur, wenn Gehalt bzw. Start tatsächlich bekannt sind (v3.1: auch bei fehlenden Daten).
  if (constraintsResult.breakdown.salary >= 80 && (!flags.F6 || known.salaryKnown)) topReasons.push('Gehaltsvorstellung im Budget');
  if (constraintsResult.breakdown.startDate >= 90 && (!flags.F6 || known.startKnown)) topReasons.push('Kurzfristig verfügbar');

  const missingSkills = fitResult.details?.skills?.mustHaveMissing || [];
  if (missingSkills.length > 0) topRisks.push(`Fehlende Must-haves: ${missingSkills.slice(0, 2).join(', ')}`);
  if (dealbreakers.domainMismatch?.isIncompatible) {
    topRisks.unshift(`⚠️ Technologie-Mismatch: ${dealbreakers.domainMismatch.candidateDomain} → ${dealbreakers.domainMismatch.jobDomain}`);
  } else if (dealbreakers.domainMismatch) {
    topRisks.push(`Tech-Bereich abweichend: ${dealbreakers.domainMismatch.candidateDomain} → ${dealbreakers.domainMismatch.jobDomain}`);
  }
  if (dealbreakers.factors.salary < 1) topRisks.push(`Gehalt über Budget (${Math.round((1 - dealbreakers.factors.salary) * 100)}% über Maximum)`);
  if (dealbreakers.factors.startDate < 1) topRisks.push('Starttermin nicht optimal');
  if (dealbreakers.factors.seniority < 1) topRisks.push('Seniority-Level weicht ab');
  topRisks.push(...extraRisks);

  let nextAction = 'Profil prüfen';
  let whyNot: string | undefined;
  switch (policy) {
    case 'hot': nextAction = 'Sofort zum Interview einladen'; break;
    case 'standard': nextAction = 'Kandidat kontaktieren und Details klären'; break;
    case 'maybe':
      nextAction = 'Bei Bedarf manuell prüfen';
      whyNot = !known.coverageKnown
        ? 'Keine Must-haves hinterlegt – Passung nur eingeschränkt bewertbar' // F5
        : 'Score oder Coverage unter Standard-Schwelle';
      break;
    case 'hidden':
      nextAction = 'Nicht anzeigen';
      whyNot = known.familyExcluded
        ? extraRisks[0] // F8: Berufsfeld-Begründung
        : known.coverageKnown && fitResult.mustHaveCoverage < 0.70
          ? `Must-have Coverage nur ${Math.round(fitResult.mustHaveCoverage * 100)}%`
          : 'Score unter Mindest-Schwelle';
      break;
  }
  return { topReasons: topReasons.slice(0, 3), topRisks: topRisks.slice(0, 5), whyNot, nextAction };
}

// ============================================
// HELPER RESULTS
// ============================================

function createKilledResult(jobId: string, reason: string, category?: string): Any {
  return {
    version: 'v3.2-proto', jobId, overall: 0, killed: true, excluded: true, mustHaveCoverage: 0, gateMultiplier: 0, policy: 'hidden',
    gates: {
      hardKills: { visa: category === 'visa', language: category === 'language', onsite: category === 'onsite', license: category === 'license', techDomain: category === 'tech_domain' },
      dealbreakers: { salary: 1, startDate: 1, seniority: 1, workModel: 1, techDomain: 1 },
      multiplier: 0,
    },
    fit: { score: 0, breakdown: { skills: 0, experience: 0, seniority: 0, industry: 0 }, details: { skills: { matched: [], transferable: [], missing: [], mustHaveMissing: [] } } },
    constraints: { score: 0, breakdown: { salary: 0, commute: 0, startDate: 0 } },
    explainability: { topReasons: [], topRisks: [reason], whyNot: reason, nextAction: 'Nicht anzeigen - Hard Kill' },
  };
}

function createExcludedResult(jobId: string, coverage: number, reason: string): Any {
  return {
    version: 'v3.2-proto', jobId, overall: 0, killed: false, excluded: true, mustHaveCoverage: coverage, gateMultiplier: 1, policy: 'hidden',
    gates: {
      hardKills: { visa: false, language: false, onsite: false, license: false, techDomain: false },
      dealbreakers: { salary: 1, startDate: 1, seniority: 1, workModel: 1, techDomain: 1 },
      multiplier: 1,
    },
    fit: { score: 0, breakdown: { skills: 0, experience: 0, seniority: 0, industry: 0 }, details: { skills: { matched: [], transferable: [], missing: [], mustHaveMissing: [] } } },
    constraints: { score: 0, breakdown: { salary: 0, commute: 0, startDate: 0 } },
    explainability: { topReasons: [], topRisks: [reason], whyNot: reason, nextAction: 'Nicht anzeigen - Coverage zu niedrig' },
  };
}
