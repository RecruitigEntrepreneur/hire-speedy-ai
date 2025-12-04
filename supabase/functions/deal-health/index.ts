import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DealHealthResult {
  health_score: number;
  risk_level: string;
  drop_off_probability: number;
  days_since_last_activity: number;
  bottleneck: string | null;
  bottleneck_user_id: string | null;
  bottleneck_days: number;
  ai_assessment: string;
  recommended_actions: string[];
  risk_factors: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { submission_id, calculate_all } = await req.json();

    if (calculate_all) {
      // Calculate health for all active submissions
      const { data: submissions, error: subError } = await supabase
        .from('submissions')
        .select('id')
        .in('status', ['submitted', 'in_review', 'interview', 'shortlisted']);

      if (subError) throw subError;

      const results = [];
      for (const sub of submissions || []) {
        const result = await calculateDealHealth(supabase, sub.id);
        results.push(result);
      }

      return new Response(JSON.stringify({ calculated: results.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!submission_id) {
      throw new Error('submission_id is required');
    }

    const result = await calculateDealHealth(supabase, submission_id);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Deal health error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function calculateDealHealth(supabase: any, submissionId: string): Promise<DealHealthResult> {
  // Fetch submission with related data
  const { data: submission, error: subError } = await supabase
    .from('submissions')
    .select(`
      *,
      jobs:job_id (*),
      candidates:candidate_id (*)
    `)
    .eq('id', submissionId)
    .single();

  if (subError || !submission) {
    throw new Error('Submission not found');
  }

  // Fetch latest platform events for this submission
  const { data: events } = await supabase
    .from('platform_events')
    .select('*')
    .eq('entity_id', submissionId)
    .order('created_at', { ascending: false })
    .limit(20);

  // Fetch SLA deadlines
  const { data: slaDeadlines } = await supabase
    .from('sla_deadlines')
    .select('*')
    .eq('entity_id', submissionId)
    .eq('status', 'active');

  // Fetch behavior scores
  const { data: recruiterScore } = await supabase
    .from('user_behavior_scores')
    .select('*')
    .eq('user_id', submission.recruiter_id)
    .single();

  const { data: clientScore } = await supabase
    .from('user_behavior_scores')
    .select('*')
    .eq('user_id', submission.jobs?.client_id)
    .single();

  // Calculate metrics
  const lastActivityDate = events?.[0]?.created_at || submission.updated_at;
  const daysSinceActivity = Math.floor(
    (Date.now() - new Date(lastActivityDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  const submissionAge = Math.floor(
    (Date.now() - new Date(submission.submitted_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Identify bottleneck
  const bottleneckInfo = identifyBottleneck(submission, slaDeadlines || [], events || []);

  // Calculate scores
  const phaseScore = calculatePhaseScore(submission.stage, submissionAge);
  const slaScore = calculateSlaScore(slaDeadlines || []);
  const behaviorScore = calculateBehaviorScore(recruiterScore, clientScore);
  const activityScore = calculateActivityScore(daysSinceActivity);
  const matchScore = submission.match_score || 50;

  // Weighted health score
  const healthScore = Math.round(
    phaseScore * 0.25 +
    slaScore * 0.25 +
    activityScore * 0.20 +
    behaviorScore * 0.15 +
    matchScore * 0.15
  );

  // Risk level
  const riskLevel = getRiskLevel(healthScore);

  // Drop-off probability based on patterns
  const dropOffProbability = calculateDropOffProbability(healthScore, daysSinceActivity, bottleneckInfo);

  // Generate recommendations
  const { recommendations, riskFactors } = generateRecommendations(
    submission,
    bottleneckInfo,
    daysSinceActivity,
    slaDeadlines || []
  );

  // AI Assessment
  const aiAssessment = generateAssessment(healthScore, riskLevel, bottleneckInfo, riskFactors);

  const result: DealHealthResult = {
    health_score: healthScore,
    risk_level: riskLevel,
    drop_off_probability: dropOffProbability,
    days_since_last_activity: daysSinceActivity,
    bottleneck: bottleneckInfo.bottleneck,
    bottleneck_user_id: bottleneckInfo.userId,
    bottleneck_days: bottleneckInfo.days,
    ai_assessment: aiAssessment,
    recommended_actions: recommendations,
    risk_factors: riskFactors,
  };

  // Upsert to database
  await supabase
    .from('deal_health')
    .upsert({
      submission_id: submissionId,
      ...result,
      calculated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'submission_id' });

  return result;
}

function identifyBottleneck(submission: any, slaDeadlines: any[], events: any[]): {
  bottleneck: string | null;
  userId: string | null;
  days: number;
} {
  // Check for active SLA breaches
  const breachedSla = slaDeadlines.find(d => d.status === 'breached' || new Date(d.deadline_at) < new Date());
  if (breachedSla) {
    return {
      bottleneck: breachedSla.entity_type + '_' + (breachedSla.sla_rule_id || 'unknown'),
      userId: breachedSla.responsible_user_id,
      days: Math.floor((Date.now() - new Date(breachedSla.deadline_at).getTime()) / (1000 * 60 * 60 * 24)),
    };
  }

  // Analyze based on stage
  const stage = submission.stage;
  const stageMap: Record<string, { bottleneck: string; userId: string }> = {
    'submitted': { bottleneck: 'client_review', userId: submission.jobs?.client_id },
    'in_review': { bottleneck: 'client_decision', userId: submission.jobs?.client_id },
    'opt_in_pending': { bottleneck: 'candidate_opt_in', userId: submission.recruiter_id },
    'interview': { bottleneck: 'interview_scheduling', userId: submission.jobs?.client_id },
  };

  if (stageMap[stage]) {
    const daysSinceUpdate = Math.floor(
      (Date.now() - new Date(submission.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceUpdate > 2) {
      return {
        bottleneck: stageMap[stage].bottleneck,
        userId: stageMap[stage].userId,
        days: daysSinceUpdate,
      };
    }
  }

  return { bottleneck: null, userId: null, days: 0 };
}

function calculatePhaseScore(stage: string, age: number): number {
  const expectedDays: Record<string, number> = {
    'submitted': 2,
    'in_review': 5,
    'shortlisted': 7,
    'interview': 14,
    'offer': 7,
  };

  const expected = expectedDays[stage] || 7;
  if (age <= expected) return 100;
  if (age <= expected * 2) return 70;
  if (age <= expected * 3) return 40;
  return 20;
}

function calculateSlaScore(deadlines: any[]): number {
  if (deadlines.length === 0) return 100;
  
  const breached = deadlines.filter(d => d.status === 'breached').length;
  const warning = deadlines.filter(d => d.status === 'warning_sent').length;
  const active = deadlines.length;
  
  return Math.max(0, 100 - (breached * 30) - (warning * 15) - (active * 5));
}

function calculateBehaviorScore(recruiterScore: any, clientScore: any): number {
  const rScore = recruiterScore?.risk_score || 50;
  const cScore = clientScore?.risk_score || 50;
  
  // Lower risk = higher health
  return Math.round(100 - ((rScore + cScore) / 2));
}

function calculateActivityScore(daysSinceActivity: number): number {
  if (daysSinceActivity === 0) return 100;
  if (daysSinceActivity <= 1) return 90;
  if (daysSinceActivity <= 3) return 70;
  if (daysSinceActivity <= 7) return 50;
  if (daysSinceActivity <= 14) return 30;
  return 10;
}

function getRiskLevel(score: number): string {
  if (score >= 80) return 'low';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'high';
  return 'critical';
}

function calculateDropOffProbability(health: number, inactiveDays: number, bottleneck: any): number {
  let probability = 100 - health;
  
  if (inactiveDays > 7) probability += 15;
  if (inactiveDays > 14) probability += 20;
  if (bottleneck.bottleneck) probability += 10;
  if (bottleneck.days > 5) probability += 15;
  
  return Math.min(95, Math.max(5, probability));
}

function generateRecommendations(
  submission: any,
  bottleneck: any,
  inactiveDays: number,
  slaDeadlines: any[]
): { recommendations: string[]; riskFactors: string[] } {
  const recommendations: string[] = [];
  const riskFactors: string[] = [];

  if (inactiveDays > 3) {
    recommendations.push('Kontaktieren Sie den verantwortlichen Ansprechpartner');
    riskFactors.push(`${inactiveDays} Tage ohne Aktivität`);
  }

  if (bottleneck.bottleneck === 'client_review') {
    recommendations.push('Erinnerung an Client senden');
    riskFactors.push('Kandidat wartet auf Client-Review');
  }

  if (bottleneck.bottleneck === 'candidate_opt_in') {
    recommendations.push('Kandidaten-Opt-In nachfassen');
    riskFactors.push('Opt-In ausstehend');
  }

  const breachedSlas = slaDeadlines.filter(d => d.status === 'breached');
  if (breachedSlas.length > 0) {
    recommendations.push('SLA-Breach eskalieren');
    riskFactors.push(`${breachedSlas.length} SLA(s) überschritten`);
  }

  if (!submission.match_score || submission.match_score < 60) {
    riskFactors.push('Niedriger Match-Score');
  }

  if (recommendations.length === 0) {
    recommendations.push('Prozess läuft planmäßig - weiter beobachten');
  }

  return { recommendations, riskFactors };
}

function generateAssessment(
  health: number,
  risk: string,
  bottleneck: any,
  riskFactors: string[]
): string {
  if (risk === 'critical') {
    return `Kritischer Deal-Status (${health}%). ${bottleneck.bottleneck ? `Hauptengpass: ${bottleneck.bottleneck}` : 'Dringend Maßnahmen erforderlich.'}`;
  }
  if (risk === 'high') {
    return `Erhöhtes Risiko (${health}%). ${riskFactors.length > 0 ? riskFactors[0] : 'Aktive Betreuung empfohlen.'}`;
  }
  if (risk === 'medium') {
    return `Deal im Normalbereich (${health}%). Leichte Verzögerungen möglich.`;
  }
  return `Gesunder Deal (${health}%). Alle Prozesse laufen planmäßig.`;
}
