import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useClientVerification } from '@/hooks/useClientVerification';
import { useJobParsing, ParsedJobData } from '@/hooks/useJobParsing';
import { useJobPdfParsing } from '@/hooks/useJobPdfParsing';
import { useJobEnrichment } from '@/hooks/useJobEnrichment';
import { ExtractedIntakeData } from '@/hooks/useIntakeBriefing';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────

export type EngagementModel = 'permanent' | 'freelance' | 'temp_staffing';

export type WizardStep = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface JobWizardFormData {
  // Step 0: Track
  engagement_model: EngagementModel | null;
  headcount: number;

  // Step 2: Basic Info
  title: string;
  company_name: string;
  description: string;
  requirements: string;
  experience_level: string;
  location: string;
  remote_policy: string;
  onsite_days_required: number;
  office_address: string;
  industry: string;
  company_size_band: string;
  funding_stage: string;
  tech_environment: string[];
  travel_required: string;
  task_focus: string;

  // Step 3: Compensation – Permanent
  employment_type: string;
  contract_type: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_negotiable: boolean;
  benefits: string[];
  equity_options: boolean;
  start_date: string;
  start_date_flexibility: string;
  probation_months: number | null;

  // Step 3: Compensation – Freelance
  compensation_model: string;
  rate_min: number | null;
  rate_max: number | null;
  rate_currency: string;
  project_duration: string;
  project_scope: string;
  project_budget_total: number | null;
  deliverables: string[];
  extension_possible: boolean | null;

  // Step 3: Compensation – ANÜ
  rate_includes_margin: boolean;
  assignment_duration: string;
  takeover_option: string;
  equal_pay_applicable: boolean | null;
  equal_pay_start: string;
  shift_model: string;
  collective_agreement: string;
  industry_surcharges: boolean;
  existing_framework_contract: boolean | null;
  works_council_status: string;

  // Step 4: Requirements
  skills: string[];
  must_haves: string[];
  nice_to_haves: string[];
  exclusion_criteria: string[];
  required_languages: { language: string; level: string }[];
  experience_years_min: number | null;
  industry_experience_required: boolean;
  required_certifications: string[];
  security_clearance_required: boolean;
  background_check_required: boolean;
  drivers_license_required: string;

  // Step 5: Context
  vacancy_reason: string;
  hiring_urgency: string;
  decision_makers_count: number | null;
  candidates_in_pipeline: number | null;
  team_size: number | null;
  remote_days: number | null;
  interview_stages: number | null;
  interview_process: string;
  success_profile: string;
  failure_profile: string;
  trainable_skills: string[];
  team_integration: string;
  project_context: string;
  company_culture: string;
  career_path: string;

  // Intake briefing data
  intake_briefing: string;
  intake_completeness: number;

  // Company profile link
  company_profile_id: string | null;
}

export interface StepConfig {
  id: number;
  key: string;
  title: string;
  group: 'setup' | 'details' | 'finish';
  groupLabel: string;
  optional?: boolean;
  coachingTip?: string;
}

// ─── Track-dependent step configurations ────────────────────────

type EngagementTrack = 'permanent' | 'freelance' | 'temp_staffing';

