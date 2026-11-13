import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  generateAnonymousId,
  getFitLabel,
  getMotivationStatus,
  FitLabel,
  MotivationStatus
} from '@/lib/anonymization';
import i18n from '@/i18n';
import { fmtMonthYear } from '@/lib/localeFormat';
import { experienceBandLabel, regionLabel } from '@/lib/clientCandidateLabels';

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
  
  /** Gespeicherte Kündigungsfrist (z. B. „3_months_eoq“), für Logik statt des Anzeigetexts. */
  noticePeriod: string | null;
  /** Welche Anzeige nur ein Platzhalter ist (blass zeigen, nicht ins PDF). */
  placeholders: { experience: boolean; seniority: boolean; salary: boolean; availability: boolean; region: boolean; workModel: boolean };

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

// Anzeige in der Sprache der Oberfläche (Namespace clientCandidates, „view“). Die Texte werden beim
// Laden geholt; ob ein Feld nur ein Platzhalter ist, steht als Schalter in `placeholders`, damit die
// Seite nicht gegen Texte vergleicht.
const tv = (key: string, options?: Record<string, unknown>) => i18n.t(`clientCandidates:view.${key}`, options ?? {});

type SemanticField = 'salary' | 'experience' | 'seniority' | 'availability' | 'work_model' | 'region';

// Semantische Erklärungen für fehlende Felder mit Kontext. Vor dem Interview (und beim Gehalt immer)
// ist der Text nur ein Platzhalter und wird blass gezeigt.
function getSemanticExplanation(
  fieldType: SemanticField,
  context: { hasInterview: boolean; stage: string }
): { text: string; placeholder: boolean } {
  const { hasInterview } = context;
  return {
    text: tv(`semantic.${fieldType}_${hasInterview ? 'post' : 'pre'}`),
    placeholder: !hasInterview || fieldType === 'salary',
  };
}

// Work Model Label mapping
function getWorkModelLabel(preference: string | null): { text: string; placeholder: boolean } {
  if (!preference) return { text: tv('workModel.flexible'), placeholder: true };
  const key = preference.toLowerCase();
  if (['remote', 'hybrid', 'onsite', 'flexible'].includes(key)) {
    return { text: tv(`workModel.${key}`), placeholder: key === 'flexible' };
  }
  return { text: preference, placeholder: false };
}

// Format availability from multiple sources
function formatAvailability(
  noticePeriod: string | null,
  availabilityDate: string | null,
  hasInterview: boolean
): { text: string; placeholder: boolean } {
  if (availabilityDate) {
    const date = new Date(availabilityDate);
    if (Number.isNaN(date.getTime())) return { text: availabilityDate, placeholder: false };
    return { text: tv('availableFromMonth', { date: fmtMonthYear(date) }), placeholder: false };
  }
  if (noticePeriod) {
    // Rohe DB-Enums nie ungefiltert anzeigen („6_months" → „6 Monate Kündigungsfrist")
    if (noticePeriod === 'immediate' || noticePeriod === 'immediately') return { text: tv('notice.immediate'), placeholder: false };
    if (noticePeriod === '3_months_eoq') return { text: tv('notice.three_months_eoq'), placeholder: false };
    // auch mit Endtermin: „2_months_eom“ → „2 Monate Kündigungsfrist zum Monatsende“
    const monthsMatch = noticePeriod.match(/^(\d+)_(months?|weeks?)(?:_(eom|eoq|eoy))?$/);
    if (monthsMatch) {
      const unit = monthsMatch[2].startsWith('month') ? 'months' : 'weeks';
      const end = monthsMatch[3] ? `_${monthsMatch[3]}` : '';
      return { text: tv(`notice.${unit}${end}`, { count: Number(monthsMatch[1]) }), placeholder: false };
    }
    return { text: noticePeriod, placeholder: false };
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
        setError(tv('notFound'));
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
        missingFields.push(tv('missing.salary'));
      }
      if (!v.experience_band || v.experience_band === 'Nicht angegeben') {
        missingFields.push(tv('missing.experience'));
      }
      if (!v.availability_date && !v.notice_period) {
        missingFields.push(tv('missing.availability'));
      }
      if (!v.skills || v.skills.length === 0) {
        missingFields.push(tv('missing.skills'));
      }

      // Calculate if candidate can be presented
      const hasRequiredData = missingFields.length === 0;
      const canBePresented = hasRequiredData || hasInterview;

      // Salary: the view delivers a privacy-safe band (or 'Nicht freigegeben')
      const salaryOpen = !!v.salary_band && v.salary_band !== 'Nicht freigegeben';
      const salaryRange: string = salaryOpen
        ? v.salary_band
        : getSemanticExplanation('salary', { hasInterview, stage }).text;

      // Experience: exact years only after unlock, otherwise the view's band
      let experience: string;
      let experiencePlaceholder = false;
      if (identityUnlocked && (v.experience_years || v.experience_years === 0)) {
        experience = tv('years', { count: v.experience_years });
      } else if (v.experience_band && v.experience_band !== 'Nicht angegeben') {
        experience = experienceBandLabel(v.experience_band);
      } else {
        const sem = getSemanticExplanation('experience', { hasInterview, stage });
        experience = sem.text;
        experiencePlaceholder = sem.placeholder;
      }

      // Build seniority display
      const senioritySem = getSemanticExplanation('seniority', { hasInterview, stage });
      const seniorityKnown = v.seniority || summary?.role_archetype;
      const seniority = seniorityKnown || senioritySem.text;
      const availability = formatAvailability(v.notice_period, v.availability_date, hasInterview);
      const workModel = getWorkModelLabel(v.remote_preference);
      // region_broad is always present; exact city only after unlock
      const regionRaw = identityUnlocked ? (v.city || v.region_broad || null) : (v.region_broad || 'DACH');

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
        currentRole: v.candidate_role || tv('roleFallback'),
        experience,
        experienceYears: v.experience_years ?? null,
        seniority,
        salaryRange,
        availability: availability.text,
        region: regionRaw ? regionLabel(regionRaw) : tv('notSpecified'),
        workModel: workModel.text,

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
        jobTitle: v.job_title || tv('jobFallback'),
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

        noticePeriod: v.notice_period ?? null,
        placeholders: {
          experience: experiencePlaceholder,
          seniority: !seniorityKnown && senioritySem.placeholder,
          salary: !salaryOpen,
          availability: availability.placeholder,
          region: !regionRaw,
          workModel: workModel.placeholder,
        },

        // Flags
        hasRequiredData,
        missingFields,
        canBePresented,
        hasInterview
      };

      setData(viewData);
    } catch (err) {
      console.error('Error fetching client candidate view:', err);
      setError(tv('loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [submissionId]);

  return { data, loading, error, refetch: fetchData };
}
