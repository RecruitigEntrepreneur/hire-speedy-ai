import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting influence score calculation...');

    // Get all recruiters with submissions
    const { data: recruiters, error: recruitersError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'recruiter');

    if (recruitersError) throw recruitersError;

    console.log(`Processing ${recruiters?.length || 0} recruiters`);

    const results = [];

    for (const recruiter of recruiters || []) {
      try {
        const score = await calculateRecruiterScore(supabase, recruiter.user_id);
        results.push({ recruiter_id: recruiter.user_id, score });
      } catch (err) {
        console.error(`Error calculating score for ${recruiter.user_id}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: results.length,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error calculating influence scores:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function calculateRecruiterScore(supabase: any, recruiterId: string) {
  // Get alert statistics
  const { data: alerts } = await supabase
    .from('influence_alerts')
    .select('id, action_taken, is_dismissed, created_at, action_taken_at')
    .eq('recruiter_id', recruiterId);

  const alertsActioned = alerts?.filter((a: any) => a.action_taken)?.length || 0;
  const alertsIgnored = alerts?.filter((a: any) => a.is_dismissed && !a.action_taken)?.length || 0;
  const totalAlerts = alertsActioned + alertsIgnored;

  // Calculate alert response rate
  const alertResponseRate = totalAlerts > 0 ? (alertsActioned / totalAlerts) * 100 : 50;

  // Get submissions with placements
  const { data: submissions } = await supabase
    .from('submissions')
    .select(`
      id,
      status,
      opt_in_requested_at,
      consent_confirmed_at,
      placements (id)
    `)
    .eq('recruiter_id', recruiterId);

  // Calculate opt-in acceleration
  let optInTimes: number[] = [];
  for (const sub of submissions || []) {
    if (sub.opt_in_requested_at && sub.consent_confirmed_at) {
      const requestTime = new Date(sub.opt_in_requested_at).getTime();
      const confirmTime = new Date(sub.consent_confirmed_at).getTime();
      const hours = (confirmTime - requestTime) / (1000 * 60 * 60);
      optInTimes.push(hours);
    }
  }

  const avgOptInTime = optInTimes.length > 0 
    ? optInTimes.reduce((a, b) => a + b, 0) / optInTimes.length 
    : 48; // Default 48h

  // Platform average (mock - would be calculated from all recruiters)
  const platformAvgOptIn = 36;
  const optInAcceleration = avgOptInTime < platformAvgOptIn 
    ? Math.round((1 - avgOptInTime / platformAvgOptIn) * 100) 
    : -Math.round((avgOptInTime / platformAvgOptIn - 1) * 100);

  // Get placements count
  const placementsCount = submissions?.filter((s: any) => s.placements?.length > 0)?.length || 0;

  // Get interview show rate
  const { data: interviews } = await supabase
    .from('interviews')
    .select(`
      id,
      status,
      no_show_reported,
      submissions!inner (recruiter_id)
    `)
    .eq('submissions.recruiter_id', recruiterId)
    .in('status', ['completed', 'no_show']);

  const totalInterviews = interviews?.length || 0;
  const noShows = interviews?.filter((i: any) => i.no_show_reported)?.length || 0;
  const showRate = totalInterviews > 0 ? ((totalInterviews - noShows) / totalInterviews) * 100 : 100;
  const platformShowRate = 85;
  const showRateImprovement = Math.round(showRate - platformShowRate);

  // Calculate overall influence score
  // Weights: Alert Response (30%), Opt-In Speed (25%), Show Rate (25%), Placements (20%)
  const alertScore = Math.min(100, alertResponseRate);
  const optInScore = Math.min(100, Math.max(0, 50 + optInAcceleration));
  const showScore = Math.min(100, Math.max(0, showRate));
  const placementScore = Math.min(100, placementsCount * 20); // 5 placements = 100

  const influenceScore = Math.round(
    alertScore * 0.3 +
    optInScore * 0.25 +
    showScore * 0.25 +
    placementScore * 0.2
  );

  // Upsert the score
  const scoreData = {
    recruiter_id: recruiterId,
    influence_score: influenceScore,
    opt_in_acceleration_rate: optInAcceleration,
    show_rate_improvement: showRateImprovement,
    alerts_actioned: alertsActioned,
    alerts_ignored: alertsIgnored,
    total_influenced_placements: placementsCount,
    calculated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: upsertError } = await supabase
    .from('recruiter_influence_scores')
    .upsert(scoreData, { onConflict: 'recruiter_id' });

  if (upsertError) {
    console.error('Error upserting score:', upsertError);
    throw upsertError;
  }

  console.log(`Updated influence score for ${recruiterId}: ${influenceScore}`);

  return influenceScore;
}
