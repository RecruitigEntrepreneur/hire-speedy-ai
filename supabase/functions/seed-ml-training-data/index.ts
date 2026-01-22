import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Realistic outcome scenarios based on match quality
const OUTCOME_SCENARIOS = [
  // HIRED scenarios (30%) - High match quality leads to success
  { pattern: 'perfect_match', outcome: 'hired', minScore: 85, maxScore: 100, daysToOutcome: [14, 35], probability: 0.85 },
  { pattern: 'strong_match', outcome: 'hired', minScore: 75, maxScore: 89, daysToOutcome: [21, 45], probability: 0.65 },
  { pattern: 'good_cultural_fit', outcome: 'hired', minScore: 70, maxScore: 85, daysToOutcome: [28, 60], probability: 0.55 },
  { pattern: 'skills_trainable', outcome: 'hired', minScore: 65, maxScore: 80, daysToOutcome: [30, 50], probability: 0.45 },
  
  // REJECTED scenarios (50%) - Various mismatch reasons
  { pattern: 'skill_mismatch', outcome: 'rejected', minScore: 40, maxScore: 65, daysToOutcome: [3, 14], probability: 0.90, category: 'skill_mismatch' },
  { pattern: 'experience_gap', outcome: 'rejected', minScore: 45, maxScore: 70, daysToOutcome: [5, 21], probability: 0.80, category: 'experience_mismatch' },
  { pattern: 'salary_mismatch', outcome: 'rejected', minScore: 60, maxScore: 80, daysToOutcome: [7, 28], probability: 0.75, category: 'salary_expectation' },
  { pattern: 'culture_mismatch', outcome: 'rejected', minScore: 55, maxScore: 75, daysToOutcome: [14, 35], probability: 0.70, category: 'culture_fit' },
  { pattern: 'location_issue', outcome: 'rejected', minScore: 50, maxScore: 72, daysToOutcome: [3, 10], probability: 0.85, category: 'location_mismatch' },
  { pattern: 'overqualified', outcome: 'rejected', minScore: 75, maxScore: 90, daysToOutcome: [7, 21], probability: 0.60, category: 'overqualified' },
  { pattern: 'underqualified', outcome: 'rejected', minScore: 35, maxScore: 55, daysToOutcome: [2, 7], probability: 0.95, category: 'experience_mismatch' },
  { pattern: 'poor_interview', outcome: 'rejected', minScore: 60, maxScore: 78, daysToOutcome: [21, 42], probability: 0.65, category: 'interview_performance' },
  
  // WITHDRAWN scenarios (20%) - Candidate-side decisions
  { pattern: 'better_offer', outcome: 'withdrawn', minScore: 70, maxScore: 88, daysToOutcome: [14, 35], probability: 0.50 },
  { pattern: 'slow_process', outcome: 'withdrawn', minScore: 65, maxScore: 85, daysToOutcome: [35, 60], probability: 0.40 },
  { pattern: 'changed_priorities', outcome: 'withdrawn', minScore: 60, maxScore: 80, daysToOutcome: [7, 28], probability: 0.35 },
  { pattern: 'counteroffer_accepted', outcome: 'withdrawn', minScore: 72, maxScore: 90, daysToOutcome: [21, 45], probability: 0.45 },
];

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRealisticSkillsSnapshot(baseSkills: string[], scenario: typeof OUTCOME_SCENARIOS[0]): string[] {
  const skills = [...(baseSkills || [])];
  
  // For skill_mismatch scenarios, reduce skill relevance
  if (scenario.pattern === 'skill_mismatch') {
    return skills.slice(0, Math.max(2, Math.floor(skills.length * 0.4)));
  }
  
  // For perfect matches, keep all skills
  if (scenario.pattern === 'perfect_match' || scenario.pattern === 'strong_match') {
    return skills;
  }
  
  // Default: random subset
  return skills.slice(0, Math.max(3, Math.floor(skills.length * 0.7)));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { count = 200, dryRun = false } = await req.json().catch(() => ({}));

    console.log(`Generating ${count} ML training events (dryRun: ${dryRun})`);

    // Fetch existing candidates and jobs
    const { data: candidates, error: candError } = await supabase
      .from('candidates')
      .select('id, skills, experience_years, seniority, salary_expectation_min, salary_expectation_max, city, recruiter_id')
      .limit(100);

    const { data: jobs, error: jobError } = await supabase
      .from('jobs')
      .select('id, must_haves, nice_to_haves, experience_level, salary_min, salary_max, location, client_id')
      .limit(50);

    if (candError || jobError) {
      throw new Error(`Data fetch error: ${candError?.message || jobError?.message}`);
    }

    if (!candidates?.length || !jobs?.length) {
      throw new Error('No candidates or jobs found for seeding');
    }

    console.log(`Found ${candidates.length} candidates and ${jobs.length} jobs`);

    // Calculate outcome distribution
    const hiredCount = Math.floor(count * 0.30);
    const rejectedCount = Math.floor(count * 0.50);
    const withdrawnCount = count - hiredCount - rejectedCount;

    const events: any[] = [];
    const matchOutcomes: any[] = [];

    // Generate HIRED scenarios
    for (let i = 0; i < hiredCount; i++) {
      const scenario = pickRandom(OUTCOME_SCENARIOS.filter(s => s.outcome === 'hired'));
      const candidate = pickRandom(candidates);
      const job = pickRandom(jobs);
      const matchScore = randomBetween(scenario.minScore, scenario.maxScore);
      const daysToOutcome = randomBetween(scenario.daysToOutcome[0], scenario.daysToOutcome[1]);
      const createdAt = new Date(Date.now() - (daysToOutcome + randomBetween(5, 30)) * 24 * 60 * 60 * 1000);

      events.push({
        event_type: 'status_hired',
        candidate_id: candidate.id,
        job_id: job.id,
        match_score_at_event: matchScore,
        candidate_skills_snapshot: generateRealisticSkillsSnapshot(candidate.skills || [], scenario),
        job_requirements_snapshot: {
          must_haves: job.must_haves || [],
          nice_to_haves: job.nice_to_haves || [],
          experience_level: job.experience_level,
        },
        salary_delta_at_event: candidate.salary_expectation_min && job.salary_max
          ? ((candidate.salary_expectation_min - job.salary_max) / job.salary_max * 100)
          : null,
        final_outcome: 'hired',
        days_to_outcome: daysToOutcome,
        recruiter_id: candidate.recruiter_id,
        created_at: createdAt.toISOString(),
      });

      matchOutcomes.push({
        candidate_id: candidate.id,
        job_id: job.id,
        predicted_score: matchScore,
        actual_outcome: 'hired',
        outcome_stage: 'offer_accepted',
        days_to_outcome: daysToOutcome,
        outcome_recorded_at: new Date().toISOString(),
        created_at: createdAt.toISOString(),
      });
    }

    // Generate REJECTED scenarios
    for (let i = 0; i < rejectedCount; i++) {
      const scenario = pickRandom(OUTCOME_SCENARIOS.filter(s => s.outcome === 'rejected'));
      const candidate = pickRandom(candidates);
      const job = pickRandom(jobs);
      const matchScore = randomBetween(scenario.minScore, scenario.maxScore);
      const daysToOutcome = randomBetween(scenario.daysToOutcome[0], scenario.daysToOutcome[1]);
      const stages = ['cv_review', 'phone_screen', 'technical_interview', 'final_interview'];
      const stage = pickRandom(stages);
      const createdAt = new Date(Date.now() - (daysToOutcome + randomBetween(5, 45)) * 24 * 60 * 60 * 1000);

      events.push({
        event_type: 'status_rejected',
        candidate_id: candidate.id,
        job_id: job.id,
        match_score_at_event: matchScore,
        candidate_skills_snapshot: generateRealisticSkillsSnapshot(candidate.skills || [], scenario),
        job_requirements_snapshot: {
          must_haves: job.must_haves || [],
          nice_to_haves: job.nice_to_haves || [],
          experience_level: job.experience_level,
        },
        salary_delta_at_event: candidate.salary_expectation_min && job.salary_max
          ? ((candidate.salary_expectation_min - job.salary_max) / job.salary_max * 100)
          : null,
        final_outcome: 'rejected',
        days_to_outcome: daysToOutcome,
        rejection_category: scenario.category || 'other',
        recruiter_id: candidate.recruiter_id,
        created_at: createdAt.toISOString(),
      });

      matchOutcomes.push({
        candidate_id: candidate.id,
        job_id: job.id,
        predicted_score: matchScore,
        actual_outcome: 'rejected',
        rejection_category: scenario.category || 'other',
        outcome_stage: stage,
        days_to_outcome: daysToOutcome,
        outcome_recorded_at: new Date().toISOString(),
        created_at: createdAt.toISOString(),
      });
    }

    // Generate WITHDRAWN scenarios
    for (let i = 0; i < withdrawnCount; i++) {
      const scenario = pickRandom(OUTCOME_SCENARIOS.filter(s => s.outcome === 'withdrawn'));
      const candidate = pickRandom(candidates);
      const job = pickRandom(jobs);
      const matchScore = randomBetween(scenario.minScore, scenario.maxScore);
      const daysToOutcome = randomBetween(scenario.daysToOutcome[0], scenario.daysToOutcome[1]);
      const stages = ['cv_review', 'phone_screen', 'technical_interview', 'final_interview', 'offer_stage'];
      const stage = pickRandom(stages);
      const createdAt = new Date(Date.now() - (daysToOutcome + randomBetween(5, 40)) * 24 * 60 * 60 * 1000);

      events.push({
        event_type: 'status_withdrawn',
        candidate_id: candidate.id,
        job_id: job.id,
        match_score_at_event: matchScore,
        candidate_skills_snapshot: generateRealisticSkillsSnapshot(candidate.skills || [], scenario),
        job_requirements_snapshot: {
          must_haves: job.must_haves || [],
          nice_to_haves: job.nice_to_haves || [],
          experience_level: job.experience_level,
        },
        salary_delta_at_event: candidate.salary_expectation_min && job.salary_max
          ? ((candidate.salary_expectation_min - job.salary_max) / job.salary_max * 100)
          : null,
        final_outcome: 'withdrawn',
        days_to_outcome: daysToOutcome,
        recruiter_id: candidate.recruiter_id,
        created_at: createdAt.toISOString(),
      });

      matchOutcomes.push({
        candidate_id: candidate.id,
        job_id: job.id,
        predicted_score: matchScore,
        actual_outcome: 'withdrawn',
        outcome_stage: stage,
        days_to_outcome: daysToOutcome,
        outcome_recorded_at: new Date().toISOString(),
        created_at: createdAt.toISOString(),
      });
    }

    if (dryRun) {
      return new Response(
        JSON.stringify({
          dryRun: true,
          summary: {
            total: events.length,
            hired: hiredCount,
            rejected: rejectedCount,
            withdrawn: withdrawnCount,
          },
          sampleEvents: events.slice(0, 5),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert training events in batches
    const BATCH_SIZE = 50;
    let insertedEvents = 0;
    let insertedOutcomes = 0;

    for (let i = 0; i < events.length; i += BATCH_SIZE) {
      const batch = events.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('ml_training_events')
        .insert(batch);
      
      if (error) {
        console.error('Error inserting events batch:', error);
      } else {
        insertedEvents += batch.length;
      }
    }

    for (let i = 0; i < matchOutcomes.length; i += BATCH_SIZE) {
      const batch = matchOutcomes.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('match_outcomes')
        .insert(batch);
      
      if (error) {
        console.error('Error inserting outcomes batch:', error);
      } else {
        insertedOutcomes += batch.length;
      }
    }

    console.log(`Inserted ${insertedEvents} training events and ${insertedOutcomes} match outcomes`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: events.length,
          hired: hiredCount,
          rejected: rejectedCount,
          withdrawn: withdrawnCount,
          insertedEvents,
          insertedOutcomes,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in seed-ml-training-data:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
