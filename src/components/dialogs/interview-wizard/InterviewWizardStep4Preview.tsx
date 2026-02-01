import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Send, Loader2 } from 'lucide-react';
import { InterviewWizardData, MEETING_FORMATS } from './types';

interface Step4Props {
  data: InterviewWizardData;
  jobTitle: string;
  candidateAnonymousId: string;
  companyDescription: string;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export function InterviewWizardStep4Preview({
  data,
  jobTitle,
  candidateAnonymousId,
  companyDescription,
  onBack,
  onSubmit,
  isSubmitting,
}: Step4Props) {
  const formatConfig = MEETING_FORMATS.find(f => f.value === data.meetingFormat);

  return (
    <div className="space-y-6">
      {/* Email Preview */}
      <div className="border rounded-lg overflow-hidden">
        {/* Email Header */}
        <div 
          className="text-white p-6"
          style={{ background: 'linear-gradient(135deg, #1a2332 0%, #0f172a 100%)' }}
        >
          <h3 className="text-lg font-semibold">Interview-Einladung</h3>
          <p className="text-white/80 text-sm mt-1">{jobTitle}</p>
        </div>

        {/* Email Body */}
        <div className="p-6 bg-card space-y-4">
          <p className="text-sm">
            Hallo <span className="font-medium">[Kandidat]</span>,
          </p>
          <p className="text-sm">
            ein <span className="font-medium">{companyDescription}</span> möchte Sie gerne kennenlernen.
          </p>

          {/* Details Table */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Position:</span>
              <span className="font-medium">{jobTitle}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Format:</span>
              <span>{formatConfig?.icon} {formatConfig?.label}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Dauer:</span>
              <span>{data.durationMinutes} Minuten</span>
            </div>
          </div>

          {/* Client Message */}
          {data.clientMessage && (
            <div className="border-l-4 border-primary bg-muted/30 p-4 rounded-r-lg">
              <p className="text-xs text-muted-foreground mb-1">Nachricht vom Unternehmen:</p>
              <p className="text-sm italic">„{data.clientMessage}"</p>
            </div>
          )}

          {/* Proposed Slots */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Terminvorschläge:</h4>
            <div className="bg-muted/30 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2 font-medium">Tag</th>
                    <th className="text-left p-2 font-medium">Uhrzeit</th>
                    <th className="text-left p-2 font-medium">Dauer</th>
                  </tr>
                </thead>
                <tbody>
                  {data.proposedSlots.map((slot, index) => (
                    <tr key={index} className="border-t border-border/50">
                      <td className="p-2">{format(slot, 'EEEE, dd. MMMM', { locale: de })}</td>
                      <td className="p-2 font-medium">{format(slot, 'HH:mm', { locale: de })} Uhr</td>
                      <td className="p-2 text-muted-foreground">{data.durationMinutes} Min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Preview Action Buttons */}
          <div className="flex justify-center gap-2 pt-4">
            <Badge variant="default" className="bg-green-600 hover:bg-green-600 px-4 py-2">
              ✅ Termin annehmen
            </Badge>
            <Badge variant="outline" className="px-4 py-2">
              🔄 Gegenvorschlag
            </Badge>
            <Badge variant="outline" className="text-destructive border-destructive/50 px-4 py-2">
              ❌ Absagen
            </Badge>
          </div>

          <p className="text-xs text-center text-muted-foreground pt-2">
            🔒 Ihre Daten werden erst nach Ihrer Zustimmung freigegeben (DSGVO-konform).
          </p>
        </div>

        {/* Email Footer */}
        <div className="bg-muted/50 p-3 text-center border-t">
          <p className="text-xs text-muted-foreground">
            Versendet über Matchunt • Datenschutz-konform
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="ghost" onClick={onBack} disabled={isSubmitting}>
          ← Zurück
        </Button>
        <Button onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Wird gesendet...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Einladung senden
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
