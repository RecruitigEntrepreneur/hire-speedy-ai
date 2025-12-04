import { useState } from 'react';
import { Calendar, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useInterviewScheduling, TimeSlot } from '@/hooks/useInterviewScheduling';
import { cn } from '@/lib/utils';

interface TimeSlotPickerProps {
  selectionToken: string;
  slots: TimeSlot[];
  candidateName: string;
  jobTitle: string;
  companyName: string;
  onSelected?: (scheduledAt: string) => void;
}

export function TimeSlotPicker({ 
  selectionToken, 
  slots, 
  candidateName, 
  jobTitle, 
  companyName,
  onSelected 
}: TimeSlotPickerProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const { loading, selectSlot, formatSlotDate } = useInterviewScheduling();

  const handleConfirm = async () => {
    if (selectedIndex === null) return;
    
    const result = await selectSlot(selectionToken, selectedIndex);
    if (result?.success) {
      setConfirmed(true);
      onSelected?.(result.scheduled_at);
    }
  };

  if (confirmed) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="py-8 text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold">Interview bestätigt!</h2>
          <p className="text-muted-foreground">
            Das Interview wurde erfolgreich geplant. Sie erhalten in Kürze eine Bestätigungs-E-Mail
            mit allen Details und einem Kalender-Eintrag.
          </p>
          <p className="font-medium">
            {selectedIndex !== null && formatSlotDate(slots[selectedIndex].datetime)}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Calendar className="h-6 w-6" />
          Interview-Termin wählen
        </CardTitle>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>Kandidat: <span className="font-medium text-foreground">{candidateName}</span></p>
          <p>Position: <span className="font-medium text-foreground">{jobTitle}</span></p>
          <p>Unternehmen: <span className="font-medium text-foreground">{companyName}</span></p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Bitte wählen Sie einen der verfügbaren Termine für Ihr Interview:
        </p>

        <div className="space-y-2">
          {slots.map((slot, index) => (
            <button
              key={index}
              type="button"
              disabled={slot.status !== 'pending'}
              onClick={() => setSelectedIndex(index)}
              className={cn(
                'w-full p-4 border rounded-lg text-left transition-all',
                'hover:border-primary hover:bg-primary/5',
                selectedIndex === index && 'border-primary bg-primary/10 ring-2 ring-primary/20',
                slot.status !== 'pending' && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{formatSlotDate(slot.datetime)}</span>
                </div>
                {selectedIndex === index && (
                  <CheckCircle className="h-5 w-5 text-primary" />
                )}
              </div>
            </button>
          ))}
        </div>

        <Button 
          className="w-full" 
          disabled={selectedIndex === null || loading}
          onClick={handleConfirm}
        >
          {loading ? 'Wird bestätigt...' : 'Termin bestätigen'}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Nach der Bestätigung erhalten alle Teilnehmer eine E-Mail mit den Interview-Details.
        </p>
      </CardContent>
    </Card>
  );
}
