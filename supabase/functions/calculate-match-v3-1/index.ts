import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// TYPES
// ============================================

type GateResult = 'pass' | 'warn' | 'fail';
type PolicyTier = 'hot' | 'standard' | 'maybe' | 'hidden';

interface HardKillResult {
  killed: boolean;
  reason?: string;
  category?: string;
}

interface DealBreakerResult {
  multiplier: number;
  factors: {
    salary: number;
    startDate: number;
    seniority: number;
    workModel: number;
  };
}

interface SkillCredit {
  skill: string;
  credit: number;
  matchType: 'direct' | 'transferable' | 'missing';
  cappedCredit?: number;
  prereqPenalty?: boolean;
}

interface V31MatchResult {
  version: string;
  jobId: string;
  overall: number;
  killed: boolean;
  excluded: boolean;
  mustHaveCoverage: number;
  gateMultiplier: number;
  policy: PolicyTier;
  gates: {
    hardKills: {
      visa: boolean;
      language: boolean;
      onsite: boolean;
      license: boolean;
    };
    dealbreakers: {
      salary: number;
      startDate: number;
      seniority: number;
      workModel: number;
    };
    multiplier: number;
  };
  fit: {
    score: number;
    breakdown: {
      skills: number;
      experience: number;
      seniority: number;
      industry: number;
    };
    details: {
      skills: {
        matched: string[];
        transferable: string[];
        missing: string[];
        mustHaveMissing: string[];
      };
    };
  };
  constraints: {
    score: number;
    breakdown: {
      salary: number;
      commute: number;
      startDate: number;
    };
  };
  explainability: {
    topReasons: string[];
    topRisks: string[];
    whyNot?: string;
    nextAction: string;
  };
}

interface MatchingConfig {
  weights: {
    fit: number;
    constraints: number;
    fit_breakdown: { skills: number; experience: number; seniority: number; industry: number };
    constraint_breakdown: { salary: number; commute: number; startDate: number };
  };
  gate_thresholds: any;
  hard_kill_defaults: {
    visa_required: boolean;
    language_required: boolean;
    onsite_required: boolean;
    license_required: boolean;
  };
  dealbreaker_multipliers: {
    salary: { min: number; max: number; multiplier: number }[];
    start_date: { min: number; max: number; multiplier: number }[];
    seniority: { gap: number; multiplier: number }[];
  };
  display_policies: {
    hot: { minScore: number; minCoverage: number; maxBlockers: number; requiresMultiplier1: boolean };
    standard: { minScore: number; minCoverage: number; maxBlockers: number; requiresMultiplier1: boolean };
    maybe: { minScore: number; minCoverage: number; maxBlockers: number; requiresMultiplier1: boolean };
  };
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { candidateId, jobIds, mode = 'strict', configProfile = 'default' } = await req.json();

