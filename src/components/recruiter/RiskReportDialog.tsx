import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertTriangle, Banknote, Users, HelpCircle, UserX, MoreHorizontal } from 'lucide-react';

interface RiskReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  candidateName: string;
  submissionId?: string;
  onSuccess?: () => void;
}

const RISK_TYPES = [
  { value: 'counter_offer', label: 'Gegenangebot', icon: Banknote, description: 'Kandidat hat Gegenangebot erhalten oder erwartet eines' },
  { value: 'competing_process', label: 'Konkurrenzprozess', icon: Users, description: 'Kandidat ist in anderen Bewerbungsprozessen' },
  { value: 'hesitation', label: 'Zweifel', icon: HelpCircle, description: 'Kandidat zeigt Unsicherheit bezüglich dieser Stelle' },
  { value: 'personal_situation', label: 'Persönliche Situation', icon: UserX, description: 'Persönliche Umstände könnten Einfluss haben' },
  { value: 'other', label: 'Sonstiges', icon: MoreHorizontal, description: 'Andere Risikofaktoren' },
];

const SEVERITY_LEVELS = [
  { value: 'low', label: 'Gering', color: 'text-green-600' },
  { value: 'medium', label: 'Mittel', color: 'text-yellow-600' },
  { value: 'high', label: 'Hoch', color: 'text-orange-600' },
  { value: 'critical', label: 'Kritisch', color: 'text-red-600' },
];

export function RiskReportDialog({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  submissionId,
  onSuccess
}: RiskReportDialogProps) {
  const [riskType, setRiskType] = useState<string>('');
  const [severity, setSeverity] = useState<string>('medium');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!riskType) {
      toast.error('Bitte wählen Sie einen Risikotyp');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nicht angemeldet');

      const { error } = await supabase
        .from('candidate_risk_reports')
        .insert({
          candidate_id: candidateId,
          submission_id: submissionId || null,
          recruiter_id: user.id,
          risk_type: riskType,
          severity: severity,
          description: description || null
        });

      if (error) throw error;

      // Trigger deal health recalculation
      if (submissionId) {
        await supabase.functions.invoke('deal-health', {
          body: { submission_id: submissionId }
        });
      }

      toast.success('Risiko gemeldet');
      onOpenChange(false);
      setRiskType('');
      setSeverity('medium');
      setDescription('');
      onSuccess?.();
    } catch (error) {
      console.error('Error reporting risk:', error);
      toast.error('Fehler beim Melden des Risikos');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedRiskType = RISK_TYPES.find(r => r.value === riskType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Risiko melden
          </DialogTitle>
          <DialogDescription>
            Melden Sie ein Risiko für {candidateName}, das den Deal gefährden könnte
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Art des Risikos</Label>
            <RadioGroup value={riskType} onValueChange={setRiskType} className="space-y-2">
              {RISK_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <div 
                    key={type.value}
                    className="flex items-center space-x-3 p-3 rounded-lg border border-input hover:bg-muted/50 cursor-pointer"
                  >
                    <RadioGroupItem value={type.value} id={type.value} />
                    <Label htmlFor={type.value} className="flex items-center gap-3 cursor-pointer flex-1">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{type.label}</p>
                        <p className="text-xs text-muted-foreground">{type.description}</p>
                      </div>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Schweregrad</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEVERITY_LEVELS.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    <span className={level.color}>{level.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beschreibung</Label>
            <Textarea
              id="description"
              placeholder="Beschreiben Sie das Risiko und relevante Details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {selectedRiskType && severity === 'critical' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              <p className="font-medium">Kritisches Risiko</p>
              <p className="text-xs mt-1">Der Kunde wird über dieses kritische Risiko informiert. Deal Health wird entsprechend angepasst.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !riskType}>
            {isSubmitting ? 'Speichern...' : 'Risiko melden'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
