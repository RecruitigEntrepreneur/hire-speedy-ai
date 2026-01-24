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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Lock, 
  Send, 
  Shield, 
  Loader2, 
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { format, addDays, setHours, setMinutes } from 'date-fns';
import { de } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TimeSlotOption {
  date: Date;
  time: string;
  selected: boolean;
}

interface InterviewRequestWithOptInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string;
  candidateAnonymousId: string;
  jobTitle: string;
  jobIndustry?: string;
  onSuccess?: () => void;
}

export function InterviewRequestWithOptInDialog({
  open,
  onOpenChange,
  submissionId,
  candidateAnonymousId,
  jobTitle,
  jobIndustry = 'IT',
  onSuccess,
}: InterviewRequestWithOptInDialogProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [timeSlots, setTimeSlots] = useState<TimeSlotOption[]>([]);
  const [clientMessage, setClientMessage] = useState('');
  const [gdprConfirmed, setGdprConfirmed] = useState(false);

  const availableTimes = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      // Generate time slot options for the selected date
      const slots = availableTimes.map(time => ({
        date: date,
        time,
        selected: false
      }));
      setTimeSlots(prev => {
        // Keep existing slots for other dates, add new ones for this date
        const existingOtherDates = prev.filter(s => 
          format(s.date, 'yyyy-MM-dd') !== format(date, 'yyyy-MM-dd')
        );
        return [...existingOtherDates, ...slots];
      });
    }
  };

  const toggleTimeSlot = (date: Date, time: string) => {
    setTimeSlots(prev => prev.map(slot => 
      format(slot.date, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd') && slot.time === time
        ? { ...slot, selected: !slot.selected }
        : slot
    ));
  };

  const selectedSlots = timeSlots.filter(s => s.selected);

  const handleAutoGenerate = () => {
    // Auto-generate 5 slots over next 2 weeks
    const slots: TimeSlotOption[] = [];
    let currentDate = addDays(new Date(), 1);
    let slotsGenerated = 0;

    while (slotsGenerated < 5 && currentDate < addDays(new Date(), 14)) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip weekends
        const time = availableTimes[slotsGenerated % availableTimes.length];
        slots.push({
          date: new Date(currentDate),
          time,
          selected: true
        });
        slotsGenerated++;
      }
      currentDate = addDays(currentDate, 1);
    }

    setTimeSlots(slots);
    toast.success('5 Terminvorschläge automatisch generiert');
  };

  const handleSubmit = async () => {
    if (selectedSlots.length === 0) {
      toast.error('Bitte wählen Sie mindestens einen Terminvorschlag');
      return;
    }

    if (!gdprConfirmed) {
      toast.error('Bitte bestätigen Sie den DSGVO-Hinweis');
      return;
    }

    setLoading(true);
    try {
      // Convert selected slots to ISO strings
      const proposedSlots = selectedSlots.map(slot => {
        const [hours, minutes] = slot.time.split(':').map(Number);
        const dateTime = setMinutes(setHours(slot.date, hours), minutes);
        return dateTime.toISOString();
      });

      // Save pending interview request to submission using client_notes field
      const { error: updateError } = await supabase
        .from('submissions')
        .update({
          client_notes: JSON.stringify({
            pending_interview_request: {
              client_time_slots: proposedSlots,
              client_message: clientMessage,
              requested_at: new Date().toISOString(),
              status: 'pending_opt_in'
            }
          })
        })
        .eq('id', submissionId);

      if (updateError) throw updateError;

      // Update submission stage to remove from pending actions
      await supabase
        .from('submissions')
        .update({ 
          stage: 'interview_requested',
          status: 'interview'
        })
        .eq('id', submissionId);

      // Create notification for recruiter
      const { data: submission } = await supabase
        .from('submissions')
        .select('recruiter_id, jobs(client_id)')
        .eq('id', submissionId)
        .single();

      if (submission?.recruiter_id) {
        await supabase.from('notifications').insert({
          user_id: submission.recruiter_id,
          type: 'interview_requested',
          title: 'Interview-Anfrage erhalten',
          message: `Ein Kunde möchte ${candidateAnonymousId} für "${jobTitle}" interviewen. Bitte holen Sie die Zustimmung des Kandidaten ein.`,
          related_type: 'submission',
          related_id: submissionId,
        });
      }

      toast.success('Interview-Anfrage gesendet', {
        description: 'Der Recruiter wird den Kandidaten um Zustimmung bitten.'
      });

      onSuccess?.();
      onOpenChange(false);
      
      // Reset state
      setStep(1);
      setTimeSlots([]);
      setClientMessage('');
      setGdprConfirmed(false);

    } catch (error) {
      console.error('Error requesting interview:', error);
      toast.error('Fehler beim Senden der Anfrage');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium">Terminvorschläge auswählen</h4>
        <Button variant="outline" size="sm" onClick={handleAutoGenerate}>
          <Clock className="h-4 w-4 mr-2" />
          Auto-Vorschläge
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            locale={de}
            disabled={(date) => {
              const day = date.getDay();
              return day === 0 || day === 6 || date < new Date();
            }}
            className="rounded-md border"
          />
        </div>

        <div className="space-y-3">
          {selectedDate && (
            <>
              <p className="text-sm font-medium">
                {format(selectedDate, 'EEEE, d. MMMM', { locale: de })}
              </p>
              <div className="flex flex-wrap gap-2">
                {availableTimes.map(time => {
                  const isSelected = timeSlots.some(
                    s => format(s.date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd') 
                      && s.time === time 
                      && s.selected
                  );
                  return (
                    <Button
                      key={time}
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleTimeSlot(selectedDate, time)}
                    >
                      {time}
                    </Button>
                  );
                })}
              </div>
            </>
          )}

          {selectedSlots.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-medium mb-2">Ausgewählte Termine ({selectedSlots.length})</p>
              <div className="space-y-1">
                {selectedSlots.map((slot, idx) => (
                  <Badge key={idx} variant="secondary" className="mr-1 mb-1">
                    {format(slot.date, 'd.M.', { locale: de })} {slot.time}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pt-4">
        <Label htmlFor="client-message">Nachricht an den Kandidaten (optional)</Label>
        <Textarea
          id="client-message"
          placeholder="z.B. Wir freuen uns auf das Gespräch..."
          value={clientMessage}
          onChange={(e) => setClientMessage(e.target.value)}
          className="mt-2"
          rows={3}
        />
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <Alert className="border-primary/20 bg-primary/5">
        <Shield className="h-4 w-4 text-primary" />
        <AlertDescription>
          <strong className="text-primary">Triple-Blind Prozess (DSGVO-konform)</strong>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span>Der Kandidat erhält eine <strong>anonyme Anfrage</strong> mit Ihren Terminvorschlägen</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span>Er sieht nur: "Ein Unternehmen in <strong>[{jobIndustry}]</strong> sucht [{jobTitle}]"</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span>Bei <strong>Zustimmung + Terminwahl</strong> werden alle Daten freigegeben</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span>Termin wird <strong>automatisch</strong> für alle Parteien gebucht</span>
            </li>
          </ul>
        </AlertDescription>
      </Alert>

      <div className="p-4 bg-muted/50 rounded-lg">
        <h4 className="font-medium mb-2">Zusammenfassung</h4>
        <div className="space-y-2 text-sm">
          <p><strong>Kandidat:</strong> {candidateAnonymousId}</p>
          <p><strong>Position:</strong> {jobTitle}</p>
          <p><strong>Terminvorschläge:</strong> {selectedSlots.length}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {selectedSlots.slice(0, 5).map((slot, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {format(slot.date, 'd.M.', { locale: de })} {slot.time}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 p-4 border rounded-lg">
        <Checkbox
          id="gdpr-confirm"
          checked={gdprConfirmed}
          onCheckedChange={(checked) => setGdprConfirmed(checked === true)}
        />
        <Label htmlFor="gdpr-confirm" className="text-sm leading-relaxed cursor-pointer">
          Ich verstehe, dass der Kandidat <strong>aktiv zustimmen muss</strong>, bevor seine 
          Identität freigegeben wird. Die Verarbeitung erfolgt DSGVO-konform.
        </Label>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Interview anfragen (Triple-Blind)
          </DialogTitle>
          <DialogDescription>
            {step === 1 
              ? 'Schlagen Sie Termine vor – der Kandidat wird um Zustimmung gebeten.'
              : 'Bestätigen Sie den DSGVO-konformen Prozess.'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center gap-2 py-2">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              1
            </div>
            <span className="text-sm font-medium">Termine</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              2
            </div>
            <span className="text-sm font-medium">DSGVO</span>
          </div>
        </div>

        <Separator />

        <div className="py-4">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => step === 1 ? onOpenChange(false) : setStep(1)}>
            {step === 1 ? 'Abbrechen' : 'Zurück'}
          </Button>
          
          {step === 1 ? (
            <Button 
              onClick={() => setStep(2)} 
              disabled={selectedSlots.length === 0}
            >
              Weiter
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button 
              onClick={handleSubmit} 
              disabled={loading || !gdprConfirmed}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Anfrage senden
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}