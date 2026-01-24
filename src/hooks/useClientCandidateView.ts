import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  generateAnonymousId, 
  anonymizeRegionBroad, 
  anonymizeExperience, 
  anonymizeSalary,
  getFitLabel,
  getMotivationStatus,
  FitLabel,
  MotivationStatus
} from '@/lib/anonymization';

// ============================================================================
// ZENTRALE DATENREGELN FÜR CLIENT-KANDIDATEN-ANSICHT
// ============================================================================
// Dieses Hook konsolidiert ALLE Kandidatendaten für Clients und wendet
// Triple-Blind Regeln zentral an. Es ist die EINZIGE Quelle für 
// Kandidatendaten in Client-Ansichten.
// ============================================================================

export interface ClientCandidateViewData {
  // Identität
  candidateId: string;
  submissionId: string;
  displayName: string;
  isAnonymized: boolean;
  identityUnlocked: boolean;
  
  // Hard Facts (immer sichtbar, ggf. anonymisiert)
  currentRole: string;
  experience: string;
  experienceYears: number | null;
  seniority: string;
  salaryRange: string;
  availability: string;
  region: string;
  workModel: string;
  
  // Skills (immer sichtbar)
  topSkills: string[];
  
  // Matching (zentral berechnet)
  matchScore: number;
  fitLabel: FitLabel;
  dealProbability: number;
  motivationStatus: MotivationStatus;
  
  // Status
  status: string;
  stage: string;
  
  // Job Context
  jobTitle: string;
  jobId: string;
  jobIndustry: string;
  
  // AI Summary
  executiveSummary: string | null;
  keySellingPoints: string[];
  riskFactors: any[];
  positiveFactors: any[];
  careerGoals: string | null;
  
  // Recruiter Info
  recruiterNotes: string | null;
  
  // Contact (nur wenn entsperrt)
  email: string | null;
  phone: string | null;
  cvUrl: string | null;
  linkedinUrl: string | null;
  
  // Flags für UI
  hasRequiredData: boolean;
  missingFields: string[];
  canBePresented: boolean;
  hasInterview: boolean;
}

