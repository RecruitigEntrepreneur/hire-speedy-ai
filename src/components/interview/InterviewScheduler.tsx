import { useState } from 'react';
import { Calendar, Clock, Send, Video } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInterviewScheduling, TimeSlot } from '@/hooks/useInterviewScheduling';

interface InterviewSchedulerProps {
  interviewId: string;
  candidateName: string;
  jobTitle: string;
  onScheduled?: (scheduledAt: string) => void;
}

export function InterviewScheduler({ interviewId, candidateName, jobTitle, onScheduled }: InterviewSchedulerProps) {
  const [duration, setDuration] = useState('60');
  const [generatedSlots, setGeneratedSlots] = useState<TimeSlot[] | null>(null);
  const [selectionToken, setSelectionToken] = useState<string | null>(null);
  const { loading, generateSlots, formatSlotDate } = useInterviewScheduling();

  const handleGenerateSlots = async () => {
    const result = await generateSlots(interviewId, parseInt(duration));
    if (result) {
      setGeneratedSlots(result.slots);
      setSelectionToken(result.selection_token);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Interview planen
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {candidateName} für {jobTitle}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!generatedSlots ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="duration">Interview-Dauer</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger id="duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 Minuten</SelectItem>
                  <SelectItem value="45">45 Minuten</SelectItem>
                  <SelectItem value="60">60 Minuten</SelectItem>
                  <SelectItem value="90">90 Minuten</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleGenerateSlots} disabled={loading} className="w-full">
              <Clock className="h-4 w-4 mr-2" />
              Zeitvorschläge generieren
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Es werden 5 Zeitslots innerhalb der nächsten 2 Wochen vorgeschlagen
              (Mo-Fr, 9-17 Uhr)
            </p>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Generierte Zeitvorschläge</Label>
              <div className="space-y-2">
                {generatedSlots.map((slot, index) => (
                  <div
                    key={index}
                    className="p-3 border rounded-lg flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{formatSlotDate(slot.datetime)}</span>
                    </div>
                    <Video className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium mb-1">Nächster Schritt</p>
              <p className="text-muted-foreground">
                Der Recruiter/Kandidat erhält eine E-Mail mit einem Link zur Slot-Auswahl.
              </p>
            </div>

            <Button className="w-full">
              <Send className="h-4 w-4 mr-2" />
              Einladung senden
            </Button>

            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                setGeneratedSlots(null);
                setSelectionToken(null);
              }}
            >
              Neu generieren
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
