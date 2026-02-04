import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ChevronLeft, 
  ChevronRight, 
  Target, 
  TrendingUp, 
  Euro, 
  Calendar,
  CheckCircle2,
  X,
  MessageSquare,
  ChevronDown,
  Copy,
  Check,
  Lightbulb
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInterviewNotes, InterviewNotesFormData } from '@/hooks/useInterviewNotes';
import { toast } from 'sonner';

interface InterviewCardSliderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  candidateName: string;
}

const MOTIVATION_TAGS = [
  'Gehalt', 'Work-Life-Balance', 'Karriere', 'Führung', 'Technologie',
  'Remote', 'Unternehmenskultur', 'Projekte', 'Team', 'Standort'
];

const OFFER_REQUIREMENTS = [
  'Mindestgehalt', 'Remote-Option', 'Flexible Zeiten', 'Weiterbildung',
  'Führungsrolle', 'Gute Anbindung', 'Moderner Stack', 'Flache Hierarchien'
];

const SLIDES = [
  { id: 'guide', title: 'Gesprächsleitfaden', icon: MessageSquare },
  { id: 'career', title: 'Karriereziele', icon: Target },
  { id: 'motivation', title: 'Situation & Motivation', icon: TrendingUp },
  { id: 'salary', title: 'Gehalt & Konditionen', icon: Euro },
  { id: 'closing', title: 'Abschluss & Zusammenfassung', icon: CheckCircle2 },
] as const;

type SlideId = typeof SLIDES[number]['id'];