const TRACK_STEP_OVERRIDES: Record<EngagementTrack, {
  groupLabels: { setup: string; details: string; finish: string };
  steps: Record<number, { title: string; coachingTip?: string }>;
}> = {
  permanent: {
    groupLabels: { setup: 'SETUP', details: 'DETAILS', finish: 'ABSCHLUSS' },
    steps: {
      2: { title: 'Basisdaten', coachingTip: 'Jobtitel + Standort sind die Top-2-Filter bei Kandidaten.' },
      3: { title: 'Gehalt & Benefits', coachingTip: 'Benefits sind das Argument Nr.1 bei Kandidaten. Mind. 5 auswählen!' },
      4: { title: 'Skills & Anforderungen', coachingTip: 'Must-Haves beeinflussen den Fit-Score zu 30%. Weniger ist mehr — max. 5 Must-Haves.' },
      5: { title: 'Interview & Kontext', coachingTip: 'Ein klarer Interview-Prozess verkürzt die Time-to-Hire um 40%.' },
      6: { title: 'Review', coachingTip: 'Ab 70% Score werden 3× mehr passende Kandidaten gematcht.' },
    },
  },
  freelance: {
    groupLabels: { setup: 'SETUP', details: 'PROJEKT', finish: 'ABSCHLUSS' },
    steps: {
      2: { title: 'Basisdaten', coachingTip: 'Projektname + Tech-Stack sind die Hauptfilter für Freelancer.' },
      3: { title: 'Konditionen', coachingTip: 'Stundensätze transparent angeben — 73% der Freelancer skippen ohne Rate-Range.' },
      4: { title: 'Tech & Anforderungen', coachingTip: 'Freelancer filtern primär nach Tech-Stack. Spezifisch sein!' },
      5: { title: 'Projektkontext', coachingTip: 'Projektdauer und Verlängerungsoption sind entscheidend für Top-Freelancer.' },
      6: { title: 'Review', coachingTip: 'Freelancer-Projekte mit vollständigem Profil erhalten 2× mehr Bewerbungen.' },
    },
  },
  temp_staffing: {
    groupLabels: { setup: 'SETUP', details: 'EINSATZ', finish: 'ABSCHLUSS' },
    steps: {
      2: { title: 'Basisdaten', coachingTip: 'Einsatzort und Branche sind die wichtigsten Filter bei ANÜ.' },
      3: { title: 'Konditionen & EP', coachingTip: 'Equal Pay klar angeben — AÜG-Compliance ist Pflicht ab Tag 1.' },
      4: { title: 'Qualifikation', coachingTip: 'Bei ANÜ zählen Zertifizierungen und Branchenkenntnis besonders.' },
      5: { title: 'Einsatzkontext', coachingTip: 'Übernahme-Option angeben — das steigert die Bewerberqualität erheblich.' },
      6: { title: 'Review', coachingTip: 'Vollständige ANÜ-Profile werden von Disponenten 2× schneller besetzt.' },
    },
  },
};

const BASE_STEPS: StepConfig[] = [
  { id: 0, key: 'track', title: 'Track-Auswahl', group: 'setup', groupLabel: 'SETUP', coachingTip: 'Wähle den passenden Track für deine Stelle.' },
  { id: 1, key: 'import', title: 'Smart Import', group: 'setup', groupLabel: 'SETUP', optional: true, coachingTip: 'Import spart 80% der Eingabezeit — einfach Stellentext reinkopieren.' },
  { id: 2, key: 'basic', title: 'Basisdaten', group: 'details', groupLabel: 'DETAILS' },
  { id: 3, key: 'compensation', title: 'Vergütung', group: 'details', groupLabel: 'DETAILS' },
  { id: 4, key: 'requirements', title: 'Anforderungen', group: 'details', groupLabel: 'DETAILS' },
  { id: 5, key: 'context', title: 'Kontext & Qualität', group: 'finish', groupLabel: 'ABSCHLUSS', optional: true },
  { id: 6, key: 'review', title: 'Review', group: 'finish', groupLabel: 'ABSCHLUSS' },
];

export function getStepsForTrack(track: EngagementTrack | null): StepConfig[] {
  if (!track) return BASE_STEPS;
  const overrides = TRACK_STEP_OVERRIDES[track];
  return BASE_STEPS.map(step => {
    const stepOverride = overrides.steps[step.id];
    return {
      ...step,
      groupLabel: overrides.groupLabels[step.group],
      title: stepOverride?.title ?? step.title,
      coachingTip: stepOverride?.coachingTip ?? step.coachingTip,
    };
  });
}

// Keep WIZARD_STEPS as default (backward compat)
export const WIZARD_STEPS: StepConfig[] = BASE_STEPS;

