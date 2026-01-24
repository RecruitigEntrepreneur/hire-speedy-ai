import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DashboardStats {
  activeJobs: number;
  totalCandidates: number;
  pendingInterviews: number;
  placements: number;
  newCandidatesLast7Days: number;
}

interface UnifiedAction {
  id: string;
  type: 'review_candidate' | 'schedule_interview' | 'give_feedback' | 'make_offer' | 'respond_to_question';
  urgency: 'critical' | 'warning' | 'normal';
  waitingHours: number;
  title: string;
  subtitle: string;
  jobId?: string;
  jobTitle?: string;
  submissionId?: string;
  candidateId?: string;
  candidateAnonymousId?: string;
  interviewId?: string;
  offerId?: string;
  createdAt: string;
}

interface JobStats {
  id: string;
  title: string;
  companyName: string;
  status: string;
  createdAt: string;
  activeRecruiters: number;
  totalCandidates: number;
  newCandidates: number;
  shortlisted: number;
  interviews: number;
  offers: number;
  placed: number;
  topCandidate?: {
    anonymousId: string;
    matchScore: number;
    submissionId: string;
    experienceYears: number;
    availability: string;
  };
}

interface ActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  createdAt: string;
}

interface HealthConfig {
  level: 'excellent' | 'good' | 'warning' | 'critical';
  score: number;
  label: string;
  message: string;
}

interface DashboardResponse {
  stats: DashboardStats;
  actions: UnifiedAction[];
  liveJobs: JobStats[];
  activity: ActivityItem[];
  healthScore: HealthConfig;
}

async function fetchStats(supabase: any, clientId: string): Promise<DashboardStats> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // First, get job IDs for this client (can't use subqueries in .in())
  const { data: clientJobs } = await supabase
    .from('jobs')
    .select('id')
    .eq('client_id', clientId);
  
  const jobIds = (clientJobs || []).map((j: any) => j.id);
  
  // If no jobs, return empty stats
  if (jobIds.length === 0) {
    return {
      activeJobs: 0,
      totalCandidates: 0,
      pendingInterviews: 0,
      placements: 0,
      newCandidatesLast7Days: 0,
    };
  }

  // Get submission IDs for interviews query
  const { data: jobSubmissions } = await supabase
    .from('submissions')
    .select('id')
    .in('job_id', jobIds);
  
  const submissionIds = (jobSubmissions || []).map((s: any) => s.id);

  // Now run parallel queries with actual arrays (guard against empty arrays)
  const [jobsResult, candidatesResult, interviewsResult, placementsResult, newCandidatesResult] = await Promise.all([
    supabase.from('jobs').select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('status', 'published'),
    jobIds.length > 0 
      ? supabase.from('submissions').select('id', { count: 'exact', head: true }).in('job_id', jobIds)
      : Promise.resolve({ count: 0 }),
    submissionIds.length > 0 
      ? supabase.from('interviews').select('id', { count: 'exact', head: true })
          .in('submission_id', submissionIds)
          .in('status', ['pending', 'scheduled'])
      : Promise.resolve({ count: 0 }),
    jobIds.length > 0
      ? supabase.from('submissions').select('id', { count: 'exact', head: true })
          .eq('status', 'hired')
          .in('job_id', jobIds)
      : Promise.resolve({ count: 0 }),
    jobIds.length > 0
      ? supabase.from('submissions').select('id', { count: 'exact', head: true })
          .gte('submitted_at', sevenDaysAgo)
          .in('job_id', jobIds)
      : Promise.resolve({ count: 0 }),
  ]);

  return {
    activeJobs: jobsResult.count || 0,
    totalCandidates: candidatesResult.count || 0,
    pendingInterviews: interviewsResult.count || 0,
    placements: placementsResult.count || 0,
    newCandidatesLast7Days: newCandidatesResult.count || 0,
  };
}

