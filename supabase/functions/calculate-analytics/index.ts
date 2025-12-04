import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FunnelMetrics {
  total_submissions: number;
  submissions_to_opt_in: number;
  opt_in_to_interview: number;
  interview_to_offer: number;
  offer_to_placement: number;
  opt_in_rate: number;
  interview_rate: number;
  offer_rate: number;
  acceptance_rate: number;
  avg_time_to_opt_in_hours: number;
  avg_time_to_interview_days: number;
  avg_time_to_offer_days: number;
  avg_time_to_fill_days: number;
  avg_match_score: number;
  avg_candidate_score: number;
  drop_offs_by_stage: Record<string, number>;
  drop_off_reasons: Record<string, number>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, entity_type, entity_id, period_days = 30 } = await req.json();

    console.log(`Calculate analytics - Action: ${action}, Entity: ${entity_type}/${entity_id}, Period: ${period_days} days`);

    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - period_days);
    const periodEnd = new Date();

    switch (action) {
      case 'calculate_funnel':
        return await calculateFunnelMetrics(supabase, entity_type, entity_id, periodStart, periodEnd);
      case 'calculate_leaderboard':
        return await calculateLeaderboard(supabase, period_days);
      case 'calculate_all':
        return await calculateAllMetrics(supabase, periodStart, periodEnd);
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Analytics calculation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function calculateFunnelMetrics(
  supabase: any,
  entityType: string,
  entityId: string | null,
  periodStart: Date,
  periodEnd: Date
) {
  console.log(`Calculating funnel metrics for ${entityType}/${entityId || 'all'}`);

  // Build query based on entity type
  let submissionsQuery = supabase
    .from('submissions')
    .select(`
      id,
      status,
      match_score,
      created_at,
      opted_in_at,
      job_id,
      recruiter_id,
      jobs!inner(client_id)
    `)
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString());

  if (entityType === 'job' && entityId) {
    submissionsQuery = submissionsQuery.eq('job_id', entityId);
  } else if (entityType === 'recruiter' && entityId) {
    submissionsQuery = submissionsQuery.eq('recruiter_id', entityId);
  } else if (entityType === 'client' && entityId) {
    submissionsQuery = submissionsQuery.eq('jobs.client_id', entityId);
  }

  const { data: submissions, error: submissionsError } = await submissionsQuery;

  if (submissionsError) {
    console.error('Error fetching submissions:', submissionsError);
    throw submissionsError;
  }

  // Get interviews for the period
  const submissionIds = submissions?.map((s: any) => s.id) || [];
  
  let interviews: any[] = [];
  let offers: any[] = [];
  let placements: any[] = [];

  if (submissionIds.length > 0) {
    const { data: interviewsData } = await supabase
      .from('interviews')
      .select('id, submission_id, scheduled_at, status, created_at')
      .in('submission_id', submissionIds);
    interviews = interviewsData || [];

    const { data: offersData } = await supabase
      .from('offers')
      .select('id, submission_id, status, created_at, decision_at')
      .in('submission_id', submissionIds);
    offers = offersData || [];

    const { data: placementsData } = await supabase
      .from('placements')
      .select('id, submission_id, created_at, start_date')
      .in('submission_id', submissionIds);
    placements = placementsData || [];
  }

  // Calculate metrics
  const totalSubmissions = submissions?.length || 0;
  const optedIn = submissions?.filter((s: any) => s.opted_in_at).length || 0;
  const interviewed = interviews.filter((i: any) => i.status === 'completed').length;
  const offered = offers.length;
  const placed = placements.length;

  // Calculate conversion rates
  const optInRate = totalSubmissions > 0 ? (optedIn / totalSubmissions) * 100 : 0;
  const interviewRate = optedIn > 0 ? (interviewed / optedIn) * 100 : 0;
  const offerRate = interviewed > 0 ? (offered / interviewed) * 100 : 0;
  const acceptanceRate = offered > 0 ? (placed / offered) * 100 : 0;

  // Calculate time metrics
  let totalOptInTime = 0;
  let optInCount = 0;
  submissions?.forEach((s: any) => {
    if (s.opted_in_at) {
      const created = new Date(s.created_at);
      const optedInAt = new Date(s.opted_in_at);
      totalOptInTime += (optedInAt.getTime() - created.getTime()) / (1000 * 60 * 60);
      optInCount++;
    }
  });
  const avgTimeToOptIn = optInCount > 0 ? totalOptInTime / optInCount : 0;

  // Calculate average match score
  const totalMatchScore = submissions?.reduce((sum: number, s: any) => sum + (s.match_score || 0), 0) || 0;
  const avgMatchScore = totalSubmissions > 0 ? totalMatchScore / totalSubmissions : 0;

  // Drop-off analysis
  const dropOffsByStage: Record<string, number> = {
    screening: submissions?.filter((s: any) => s.status === 'rejected' && !s.opted_in_at).length || 0,
    opt_in: submissions?.filter((s: any) => s.status === 'rejected' && s.opted_in_at).length || 0,
    interview: interviews.filter((i: any) => i.status === 'cancelled').length,
    offer: offers.filter((o: any) => o.status === 'rejected').length,
  };

  // Get rejection reasons
  const { data: rejections } = await supabase
    .from('rejections')
    .select('reason_category')
    .in('submission_id', submissionIds);

  const dropOffReasons: Record<string, number> = {};
  rejections?.forEach((r: any) => {
    const reason = r.reason_category || 'unknown';
    dropOffReasons[reason] = (dropOffReasons[reason] || 0) + 1;
  });

  const metrics: FunnelMetrics = {
    total_submissions: totalSubmissions,
    submissions_to_opt_in: optedIn,
    opt_in_to_interview: interviewed,
    interview_to_offer: offered,
    offer_to_placement: placed,
    opt_in_rate: Math.round(optInRate * 100) / 100,
    interview_rate: Math.round(interviewRate * 100) / 100,
    offer_rate: Math.round(offerRate * 100) / 100,
    acceptance_rate: Math.round(acceptanceRate * 100) / 100,
    avg_time_to_opt_in_hours: Math.round(avgTimeToOptIn * 100) / 100,
    avg_time_to_interview_days: 0, // TODO: Calculate from interview data
    avg_time_to_offer_days: 0, // TODO: Calculate from offer data
    avg_time_to_fill_days: 0, // TODO: Calculate from placement data
    avg_match_score: Math.round(avgMatchScore * 100) / 100,
    avg_candidate_score: 0, // TODO: Calculate from candidate behavior
    drop_offs_by_stage: dropOffsByStage,
    drop_off_reasons: dropOffReasons,
  };

  // Upsert metrics
  const { error: upsertError } = await supabase
    .from('funnel_metrics')
    .upsert({
      entity_type: entityType,
      entity_id: entityId,
      period_start: periodStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
      ...metrics,
      calculated_at: new Date().toISOString(),
    }, {
      onConflict: 'entity_type,entity_id,period_start,period_end',
      ignoreDuplicates: false,
    });

  if (upsertError) {
    // If upsert fails due to no unique constraint, just insert
    await supabase.from('funnel_metrics').insert({
      entity_type: entityType,
      entity_id: entityId,
      period_start: periodStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
      ...metrics,
      calculated_at: new Date().toISOString(),
    });
  }

  console.log('Funnel metrics calculated:', metrics);

  return new Response(
    JSON.stringify({ success: true, metrics }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function calculateLeaderboard(supabase: any, periodDays: number) {
  console.log(`Calculating recruiter leaderboard for last ${periodDays} days`);

  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - periodDays);

  // Determine period type
  let period = 'monthly';
  if (periodDays <= 7) period = 'weekly';
  else if (periodDays <= 30) period = 'monthly';
  else if (periodDays <= 90) period = 'quarterly';
  else period = 'yearly';

  // Get all recruiters with submissions in period
  const { data: submissions } = await supabase
    .from('submissions')
    .select(`
      id,
      recruiter_id,
      match_score,
      created_at
    `)
    .gte('created_at', periodStart.toISOString());

  // Get placements
  const { data: placements } = await supabase
    .from('placements')
    .select(`
      id,
      submission_id,
      recruiter_payout,
      submissions!inner(recruiter_id)
    `)
    .gte('created_at', periodStart.toISOString());

  // Aggregate by recruiter
  const recruiterStats: Record<string, any> = {};

  submissions?.forEach((s: any) => {
    if (!recruiterStats[s.recruiter_id]) {
      recruiterStats[s.recruiter_id] = {
        submissions: 0,
        placements: 0,
        total_revenue: 0,
        total_score: 0,
      };
    }
    recruiterStats[s.recruiter_id].submissions++;
    recruiterStats[s.recruiter_id].total_score += s.match_score || 0;
  });

  placements?.forEach((p: any) => {
    const recruiterId = p.submissions?.recruiter_id;
    if (recruiterId && recruiterStats[recruiterId]) {
      recruiterStats[recruiterId].placements++;
      recruiterStats[recruiterId].total_revenue += p.recruiter_payout || 0;
    }
  });

  // Calculate rankings
  const leaderboardEntries = Object.entries(recruiterStats)
    .map(([recruiterId, stats]: [string, any]) => ({
      recruiter_id: recruiterId,
      period,
      period_start: periodStart.toISOString().split('T')[0],
      submissions: stats.submissions,
      placements: stats.placements,
      conversion_rate: stats.submissions > 0 ? (stats.placements / stats.submissions) * 100 : 0,
      avg_candidate_score: stats.submissions > 0 ? stats.total_score / stats.submissions : 0,
      total_revenue: stats.total_revenue,
      avg_time_to_fill: 0,
      calculated_at: new Date().toISOString(),
    }))
    .sort((a, b) => b.placements - a.placements || b.conversion_rate - a.conversion_rate);

  // Assign ranks
  leaderboardEntries.forEach((entry, index) => {
    (entry as any).rank_position = index + 1;
    (entry as any).rank_change = 0; // TODO: Compare with previous period
  });

  // Insert leaderboard entries
  if (leaderboardEntries.length > 0) {
    const { error } = await supabase
      .from('recruiter_leaderboard')
      .insert(leaderboardEntries);

    if (error) {
      console.error('Error inserting leaderboard:', error);
    }
  }

  console.log(`Leaderboard calculated with ${leaderboardEntries.length} entries`);

  return new Response(
    JSON.stringify({ success: true, leaderboard: leaderboardEntries }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function calculateAllMetrics(supabase: any, periodStart: Date, periodEnd: Date) {
  console.log('Calculating all platform metrics');

  // Calculate platform-wide funnel
  await calculateFunnelMetrics(supabase, 'platform', null, periodStart, periodEnd);

  // Get all active clients and calculate their funnels
  const { data: clients } = await supabase
    .from('jobs')
    .select('client_id')
    .eq('status', 'published');

  const uniqueClients = [...new Set(clients?.map((c: any) => c.client_id) || [])];
  
  for (const clientId of uniqueClients) {
    await calculateFunnelMetrics(supabase, 'client', clientId as string, periodStart, periodEnd);
  }

  // Get all recruiters with submissions
  const { data: recruiters } = await supabase
    .from('submissions')
    .select('recruiter_id')
    .gte('created_at', periodStart.toISOString());

  const uniqueRecruiters = [...new Set(recruiters?.map((r: any) => r.recruiter_id) || [])];

  for (const recruiterId of uniqueRecruiters) {
    await calculateFunnelMetrics(supabase, 'recruiter', recruiterId as string, periodStart, periodEnd);
  }

  // Calculate leaderboard
  const periodDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
  await calculateLeaderboard(supabase, periodDays);

  return new Response(
    JSON.stringify({ 
      success: true, 
      message: `Calculated metrics for ${uniqueClients.length} clients and ${uniqueRecruiters.length} recruiters` 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