const INITIAL_FORM_DATA: JobWizardFormData = {
  engagement_model: null,
  headcount: 1,
  title: '',
  company_name: '',
  description: '',
  requirements: '',
  experience_level: 'mid',
  location: '',
  remote_policy: 'hybrid',
  onsite_days_required: 3,
  office_address: '',
  industry: '',
  company_size_band: '',
  funding_stage: '',
  tech_environment: [],
  travel_required: 'none',
  task_focus: '',
  employment_type: 'full-time',
  contract_type: 'unbefristet',
  salary_min: null,
  salary_max: null,
  salary_negotiable: true,
  benefits: [],
  equity_options: false,
  start_date: '',
  start_date_flexibility: 'flexibel',
  probation_months: 6,
  compensation_model: 'daily_rate',
  rate_min: null,
  rate_max: null,
  rate_currency: 'EUR',
  project_duration: '',
  project_scope: '',
  project_budget_total: null,
  deliverables: [],
  extension_possible: null,
  rate_includes_margin: false,
  assignment_duration: '',
  takeover_option: '',
  equal_pay_applicable: null,
  equal_pay_start: '',
  shift_model: 'normal',
  collective_agreement: '',
  industry_surcharges: false,
  existing_framework_contract: null,
  works_council_status: '',
  skills: [],
  must_haves: [],
  nice_to_haves: [],
  exclusion_criteria: [],
  required_languages: [
    { language: 'Deutsch', level: 'business' },
    { language: 'Englisch', level: 'fluent' },
  ],
  experience_years_min: null,
  industry_experience_required: false,
  required_certifications: [],
  security_clearance_required: false,
  background_check_required: false,
  drivers_license_required: '',
  vacancy_reason: '',
  hiring_urgency: 'standard',
  decision_makers_count: null,
  candidates_in_pipeline: null,
  team_size: null,
  remote_days: null,
  interview_stages: null,
  interview_process: '',
  success_profile: '',
  failure_profile: '',
  trainable_skills: [],
  team_integration: '',
  project_context: '',
  company_culture: '',
  career_path: '',
  intake_briefing: '',
  intake_completeness: 0,
  company_profile_id: null,
};

// ─── Validation ──────────────────────────────────────────────────

export interface StepValidation {
  isValid: boolean;
  errors: string[];
}

function validateStep(step: WizardStep, data: JobWizardFormData): StepValidation {
  const errors: string[] = [];

  switch (step) {
    case 0:
      if (!data.engagement_model) errors.push('Bitte wählen Sie einen Track');
      break;
    case 1:
      // Import is optional
      break;
    case 2:
      if (!data.title.trim()) errors.push('Jobtitel ist erforderlich');
      if (!data.company_name.trim()) errors.push('Unternehmen ist erforderlich');
      if (!data.location.trim()) errors.push('Standort ist erforderlich');
      break;
    case 3:
      if (data.engagement_model === 'permanent') {
        if (data.salary_min !== null && data.salary_max !== null && data.salary_min >= data.salary_max) {
          errors.push('Mindestgehalt muss kleiner als Maximalgehalt sein');
        }
      } else if (data.engagement_model === 'freelance') {
        if (data.rate_min !== null && data.rate_max !== null && data.rate_min >= data.rate_max) {
          errors.push('Mindestsatz muss kleiner als Maximalsatz sein');
        }
      } else if (data.engagement_model === 'temp_staffing') {
        if (data.rate_min !== null && data.rate_max !== null && data.rate_min >= data.rate_max) {
          errors.push('Mindestsatz muss kleiner als Maximalsatz sein');
        }
      }
      break;
    case 4:
      // Requirements are recommended but not required
      break;
    case 5:
      // Context is optional
      break;
    case 6:
      if (!data.title.trim()) errors.push('Jobtitel fehlt');
      if (!data.company_name.trim()) errors.push('Unternehmen fehlt');
      break;
  }

  return { isValid: errors.length === 0, errors };
}

// ─── Score Calculations ──────────────────────────────────────────