interface UseClientCandidateViewResult {
  data: ClientCandidateViewData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Semantische Erklärungen für fehlende Felder mit Kontext
function getSemanticExplanation(
  fieldType: string, 
  context: { hasInterview: boolean; stage: string }
): string {
  const { hasInterview, stage } = context;
  
  const explanations: Record<string, { preInterview: string; postInterview: string }> = {
    salary: {
      preInterview: 'Wird im Interview besprochen',
      postInterview: 'Vom Kandidaten noch nicht freigegeben'
    },
    experience: {
      preInterview: 'CV-Analyse ausstehend',
      postInterview: 'Aus Lebenslauf ermittelt'
    },
    seniority: {
      preInterview: 'Wird basierend auf CV ermittelt',
      postInterview: 'Fachliche Einschätzung verfügbar'
    },
    availability: {
      preInterview: 'Noch nicht besprochen',
      postInterview: 'Im Interview geklärt'
    },
    work_model: {
      preInterview: 'Präferenz noch nicht erfasst',
      postInterview: 'Arbeitsmodell abgestimmt'
    },
    region: {
      preInterview: 'Standort nicht angegeben',
      postInterview: 'Region bestätigt'
    }
  };
  
  const fieldExplanation = explanations[fieldType];
  if (!fieldExplanation) return 'Nicht angegeben';
  
  return hasInterview 
    ? fieldExplanation.postInterview 
    : fieldExplanation.preInterview;
}

// Work Model Label mapping
function getWorkModelLabel(preference: string | null): string {
  if (!preference) return 'Flexibel';
  const labels: Record<string, string> = {
    'remote': 'Full Remote',
    'hybrid': 'Hybrid',
    'onsite': 'Vor Ort',
    'flexible': 'Flexibel'
  };
  return labels[preference.toLowerCase()] || preference;
}

// Format availability from multiple sources
function formatAvailability(
  noticePeriod: string | null, 
  availabilityDate: string | null,
  hasInterview: boolean
): string {
  if (availabilityDate) {
    try {
      const date = new Date(availabilityDate);
      return `Ab ${date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`;
    } catch {
      return availabilityDate;
    }
  }
  if (noticePeriod) {
    return noticePeriod;
  }
  return getSemanticExplanation('availability', { hasInterview, stage: '' });
}

export function useClientCandidateView(submissionId: string | undefined): UseClientCandidateViewResult {
  const [data, setData] = useState<ClientCandidateViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!submissionId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Parallel fetches for all data sources
      const [submissionResult, summaryResult, healthResult] = await Promise.all([
        // 1. Main submission with candidate and job
        supabase
          .from('submissions')
          .select(`
            id,
            status,
            stage,
            match_score,
            identity_unlocked,
            recruiter_notes,
            candidates!inner (
              id,
              full_name,
              email,
              phone,
              job_title,
              city,
              experience_years,
              skills,
              expected_salary,
              salary_expectation_min,
              salary_expectation_max,
              notice_period,
              remote_preference,
              availability_date,
              seniority,
              cv_url,
              linkedin_url
            ),
            jobs!inner (
              id,
              title,
              industry,
              company_name
            )
          `)
          .eq('id', submissionId)
          .single(),
          
        // 2. Client summary for AI-generated content
        supabase
          .from('candidate_client_summary')
          .select('*')
          .eq('submission_id', submissionId)
          .maybeSingle(),
          
        // 3. Deal health for probability
        supabase
          .from('deal_health')
          .select('*')
          .eq('submission_id', submissionId)
          .maybeSingle()
      ]);

      if (submissionResult.error) throw submissionResult.error;
      if (!submissionResult.data) {
        setError('Kandidat nicht gefunden');
        setLoading(false);
        return;
      }

      const submission = submissionResult.data;
      const candidate = submission.candidates as any;
      const job = submission.jobs as any;
      const summary = summaryResult.data;
      const health = healthResult.data;

      // Triple-Blind: Check if identity is unlocked
      const identityUnlocked = submission.identity_unlocked === true;
      
      // Has Interview context for semantic explanations
      const hasInterview = !!summary?.change_motivation_status && 
                          summary.change_motivation_status !== 'unbekannt';
      const stage = submission.stage || submission.status || '';

      // Build missing fields list
      const missingFields: string[] = [];
      if (!candidate.expected_salary && !candidate.salary_expectation_min) {
        missingFields.push('Gehaltsvorstellung');
      }
      if (!candidate.experience_years && candidate.experience_years !== 0) {
        missingFields.push('Berufserfahrung');
      }
      if (!candidate.availability_date && !candidate.notice_period) {
        missingFields.push('Verfügbarkeit');
      }
      if (!candidate.skills || candidate.skills.length === 0) {
        missingFields.push('Skills');
      }

      // Calculate if candidate can be presented
      const hasRequiredData = missingFields.length === 0;
      const canBePresented = hasRequiredData || hasInterview;

      // Build salary range - ALWAYS show as range for privacy
      let salaryRange: string;
      if (candidate.expected_salary) {
        salaryRange = anonymizeSalary(candidate.expected_salary);
      } else if (candidate.salary_expectation_min && candidate.salary_expectation_max) {
        salaryRange = `€${Math.round(candidate.salary_expectation_min / 1000)}k - €${Math.round(candidate.salary_expectation_max / 1000)}k`;
      } else {
        salaryRange = getSemanticExplanation('salary', { hasInterview, stage });
      }

      // Build experience display
      let experience: string;
      if (candidate.experience_years || candidate.experience_years === 0) {
        experience = identityUnlocked 
          ? `${candidate.experience_years} Jahre`
          : anonymizeExperience(candidate.experience_years);
      } else {
        experience = getSemanticExplanation('experience', { hasInterview, stage });
      }

      // Build seniority display
      const seniority = candidate.seniority || 
        summary?.role_archetype || 
        getSemanticExplanation('seniority', { hasInterview, stage });

      // Get fit label based on fit_assessment only (V3.1 provides the numeric score)
      const fitLabel = getFitLabel(
        null, // Score comes from V3.1 Engine, not from summary
        summary?.fit_assessment
      );
      const motivationStatus = getMotivationStatus(summary?.change_motivation_status);

      // Parse key selling points
      let keySellingPoints: string[] = [];
      if (summary?.key_selling_points && Array.isArray(summary.key_selling_points)) {
        keySellingPoints = summary.key_selling_points as string[];
      }

      // Build final view data
      const viewData: ClientCandidateViewData = {
        // Identity
        candidateId: candidate.id,
        submissionId: submission.id,
        displayName: identityUnlocked && candidate.full_name 
          ? candidate.full_name 
          : generateAnonymousId(submission.id),
        isAnonymized: !identityUnlocked,
        identityUnlocked,
        
        // Hard Facts
        currentRole: candidate.job_title || 'Fachkraft',
        experience,
        experienceYears: candidate.experience_years,
        seniority,
        salaryRange,
        availability: formatAvailability(
          candidate.notice_period, 
          candidate.availability_date,
          hasInterview
        ),
        region: identityUnlocked 
          ? (candidate.city || 'Nicht angegeben') 
          : anonymizeRegionBroad(candidate.city),
        workModel: getWorkModelLabel(candidate.remote_preference),
        
        // Skills
        topSkills: candidate.skills || [],
        
        // Matching - V3.1 Engine is the SINGLE SOURCE OF TRUTH
        // matchScore is only used as fallback, V3.1 should always be preferred in UI
        matchScore: submission.match_score || 0, // Legacy fallback, V3.1 takes precedence
        fitLabel,
        dealProbability: summary?.deal_probability || 
          (health?.drop_off_probability ? 100 - health.drop_off_probability : 50),
        motivationStatus,
        
        // Status
        status: submission.status,
        stage: submission.stage || submission.status,
        
        // Job Context
        jobTitle: job.title || 'Position',
        jobId: job.id,
        jobIndustry: job.industry || 'IT',
        
        // AI Summary
        executiveSummary: summary?.executive_summary || null,
        keySellingPoints,
        riskFactors: (summary?.risk_factors as any[]) || [],
        positiveFactors: (summary?.positive_factors as any[]) || [],
        careerGoals: summary?.career_goals || null,
        
        // Recruiter Info
        recruiterNotes: submission.recruiter_notes,
        
        // Contact (nur wenn entsperrt)
        email: identityUnlocked ? candidate.email : null,
        phone: identityUnlocked ? candidate.phone : null,
        cvUrl: identityUnlocked ? candidate.cv_url : null,
        linkedinUrl: identityUnlocked ? candidate.linkedin_url : null,
        
        // Flags
        hasRequiredData,
        missingFields,
        canBePresented,
        hasInterview
      };

      setData(viewData);
    } catch (err) {
      console.error('Error fetching client candidate view:', err);
      setError('Fehler beim Laden der Kandidatendaten');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [submissionId]);

  return { data, loading, error, refetch: fetchData };
}
