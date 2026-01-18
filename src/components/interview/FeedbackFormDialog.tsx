import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Star, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useInterviewFeedback, FeedbackData, InterviewFeedback } from '@/hooks/useInterviewFeedback';
import { cn } from '@/lib/utils';

interface FeedbackFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interviewId: string;
  candidateName?: string;
  existingFeedback?: InterviewFeedback | null;
}

const ratingCategories = [
  { key: 'technical_skills', label: 'Technische Fähigkeiten' },
  { key: 'communication', label: 'Kommunikation' },
  { key: 'culture_fit', label: 'Culture Fit' },
  { key: 'motivation', label: 'Motivation' },
  { key: 'problem_solving', label: 'Problemlösung' },
] as const;

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className="p-0.5 transition-transform hover:scale-110"
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star)}
        >
          <Star
            className={cn(
              'h-6 w-6 transition-colors',
              star <= (hover || value)
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-muted-foreground'
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function FeedbackFormDialog({
  open,
  onOpenChange,
  interviewId,
  candidateName,
  existingFeedback,
}: FeedbackFormDialogProps) {
  const { submitFeedback } = useInterviewFeedback(interviewId);
  
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [overallRating, setOverallRating] = useState(0);
  const [pros, setPros] = useState<string[]>([]);
  const [cons, setCons] = useState<string[]>([]);
  const [newPro, setNewPro] = useState('');
  const [newCon, setNewCon] = useState('');
  const [recommendation, setRecommendation] = useState<string>('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (existingFeedback) {
      setRatings({
        technical_skills: existingFeedback.technical_skills || 0,
        communication: existingFeedback.communication || 0,
        culture_fit: existingFeedback.culture_fit || 0,
        motivation: existingFeedback.motivation || 0,
        problem_solving: existingFeedback.problem_solving || 0,
      });
      setOverallRating(existingFeedback.overall_rating || 0);
      setPros(existingFeedback.pros || []);
      setCons(existingFeedback.cons || []);
      setRecommendation(existingFeedback.recommendation || '');
      setNotes(existingFeedback.notes || '');
    }
  }, [existingFeedback]);

  const handleAddPro = () => {
    if (newPro.trim()) {
      setPros([...pros, newPro.trim()]);
      setNewPro('');
    }
  };

  const handleAddCon = () => {
    if (newCon.trim()) {
      setCons([...cons, newCon.trim()]);
      setNewCon('');
    }
  };

  const handleSubmit = async () => {
    const feedback: FeedbackData = {
      technical_skills: ratings.technical_skills || undefined,
      communication: ratings.communication || undefined,
      culture_fit: ratings.culture_fit || undefined,
      motivation: ratings.motivation || undefined,
      problem_solving: ratings.problem_solving || undefined,
      overall_rating: overallRating || undefined,
      pros: pros.length > 0 ? pros : undefined,
      cons: cons.length > 0 ? cons : undefined,
      recommendation: recommendation as FeedbackData['recommendation'] || undefined,
      notes: notes || undefined,
    };

    await submitFeedback.mutateAsync({ interviewId, feedback });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Interview-Feedback{candidateName && ` für ${candidateName}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Rating Categories */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Bewertungen</Label>
            {ratingCategories.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm">{label}</span>
                <StarRating
                  value={ratings[key] || 0}
                  onChange={(v) => setRatings({ ...ratings, [key]: v })}
                />
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm font-medium">Gesamtbewertung</span>
              <StarRating value={overallRating} onChange={setOverallRating} />
            </div>
          </div>

          {/* Pros */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Stärken</Label>
            <div className="flex flex-wrap gap-2">
              {pros.map((pro, i) => (
                <Badge key={i} variant="secondary" className="gap-1">
                  {pro}
                  <button onClick={() => setPros(pros.filter((_, idx) => idx !== i))}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Stärke hinzufügen..."
                value={newPro}
                onChange={(e) => setNewPro(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddPro())}
              />
              <Button type="button" size="icon" variant="outline" onClick={handleAddPro}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Cons */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Schwächen</Label>
            <div className="flex flex-wrap gap-2">
              {cons.map((con, i) => (
                <Badge key={i} variant="destructive" className="gap-1">
                  {con}
                  <button onClick={() => setCons(cons.filter((_, idx) => idx !== i))}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Schwäche hinzufügen..."
                value={newCon}
                onChange={(e) => setNewCon(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCon())}
              />
              <Button type="button" size="icon" variant="outline" onClick={handleAddCon}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Recommendation */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Empfehlung</Label>
            <RadioGroup value={recommendation} onValueChange={setRecommendation}>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="hire" id="hire" />
                  <Label htmlFor="hire" className="text-sm font-normal cursor-pointer">
                    ✅ Einstellen
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="next_round" id="next_round" />
                  <Label htmlFor="next_round" className="text-sm font-normal cursor-pointer">
                    ➡️ Nächste Runde
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="reject" id="reject" />
                  <Label htmlFor="reject" className="text-sm font-normal cursor-pointer">
                    ❌ Ablehnen
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="undecided" id="undecided" />
                  <Label htmlFor="undecided" className="text-sm font-normal cursor-pointer">
                    🤔 Unentschlossen
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Notizen</Label>
            <Textarea
              placeholder="Weitere Anmerkungen zum Interview..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={submitFeedback.isPending}>
            {submitFeedback.isPending ? 'Speichern...' : 'Feedback speichern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
