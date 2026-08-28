import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  generateAnonymousId,
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
  
  // Erweiterte Profildaten (NEU - für gruppierte Anzeige)
  certifications: string[];
  languageSkills: { language: string; level: string }[];
  industryExperience: string[];
  targetRoles: string[];
  careerGoals: string | null;
  relocationWilling: boolean | null;
  remoteDaysPreferred: number | null;
  
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
  
  // AI Metadata (EU AI Act)
  modelVersion: string | null;
  generatedAt: string | null;
  
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
    // Rohe DB-Enums nie ungefiltert anzeigen („6_months" → „6 Monate Kündigungsfrist")
    const noticeLabels: Record<string, string> = {
      immediately: 'Sofort verfügbar',
      '2_weeks': '2 Wochen Kündigungsfrist',
      '1_month': '1 Monat Kündigungsfrist',
      '2_months': '2 Monate Kündigungsfrist',
      '3_months': '3 Monate Kündigungsfrist',
      '6_months': '6 Monate Kündigungsfrist',
    };
    if (noticeLabels[noticePeriod]) return noticeLabels[noticePeriod];
    const monthsMatch = noticePeriod.match(/^(\d+)_months?$/);
    if (monthsMatch) return `${monthsMatch[1]} Monate Kündigungsfrist`;
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
      // Triple-Blind: candidate data is read EXCLUSIVELY through the reveal-gated
      // server view client_candidate_view. It returns NULL for PII (name, email,
      // phone, cv, linkedin, city, exact experience) until identity_unlocked, and
      // exposes only pre-anonymized region/experience/salary bands otherwise.
      // No raw PII ever reaches the network before opt-in.
      const [submissionResult, summaryResult, healthResult] = await Promise.all([
        // 1. Reveal-gated candidate view (one row per submission)
        supabase
          .from('client_candidate_view')
          .select('*')
          .eq('submission_id', submissionId)
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

      // Single flat row from the view; PII fields are already gated server-side.
      const v = submissionResult.data as any;
      const summary = summaryResult.data;
      const health = healthResult.data;

      // Triple-Blind: Check if identity is unlocked
      const identityUnlocked = v.identity_unlocked === true;

      // Has Interview context for semantic explanations
      const hasInterview = !!summary?.change_motivation_status &&
                          summary.change_motivation_status !== 'unbekannt';
      const stage = v.stage || v.status || '';

      // Build missing fields list (from the view's pre-anonymized bands)
      const missingFields: string[] = [];
      if (!v.salary_band || v.salary_band === 'Nicht freigegeben') {
        missingFields.push('Gehaltsvorstellung');
      }
      if (!v.experience_band || v.experience_band === 'Nicht angegeben') {
        missingFields.push('Berufserfahrung');
      }
      if (!v.availability_date && !v.notice_period) {
        missingFields.push('Verfügbarkeit');
      }
      if (!v.skills || v.skills.length === 0) {
        missingFields.push('Skills');
      }

      // Calculate if candidate can be presented
      const hasRequiredData = missingFields.length === 0;
      const canBePresented = hasRequiredData || hasInterview;

      // Salary: the view delivers a privacy-safe band (or 'Nicht freigegeben')
      const salaryRange: string =
        v.salary_band && v.salary_band !== 'Nicht freigegeben'
          ? v.salary_band
          : getSemanticExplanation('salary', { hasInterview, stage });

      // Experience: exact years only after unlock, otherwise the view's band
      let experience: string;
      if (identityUnlocked && (v.experience_years || v.experience_years === 0)) {
        experience = `${v.experience_years} Jahre`;
      } else if (v.experience_band && v.experience_band !== 'Nicht angegeben') {
        experience = v.experience_band;
      } else {
        experience = getSemanticExplanation('experience', { hasInterview, stage });
      }

      // Build seniority display
      const seniority = v.seniority ||
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

      // Parse language_skills JSON
      let languageSkills: { language: string; level: string }[] = [];
      if (v.language_skills) {
        try {
          const raw = typeof v.language_skills === 'string'
            ? JSON.parse(v.language_skills)
            : v.language_skills;
          if (Array.isArray(raw)) {
            languageSkills = raw.map((ls: any) => ({
              language: ls.language || ls.name || String(ls),
              level: ls.level || ls.proficiency || ''
            }));
          }
        } catch { /* ignore parse errors */ }
      }

      // Parse industry_experience JSON
      let industryExperience: string[] = [];
      if (v.industry_experience) {
        try {
          const raw = typeof v.industry_experience === 'string'
            ? JSON.parse(v.industry_experience)
            : v.industry_experience;
          if (Array.isArray(raw)) {
            industryExperience = raw.map((ie: any) => typeof ie === 'string' ? ie : (ie.industry || ie.name || String(ie)));
          }
        } catch { /* ignore */ }
      }

      // Parse target_roles JSON
      let targetRoles: string[] = [];
      if (v.target_roles) {
        try {
          const raw = typeof v.target_roles === 'string'
            ? JSON.parse(v.target_roles)
            : v.target_roles;
          if (Array.isArray(raw)) {
            targetRoles = raw.map((tr: any) => typeof tr === 'string' ? tr : (tr.role || tr.title || String(tr)));
          }
        } catch { /* ignore */ }
      }

      // Build final view data
      const viewData: ClientCandidateViewData = {
        // Identity
        candidateId: v.candidate_id,
        submissionId: v.submission_id,
        displayName: identityUnlocked && v.full_name
          ? v.full_name
          : generateAnonymousId(v.submission_id),
        isAnonymized: !identityUnlocked,
        identityUnlocked,

        // Hard Facts
        currentRole: v.candidate_role || 'Fachkraft',
        experience,
        experienceYears: v.experience_years ?? null,
        seniority,
        salaryRange,
        availability: formatAvailability(
          v.notice_period,
          v.availability_date,
          hasInterview
        ),
        // region_broad is always present; exact city only after unlock
        region: identityUnlocked
          ? (v.city || v.region_broad || 'Nicht angegeben')
          : (v.region_broad || 'DACH'),
        workModel: getWorkModelLabel(v.remote_preference),

        // Skills
        topSkills: v.skills || [],

        // Erweiterte Profildaten
        certifications: v.certifications || [],
        languageSkills,
        industryExperience,
        targetRoles,
        careerGoals: summary?.career_goals || null,
        relocationWilling: v.relocation_willing ?? null,
        remoteDaysPreferred: v.remote_days_preferred ?? null,

        // Matching - V3.1 Engine is the SINGLE SOURCE OF TRUTH
        // matchScore is only used as fallback, V3.1 should always be preferred in UI
        matchScore: v.match_score || 0, // Legacy fallback, V3.1 takes precedence
        fitLabel,
        dealProbability: summary?.deal_probability ||
          (health?.drop_off_probability ? 100 - health.drop_off_probability : 50),
        motivationStatus,

        // Status
        status: v.status,
        stage: v.stage || v.status,

        // Job Context
        jobTitle: v.job_title || 'Position',
        jobId: v.job_id,
        jobIndustry: v.job_industry || 'IT',

        // AI Summary
        executiveSummary: summary?.executive_summary || null,
        keySellingPoints,
        riskFactors: (summary?.risk_factors as any[]) || [],
        positiveFactors: (summary?.positive_factors as any[]) || [],

        // AI Metadata (EU AI Act)
        modelVersion: summary?.model_version || null,
        generatedAt: summary?.generated_at || null,

        // Recruiter Info
        recruiterNotes: v.recruiter_notes,

        // Contact — the view already returns NULL until identity_unlocked
        email: v.email ?? null,
        phone: v.phone ?? null,
        cvUrl: v.cv_url ?? null,
        linkedinUrl: v.linkedin_url ?? null,

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
