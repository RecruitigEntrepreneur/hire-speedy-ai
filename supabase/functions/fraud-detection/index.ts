import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FraudCheckResult {
  signals: FraudSignal[];
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  auto_action: string | null;
}

interface FraudSignal {
  signal_type: string;
  severity: string;
  confidence_score: number;
  details: Record<string, any>;
  evidence: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { trigger, candidate_id, submission_id, user_id, ip_address } = await req.json();

    let result: FraudCheckResult;

    switch (trigger) {
      case 'candidate_submission':
        result = await checkCandidateSubmission(supabase, candidate_id, submission_id, ip_address);
        break;
      case 'profile_change':
        result = await checkProfileChange(supabase, user_id);
        break;
      case 'suspicious_login':
        result = await checkSuspiciousLogin(supabase, user_id, ip_address);
        break;
      case 'batch_scan':
        result = await batchFraudScan(supabase);
        break;
      default:
        throw new Error('Invalid trigger type');
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Fraud detection error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function checkCandidateSubmission(
  supabase: any,
  candidateId: string,
  submissionId: string,
  ipAddress?: string
): Promise<FraudCheckResult> {
  const signals: FraudSignal[] = [];

  // Get candidate data
  const { data: candidate } = await supabase
    .from('candidates')
    .select('*')
    .eq('id', candidateId)
    .single();

  if (!candidate) {
    throw new Error('Candidate not found');
  }

  // Get submission data
  const { data: submission } = await supabase
    .from('submissions')
    .select('*, jobs:job_id (*)')
    .eq('id', submissionId)
    .single();

  // Check 1: Duplicate candidate (same email or phone)
  const duplicateSignal = await checkDuplicateCandidate(supabase, candidate, candidateId);
  if (duplicateSignal) signals.push(duplicateSignal);

  // Check 2: Velocity abuse (too many submissions in short time)
  const velocitySignal = await checkVelocityAbuse(supabase, candidate.recruiter_id);
  if (velocitySignal) signals.push(velocitySignal);

  // Check 3: Data inconsistency
  const inconsistencySignal = checkDataInconsistency(candidate);
  if (inconsistencySignal) signals.push(inconsistencySignal);

  // Check 4: Circumvention attempts (contact info in notes)
  const circumventionSignal = checkCircumventionAttempts(candidate, submission);
  if (circumventionSignal) signals.push(circumventionSignal);

  // Check 5: IP pattern (same IP for different roles)
  if (ipAddress) {
    const ipSignal = await checkIpPattern(supabase, ipAddress, candidate.recruiter_id);
    if (ipSignal) signals.push(ipSignal);
  }

  // Check 6: Similar CV content
  const cvSimilaritySignal = await checkCvSimilarity(supabase, candidate);
  if (cvSimilaritySignal) signals.push(cvSimilaritySignal);

  // Calculate overall risk level
  const riskLevel = calculateOverallRisk(signals);

  // Determine auto action
  const autoAction = determineAutoAction(riskLevel, signals);

  // Save signals to database
  for (const signal of signals) {
    await supabase.from('fraud_signals').insert({
      signal_type: signal.signal_type,
      severity: signal.severity,
      confidence_score: signal.confidence_score,
      candidate_id: candidateId,
      submission_id: submissionId,
      user_id: candidate.recruiter_id,
      details: signal.details,
      evidence: signal.evidence,
      auto_action_taken: autoAction,
    });
  }

  // Execute auto action
  if (autoAction) {
    await executeAutoAction(supabase, autoAction, submissionId, candidate.recruiter_id);
  }

  return { signals, risk_level: riskLevel, auto_action: autoAction };
}

async function checkDuplicateCandidate(
  supabase: any,
  candidate: any,
  currentId: string
): Promise<FraudSignal | null> {
  // Check for same email
  const { data: emailDuplicates } = await supabase
    .from('candidates')
    .select('id, full_name, recruiter_id')
    .eq('email', candidate.email)
    .neq('id', currentId);

  if (emailDuplicates && emailDuplicates.length > 0) {
    const sameRecruiter = emailDuplicates.some((d: any) => d.recruiter_id === candidate.recruiter_id);
    return {
      signal_type: 'duplicate_candidate',
      severity: sameRecruiter ? 'low' : 'high',
      confidence_score: 95,
      details: { 
        match_field: 'email',
        duplicate_count: emailDuplicates.length,
        same_recruiter: sameRecruiter,
      },
      evidence: [
        `Email ${candidate.email} bereits bei ${emailDuplicates.length} anderen Kandidaten gefunden`,
        sameRecruiter ? 'Gleiches Recruiter-Konto' : 'Verschiedene Recruiter-Konten (verdächtig)',
      ],
    };
  }

  // Check for similar name + phone
  if (candidate.phone) {
    const { data: phoneDuplicates } = await supabase
      .from('candidates')
      .select('id, full_name, email')
      .eq('phone', candidate.phone)
      .neq('id', currentId);

    if (phoneDuplicates && phoneDuplicates.length > 0) {
      return {
        signal_type: 'duplicate_candidate',
        severity: 'medium',
        confidence_score: 85,
        details: { match_field: 'phone', duplicate_count: phoneDuplicates.length },
        evidence: [`Telefonnummer ${candidate.phone} bereits bei anderen Kandidaten gefunden`],
      };
    }
  }

return null;
}

async function checkVelocityAbuse(supabase: any, recruiterId: string): Promise<FraudSignal | null> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Check submissions in last hour
  const { data: hourSubmissions } = await supabase
    .from('submissions')
    .select('id')
    .eq('recruiter_id', recruiterId)
    .gte('submitted_at', oneHourAgo);

  // Check submissions in last day
  const { data: daySubmissions } = await supabase
    .from('submissions')
    .select('id')
    .eq('recruiter_id', recruiterId)
    .gte('submitted_at', oneDayAgo);

  const hourCount = hourSubmissions?.length || 0;
  const dayCount = daySubmissions?.length || 0;

  if (hourCount > 10) {
    return {
      signal_type: 'velocity_abuse',
      severity: 'high',
      confidence_score: 90,
      details: { submissions_per_hour: hourCount, submissions_per_day: dayCount },
      evidence: [`${hourCount} Einreichungen in der letzten Stunde (Limit: 10)`],
    };
  }

  if (dayCount > 50) {
    return {
      signal_type: 'velocity_abuse',
      severity: 'medium',
      confidence_score: 75,
      details: { submissions_per_day: dayCount },
      evidence: [`${dayCount} Einreichungen in den letzten 24 Stunden (Limit: 50)`],
    };
  }

  return null;
}

function checkDataInconsistency(candidate: any): FraudSignal | null {
  const evidence: string[] = [];
  let severity: string = 'low';

  // Check LinkedIn URL matches name
  if (candidate.linkedin_url) {
    const linkedinPath = candidate.linkedin_url.toLowerCase();
    const nameParts = candidate.full_name.toLowerCase().split(' ');
    const nameInLinkedin = nameParts.some((part: string) => 
      part.length > 2 && linkedinPath.includes(part)
    );

    if (!nameInLinkedin) {
      evidence.push('LinkedIn-URL enthält keinen Teil des Namens');
      severity = 'medium';
    }
  }

  // Check email domain matches company if available
  const emailDomain = candidate.email.split('@')[1]?.toLowerCase();
  if (emailDomain && (emailDomain.includes('temp') || emailDomain.includes('disposable'))) {
    evidence.push('Verdächtige E-Mail-Domain (Wegwerf-Adresse)');
    severity = 'high';
  }

  // Check for suspicious patterns in summary
  if (candidate.summary) {
    const suspiciousPatterns = [
      /\b\d{10,}\b/, // Long number sequences (potential phone)
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email in summary
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(candidate.summary)) {
        evidence.push('Kontaktdaten im Freitext gefunden (Umgehungsversuch)');
        severity = 'high';
        break;
      }
    }
  }

