import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Car, MapPin, Clock, Building2, AlertTriangle, 
  MessageSquare, Mail, Phone, CheckCircle2, XCircle, HelpCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CommuteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: {
    id: string;
    full_name: string;
    email?: string;
    phone?: string;
    max_commute_minutes?: number;
    preferred_channel?: string;
  };
  job: {
    id: string;
    title: string;
    company_name?: string;
    location?: string;
    onsite_days_required?: number;
  };
  travelTime: number;
  onResponse?: (response: 'yes' | 'conditional' | 'no') => void;
}

const responseOptions = [
  { 
    value: 'yes' as const, 
    label: 'Ja, passt für mich', 
    icon: CheckCircle2, 
    color: 'text-green-600 bg-green-50 border-green-200 hover:bg-green-100' 
  },
  { 
    value: 'conditional' as const, 
    label: 'Nur unter Bedingungen', 
    icon: HelpCircle, 
    color: 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100' 
  },
  { 
    value: 'no' as const, 
    label: 'Nein, zu weit', 
    icon: XCircle, 
    color: 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100' 
  },
];

export function CommuteConfirmationDialog({
  open,
  onOpenChange,
  candidate,
  job,
  travelTime,
  onResponse,
}: CommuteConfirmationDialogProps) {
  const [selectedResponse, setSelectedResponse] = useState<'yes' | 'conditional' | 'no' | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const overrunPercent = candidate.max_commute_minutes 
    ? Math.round(((travelTime - candidate.max_commute_minutes) / candidate.max_commute_minutes) * 100)
    : 0;

  const generateMessage = () => {
    const onsiteDaysText = job.onsite_days_required 
      ? `(${job.onsite_days_required} Tag${job.onsite_days_required > 1 ? 'e' : ''} vor Ort pro Woche)`
      : '';
    
    return `Hallo ${candidate.full_name.split(' ')[0]},

für die Position "${job.title}"${job.company_name ? ` bei ${job.company_name}` : ''} beträgt die geschätzte Fahrtzeit etwa ${travelTime} Minuten pro Strecke ${onsiteDaysText}.

${candidate.max_commute_minutes ? `Sie hatten in unserem Gespräch ca. ${candidate.max_commute_minutes} Minuten als Ihre bevorzugte maximale Pendelzeit genannt.` : ''}

Wäre diese Distanz für Sie dennoch akzeptabel?

Bitte lassen Sie mich wissen, wie Sie dazu stehen.

Beste Grüße`;
  };

  const handleSaveResponse = async () => {
    if (!selectedResponse) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('commute_overrides')
        .upsert({
          candidate_id: candidate.id,
          job_id: job.id,
          accepted_commute_minutes: selectedResponse === 'yes' ? travelTime : null,
          response: selectedResponse,
          response_notes: notes || null,
          responded_at: new Date().toISOString(),
        }, {
          onConflict: 'candidate_id,job_id',
        });

      if (error) throw error;

      toast.success('Antwort gespeichert');
      onResponse?.(selectedResponse);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving commute override:', error);
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(generateMessage());
    toast.success('Nachricht kopiert');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Pendeldistanz prüfen
          </DialogTitle>
          <DialogDescription>
            Die Pendelzeit für diese Stelle überschreitet die Präferenz des Kandidaten
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info Card */}
          <Card className="bg-muted/50">
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{job.title}</span>
                </div>
                {job.onsite_days_required && (
                  <Badge variant="outline">
                    {job.onsite_days_required}x vor Ort
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Fahrtzeit:</span>
                  <Badge variant="secondary" className="font-mono">
                    {travelTime} Min
                  </Badge>
                </div>
                
                {candidate.max_commute_minutes && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Präferenz:</span>
                    <Badge variant="outline" className="font-mono">
                      max. {candidate.max_commute_minutes} Min
                    </Badge>
                  </div>
                )}
              </div>

              {overrunPercent > 0 && (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">
                    {overrunPercent}% über der gewünschten Pendelzeit
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Response Selection */}
          <div className="space-y-2">
            <span className="text-sm font-medium">Kandidaten-Antwort erfassen:</span>
            <div className="grid grid-cols-3 gap-2">
              {responseOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = selectedResponse === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSelectedResponse(option.value)}
                    className={`
                      flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all text-center
                      ${isSelected ? option.color + ' border-current' : 'border-border hover:border-muted-foreground/50'}
                    `}
                  >
                    <Icon className="h-5 w-5 mb-1" />
                    <span className="text-xs">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          {selectedResponse && (
            <div className="space-y-2">
              <span className="text-sm font-medium">Notizen (optional):</span>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  selectedResponse === 'conditional' 
                    ? "z.B. 'Nur wenn 2 Tage Remote möglich'" 
                    : "Zusätzliche Informationen..."
                }
                rows={2}
              />
            </div>
          )}

          {/* Message Template */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Nachricht an Kandidaten
              </span>
              <Button variant="ghost" size="sm" onClick={handleCopyMessage}>
                Kopieren
              </Button>
            </div>
            <div className="bg-muted/50 p-3 rounded-lg text-sm whitespace-pre-line text-muted-foreground max-h-32 overflow-y-auto">
              {generateMessage()}
            </div>
            
            <div className="flex gap-2">
              {candidate.email && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => window.open(`mailto:${candidate.email}?subject=Pendeldistanz für ${job.title}&body=${encodeURIComponent(generateMessage())}`)}
                >
                  <Mail className="h-4 w-4 mr-1" />
                  E-Mail
                </Button>
              )}
              {candidate.phone && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => window.open(`tel:${candidate.phone}`)}
                >
                  <Phone className="h-4 w-4 mr-1" />
                  Anrufen
                </Button>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button 
            onClick={handleSaveResponse} 
            disabled={!selectedResponse || saving}
          >
            {saving ? 'Speichern...' : 'Antwort speichern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
