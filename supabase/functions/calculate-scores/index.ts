import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, recruiter_id, submission_id } = await req.json();
    console.log(`[calculate-scores] Action: ${action}, ID: ${recruiter_id || submission_id || 'all'}`);

    // NEW: Calculate candidate behavior scores
    if (action === 'calculate_candidate_behavior' && submission_id) {
      const result = await calculateCandidateBehaviorScore(supabase, submission_id);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // NEW: Calculate all candidate behaviors for a job
    if (action === 'calculate_job_candidates' && recruiter_id) {
      // recruiter_id here is actually job_id
      const { data: submissions } = await supabase
        .from('submissions')
        .select('id')
        .eq('job_id', recruiter_id)
        .not('status', 'in', '("rejected","withdrawn")');

      const results = [];
      for (const s of submissions || []) {
        const result = await calculateCandidateBehaviorScore(supabase, s.id);
        results.push(result);
      }

      return new Response(JSON.stringify({ updated: results.length, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'calculate_recruiter' && recruiter_id) {
      const result = await calculateRecruiterScore(supabase, recruiter_id);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'calculate_all_recruiters') {
      const { data: recruiters } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'recruiter');

      const results = [];
      for (const r of recruiters || []) {
        const result = await calculateRecruiterScore(supabase, r.user_id);
        results.push(result);
      }

      return new Response(JSON.stringify({ updated: results.length, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'calculate_client' && recruiter_id) {
      // recruiter_id here is actually client_id
      const result = await calculateClientScore(supabase, recruiter_id);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'calculate_all_clients') {
      const { data: clients } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'client');

      const results = [];
      for (const c of clients || []) {
        const result = await calculateClientScore(supabase, c.user_id);
        results.push(result);
      }

      return new Response(JSON.stringify({ updated: results.length, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[calculate-scores] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function calculateRecruiterScore(supabase: any, recruiterId: string) {
  console.log(`[calculate-scores] Calculating score for recruiter: ${recruiterId}`);

  // Get all submissions by this recruiter
  const { data: submissions } = await supabase
    .from('submissions')
    .select('id, status, submitted_at, job_id')
    .eq('recruiter_id', recruiterId);

  const totalSubmissions = submissions?.length || 0;

  // Get interviews for this recruiter's submissions
  const submissionIds = submissions?.map((s: any) => s.id) || [];
  const { data: interviews } = await supabase
    .from('interviews')
    .select('id, submission_id, status')
    .in('submission_id', submissionIds.length > 0 ? submissionIds : ['none']);

  const totalInterviews = interviews?.length || 0;

  // Get placements
  const { data: placements } = await supabase
    .from('placements')
    .select('id, submission_id')
    .in('submission_id', submissionIds.length > 0 ? submissionIds : ['none']);

  const totalPlacements = placements?.length || 0;

  // Calculate rates
  const interviewRate = totalSubmissions > 0 ? (totalInterviews / totalSubmissions) * 100 : 0;
  const placementRate = totalSubmissions > 0 ? (totalPlacements / totalSubmissions) * 100 : 0;

  // Get average response time from platform_events
  const { data: responseEvents } = await supabase
    .from('platform_events')
    .select('response_time_seconds')
    .eq('user_id', recruiterId)
    .not('response_time_seconds', 'is', null);

  const avgResponseHours = responseEvents?.length > 0
    ? responseEvents.reduce((sum: number, e: any) => sum + (e.response_time_seconds || 0), 0) / responseEvents.length / 3600
    : 0;

  // Calculate quality score (0-100)
  let qualityScore = 50; // Base score
  
  // Bonus for interview rate
  if (interviewRate >= 30) qualityScore += 20;
  else if (interviewRate >= 15) qualityScore += 10;
  
  // Bonus for placement rate
  if (placementRate >= 10) qualityScore += 20;
  else if (placementRate >= 5) qualityScore += 10;
  
  // Bonus for volume
  if (totalSubmissions >= 50) qualityScore += 10;
  else if (totalSubmissions >= 20) qualityScore += 5;

  // Penalty for slow response
  if (avgResponseHours > 48) qualityScore -= 10;
  else if (avgResponseHours > 24) qualityScore -= 5;

  qualityScore = Math.max(0, Math.min(100, qualityScore));

  // Upsert to recruiter_performance
  const { error } = await supabase
    .from('recruiter_performance')
    .upsert({
      recruiter_id: recruiterId,
      total_submissions: totalSubmissions,
      total_interviews: totalInterviews,
      total_placements: totalPlacements,
      interview_rate: interviewRate,
      placement_rate: placementRate,
      avg_response_time_hours: avgResponseHours,
      quality_score: qualityScore,
      calculated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'recruiter_id' });

  if (error) {
    console.error(`[calculate-scores] Error upserting recruiter_performance:`, error);
  }

  console.log(`[calculate-scores] Recruiter ${recruiterId}: Quality=${qualityScore}, Interviews=${totalInterviews}, Placements=${totalPlacements}`);

  return {
    recruiter_id: recruiterId,
    quality_score: qualityScore,
    total_submissions: totalSubmissions,
    total_interviews: totalInterviews,
    total_placements: totalPlacements,
    interview_rate: interviewRate,
    placement_rate: placementRate,
  };
}

async function calculateClientScore(supabase: any, clientId: string) {
  console.log(`[calculate-scores] Calculating score for client: ${clientId}`);

  // Get jobs by this client
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id')
    .eq('client_id', clientId);

  const jobIds = jobs?.map((j: any) => j.id) || [];

  // Get submissions for these jobs
  const { data: submissions } = await supabase
    .from('submissions')
    .select('id, status, submitted_at, updated_at')
    .in('job_id', jobIds.length > 0 ? jobIds : ['none']);

  // Calculate response times (time from submitted to first status change)
  const responseTimes: number[] = [];
  submissions?.forEach((s: any) => {
    if (s.submitted_at && s.updated_at && s.status !== 'submitted') {
      const diff = new Date(s.updated_at).getTime() - new Date(s.submitted_at).getTime();
      responseTimes.push(diff / 3600000); // Convert to hours
    }
  });

  const avgResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0;

  // Calculate ghost rate (submissions with no response after 7 days)
  const now = new Date();
  const ghostedSubmissions = submissions?.filter((s: any) => {
    if (s.status !== 'submitted') return false;
    const submitted = new Date(s.submitted_at);
    const daysSince = (now.getTime() - submitted.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > 7;
  }).length || 0;

  const totalSubmissions = submissions?.length || 0;
  const ghostRate = totalSubmissions > 0 ? (ghostedSubmissions / totalSubmissions) * 100 : 0;

  // Get SLA compliance
  const { data: slaDeadlines } = await supabase
    .from('sla_deadlines')
    .select('status')
    .eq('responsible_user_id', clientId);

  const totalSLAs = slaDeadlines?.length || 0;
  const completedSLAs = slaDeadlines?.filter((s: any) => s.status === 'completed').length || 0;
  const slaComplianceRate = totalSLAs > 0 ? (completedSLAs / totalSLAs) * 100 : 100;

  // Calculate risk score (higher is worse)
  let riskScore = 0;
  if (avgResponseTime > 48) riskScore += 30;
  else if (avgResponseTime > 24) riskScore += 15;
  if (ghostRate > 20) riskScore += 30;
  else if (ghostRate > 10) riskScore += 15;
  if (slaComplianceRate < 80) riskScore += 20;
  else if (slaComplianceRate < 90) riskScore += 10;

  // Determine behavior class
  let behaviorClass = 'neutral';
  if (riskScore >= 50) behaviorClass = 'high_risk';
  else if (riskScore >= 25) behaviorClass = 'medium_risk';
  else if (riskScore <= 10 && totalSubmissions >= 5) behaviorClass = 'reliable';

  // Upsert to user_behavior_scores
  const { error } = await supabase
    .from('user_behavior_scores')
    .upsert({
      user_id: clientId,
      user_type: 'client',
      avg_response_time_hours: avgResponseTime,
      ghost_rate: ghostRate,
      sla_compliance_rate: slaComplianceRate,
      risk_score: riskScore,
      behavior_class: behaviorClass,
      response_count: responseTimes.length,
      calculated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (error) {
    console.error(`[calculate-scores] Error upserting user_behavior_scores:`, error);
  }

  console.log(`[calculate-scores] Client ${clientId}: Risk=${riskScore}, GhostRate=${ghostRate.toFixed(1)}%, SLA=${slaComplianceRate.toFixed(1)}%`);

  return {
    client_id: clientId,
    avg_response_time_hours: avgResponseTime,
    ghost_rate: ghostRate,
    sla_compliance_rate: slaComplianceRate,
    risk_score: riskScore,
    behavior_class: behaviorClass,
  };
}

// NEW: Calculate candidate behavior scores for ranking
async function calculateCandidateBehaviorScore(supabase: any, submissionId: string) {
  console.log(`[calculate-scores] Calculating behavior score for submission: ${submissionId}`);

  // Get existing behavior data
  const { data: behavior } = await supabase
    .from('candidate_behavior')
    .select('*')
    .eq('submission_id', submissionId)
    .maybeSingle();

  // Get submission details
  const { data: submission } = await supabase
    .from('submissions')
    .select('*, candidate:candidates(*)')
    .eq('id', submissionId)
    .single();

  if (!submission) {
    return { error: 'Submission not found' };
  }

  // Get communication logs for this submission
  const { data: commLogs } = await supabase
    .from('communication_log')
    .select('*')
    .eq('submission_id', submissionId);

  // Calculate metrics
  const emailsSent = commLogs?.filter((l: any) => l.channel === 'email').length || 0;
  const emailsOpened = commLogs?.filter((l: any) => l.channel === 'email' && l.read_at).length || 0;
  const linksClicked = commLogs?.reduce((sum: number, l: any) => sum + (l.links_clicked?.length || 0), 0) || 0;

  // Calculate confidence score (0-100)
  // Factors: opt-in response time, email engagement, activity
  let confidenceScore = 50; // Base score

  // Opt-in response time bonus (faster = better)
  const optInTime = behavior?.opt_in_response_time_hours;
  if (optInTime !== null && optInTime !== undefined) {
    if (optInTime < 2) confidenceScore += 20;
    else if (optInTime < 6) confidenceScore += 15;
    else if (optInTime < 24) confidenceScore += 10;
    else if (optInTime < 48) confidenceScore += 5;
    else confidenceScore -= 5;
  }

  // Email engagement bonus
  const openRate = emailsSent > 0 ? (emailsOpened / emailsSent) : 0;
  if (openRate >= 0.8) confidenceScore += 15;
  else if (openRate >= 0.5) confidenceScore += 10;
  else if (openRate >= 0.3) confidenceScore += 5;

  // Link clicks bonus
  if (linksClicked >= 5) confidenceScore += 10;
  else if (linksClicked >= 2) confidenceScore += 5;

  // Prep materials bonus
  const prepViewed = behavior?.prep_materials_viewed || 0;
  if (prepViewed >= 3) confidenceScore += 10;
  else if (prepViewed >= 1) confidenceScore += 5;

  // Company profile viewed bonus
  if (behavior?.company_profile_viewed) confidenceScore += 5;

  // Salary tool used bonus (shows realistic expectations)
  if (behavior?.salary_tool_used) confidenceScore += 5;

  confidenceScore = Math.max(0, Math.min(100, confidenceScore));

  // Calculate interview readiness score (0-100)
  let readinessScore = 50;

  if (prepViewed >= 3) readinessScore += 20;
  else if (prepViewed >= 1) readinessScore += 10;

  if (behavior?.company_profile_viewed) readinessScore += 15;

  // Recent engagement is good
  const daysSinceEngagement = behavior?.days_since_engagement || 999;
  if (daysSinceEngagement <= 1) readinessScore += 15;
  else if (daysSinceEngagement <= 3) readinessScore += 10;
  else if (daysSinceEngagement <= 7) readinessScore += 5;
  else if (daysSinceEngagement > 14) readinessScore -= 10;

  readinessScore = Math.max(0, Math.min(100, readinessScore));

  // Calculate closing probability (0-100)
  let closingProb = 50;

  // High confidence increases closing probability
  closingProb += (confidenceScore - 50) * 0.3;

  // High readiness increases closing probability
  closingProb += (readinessScore - 50) * 0.2;

  // Match score impact
  const matchScore = submission.match_score || 50;
  closingProb += (matchScore - 50) * 0.3;

  // Stage progression bonus
  const status = submission.status;
  if (status === 'offer_extended') closingProb += 15;
  else if (status === 'interview') closingProb += 10;
  else if (status === 'shortlisted') closingProb += 5;

  closingProb = Math.max(0, Math.min(100, Math.round(closingProb)));

  // Determine engagement level
  let engagementLevel = 'neutral';
  const avgScore = (confidenceScore + readinessScore + closingProb) / 3;
  if (avgScore >= 70) engagementLevel = 'high';
  else if (avgScore >= 50) engagementLevel = 'medium';
  else if (avgScore < 40) engagementLevel = 'low';

  // Upsert to candidate_behavior
  const updateData = {
    submission_id: submissionId,
    candidate_id: submission.candidate_id,
    confidence_score: Math.round(confidenceScore),
    interview_readiness_score: Math.round(readinessScore),
    closing_probability: closingProb,
    engagement_level: engagementLevel,
    emails_sent: emailsSent,
    emails_opened: emailsOpened,
    links_clicked: linksClicked,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('candidate_behavior')
    .upsert(updateData, { onConflict: 'submission_id' });

  if (error) {
    console.error(`[calculate-scores] Error upserting candidate_behavior:`, error);
  }

  console.log(`[calculate-scores] Submission ${submissionId}: Confidence=${confidenceScore}, Readiness=${readinessScore}, Closing=${closingProb}`);

  return {
    submission_id: submissionId,
    confidence_score: Math.round(confidenceScore),
    interview_readiness_score: Math.round(readinessScore),
    closing_probability: closingProb,
    engagement_level: engagementLevel,
  };
}
