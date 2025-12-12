import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
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
      toast.error('Maximal 3 Anforderungen erlaubt');
      return;
    }
    updateField('offer_requirements', [...current, newRequirement.trim()]);
    setNewRequirement('');
  };

  const removeRequirement = (index: number) => {
    const current = formData.offer_requirements || [];
    updateField('offer_requirements', current.filter((_, i) => i !== index));
  };

  const handleSave = async (markComplete = false) => {
    const dataToSave = {
      ...formData,
      status: markComplete ? 'completed' : 'draft',
      interview_date: formData.interview_date || new Date().toISOString(),
    };
    
    const success = await saveNotes(dataToSave);
    if (success) {
      toast.success(markComplete ? 'Interview abgeschlossen' : 'Notizen gespeichert');
      onNotesUpdated?.();
      
      // Auto-trigger AI analysis when interview is completed
      if (markComplete && !assessment) {
        toast.info('Starte automatische AI-Analyse...');
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
      toast.error('Fehler beim Speichern');
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
            {formData.status === 'completed' ? 'Abgeschlossen' : 'Entwurf'}
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
            Speichern
          </Button>
          <Button size="sm" onClick={() => handleSave(true)} disabled={saving}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Abschließen
          </Button>
        </div>
      </div>

      {/* Interview Template */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5" />
            Gesprächsleitfaden
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-4">
          <div className="p-4 bg-background rounded-lg border">
            <p className="font-medium mb-2">Begrüßung:</p>
            <p className="text-muted-foreground italic">
              „Hallo {templateVars.anrede} {templateVars.kandidat_nachname}, ich bin {templateVars.recruiter_fullname} von {templateVars.company_name}. Wie geht es Ihnen heute?"
            </p>
            <p className="text-muted-foreground italic mt-2">
              „Bitte erlauben Sie, dass ich mich kurz vorstelle: Ich bin {templateVars.recruiter_fullname}, {templateVars.recruiter_role} bei {templateVars.company_name}. In den letzten 6 Jahren habe ich über 400 Menschen erfolgreich vermittelt."
            </p>
            <p className="text-muted-foreground italic mt-2">
              „Ich sage immer: Es gibt weder den perfekten Bewerber noch das perfekte Unternehmen, sondern nur Menschen mit eigenen Werten und Zielen. Und nur wenn diese im Einklang sind, entsteht eine langfristige Zusammenarbeit."
            </p>
            <p className="text-muted-foreground italic mt-2">
              „Um herauszufinden, ob die Werte und Ziele meines Kunden mit Ihren im Einklang stehen, müsste ich Ihnen ein paar Fragen stellen. Ist das für Sie in Ordnung?"
            </p>
            <p className="text-muted-foreground italic mt-2">
              „Super — bevor ich starte, haben Sie vorab Fragen an mich?"
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
              <span className="font-semibold">Frageblock 1 – Karriereziele</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div>
              <Label className="text-sm font-medium">
                ❓ Was wollen Sie ultimativ beruflich erreichen?
              </Label>
              <Textarea
                className="mt-2"
                placeholder="Notizen eingeben..."
                value={formData.career_ultimate_goal || ''}
                onChange={(e) => updateField('career_ultimate_goal', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm font-medium">
                ❓ Was wünschen Sie sich für die nächsten 3–5 Jahre?
              </Label>
              <Textarea
                className="mt-2"
                placeholder="Notizen eingeben..."
                value={formData.career_3_5_year_plan || ''}
                onChange={(e) => updateField('career_3_5_year_plan', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm font-medium">
                ❓ Was haben Sie bisher unternommen, um dieses Ziel zu erreichen?
              </Label>
              <Textarea
                className="mt-2"
                placeholder="Notizen eingeben..."
                value={formData.career_actions_taken || ''}
                onChange={(e) => updateField('career_actions_taken', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">Was hat gut funktioniert?</Label>
                <Textarea
                  className="mt-2"
                  placeholder="..."
                  value={formData.career_what_worked || ''}
                  onChange={(e) => updateField('career_what_worked', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Was hat weniger gut funktioniert?</Label>
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
              <span className="font-semibold">Frageblock 2 – Aktuelle Situation & Wechselmotivation</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">
                  ❓ Was gefällt Ihnen an Ihrer aktuellen Situation besonders gut?
                </Label>
                <Textarea
                  className="mt-2"
                  placeholder="Positiv..."
                  value={formData.current_positive || ''}
                  onChange={(e) => updateField('current_positive', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-sm font-medium">
                  ❓ Was gefällt Ihnen weniger? Was stört Sie?
                </Label>
                <Textarea
                  className="mt-2"
                  placeholder="Negativ..."
                  value={formData.current_negative || ''}
                  onChange={(e) => updateField('current_negative', e.target.value)}
                />
              </div>
            </div>
            
            <div>
              <Label className="text-sm font-medium">
                ❓ Woher kommt Ihre Wechselmotivation konkret?
              </Label>
              <Textarea
                className="mt-2"
                placeholder="Motivationsgründe..."
                value={formData.change_motivation || ''}
                onChange={(e) => updateField('change_motivation', e.target.value)}
              />
              <div className="mt-3">
                <Label className="text-xs text-muted-foreground">Motivations-Tags:</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {MOTIVATION_TAGS.map((tag) => (
                    <Badge
                      key={tag}
                      variant={formData.change_motivation_tags?.includes(tag) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleMotivationTag(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <Separator />
            <p className="text-sm text-muted-foreground font-medium">Weiterführende Fragen:</p>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Ist da etwas Spezifisches vorgefallen?</Label>
                <Textarea
                  className="mt-1"
                  placeholder="..."
                  value={formData.specific_incident || ''}
                  onChange={(e) => updateField('specific_incident', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Wie oft kommt das vor?</Label>
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
                Würden Sie bleiben, wenn Ihr Arbeitgeber das Angebot matcht?
              </Label>
              <Switch
                checked={formData.would_stay_if_matched || false}
                onCheckedChange={(val) => updateField('would_stay_if_matched', val)}
              />
              <span className="text-sm">{formData.would_stay_if_matched ? 'Ja' : 'Nein'}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Warum jetzt — und nicht letztes Jahr?</Label>
                <Textarea
                  className="mt-1"
                  placeholder="..."
                  value={formData.why_now || ''}
                  onChange={(e) => updateField('why_now', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Woran ist es bei früheren Bewerbungsprozessen gescheitert?</Label>
                <Textarea
                  className="mt-1"
                  placeholder="..."
                  value={formData.previous_process_issues || ''}
                  onChange={(e) => updateField('previous_process_issues', e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Haben Sie dies intern angesprochen? Wie wurde es aufgenommen?</Label>
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
              <span className="font-semibold">Frageblock 3 – Gehalt</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">❓ Wo liegen Sie aktuell?</Label>
                <Input
                  className="mt-2"
                  placeholder="z.B. 65.000 €"
                  value={formData.salary_current || ''}
                  onChange={(e) => updateField('salary_current', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-sm font-medium">❓ Wo möchten Sie gerne hin?</Label>
                <Input
                  className="mt-2"
                  placeholder="z.B. 75.000 €"
                  value={formData.salary_desired || ''}
                  onChange={(e) => updateField('salary_desired', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-sm font-medium">❓ Was ist Ihre Schmerzgrenze?</Label>
                <Input
                  className="mt-2"
                  placeholder="z.B. 70.000 €"
                  value={formData.salary_minimum || ''}
                  onChange={(e) => updateField('salary_minimum', e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">
                ❓ Welche 3 Punkte müsste ein Angebot erfüllen, damit Sie es annehmen?
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
                      placeholder="Neue Anforderung..."
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
              <span className="font-semibold">Frageblock 4 – Vertragsrahmen</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Kündigungsfrist</Label>
                <Input
                  className="mt-2"
                  placeholder="z.B. 3 Monate zum Quartalsende"
                  value={formData.notice_period || ''}
                  onChange={(e) => updateField('notice_period', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Frühester Starttermin</Label>
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
            Abschluss
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground italic">
            „Basierend auf dem, was Sie mir erzählt haben, passen Sie hervorragend auf die Position.
            Die nächsten Schritte sind sehr einfach: Ich leite Ihr Profil anonymisiert weiter und melde mich, sobald wir Feedback haben."
          </div>
          
          <div className="flex items-center gap-4">
            <Label className="text-sm font-medium">
              Empfehlung auf LinkedIn/Google?
            </Label>
            <Switch
              checked={formData.would_recommend || false}
              onCheckedChange={(val) => updateField('would_recommend', val)}
            />
            <span className="text-sm">{formData.would_recommend ? 'Ja' : 'Nein'}</span>
          </div>

          <div>
            <Label className="text-sm font-medium">Notizen zum Abschluss</Label>
            <Textarea
              className="mt-2"
              placeholder="Weitere Notizen..."
              value={formData.recommendation_notes || ''}
              onChange={(e) => updateField('recommendation_notes', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Freitext / Additional Notes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Freitext / Additional Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            className="min-h-[100px]"
            placeholder="Spontane Notizen während des Gesprächs..."
            value={formData.additional_notes || ''}
            onChange={(e) => updateField('additional_notes', e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Zusammenfassung für Kunden */}
      <Card className="border-green-500/30 bg-green-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-green-700">
            📋 Zusammenfassung für Kunden
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Wechselmotivation</Label>
              <Textarea
                className="mt-1"
                placeholder="Zusammenfassung der Motivation..."
                value={formData.summary_motivation || ''}
                onChange={(e) => updateField('summary_motivation', e.target.value)}
              />
            </div>
            <div>
              <Label>Gehaltsrahmen</Label>
              <Input
                className="mt-1"
                placeholder="z.B. 70.000 - 80.000 €"
                value={formData.summary_salary || ''}
                onChange={(e) => updateField('summary_salary', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Kündigungsfrist</Label>
              <Input
                className="mt-1"
                placeholder="z.B. 3 Monate"
                value={formData.summary_notice || ''}
                onChange={(e) => updateField('summary_notice', e.target.value)}
              />
            </div>
            <div>
              <Label>Key Requirements</Label>
              <Input
                className="mt-1"
                placeholder="Wichtigste Anforderungen..."
                value={formData.summary_key_requirements || ''}
                onChange={(e) => updateField('summary_key_requirements', e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Cultural Fit</Label>
            <Textarea
              className="mt-1"
              placeholder="Einschätzung zum Cultural Fit..."
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
          Als Entwurf speichern
        </Button>
        <Button onClick={() => handleSave(true)} disabled={saving}>
          <CheckCircle className="h-4 w-4 mr-2" />
          Interview abschließen
        </Button>
      </div>
    </div>
  );
}
