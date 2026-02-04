import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  ChevronLeft, 
  ChevronRight, 
  Target, 
  TrendingUp, 
  Euro, 
  Calendar,
  CheckCircle2,
  X
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
  { id: 'career', title: 'Karriereziele', icon: Target },
  { id: 'motivation', title: 'Situation & Motivation', icon: TrendingUp },
  { id: 'salary', title: 'Gehalt & Konditionen', icon: Euro },
  { id: 'availability', title: 'Verfügbarkeit & Abschluss', icon: Calendar },
] as const;

type SlideId = typeof SLIDES[number]['id'];

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

  // Sync local notes when notes load
  useEffect(() => {
    if (notes) {
      setLocalNotes(getFormData());
      setIsDirty(false);
    }
  }, [notes, getFormData]);

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
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0">
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

          {/* Career Goals Slide */}
          {currentSlide === 0 && (
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
                  📅 Wo sehen Sie sich in 3-5 Jahren?
                </Label>
                <Textarea
                  placeholder="Mittelfristige Ziele..."
                  value={localNotes.career_3_5_year_plan || ''}
                  onChange={(e) => updateField('career_3_5_year_plan', e.target.value)}
                  className="min-h-[100px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>✅ Was hat bisher funktioniert?</Label>
                  <Textarea
                    placeholder="Erfolge, gute Entscheidungen..."
                    value={localNotes.career_what_worked || ''}
                    onChange={(e) => updateField('career_what_worked', e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>❌ Was hat nicht funktioniert?</Label>
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
          {currentSlide === 1 && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-base font-medium">
                    👍 Was läuft gut im aktuellen Job?
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
                    👎 Was stört Sie?
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
                  ❓ Warum jetzt wechseln?
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
            </div>
          )}

          {/* Salary Slide */}
          {currentSlide === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-base font-medium">💰 Aktuelles Gehalt</Label>
                  <Input
                    placeholder="z.B. 65.000"
                    value={localNotes.salary_current || ''}
                    onChange={(e) => updateField('salary_current', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-base font-medium">🎯 Wunschgehalt</Label>
                  <Input
                    placeholder="z.B. 75.000"
                    value={localNotes.salary_desired || ''}
                    onChange={(e) => updateField('salary_desired', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-base font-medium">⚠️ Minimum</Label>
                  <Input
                    placeholder="z.B. 70.000"
                    value={localNotes.salary_minimum || ''}
                    onChange={(e) => updateField('salary_minimum', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-base font-medium">
                  📋 3 Must-Haves für ein Angebot
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
            </div>
          )}

          {/* Availability Slide */}
          {currentSlide === 3 && (
            <div className="space-y-6">
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
                  <Label className="text-base font-medium">📅 Frühester Start</Label>
                  <Input
                    type="date"
                    value={localNotes.earliest_start_date || ''}
                    onChange={(e) => updateField('earliest_start_date', e.target.value)}
                  />
                </div>
              </div>

              <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">👍 Würden Sie empfehlen?</Label>
                    <p className="text-sm text-muted-foreground">
                      Ihre persönliche Einschätzung zum Kandidaten
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
                  className="min-h-[100px]"
                />
              </div>
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
