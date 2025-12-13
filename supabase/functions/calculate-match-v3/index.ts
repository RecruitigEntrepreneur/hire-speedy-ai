import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type GateResult = 'pass' | 'warn' | 'fail';

interface V3MatchResult {
  version: string;
  gates: {
    salary: GateResult;
    commute: GateResult;
    workAuth: GateResult;
    availability: GateResult;
    overallGate: GateResult;
  };
  fitScore: number;
  fitFactors: {
    skills: { score: number; matched: string[]; missing: string[]; transferable: string[] };
    experience: { score: number; years: number; levelMatch: boolean; gap: number };
    industry: { score: number; industries: string[] };
  };
  constraintScore: number;
  constraintFactors: {
    salary: { score: number; gap: number; negotiable: boolean };
    commute: { score: number; minutes: number; confirmed?: boolean };
    startDate: { score: number; daysUntil: number };
  };
  overallMatch: number;
  dealProbability: number;
  explainability: {
    topReasons: string[];
    topRisks: string[];
    nextAction: string;
    whyNot?: string;
  };
}

interface MatchingConfig {
  weights: {
    fit: number;
    constraints: number;
    fit_breakdown: { skills: number; experience: number; industry: number };
    constraint_breakdown: { salary: number; commute: number; startDate: number };
  };
  gate_thresholds: {
    salary_warn_percent: number;
    salary_fail_percent: number;
    commute_warn_minutes: number;
    commute_fail_minutes: number;
    availability_warn_days: number;
    availability_fail_days: number;
    min_skill_match_percent: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { candidateId, jobId, submissionId } = await req.json();

    if (!candidateId || !jobId) {
      return new Response(
        JSON.stringify({ error: 'candidateId and jobId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Fetch config
    const { data: configData } = await supabase
      .from('matching_config')
      .select('*')
      .eq('active', true)
      .single();

    const config: MatchingConfig = configData || {
      weights: { fit: 0.6, constraints: 0.4, fit_breakdown: { skills: 0.5, experience: 0.3, industry: 0.2 }, constraint_breakdown: { salary: 0.4, commute: 0.35, startDate: 0.25 } },
      gate_thresholds: { salary_warn_percent: 15, salary_fail_percent: 35, commute_warn_minutes: 45, commute_fail_minutes: 75, availability_warn_days: 60, availability_fail_days: 120, min_skill_match_percent: 30 }
    };

    // 2. Fetch candidate
    const { data: candidate, error: candError } = await supabase
      .from('candidates')
      .select('*')
      .eq('id', candidateId)
      .single();

    if (candError || !candidate) {
      throw new Error('Candidate not found');
    }

    // 3. Fetch job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      throw new Error('Job not found');
    }

    // 4. Fetch skill taxonomy for matching
    const { data: taxonomy } = await supabase
      .from('skill_taxonomy')
      .select('*');

    // 5. Calculate gates
    const gates = calculateGates(candidate, job, config.gate_thresholds);

    // 6. Calculate fit score
    const fitFactors = calculateFitScore(candidate, job, taxonomy || [], config.weights.fit_breakdown);

    // 7. Calculate constraint score
    const constraintFactors = calculateConstraintScore(candidate, job, config.gate_thresholds, config.weights.constraint_breakdown);

    // 8. Calculate overall scores
    const fitScore = Math.round(
      fitFactors.skills.score * config.weights.fit_breakdown.skills +
      fitFactors.experience.score * config.weights.fit_breakdown.experience +
      fitFactors.industry.score * config.weights.fit_breakdown.industry
    );

    const constraintScore = Math.round(
      constraintFactors.salary.score * config.weights.constraint_breakdown.salary +
      constraintFactors.commute.score * config.weights.constraint_breakdown.commute +
      constraintFactors.startDate.score * config.weights.constraint_breakdown.startDate
    );

    let overallMatch = Math.round(
      fitScore * config.weights.fit + constraintScore * config.weights.constraints
    );

    // Gate penalties
    if (gates.overallGate === 'fail') {
      overallMatch = Math.min(overallMatch, 35);
    } else if (gates.overallGate === 'warn') {
      overallMatch = Math.min(overallMatch, 70);
    }

    // 9. Calculate deal probability
    const dealProbability = calculateDealProbability(overallMatch, gates, fitFactors, constraintFactors);

    // 10. Generate explainability
    const explainability = generateExplainability(gates, fitFactors, constraintFactors, candidate, job);

    const result: V3MatchResult = {
      version: 'v3',
      gates,
      fitScore,
      fitFactors,
      constraintScore,
      constraintFactors,
      overallMatch,
      dealProbability,
      explainability
    };

    // 11. Store outcome prediction for calibration
    if (submissionId) {
      await supabase.from('match_outcomes').upsert({
        submission_id: submissionId,
        job_id: jobId,
        candidate_id: candidateId,
        match_version: 'v3',
        predicted_fit_score: fitScore,
        predicted_constraint_score: constraintScore,
        predicted_overall_score: overallMatch,
        predicted_deal_probability: dealProbability,
        gate_results: gates
      }, { onConflict: 'submission_id' });
    }

    // 12. Update submission with v3 score
    if (submissionId) {
      await supabase
        .from('submissions')
        .update({ 
          match_score: overallMatch,
          match_score_v3: result 
        })
        .eq('id', submissionId);
    }

    console.log(`V3 Match: Candidate ${candidateId} + Job ${jobId} = ${overallMatch}% (Deal: ${dealProbability}%)`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in calculate-match-v3:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function calculateGates(candidate: any, job: any, thresholds: any): V3MatchResult['gates'] {
  // Salary gate
  let salaryGate: GateResult = 'pass';
  const candidateSalary = candidate.expected_salary || candidate.salary_expectation_min || 0;
  const jobSalaryMax = job.salary_max || 0;
  
  if (candidateSalary > 0 && jobSalaryMax > 0) {
    const salaryGap = ((candidateSalary - jobSalaryMax) / jobSalaryMax) * 100;
    if (salaryGap > thresholds.salary_fail_percent) {
      salaryGate = 'fail';
    } else if (salaryGap > thresholds.salary_warn_percent) {
      salaryGate = 'warn';
    }
  }

  // Commute gate (simplified - needs actual commute calculation)
  let commuteGate: GateResult = 'pass';
  const maxCommute = candidate.max_commute_minutes || 45;
  const isRemoteJob = job.remote_type === 'remote';
  const candidateRemote = candidate.remote_preference === 'remote' || candidate.work_model === 'remote';
  
  if (!isRemoteJob && !candidateRemote) {
    // Both need office - check commute
    if (maxCommute < thresholds.commute_warn_minutes) {
      commuteGate = 'warn';
    }
    if (maxCommute < 20) {
      commuteGate = 'pass'; // Very short commute preference - likely fine
    }
  }

  // Work authorization gate
  let workAuthGate: GateResult = 'pass';
  if (candidate.visa_required && !job.visa_sponsorship) {
    workAuthGate = 'fail';
  }

  // Availability gate
  let availabilityGate: GateResult = 'pass';
  if (candidate.availability_date) {
    const availDate = new Date(candidate.availability_date);
    const daysUntil = Math.ceil((availDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntil > thresholds.availability_fail_days) {
      availabilityGate = 'fail';
    } else if (daysUntil > thresholds.availability_warn_days) {
      availabilityGate = 'warn';
    }
  }

  // Overall gate
  let overallGate: GateResult = 'pass';
  if (salaryGate === 'fail' || workAuthGate === 'fail' || availabilityGate === 'fail') {
    overallGate = 'fail';
  } else if (salaryGate === 'warn' || commuteGate === 'warn' || availabilityGate === 'warn') {
    overallGate = 'warn';
  }

  return {
    salary: salaryGate,
    commute: commuteGate,
    workAuth: workAuthGate,
    availability: availabilityGate,
    overallGate
  };
}

function calculateFitScore(candidate: any, job: any, taxonomy: any[], breakdown: any): V3MatchResult['fitFactors'] {
  // Skills matching with taxonomy
  const candidateSkills = (candidate.skills || []).map((s: string) => s.toLowerCase());
  const jobSkills = (job.skills || []).map((s: string) => s.toLowerCase());
  const mustHaveSkills = (job.must_have_skills || []).map((s: string) => s.toLowerCase());

  const matched: string[] = [];
  const missing: string[] = [];
  const transferable: string[] = [];

  // Direct matches
  for (const jobSkill of jobSkills) {
    if (candidateSkills.some((cs: string) => cs.includes(jobSkill) || jobSkill.includes(cs))) {
      matched.push(jobSkill);
    } else {
      // Check transferability via taxonomy
      const taxEntry = taxonomy.find(t => t.canonical_name.toLowerCase() === jobSkill);
      if (taxEntry?.transferability_from) {
        const transfers = Object.keys(taxEntry.transferability_from);
        const hasTransferable = candidateSkills.some((cs: string) => 
          transfers.some(t => cs.includes(t.toLowerCase()))
        );
        if (hasTransferable) {
          transferable.push(jobSkill);
        } else {
          missing.push(jobSkill);
        }
      } else {
        missing.push(jobSkill);
      }
    }
  }

  const totalSkills = jobSkills.length || 1;
  const skillScore = Math.round(
    ((matched.length + transferable.length * 0.7) / totalSkills) * 100
  );

  // Experience matching
  const candidateYears = candidate.experience_years || 0;
  const jobMinYears = job.experience_min || 0;
  const jobMaxYears = job.experience_max || 20;

  let experienceScore = 100;
  let levelMatch = true;
  let experienceGap = 0;

  if (candidateYears < jobMinYears) {
    experienceGap = jobMinYears - candidateYears;
    experienceScore = Math.max(0, 100 - experienceGap * 15);
    levelMatch = false;
  } else if (candidateYears > jobMaxYears + 5) {
    experienceScore = 70; // Overqualified penalty
    levelMatch = false;
  }

  // Industry matching
  const candidateIndustries = (candidate.industry_experience || []) as string[];
  const jobIndustry = job.industry || '';
  
  let industryScore = 50; // Base score
  const matchedIndustries: string[] = [];
  
  if (candidateIndustries.some(i => 
    i.toLowerCase().includes(jobIndustry.toLowerCase()) || 
    jobIndustry.toLowerCase().includes(i.toLowerCase())
  )) {
    industryScore = 100;
    matchedIndustries.push(jobIndustry);
  }

  return {
    skills: { score: skillScore, matched, missing, transferable },
    experience: { score: experienceScore, years: candidateYears, levelMatch, gap: experienceGap },
    industry: { score: industryScore, industries: matchedIndustries }
  };
}

function calculateConstraintScore(candidate: any, job: any, thresholds: any, breakdown: any): V3MatchResult['constraintFactors'] {
  // Salary constraint
  const candidateSalary = candidate.expected_salary || candidate.salary_expectation_min || 0;
  const jobSalaryMax = job.salary_max || 0;
  const jobSalaryMin = job.salary_min || 0;
  
  let salaryScore = 100;
  let salaryGap = 0;
  let negotiable = false;

  if (candidateSalary > 0 && jobSalaryMax > 0) {
    if (candidateSalary <= jobSalaryMax) {
      salaryScore = 100;
    } else {
      salaryGap = ((candidateSalary - jobSalaryMax) / jobSalaryMax) * 100;
      salaryScore = Math.max(0, 100 - salaryGap * 2);
      negotiable = salaryGap <= 20;
    }
  }

  // Commute constraint (simplified)
  let commuteScore = 100;
  let commuteMinutes = 0;
  
  const isRemoteJob = job.remote_type === 'remote';
  const candidateRemote = candidate.remote_preference === 'remote';
  
  if (isRemoteJob || candidateRemote) {
    commuteScore = 100;
  } else {
    // Estimate based on max commute preference
    commuteMinutes = candidate.max_commute_minutes || 30;
    if (commuteMinutes > thresholds.commute_fail_minutes) {
      commuteScore = 40;
    } else if (commuteMinutes > thresholds.commute_warn_minutes) {
      commuteScore = 70;
    }
  }

  // Start date constraint
  let startDateScore = 100;
  let daysUntil = 0;
  
  if (candidate.availability_date) {
    const availDate = new Date(candidate.availability_date);
    daysUntil = Math.ceil((availDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil > thresholds.availability_fail_days) {
      startDateScore = 30;
    } else if (daysUntil > thresholds.availability_warn_days) {
      startDateScore = 60;
    } else if (daysUntil <= 14) {
      startDateScore = 100;
    } else {
      startDateScore = Math.max(60, 100 - daysUntil * 0.5);
    }
  }

  return {
    salary: { score: salaryScore, gap: salaryGap, negotiable },
    commute: { score: commuteScore, minutes: commuteMinutes },
    startDate: { score: startDateScore, daysUntil }
  };
}

function calculateDealProbability(overallMatch: number, gates: any, fitFactors: any, constraintFactors: any): number {
  let prob = overallMatch;

  // Gate adjustments
  if (gates.overallGate === 'fail') prob *= 0.3;
  if (gates.overallGate === 'warn') prob *= 0.7;

  // Strong skill match bonus
  if (fitFactors.skills.score >= 80) prob *= 1.1;
  
  // Salary negotiable bonus
  if (constraintFactors.salary.negotiable) prob *= 1.05;

  // Missing must-haves penalty
  if (fitFactors.skills.missing.length > 2) prob *= 0.8;

  return Math.min(95, Math.max(5, Math.round(prob)));
}

function generateExplainability(gates: any, fitFactors: any, constraintFactors: any, candidate: any, job: any): V3MatchResult['explainability'] {
  const topReasons: string[] = [];
  const topRisks: string[] = [];
  let nextAction = 'Profil prüfen';
  let whyNot: string | undefined;

  // Reasons
  if (fitFactors.skills.matched.length > 0) {
    topReasons.push(`${fitFactors.skills.matched.length} Skill-Matches: ${fitFactors.skills.matched.slice(0, 3).join(', ')}`);
  }
  if (fitFactors.experience.levelMatch) {
    topReasons.push(`Erfahrung passt: ${fitFactors.experience.years} Jahre`);
  }
  if (constraintFactors.salary.score >= 80) {
    topReasons.push('Gehaltsvorstellung im Budget');
  }
  if (constraintFactors.startDate.daysUntil <= 30) {
    topReasons.push('Kurzfristig verfügbar');
  }

  // Risks
  if (fitFactors.skills.missing.length > 0) {
    topRisks.push(`Fehlend: ${fitFactors.skills.missing.slice(0, 2).join(', ')}`);
  }
  if (gates.salary === 'warn' || gates.salary === 'fail') {
    topRisks.push(`Gehalt ${constraintFactors.salary.gap.toFixed(0)}% über Budget`);
  }
  if (gates.availability === 'warn') {
    topRisks.push(`Verfügbar erst in ${constraintFactors.startDate.daysUntil} Tagen`);
  }
  if (gates.commute === 'warn') {
    topRisks.push('Pendelstrecke prüfen');
  }

  // Next action
  if (gates.overallGate === 'fail') {
    if (gates.salary === 'fail') {
      nextAction = 'Gehaltsflexibilität klären';
      whyNot = 'Gehaltsvorstellung deutlich über Budget';
    } else if (gates.workAuth === 'fail') {
      nextAction = 'Visum-Sponsoring klären';
      whyNot = 'Visum erforderlich, nicht angeboten';
    } else if (gates.availability === 'fail') {
      nextAction = 'Starttermin besprechen';
      whyNot = 'Verfügbarkeit zu spät';
    }
  } else if (gates.overallGate === 'warn') {
    nextAction = 'Kandidat kontaktieren für Klärung';
  } else {
    nextAction = 'Kandidat zum Interview einladen';
  }

  return {
    topReasons: topReasons.slice(0, 3),
    topRisks: topRisks.slice(0, 2),
    nextAction,
    whyNot
  };
}
