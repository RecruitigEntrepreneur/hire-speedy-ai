import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { dateFnsLocale } from '@/lib/candidateDateLocale';
import { term } from '@/lib/candidateTerms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Calendar,
  Save,
  CheckCircle,
  MessageSquare,
  Target,
  TrendingUp,
  DollarSign,
  FileText,
  Users,
  Plus,
  X,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Candidate } from './CandidateCard';
import { useInterviewNotes, InterviewNotesFormData } from '@/hooks/useInterviewNotes';
import { useAuth } from '@/lib/auth';
import { useAIAssessment } from '@/hooks/useAIAssessment';
import { AIAssessmentCard } from '@/components/interview-intelligence/AIAssessmentCard';
import { supabase } from '@/integrations/supabase/client';

interface CandidateInterviewTabProps {
  candidate: Candidate;
  onNotesUpdated?: () => void;
}

const MOTIVATION_TAGS = [
  'Gehalt',
  'Karriere',
  'Work-Life-Balance',
  'Führung',
  'Unternehmenskultur',
  'Standort',
  'Remote',
  'Projekte',
  'Technologie',
  'Team',
  'Sicherheit',
  'Entwicklung',
];

export function CandidateInterviewTab({ candidate, onNotesUpdated }: CandidateInterviewTabProps) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation(['candidateDetail', 'candidateTerms']);
  const de = dateFnsLocale(i18n.language);
  const { notes, loading, saving, saveNotes, getFormData, emptyFormData } = useInterviewNotes(candidate.id);
  const { assessment, processing, processInterviewNotes } = useAIAssessment(candidate.id);
  const [formData, setFormData] = useState<InterviewNotesFormData>(emptyFormData);
  const [newRequirement, setNewRequirement] = useState('');
  const [recruiterProfile, setRecruiterProfile] = useState<any>(null);

  // Fetch recruiter profile for dynamic template variables
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
      if (data) setRecruiterProfile(data);
    };
    fetchProfile();
  }, [user?.id]);

  // Template variables - now dynamically from recruiter profile
  const candidateParts = candidate.full_name.split(' ');
  const templateVars = {
    anrede: candidateParts[0]?.toLowerCase().includes('frau') ? 'Frau' : 'Herr',
    kandidat_vorname: candidateParts[0] || '',
    kandidat_nachname: candidateParts.slice(1).join(' ') || '',
    recruiter_firstname: recruiterProfile?.full_name?.split(' ')[0] || 'Recruiter',
    recruiter_lastname: recruiterProfile?.full_name?.split(' ').slice(1).join(' ') || '',
    recruiter_fullname: recruiterProfile?.full_name || user?.user_metadata?.full_name || 'Recruiter',
    recruiter_role: recruiterProfile?.role_title || 'Talent Acquisition Manager',
    company_name: recruiterProfile?.company_name || 'TrustBridge',
    interview_date: format(new Date(), 'dd.MM.yyyy', { locale: de }),
  };

  useEffect(() => {
    if (notes) {
      setFormData(getFormData());
    }
  }, [notes]);

  const updateField = <K extends keyof InterviewNotesFormData>(
    field: K,
    value: InterviewNotesFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleMotivationTag = (tag: string) => {
    const current = formData.change_motivation_tags || [];
    const updated = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];
    updateField('change_motivation_tags', updated);
  };

  const addRequirement = () => {
    if (!newRequirement.trim()) return;
    const current = formData.offer_requirements || [];
    if (current.length >= 3) {
      toast.error(t('legacy.maximal_3_anforderungen_erlaubt'));
      return;
    }
    updateField('offer_requirements', [...current, newRequirement.trim()]);
    setNewRequirement('');
  };

  const removeRequirement = (index: number) => {
    const current = formData.offer_requirements || [];
    updateField('offer_requirements', current.filter((_, i) => i !== index));
  };

  const parseSalaryNumber = (val: string | null): number | null => {
    if (!val) return null;
    const cleaned = val.replace(/[^0-9.,]/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : Math.round(num > 1000 ? num : num * 1000);
  };

  const syncInterviewToCandidate = async (data: InterviewNotesFormData) => {
    const updates: Record<string, unknown> = {};

    const desired = parseSalaryNumber(data.salary_desired);
    const minimum = parseSalaryNumber(data.salary_minimum);

    if (desired) {
      updates.expected_salary = desired;
      updates.salary_expectation_max = Math.round(desired * 1.1);
    }
    if (minimum) updates.salary_expectation_min = minimum;
    if (data.notice_period) updates.notice_period = data.notice_period;

    if (Object.keys(updates).length === 0) return;

    const { error } = await supabase
      .from('candidates')
      .update(updates)
      .eq('id', candidate.id);

    if (error) {
      console.error('Sync interview→candidate failed:', error);
    }
  };

  const handleSave = async (markComplete = false) => {
    const dataToSave = {
      ...formData,
      status: markComplete ? 'completed' : 'draft',
      interview_date: formData.interview_date || new Date().toISOString(),
    };
    
    const success = await saveNotes(dataToSave);
    if (success) {
      toast.success(markComplete ? t('legacy.toast_completed') : t('legacy.toast_saved'));

      // Sync salary & notice_period to candidates table
      await syncInterviewToCandidate(dataToSave);

      onNotesUpdated?.();
      
      // Auto-trigger AI analysis when interview is completed
      if (markComplete && !assessment) {
        toast.info(t('legacy.starte_automatische_ai_analyse'));
        const extCandidate = candidate as any;
        await processInterviewNotes(
          formData as unknown as Record<string, unknown>,
          formData.additional_notes || '',
          {
            full_name: candidate.full_name,
            job_title: candidate.job_title,
            skills: candidate.skills,
            experience_years: candidate.experience_years,
            cv_ai_summary: extCandidate.cv_ai_summary,
          }
        );
      }
    } else {
      toast.error(t('legacy.fehler_beim_speichern'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={formData.status === 'completed' ? 'default' : 'secondary'}>
            {formData.status === 'completed' ? t('legacy.status_completed') : t('legacy.status_draft')}
          </Badge>
          {notes?.interview_date && (
            <span className="text-sm text-muted-foreground">
              {format(new Date(notes.interview_date), 'dd.MM.yyyy HH:mm', { locale: de })}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleSave(false)} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {t('legacy.speichern')}
          </Button>
          <Button size="sm" onClick={() => handleSave(true)} disabled={saving}>
            <CheckCircle className="h-4 w-4 mr-2" />
            {t('legacy.abschliessen')}
          </Button>
        </div>
      </div>

      {/* Interview Template */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5" />
            {t('legacy.gespraechsleitfaden')}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-4">
          <div className="p-4 bg-background rounded-lg border">
            <p className="font-medium mb-2">{t('legacy.begruessung')}</p>
            <p className="text-muted-foreground italic">
              {t('legacy.greeting', { anrede: templateVars.anrede, nachname: templateVars.kandidat_nachname, recruiter: templateVars.recruiter_fullname, company: templateVars.company_name })}
            </p>
            <p className="text-muted-foreground italic mt-2">
              {t('legacy.intro', { recruiter: templateVars.recruiter_fullname, role: templateVars.recruiter_role, company: templateVars.company_name })}
            </p>
            <p className="text-muted-foreground italic mt-2">
              {t('legacy.ich_sage_immer_es_gibt_weder_den_397f')}
            </p>
            <p className="text-muted-foreground italic mt-2">
              {t('legacy.um_herauszufinden_ob_die_werte_u_c84f')}
            </p>
            <p className="text-muted-foreground italic mt-2">
              {t('legacy.super_bevor_ich_starte_haben_sie_cfb0')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Question Blocks */}
      <Accordion type="multiple" defaultValue={['career', 'situation', 'salary', 'contract']} className="space-y-4">
        {/* Block 1: Karriereziele */}
        <AccordionItem value="career" className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <span className="font-semibold">{t('legacy.frageblock_1_karriereziele')}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div>
              <Label className="text-sm font-medium">
                {t('legacy.q_goal')}
              </Label>
              <Textarea
                className="mt-2"
                placeholder={t('legacy.notizen_eingeben')}
                value={formData.career_ultimate_goal || ''}
                onChange={(e) => updateField('career_ultimate_goal', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm font-medium">
                {t('legacy.q_3_5')}
              </Label>
              <Textarea
                className="mt-2"
                placeholder={t('legacy.notizen_eingeben')}
                value={formData.career_3_5_year_plan || ''}
                onChange={(e) => updateField('career_3_5_year_plan', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm font-medium">
                {t('legacy.q_done')}
              </Label>
              <Textarea
                className="mt-2"
                placeholder={t('legacy.notizen_eingeben')}
                value={formData.career_actions_taken || ''}
                onChange={(e) => updateField('career_actions_taken', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">{t('legacy.was_hat_gut_funktioniert')}</Label>
                <Textarea
                  className="mt-2"
                  placeholder="..."
                  value={formData.career_what_worked || ''}
                  onChange={(e) => updateField('career_what_worked', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">{t('legacy.was_hat_weniger_gut_funktioniert')}</Label>
                <Textarea
                  className="mt-2"
                  placeholder="..."
                  value={formData.career_what_didnt_work || ''}
                  onChange={(e) => updateField('career_what_didnt_work', e.target.value)}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Block 2: Aktuelle Situation & Wechselmotivation */}
        <AccordionItem value="situation" className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="font-semibold">{t('legacy.frageblock_2_aktuelle_situation_aacd')}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">
                  {t('legacy.q_positive')}
                </Label>
                <Textarea
                  className="mt-2"
                  placeholder={t('legacy.positiv')}
                  value={formData.current_positive || ''}
                  onChange={(e) => updateField('current_positive', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-sm font-medium">
                  {t('legacy.q_negative')}
                </Label>
                <Textarea
                  className="mt-2"
                  placeholder={t('legacy.negativ')}
                  value={formData.current_negative || ''}
                  onChange={(e) => updateField('current_negative', e.target.value)}
                />
              </div>
            </div>
            
            <div>
              <Label className="text-sm font-medium">
                {t('legacy.q_motivation')}
              </Label>
              <Textarea
                className="mt-2"
                placeholder={t('legacy.motivationsgruende')}
                value={formData.change_motivation || ''}
                onChange={(e) => updateField('change_motivation', e.target.value)}
              />
              <div className="mt-3">
                <Label className="text-xs text-muted-foreground">{t('legacy.motivations_tags')}</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {MOTIVATION_TAGS.map((tag) => (
                    <Badge
                      key={tag}
                      variant={formData.change_motivation_tags?.includes(tag) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleMotivationTag(tag)}
                    >
                      {term(tag)}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <Separator />
            <p className="text-sm text-muted-foreground font-medium">{t('legacy.weiterfuehrende_fragen')}</p>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">{t('legacy.ist_da_etwas_spezifisches_vorgef_404c')}</Label>
                <Textarea
                  className="mt-1"
                  placeholder="..."
                  value={formData.specific_incident || ''}
                  onChange={(e) => updateField('specific_incident', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t('legacy.wie_oft_kommt_das_vor')}</Label>
                <Textarea
                  className="mt-1"
                  placeholder="..."
                  value={formData.frequency_of_issues || ''}
                  onChange={(e) => updateField('frequency_of_issues', e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Label className="text-xs text-muted-foreground">
                {t('legacy.q_stay')}
              </Label>
              <Switch
                checked={formData.would_stay_if_matched || false}
                onCheckedChange={(val) => updateField('would_stay_if_matched', val)}
              />
              <span className="text-sm">{formData.would_stay_if_matched ? t('legacy.yes') : t('legacy.no')}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">{t('legacy.warum_jetzt_und_nicht_letztes_ja_e13b')}</Label>
                <Textarea
                  className="mt-1"
                  placeholder="..."
                  value={formData.why_now || ''}
                  onChange={(e) => updateField('why_now', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t('legacy.woran_ist_es_bei_frueheren_bewer_76b1')}</Label>
                <Textarea
                  className="mt-1"
                  placeholder="..."
                  value={formData.previous_process_issues || ''}
                  onChange={(e) => updateField('previous_process_issues', e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">{t('legacy.haben_sie_dies_intern_angesproch_53a1')}</Label>
              <Textarea
                className="mt-1"
                placeholder="..."
                value={formData.discussed_internally || ''}
                onChange={(e) => updateField('discussed_internally', e.target.value)}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Block 3: Gehalt */}
        <AccordionItem value="salary" className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <span className="font-semibold">{t('legacy.frageblock_3_gehalt')}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">{t('legacy.wo_liegen_sie_aktuell')}</Label>
                <Input
                  className="mt-2"
                  placeholder={t('legacy.ph_salary_current')}
                  value={formData.salary_current || ''}
                  onChange={(e) => updateField('salary_current', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-sm font-medium">{t('legacy.wo_moechten_sie_gerne_hin')}</Label>
                <Input
                  className="mt-2"
                  placeholder={t('legacy.ph_salary_wish')}
                  value={formData.salary_desired || ''}
                  onChange={(e) => updateField('salary_desired', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-sm font-medium">{t('legacy.was_ist_ihre_schmerzgrenze')}</Label>
                <Input
                  className="mt-2"
                  placeholder={t('legacy.ph_salary_min')}
                  value={formData.salary_minimum || ''}
                  onChange={(e) => updateField('salary_minimum', e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">
                {t('legacy.q_offer')}
              </Label>
              <div className="space-y-2 mt-2">
                {(formData.offer_requirements || []).map((req, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Badge variant="secondary" className="flex-1 justify-between">
                      {index + 1}. {req}
                      <X
                        className="h-3 w-3 ml-2 cursor-pointer hover:text-destructive"
                        onClick={() => removeRequirement(index)}
                      />
                    </Badge>
                  </div>
                ))}
                {(formData.offer_requirements?.length || 0) < 3 && (
                  <div className="flex gap-2">
                    <Input
                      placeholder={t('legacy.neue_anforderung')}
                      value={newRequirement}
                      onChange={(e) => setNewRequirement(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addRequirement()}
                    />
                    <Button size="sm" variant="outline" onClick={addRequirement}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Block 4: Vertragsrahmen */}
        <AccordionItem value="contract" className="border rounded-lg">
          <AccordionTrigger className="px-4 hover:no-underline">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <span className="font-semibold">{t('legacy.frageblock_4_vertragsrahmen')}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">{t('legacy.kuendigungsfrist')}</Label>
                <Input
                  className="mt-2"
                  placeholder={t('legacy.z_b_3_monate_zum_quartalsende')}
                  value={formData.notice_period || ''}
                  onChange={(e) => updateField('notice_period', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-sm font-medium">{t('legacy.fruehester_starttermin')}</Label>
                <Input
                  type="date"
                  className="mt-2"
                  value={formData.earliest_start_date || ''}
                  onChange={(e) => updateField('earliest_start_date', e.target.value)}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Abschluss */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            {t('legacy.abschluss')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground italic">
            {t('legacy.basierend_auf_dem_was_sie_mir_er_3b9f')}
            {t('legacy.die_naechsten_schritte_sind_sehr_f5ed')}
          </div>
          
          <div className="flex items-center gap-4">
            <Label className="text-sm font-medium">
              {t('legacy.q_recommend')}
            </Label>
            <Switch
              checked={formData.would_recommend || false}
              onCheckedChange={(val) => updateField('would_recommend', val)}
            />
            <span className="text-sm">{formData.would_recommend ? t('legacy.yes') : t('legacy.no')}</span>
          </div>

          <div>
            <Label className="text-sm font-medium">{t('legacy.notizen_zum_abschluss')}</Label>
            <Textarea
              className="mt-2"
              placeholder={t('legacy.weitere_notizen')}
              value={formData.recommendation_notes || ''}
              onChange={(e) => updateField('recommendation_notes', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Freitext / Additional Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t('legacy.freitext_additional_notes')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            className="min-h-[100px]"
            placeholder={t('legacy.spontane_notizen_waehrend_des_ge_6194')}
            value={formData.additional_notes || ''}
            onChange={(e) => updateField('additional_notes', e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Zusammenfassung für Kunden */}
      <Card className="border-green-500/30 bg-green-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-green-700">
            {t('legacy.zusammenfassung_fuer_kunden')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t('legacy.wechselmotivation')}</Label>
              <Textarea
                className="mt-1"
                placeholder={t('legacy.zusammenfassung_der_motivation')}
                value={formData.summary_motivation || ''}
                onChange={(e) => updateField('summary_motivation', e.target.value)}
              />
            </div>
            <div>
              <Label>{t('legacy.gehaltsrahmen')}</Label>
              <Input
                className="mt-1"
                placeholder={t('legacy.ph_salary_range')}
                value={formData.summary_salary || ''}
                onChange={(e) => updateField('summary_salary', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t('legacy.kuendigungsfrist')}</Label>
              <Input
                className="mt-1"
                placeholder={t('legacy.z_b_3_monate')}
                value={formData.summary_notice || ''}
                onChange={(e) => updateField('summary_notice', e.target.value)}
              />
            </div>
            <div>
              <Label>{t('legacy.key_requirements')}</Label>
              <Input
                className="mt-1"
                placeholder={t('legacy.wichtigste_anforderungen')}
                value={formData.summary_key_requirements || ''}
                onChange={(e) => updateField('summary_key_requirements', e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>{t('legacy.cultural_fit')}</Label>
            <Textarea
              className="mt-1"
              placeholder={t('legacy.einschaetzung_zum_cultural_fit')}
              value={formData.summary_cultural_fit || ''}
              onChange={(e) => updateField('summary_cultural_fit', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Buttons */}
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {t('legacy.als_entwurf_speichern')}
        </Button>
        <Button onClick={() => handleSave(true)} disabled={saving}>
          <CheckCircle className="h-4 w-4 mr-2" />
          {t('legacy.interview_abschliessen')}
        </Button>
      </div>
    </div>
  );
}