  if (evidence.length > 0) {
    return {
      signal_type: 'data_inconsistency',
      severity,
      confidence_score: 70,
      details: { checks_failed: evidence.length },
      evidence,
    };
  }

  return null;
}

function checkCircumventionAttempts(candidate: any, submission: any): FraudSignal | null {
  const evidence: string[] = [];
  const textsToCheck = [
    candidate.summary,
    submission?.recruiter_notes,
  ].filter(Boolean);

  const patterns = [
    { regex: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/, desc: 'Telefonnummer' },
    { regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, desc: 'E-Mail-Adresse' },
    { regex: /kontaktieren?\s*(sie)?\s*(mich)?\s*(direkt|privat)/i, desc: 'Direktkontakt-Aufforderung' },
    { regex: /whatsapp|telegram|signal/i, desc: 'Messenger-Referenz' },
  ];

  for (const text of textsToCheck) {
    for (const { regex, desc } of patterns) {
      if (regex.test(text)) {
        evidence.push(`${desc} im Text gefunden`);
      }
    }
  }

  if (evidence.length > 0) {
    return {
      signal_type: 'circumvention_attempt',
      severity: 'high',
      confidence_score: 85,
      details: { patterns_found: evidence.length },
      evidence,
    };
  }

  return null;
}

async function checkIpPattern(
  supabase: any,
  ipAddress: string,
  recruiterId: string
): Promise<FraudSignal | null> {
  // Check if same IP was used by clients for this job
  const { data: events } = await supabase
    .from('platform_events')
    .select('user_id, user_type')
    .eq('ip_address', ipAddress)
    .neq('user_id', recruiterId)
    .limit(10);

  if (events && events.length > 0) {
    const clientEvents = events.filter((e: any) => e.user_type === 'client');
    if (clientEvents.length > 0) {
      return {
        signal_type: 'suspicious_ip',
        severity: 'critical',
        confidence_score: 95,
        details: { 
          ip_address: ipAddress,
          shared_with_clients: clientEvents.length,
        },
        evidence: [
          `Gleiche IP-Adresse wurde von ${clientEvents.length} Client(s) verwendet`,
          'Möglicher Interessenkonflikt oder Selbst-Einreichung',
        ],
      };
    }
  }

  return null;
}

