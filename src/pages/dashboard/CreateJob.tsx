import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useClientVerification } from '@/hooks/useClientVerification';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { 
  Link2, 
  FileText, 
  ArrowLeft, 
  Loader2,
  MapPin,
  Building2,
  Sparkles,
  CheckCircle2,
  Home,
  Calendar,
  Upload,
  FileUp,
  Brain,
  TrendingUp,
  Users,
  Coins,
  Zap,
  ChevronRight,
  ChevronDown,
  PenLine,
  AlertTriangle,
  XCircle,
  X,
  Check,
  Globe,
  Type,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { useJobParsing, ParsedJobData } from '@/hooks/useJobParsing';
import { useJobPdfParsing, ParsedJobProfile } from '@/hooks/useJobPdfParsing';
import { useJobEnrichment } from '@/hooks/useJobEnrichment';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';
import { IntakeBriefingSection } from '@/components/jobs/IntakeBriefingSection';
import { QuickQuestionsSection } from '@/components/jobs/QuickQuestionsSection';
import { IntakeProgress } from '@/components/jobs/IntakeProgress';
import { ExtractedIntakeData } from '@/hooks/useIntakeBriefing';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

type FlowState = 'import-selection' | 'importing' | 'review' | 'submitting';
type ImportMethod = 'pdf' | 'text' | 'url' | null;
type ImportErrorType = 'pdf_unreadable' | 'url_unreachable' | 'partial_success';

interface ImportError {
  type: ImportErrorType;
  message: string;
}

// Parsing step tracking
interface ParsingStep {
  label: string;
  status: 'pending' | 'active' | 'done';
}

const PARTIAL_SUCCESS_THRESHOLD = 5;

export default function CreateJob() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { parseJobUrl, parseJobText, parsing } = useJobParsing();
  const { uploadAndParsePdf, parseJobText: parseJobPdfText, isLoading: pdfParsing } = useJobPdfParsing();
  const { enrichJobData, enriching, enrichmentData } = useJobEnrichment();
  const { canPublishJobs, loading: verificationLoading } = useClientVerification();
  const isMobile = useIsMobile();
  
  const [flowState, setFlowState] = useState<FlowState>('import-selection');
  const [loading, setLoading] = useState(false);
  const [importError, setImportError] = useState<ImportError | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  // Modal states
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [showTextModal, setShowTextModal] = useState(false);
  const [jobUrl, setJobUrl] = useState('');
  const [jobTextInput, setJobTextInput] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [parsedFieldsCount, setParsedFieldsCount] = useState(0);
  
  // Parsing steps
  const [parsingSteps, setParsingSteps] = useState<ParsingStep[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reviewSectionRef = useRef<HTMLDivElement>(null);
  
  // Intake state
  const [intakeCompleteness, setIntakeCompleteness] = useState(0);
  const [intakeData, setIntakeData] = useState<Partial<ExtractedIntakeData>>({});

  const [formData, setFormData] = useState({
    title: '',
    company_name: '',
    description: '',
    requirements: '',
    location: '',
    remote_type: 'hybrid',
    employment_type: 'full-time',
    experience_level: 'mid',
    salary_min: '',
    salary_max: '',
    skills: '',
    must_haves: '',
    nice_to_haves: '',
    office_address: '',
    remote_policy: 'hybrid',
    onsite_days_required: '3',
    industry: '',
    company_size_band: '',
    funding_stage: '',
    tech_environment: '',
    hiring_urgency: 'standard',
    team_size: '',
    vacancy_reason: '',
    candidates_in_pipeline: '',
    decision_makers_count: '',
    remote_days: '',
    company_culture: '',
    career_path: '',
  });

  const handleInputChange = (field: string, value: string | unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleIntakeDataExtracted = (data: ExtractedIntakeData, completeness: number) => {
    setIntakeCompleteness(completeness);
    setIntakeData(data);
    
    setFormData(prev => ({
      ...prev,
      team_size: data.team_size?.toString() || prev.team_size,
      vacancy_reason: data.vacancy_reason || prev.vacancy_reason,
      hiring_urgency: data.hiring_urgency || prev.hiring_urgency,
      company_culture: data.company_culture || '',
      career_path: data.career_path || '',
      must_haves: data.must_have_criteria?.join(', ') || prev.must_haves,
      nice_to_haves: data.nice_to_have_criteria?.join(', ') || prev.nice_to_haves,
      salary_min: data.salary_min?.toString() || prev.salary_min,
      salary_max: data.salary_max?.toString() || prev.salary_max,
      remote_days: data.remote_days?.toString() || prev.remote_days,
    }));
  };

  const getMissingFields = (): string[] => {
    const missing: string[] = [];
    if (!formData.vacancy_reason && !intakeData.vacancy_reason) missing.push('vacancy_reason');
    if (!formData.hiring_urgency || formData.hiring_urgency === 'standard') missing.push('hiring_urgency');
    if (!formData.decision_makers_count) missing.push('decision_makers_count');
    if (!formData.candidates_in_pipeline) missing.push('candidates_in_pipeline');
    if (!formData.team_size && !intakeData.team_size) missing.push('team_size');
    if (!formData.remote_days && !intakeData.remote_days) missing.push('remote_days');
    return missing;
  };

  const getMissingRequiredFields = (): string[] => {
    const missing: string[] = [];
    if (!formData.title) missing.push('Jobtitel');
    if (!formData.company_name) missing.push('Firmenname');
    if (!formData.salary_min || !formData.salary_max) missing.push('Gehalt');
    return missing;
  };

  const countFilledFields = (data: ParsedJobData): number => {
    let count = 0;
    if (data.title) count++;
    if (data.company_name) count++;
    if (data.description) count++;
    if (data.requirements) count++;
    if (data.location) count++;
    if (data.remote_type) count++;
    if (data.employment_type) count++;
    if (data.experience_level) count++;
    if (data.salary_min) count++;
    if (data.salary_max) count++;
    if (data.skills?.length) count++;
    if (data.must_haves?.length) count++;
    if (data.nice_to_haves?.length) count++;
    if (data.team_size) count++;
    if (data.team_avg_age) count++;
    if (data.reports_to) count++;
    if (data.core_hours) count++;
    if (data.remote_days) count++;
    if (data.company_culture) count++;
    if (data.benefits_extracted?.length) count++;
    if (data.unique_selling_points?.length) count++;
    if (data.career_path) count++;
    if (data.hiring_urgency) count++;
    if (data.vacancy_reason) count++;
    if (data.industry) count++;
    if (data.company_size_estimate) count++;
    return count;
  };

  const applyParsedData = async (data: ParsedJobData) => {
    const fieldsCount = countFilledFields(data);
    setParsedFieldsCount(fieldsCount);

    // Check for partial success
    if (fieldsCount < PARTIAL_SUCCESS_THRESHOLD) {
      setImportError({
        type: 'partial_success',
        message: `KI konnte nur ${fieldsCount} von 27 Feldern erkennen. Bitte prüfe die Daten und ergänze fehlende Informationen.`,
      });
    }
    
    setFormData(prev => ({
      ...prev,
      title: data.title || '',
      company_name: data.company_name || '',
      description: data.description || '',
      requirements: data.requirements || '',
      location: data.location || '',
      remote_type: data.remote_type || 'hybrid',
      employment_type: data.employment_type || 'full-time',
      experience_level: data.experience_level || 'mid',
      salary_min: data.salary_min?.toString() || '',
      salary_max: data.salary_max?.toString() || '',
      skills: data.skills?.join(', ') || '',
      must_haves: data.must_haves?.join(', ') || '',
      nice_to_haves: data.nice_to_haves?.join(', ') || '',
      team_size: data.team_size?.toString() || '',
      remote_days: data.remote_days?.toString() || '',
      company_culture: data.company_culture || '',
      career_path: data.career_path || '',
      hiring_urgency: data.hiring_urgency || 'standard',
      vacancy_reason: data.vacancy_reason || '',
      industry: data.industry || '',
      company_size_band: data.company_size_estimate || '',
    }));
    
    if (data.benefits_extracted?.length || data.unique_selling_points?.length) {
      setIntakeData(prev => ({
        ...prev,
        benefits: data.benefits_extracted,
        unique_selling_points: data.unique_selling_points,
        company_culture: data.company_culture || undefined,
        team_size: data.team_size || undefined,
        remote_days: data.remote_days || undefined,
        career_path: data.career_path || undefined,
        hiring_urgency: data.hiring_urgency as 'standard' | 'urgent' | 'hot' | undefined,
        vacancy_reason: data.vacancy_reason || undefined,
      }));
    }
    
    // Auto-collapse details if enough fields filled
    setDetailsOpen(fieldsCount <= 10);
    setFlowState('review');
    
    setTimeout(() => {
      reviewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    // Trigger enrichment
    if (data.title && data.company_name) {
      setParsingSteps(prev => prev.map(s => s.label === 'Firmendaten anreichern' ? { ...s, status: 'active' } : s));
      const enriched = await enrichJobData({
        title: data.title,
        company_name: data.company_name,
        description: data.description,
        skills: data.skills || [],
        location: data.location,
        remote_type: data.remote_type,
      });

      if (enriched) {
        setFormData(prev => ({
          ...prev,
          industry: prev.industry || enriched.industry || '',
          company_size_band: prev.company_size_band || enriched.company_size_band || '',
          funding_stage: enriched.funding_stage || prev.funding_stage,
          tech_environment: enriched.tech_environment?.join(', ') || prev.tech_environment,
          hiring_urgency: prev.hiring_urgency !== 'standard' ? prev.hiring_urgency : (enriched.hiring_urgency || prev.hiring_urgency),
          skills: enriched.normalized_skills?.join(', ') || prev.skills,
        }));
      }
      setParsingSteps(prev => prev.map(s => s.label === 'Firmendaten anreichern' ? { ...s, status: 'done' } : s));
    }
  };

  // Mode parameter handling (replaces sessionStorage prefill)
  const [modeHandled, setModeHandled] = useState(false);
  const [awaitingFileSelection, setAwaitingFileSelection] = useState(false);
  useEffect(() => {
    const mode = searchParams.get('mode') as ImportMethod;
    if (mode === 'pdf') {
      setAwaitingFileSelection(true);
      setTimeout(() => fileInputRef.current?.click(), 100);
    } else if (mode === 'text') {
      setModeHandled(true);
      setShowTextModal(true);
    } else if (mode === 'url') {
      setModeHandled(true);
      setShowUrlModal(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect file picker cancel via window focus
  useEffect(() => {
    if (!awaitingFileSelection) return;
    const handleFocus = () => {
      // Delay to let onChange fire first if a file was selected
      setTimeout(() => {
        setAwaitingFileSelection(prev => {
          if (prev) {
            // User cancelled the file picker
            return false;
          }
          return prev;
        });
      }, 300);
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [awaitingFileSelection]);

  const startParsingSteps = (method: ImportMethod) => {
    const steps: ParsingStep[] = [];
    if (method === 'url') steps.push({ label: 'Seite wird geladen', status: 'active' });
    if (method === 'pdf') steps.push({ label: 'PDF wird verarbeitet', status: 'active' });
    if (method === 'text') steps.push({ label: 'Text wird analysiert', status: 'active' });
    steps.push({ label: 'KI extrahiert Daten', status: 'pending' });
    steps.push({ label: 'Firmendaten anreichern', status: 'pending' });
    setParsingSteps(steps);
  };

  const advanceParsingStep = (completedLabel: string) => {
    setParsingSteps(prev => {
      const updated = prev.map(s => s.label === completedLabel ? { ...s, status: 'done' as const } : s);
      const firstPending = updated.findIndex(s => s.status === 'pending');
      if (firstPending !== -1) updated[firstPending].status = 'active';
      return updated;
    });
  };

  const handleImportFromUrl = async () => {
    if (!jobUrl.trim()) {
      toast.error('Bitte gib eine URL ein');
      return;
    }

    setShowUrlModal(false);
    setFlowState('importing');
    setImportError(null);
    startParsingSteps('url');
    
    const data = await parseJobUrl(jobUrl);
    advanceParsingStep('Seite wird geladen');
    
    if (data) {
      advanceParsingStep('KI extrahiert Daten');
      await applyParsedData(data);
      if (countFilledFields(data) >= PARTIAL_SUCCESS_THRESHOLD) {
        toast.success('Job erfolgreich importiert!');
      }
    } else {
      setImportError({
        type: 'url_unreachable',
        message: 'Die Seite konnte nicht vollständig gelesen werden – möglicherweise blockiert die Website automatisches Auslesen.',
      });
      setFlowState('import-selection');
    }
  };

  const handleImportFromText = async () => {
    if (!jobTextInput.trim()) {
      toast.error('Bitte füge den Stellentext ein');
      return;
    }

    setShowTextModal(false);
    setFlowState('importing');
    setImportError(null);
    startParsingSteps('text');
    
    const data = await parseJobPdfText(jobTextInput);
    advanceParsingStep('Text wird analysiert');
    
    if (data) {
      advanceParsingStep('KI extrahiert Daten');
      applyParsedJobProfile(data);
      toast.success('Job erfolgreich analysiert!');
    } else {
      setImportError({
        type: 'pdf_unreadable',
        message: 'Der Text konnte nicht analysiert werden. Bitte prüfe das Format.',
      });
      setFlowState('import-selection');
    }
  };

  const handleFileUpload = async (file: File) => {
    setFlowState('importing');
    setImportError(null);
    startParsingSteps('pdf');
    
    const data = await uploadAndParsePdf(file);
    advanceParsingStep('PDF wird verarbeitet');
    
    if (data) {
      advanceParsingStep('KI extrahiert Daten');
      applyParsedJobProfile(data);
      toast.success('PDF erfolgreich analysiert!');
    } else {
      setImportError({
        type: 'pdf_unreadable',
        message: 'PDF konnte nicht gelesen werden – ist sie möglicherweise ein Scan oder passwortgeschützt?',
      });
      setFlowState('import-selection');
    }
  };

  const applyParsedJobProfile = (data: ParsedJobProfile) => {
    const parsedData: ParsedJobData = {
      title: data.title,
      company_name: data.company,
      description: data.description,
      requirements: data.requirements?.join('\n') || '',
      location: data.location,
      remote_type: data.remote_policy,
      employment_type: data.employment_type,
      experience_level: data.seniority_level,
      salary_min: data.salary_min,
      salary_max: data.salary_max,
      skills: data.technical_skills,
      must_haves: data.requirements,
      nice_to_haves: data.nice_to_have,
      team_size: null,
      team_avg_age: null,
      reports_to: null,
      department_structure: null,
      core_hours: null,
      remote_days: null,
      overtime_policy: null,
      daily_routine: null,
      company_culture: data.company_culture || null,
      benefits_extracted: data.benefits || [],
      unique_selling_points: [],
      career_path: null,
      hiring_urgency: null,
      vacancy_reason: null,
      hiring_deadline_weeks: null,
      industry: data.industry || null,
      company_size_estimate: null,
    };
    
    const fieldsCount = countFilledFields(parsedData);
    setParsedFieldsCount(fieldsCount);

    // Check for partial success
    if (fieldsCount < PARTIAL_SUCCESS_THRESHOLD) {
      setImportError({
        type: 'partial_success',
        message: `KI konnte nur ${fieldsCount} von 27 Feldern erkennen. Bitte prüfe die Daten und ergänze fehlende Informationen.`,
      });
    }
    
    setFormData(prev => ({
      ...prev,
      title: data.title || '',
      company_name: data.company || '',
      description: data.description || '',
      requirements: data.requirements?.join('\n') || '',
      location: data.location || '',
      remote_type: data.remote_policy === 'remote' ? 'remote' : data.remote_policy === 'onsite' ? 'onsite' : 'hybrid',
      employment_type: data.employment_type || 'full-time',
      experience_level: data.seniority_level === 'junior' ? 'junior' : data.seniority_level === 'senior' ? 'senior' : data.seniority_level === 'lead' || data.seniority_level === 'principal' || data.seniority_level === 'director' ? 'lead' : 'mid',
      salary_min: data.salary_min?.toString() || '',
      salary_max: data.salary_max?.toString() || '',
      skills: data.technical_skills?.join(', ') || '',
      must_haves: data.requirements?.join(', ') || '',
      nice_to_haves: data.nice_to_have?.join(', ') || '',
      company_culture: data.company_culture || '',
      industry: data.industry || '',
    }));
    
    if (data.benefits?.length) {
      setIntakeData(prev => ({
        ...prev,
        benefits: data.benefits,
        company_culture: data.company_culture || undefined,
      }));
    }
    
    setDetailsOpen(fieldsCount <= 10);
    setFlowState('review');
    
    setTimeout(() => {
      reviewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        handleFileUpload(file);
      } else {
        toast.error('Bitte nur PDF-Dateien hochladen');
      }
    }
  }, []);

  const handleManualCreate = () => {
    setFlowState('review');
    setDetailsOpen(true);
    setTimeout(() => {
      reviewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    const skills = formData.skills.split(',').map(s => s.trim()).filter(s => s !== skillToRemove);
    handleInputChange('skills', skills.join(', '));
  };

  const handleSubmit = async (publish: boolean = false) => {
    if (!formData.title || !formData.company_name) {
      toast.error('Bitte fülle die Pflichtfelder aus');
      return;
    }

    if (publish) {
      if (!formData.salary_min || !formData.salary_max) {
        toast.error('Bitte definiere eine Gehaltsrange, um den Job zu veröffentlichen');
        return;
      }
      
      if (parseInt(formData.salary_min) >= parseInt(formData.salary_max)) {
        toast.error('Das Mindestgehalt muss kleiner als das Maximalgehalt sein');
        return;
      }
    }

    if (publish && !canPublishJobs) {
      toast.error('Bitte schließe zuerst die Verifizierung ab, um Jobs zu veröffentlichen');
      navigate('/onboarding');
      return;
    }

    setFlowState('submitting');
    setLoading(true);
    try {
      const skillsArray = formData.skills
        ? formData.skills.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      const mustHavesArray = formData.must_haves
        ? formData.must_haves.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      const niceToHavesArray = formData.nice_to_haves
        ? formData.nice_to_haves.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      const techEnvironmentArray = formData.tech_environment
        ? formData.tech_environment.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      const { data, error } = await supabase
        .from('jobs')
        .insert({
          client_id: user?.id,
          title: formData.title,
          company_name: formData.company_name,
          description: formData.description,
          requirements: formData.requirements,
          location: formData.location,
          remote_type: formData.remote_type,
          employment_type: formData.employment_type,
          experience_level: formData.experience_level,
          salary_min: formData.salary_min ? parseInt(formData.salary_min) : null,
          salary_max: formData.salary_max ? parseInt(formData.salary_max) : null,
          skills: skillsArray,
          must_haves: mustHavesArray,
          nice_to_haves: niceToHavesArray,
          status: publish ? 'pending_approval' : 'draft',
          office_address: formData.office_address || null,
          remote_policy: formData.remote_policy || null,
          onsite_days_required: formData.remote_policy === 'hybrid' ? parseInt(formData.onsite_days_required) : null,
          industry: formData.industry || null,
          company_size_band: formData.company_size_band || null,
          funding_stage: formData.funding_stage || null,
          tech_environment: techEnvironmentArray.length > 0 ? techEnvironmentArray : null,
          hiring_urgency: formData.hiring_urgency !== 'standard' ? formData.hiring_urgency : null,
          team_size: formData.team_size ? parseInt(formData.team_size) : null,
          vacancy_reason: formData.vacancy_reason || null,
          candidates_in_pipeline: formData.candidates_in_pipeline ? parseInt(formData.candidates_in_pipeline) : null,
          intake_completeness: intakeCompleteness || null,
          intake_briefing: intakeData.company_culture || null,
          company_culture: intakeData.company_culture || null,
          career_path: intakeData.career_path || null,
          success_profile: intakeData.success_profile || null,
          daily_routine: intakeData.daily_routine || null,
          trainable_skills: intakeData.trainable_skills || null,
          must_have_criteria: intakeData.must_have_criteria || null,
          nice_to_have_criteria: intakeData.nice_to_have_criteria || null,
          reports_to: intakeData.reports_to || null,
          works_council: intakeData.works_council || null,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(publish ? 'Job zur Prüfung eingereicht!' : 'Job als Entwurf gespeichert');
      navigate(`/dashboard/jobs/${data.id}`);
    } catch (error) {
      console.error('Error creating job:', error);
      toast.error('Fehler beim Erstellen des Jobs');
      setFlowState('review');
    } finally {
      setLoading(false);
    }
  };

  const isImporting = flowState === 'importing' || parsing || pdfParsing;
  const missingRequired = getMissingRequiredFields();

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6 pb-28">
        {/* Hidden file input - always in DOM */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setAwaitingFileSelection(false);
              setModeHandled(true);
              handleFileUpload(file);
            }
          }}
          disabled={isImporting}
        />
        {/* Header */}
        <div>
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Neue Stelle erstellen</h1>
          <p className="text-muted-foreground">In unter 60 Sekunden fertig – dank KI-Import</p>
        </div>

        {/* Verification Warning */}
        {!verificationLoading && !canPublishJobs && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Verifizierung erforderlich</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>
                Um Jobs zu veröffentlichen, musst du zuerst die Unternehmensverifizierung abschließen.
              </span>
              <Button variant="outline" size="sm" asChild className="ml-4">
                <Link to="/onboarding">Jetzt verifizieren</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Import Error State */}
        {importError && flowState === 'import-selection' && (
          <Card className={cn(
            "border",
            importError.type === 'partial_success' 
              ? "border-warning/30 bg-warning/5" 
              : "border-destructive/30 bg-destructive/5"
          )}>
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                {importError.type === 'partial_success' ? (
                  <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                )}
                <div className="flex-1 space-y-2">
                  <p className="font-medium text-sm">{importError.message}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setImportError(null);
                        setShowTextModal(true);
                      }}
                    >
                      <Type className="h-3 w-3 mr-1" />
                      Text manuell einfügen
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setImportError(null)}
                    >
                      Schließen
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Import Selection */}
        {(flowState === 'import-selection' || flowState === 'importing') && !modeHandled && !awaitingFileSelection && (
          <div className="space-y-6">
            <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-3")}>
              {/* PDF Upload */}
              <Card 
                className={cn(
                  "cursor-pointer transition-all hover:border-primary hover:shadow-md group",
                  dragActive && !isMobile && "border-primary bg-primary/5 shadow-md",
                  isImporting && "opacity-50 pointer-events-none"
                )}
                {...(!isMobile ? {
                  onDragEnter: handleDrag,
                  onDragLeave: handleDrag,
                  onDragOver: handleDrag,
                  onDrop: handleDrop,
                } : {})}
                onClick={() => fileInputRef.current?.click()}
              >
                <CardContent className={cn("text-center relative", isMobile ? "py-4 flex items-center gap-4" : "py-8")}>
                  {isImporting && pdfParsing ? (
                    <Loader2 className={cn("text-primary animate-spin", isMobile ? "h-8 w-8" : "h-12 w-12 mx-auto")} />
                  ) : (
                    <FileUp className={cn("text-muted-foreground group-hover:text-primary transition-colors", isMobile ? "h-8 w-8" : "h-12 w-12 mx-auto")} />
                  )}
                  <div className={isMobile ? "" : "mt-4"}>
                    <h3 className="font-semibold">PDF hochladen</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">SAP, Personio, Workday...</p>
                  </div>
                </CardContent>
              </Card>

              {/* Text Paste */}
              <Card 
                className={cn(
                  "cursor-pointer transition-all hover:border-primary hover:shadow-md group",
                  isImporting && "opacity-50 pointer-events-none"
                )}
                onClick={() => !isImporting && setShowTextModal(true)}
              >
                <CardContent className={cn("text-center", isMobile ? "py-4 flex items-center gap-4" : "py-8")}>
                  <FileText className={cn("text-muted-foreground group-hover:text-primary transition-colors", isMobile ? "h-8 w-8" : "h-12 w-12 mx-auto")} />
                  <div className={isMobile ? "" : "mt-4"}>
                    <h3 className="font-semibold">Text einfügen</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">Copy & Paste</p>
                  </div>
                </CardContent>
              </Card>

              {/* URL Import */}
              <Card 
                className={cn(
                  "cursor-pointer transition-all hover:border-primary hover:shadow-md group",
                  isImporting && "opacity-50 pointer-events-none"
                )}
                onClick={() => !isImporting && setShowUrlModal(true)}
              >
                <CardContent className={cn("text-center", isMobile ? "py-4 flex items-center gap-4" : "py-8")}>
                  {isImporting && parsing ? (
                    <Loader2 className={cn("text-primary animate-spin", isMobile ? "h-8 w-8" : "h-12 w-12 mx-auto")} />
                  ) : (
                    <Globe className={cn("text-muted-foreground group-hover:text-primary transition-colors", isMobile ? "h-8 w-8" : "h-12 w-12 mx-auto")} />
                  )}
                  <div className={isMobile ? "" : "mt-4"}>
                    <h3 className="font-semibold">URL importieren</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">LinkedIn, Stepstone...</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Multi-step Parsing Animation */}
            {isImporting && parsingSteps.length > 0 && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="py-6">
                  <div className="space-y-3">
                    {parsingSteps.map((step, i) => (
                      <div key={i} className="flex items-center gap-3">
                        {step.status === 'done' && (
                          <CheckCircle2 className="h-5 w-5 text-emerald shrink-0" />
                        )}
                        {step.status === 'active' && (
                          <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
                        )}
                        {step.status === 'pending' && (
                          <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                        )}
                        <span className={cn(
                          "text-sm",
                          step.status === 'active' && "font-medium text-foreground",
                          step.status === 'done' && "text-muted-foreground",
                          step.status === 'pending' && "text-muted-foreground/50"
                        )}>
                          {step.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Fallback: simple spinner if no steps */}
            {isImporting && parsingSteps.length === 0 && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="py-6">
                  <div className="flex items-center justify-center gap-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <div>
                      <p className="font-medium">KI analysiert die Stellenanzeige...</p>
                      <p className="text-sm text-muted-foreground">Titel, Skills, Gehalt und mehr werden extrahiert</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Manual Create Option */}
            {!isImporting && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">oder</span>
                  </div>
                </div>

                <div className="text-center">
                  <Button 
                    variant="ghost" 
                    onClick={handleManualCreate}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <PenLine className="mr-2 h-4 w-4" />
                    Manuell erstellen
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Parsing animation when navigated via mode param */}
        {modeHandled && isImporting && (
          <div className="space-y-6">
            {parsingSteps.length > 0 ? (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="py-6">
                  <div className="space-y-3">
                    {parsingSteps.map((step, i) => (
                      <div key={i} className="flex items-center gap-3">
                        {step.status === 'done' && <CheckCircle2 className="h-5 w-5 text-emerald shrink-0" />}
                        {step.status === 'active' && <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />}
                        {step.status === 'pending' && <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 shrink-0" />}
                        <span className={cn(
                          "text-sm",
                          step.status === 'active' && "font-medium text-foreground",
                          step.status === 'done' && "text-muted-foreground",
                          step.status === 'pending' && "text-muted-foreground/50"
                        )}>{step.label}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="py-6">
                  <div className="flex items-center justify-center gap-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <div>
                      <p className="font-medium">KI analysiert die Stellenanzeige...</p>
                      <p className="text-sm text-muted-foreground">Titel, Skills, Gehalt und mehr werden extrahiert</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Awaiting file selection hint */}
        {awaitingFileSelection && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-6 text-center space-y-2">
              <FileUp className="h-8 w-8 text-primary mx-auto" />
              <p className="font-medium">Bitte wähle eine PDF-Datei aus...</p>
              <p className="text-sm text-muted-foreground">Der Datei-Dialog sollte sich geöffnet haben</p>
            </CardContent>
          </Card>
        )}

        {/* Fallback after mode-handled error */}
        {modeHandled && !awaitingFileSelection && flowState === 'import-selection' && !isImporting && (
          <Card className="border-border/50">
            <CardContent className="py-6 text-center space-y-4">
              <p className="text-muted-foreground">Import abgebrochen oder fehlgeschlagen.</p>
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={() => setModeHandled(false)}>
                  Andere Methode wählen
                </Button>
                <Button variant="ghost" onClick={handleManualCreate}>
                  <PenLine className="mr-2 h-4 w-4" />
                  Manuell erstellen
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Review Section */}
        {(flowState === 'review' || flowState === 'submitting') && (
          <div ref={reviewSectionRef} className="space-y-6">
            {/* Partial Success Warning */}
            {importError?.type === 'partial_success' && (
              <Card className="border-warning/30 bg-warning/5">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">{importError.message}</p>
                      {missingRequired.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Fehlende Pflichtfelder: {missingRequired.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Success Banner */}
            {parsedFieldsCount > 0 && !importError && (
              <Card className="border-emerald/30 bg-emerald/5">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald" />
                    <div className="flex-1">
                      <p className="font-medium">Import erfolgreich</p>
                      <p className="text-sm text-muted-foreground">
                        {parsedFieldsCount} von 27 Feldern automatisch ausgefüllt
                      </p>
                    </div>
                    {enriching && (
                      <Badge variant="secondary" className="animate-pulse">
                        <Brain className="h-3 w-3 mr-1" />
                        KI recherchiert...
                      </Badge>
                    )}
                    {enrichmentData && !enriching && (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                        <Sparkles className="h-3 w-3 mr-1" />
                        KI-angereichert
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Visual Summary Card */}
            {parsedFieldsCount > 0 && (
              <Card className="border-border/50">
                <CardContent className="p-5 space-y-4">
                  {/* Title & Company */}
                  <div>
                    <h2 className="text-xl font-bold">{formData.title || 'Kein Titel'}</h2>
                    <p className="text-muted-foreground flex items-center gap-1.5 mt-1">
                      <Building2 className="h-4 w-4" />
                      {formData.company_name || 'Keine Firma'}
                    </p>
                  </div>

                  {/* Key Facts Pills */}
                  <div className={cn(
                    "gap-2",
                    isMobile ? "grid grid-cols-2" : "flex flex-wrap"
                  )}>
                    {formData.salary_min && formData.salary_max && (
                      <Badge variant="secondary" className="justify-start gap-1.5 py-1.5 px-3">
                        <Coins className="h-3 w-3" />
                        €{parseInt(formData.salary_min).toLocaleString()} – €{parseInt(formData.salary_max).toLocaleString()}
                      </Badge>
                    )}
                    {formData.location && (
                      <Badge variant="secondary" className="justify-start gap-1.5 py-1.5 px-3">
                        <MapPin className="h-3 w-3" />
                        {formData.location}
                      </Badge>
                    )}
                    {formData.remote_type && (
                      <Badge variant="secondary" className="justify-start gap-1.5 py-1.5 px-3">
                        <Home className="h-3 w-3" />
                        {formData.remote_type === 'remote' ? 'Remote' : formData.remote_type === 'onsite' ? 'Vor Ort' : 'Hybrid'}
                      </Badge>
                    )}
                    {formData.experience_level && (
                      <Badge variant="secondary" className="justify-start gap-1.5 py-1.5 px-3">
                        <TrendingUp className="h-3 w-3" />
                        {formData.experience_level === 'junior' ? 'Junior' : formData.experience_level === 'mid' ? 'Mid-Level' : formData.experience_level === 'senior' ? 'Senior' : 'Lead'}
                      </Badge>
                    )}
                    {formData.hiring_urgency && formData.hiring_urgency !== 'standard' && (
                      <Badge variant="destructive" className="justify-start gap-1.5 py-1.5 px-3">
                        <Zap className="h-3 w-3" />
                        {formData.hiring_urgency === 'urgent' ? 'Dringend' : 'ASAP'}
                      </Badge>
                    )}
                  </div>

                  {/* Interactive Skills Tags */}
                  {formData.skills && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Skills</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {formData.skills.split(',').map((skill, i) => {
                          const trimmed = skill.trim();
                          if (!trimmed) return null;
                          return (
                            <Badge key={i} variant="outline" className="gap-1 pr-1.5 group/skill">
                              {trimmed}
                              <button
                                onClick={() => handleRemoveSkill(trimmed)}
                                className="ml-0.5 opacity-0 group-hover/skill:opacity-100 transition-opacity"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* KI Confidence */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <Badge variant="outline" className="text-xs">
                      <Brain className="h-3 w-3 mr-1" />
                      {parsedFieldsCount} von 27 Feldern erkannt
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFlowState('import-selection');
                        setParsedFieldsCount(0);
                        setImportError(null);
                      }}
                      className="text-xs"
                    >
                      Neu importieren
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Smart Intake Briefing Section */}
            <IntakeBriefingSection
              onDataExtracted={handleIntakeDataExtracted}
              existingData={intakeData}
            />

            {/* Quick Questions */}
            <QuickQuestionsSection
              missingFields={getMissingFields()}
              currentValues={formData}
              onValueChange={(field, value) => handleInputChange(field, String(value))}
            />

            {/* Intake Progress */}
            {intakeCompleteness > 0 && (
              <IntakeProgress completeness={intakeCompleteness} />
            )}

            {/* Collapsible Details Form */}
            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <PenLine className="h-4 w-4" />
                    Details bearbeiten
                    {missingRequired.length > 0 && (
                      <Badge variant="destructive" className="text-xs px-1.5 py-0">
                        {missingRequired.length}
                      </Badge>
                    )}
                  </span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", detailsOpen && "rotate-180")} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                {/* Main Fields */}
                <Card className="border-border/50">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Zusammenfassung
                    </CardTitle>
                    <CardDescription>Prüfe und bearbeite die erkannten Daten</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="title" className={cn(!formData.title && importError?.type === 'partial_success' && "text-destructive")}>
                          Jobtitel *
                        </Label>
                        <Input
                          id="title"
                          placeholder="z.B. Senior Software Engineer"
                          value={formData.title}
                          onChange={(e) => handleInputChange('title', e.target.value)}
                          className={cn(!formData.title && importError?.type === 'partial_success' && "border-destructive")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="company_name" className={cn(!formData.company_name && importError?.type === 'partial_success' && "text-destructive")}>
                          Firmenname *
                        </Label>
                        <Input
                          id="company_name"
                          placeholder="z.B. Acme GmbH"
                          value={formData.company_name}
                          onChange={(e) => handleInputChange('company_name', e.target.value)}
                          className={cn(!formData.company_name && importError?.type === 'partial_success' && "border-destructive")}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="salary_min" className={cn((!formData.salary_min || !formData.salary_max) && importError?.type === 'partial_success' && "text-destructive")}>
                          Gehalt (€)
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="salary_min"
                            type="number"
                            placeholder="Min"
                            value={formData.salary_min}
                            onChange={(e) => handleInputChange('salary_min', e.target.value)}
                          />
                          <span className="text-muted-foreground">–</span>
                          <Input
                            type="number"
                            placeholder="Max"
                            value={formData.salary_max}
                            onChange={(e) => handleInputChange('salary_max', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="location">Standort</Label>
                        <Input
                          id="location"
                          placeholder="z.B. Berlin"
                          value={formData.location}
                          onChange={(e) => handleInputChange('location', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Remote-Modell</Label>
                        <Select
                          value={formData.remote_type}
                          onValueChange={(value) => handleInputChange('remote_type', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="onsite">Vor Ort</SelectItem>
                            <SelectItem value="hybrid">Hybrid</SelectItem>
                            <SelectItem value="remote">Remote</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Erfahrungslevel</Label>
                        <Select
                          value={formData.experience_level}
                          onValueChange={(value) => handleInputChange('experience_level', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="junior">Junior (0-2 Jahre)</SelectItem>
                            <SelectItem value="mid">Mid-Level (2-5 Jahre)</SelectItem>
                            <SelectItem value="senior">Senior (5-8 Jahre)</SelectItem>
                            <SelectItem value="lead">Lead/Principal (8+ Jahre)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {formData.skills && (
                      <div className="space-y-2">
                        <Label>Skills</Label>
                        <div className="flex flex-wrap gap-2">
                          {formData.skills.split(',').slice(0, 6).map((skill, i) => (
                            <Badge key={i} variant="secondary">{skill.trim()}</Badge>
                          ))}
                          {formData.skills.split(',').length > 6 && (
                            <Badge variant="outline">+{formData.skills.split(',').length - 6} mehr</Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Accordion for Additional Details */}
                <Accordion type="single" collapsible className="space-y-4">
                  <AccordionItem value="description" className="border rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Beschreibung & Anforderungen
                        {(formData.description || formData.requirements) && (
                          <Badge variant="secondary" className="ml-2 text-xs">ausgefüllt</Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="description">Stellenbeschreibung</Label>
                        <Textarea
                          id="description"
                          placeholder="Beschreibe die Rolle, Verantwortlichkeiten..."
                          rows={5}
                          value={formData.description}
                          onChange={(e) => handleInputChange('description', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="requirements">Anforderungen</Label>
                        <Textarea
                          id="requirements"
                          placeholder="Liste die Qualifikationen auf..."
                          rows={4}
                          value={formData.requirements}
                          onChange={(e) => handleInputChange('requirements', e.target.value)}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="skills" className="border rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Skills & Anforderungen bearbeiten
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="skills">Erforderliche Skills</Label>
                        <Input
                          id="skills"
                          placeholder="z.B. React, TypeScript, Node.js (kommagetrennt)"
                          value={formData.skills}
                          onChange={(e) => handleInputChange('skills', e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">Skills mit Komma trennen</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="must_haves">Must-Haves</Label>
                        <Input
                          id="must_haves"
                          placeholder="z.B. 5+ Jahre Erfahrung, Bachelor"
                          value={formData.must_haves}
                          onChange={(e) => handleInputChange('must_haves', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="nice_to_haves">Nice-to-Haves</Label>
                        <Input
                          id="nice_to_haves"
                          placeholder="z.B. AWS Zertifizierung"
                          value={formData.nice_to_haves}
                          onChange={(e) => handleInputChange('nice_to_haves', e.target.value)}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="remote" className="border rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Home className="h-4 w-4" />
                        Remote-Policy & Büro
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Remote-Policy</Label>
                          <Select
                            value={formData.remote_policy}
                            onValueChange={(value) => handleInputChange('remote_policy', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="full_remote">Vollständig Remote</SelectItem>
                              <SelectItem value="hybrid">Hybrid</SelectItem>
                              <SelectItem value="onsite_only">Nur vor Ort</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="office_address">Büro-Adresse</Label>
                          <Input
                            id="office_address"
                            placeholder="z.B. Friedrichstraße 123, 10117 Berlin"
                            value={formData.office_address}
                            onChange={(e) => handleInputChange('office_address', e.target.value)}
                          />
                        </div>
                      </div>

                      {formData.remote_policy === 'hybrid' && (
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <Label className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              Pflicht-Tage vor Ort pro Woche
                            </Label>
                            <span className="text-sm font-medium">
                              {formData.onsite_days_required} Tag{parseInt(formData.onsite_days_required) !== 1 ? 'e' : ''}
                            </span>
                          </div>
                          <Slider
                            value={[parseInt(formData.onsite_days_required) || 0]}
                            onValueChange={([value]) => handleInputChange('onsite_days_required', value.toString())}
                            min={0}
                            max={5}
                            step={1}
                            className="w-full"
                          />
                        </div>
                      )}

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Anstellungsart</Label>
                          <Select
                            value={formData.employment_type}
                            onValueChange={(value) => handleInputChange('employment_type', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="full-time">Vollzeit</SelectItem>
                              <SelectItem value="part-time">Teilzeit</SelectItem>
                              <SelectItem value="contract">Befristet</SelectItem>
                              <SelectItem value="freelance">Freelance</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* KI-Enrichment Fields */}
                  {(enrichmentData || formData.industry || formData.company_size_band || formData.funding_stage) && (
                    <AccordionItem value="enrichment" className="border border-primary/30 rounded-lg px-4 bg-primary/5">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2">
                          <Brain className="h-4 w-4 text-primary" />
                          KI-analysierte Firmeninfos
                          <Badge variant="outline" className="ml-2 text-xs">Optional</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-4 space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <TrendingUp className="h-3 w-3" />
                              Industrie
                            </Label>
                            <Select
                              value={formData.industry}
                              onValueChange={(value) => handleInputChange('industry', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Industrie auswählen" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Technology">Technology</SelectItem>
                                <SelectItem value="FinTech">FinTech</SelectItem>
                                <SelectItem value="HealthTech">HealthTech</SelectItem>
                                <SelectItem value="E-Commerce">E-Commerce</SelectItem>
                                <SelectItem value="Automotive">Automotive</SelectItem>
                                <SelectItem value="EdTech">EdTech</SelectItem>
                                <SelectItem value="CleanTech">CleanTech</SelectItem>
                                <SelectItem value="Consulting">Consulting</SelectItem>
                                <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                                <SelectItem value="Media">Media</SelectItem>
                                <SelectItem value="Real Estate">Real Estate</SelectItem>
                                <SelectItem value="Logistics">Logistics</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <Users className="h-3 w-3" />
                              Unternehmensgröße
                            </Label>
                            <Select
                              value={formData.company_size_band}
                              onValueChange={(value) => handleInputChange('company_size_band', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Größe auswählen" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1-50">1-50 Mitarbeiter</SelectItem>
                                <SelectItem value="51-200">51-200 Mitarbeiter</SelectItem>
                                <SelectItem value="201-500">201-500 Mitarbeiter</SelectItem>
                                <SelectItem value="501-1000">501-1000 Mitarbeiter</SelectItem>
                                <SelectItem value="1000+">1000+ Mitarbeiter</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <Coins className="h-3 w-3" />
                              Funding-Stage
                            </Label>
                            <Select
                              value={formData.funding_stage}
                              onValueChange={(value) => handleInputChange('funding_stage', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Funding auswählen" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Bootstrapped">Bootstrapped</SelectItem>
                                <SelectItem value="Seed">Seed</SelectItem>
                                <SelectItem value="Series A">Series A</SelectItem>
                                <SelectItem value="Series B">Series B</SelectItem>
                                <SelectItem value="Series C+">Series C+</SelectItem>
                                <SelectItem value="Public">Public / Börsennotiert</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <Zap className="h-3 w-3" />
                              Hiring-Dringlichkeit
                            </Label>
                            <Select
                              value={formData.hiring_urgency}
                              onValueChange={(value) => handleInputChange('hiring_urgency', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="standard">Standard</SelectItem>
                                <SelectItem value="urgent">Dringend</SelectItem>
                                <SelectItem value="ASAP">ASAP</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {formData.tech_environment && (
                          <div className="space-y-2">
                            <Label>Tech-Stack (normalisiert)</Label>
                            <div className="flex flex-wrap gap-2">
                              {formData.tech_environment.split(',').map((tech, i) => (
                                <Badge key={i} variant="secondary">
                                  {tech.trim()}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </div>

      {/* Sticky Action Footer */}
      {(flowState === 'review' || flowState === 'submitting') && (
        <div className={cn(
          "border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
          "p-4 z-50",
          isMobile 
            ? "fixed bottom-0 left-0 right-0 pb-[max(1rem,env(safe-area-inset-bottom))]" 
            : "sticky bottom-0"
        )}>
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3 justify-end items-center">
            {missingRequired.length > 0 && (
              <p className="text-xs text-muted-foreground mr-auto flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-destructive inline-block" />
                {missingRequired.length} Pflichtfeld{missingRequired.length > 1 ? 'er' : ''} fehlt
              </p>
            )}
            <Button
              variant="outline"
              onClick={() => handleSubmit(false)}
              disabled={loading}
              size={isMobile ? "default" : "default"}
              className={isMobile ? "w-full" : ""}
            >
              {loading && flowState === 'submitting' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Als Entwurf speichern
            </Button>
            <Button
              variant="hero"
              onClick={() => handleSubmit(true)}
              disabled={loading}
              className={isMobile ? "w-full" : ""}
            >
              {loading && flowState === 'submitting' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Zur Prüfung einreichen
            </Button>
          </div>
        </div>
      )}

      {/* URL Import Modal */}
      <Dialog open={showUrlModal} onOpenChange={setShowUrlModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Job-URL importieren
            </DialogTitle>
            <DialogDescription>
              Füge einen Link zu einer bestehenden Stellenanzeige ein
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="jobUrl">URL zur Stellenanzeige</Label>
              <Input
                id="jobUrl"
                type="url"
                placeholder="https://careers.example.com/jobs/123"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleImportFromUrl()}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Unterstützt: LinkedIn, Stepstone, Indeed, Karriereseiten und mehr
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUrlModal(false)}>
              Abbrechen
            </Button>
            <Button variant="hero" onClick={handleImportFromUrl} disabled={!jobUrl.trim()}>
              <Sparkles className="mr-2 h-4 w-4" />
              Analysieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Text Import Modal */}
      <Dialog open={showTextModal} onOpenChange={setShowTextModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Stellentext einfügen
            </DialogTitle>
            <DialogDescription>
              Kopiere den vollständigen Stellentext hier ein
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Füge hier den vollständigen Stellentext ein...

Beispiel:
Senior Software Engineer (m/w/d)
Unternehmen: TechCorp GmbH
Standort: Berlin, Deutschland
Gehalt: €60.000 - €80.000

Über uns:
..."
              rows={12}
              value={jobTextInput}
              onChange={(e) => setJobTextInput(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTextModal(false)}>
              Abbrechen
            </Button>
            <Button variant="hero" onClick={handleImportFromText} disabled={!jobTextInput.trim()}>
              <Sparkles className="mr-2 h-4 w-4" />
              Mit KI analysieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