function calculateProfileCompleteness(data: JobWizardFormData): number {
  const checks = [
    !!data.title,
    !!data.company_name,
    !!data.description,
    !!data.location,
    !!data.experience_level,
    !!data.remote_policy,
    data.salary_min !== null || data.rate_min !== null,
    data.salary_max !== null || data.rate_max !== null,
    data.must_haves.length > 0,
    data.skills.length > 0,
    !!data.vacancy_reason,
    !!data.hiring_urgency && data.hiring_urgency !== 'standard',
    data.required_languages.length > 0,
    data.experience_years_min !== null,
    !!data.industry,
    !!data.company_size_band,
    data.benefits.length > 0 || data.deliverables.length > 0,
    !!data.success_profile,
    !!data.interview_process,
    data.team_size !== null,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function calculateMatchingReadiness(data: JobWizardFormData): number {
  const checks = [
    !!data.title,
    !!data.location,
    !!data.experience_level,
    data.salary_min !== null || data.rate_min !== null,
    data.must_haves.length > 0,
    data.skills.length > 0,
    data.required_languages.length > 0,
    !!data.remote_policy,
    data.experience_years_min !== null,
    data.nice_to_haves.length > 0,
    data.exclusion_criteria.length > 0,
    !!data.industry,
    data.tech_environment.length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function calculateRecruiterActionability(data: JobWizardFormData): number {
  const checks = [
    !!data.title,
    !!data.company_name,
    !!data.description,
    data.salary_min !== null || data.rate_min !== null,
    data.must_haves.length > 0,
    !!data.vacancy_reason,
    !!data.hiring_urgency,
    !!data.success_profile,
    !!data.failure_profile,
    data.decision_makers_count !== null,
    !!data.interview_process,
    data.team_size !== null,
    !!data.company_culture,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

// ─── Company Profile Type ────────────────────────────────────────

export interface CompanyProfileData {
  id: string;
  company_name: string;
  industry: string | null;
  address: string | null;
  remote_policy: string | null;
  benefits: unknown;
  perks: unknown;
  company_size_band: string | null;
  funding_stage: string | null;
  default_tech_environment: string[] | null;
  default_benefits: string[] | null;
  team_size_range: string | null;
  culture_values: unknown;
}

// ─── Hook ────────────────────────────────────────────────────────

export function useJobWizard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { canPublishJobs } = useClientVerification();
  const jobParsing = useJobParsing();
  const pdfParsing = useJobPdfParsing();
  const enrichment = useJobEnrichment();

  const [searchParams] = useSearchParams();
  const trackParam = searchParams.get('track') as EngagementModel | null;
  const validTrack = trackParam && ['permanent', 'freelance', 'temp_staffing'].includes(trackParam) ? trackParam : null;

  const [currentStep, setCurrentStep] = useState<WizardStep>(validTrack ? 1 : 0);
  const [formData, setFormData] = useState<JobWizardFormData>({
    ...INITIAL_FORM_DATA,
    ...(validTrack ? { engagement_model: validTrack } : {}),
  });
  const [draftId, setDraftId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(new Set(validTrack ? [0, 1] : [0]));
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfileData | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── Load Company Profile & Pre-fill ─────────────────────────────

  useEffect(() => {
    if (!user?.id) return;

    const loadCompanyProfile = async () => {
      const { data, error } = await supabase
        .from('company_profiles')
        .select('id, company_name, industry, address, remote_policy, benefits, perks, company_size_band, funding_stage, default_tech_environment, default_benefits, team_size_range, culture_values')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !data) return;

      setCompanyProfile(data as CompanyProfileData);

      // Pre-fill form data from company profile (only if fields are still at initial values)
      setFormData(prev => {
        const updates: Partial<JobWizardFormData> = {
          company_profile_id: data.id,
        };

        if (!prev.company_name && data.company_name) {
          updates.company_name = data.company_name;
        }
        if (!prev.industry && data.industry) {
          updates.industry = data.industry;
        }
        if (!prev.location && data.address) {
          updates.location = data.address;
        }
        if (prev.remote_policy === 'hybrid' && data.remote_policy) {
          updates.remote_policy = data.remote_policy;
        }
        if (!prev.company_size_band && data.company_size_band) {
          updates.company_size_band = data.company_size_band;
        }
        if (!prev.funding_stage && data.funding_stage) {
          updates.funding_stage = data.funding_stage;
        }
        if (prev.tech_environment.length === 0 && data.default_tech_environment?.length) {
          updates.tech_environment = data.default_tech_environment;
        }
        if (prev.benefits.length === 0 && data.default_benefits?.length) {
          updates.benefits = data.default_benefits;
        }

        return { ...prev, ...updates };
      });
    };

    loadCompanyProfile();
  }, [user?.id]);

  // Scores
  const scores = {
    profileCompleteness: calculateProfileCompleteness(formData),
    matchingReadiness: calculateMatchingReadiness(formData),
    recruiterActionability: calculateRecruiterActionability(formData),
  };

  // ── Field Updates ─────────────────────────────────────────────

  const updateField = useCallback(<K extends keyof JobWizardFormData>(
    field: K,
    value: JobWizardFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  }, []);

  const updateFields = useCallback((partial: Partial<JobWizardFormData>) => {
    setFormData(prev => ({ ...prev, ...partial }));
    setIsDirty(true);
  }, []);

  // ── Navigation ────────────────────────────────────────────────

  const getStepValidation = useCallback((step: WizardStep): StepValidation => {
    return validateStep(step, formData);
  }, [formData]);

  const nextStep = useCallback(() => {
    const validation = validateStep(currentStep, formData);
    if (!validation.isValid) {
      validation.errors.forEach(err => toast.error(err));
      return false;
    }
    if (currentStep < 6) {
      const next = (currentStep + 1) as WizardStep;
      setCurrentStep(next);
      setVisitedSteps(prev => new Set([...prev, next]));
      return true;
    }
    return false;
  }, [currentStep, formData]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((currentStep - 1) as WizardStep);
      return true;
    }
    return false;
  }, [currentStep]);

  const goToStep = useCallback((step: WizardStep) => {
    if (visitedSteps.has(step) || step <= currentStep) {
      setCurrentStep(step);
      setVisitedSteps(prev => new Set([...prev, step]));
    }
  }, [currentStep, visitedSteps]);

  // ── Import Data Merge ─────────────────────────────────────────

  const applyImportData = useCallback((parsed: Partial<ParsedJobData>) => {
    const updates: Partial<JobWizardFormData> = {};

    if (parsed.title) updates.title = parsed.title;
    if (parsed.company_name) updates.company_name = parsed.company_name;
    if (parsed.description) updates.description = parsed.description;
    if (parsed.requirements) updates.requirements = parsed.requirements;
    if (parsed.location) updates.location = parsed.location;
    if (parsed.experience_level) updates.experience_level = parsed.experience_level;
    if (parsed.remote_type) updates.remote_policy = parsed.remote_type;
    if (parsed.salary_min) updates.salary_min = parsed.salary_min;
    if (parsed.salary_max) updates.salary_max = parsed.salary_max;
    if (parsed.skills?.length) updates.skills = parsed.skills;
    if (parsed.must_haves?.length) updates.must_haves = parsed.must_haves;
    if (parsed.nice_to_haves?.length) updates.nice_to_haves = parsed.nice_to_haves;
    if (parsed.company_culture) updates.company_culture = parsed.company_culture;
    if (parsed.career_path) updates.career_path = parsed.career_path;
    if (parsed.hiring_urgency) updates.hiring_urgency = parsed.hiring_urgency;
    if (parsed.vacancy_reason) updates.vacancy_reason = parsed.vacancy_reason;
    if (parsed.team_size) updates.team_size = parsed.team_size;
    if (parsed.industry) updates.industry = parsed.industry;
    if (parsed.remote_days !== null && parsed.remote_days !== undefined) {
      updates.remote_days = parsed.remote_days;
    }
    if (parsed.benefits_extracted?.length) updates.benefits = parsed.benefits_extracted;

    updateFields(updates);
  }, [updateFields]);

  const applyIntakeData = useCallback((data: ExtractedIntakeData, completeness: number) => {
    const updates: Partial<JobWizardFormData> = {
      intake_completeness: completeness,
    };

    if (data.vacancy_reason) updates.vacancy_reason = data.vacancy_reason;
    if (data.hiring_urgency) updates.hiring_urgency = data.hiring_urgency;
    if (data.team_size) updates.team_size = data.team_size;
    if (data.remote_days !== undefined) updates.remote_days = data.remote_days;
    if (data.company_culture) updates.company_culture = data.company_culture;
    if (data.career_path) updates.career_path = data.career_path;
    if (data.success_profile) updates.success_profile = data.success_profile;
    if (data.failure_profile) updates.failure_profile = data.failure_profile;
    if (data.trainable_skills?.length) updates.trainable_skills = data.trainable_skills;
    if (data.must_have_criteria?.length) updates.must_haves = data.must_have_criteria;
    if (data.nice_to_have_criteria?.length) updates.nice_to_haves = data.nice_to_have_criteria;
    if (data.candidates_in_pipeline !== undefined) updates.candidates_in_pipeline = data.candidates_in_pipeline;
    if (data.salary_min) updates.salary_min = data.salary_min;
    if (data.salary_max) updates.salary_max = data.salary_max;

    updateFields(updates);
  }, [updateFields]);

  // ── Save / Submit ─────────────────────────────────────────────

  const saveDraft = useCallback(async () => {
    if (!user?.id) return;
    setSaving(true);

    try {
      const insertData: Record<string, unknown> = {
        client_id: user.id,
        company_profile_id: formData.company_profile_id || null,
        title: formData.title || 'Entwurf',
        company_name: formData.company_name || 'Unbekannt',
        status: 'draft',
        engagement_model: formData.engagement_model || 'permanent',
        headcount: formData.headcount,
        description: formData.description || null,
        requirements: formData.requirements || null,
        experience_level: formData.experience_level || null,
        location: formData.location || null,
        remote_policy: formData.remote_policy || null,
        onsite_days_required: formData.remote_policy === 'hybrid' ? formData.onsite_days_required : null,
        office_address: formData.office_address || null,
        industry: formData.industry || null,
        company_size_band: formData.company_size_band || null,
        funding_stage: formData.funding_stage || null,
        tech_environment: formData.tech_environment.length > 0 ? formData.tech_environment : null,
        employment_type: formData.employment_type || null,
        contract_type: formData.contract_type || null,
        salary_min: formData.salary_min,
        salary_max: formData.salary_max,
        salary_negotiable: formData.salary_negotiable,
        benefits: formData.benefits.length > 0 ? formData.benefits : null,
        equity_options: formData.equity_options,
        start_date: formData.start_date || null,
        start_date_flexibility: formData.start_date_flexibility || null,
        probation_months: formData.probation_months,
        compensation_model: formData.compensation_model || null,
        rate_min: formData.rate_min,
        rate_max: formData.rate_max,
        rate_currency: formData.rate_currency,
        project_duration: formData.project_duration || null,
        project_scope: formData.project_scope || null,
        deliverables: formData.deliverables.length > 0 ? formData.deliverables : null,
        extension_possible: formData.extension_possible,
        assignment_duration: formData.assignment_duration || null,
        takeover_option: formData.takeover_option || null,
        equal_pay_applicable: formData.equal_pay_applicable,
        equal_pay_start: formData.equal_pay_start || null,
        shift_model: formData.shift_model || null,
        collective_agreement: formData.collective_agreement || null,
        skills: formData.skills.length > 0 ? formData.skills : null,
        must_haves: formData.must_haves.length > 0 ? formData.must_haves : null,
        nice_to_haves: formData.nice_to_haves.length > 0 ? formData.nice_to_haves : null,
        exclusion_criteria: formData.exclusion_criteria.length > 0 ? formData.exclusion_criteria : null,
        required_languages: formData.required_languages.length > 0 ? formData.required_languages : null,
        experience_years_min: formData.experience_years_min,
        vacancy_reason: formData.vacancy_reason || null,
        hiring_urgency: formData.hiring_urgency || null,
        team_size: formData.team_size,
        success_profile: formData.success_profile || null,
        failure_profile: formData.failure_profile || null,
        trainable_skills: formData.trainable_skills.length > 0 ? formData.trainable_skills : null,
        company_culture: formData.company_culture || null,
        career_path: formData.career_path || null,
        interview_stages: formData.interview_stages,
        interview_process: formData.interview_process || null,
        intake_completeness: formData.intake_completeness || null,
        profile_completeness: scores.profileCompleteness,
        matching_readiness: scores.matchingReadiness,
        recruiter_actionability: scores.recruiterActionability,
      };

      if (draftId) {
        const { error } = await supabase
          .from('jobs')
          .update(insertData)
          .eq('id', draftId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('jobs')
          .insert(insertData as any)
          .select('id')
          .single();
        if (error) throw error;
        setDraftId(data.id);
      }

      setIsDirty(false);
      toast.success('Entwurf gespeichert');
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  }, [user, formData, draftId, scores]);

  const submitForReview = useCallback(async (publish: boolean = true) => {
    if (publish && !canPublishJobs) {
      toast.error('Bitte schließen Sie zuerst die Verifizierung ab');
      return;
    }

    // Validate all required steps
    for (const step of [0, 2, 3] as WizardStep[]) {
      const validation = validateStep(step, formData);
      if (!validation.isValid) {
        validation.errors.forEach(err => toast.error(err));
        setCurrentStep(step);
        return;
      }
    }

    setSubmitting(true);
    try {
      if (draftId) {
        const { error } = await supabase
          .from('jobs')
          .update({
            status: publish ? 'pending_approval' : 'draft',
            profile_completeness: scores.profileCompleteness,
            matching_readiness: scores.matchingReadiness,
            recruiter_actionability: scores.recruiterActionability,
          })
          .eq('id', draftId);
        if (error) throw error;
        toast.success(publish ? 'Job zur Prüfung eingereicht!' : 'Entwurf gespeichert');
        navigate(`/dashboard/jobs/${draftId}`);
      } else {
        await saveDraft();
        if (publish && draftId) {
          await supabase
            .from('jobs')
            .update({ status: 'pending_approval' })
            .eq('id', draftId);
        }
        toast.success(publish ? 'Job zur Prüfung eingereicht!' : 'Entwurf gespeichert');
        navigate(`/dashboard/jobs`);
      }
    } catch (error) {
      console.error('Error submitting:', error);
      toast.error('Fehler beim Einreichen');
    } finally {
      setSubmitting(false);
    }
  }, [formData, draftId, canPublishJobs, scores, saveDraft, navigate]);

  // Auto-save on step change
  useEffect(() => {
    if (isDirty && draftId) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        saveDraft();
      }, 3000);
    }
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [currentStep, isDirty, draftId, saveDraft]);

  // Track-aware steps
  const trackSteps = getStepsForTrack(formData.engagement_model as EngagementTrack | null);

  return {
    // State
    currentStep,
    formData,
    draftId,
    isDirty,
    visitedSteps,
    saving,
    submitting,
    scores,
    companyProfile,
    trackSteps,

    // Navigation
    nextStep,
    prevStep,
    goToStep,
    getStepValidation,

    // Data
    updateField,
    updateFields,
    applyImportData,
    applyIntakeData,

    // Persistence
    saveDraft,
    submitForReview,

    // Parsing hooks (pass-through)
    jobParsing,
    pdfParsing,
    enrichment,
  };
}

export type JobWizardState = ReturnType<typeof useJobWizard>;
