import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { InterviewWizardData, MEETING_FORMATS, DURATION_OPTIONS, MeetingFormat } from './types';

interface Step1Props {
  data: InterviewWizardData;
  onChange: (data: Partial<InterviewWizardData>) => void;
  onNext: () => void;
  onCancel: () => void;
}

export function InterviewWizardStep1Format({ data, onChange, onNext, onCancel }: Step1Props) {
  const selectedFormat = MEETING_FORMATS.find(f => f.value === data.meetingFormat);
  const needsLink = data.meetingFormat === 'video';
  const needsAddress = data.meetingFormat === 'onsite';
  const needsPhone = data.meetingFormat === 'phone';

  const canProceed = () => {
    if (needsLink && !data.meetingLink?.trim()) return false;
    if (needsAddress && !data.onsiteAddress?.trim()) return false;
    return true;
  };

  return (
    <div className="space-y-6">
      {/* Format Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Format wählen</Label>
        <div className="grid grid-cols-5 gap-2">
          {MEETING_FORMATS.map((format) => (
            <button
              key={format.value}
              type="button"
              onClick={() => onChange({ meetingFormat: format.value })}
              className={cn(
                'flex flex-col items-center p-3 rounded-lg border-2 transition-all text-center',
                data.meetingFormat === format.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-accent/50'
              )}
            >
              <span className="text-2xl mb-1">{format.icon}</span>
              <span className="text-xs font-medium">{format.label}</span>
              {(format.value === 'teams' || format.value === 'meet') && (
                <span className="text-[10px] text-muted-foreground mt-1">(Auto)</span>
              )}
            </button>
          ))}
        </div>
        {selectedFormat && (
          <p className="text-xs text-muted-foreground">{selectedFormat.description}</p>
        )}
      </div>

      {/* Conditional Fields */}
      {needsLink && (
        <div className="space-y-2">
          <Label htmlFor="meetingLink">Video-Link eingeben</Label>
          <Input
            id="meetingLink"
            type="url"
            placeholder="https://zoom.us/j/..."
            value={data.meetingLink || ''}
            onChange={(e) => onChange({ meetingLink: e.target.value })}
          />
        </div>
      )}

      {needsAddress && (
        <div className="space-y-2">
          <Label htmlFor="onsiteAddress">Adresse für Vor-Ort-Termin</Label>
          <Textarea
            id="onsiteAddress"
            placeholder="Musterstraße 123&#10;12345 Musterstadt&#10;Gebäude B, 3. Stock"
            value={data.onsiteAddress || ''}
            onChange={(e) => onChange({ onsiteAddress: e.target.value })}
            rows={3}
          />
        </div>
      )}

      {needsPhone && (
        <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
          📞 Der Kandidat wird nach Bestätigung kontaktiert. Die Telefonnummer wird aus dem Profil verwendet.
        </p>
      )}

      {/* Duration Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Dauer</Label>
        <div className="flex gap-2">
          {DURATION_OPTIONS.map((duration) => (
            <button
              key={duration}
              type="button"
              onClick={() => onChange({ durationMinutes: duration })}
              className={cn(
                'flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all',
                data.durationMinutes === duration
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:border-primary/50'
              )}
            >
              {duration} Min
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="ghost" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button onClick={onNext} disabled={!canProceed()}>
          Weiter →
        </Button>
      </div>
    </div>
  );
}