// Script content component with copy functionality
function ScriptBlock({ 
  text, 
  className 
}: { 
  text: string; 
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("relative group", className)}>
      <div className="p-4 rounded-lg bg-muted/50 border text-sm italic leading-relaxed">
        „{text}"
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

export function InterviewCardSlider({ 
  open, 
  onOpenChange, 
  candidateId, 
  candidateName 
}: InterviewCardSliderProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const { notes, loading, saving, saveNotes, getFormData, emptyFormData } = useInterviewNotes(candidateId);
  const [localNotes, setLocalNotes] = useState<InterviewNotesFormData>(emptyFormData);
  const [isDirty, setIsDirty] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  // Extract last name for formal address
  const lastName = candidateName.split(' ').slice(-1)[0];
  const salutation = `Herr/Frau ${lastName}`;

  // Sync local notes when notes load
  useEffect(() => {
    if (notes) {
      setLocalNotes(getFormData());
      setIsDirty(false);
    }
  }, [notes, getFormData]);

  // Reset to first slide when opening
  useEffect(() => {
    if (open) {
      setCurrentSlide(0);
    }
  }, [open]);

  // Auto-save on slide change
  const handleSlideChange = useCallback(async (newSlide: number) => {
    if (isDirty) {
      await saveNotes(localNotes);
      setIsDirty(false);
    }
    setCurrentSlide(newSlide);
  }, [isDirty, localNotes, saveNotes]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't navigate if typing in input/textarea
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      if (e.key === 'ArrowRight' && currentSlide < SLIDES.length - 1) {
        handleSlideChange(currentSlide + 1);
      } else if (e.key === 'ArrowLeft' && currentSlide > 0) {
        handleSlideChange(currentSlide - 1);
      } else if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, currentSlide, handleSlideChange, onOpenChange]);

  const updateField = (field: keyof InterviewNotesFormData, value: any) => {
    setLocalNotes(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const toggleTag = (field: 'change_motivation_tags' | 'offer_requirements', tag: string) => {
    const current = localNotes[field] || [];
    const updated = current.includes(tag) 
      ? current.filter(t => t !== tag)
      : [...current, tag];
    updateField(field, updated);
  };

  const handleClose = async () => {
    if (isDirty) {
      await saveNotes(localNotes);
    }
    onOpenChange(false);
  };

  const handleComplete = async () => {
    await saveNotes({ ...localNotes, status: 'completed' });
    toast.success('Interview abgeschlossen');
    onOpenChange(false);
  };

  const SlideIcon = SLIDES[currentSlide].icon;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg">
              Interview mit {candidateName}
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Progress Dots */}
          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-1.5">
              {SLIDES.map((slide, idx) => (
                <button
                  key={slide.id}
                  onClick={() => handleSlideChange(idx)}
                  className={cn(
                    "w-2.5 h-2.5 rounded-full transition-all",
                    idx === currentSlide 
                      ? "bg-primary w-6" 
                      : idx < currentSlide
                        ? "bg-primary/50"
                        : "bg-muted-foreground/30"
                  )}
                />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">
              Karte {currentSlide + 1} von {SLIDES.length}: {SLIDES[currentSlide].title}
            </span>
          </div>
        </DialogHeader>

        {/* Slide Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="flex items-center gap-2 mb-6">
            <SlideIcon className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">{SLIDES[currentSlide].title}</h2>
          </div>

          {/* Guide Slide */}
          {currentSlide === 0 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Lightbulb className="h-4 w-4" />
                  <span className="text-sm">Klicken Sie auf die Textblöcke, um sie zu kopieren</span>
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-medium">👋 Begrüßung</Label>
                  <ScriptBlock 
                    text={`Hallo ${salutation}, ich bin [Ihr Name] von [Firma]. Wie geht es Ihnen heute?`}
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-medium">📝 Vorstellung</Label>
                  <ScriptBlock 
                    text="Bitte erlauben Sie, dass ich mich kurz vorstelle: Ich bin [Ihr Name], [Ihre Rolle] bei [Firma]. In den letzten Jahren habe ich viele Fach- und Führungskräfte erfolgreich vermittelt."
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-medium">💡 Philosophie</Label>
                  <ScriptBlock 
                    text="Ich sage immer: Es gibt weder den perfekten Bewerber noch das perfekte Unternehmen, sondern nur Menschen mit eigenen Werten und Zielen. Und nur wenn diese im Einklang sind, entsteht eine langfristige Zusammenarbeit."
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-medium">🎯 Überleitung</Label>
                  <ScriptBlock 
                    text="Um herauszufinden, ob die Werte und Ziele meines Kunden mit Ihren im Einklang stehen, müsste ich Ihnen ein paar Fragen stellen. Ist das für Sie in Ordnung?"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-medium">❓ Vorab-Check</Label>
                  <ScriptBlock 
                    text="Super — bevor ich starte, haben Sie vorab Fragen an mich?"
                  />
                </div>
              </div>

              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div className="space-y-2">
                    <p className="font-medium text-sm">Quick-Checklist vor dem Gespräch</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>☐ Profil & CV vorab durchgelesen</li>
                      <li>☐ LinkedIn-Profil angeschaut</li>
                      <li>☐ Aktuelle Projekte/Position notiert</li>
                      <li>☐ Passende Jobs im Kopf</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Career Goals Slide */}
          {currentSlide === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-base font-medium">
                  🎯 Was wollen Sie ultimativ beruflich erreichen?
                </Label>
                <Textarea
                  placeholder="Langfristiges Karriereziel..."
                  value={localNotes.career_ultimate_goal || ''}
                  onChange={(e) => updateField('career_ultimate_goal', e.target.value)}
                  className="min-h-[120px] text-base"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-base font-medium">
                  📅 Was wünschen Sie sich für die nächsten 3–5 Jahre?
                </Label>
                <Textarea
                  placeholder="Mittelfristige Ziele..."
                  value={localNotes.career_3_5_year_plan || ''}
                  onChange={(e) => updateField('career_3_5_year_plan', e.target.value)}
                  className="min-h-[100px]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-base font-medium">
                  🚀 Was haben Sie bisher unternommen, um dieses Ziel zu erreichen?
                </Label>
                <Textarea
                  placeholder="Bisherige Schritte, Maßnahmen..."
                  value={localNotes.career_actions_taken || ''}
                  onChange={(e) => updateField('career_actions_taken', e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>✅ Was hat gut funktioniert?</Label>
                  <Textarea
                    placeholder="Erfolge, gute Entscheidungen..."
                    value={localNotes.career_what_worked || ''}
                    onChange={(e) => updateField('career_what_worked', e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>❌ Was hat weniger gut funktioniert?</Label>
                  <Textarea
                    placeholder="Fehlentscheidungen, Learnings..."
                    value={localNotes.career_what_didnt_work || ''}
                    onChange={(e) => updateField('career_what_didnt_work', e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Motivation Slide */}
          {currentSlide === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-base font-medium">
                    👍 Was gefällt Ihnen an Ihrer aktuellen Situation besonders gut?
                  </Label>
                  <Textarea
                    placeholder="Positive Aspekte..."
                    value={localNotes.current_positive || ''}
                    onChange={(e) => updateField('current_positive', e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-base font-medium">
                    👎 Was gefällt Ihnen weniger? Was stört Sie?
                  </Label>
                  <Textarea
                    placeholder="Negative Aspekte..."
                    value={localNotes.current_negative || ''}
                    onChange={(e) => updateField('current_negative', e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-base font-medium">
                  ❓ Woher kommt Ihre Wechselmotivation konkret?
                </Label>
                <Textarea
                  placeholder="Auslöser für den Wechsel..."
                  value={localNotes.change_motivation || ''}
                  onChange={(e) => updateField('change_motivation', e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-base font-medium">
                  🏷️ Motivations-Tags
                </Label>
                <div className="flex flex-wrap gap-2">
                  {MOTIVATION_TAGS.map(tag => (
                    <Badge
                      key={tag}
                      variant={localNotes.change_motivation_tags?.includes(tag) ? 'default' : 'outline'}
                      className="cursor-pointer transition-colors"
                      onClick={() => toggleTag('change_motivation_tags', tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Follow-up Questions (Collapsible) */}
              <Collapsible open={followUpOpen} onOpenChange={setFollowUpOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4" />
                      Weiterführende Fragen
                    </span>
                    <ChevronDown className={cn(
                      "h-4 w-4 transition-transform",
                      followUpOpen && "rotate-180"
                    )} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>🔍 Ist da etwas Spezifisches vorgefallen?</Label>
                    <Textarea
                      placeholder="Konkrete Vorfälle, Auslöser..."
                      value={localNotes.specific_incident || ''}
                      onChange={(e) => updateField('specific_incident', e.target.value)}
                      className="min-h-[60px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>📊 Wie oft kommt das vor?</Label>
                    <Textarea
                      placeholder="Häufigkeit der Probleme..."
                      value={localNotes.frequency_of_issues || ''}
                      onChange={(e) => updateField('frequency_of_issues', e.target.value)}
                      className="min-h-[60px]"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                    <div>
                      <Label>💰 Würden Sie bleiben, wenn Ihr Arbeitgeber das Angebot matcht?</Label>
                    </div>
                    <Switch
                      checked={localNotes.would_stay_if_matched || false}
                      onCheckedChange={(checked) => updateField('would_stay_if_matched', checked)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>⏰ Warum jetzt — und nicht letztes Jahr?</Label>
                    <Textarea
                      placeholder="Timing des Wechsels..."
                      value={localNotes.why_now || ''}
                      onChange={(e) => updateField('why_now', e.target.value)}
                      className="min-h-[60px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>❌ Woran ist es bei früheren Bewerbungsprozessen gescheitert?</Label>
                    <Textarea
                      placeholder="Frühere Prozess-Probleme..."
                      value={localNotes.previous_process_issues || ''}
                      onChange={(e) => updateField('previous_process_issues', e.target.value)}
                      className="min-h-[60px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>💬 Haben Sie dies intern angesprochen? Wie wurde es aufgenommen?</Label>
                    <Textarea
                      placeholder="Interne Kommunikation..."
                      value={localNotes.discussed_internally || ''}
                      onChange={(e) => updateField('discussed_internally', e.target.value)}
                      className="min-h-[60px]"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* Salary Slide */}
          {currentSlide === 3 && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-base font-medium">💰 Wo liegen Sie aktuell?</Label>
                  <Input
                    placeholder="z.B. 65.000"
                    value={localNotes.salary_current || ''}
                    onChange={(e) => updateField('salary_current', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-base font-medium">🎯 Wo möchten Sie gerne hin?</Label>
                  <Input
                    placeholder="z.B. 75.000"
                    value={localNotes.salary_desired || ''}
                    onChange={(e) => updateField('salary_desired', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-base font-medium">⚠️ Was ist Ihre Schmerzgrenze?</Label>
                  <Input
                    placeholder="z.B. 70.000"
                    value={localNotes.salary_minimum || ''}
                    onChange={(e) => updateField('salary_minimum', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-base font-medium">
                  📋 Welche 3 Punkte müsste ein Angebot erfüllen, damit Sie es annehmen?
                </Label>
                <p className="text-sm text-muted-foreground">
                  Maximal 3 auswählen
                </p>
                <div className="flex flex-wrap gap-2">
                  {OFFER_REQUIREMENTS.map(req => {
                    const selected = localNotes.offer_requirements?.includes(req);
                    const atLimit = (localNotes.offer_requirements?.length || 0) >= 3;
                    return (
                      <Badge
                        key={req}
                        variant={selected ? 'default' : 'outline'}
                        className={cn(
                          "cursor-pointer transition-colors",
                          !selected && atLimit && "opacity-50 cursor-not-allowed"
                        )}
                        onClick={() => {
                          if (selected || !atLimit) {
                            toggleTag('offer_requirements', req);
                          }
                        }}
                      >
                        {req}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-base font-medium">⏰ Kündigungsfrist</Label>
                  <Input
                    placeholder="z.B. 3 Monate"
                    value={localNotes.notice_period || ''}
                    onChange={(e) => updateField('notice_period', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-base font-medium">📅 Frühester Starttermin</Label>
                  <Input
                    type="date"
                    value={localNotes.earliest_start_date || ''}
                    onChange={(e) => updateField('earliest_start_date', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Closing Slide */}
          {currentSlide === 4 && (
            <div className="space-y-6">
              {/* Closing Script */}
              <div className="space-y-3">
                <Label className="text-base font-medium">📝 Abschluss-Skript</Label>
                <ScriptBlock 
                  text={`Basierend auf dem, was Sie mir erzählt haben, passen Sie hervorragend auf die Position. Die nächsten Schritte sind sehr einfach: Ich leite Ihr Profil anonymisiert weiter und melde mich, sobald wir Feedback haben.`}
                />
              </div>

              {/* Recommendation */}
              <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">👍 Würden Sie diesen Kandidaten empfehlen?</Label>
                    <p className="text-sm text-muted-foreground">
                      Ihre persönliche Einschätzung
                    </p>
                  </div>
                  <Switch
                    checked={localNotes.would_recommend || false}
                    onCheckedChange={(checked) => updateField('would_recommend', checked)}
                  />
                </div>
                
                {localNotes.would_recommend !== undefined && (
                  <div className="space-y-2">
                    <Label>Begründung</Label>
                    <Textarea
                      placeholder={localNotes.would_recommend 
                        ? "Warum empfehlen Sie den Kandidaten?" 
                        : "Was spricht gegen den Kandidaten?"}
                      value={localNotes.recommendation_notes || ''}
                      onChange={(e) => updateField('recommendation_notes', e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-base font-medium">📝 Zusätzliche Notizen</Label>
                <Textarea
                  placeholder="Sonstige Beobachtungen, wichtige Details..."
                  value={localNotes.additional_notes || ''}
                  onChange={(e) => updateField('additional_notes', e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              {/* Customer Summary (Collapsible) */}
              <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Zusammenfassung für Kunden
                    </span>
                    <ChevronDown className={cn(
                      "h-4 w-4 transition-transform",
                      summaryOpen && "rotate-180"
                    )} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>💡 Wechselmotivation (Zusammenfassung)</Label>
                    <Textarea
                      placeholder="Kurze Zusammenfassung der Motivation für Kunden..."
                      value={localNotes.summary_motivation || ''}
                      onChange={(e) => updateField('summary_motivation', e.target.value)}
                      className="min-h-[60px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>💰 Gehaltsrahmen</Label>
                    <Textarea
                      placeholder="Zusammenfassung Gehaltsvorstellungen..."
                      value={localNotes.summary_salary || ''}
                      onChange={(e) => updateField('summary_salary', e.target.value)}
                      className="min-h-[60px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>⏰ Verfügbarkeit & Kündigungsfrist</Label>
                    <Textarea
                      placeholder="Zusammenfassung Verfügbarkeit..."
                      value={localNotes.summary_notice || ''}
                      onChange={(e) => updateField('summary_notice', e.target.value)}
                      className="min-h-[60px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>🎯 Key Requirements</Label>
                    <Textarea
                      placeholder="Wichtigste Anforderungen des Kandidaten..."
                      value={localNotes.summary_key_requirements || ''}
                      onChange={(e) => updateField('summary_key_requirements', e.target.value)}
                      className="min-h-[60px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>🤝 Cultural Fit</Label>
                    <Textarea
                      placeholder="Einschätzung zur kulturellen Passung..."
                      value={localNotes.summary_cultural_fit || ''}
                      onChange={(e) => updateField('summary_cultural_fit', e.target.value)}
                      className="min-h-[60px]"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 border-t bg-muted/30 shrink-0">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => handleSlideChange(currentSlide - 1)}
              disabled={currentSlide === 0}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Zurück
            </Button>

            <span className="text-xs text-muted-foreground">
              ← → zum Navigieren • {saving ? 'Speichern...' : isDirty ? 'Ungespeichert' : 'Gespeichert'}
            </span>

            {currentSlide < SLIDES.length - 1 ? (
              <Button
                onClick={() => handleSlideChange(currentSlide + 1)}
                className="gap-2"
              >
                Weiter
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleComplete} className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Interview abschließen
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
