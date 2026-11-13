import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2, User, Briefcase, Euro, FileText, Plus, X,
  MapPin, Globe, Phone, Mail, Linkedin, Github, ExternalLink,
  Award, Target, Building2, Calendar, Clock, Sparkles, Car,
  Shield, ChevronDown, ChevronUp
} from 'lucide-react';
import { Candidate } from './CandidateCard';
import { CommutePreferencesCard } from './CommutePreferencesCard';

interface CandidateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate?: Candidate | null;
  onSave: (data: Partial<Candidate>) => Promise<void>;
  processing?: boolean;
}

interface FormData {
  // Stammdaten
  full_name: string;
  email: string;
  phone: string;
  city: string;
  nationality: string;
  residence_status: string;
  linkedin_url: string;
  github_url: string;
  portfolio_url: string;
  website_url: string;
  visa_required: boolean;
  work_permit_notes: string;
  
  // Pendel & Remote-Präferenzen
  max_commute_minutes: number;
  commute_mode: string;
  address_street: string;
  address_zip: string;
  remote_days_preferred: number;
  remote_flexibility: string;
  
  // Beruf & Skills
  job_title: string;
  company: string;
  seniority: string;
  work_model: string;
  experience_years: string;
  skills: string;
  specializations: string[];
  industry_experience: string[];
  soft_skills: string[];
  certificates: string[];
  
  // Projektmetriken
  project_metrics: {
    max_team_size: string;
    max_budget: string;
    locations_managed: string;
    units_delivered: string;
  };
  
  // Verfügbarkeit & Gehalt
  availability_date: string;
  notice_period: string;
  remote_preference: string;
  relocation_willing: boolean;
  salary_fix: string;
  salary_bonus: string;
  salary_expectation_min: string;
  salary_expectation_max: string;
  current_salary: string;
  target_locations: string[];
  target_industries: string[];
  target_roles: string[];
  target_employment_type: string;
  
  // Exposé
  expose_title: string;
  expose_summary: string;
  expose_highlights: string[];
  expose_project_highlights: string[];
  expose_certifications: string[];
  summary: string;
}

const initialFormData: FormData = {
  full_name: '', email: '', phone: '', city: '', nationality: '', residence_status: '',
  linkedin_url: '', github_url: '', portfolio_url: '', website_url: '',
  visa_required: false, work_permit_notes: '',
  max_commute_minutes: 30, commute_mode: 'car', address_street: '', address_zip: '',
  remote_days_preferred: 2, remote_flexibility: 'flexible',
  job_title: '', company: '', seniority: '', work_model: '', experience_years: '',
  skills: '', specializations: [], industry_experience: [], soft_skills: [], certificates: [],
  project_metrics: { max_team_size: '', max_budget: '', locations_managed: '', units_delivered: '' },
  availability_date: '', notice_period: '', remote_preference: '', relocation_willing: false,
  salary_fix: '', salary_bonus: '', salary_expectation_min: '', salary_expectation_max: '', current_salary: '',
  target_locations: [], target_industries: [], target_roles: [], target_employment_type: '',
  expose_title: '', expose_summary: '', expose_highlights: [], expose_project_highlights: [], expose_certifications: [],
  summary: '',
};

// Beschriftung: candidates:form.seniority.<wert>
const seniorityOptions = ['junior', 'mid', 'senior', 'lead', 'director'];

// Beschriftung: candidates:form.workModel.<wert>
const workModelOptions = ['fulltime', 'parttime', 'freelance', 'contract'];

// Beschriftung: candidates:form.remoteOption.<wert>
const remoteOptions = ['remote', 'hybrid', 'onsite', 'flexible'];

// Beschriftung: candidates:form.residenceStatus.<wert>
const residenceStatusOptions = ['citizen', 'permanent', 'work_visa', 'student_visa', 'pending'];

// Beschriftung: candidates:form.noticePeriod.<wert>
const noticePeriodOptions = ['immediate', '2_weeks', '1_month', '6_weeks', '2_months', '3_months', '3_months_eoq', '6_months'];

