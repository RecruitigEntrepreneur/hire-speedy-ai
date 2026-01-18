import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Loader2, 
  Video, 
  Phone, 
  MapPin,
  ChevronDown,
  ChevronUp,
  Link2,
  FileText,
  CalendarCheck,
  AlertCircle
} from 'lucide-react';
import { format, setHours, setMinutes, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useCalendarAvailability } from '@/hooks/useCalendarAvailability';

interface CandidateInfo {
  id: string;
  name: string;
  jobTitle: string;
}

interface InterviewDetails {
  scheduledAt: Date;
  durationMinutes: number;
  meetingType: 'video' | 'phone' | 'onsite';
  meetingLink?: string;
  notes?: string;
}

interface InterviewSchedulingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: CandidateInfo;
  onSubmit: (details: InterviewDetails) => Promise<void>;
}

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00'
];

const DURATION_OPTIONS = [
  { value: 30, label: '30 Minuten' },
  { value: 45, label: '45 Minuten' },
  { value: 60, label: '60 Minuten' },
  { value: 90, label: '90 Minuten' },
  { value: 120, label: '2 Stunden' }
];

// Generate suggested dates (next 3 business days)
const getSuggestedDates = () => {
  const suggestions: { date: Date; time: string }[] = [];
  let date = new Date();
  const defaultTimes = ['10:00', '14:00', '11:00'];
  
  while (suggestions.length < 3) {
    date = addDays(date, 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      suggestions.push({
        date: new Date(date),
        time: defaultTimes[suggestions.length]
      });
    }
  }
  
  return suggestions;
};