async function checkCvSimilarity(supabase: any, candidate: any): Promise<FraudSignal | null> {
  if (!candidate.summary || candidate.summary.length < 100) {
    return null;
  }

  // Get recent candidates from other recruiters
  const { data: otherCandidates } = await supabase
    .from('candidates')
    .select('id, summary, full_name')
    .neq('recruiter_id', candidate.recruiter_id)
    .not('summary', 'is', null)
    .limit(50);

  if (!otherCandidates || otherCandidates.length === 0) return null;

  // Simple similarity check (Jaccard similarity on words)
  const candidateWords = new Set(candidate.summary.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4));
  
  for (const other of otherCandidates) {
    if (!other.summary) continue;
    
    const otherWords = new Set(other.summary.toLowerCase().split(/\s+/).filter((w: string) => w.length > 4));
    const intersection = new Set([...candidateWords].filter(x => otherWords.has(x)));
    const union = new Set([...candidateWords, ...otherWords]);
    
    const similarity = intersection.size / union.size;
    
    if (similarity > 0.7) {
      return {
        signal_type: 'cv_similarity',
        severity: 'high',
        confidence_score: Math.round(similarity * 100),
        details: { 
          similar_to_candidate_id: other.id,
          similarity_score: similarity,
        },
        evidence: [
          `CV-Inhalt zu ${Math.round(similarity * 100)}% ähnlich zu Kandidat ${other.full_name}`,
          'Mögliche Dublette oder Copy-Paste',
        ],
      };
    }
  }

  return null;
}

