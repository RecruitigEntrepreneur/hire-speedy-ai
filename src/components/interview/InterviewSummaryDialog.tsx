import React, { useState } from 'react';
import { ThumbsUp, RefreshCw, ThumbsDown, Clock, MessageSquare, Star } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { InterviewNote } from '@/hooks/useLiveInterviewNotes';
import { QuickScores } from '@/hooks/useInterviewSession';

type Recommendation = 'hire' | 'next_round' | 'reject' | null;

interface InterviewSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateName: string;
  duration: string;
  notes: InterviewNote[];
  quickScores: QuickScores;
  onSubmit: (data: {
    recommendation: Recommendation;
    comment: string;
    quickScores: QuickScores;
  }) => void;
}

const RECOMMENDATION_OPTIONS: { value: Recommendation; label: string; icon: React.ElementType; color: string; bgColor: string }[] = [
  { 
    value: 'hire', 
    label: 'EINSTELLEN', 
    icon: ThumbsUp, 
    color: 'text-green-600',
    bgColor: 'border-green-500 bg-green-500/10 hover:bg-green-500/20'
  },
  { 
    value: 'next_round', 
    label: 'NÄCHSTE RUNDE', 
    icon: RefreshCw, 
    color: 'text-amber-600',
    bgColor: 'border-amber-500 bg-amber-500/10 hover:bg-amber-500/20'
  },
  { 
    value: 'reject', 
    label: 'ABSAGEN', 
    icon: ThumbsDown, 
    color: 'text-red-600',
    bgColor: 'border-red-500 bg-red-500/10 hover:bg-red-500/20'
  },
];

export function InterviewSummaryDialog({
  open,
  onOpenChange,
  candidateName,
  duration,
  notes,
  quickScores,
  onSubmit,
}: InterviewSummaryDialogProps) {
  const [recommendation, setRecommendation] = useState<Recommendation>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const strengthCount = notes.filter(n => n.note_type === 'strength').length;
  const concernCount = notes.filter(n => n.note_type === 'concern').length;

  const handleSubmit = async () => {
    setSubmitting(true);
    await onSubmit({
      recommendation,
      comment,
      quickScores,
    });
    setSubmitting(false);
    onOpenChange(false);
  };

  const renderStars = (value: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={cn(
              "h-4 w-4",
              i < value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
            )}
          />
        ))}
        <span className="ml-1 text-xs text-muted-foreground">({value * 20}%)</span>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🎯 Interview abschließen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="text-center">
              <Clock className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-lg font-semibold">{duration}</p>
              <p className="text-xs text-muted-foreground">Dauer</p>
            </div>
            <div className="text-center">
              <MessageSquare className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-lg font-semibold">{notes.length}</p>
              <p className="text-xs text-muted-foreground">Notizen</p>
            </div>
            <div className="text-center">
              <div className="flex justify-center gap-1 mb-1">
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">
                  {strengthCount} ⭐
                </Badge>
                <Badge variant="secondary" className="bg-orange-500/10 text-orange-600">
                  {concernCount} ⚠️
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Highlights</p>
            </div>
          </div>

          {/* Quick scores summary */}
          {Object.keys(quickScores).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Ihre Bewertungen</h4>
              <div className="space-y-1.5">
                {quickScores.technical !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Technisch</span>
                    {renderStars(quickScores.technical)}
                  </div>
                )}
                {quickScores.communication !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Kommunikation</span>
                    {renderStars(quickScores.communication)}
                  </div>
                )}
                {quickScores.culture_fit !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Culture Fit</span>
                    {renderStars(quickScores.culture_fit)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recommendation selection */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Ihre Empfehlung für {candidateName}</h4>
            <div className="grid grid-cols-3 gap-3">
              {RECOMMENDATION_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = recommendation === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRecommendation(option.value)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                      isSelected 
                        ? option.bgColor + " border-current" 
                        : "border-border hover:border-muted-foreground/50"
                    )}
                  >
                    <Icon className={cn("h-6 w-6", isSelected ? option.color : "text-muted-foreground")} />
                    <span className={cn(
                      "text-xs font-semibold",
                      isSelected ? option.color : "text-muted-foreground"
                    )}>
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Kommentar (optional)</label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Zusammenfassung Ihrer Eindrücke..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Zurück
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!recommendation || submitting}
          >
            {submitting ? 'Wird gespeichert...' : '✅ Abschließen & Speichern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
