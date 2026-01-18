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
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useScorecards, useScorecardEvaluations, ScorecardScore, JobScorecard } from '@/hooks/useScorecards';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardList, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ScorecardEvaluationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interviewId: string;
  jobId: string;
  candidateName?: string;
}

const categoryLabels: Record<string, string> = {
  technical: 'Technisch',
  soft_skills: 'Soft Skills',
  experience: 'Erfahrung',
  culture: 'Kultur',
};

const categoryColors: Record<string, string> = {
  technical: 'bg-blue-100 text-blue-800',
  soft_skills: 'bg-green-100 text-green-800',
  experience: 'bg-purple-100 text-purple-800',
  culture: 'bg-orange-100 text-orange-800',
};

export function ScorecardEvaluationForm({
  open,
  onOpenChange,
  interviewId,
  jobId,
  candidateName,
}: ScorecardEvaluationFormProps) {
  const { scorecards, isLoading: scorecardsLoading } = useScorecards(jobId);
  const { submitEvaluation } = useScorecardEvaluations(interviewId);

  const [selectedScorecardId, setSelectedScorecardId] = useState<string>('');
  const [scores, setScores] = useState<Record<string, { score: number; notes: string }>>({});
  const [generalNotes, setGeneralNotes] = useState('');

  const selectedScorecard = scorecards?.find(sc => sc.id === selectedScorecardId);

  useEffect(() => {
    if (scorecards && scorecards.length > 0 && !selectedScorecardId) {
      const defaultScorecard = scorecards.find(sc => sc.is_default) || scorecards[0];
      setSelectedScorecardId(defaultScorecard.id);
    }
  }, [scorecards, selectedScorecardId]);

  useEffect(() => {
    if (selectedScorecard) {
      const initialScores: Record<string, { score: number; notes: string }> = {};
      selectedScorecard.criteria.forEach(c => {
        initialScores[c.id] = { score: 3, notes: '' };
      });
      setScores(initialScores);
    }
  }, [selectedScorecard]);

  const calculateTotalScore = () => {
    if (!selectedScorecard) return 0;
    
    let totalWeight = 0;
    let weightedSum = 0;

    selectedScorecard.criteria.forEach(c => {
      const score = scores[c.id]?.score || 0;
      weightedSum += score * c.weight;
      totalWeight += c.weight;
    });

    return totalWeight > 0 ? (weightedSum / totalWeight) * 20 : 0;
  };

  const handleSubmit = async () => {
    if (!selectedScorecard) return;

    const scorecardScores: ScorecardScore[] = selectedScorecard.criteria.map(c => ({
      criterion_id: c.id,
      score: scores[c.id]?.score || 0,
      notes: scores[c.id]?.notes || undefined,
    }));

    await submitEvaluation.mutateAsync({
      interviewId,
      scorecardId: selectedScorecard.id,
      scores: scorecardScores,
      notes: generalNotes || undefined,
    });

    onOpenChange(false);
  };

  if (scorecardsLoading) {
    return null;
  }

  if (!scorecards || scorecards.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scorecard-Bewertung</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Für diese Position sind keine Scorecards definiert.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Erstellen Sie zuerst eine Scorecard in den Job-Einstellungen.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Scorecard-Bewertung{candidateName && ` - ${candidateName}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Scorecard Selection */}
          {scorecards.length > 1 && (
            <div className="space-y-2">
              <Label>Scorecard auswählen</Label>
              <Select value={selectedScorecardId} onValueChange={setSelectedScorecardId}>
                <SelectTrigger>
                  <SelectValue placeholder="Scorecard wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {scorecards.map(sc => (
                    <SelectItem key={sc.id} value={sc.id}>
                      {sc.name}
                      {sc.is_default && ' (Standard)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Criteria Scores */}
          {selectedScorecard && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Kriterien bewerten</Label>
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {calculateTotalScore().toFixed(0)}%
                </Badge>
              </div>

              {selectedScorecard.criteria.map(criterion => (
                <Card key={criterion.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{criterion.name}</span>
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${categoryColors[criterion.category] || ''}`}
                          >
                            {categoryLabels[criterion.category] || criterion.category}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Gewicht: {criterion.weight}×
                          </Badge>
                        </div>
                        {criterion.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {criterion.description}
                          </p>
                        )}
                      </div>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>1 = Ungenügend, 5 = Hervorragend</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground w-4">1</span>
                      <Slider
                        value={[scores[criterion.id]?.score || 3]}
                        onValueChange={([value]) => 
                          setScores(prev => ({
                            ...prev,
                            [criterion.id]: { ...prev[criterion.id], score: value },
                          }))
                        }
                        min={1}
                        max={5}
                        step={1}
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground w-4">5</span>
                      <Badge variant="secondary" className="w-8 justify-center">
                        {scores[criterion.id]?.score || 3}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* General Notes */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Allgemeine Notizen</Label>
            <Textarea
              placeholder="Weitere Anmerkungen zur Bewertung..."
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={submitEvaluation.isPending}>
            {submitEvaluation.isPending ? 'Speichern...' : 'Bewertung speichern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