function TagInput({ 
  label, 
  values, 
  onChange, 
  placeholder 
}: { 
  label: string; 
  values: string[]; 
  onChange: (values: string[]) => void; 
  placeholder: string;
}) {
  const [input, setInput] = useState('');
  
  const handleAdd = () => {
    if (input.trim() && !values.includes(input.trim())) {
      onChange([...values, input.trim()]);
      setInput('');
    }
  };
  
  const handleRemove = (value: string) => {
    onChange(values.filter(v => v !== value));
  };
  
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input 
          value={input} 
          onChange={e => setInput(e.target.value)}
          placeholder={placeholder}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
        />
        <Button type="button" size="icon" variant="outline" onClick={handleAdd}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {values.map((value, i) => (
            <Badge key={i} variant="secondary" className="gap-1">
              {value}
              <button type="button" onClick={() => handleRemove(value)} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function CandidateFormDialog({ 
  open, 
  onOpenChange, 
  candidate, 
  onSave, 
  processing = false 
}: CandidateFormDialogProps) {
  const { t } = useTranslation('candidates');
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [activeTab, setActiveTab] = useState('personal');
  const [gdprLegalBasis, setGdprLegalBasis] = useState(false);
  const [gdprCandidateInformed, setGdprCandidateInformed] = useState(false);
  const [gdprDataRelevant, setGdprDataRelevant] = useState(false);
  const [gdprInfoExpanded, setGdprInfoExpanded] = useState(false);
  const gdprAllChecked = gdprLegalBasis && gdprCandidateInformed && gdprDataRelevant;
  const isNewCandidate = !candidate;
  
  useEffect(() => {
    if (candidate) {
      setFormData({
        full_name: candidate.full_name || '',
        email: candidate.email || '',
        phone: candidate.phone || '',
        city: candidate.city || '',
        nationality: candidate.nationality || '',
        residence_status: candidate.residence_status || '',
        linkedin_url: candidate.linkedin_url || '',
        github_url: candidate.github_url || '',
        portfolio_url: candidate.portfolio_url || '',
        website_url: candidate.website_url || '',
        visa_required: candidate.visa_required || false,
        work_permit_notes: candidate.work_permit_notes || '',
        max_commute_minutes: candidate.max_commute_minutes || 30,
        commute_mode: candidate.commute_mode || 'car',
        address_street: candidate.address_street || '',
        address_zip: candidate.address_zip || '',
        remote_days_preferred: candidate.remote_days_preferred || 2,
        remote_flexibility: candidate.remote_flexibility || 'flexible',
        job_title: candidate.job_title || '',
        company: candidate.company || '',
        seniority: candidate.seniority || '',
        work_model: candidate.work_model || '',
        experience_years: candidate.experience_years?.toString() || '',
        skills: candidate.skills?.join(', ') || '',
        specializations: candidate.specializations || [],
        industry_experience: candidate.industry_experience || [],
        soft_skills: candidate.soft_skills || [],
        certificates: (candidate.certificates || []).map(c => typeof c === 'string' ? c : c.name),
        project_metrics: {
          max_team_size: candidate.project_metrics?.max_team_size?.toString() || '',
          max_budget: candidate.project_metrics?.max_budget || '',
          locations_managed: candidate.project_metrics?.locations_managed?.toString() || '',
          units_delivered: candidate.project_metrics?.units_delivered || '',
        },
        availability_date: candidate.availability_date || '',
        notice_period: candidate.notice_period || '',
        remote_preference: candidate.remote_preference || '',
        relocation_willing: candidate.relocation_willing || false,
        salary_fix: candidate.salary_fix?.toString() || '',
        salary_bonus: candidate.salary_bonus?.toString() || '',
        salary_expectation_min: candidate.salary_expectation_min?.toString() || '',
        salary_expectation_max: candidate.salary_expectation_max?.toString() || '',
        current_salary: candidate.current_salary?.toString() || '',
        target_locations: candidate.target_locations || [],
        target_industries: candidate.target_industries || [],
        target_roles: candidate.target_roles || [],
        target_employment_type: candidate.target_employment_type || '',
        expose_title: candidate.expose_title || '',
        expose_summary: candidate.expose_summary || '',
        expose_highlights: candidate.expose_highlights || [],
        expose_project_highlights: candidate.expose_project_highlights || [],
        expose_certifications: candidate.expose_certifications || [],
        summary: candidate.summary || '',
      });
    } else {
      setFormData(initialFormData);
    }
    setActiveTab('personal');
  }, [candidate, open]);
  
  const handleSave = async () => {
    const data: any = {
      full_name: formData.full_name,
      email: formData.email,
      phone: formData.phone || null,
      city: formData.city || null,
      linkedin_url: formData.linkedin_url || null,
      github_url: formData.github_url || null,
      portfolio_url: formData.portfolio_url || null,
      website_url: formData.website_url || null,
      visa_required: formData.visa_required,
      work_permit_notes: formData.work_permit_notes || null,
      // Pendel & Remote
      max_commute_minutes: formData.max_commute_minutes,
      commute_mode: formData.commute_mode || null,
      address_street: formData.address_street || null,
      address_zip: formData.address_zip || null,
      remote_days_preferred: formData.remote_days_preferred,
      remote_flexibility: formData.remote_flexibility || null,
      // Beruf
      job_title: formData.job_title || null,
      company: formData.company || null,
      seniority: formData.seniority || null,
      work_model: formData.work_model || null,
      experience_years: formData.experience_years ? parseInt(formData.experience_years) : null,
      skills: formData.skills ? formData.skills.split(',').map(s => s.trim()).filter(Boolean) : null,
      availability_date: formData.availability_date || null,
      notice_period: formData.notice_period || null,
      remote_preference: formData.remote_preference || null,
      relocation_willing: formData.relocation_willing,
      salary_fix: formData.salary_fix ? parseInt(formData.salary_fix) : null,
      salary_bonus: formData.salary_bonus ? parseInt(formData.salary_bonus) : null,
      salary_expectation_min: formData.salary_expectation_min ? parseInt(formData.salary_expectation_min) : null,
      salary_expectation_max: formData.salary_expectation_max ? parseInt(formData.salary_expectation_max) : null,
      current_salary: formData.current_salary ? parseInt(formData.current_salary) : null,
      target_employment_type: formData.target_employment_type || null,
      summary: formData.summary || null,
      nationality: formData.nationality || null,
      residence_status: formData.residence_status || null,
      specializations: formData.specializations.length > 0 ? formData.specializations : null,
      industry_experience: formData.industry_experience.length > 0 ? formData.industry_experience : null,
      soft_skills: formData.soft_skills.length > 0 ? formData.soft_skills : null,
      certificates: formData.certificates.length > 0 ? formData.certificates : null,
      target_locations: formData.target_locations.length > 0 ? formData.target_locations : null,
      target_industries: formData.target_industries.length > 0 ? formData.target_industries : null,
      target_roles: formData.target_roles.length > 0 ? formData.target_roles : null,
      expose_title: formData.expose_title || null,
      expose_summary: formData.expose_summary || null,
      expose_highlights: formData.expose_highlights.length > 0 ? formData.expose_highlights : null,
      expose_project_highlights: formData.expose_project_highlights.length > 0 ? formData.expose_project_highlights : null,
      expose_certifications: formData.expose_certifications.length > 0 ? formData.expose_certifications : null,
    };
    
    // Project metrics
    const hasMetrics = Object.values(formData.project_metrics).some(v => v);
    if (hasMetrics) {
      data.project_metrics = {
        max_team_size: formData.project_metrics.max_team_size ? parseInt(formData.project_metrics.max_team_size) : null,
        max_budget: formData.project_metrics.max_budget || null,
        locations_managed: formData.project_metrics.locations_managed ? parseInt(formData.project_metrics.locations_managed) : null,
        units_delivered: formData.project_metrics.units_delivered || null,
      };
    }
    
    await onSave(data);
  };
  
  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {candidate ? t('form.titleEdit') : t('form.titleNew')}
          </DialogTitle>
          <DialogDescription>
            {t('form.description')}
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="personal" className="gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">{t('form.tabs.personal')}</span>
            </TabsTrigger>
            <TabsTrigger value="professional" className="gap-2">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">{t('form.tabs.professional')}</span>
            </TabsTrigger>
            <TabsTrigger value="availability" className="gap-2">
              <Euro className="h-4 w-4" />
              <span className="hidden sm:inline">{t('form.tabs.availability')}</span>
            </TabsTrigger>
            <TabsTrigger value="expose" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">{t('form.tabs.expose')}</span>
            </TabsTrigger>
          </TabsList>
          
          <ScrollArea className="flex-1 mt-4">
            {/* Tab 1: Stammdaten */}
            <TabsContent value="personal" className="m-0 space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {t('form.contact.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{t('form.contact.name')}</Label>
                      <Input 
                        value={formData.full_name} 
                        onChange={e => updateField('full_name', e.target.value)}
                        placeholder={t('form.contact.namePlaceholder')}
                      />
                    </div>
                    <div>
                      <Label>{t('form.contact.email')}</Label>
                      <Input 
                        type="email"
                        value={formData.email} 
                        onChange={e => updateField('email', e.target.value)}
                        placeholder={t('form.contact.emailPlaceholder')}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {t('form.contact.phone')}
                      </Label>
                      <Input 
                        value={formData.phone} 
                        onChange={e => updateField('phone', e.target.value)}
                        placeholder={t('form.contact.phonePlaceholder')}
                      />
                    </div>
                    <div>
                      <Label className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {t('form.contact.city')}
                      </Label>
                      <Input 
                        value={formData.city} 
                        onChange={e => updateField('city', e.target.value)}
                        placeholder={t('form.contact.cityPlaceholder')}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pendel & Remote Card */}
              <CommutePreferencesCard
                data={{
                  max_commute_minutes: formData.max_commute_minutes,
                  commute_mode: formData.commute_mode,
                  address_street: formData.address_street,
                  address_city: formData.city,
                  address_zip: formData.address_zip,
                  remote_days_preferred: formData.remote_days_preferred,
                  remote_flexibility: formData.remote_flexibility,
                }}
                onChange={(updates) => {
                  if (updates.max_commute_minutes !== undefined) updateField('max_commute_minutes', updates.max_commute_minutes);
                  if (updates.commute_mode !== undefined) updateField('commute_mode', updates.commute_mode);
                  if (updates.address_street !== undefined) updateField('address_street', updates.address_street);
                  if (updates.address_city !== undefined) updateField('city', updates.address_city);
                  if (updates.address_zip !== undefined) updateField('address_zip', updates.address_zip);
                  if (updates.remote_days_preferred !== undefined) updateField('remote_days_preferred', updates.remote_days_preferred);
                  if (updates.remote_flexibility !== undefined) updateField('remote_flexibility', updates.remote_flexibility);
                }}
                showAddress={true}
              />
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    {t('form.origin.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{t('form.origin.nationality')}</Label>
                      <Input 
                        value={formData.nationality} 
                        onChange={e => updateField('nationality', e.target.value)}
                        placeholder={t('form.origin.nationalityPlaceholder')}
                      />
                    </div>
                    <div>
                      <Label>{t('form.origin.residenceStatus')}</Label>
                      <Select value={formData.residence_status} onValueChange={v => updateField('residence_status', v)}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('form.origin.chooseStatus')} />
                        </SelectTrigger>
                        <SelectContent>
                          {residenceStatusOptions.map(opt => (
                            <SelectItem key={opt} value={opt}>{t(`form.residenceStatus.${opt}`)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>{t('form.origin.visaRequired')}</Label>
                    <Switch 
                      checked={formData.visa_required} 
                      onCheckedChange={v => updateField('visa_required', v)}
                    />
                  </div>
                  {formData.visa_required && (
                    <div>
                      <Label>{t('form.origin.workPermitNotes')}</Label>
                      <Textarea 
                        value={formData.work_permit_notes} 
                        onChange={e => updateField('work_permit_notes', e.target.value)}
                        placeholder={t('form.origin.workPermitPlaceholder')}
                        rows={2}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    {t('form.online.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="flex items-center gap-1">
                        <Linkedin className="h-3 w-3" />
                        LinkedIn
                      </Label>
                      <Input 
                        value={formData.linkedin_url} 
                        onChange={e => updateField('linkedin_url', e.target.value)}
                        placeholder="https://linkedin.com/in/..."
                      />
                    </div>
                    <div>
                      <Label className="flex items-center gap-1">
                        <Github className="h-3 w-3" />
                        GitHub
                      </Label>
                      <Input 
                        value={formData.github_url} 
                        onChange={e => updateField('github_url', e.target.value)}
                        placeholder="https://github.com/..."
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{t('form.online.portfolio')}</Label>
                      <Input 
                        value={formData.portfolio_url} 
                        onChange={e => updateField('portfolio_url', e.target.value)}
                        placeholder={t('form.online.portfolioPlaceholder')}
                      />
                    </div>
                    <div>
                      <Label>{t('form.online.website')}</Label>
                      <Input 
                        value={formData.website_url} 
                        onChange={e => updateField('website_url', e.target.value)}
                        placeholder={t('form.online.websitePlaceholder')}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Tab 2: Beruf & Skills */}
            <TabsContent value="professional" className="m-0 space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {t('form.position.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{t('form.position.role')}</Label>
                      <Input 
                        value={formData.job_title} 
                        onChange={e => updateField('job_title', e.target.value)}
                        placeholder={t('form.position.rolePlaceholder')}
                      />
                    </div>
                    <div>
                      <Label>{t('form.position.company')}</Label>
                      <Input 
                        value={formData.company} 
                        onChange={e => updateField('company', e.target.value)}
                        placeholder={t('form.position.companyPlaceholder')}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>{t('form.position.seniority')}</Label>
                      <Select value={formData.seniority} onValueChange={v => updateField('seniority', v)}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('form.choose')} />
                        </SelectTrigger>
                        <SelectContent>
                          {seniorityOptions.map(opt => (
                            <SelectItem key={opt} value={opt}>{t(`form.seniority.${opt}`)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>{t('form.position.workModel')}</Label>
                      <Select value={formData.work_model} onValueChange={v => updateField('work_model', v)}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('form.choose')} />
                        </SelectTrigger>
                        <SelectContent>
                          {workModelOptions.map(opt => (
                            <SelectItem key={opt} value={opt}>{t(`form.workModel.${opt}`)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>{t('form.position.experienceYears')}</Label>
                      <Input 
                        type="number"
                        value={formData.experience_years} 
                        onChange={e => updateField('experience_years', e.target.value)}
                        placeholder="8"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    {t('form.expertise.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>{t('form.expertise.hardSkills')}</Label>
                    <Input 
                      value={formData.skills} 
                      onChange={e => updateField('skills', e.target.value)}
                      placeholder={t('form.expertise.hardSkillsPlaceholder')}
                    />
                  </div>
                  <TagInput 
                    label={t('form.expertise.specializations')}
                    values={formData.specializations}
                    onChange={v => updateField('specializations', v)}
                    placeholder={t('form.expertise.specializationsPlaceholder')}
                  />
                  <TagInput 
                    label={t('form.expertise.softSkills')}
                    values={formData.soft_skills}
                    onChange={v => updateField('soft_skills', v)}
                    placeholder={t('form.expertise.softSkillsPlaceholder')}
                  />
                  <TagInput 
                    label={t('form.expertise.industries')}
                    values={formData.industry_experience}
                    onChange={v => updateField('industry_experience', v)}
                    placeholder={t('form.expertise.industriesPlaceholder')}
                  />
                  <TagInput 
                    label={t('form.expertise.certificates')}
                    values={formData.certificates}
                    onChange={v => updateField('certificates', v)}
                    placeholder={t('form.expertise.certificatesPlaceholder')}
                  />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    {t('form.metrics.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{t('form.metrics.teamSize')}</Label>
                      <Input 
                        type="number"
                        value={formData.project_metrics.max_team_size} 
                        onChange={e => updateField('project_metrics', { ...formData.project_metrics, max_team_size: e.target.value })}
                        placeholder="50"
                      />
                    </div>
                    <div>
                      <Label>{t('form.metrics.budget')}</Label>
                      <Input 
                        value={formData.project_metrics.max_budget} 
                        onChange={e => updateField('project_metrics', { ...formData.project_metrics, max_budget: e.target.value })}
                        placeholder={t('form.metrics.budgetPlaceholder')}
                      />
                    </div>
                    <div>
                      <Label>{t('form.metrics.locations')}</Label>
                      <Input 
                        type="number"
                        value={formData.project_metrics.locations_managed} 
                        onChange={e => updateField('project_metrics', { ...formData.project_metrics, locations_managed: e.target.value })}
                        placeholder="12"
                      />
                    </div>
                    <div>
                      <Label>{t('form.metrics.units')}</Label>
                      <Input 
                        value={formData.project_metrics.units_delivered} 
                        onChange={e => updateField('project_metrics', { ...formData.project_metrics, units_delivered: e.target.value })}
                        placeholder={t('form.metrics.unitsPlaceholder')}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Tab 3: Verfügbarkeit & Gehalt */}
            <TabsContent value="availability" className="m-0 space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {t('form.availability.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{t('form.availability.availableFrom')}</Label>
                      <Input 
                        type="date"
                        value={formData.availability_date} 
                        onChange={e => updateField('availability_date', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {t('form.availability.noticePeriod')}
                      </Label>
                      <Select value={formData.notice_period} onValueChange={v => updateField('notice_period', v)}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('form.choose')} />
                        </SelectTrigger>
                        <SelectContent>
                          {noticePeriodOptions.map(opt => (
                            <SelectItem key={opt} value={opt}>{t(`form.noticePeriod.${opt}`)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{t('form.availability.remotePreference')}</Label>
                      <Select value={formData.remote_preference} onValueChange={v => updateField('remote_preference', v)}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('form.choose')} />
                        </SelectTrigger>
                        <SelectContent>
                          {remoteOptions.map(opt => (
                            <SelectItem key={opt} value={opt}>{t(`form.remoteOption.${opt}`)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between pt-6">
                      <Label>{t('form.availability.relocation')}</Label>
                      <Switch 
                        checked={formData.relocation_willing} 
                        onCheckedChange={v => updateField('relocation_willing', v)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Euro className="h-4 w-4" />
                    {t('form.salary.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{t('form.salary.fix')}</Label>
                      <Input 
                        type="number"
                        value={formData.salary_fix} 
                        onChange={e => updateField('salary_fix', e.target.value)}
                        placeholder="85000"
                      />
                    </div>
                    <div>
                      <Label>{t('form.salary.bonus')}</Label>
                      <Input 
                        type="number"
                        value={formData.salary_bonus} 
                        onChange={e => updateField('salary_bonus', e.target.value)}
                        placeholder="15000"
                      />
                    </div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>{t('form.salary.min')}</Label>
                      <Input 
                        type="number"
                        value={formData.salary_expectation_min} 
                        onChange={e => updateField('salary_expectation_min', e.target.value)}
                        placeholder="75000"
                      />
                    </div>
                    <div>
                      <Label>{t('form.salary.max')}</Label>
                      <Input 
                        type="number"
                        value={formData.salary_expectation_max} 
                        onChange={e => updateField('salary_expectation_max', e.target.value)}
                        placeholder="95000"
                      />
                    </div>
                    <div>
                      <Label>{t('form.salary.current')}</Label>
                      <Input 
                        type="number"
                        value={formData.current_salary} 
                        onChange={e => updateField('current_salary', e.target.value)}
                        placeholder="70000"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    {t('form.preferences.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>{t('form.preferences.employmentType')}</Label>
                    <Select value={formData.target_employment_type} onValueChange={v => updateField('target_employment_type', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('form.choose')} />
                      </SelectTrigger>
                      <SelectContent>
                        {workModelOptions.map(opt => (
                          <SelectItem key={opt} value={opt}>{t(`form.workModel.${opt}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <TagInput 
                    label={t('form.preferences.locations')}
                    values={formData.target_locations}
                    onChange={v => updateField('target_locations', v)}
                    placeholder={t('form.preferences.locationsPlaceholder')}
                  />
                  <TagInput 
                    label={t('form.preferences.industries')}
                    values={formData.target_industries}
                    onChange={v => updateField('target_industries', v)}
                    placeholder={t('form.preferences.industriesPlaceholder')}
                  />
                  <TagInput 
                    label={t('form.preferences.roles')}
                    values={formData.target_roles}
                    onChange={v => updateField('target_roles', v)}
                    placeholder={t('form.preferences.rolesPlaceholder')}
                  />
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Tab 4: Exposé */}
            <TabsContent value="expose" className="m-0 space-y-6">
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    {t('form.expose.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>{t('form.expose.exposeTitle')}</Label>
                    <Input 
                      value={formData.expose_title} 
                      onChange={e => updateField('expose_title', e.target.value)}
                      placeholder={t('form.expose.exposeTitlePlaceholder')}
                    />
                  </div>
                  <div>
                    <Label>{t('form.expose.summary')}</Label>
                    <Textarea 
                      value={formData.expose_summary} 
                      onChange={e => updateField('expose_summary', e.target.value)}
                      placeholder={t('form.expose.summaryPlaceholder')}
                      rows={4}
                    />
                  </div>
                  <TagInput 
                    label={t('form.expose.highlights')}
                    values={formData.expose_highlights}
                    onChange={v => updateField('expose_highlights', v)}
                    placeholder={t('form.expose.highlightsPlaceholder')}
                  />
                  <TagInput 
                    label={t('form.expose.projectHighlights')}
                    values={formData.expose_project_highlights}
                    onChange={v => updateField('expose_project_highlights', v)}
                    placeholder={t('form.expose.projectHighlightsPlaceholder')}
                  />
                  <TagInput 
                    label={t('form.expose.certifications')}
                    values={formData.expose_certifications}
                    onChange={v => updateField('expose_certifications', v)}
                    placeholder={t('form.expose.certificationsPlaceholder')}
                  />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {t('form.summary.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div>
                    <Label>{t('form.summary.internal')}</Label>
                    <Textarea 
                      value={formData.summary} 
                      onChange={e => updateField('summary', e.target.value)}
                      placeholder={t('form.summary.internalPlaceholder')}
                      rows={4}
                    />
                  </div>
                  {(candidate as any)?.cv_ai_summary && (
                    <div className="mt-4 p-4 bg-muted rounded-lg">
                      <Label className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        {t('form.summary.aiSummary')}
                      </Label>
                      <p className="text-sm text-muted-foreground">{(candidate as any).cv_ai_summary}</p>
                    </div>
                  )}
                  {(candidate as any)?.cv_ai_bullets && ((candidate as any).cv_ai_bullets as string[])?.length > 0 && (
                    <div className="mt-4 p-4 bg-muted rounded-lg">
                      <Label className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        {t('form.summary.aiBullets')}
                      </Label>
                      <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                        {((candidate as any).cv_ai_bullets as string[]).map((bullet: string, i: number) => (
                          <li key={i}>{bullet}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
        
        {/* DSGVO section for new candidates */}
        {isNewCandidate && (
          <div className="mt-4 pt-4 border-t space-y-3">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-start gap-2.5">
                <Shield className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {t('gdpr.responsibility')}
                  </p>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                    onClick={() => setGdprInfoExpanded(!gdprInfoExpanded)}
                  >
                    {t('gdpr.learnMore')}
                    {gdprInfoExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {gdprInfoExpanded && (
                    <ul className="text-xs text-muted-foreground space-y-1 pt-2 border-t mt-2">
                      <li>{t('gdpr.deletionHint')}</li>
                      <li>{t('gdpr.talentPoolHint')}</li>
                    </ul>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <Checkbox checked={gdprLegalBasis} onCheckedChange={(v) => setGdprLegalBasis(v === true)} className="mt-0.5" />
                <span className="text-xs leading-snug">
                  {t('gdpr.legalBasis')}
                </span>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <Checkbox checked={gdprCandidateInformed} onCheckedChange={(v) => setGdprCandidateInformed(v === true)} className="mt-0.5" />
                <span className="text-xs leading-snug">
                  {t('gdpr.informed')}
                </span>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <Checkbox checked={gdprDataRelevant} onCheckedChange={(v) => setGdprDataRelevant(v === true)} className="mt-0.5" />
                <span className="text-xs leading-snug">
                  {t('gdpr.relevant')}
                </span>
              </label>
            </div>
          </div>
        )}

        <DialogFooter className="mt-4 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={processing || !formData.full_name || !formData.email || (isNewCandidate && !gdprAllChecked)}>
            {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {candidate ? t('form.save') : t('form.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
