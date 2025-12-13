import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { Loader2, Star, ThumbsUp, ThumbsDown, Minus } from 'lucide-react';

interface InterviewFeedbackFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interviewId: string;
  candidateName: string;
  onSuccess?: () => void;
}

export function InterviewFeedbackForm({
  open,
  onOpenChange,
  interviewId,
  candidateName,
  onSuccess,
}: InterviewFeedbackFormProps) {
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [formData, setFormData] = useState({
    technicalScore: 70,
    cultureFit: 70,
    communication: 70,
    recommendation: 'proceed' as 'proceed' | 'maybe' | 'reject',
    strengths: '',
    concerns: '',
    notes: '',
  });

  const handleSubmit = async () => {
    setProcessing(true);

    try {
      // Calculate overall score
      const overallScore = Math.round(
        (formData.technicalScore + formData.cultureFit + formData.communication) / 3
      );

      // Update interview with feedback
      const { error } = await supabase
        .from('interviews')
        .update({
          feedback: JSON.stringify({
            technical_score: formData.technicalScore,
            culture_fit: formData.cultureFit,
            communication: formData.communication,
            overall_score: overallScore,
            recommendation: formData.recommendation,
            strengths: formData.strengths,
            concerns: formData.concerns,
            notes: formData.notes,
            submitted_by: user?.id,
            submitted_at: new Date().toISOString(),
          }),
          status: 'completed',
        })
        .eq('id', interviewId);

      if (error) throw error;

      toast.success('Feedback erfolgreich gespeichert');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error saving feedback:', error);
      toast.error('Fehler beim Speichern');
    } finally {
      setProcessing(false);
    }
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Ausgezeichnet';
    if (score >= 60) return 'Gut';
    if (score >= 40) return 'Akzeptabel';
    return 'Unzureichend';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-primary';
    if (score >= 40) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Interview-Feedback: {candidateName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Technical Score */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Technische Kompetenz</Label>
              <span className={`text-sm font-medium ${getScoreColor(formData.technicalScore)}`}>
                {formData.technicalScore}% - {getScoreLabel(formData.technicalScore)}
              </span>
            </div>
            <Slider
              value={[formData.technicalScore]}
              onValueChange={([value]) => setFormData({ ...formData, technicalScore: value })}
              max={100}
              step={5}
              className="w-full"
            />
          </div>

          {/* Culture Fit */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Cultural Fit</Label>
              <span className={`text-sm font-medium ${getScoreColor(formData.cultureFit)}`}>
                {formData.cultureFit}% - {getScoreLabel(formData.cultureFit)}
              </span>
            </div>
            <Slider
              value={[formData.cultureFit]}
              onValueChange={([value]) => setFormData({ ...formData, cultureFit: value })}
              max={100}
              step={5}
              className="w-full"
            />
          </div>

          {/* Communication */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Kommunikation</Label>
              <span className={`text-sm font-medium ${getScoreColor(formData.communication)}`}>
                {formData.communication}% - {getScoreLabel(formData.communication)}
              </span>
            </div>
            <Slider
              value={[formData.communication]}
              onValueChange={([value]) => setFormData({ ...formData, communication: value })}
              max={100}
              step={5}
              className="w-full"
            />
          </div>

          {/* Recommendation */}
          <div className="space-y-3">
            <Label>Empfehlung</Label>
            <RadioGroup
              value={formData.recommendation}
              onValueChange={(value: 'proceed' | 'maybe' | 'reject') => 
                setFormData({ ...formData, recommendation: value })
              }
              className="flex gap-4"
            >
              <label className="flex flex-1 items-center gap-2 p-3 rounded-lg border cursor-pointer hover:bg-accent transition-colors data-[state=checked]:border-success data-[state=checked]:bg-success/10">
                <RadioGroupItem value="proceed" id="proceed" className="sr-only" />
                <ThumbsUp className="h-5 w-5 text-success" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Weiter</p>
                  <p className="text-xs text-muted-foreground">Nächste Runde</p>
                </div>
              </label>
              
              <label className="flex flex-1 items-center gap-2 p-3 rounded-lg border cursor-pointer hover:bg-accent transition-colors data-[state=checked]:border-warning data-[state=checked]:bg-warning/10">
                <RadioGroupItem value="maybe" id="maybe" className="sr-only" />
                <Minus className="h-5 w-5 text-warning" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Unsicher</p>
                  <p className="text-xs text-muted-foreground">Weitere Prüfung</p>
                </div>
              </label>
              
              <label className="flex flex-1 items-center gap-2 p-3 rounded-lg border cursor-pointer hover:bg-accent transition-colors data-[state=checked]:border-destructive data-[state=checked]:bg-destructive/10">
                <RadioGroupItem value="reject" id="reject" className="sr-only" />
                <ThumbsDown className="h-5 w-5 text-destructive" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Ablehnen</p>
                  <p className="text-xs text-muted-foreground">Nicht geeignet</p>
                </div>
              </label>
            </RadioGroup>
          </div>

          {/* Strengths */}
          <div className="space-y-2">
            <Label>Stärken</Label>
            <Textarea
              placeholder="Was hat Sie überzeugt?"
              value={formData.strengths}
              onChange={(e) => setFormData({ ...formData, strengths: e.target.value })}
              rows={2}
            />
          </div>

          {/* Concerns */}
          <div className="space-y-2">
            <Label>Bedenken</Label>
            <Textarea
              placeholder="Was sind mögliche Risiken?"
              value={formData.concerns}
              onChange={(e) => setFormData({ ...formData, concerns: e.target.value })}
              rows={2}
            />
          </div>

          {/* Additional Notes */}
          <div className="space-y-2">
            <Label>Zusätzliche Notizen</Label>
            <Textarea
              placeholder="Weitere Beobachtungen..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={processing}>
            {processing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Feedback speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