export function InterviewSchedulingDialog({
  open,
  onOpenChange,
  candidate,
  onSubmit
}: InterviewSchedulingDialogProps) {
  // Form state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string>('10:00');
  const [duration, setDuration] = useState<number>(60);
  const [meetingType, setMeetingType] = useState<'video' | 'phone' | 'onsite'>('video');
  const [meetingLink, setMeetingLink] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  
  // UI state
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Calendar availability
  const { isConnected, provider, loading: calendarLoading } = useCalendarAvailability({ durationMinutes: duration });

  const suggestedDates = getSuggestedDates();

  const handleQuickSelect = async (date: Date, time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const dateTime = setMinutes(setHours(date, hours), minutes);
    
    setIsSubmitting(true);
    try {
      await onSubmit({
        scheduledAt: dateTime,
        durationMinutes: duration,
        meetingType,
        meetingLink: meetingLink || undefined,
        notes: notes || undefined
      });
      resetForm();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomSubmit = async () => {
    if (!selectedDate) return;
    
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const dateTime = setMinutes(setHours(selectedDate, hours), minutes);
    
    setIsSubmitting(true);
    try {
      await onSubmit({
        scheduledAt: dateTime,
        durationMinutes: duration,
        meetingType,
        meetingLink: meetingLink || undefined,
        notes: notes || undefined
      });
      resetForm();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedDate(undefined);
    setSelectedTime('10:00');
    setDuration(60);
    setMeetingType('video');
    setMeetingLink('');
    setNotes('');
    setShowCustomDate(false);
  };

  const generateMeetingLink = () => {
    // Generate a placeholder meeting link - in production this would integrate with Google Meet/Zoom
    const meetingId = Math.random().toString(36).substring(2, 10);
    setMeetingLink(`https://meet.google.com/${meetingId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            Interview planen
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <span className="font-medium text-foreground">{candidate.name}</span>
            <span className="text-muted-foreground">•</span>
            <span>{candidate.jobTitle}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Calendar Integration Status */}
          {!calendarLoading && (
            <div className={cn(
              "flex items-center gap-2 p-3 rounded-lg text-sm",
              isConnected ? "bg-green-50 text-green-700 border border-green-200" : "bg-muted"
            )}>
              {isConnected ? (
                <>
                  <CalendarCheck className="h-4 w-4" />
                  <span>Kalender verbunden: {provider === 'google' ? 'Google Calendar' : 'Outlook'}</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Verbinde deinen Kalender für automatische Slot-Vorschläge
                  </span>
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="h-auto p-0 ml-auto text-xs"
                    onClick={() => window.location.href = '/recruiter/integrations'}
                  >
                    Verbinden
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Quick Date Selection */}
          {!showCustomDate && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Schnellauswahl</Label>
                <Badge variant="outline" className="text-xs">
                  Nächste Werktage
                </Badge>
              </div>
              
              <div className="grid gap-2">
                {suggestedDates.map((slot, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    className="justify-between h-12 px-4"
                    onClick={() => handleQuickSelect(slot.date, slot.time)}
                    disabled={isSubmitting}
                  >
                    <span className="flex items-center gap-3">
                      <CalendarIcon className="h-4 w-4 text-primary" />
                      <span className="font-medium">
                        {format(slot.date, 'EEEE, dd. MMM', { locale: de })}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {slot.time} Uhr
                    </span>
                  </Button>
                ))}
              </div>
              
              <Button 
                variant="ghost" 
                className="w-full text-sm"
                onClick={() => setShowCustomDate(true)}
              >
                <ChevronDown className="h-4 w-4 mr-2" />
                Eigenes Datum & Details wählen
              </Button>
            </div>
          )}

          {/* Custom Date Selection */}
          {showCustomDate && (
            <div className="space-y-4">
              <Button 
                variant="ghost" 
                size="sm"
                className="text-xs"
                onClick={() => setShowCustomDate(false)}
              >
                <ChevronUp className="h-3.5 w-3.5 mr-1" />
                Zurück zur Schnellauswahl
              </Button>

              {/* Date & Time */}
              <div className="grid gap-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Datum</Label>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < new Date() || date.getDay() === 0 || date.getDay() === 6}
                    className="rounded-md border p-3"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Uhrzeit</Label>
                    <Select value={selectedTime} onValueChange={setSelectedTime}>
                      <SelectTrigger className="w-full">
                        <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_SLOTS.map(slot => (
                          <SelectItem key={slot} value={slot}>{slot} Uhr</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-2 block">Dauer</Label>
                    <Select value={duration.toString()} onValueChange={(v) => setDuration(parseInt(v))}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DURATION_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value.toString()}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Meeting Type */}
              <div>
                <Label className="text-sm font-medium mb-3 block">Meeting-Typ</Label>
                <RadioGroup
                  value={meetingType}
                  onValueChange={(v) => setMeetingType(v as 'video' | 'phone' | 'onsite')}
                  className="grid grid-cols-3 gap-2"
                >
                  <div>
                    <RadioGroupItem value="video" id="video" className="peer sr-only" />
                    <Label
                      htmlFor="video"
                      className={cn(
                        "flex flex-col items-center justify-center rounded-lg border-2 p-3 cursor-pointer transition-all",
                        "hover:bg-accent hover:text-accent-foreground",
                        meetingType === 'video' && "border-primary bg-primary/5"
                      )}
                    >
                      <Video className="h-5 w-5 mb-1" />
                      <span className="text-xs">Video-Call</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="phone" id="phone" className="peer sr-only" />
                    <Label
                      htmlFor="phone"
                      className={cn(
                        "flex flex-col items-center justify-center rounded-lg border-2 p-3 cursor-pointer transition-all",
                        "hover:bg-accent hover:text-accent-foreground",
                        meetingType === 'phone' && "border-primary bg-primary/5"
                      )}
                    >
                      <Phone className="h-5 w-5 mb-1" />
                      <span className="text-xs">Telefon</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="onsite" id="onsite" className="peer sr-only" />
                    <Label
                      htmlFor="onsite"
                      className={cn(
                        "flex flex-col items-center justify-center rounded-lg border-2 p-3 cursor-pointer transition-all",
                        "hover:bg-accent hover:text-accent-foreground",
                        meetingType === 'onsite' && "border-primary bg-primary/5"
                      )}
                    >
                      <MapPin className="h-5 w-5 mb-1" />
                      <span className="text-xs">Vor-Ort</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Meeting Link (for video calls) */}
              {meetingType === 'video' && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Meeting-Link (optional)</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        value={meetingLink}
                        onChange={(e) => setMeetingLink(e.target.value)}
                        placeholder="https://meet.google.com/..."
                        className="pl-9"
                      />
                    </div>
                    <Button 
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generateMeetingLink}
                    >
                      Generieren
                    </Button>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Agenda / Notizen (optional)</Label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Was soll im Interview besprochen werden?"
                    className="pl-9 min-h-[80px] resize-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button 
            variant="outline" 
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
            disabled={isSubmitting}
          >
            Abbrechen
          </Button>
          {showCustomDate && (
            <Button 
              onClick={handleCustomSubmit}
              disabled={!selectedDate || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Wird geplant...
                </>
              ) : (
                <>
                  <CalendarCheck className="h-4 w-4 mr-2" />
                  Interview planen
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