async function fetchPendingActions(supabase: any, clientId: string): Promise<UnifiedAction[]> {
  const actions: UnifiedAction[] = [];
  const now = new Date();

  // 1. Pending candidate decisions
  const { data: pendingSubmissions } = await supabase
    .from('client_submissions_view')
    .select('*')
    .eq('client_id', clientId)
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: true })
    .limit(20);

  if (pendingSubmissions) {
    for (const sub of pendingSubmissions) {
      const submittedAt = new Date(sub.submitted_at);
      const hoursWaiting = Math.floor((now.getTime() - submittedAt.getTime()) / (1000 * 60 * 60));
      
      let urgency: 'critical' | 'warning' | 'normal' = 'normal';
      if (hoursWaiting >= 48) urgency = 'critical';
      else if (hoursWaiting >= 24) urgency = 'warning';

      const anonymousId = `${sub.job_title?.slice(0, 2).toUpperCase() || 'XX'}-${sub.id.slice(0, 6).toUpperCase()}`;

      actions.push({
        id: `review-${sub.id}`,
        type: 'review_candidate',
        urgency,
        waitingHours: hoursWaiting,
        title: `Kandidat prüfen`,
        subtitle: sub.job_title || 'Job',
        jobId: sub.job_id,
        jobTitle: sub.job_title,
        submissionId: sub.id,
        candidateId: sub.candidate_id,
        candidateAnonymousId: anonymousId,
        createdAt: sub.submitted_at,
      });
    }
  }

  // 2. Pending interviews (need scheduling or confirmation)
  const { data: pendingInterviews } = await supabase
    .from('client_interviews_view')
    .select('*')
    .eq('client_id', clientId)
    .or('status.eq.pending,scheduled_at.is.null')
    .limit(10);

  if (pendingInterviews) {
    for (const interview of pendingInterviews) {
      const createdAt = new Date(interview.created_at);
      const hoursWaiting = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
      
      let urgency: 'critical' | 'warning' | 'normal' = 'normal';
      if (hoursWaiting >= 72) urgency = 'critical';
      else if (hoursWaiting >= 48) urgency = 'warning';

      const needsScheduling = !interview.scheduled_at;
      const anonymousId = `${interview.job_title?.slice(0, 2).toUpperCase() || 'XX'}-${interview.submission_id?.slice(0, 6).toUpperCase() || '000000'}`;

      actions.push({
        id: `interview-${interview.id}`,
        type: 'schedule_interview',
        urgency,
        waitingHours: hoursWaiting,
        title: needsScheduling ? 'Interview terminieren' : 'Interview bestätigen',
        subtitle: interview.job_title || 'Job',
        jobId: interview.job_id,
        jobTitle: interview.job_title,
        submissionId: interview.submission_id,
        candidateId: interview.candidate_id,
        candidateAnonymousId: anonymousId,
        interviewId: interview.id,
        createdAt: interview.created_at,
      });
    }
  }

  // 3. Pending offers
  const { data: pendingOffers } = await supabase
    .from('client_offers_view')
    .select('*')
    .eq('client_id', clientId)
    .in('status', ['draft', 'pending'])
    .limit(10);

  if (pendingOffers) {
    for (const offer of pendingOffers) {
      const createdAt = new Date(offer.created_at);
      const hoursWaiting = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
      
      let urgency: 'critical' | 'warning' | 'normal' = 'normal';
      if (hoursWaiting >= 96) urgency = 'critical';
      else if (hoursWaiting >= 72) urgency = 'warning';

      actions.push({
        id: `offer-${offer.id}`,
        type: 'make_offer',
        urgency,
        waitingHours: hoursWaiting,
        title: 'Angebot prüfen',
        subtitle: offer.job_title || 'Job',
        jobId: offer.job_id,
        jobTitle: offer.job_title,
        submissionId: offer.submission_id,
        candidateId: offer.candidate_id,
        offerId: offer.id,
        createdAt: offer.created_at,
      });
    }
  }

  // Sort by urgency, then by waiting hours
  const urgencyOrder = { critical: 0, warning: 1, normal: 2 };
  actions.sort((a, b) => {
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }
    return b.waitingHours - a.waitingHours;
  });

  return actions;
}

