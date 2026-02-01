import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Shield, CheckCircle } from 'lucide-react';
import { InterviewWizardData } from './types';

interface Step3Props {
  data: InterviewWizardData;
  onChange: (data: Partial<InterviewWizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function InterviewWizardStep3Message({ data, onChange, onNext, onBack }: Step3Props) {
  return (
    <div className="space-y-6">
      {/* Message Input */}
      <div className="space-y-2">
        <Label htmlFor="clientMessage" className="text-sm font-medium">
          Nachricht an den Kandidaten (optional)
        </Label>
        <Textarea
          id="clientMessage"
          placeholder="Wir freuen uns auf das Gespräch mit Ihnen..."
          value={data.clientMessage}
          onChange={(e) => onChange({ clientMessage: e.target.value })}
          rows={4}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">
          Diese Nachricht wird dem Kandidaten in der Einladungs-E-Mail angezeigt.
        </p>
      </div>

      {/* Triple-Blind Info Box */}
      <div className="bg-muted/50 border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h4 className="font-medium">Datenschutz-Hinweis</h4>
        </div>
        
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
            <span>Kandidat erhält Ihre Interview-Einladung mit Firmenname und Stelleninfos</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
            <span>Er kann entscheiden, ob er Ihr Unternehmen kennenlernen möchte</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
            <span>Erst bei Annahme werden seine persönlichen Daten für Sie sichtbar</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
            <span>Termin wird automatisch für alle Parteien gebucht</span>
          </li>
        </ul>
      </div>

      {/* GDPR Checkbox */}
      <div className="flex items-start gap-3 p-4 border rounded-lg bg-background">
        <Checkbox
          id="gdprConfirmed"
          checked={data.gdprConfirmed}
          onCheckedChange={(checked) => onChange({ gdprConfirmed: checked === true })}
        />
        <div className="space-y-1">
          <Label htmlFor="gdprConfirmed" className="text-sm font-medium cursor-pointer">
            Ich bestätige die DSGVO-konforme Verarbeitung
          </Label>
          <p className="text-xs text-muted-foreground">
            Der Kandidat muss der Datenfreigabe aktiv zustimmen, bevor persönliche Informationen geteilt werden.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="ghost" onClick={onBack}>
          ← Zurück
        </Button>
        <Button onClick={onNext} disabled={!data.gdprConfirmed}>
          Weiter →
        </Button>
      </div>
    </div>
  );
}