async function checkProfileChange(supabase: any, userId: string): Promise<FraudCheckResult> {
  // Check for suspicious profile changes
  const signals: FraudSignal[] = [];
  
  // Get recent activity
  const { data: recentEvents } = await supabase
    .from('platform_events')
    .select('*')
    .eq('user_id', userId)
    .eq('event_type', 'profile_update')
    .order('created_at', { ascending: false })
    .limit(10);

  if (recentEvents && recentEvents.length > 5) {
    signals.push({
      signal_type: 'suspicious_profile_changes',
      severity: 'medium',
      confidence_score: 70,
      details: { change_count: recentEvents.length },
      evidence: [`${recentEvents.length} Profiländerungen in kurzer Zeit`],
    });
  }

  const riskLevel = calculateOverallRisk(signals);
  return { signals, risk_level: riskLevel, auto_action: null };
}

async function checkSuspiciousLogin(
  supabase: any,
  userId: string,
  ipAddress: string
): Promise<FraudCheckResult> {
  const signals: FraudSignal[] = [];

  // Check for multiple IPs in short time
  const { data: recentLogins } = await supabase
    .from('platform_events')
    .select('ip_address')
    .eq('user_id', userId)
    .eq('event_type', 'login')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (recentLogins) {
    const uniqueIps = new Set(recentLogins.map((l: any) => l.ip_address));
    if (uniqueIps.size > 5) {
      signals.push({
        signal_type: 'suspicious_login',
        severity: 'medium',
        confidence_score: 75,
        details: { unique_ips: uniqueIps.size },
        evidence: [`Login von ${uniqueIps.size} verschiedenen IP-Adressen in 24h`],
      });
    }
  }

  const riskLevel = calculateOverallRisk(signals);
  return { signals, risk_level: riskLevel, auto_action: null };
}

async function batchFraudScan(supabase: any): Promise<FraudCheckResult> {
  // Scan recent submissions
  const { data: recentSubmissions } = await supabase
    .from('submissions')
    .select('id, candidate_id')
    .gte('submitted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  let totalSignals: FraudSignal[] = [];

  for (const sub of recentSubmissions || []) {
    const result = await checkCandidateSubmission(supabase, sub.candidate_id, sub.id);
    totalSignals = [...totalSignals, ...result.signals];
  }

  const riskLevel = calculateOverallRisk(totalSignals);
  return { signals: totalSignals, risk_level: riskLevel, auto_action: null };
}

function calculateOverallRisk(signals: FraudSignal[]): 'low' | 'medium' | 'high' | 'critical' {
  if (signals.length === 0) return 'low';

  const severityScores: Record<string, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };

  const maxSeverity = Math.max(...signals.map(s => severityScores[s.severity] || 0));
  const avgConfidence = signals.reduce((sum, s) => sum + s.confidence_score, 0) / signals.length;

  if (maxSeverity >= 4 || (maxSeverity >= 3 && avgConfidence > 80)) return 'critical';
  if (maxSeverity >= 3 || (maxSeverity >= 2 && signals.length >= 3)) return 'high';
  if (maxSeverity >= 2 || signals.length >= 2) return 'medium';
  return 'low';
}

function determineAutoAction(riskLevel: string, signals: FraudSignal[]): string | null {
  if (riskLevel === 'critical') return 'blocked';
  if (riskLevel === 'high') return 'flagged';
  if (signals.some(s => s.signal_type === 'circumvention_attempt')) return 'warned';
  return null;
}

async function executeAutoAction(
  supabase: any,
  action: string,
  submissionId: string,
  userId: string
): Promise<void> {
  if (action === 'blocked') {
    // Block the submission
    await supabase
      .from('submissions')
      .update({ status: 'blocked', rejection_reason: 'Automatisch blockiert: Betrugsverdacht' })
      .eq('id', submissionId);

    // Notify admins
    const { data: admins } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    for (const admin of admins || []) {
      await supabase.from('notifications').insert({
        user_id: admin.user_id,
        type: 'fraud_alert',
        title: 'Kritischer Betrugsverdacht',
        message: `Einreichung ${submissionId} wurde automatisch blockiert.`,
        related_type: 'submission',
        related_id: submissionId,
      });
    }
  } else if (action === 'flagged') {
    // Flag for review
    await supabase
      .from('submissions')
      .update({ status: 'flagged' })
      .eq('id', submissionId);
  }

  console.log(`Auto action executed: ${action} for submission ${submissionId}`);
}
