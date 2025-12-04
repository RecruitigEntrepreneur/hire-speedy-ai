import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Submission {
  id: string;
  recruiter_id: string;
  candidate_id: string;
  job_id: string;
  status: string;
  stage: string;
  match_score: number | null;
  opt_in_requested_at: string | null;
  opt_in_response: string | null;
  submitted_at: string;
  updated_at: string;
}

interface Candidate {
  id: string;
  full_name: string;
  email: string;
  expected_salary: number | null;
  current_salary: number | null;
}

interface Job {
  id: string;
  title: string;
  company_name: string;
  salary_min: number | null;
  salary_max: number | null;
}

interface Interview {
  id: string;
  submission_id: string;
  scheduled_at: string | null;
  status: string;
  candidate_confirmed: boolean;
}

interface CandidateBehavior {
  id: string;
  submission_id: string;
  confidence_score: number;
  interview_readiness_score: number;
  closing_probability: number;
  engagement_level: string;
  opt_in_response_time_hours: number | null;
  emails_sent: number;
  emails_opened: number;
  links_clicked: number;
  prep_materials_viewed: number;
  last_engagement_at: string | null;
  days_since_engagement: number;
}

interface Alert {
  submission_id: string;
  recruiter_id: string;
  alert_type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  recommended_action: string;
  playbook_id?: string;
  expires_at?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Influence Engine started...');

    // Get all active submissions (not rejected, not placed)
    const { data: submissions, error: submissionsError } = await supabase
      .from('submissions')
      .select('*')
      .not('status', 'in', '("rejected","placed","withdrawn")');

    if (submissionsError) {
      throw new Error(`Failed to fetch submissions: ${submissionsError.message}`);
    }