    if (!candidateId || !jobIds || !Array.isArray(jobIds) || jobIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'candidateId and jobIds[] are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`V3.1 Batch Match: Candidate ${candidateId} vs ${jobIds.length} jobs (mode: ${mode})`);

    // 1. Fetch config
    const { data: configData } = await supabase
      .from('matching_config')
      .select('*')
      .eq('active', true)
      .eq('profile', configProfile)
      .single();

    const config = buildConfig(configData);

    // 2. Fetch candidate
    const { data: candidate, error: candError } = await supabase
      .from('candidates')
      .select('*')
      .eq('id', candidateId)
      .single();

    if (candError || !candidate) {
      throw new Error('Candidate not found');
    }

    // 3. Fetch all jobs in batch
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('*')
      .in('id', jobIds);

    if (jobsError || !jobs) {
      throw new Error('Jobs not found');
    }

    // 4. Fetch job skill requirements in batch
    const { data: allSkillReqs } = await supabase
      .from('job_skill_requirements')
      .select('*')
      .in('job_id', jobIds);

    // 5. Fetch skill taxonomy
    const { data: taxonomy } = await supabase
      .from('skill_taxonomy')
      .select('*');

    // 6. Process each job
    const results: V31MatchResult[] = [];

    for (const job of jobs) {
      const skillReqs = (allSkillReqs || []).filter(sr => sr.job_id === job.id);
      const result = calculateMatch(candidate, job, skillReqs, taxonomy || [], config, mode);
      results.push(result);

      // Store outcome for calibration (ignore errors for matches without submissions)
      try {
        await supabase.from('match_outcomes').insert({
          job_id: job.id,
          candidate_id: candidateId,
          match_version: 'v3.1',
          predicted_overall_score: result.overall,
          must_have_coverage: result.mustHaveCoverage,
          gate_multiplier: result.gateMultiplier,
          policy_tier: result.policy,
          killed: result.killed,
          excluded: result.excluded,
          kill_reason: result.explainability.whyNot
        });
      } catch (e) {
        // Ignore insert errors for matches without submissions
      }
    }

    console.log(`V3.1 Results: ${results.filter(r => r.policy === 'hot').length} hot, ${results.filter(r => r.policy === 'standard').length} standard, ${results.filter(r => r.policy === 'maybe').length} maybe, ${results.filter(r => r.killed || r.excluded).length} excluded`);

    return new Response(
      JSON.stringify({ results, candidateId, mode, configProfile }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in calculate-match-v3-1:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================
// CONFIG BUILDER
// ============================================

function buildConfig(configData: any): MatchingConfig {
  return {
    weights: configData?.weights || {
      fit: 0.70,
      constraints: 0.30,
      fit_breakdown: { skills: 0.50, experience: 0.15, seniority: 0.03, industry: 0.02 },
      constraint_breakdown: { salary: 0.12, commute: 0.12, startDate: 0.06 }
    },
    gate_thresholds: configData?.gate_thresholds || {
      salary_warn_percent: 10,
      salary_fail_percent: 30,
      commute_warn_minutes: 45,
      commute_fail_minutes: 75,
      availability_warn_days: 60,
      availability_fail_days: 120
    },
    hard_kill_defaults: configData?.hard_kill_defaults || {
      visa_required: true,
      language_required: true,
      onsite_required: true,
      license_required: true
    },
    dealbreaker_multipliers: configData?.dealbreaker_multipliers || {
      salary: [
        { min: 0, max: 10, multiplier: 0.6 },
        { min: 10, max: 20, multiplier: 0.3 },
        { min: 20, max: 30, multiplier: 0.15 },
        { min: 30, max: 999, multiplier: 0.05 }
      ],
      start_date: [
        { min: 14, max: 30, multiplier: 0.7 },
        { min: 30, max: 60, multiplier: 0.4 },
        { min: 60, max: 999, multiplier: 0.2 }
      ],
      seniority: [
        { gap: 1, multiplier: 0.6 },
        { gap: 2, multiplier: 0.25 },
        { gap: 3, multiplier: 0.1 }
      ]
    },
    display_policies: configData?.display_policies || {
      hot: { minScore: 85, minCoverage: 0.85, maxBlockers: 0, requiresMultiplier1: true },
      standard: { minScore: 75, minCoverage: 0.70, maxBlockers: 0, requiresMultiplier1: false },
      maybe: { minScore: 65, minCoverage: 0.60, maxBlockers: 1, requiresMultiplier1: false }
    }
  };
}

// ============================================
// MAIN MATCH CALCULATION
// ============================================

function calculateMatch(
  candidate: any,
  job: any,
  skillReqs: any[],
  taxonomy: any[],
  config: MatchingConfig,
  mode: string
): V31MatchResult {
  const jobId = job.id;

  // Stage A: Hard Kills
  const hardKill = evaluateHardKills(candidate, job, config.hard_kill_defaults);
  
  if (hardKill.killed) {
    return createKilledResult(jobId, hardKill.reason || 'Hard Kill', hardKill.category);
  }

  // Stage A.2: Dealbreaker Multipliers
  const dealbreakers = calculateDealbreakers(candidate, job, config);
  const gateMultiplier = dealbreakers.multiplier;

  // Stage B: Fit Score
  const fitResult = calculateFitScore(candidate, job, skillReqs, taxonomy, config);

  // Must-have coverage gate
  if (fitResult.mustHaveCoverage < 0.70) {
    return createExcludedResult(jobId, fitResult.mustHaveCoverage, `Must-have Coverage nur ${Math.round(fitResult.mustHaveCoverage * 100)}%`);
  }

  // Stage C: Constraints Score
  const constraintsResult = calculateConstraintsScore(candidate, job, config);

  // Calculate overall score
  let overallScore = Math.round(
    fitResult.score * config.weights.fit +
    constraintsResult.score * config.weights.constraints
  );

  // Apply gate multiplier
  const finalScore = Math.round(overallScore * gateMultiplier);

  // Stage D: Policy determination
  const policy = determinePolicy(finalScore, fitResult.mustHaveCoverage, gateMultiplier, config);

  // Generate explainability
  const explainability = generateExplainability(
    candidate,
    job,
    fitResult,
    constraintsResult,
    dealbreakers,
    policy
  );

  return {
    version: 'v3.1',
    jobId,
    overall: finalScore,
    killed: false,
    excluded: policy === 'hidden',
    mustHaveCoverage: fitResult.mustHaveCoverage,
    gateMultiplier,
    policy,
    gates: {
      hardKills: {
        visa: false,
        language: false,
        onsite: false,
        license: false
      },
      dealbreakers: dealbreakers.factors,
      multiplier: gateMultiplier
    },
    fit: {
      score: fitResult.score,
      breakdown: fitResult.breakdown,
      details: fitResult.details
    },
    constraints: {
      score: constraintsResult.score,
      breakdown: constraintsResult.breakdown
    },
    explainability
  };
}

// ============================================
// STAGE A: HARD KILLS
// ============================================

function evaluateHardKills(candidate: any, job: any, defaults: any): HardKillResult {
  // Visa / Work Authorization
  if (defaults.visa_required && candidate.visa_required && !job.visa_sponsorship) {
    return { killed: true, reason: 'Visum erforderlich, nicht angeboten', category: 'visa' };
  }

  // Required Languages
  if (defaults.language_required && job.required_languages && Array.isArray(job.required_languages)) {
    const candidateLanguages = candidate.language_skills || [];
    for (const reqLang of job.required_languages) {
      const candidateLang = candidateLanguages.find((l: any) => 
        l.language?.toLowerCase() === reqLang.code?.toLowerCase() ||
        l.code?.toLowerCase() === reqLang.code?.toLowerCase()
      );
      if (!candidateLang) {
        return { killed: true, reason: `Sprache ${reqLang.code} fehlt`, category: 'language' };
      }
      // Check level if specified
      const levelOrder = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'native'];
      if (reqLang.minLevel) {
        const reqIdx = levelOrder.indexOf(reqLang.minLevel.toLowerCase());
        const candIdx = levelOrder.indexOf((candidateLang.level || 'a1').toLowerCase());
        if (candIdx < reqIdx) {
          return { killed: true, reason: `${reqLang.code} mindestens ${reqLang.minLevel} erforderlich`, category: 'language' };
        }
      }
    }
  }

  // Onsite Required vs Remote-Only Candidate
  if (defaults.onsite_required && job.onsite_required) {
    const candidateRemoteOnly = candidate.remote_preference === 'remote_only' || 
                                 candidate.work_model === 'remote_only';
    if (candidateRemoteOnly) {
      return { killed: true, reason: 'Präsenzpflicht, Kandidat nur Remote', category: 'onsite' };
    }
  }

  // Required Certifications
  if (defaults.license_required && job.required_certifications && Array.isArray(job.required_certifications)) {
    const candidateCerts = candidate.certifications || [];
    for (const reqCert of job.required_certifications) {
      const hasCert = candidateCerts.some((c: string) => 
        c.toLowerCase().includes(reqCert.toLowerCase()) ||
        reqCert.toLowerCase().includes(c.toLowerCase())
      );
      if (!hasCert) {
        return { killed: true, reason: `Zertifikat ${reqCert} fehlt`, category: 'license' };
      }
    }
  }

  return { killed: false };
}

// ============================================
// STAGE A.2: DEALBREAKER MULTIPLIERS
// ============================================

function calculateDealbreakers(candidate: any, job: any, config: MatchingConfig): DealBreakerResult {
  let salaryMult = 1.0;
  let startDateMult = 1.0;
  let seniorityMult = 1.0;
  let workModelMult = 1.0;

  // Salary gap multiplier
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
  if (candidate.availability_date) {
    const availDate = new Date(candidate.availability_date);
    const daysUntil = Math.ceil((availDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil > 14) {
      for (const range of config.dealbreaker_multipliers.start_date) {
        if (daysUntil >= range.min && daysUntil < range.max) {
          startDateMult = range.multiplier;
          break;
        }
      }
    }
  }

  // Seniority mismatch multiplier
  const seniorityLevels = ['junior', 'mid', 'senior', 'lead', 'head', 'director', 'vp', 'c-level'];
  const candidateSeniority = (candidate.seniority || 'mid').toLowerCase();
  const jobSeniority = (job.experience_level || 'mid').toLowerCase();
  
  const candIdx = seniorityLevels.indexOf(candidateSeniority);
  const jobIdx = seniorityLevels.indexOf(jobSeniority);
  
  if (candIdx >= 0 && jobIdx >= 0) {
    const gap = Math.abs(candIdx - jobIdx);
    if (gap > 0) {
      const mult = config.dealbreaker_multipliers.seniority.find(s => s.gap === gap);
      if (mult) {
        seniorityMult = mult.multiplier;
      } else if (gap >= 3) {
        seniorityMult = 0.1;
      }
    }
  }

  // Work model mismatch
  const jobRemote = job.remote_type === 'remote' || job.work_model === 'remote';
  const jobHybrid = job.remote_type === 'hybrid' || job.work_model === 'hybrid';
  const candidateRemote = candidate.remote_preference === 'remote' || candidate.work_model === 'remote';
  
  if (candidateRemote && !jobRemote && !jobHybrid) {
    workModelMult = 0.25;
  } else if (candidateRemote && jobHybrid) {
    workModelMult = 0.7;
  }

  const finalMultiplier = salaryMult * startDateMult * seniorityMult * workModelMult;

  return {
    multiplier: Math.max(0.05, finalMultiplier),
    factors: {
      salary: salaryMult,
      startDate: startDateMult,
      seniority: seniorityMult,
      workModel: workModelMult
    }
  };
}

// ============================================
// STAGE B: FIT SCORE
// ============================================

function calculateFitScore(
  candidate: any,
  job: any,
  skillReqs: any[],
  taxonomy: any[],
  config: MatchingConfig
): { score: number; mustHaveCoverage: number; breakdown: any; details: any } {
  
  // Skills scoring with dependencies and clusters
  const skillResult = calculateSkillScore(candidate, job, skillReqs, taxonomy);
  
  // Experience scoring
  const experienceScore = calculateExperienceScore(candidate, job);
  
  // Seniority scoring
  const seniorityScore = calculateSeniorityScore(candidate, job);
  
  // Industry scoring
  const industryScore = calculateIndustryScore(candidate, job);

  const breakdown = config.weights.fit_breakdown;
  const totalWeight = breakdown.skills + breakdown.experience + breakdown.seniority + breakdown.industry;
  
  // NaN protection: If weights are 0 or NaN, return default score
  if (totalWeight === 0 || isNaN(totalWeight)) {
    console.warn('Fit score calculation: totalWeight is 0 or NaN, returning default');
    return {
      score: 50,
      mustHaveCoverage: skillResult.mustHaveCoverage || 1.0,
      breakdown: {
        skills: skillResult.score || 50,
        experience: experienceScore || 50,
        seniority: seniorityScore || 50,
        industry: industryScore || 50
      },
      details: {
        skills: skillResult.details || { matched: [], transferable: [], missing: [], mustHaveMissing: [] }
      }
    };
  }
  
  const weightedScore = (
    (skillResult.score || 0) * (breakdown.skills / totalWeight) +
    (experienceScore || 0) * (breakdown.experience / totalWeight) +
    (seniorityScore || 0) * (breakdown.seniority / totalWeight) +
    (industryScore || 0) * (breakdown.industry / totalWeight)
  );
  
  // Final NaN check
  const finalScore = isNaN(weightedScore) ? 50 : Math.round(weightedScore);

  return {
    score: finalScore,
    mustHaveCoverage: skillResult.mustHaveCoverage,
    breakdown: {
      skills: skillResult.score || 0,
      experience: experienceScore || 0,
      seniority: seniorityScore || 0,
      industry: industryScore || 0
    },
    details: {
      skills: skillResult.details
    }
  };
}

function calculateSkillScore(
  candidate: any,
  job: any,
  skillReqs: any[],
  taxonomy: any[]
): { score: number; mustHaveCoverage: number; details: any } {
  const candidateSkills = (candidate.skills || []).map((s: string) => s.toLowerCase());
  
  // Use structured requirements if available, fallback to job.skills
  let mustHaves: any[] = [];
  let niceHaves: any[] = [];
  
  if (skillReqs.length > 0) {
    mustHaves = skillReqs.filter(sr => sr.type === 'must');
    niceHaves = skillReqs.filter(sr => sr.type === 'nice');
  } else {
    // Fallback: use must_haves or must_have_skills from job (must_haves is the actual field name)
    const mustHaveSkills = (job.must_haves || job.must_have_skills || []).map((s: string) => s.toLowerCase());
    const allSkills = (job.skills || []).map((s: string) => s.toLowerCase());
    const niceToHaveSkills = (job.nice_to_haves || []).map((s: string) => s.toLowerCase());
    
    mustHaves = mustHaveSkills.map((s: string) => ({ skill_name: s, type: 'must', weight: 1.0 }));
    
    // Combine nice_to_haves with remaining skills
    const niceSkills = [...new Set([...niceToHaveSkills, ...allSkills.filter((s: string) => !mustHaveSkills.includes(s))])];
    niceHaves = niceSkills.map((s: string) => ({ skill_name: s, type: 'nice', weight: 0.5 }));
  }

  const matched: string[] = [];
  const transferable: string[] = [];
  const missing: string[] = [];
  const mustHaveMissing: string[] = [];

  let mustHaveCredit = 0;
  let mustHaveWeight = 0;
  let totalCredit = 0;
  let totalWeight = 0;

  // Process must-haves
  for (const req of mustHaves) {
    const skillName = req.skill_name.toLowerCase();
    const weight = req.weight || 1.0;
    mustHaveWeight += weight;
    totalWeight += weight;

    const credit = getSkillCredit(skillName, candidateSkills, taxonomy);
    
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

  // Process nice-to-haves
  for (const req of niceHaves) {
    const skillName = req.skill_name.toLowerCase();
    const weight = (req.weight || 0.5) * 0.5; // Nice-to-haves count half
    totalWeight += weight;

    const credit = getSkillCredit(skillName, candidateSkills, taxonomy);
    
    if (credit.matchType === 'direct') {
      matched.push(skillName);
      totalCredit += weight;
    } else if (credit.matchType === 'transferable') {
      transferable.push(skillName);
      totalCredit += weight * 0.7;
    }
  }

  const mustHaveCoverage = mustHaveWeight > 0 ? mustHaveCredit / mustHaveWeight : 1.0;
  const overallScore = totalWeight > 0 ? (totalCredit / totalWeight) * 100 : 50;

  return {
    score: Math.round(overallScore),
    mustHaveCoverage,
    details: {
      matched: [...new Set(matched)],
      transferable: [...new Set(transferable)],
      missing: [...new Set(missing)],
      mustHaveMissing
    }
  };
}

function getSkillCredit(
  skillName: string,
  candidateSkills: string[],
  taxonomy: any[]
): { credit: number; matchType: 'direct' | 'transferable' | 'missing' } {
  // Direct match
  if (candidateSkills.some(cs => cs.includes(skillName) || skillName.includes(cs))) {
    return { credit: 1.0, matchType: 'direct' };
  }

  // Check taxonomy for transferability
  const taxEntry = taxonomy.find(t => t.canonical_name?.toLowerCase() === skillName);
  if (taxEntry) {
    // Check aliases
    if (taxEntry.aliases) {
      const aliases = Array.isArray(taxEntry.aliases) ? taxEntry.aliases : [];
      if (aliases.some((a: string) => candidateSkills.some(cs => cs.includes(a.toLowerCase())))) {
        return { credit: 1.0, matchType: 'direct' };
      }
    }

    // Check transferability
    if (taxEntry.transferability_from && typeof taxEntry.transferability_from === 'object') {
      for (const [fromSkill, transferability] of Object.entries(taxEntry.transferability_from)) {
        if (candidateSkills.some(cs => cs.includes(fromSkill.toLowerCase()))) {
          return { credit: (transferability as number) / 100 * 0.7, matchType: 'transferable' };
        }
      }
    }
  }

  return { credit: 0, matchType: 'missing' };
}

function calculateExperienceScore(candidate: any, job: any): number {
  const candidateYears = candidate.experience_years || 0;
  const jobMinYears = job.experience_min || 0;
  const jobMaxYears = job.experience_max || 20;

  if (candidateYears >= jobMinYears && candidateYears <= jobMaxYears) {
    return 100;
  }

  if (candidateYears < jobMinYears) {
    const gap = jobMinYears - candidateYears;
    return Math.max(0, 100 - gap * 20);
  }

  // Overqualified
  if (candidateYears > jobMaxYears + 5) {
    return 70;
  }

  return 85;
}

function calculateSeniorityScore(candidate: any, job: any): number {
  const seniorityLevels = ['junior', 'mid', 'senior', 'lead', 'head', 'director', 'vp', 'c-level'];
  const candidateSeniority = (candidate.seniority || 'mid').toLowerCase();
  const jobSeniority = (job.experience_level || 'mid').toLowerCase();
  
  const candIdx = seniorityLevels.indexOf(candidateSeniority);
  const jobIdx = seniorityLevels.indexOf(jobSeniority);
  
  if (candIdx < 0 || jobIdx < 0) return 75;
  
  const gap = Math.abs(candIdx - jobIdx);
  
  if (gap === 0) return 100;
  if (gap === 1) return 60;
  if (gap === 2) return 25;
  return 10;
}

function calculateIndustryScore(candidate: any, job: any): number {
  const candidateIndustries = (candidate.industry_experience || []) as string[];
  const jobIndustry = (job.industry || '').toLowerCase();
  
  if (!jobIndustry) return 75;
  
  const hasMatch = candidateIndustries.some((i: string) => 
    i.toLowerCase().includes(jobIndustry) || jobIndustry.includes(i.toLowerCase())
  );
  
  return hasMatch ? 100 : 50;
}

// ============================================
// STAGE C: CONSTRAINTS SCORE
// ============================================

function calculateConstraintsScore(
  candidate: any,
  job: any,
  config: MatchingConfig
): { score: number; breakdown: { salary: number; commute: number; startDate: number } } {
  
  // Salary
  const candidateSalary = candidate.expected_salary || candidate.salary_expectation_min || 0;
  const jobSalaryMax = job.salary_max || 0;
  const jobSalaryMin = job.salary_min || 0;
  
  let salaryScore = 100;
  if (candidateSalary > 0 && jobSalaryMax > 0) {
    if (candidateSalary <= jobSalaryMax) {
      salaryScore = 100;
    } else {
      const gap = ((candidateSalary - jobSalaryMax) / jobSalaryMax) * 100;
      salaryScore = Math.max(0, 100 - gap * 3);
    }
  }

  // Commute
  let commuteScore = 100;
  const isRemoteJob = job.remote_type === 'remote' || job.work_model === 'remote';
  const candidateRemote = candidate.remote_preference === 'remote' || candidate.work_model === 'remote';
  
  if (isRemoteJob || candidateRemote) {
    commuteScore = 100;
  } else {
    const maxCommute = candidate.max_commute_minutes || 45;
    if (maxCommute > config.gate_thresholds.commute_fail_minutes) {
      commuteScore = 40;
    } else if (maxCommute > config.gate_thresholds.commute_warn_minutes) {
      commuteScore = 70;
    }
  }

  // Start Date
  let startDateScore = 100;
  if (candidate.availability_date) {
    const availDate = new Date(candidate.availability_date);
    const daysUntil = Math.ceil((availDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil <= 14) {
      startDateScore = 100;
    } else if (daysUntil <= 30) {
      startDateScore = 90;
    } else if (daysUntil <= 60) {
      startDateScore = 70;
    } else if (daysUntil <= 90) {
      startDateScore = 50;
    } else {
      startDateScore = 30;
    }
  }

  const breakdown = config.weights.constraint_breakdown;
  const totalWeight = breakdown.salary + breakdown.commute + breakdown.startDate;
  
  const weightedScore = (
    salaryScore * (breakdown.salary / totalWeight) +
    commuteScore * (breakdown.commute / totalWeight) +
    startDateScore * (breakdown.startDate / totalWeight)
  );

  return {
    score: Math.round(weightedScore),
    breakdown: {
      salary: salaryScore,
      commute: commuteScore,
      startDate: startDateScore
    }
  };
}

// ============================================
// STAGE D: POLICY DETERMINATION
// ============================================

function determinePolicy(
  score: number,
  coverage: number,
  multiplier: number,
  config: MatchingConfig
): PolicyTier {
  const policies = config.display_policies;

  // Hot
  if (score >= policies.hot.minScore && 
      coverage >= policies.hot.minCoverage && 
      (!policies.hot.requiresMultiplier1 || multiplier >= 0.95)) {
    return 'hot';
  }

  // Standard
  if (score >= policies.standard.minScore && coverage >= policies.standard.minCoverage) {
    return 'standard';
  }

  // Maybe
  if (score >= policies.maybe.minScore && coverage >= policies.maybe.minCoverage) {
    return 'maybe';
  }

  return 'hidden';
}

// ============================================
// EXPLAINABILITY
// ============================================

function generateExplainability(
  candidate: any,
  job: any,
  fitResult: any,
  constraintsResult: any,
  dealbreakers: DealBreakerResult,
  policy: PolicyTier
): V31MatchResult['explainability'] {
  const topReasons: string[] = [];
  const topRisks: string[] = [];
  let nextAction = 'Profil prüfen';
  let whyNot: string | undefined;

  // Reasons
  const matchedSkills = fitResult.details?.skills?.matched || [];
  if (matchedSkills.length > 0) {
    topReasons.push(`${matchedSkills.length} Skill-Matches: ${matchedSkills.slice(0, 3).join(', ')}`);
  }

  if (fitResult.breakdown.experience >= 80) {
    topReasons.push(`Erfahrung passt: ${candidate.experience_years || 0} Jahre`);
  }

  if (constraintsResult.breakdown.salary >= 80) {
    topReasons.push('Gehaltsvorstellung im Budget');
  }

  if (constraintsResult.breakdown.startDate >= 90) {
    topReasons.push('Kurzfristig verfügbar');
  }

  // Risks
  const missingSkills = fitResult.details?.skills?.mustHaveMissing || [];
  if (missingSkills.length > 0) {
    topRisks.push(`Fehlende Must-haves: ${missingSkills.slice(0, 2).join(', ')}`);
  }

  if (dealbreakers.factors.salary < 1) {
    const gap = Math.round((1 - dealbreakers.factors.salary) * 100);
    topRisks.push(`Gehalt über Budget (Multiplier: ${dealbreakers.factors.salary.toFixed(2)})`);
  }

  if (dealbreakers.factors.startDate < 1) {
    topRisks.push('Starttermin nicht optimal');
  }

  if (dealbreakers.factors.seniority < 1) {
    topRisks.push('Seniority-Level weicht ab');
  }

  // Next action based on policy
  switch (policy) {
    case 'hot':
      nextAction = 'Sofort zum Interview einladen';
      break;
    case 'standard':
      nextAction = 'Kandidat kontaktieren und Details klären';
      break;
    case 'maybe':
      nextAction = 'Bei Bedarf manuell prüfen';
      whyNot = 'Score oder Coverage unter Standard-Schwelle';
      break;
    case 'hidden':
      nextAction = 'Nicht anzeigen';
      whyNot = fitResult.mustHaveCoverage < 0.70 
        ? `Must-have Coverage nur ${Math.round(fitResult.mustHaveCoverage * 100)}%`
        : 'Score unter Mindest-Schwelle';
      break;
  }

  return {
    topReasons: topReasons.slice(0, 3),
    topRisks: topRisks.slice(0, 3),
    whyNot,
    nextAction
  };
}

// ============================================
// HELPER RESULTS
// ============================================

function createKilledResult(jobId: string, reason: string, category?: string): V31MatchResult {
  return {
    version: 'v3.1',
    jobId,
    overall: 0,
    killed: true,
    excluded: true,
    mustHaveCoverage: 0,
    gateMultiplier: 0,
    policy: 'hidden',
    gates: {
      hardKills: {
        visa: category === 'visa',
        language: category === 'language',
        onsite: category === 'onsite',
        license: category === 'license'
      },
      dealbreakers: { salary: 1, startDate: 1, seniority: 1, workModel: 1 },
      multiplier: 0
    },
    fit: {
      score: 0,
      breakdown: { skills: 0, experience: 0, seniority: 0, industry: 0 },
      details: { skills: { matched: [], transferable: [], missing: [], mustHaveMissing: [] } }
    },
    constraints: {
      score: 0,
      breakdown: { salary: 0, commute: 0, startDate: 0 }
    },
    explainability: {
      topReasons: [],
      topRisks: [reason],
      whyNot: reason,
      nextAction: 'Nicht anzeigen - Hard Kill'
    }
  };
}

function createExcludedResult(jobId: string, coverage: number, reason: string): V31MatchResult {
  return {
    version: 'v3.1',
    jobId,
    overall: 0,
    killed: false,
    excluded: true,
    mustHaveCoverage: coverage,
    gateMultiplier: 1,
    policy: 'hidden',
    gates: {
      hardKills: { visa: false, language: false, onsite: false, license: false },
      dealbreakers: { salary: 1, startDate: 1, seniority: 1, workModel: 1 },
      multiplier: 1
    },
    fit: {
      score: 0,
      breakdown: { skills: 0, experience: 0, seniority: 0, industry: 0 },
      details: { skills: { matched: [], transferable: [], missing: [], mustHaveMissing: [] } }
    },
    constraints: {
      score: 0,
      breakdown: { salary: 0, commute: 0, startDate: 0 }
    },
    explainability: {
      topReasons: [],
      topRisks: [reason],
      whyNot: reason,
      nextAction: 'Nicht anzeigen - Coverage zu niedrig'
    }
  };
}