async function fetchActiveJobs(supabase: any, clientId: string): Promise<JobStats[]> {
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title, company_name, status, created_at')
    .eq('client_id', clientId)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(5);

  if (!jobs) return [];

  const jobStats: JobStats[] = await Promise.all(
    jobs.map(async (job: any) => {
      const { data: submissions } = await supabase
        .from('submissions')
        .select('id, status, recruiter_id, match_score, candidate_id')
        .eq('job_id', job.id);

      const submissionsList = submissions || [];
      const uniqueRecruiters = new Set(submissionsList.map((s: any) => s.recruiter_id));

      const statusCounts = submissionsList.reduce((acc: Record<string, number>, sub: any) => {
        acc[sub.status] = (acc[sub.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Find top candidate by match score
      let topCandidate = undefined;
      const topSubmission = submissionsList
        .filter((s: any) => s.status === 'submitted' && s.match_score)
        .sort((a: any, b: any) => (b.match_score || 0) - (a.match_score || 0))[0];

      if (topSubmission) {
        const { data: candidate } = await supabase
          .from('candidates')
          .select('experience_years, availability_date, notice_period')
          .eq('id', topSubmission.candidate_id)
          .single();

        topCandidate = {
          anonymousId: `${job.title?.slice(0, 2).toUpperCase() || 'XX'}-${topSubmission.id.slice(0, 6).toUpperCase()}`,
          matchScore: topSubmission.match_score || 0,
          submissionId: topSubmission.id,
          experienceYears: candidate?.experience_years || 0,
          availability: candidate?.notice_period || candidate?.availability_date || 'Unbekannt',
        };
      }

      return {
        id: job.id,
        title: job.title,
        companyName: job.company_name || '',
        status: job.status,
        createdAt: job.created_at,
        activeRecruiters: uniqueRecruiters.size,
        totalCandidates: submissionsList.length,
        newCandidates: statusCounts['submitted'] || 0,
        shortlisted: statusCounts['accepted'] || 0,
        interviews: statusCounts['interview'] || 0,
        offers: statusCounts['offer'] || 0,
        placed: statusCounts['hired'] || 0,
        topCandidate,
      };
    })
  );

  return jobStats;
}

async function fetchRecentActivity(supabase: any, clientId: string): Promise<ActivityItem[]> {
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id')
    .eq('client_id', clientId);

  if (!jobs || jobs.length === 0) return [];

  const jobIds = jobs.map((j: any) => j.id);

  const { data: activities } = await supabase
    .from('activity_logs')
    .select('*')
    .or(`entity_id.in.(${jobIds.join(',')}),user_id.eq.${clientId}`)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!activities) return [];

  return activities.map((a: any) => ({
    id: a.id,
    action: a.action,
    entityType: a.entity_type,
    entityId: a.entity_id,
    details: a.details || {},
    createdAt: a.created_at,
  }));
}

function calculateHealthScore(stats: DashboardStats, actions: UnifiedAction[]): HealthConfig {
  let score = 100;
  
  // Deduct for critical actions
  const criticalCount = actions.filter(a => a.urgency === 'critical').length;
  const warningCount = actions.filter(a => a.urgency === 'warning').length;
  
  score -= criticalCount * 15;
  score -= warningCount * 5;

  // Bonus for activity
  if (stats.newCandidatesLast7Days > 5) score += 10;
  if (stats.pendingInterviews > 0) score += 5;
  if (stats.placements > 0) score += 10;

  // Penalty for no active jobs
  if (stats.activeJobs === 0) score -= 20;

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  if (score >= 85) {
    return {
      level: 'excellent',
      score,
      label: 'Exzellent',
      message: 'Ihr Recruiting läuft optimal. Weiter so!',
    };
  } else if (score >= 65) {
    return {
      level: 'good',
      score,
      label: 'Gut',
      message: 'Alles im grünen Bereich, ein paar Aufgaben warten.',
    };
  } else if (score >= 40) {
    return {
      level: 'warning',
      score,
      label: 'Achtung',
      message: 'Einige Kandidaten warten zu lange. Bitte prüfen.',
    };
  } else {
    return {
      level: 'critical',
      score,
      label: 'Kritisch',
      message: 'Dringender Handlungsbedarf! Kandidaten warten.',
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify JWT and get user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clientId = user.id;

    // Parallel fetching for performance
    const [stats, actions, jobs, activity] = await Promise.all([
      fetchStats(supabase, clientId),
      fetchPendingActions(supabase, clientId),
      fetchActiveJobs(supabase, clientId),
      fetchRecentActivity(supabase, clientId),
    ]);

    const healthScore = calculateHealthScore(stats, actions);

    const response: DashboardResponse = {
      stats,
      actions,
      liveJobs: jobs,
      activity,
      healthScore,
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Dashboard data error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