    if (!submissions || submissions.length === 0) {
      console.log('No active submissions to process');
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${submissions.length} submissions...`);

    let alertsGenerated = 0;
    let behaviorsUpdated = 0;

    // Get playbooks for matching
    const { data: playbooks } = await supabase
      .from('coaching_playbooks')
      .select('id, trigger_type')
      .eq('is_active', true);

    const playbookMap = new Map(playbooks?.map(p => [p.trigger_type, p.id]) || []);

    for (const submission of submissions as Submission[]) {
      try {
        // Fetch related data
        const [candidateResult, jobResult, interviewResult, behaviorResult, dealHealthResult] = await Promise.all([
          supabase.from('candidates').select('*').eq('id', submission.candidate_id).single(),
          supabase.from('jobs').select('*').eq('id', submission.job_id).single(),
          supabase.from('interviews').select('*').eq('submission_id', submission.id).order('created_at', { ascending: false }).limit(1),
          supabase.from('candidate_behavior').select('*').eq('submission_id', submission.id).single(),
          supabase.from('deal_health').select('*').eq('submission_id', submission.id).single(),
        ]);

        const candidate = candidateResult.data as Candidate | null;
        const job = jobResult.data as Job | null;
        const interviews = interviewResult.data as Interview[] | null;
        const interview = interviews?.[0];
        const existingBehavior = behaviorResult.data as CandidateBehavior | null;
        const dealHealth = dealHealthResult.data;

        if (!candidate || !job) continue;

        // Calculate scores
        const scores = calculateScores(submission, candidate, job, interview, existingBehavior, dealHealth);

        // Upsert candidate behavior
        const { error: behaviorError } = await supabase
          .from('candidate_behavior')
          .upsert({
            submission_id: submission.id,
            candidate_id: submission.candidate_id,
            confidence_score: scores.confidence,
            interview_readiness_score: scores.readiness,
            closing_probability: scores.closingProbability,
            engagement_level: scores.engagementLevel,
            opt_in_response_time_hours: scores.optInResponseTime,
            days_since_engagement: scores.daysSinceEngagement,
            last_engagement_at: existingBehavior?.last_engagement_at || submission.updated_at,
            hesitation_signals: scores.hesitationSignals,
            motivation_indicators: scores.motivationIndicators,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'submission_id' });

        if (!behaviorError) behaviorsUpdated++;

        // Generate alerts
        const alerts = generateAlerts(submission, candidate, job, interview, scores, playbookMap);

        // Insert new alerts (avoid duplicates)
        for (const alert of alerts) {
          const { data: existingAlert } = await supabase
            .from('influence_alerts')
            .select('id')
            .eq('submission_id', alert.submission_id)
            .eq('alert_type', alert.alert_type)
            .eq('is_dismissed', false)
            .single();

          if (!existingAlert) {
            const { error: alertError } = await supabase
              .from('influence_alerts')
              .insert(alert);

            if (!alertError) alertsGenerated++;
          }
        }

      } catch (subError) {
        console.error(`Error processing submission ${submission.id}:`, subError);
      }
    }

    // Calculate recruiter influence scores
    await calculateRecruiterInfluenceScores(supabase);

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      submissions_processed: submissions.length,
      behaviors_updated: behaviorsUpdated,
      alerts_generated: alertsGenerated,
    };

    console.log('Influence Engine completed:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Influence Engine error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function calculateScores(
  submission: Submission,
  candidate: Candidate,
  job: Job,
  interview: Interview | undefined,
  existingBehavior: CandidateBehavior | null,
  dealHealth: any
) {
  const now = new Date();
  let confidence = 50;
  let readiness = 50;
  let closingProbability = 50;
  const hesitationSignals: string[] = [];
  const motivationIndicators: string[] = [];

  // Calculate opt-in response time
  let optInResponseTime: number | null = null;
  if (submission.opt_in_requested_at) {
    if (submission.opt_in_response) {
      const requestedAt = new Date(submission.opt_in_requested_at);
      const respondedAt = new Date(submission.updated_at);
      optInResponseTime = (respondedAt.getTime() - requestedAt.getTime()) / (1000 * 60 * 60);
      
      if (optInResponseTime < 24) {
        confidence += 15;
        motivationIndicators.push('Schnelle Opt-In-Reaktion');
      } else if (optInResponseTime < 48) {
        confidence += 5;
      } else {
        confidence -= 10;
        hesitationSignals.push('Verzögerte Opt-In-Reaktion');
      }
    } else {
      // Opt-in requested but not responded
      const requestedAt = new Date(submission.opt_in_requested_at);
      const hoursSince = (now.getTime() - requestedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSince > 48) {
        confidence -= 20;
        hesitationSignals.push('Opt-In ausstehend >48h');
      } else if (hoursSince > 24) {
        confidence -= 10;
        hesitationSignals.push('Opt-In ausstehend >24h');
      }
    }
  }

  // Interview readiness
  if (interview) {
    if (interview.scheduled_at) {
      const interviewDate = new Date(interview.scheduled_at);
      const hoursUntilInterview = (interviewDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (interview.candidate_confirmed) {
        readiness += 20;
        motivationIndicators.push('Interview bestätigt');
      } else if (hoursUntilInterview < 24 && hoursUntilInterview > 0) {
        readiness -= 15;
        hesitationSignals.push('Interview in <24h nicht bestätigt');
      }

      // Prep materials check
      if (existingBehavior) {
        if (existingBehavior.prep_materials_viewed > 0) {
          readiness += 15;
          motivationIndicators.push('Vorbereitungsmaterial angesehen');
        } else if (hoursUntilInterview < 48 && hoursUntilInterview > 0) {
          readiness -= 10;
          hesitationSignals.push('Keine Vorbereitung sichtbar');
        }
      }
    }
  }

  // Salary match analysis
  if (candidate.expected_salary && job.salary_max) {
    const salaryMatch = job.salary_max / candidate.expected_salary;
    if (salaryMatch >= 1) {
      closingProbability += 15;
      motivationIndicators.push('Gehalt im Budget');
    } else if (salaryMatch >= 0.9) {
      closingProbability += 5;
    } else if (salaryMatch < 0.8) {
      closingProbability -= 15;
      hesitationSignals.push('Gehaltserwartung über Budget');
    }
  }

  // Match score impact
  if (submission.match_score) {
    if (submission.match_score >= 80) {
      closingProbability += 15;
      confidence += 10;
    } else if (submission.match_score >= 60) {
      closingProbability += 5;
    } else {
      closingProbability -= 10;
    }
  }

  // Deal health impact
  if (dealHealth) {
    if (dealHealth.health_score >= 80) {
      closingProbability += 10;
    } else if (dealHealth.health_score < 50) {
      closingProbability -= 10;
      hesitationSignals.push('Deal Health kritisch');
    }
  }

  // Engagement level from existing behavior
  let engagementLevel = 'neutral';
  if (existingBehavior) {
    const emailOpenRate = existingBehavior.emails_sent > 0 
      ? existingBehavior.emails_opened / existingBehavior.emails_sent 
      : 0;
    
    if (emailOpenRate > 0.8 && existingBehavior.links_clicked > 2) {
      engagementLevel = 'very_high';
      confidence += 15;
    } else if (emailOpenRate > 0.5) {
      engagementLevel = 'high';
      confidence += 5;
    } else if (emailOpenRate < 0.2 && existingBehavior.emails_sent > 2) {
      engagementLevel = 'low';
      confidence -= 10;
      hesitationSignals.push('Niedrige Email-Öffnungsrate');
    }
  }

  // Days since engagement
  let daysSinceEngagement = 0;
  if (existingBehavior?.last_engagement_at) {
    const lastEngagement = new Date(existingBehavior.last_engagement_at);
    daysSinceEngagement = Math.floor((now.getTime() - lastEngagement.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceEngagement > 5) {
      confidence -= 15;
      hesitationSignals.push(`Keine Aktivität seit ${daysSinceEngagement} Tagen`);
    } else if (daysSinceEngagement > 3) {
      confidence -= 5;
    }
  }

  // Stage-based adjustments
  if (submission.stage === 'interview') {
    readiness += 10;
    closingProbability += 10;
  } else if (submission.stage === 'offer') {
    closingProbability += 20;
    motivationIndicators.push('In Angebotsphase');
  }

  // Clamp scores
  confidence = Math.max(0, Math.min(100, confidence));
  readiness = Math.max(0, Math.min(100, readiness));
  closingProbability = Math.max(0, Math.min(100, closingProbability));

  return {
    confidence,
    readiness,
    closingProbability,
    engagementLevel,
    optInResponseTime,
    daysSinceEngagement,
    hesitationSignals,
    motivationIndicators,
  };
}

function generateAlerts(
  submission: Submission,
  candidate: Candidate,
  job: Job,
  interview: Interview | undefined,
  scores: ReturnType<typeof calculateScores>,
  playbookMap: Map<string, string>
): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date();

  // Opt-In pending alerts
  if (submission.opt_in_requested_at && !submission.opt_in_response) {
    const requestedAt = new Date(submission.opt_in_requested_at);
    const hoursSince = (now.getTime() - requestedAt.getTime()) / (1000 * 60 * 60);

    if (hoursSince > 48) {
      alerts.push({
        submission_id: submission.id,
        recruiter_id: submission.recruiter_id,
        alert_type: 'opt_in_pending_48h',
        priority: 'critical',
        title: `${candidate.full_name}: Opt-In seit 48h ausstehend`,
        message: `Der Kandidat hat die Opt-In-Anfrage seit über 48 Stunden nicht bestätigt. Dringend telefonisch nachfassen!`,
        recommended_action: 'Rufen Sie den Kandidaten jetzt an und klären Sie mögliche Bedenken.',
        playbook_id: playbookMap.get('opt_in_delay'),
        expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      });
    } else if (hoursSince > 24) {
      alerts.push({
        submission_id: submission.id,
        recruiter_id: submission.recruiter_id,
        alert_type: 'opt_in_pending_24h',
        priority: 'high',
        title: `${candidate.full_name}: Opt-In seit 24h ausstehend`,
        message: `Der Kandidat hat noch nicht auf die Opt-In-Anfrage reagiert. Zeit für einen freundlichen Reminder.`,
        recommended_action: 'Senden Sie eine WhatsApp oder Email als Erinnerung.',
        playbook_id: playbookMap.get('opt_in_delay'),
        expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      });
    }
  }

  // Interview preparation alerts
  if (interview?.scheduled_at) {
    const interviewDate = new Date(interview.scheduled_at);
    const hoursUntilInterview = (interviewDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilInterview > 0 && hoursUntilInterview < 48 && scores.readiness < 60) {
      alerts.push({
        submission_id: submission.id,
        recruiter_id: submission.recruiter_id,
        alert_type: 'interview_prep_missing',
        priority: hoursUntilInterview < 24 ? 'critical' : 'high',
        title: `${candidate.full_name}: Interview-Vorbereitung prüfen`,
        message: `Das Interview ist in ${Math.round(hoursUntilInterview)} Stunden, aber der Kandidat scheint nicht vorbereitet zu sein.`,
        recommended_action: 'Kontaktieren Sie den Kandidaten und bieten Sie Vorbereitungsunterstützung an.',
        playbook_id: playbookMap.get('interview_prep'),
        expires_at: interview.scheduled_at,
      });
    }

    // No-show risk alert
    if (hoursUntilInterview > 0 && hoursUntilInterview < 24 && !interview.candidate_confirmed) {
      alerts.push({
        submission_id: submission.id,
        recruiter_id: submission.recruiter_id,
        alert_type: 'interview_reminder',
        priority: 'critical',
        title: `${candidate.full_name}: Interview nicht bestätigt!`,
        message: `Das Interview morgen ist noch nicht vom Kandidaten bestätigt. No-Show-Risiko!`,
        recommended_action: 'Sofort anrufen und Teilnahme bestätigen lassen.',
        playbook_id: playbookMap.get('interview_no_show_risk'),
        expires_at: interview.scheduled_at,
      });
    }
  }

  // Salary mismatch alert
  if (candidate.expected_salary && job.salary_max) {
    const salaryGap = candidate.expected_salary - job.salary_max;
    const gapPercent = (salaryGap / job.salary_max) * 100;

    if (gapPercent > 20) {
      alerts.push({
        submission_id: submission.id,
        recruiter_id: submission.recruiter_id,
        alert_type: 'salary_mismatch',
        priority: 'high',
        title: `${candidate.full_name}: Gehaltserwartung ${Math.round(gapPercent)}% über Budget`,
        message: `Der Kandidat erwartet ${candidate.expected_salary.toLocaleString('de-DE')}€, das Budget liegt bei max. ${job.salary_max.toLocaleString('de-DE')}€.`,
        recommended_action: 'Führen Sie ein Erwartungsmanagement-Gespräch und zeigen Sie Benefits auf.',
        playbook_id: playbookMap.get('salary_expectation_management'),
      });
    }
  }

  // Ghosting risk alert
  if (scores.daysSinceEngagement > 5) {
    alerts.push({
      submission_id: submission.id,
      recruiter_id: submission.recruiter_id,
      alert_type: 'ghosting_risk',
      priority: scores.daysSinceEngagement > 7 ? 'critical' : 'high',
      title: `${candidate.full_name}: Ghosting-Risiko!`,
      message: `Keine Aktivität seit ${scores.daysSinceEngagement} Tagen. Der Kandidat könnte das Interesse verloren haben.`,
      recommended_action: 'Kontaktieren Sie den Kandidaten umgehend und fragen Sie nach dem Status.',
      playbook_id: playbookMap.get('ghosting_prevention'),
    });
  }

  // Engagement drop alert
  if (scores.engagementLevel === 'low' && scores.confidence < 40) {
    alerts.push({
      submission_id: submission.id,
      recruiter_id: submission.recruiter_id,
      alert_type: 'engagement_drop',
      priority: 'medium',
      title: `${candidate.full_name}: Engagement sinkt`,
      message: `Die Engagement-Werte des Kandidaten sind niedrig. Möglicherweise Interesse nachlassend.`,
      recommended_action: 'Proaktiv Kontakt aufnehmen und Bedenken klären.',
      playbook_id: playbookMap.get('engagement_boost'),
    });
  }

  // Closing opportunity alert
  if (scores.closingProbability >= 80 && submission.stage !== 'offer') {
    alerts.push({
      submission_id: submission.id,
      recruiter_id: submission.recruiter_id,
      alert_type: 'closing_opportunity',
      priority: 'medium',
      title: `${candidate.full_name}: Hohe Closing-Chance!`,
      message: `Die Closing-Wahrscheinlichkeit liegt bei ${scores.closingProbability}%. Zeit, den Deal voranzutreiben!`,
      recommended_action: 'Sprechen Sie mit dem Kunden über den nächsten Schritt.',
      playbook_id: playbookMap.get('closing_preparation'),
    });
  }

  return alerts;
}

async function calculateRecruiterInfluenceScores(supabase: any) {
  try {
    // Get all recruiters with submissions
    const { data: recruiters } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'recruiter');

    if (!recruiters) return;

    for (const recruiter of recruiters) {
      const recruiterId = recruiter.user_id;

      // Get recruiter's submissions and behaviors
      const { data: submissions } = await supabase
        .from('submissions')
        .select('id, status')
        .eq('recruiter_id', recruiterId);

      const { data: behaviors } = await supabase
        .from('candidate_behavior')
        .select('opt_in_response_time_hours, confidence_score')
        .in('submission_id', submissions?.map((s: any) => s.id) || []);

      const { data: alerts } = await supabase
        .from('influence_alerts')
        .select('is_dismissed, action_taken')
        .eq('recruiter_id', recruiterId);

      // Calculate metrics
      const avgOptInTime = behaviors?.length 
        ? behaviors.filter((b: any) => b.opt_in_response_time_hours).reduce((sum: number, b: any) => sum + (b.opt_in_response_time_hours || 0), 0) / behaviors.filter((b: any) => b.opt_in_response_time_hours).length
        : 0;

      const alertsActioned = alerts?.filter((a: any) => a.action_taken).length || 0;
      const alertsIgnored = alerts?.filter((a: any) => a.is_dismissed && !a.action_taken).length || 0;

      const placements = submissions?.filter((s: any) => s.status === 'placed').length || 0;

      // Calculate influence score
      let influenceScore = 50;
      
      // Faster opt-in responses = higher score
      if (avgOptInTime > 0) {
        if (avgOptInTime < 24) influenceScore += 15;
        else if (avgOptInTime < 48) influenceScore += 5;
        else influenceScore -= 10;
      }

      // Alert response rate
      const totalAlerts = alertsActioned + alertsIgnored;
      if (totalAlerts > 0) {
        const actionRate = alertsActioned / totalAlerts;
        influenceScore += Math.round(actionRate * 20);
      }

      // Placement bonus
      influenceScore += Math.min(placements * 2, 20);

      influenceScore = Math.max(0, Math.min(100, influenceScore));

      // Upsert influence score
      await supabase
        .from('recruiter_influence_scores')
        .upsert({
          recruiter_id: recruiterId,
          influence_score: influenceScore,
          opt_in_acceleration_rate: avgOptInTime > 0 ? 48 - avgOptInTime : 0,
          alerts_actioned: alertsActioned,
          alerts_ignored: alertsIgnored,
          total_influenced_placements: placements,
          calculated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'recruiter_id' });
    }

    console.log(`Updated influence scores for ${recruiters.length} recruiters`);
  } catch (error) {
    console.error('Error calculating recruiter influence scores:', error);
  }
}
