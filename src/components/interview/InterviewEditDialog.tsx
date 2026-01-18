import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  Video, Phone, MapPin, Clock, Calendar as CalendarIcon, 
  ChevronDown, Link2, Sparkles, Loader2, User
} from 'lucide-react';
import { format, addDays, setHours, setMinutes, isWeekend, startOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Interview {
  id: string;
  scheduled_at: string | null;
  duration_minutes?: number | null;
  meeting_type?: string | null;
  meeting_link?: string | null;
  status?: string | null;
  notes?: string | null;
  feedback?: string | null;
  location?: string | null;
  submission?: {
    id?: string;
    candidate?: {
      full_name: string;
      email?: string;
    };
    job?: {
      title?: string;
      company_name?: string;
    };
  };
}

interface InterviewEditDialogProps {
  interview: Interview | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    scheduled_at: string;
    duration_minutes: number;
    meeting_type: string;
    meeting_link: string;
    notes: string;
  }) => Promise<void>;
  isProcessing?: boolean;
}

const MEETING_TYPES = [
  { value: 'video', label: 'Video', icon: Video, color: 'text-blue-600', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  { value: 'teams', label: 'Teams', icon: Video, color: 'text-purple-600', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  { value: 'meet', label: 'Meet', icon: Video, color: 'text-red-600', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  { value: 'phone', label: 'Telefon', icon: Phone, color: 'text-green-600', bg: 'bg-green-500/10', border: 'border-green-500/30' },
  { value: 'onsite', label: 'Vor Ort', icon: MapPin, color: 'text-orange-600', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
];

const DURATION_OPTIONS = [
  { value: 30, label: '30 Min', icon: '⚡' },
  { value: 45, label: '45 Min', icon: '⏱️' },
  { value: 60, label: '60 Min', icon: '🕐' },
  { value: 90, label: '90 Min', icon: '📋' },
  { value: 120, label: '2 Std', icon: '📊' },
];

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00'
];

export function InterviewEditDialog({
  interview,
  open,
  onOpenChange,
  onSave,
  isProcessing = false,
}: InterviewEditDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    interview?.scheduled_at ? new Date(interview.scheduled_at) : undefined
  );
  const [selectedTime, setSelectedTime] = useState(
    interview?.scheduled_at 
      ? format(new Date(interview.scheduled_at), 'HH:mm') 
      : '10:00'
  );
  const [duration, setDuration] = useState(interview?.duration_minutes || 60);
  const [meetingType, setMeetingType] = useState(interview?.meeting_type || 'video');
  const [meetingLink, setMeetingLink] = useState(interview?.meeting_link || '');
  const [notes, setNotes] = useState(interview?.notes || '');
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  // Reset form when interview changes
  useMemo(() => {
    if (interview) {
      setSelectedDate(interview.scheduled_at ? new Date(interview.scheduled_at) : undefined);
      setSelectedTime(interview.scheduled_at ? format(new Date(interview.scheduled_at), 'HH:mm') : '10:00');
      setDuration(interview.duration_minutes || 60);
      setMeetingType(interview.meeting_type || 'video');
      setMeetingLink(interview.meeting_link || '');
      setNotes(interview.notes || '');
      setShowCustomDate(false);
    }
  }, [interview]);

  // Generate quick date suggestions (next 3 weekdays)
  const quickDates = useMemo(() => {
    const dates: Date[] = [];
    let current = addDays(new Date(), 1);
    
    while (dates.length < 3) {
      if (!isWeekend(current)) {
        dates.push(current);
      }
      current = addDays(current, 1);
    }
    
    return dates.map((date, index) => ({
      date,
      time: index === 0 ? '10:00' : index === 1 ? '14:00' : '11:00',
    }));
  }, []);

  const handleQuickDateSelect = (date: Date, time: string) => {
    setSelectedDate(date);
    setSelectedTime(time);
    setShowCustomDate(false);
  };

  const handleGenerateMeetingLink = async () => {
    setGeneratingLink(true);
    // Simulate generating a meeting link
    await new Promise(resolve => setTimeout(resolve, 500));
    const meetingId = Math.random().toString(36).substring(2, 10);
    const links: Record<string, string> = {
      video: `https://zoom.us/j/${meetingId}`,
      teams: `https://teams.microsoft.com/l/meetup-join/${meetingId}`,
      meet: `https://meet.google.com/${meetingId}`,
      phone: '',
      onsite: '',
    };
    setMeetingLink(links[meetingType] || '');
    setGeneratingLink(false);
  };

  const handleSave = async () => {
    if (!selectedDate) return;
    
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const scheduledDate = setMinutes(setHours(startOfDay(selectedDate), hours), minutes);
    
    await onSave({
      scheduled_at: scheduledDate.toISOString(),
      duration_minutes: duration,
      meeting_type: meetingType,
      meeting_link: meetingLink,
      notes: notes,
    });
  };

  const initials = interview?.submission.candidate.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '';

  const selectedMeetingConfig = MEETING_TYPES.find(t => t.value === meetingType);

  if (!interview) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Interview bearbeiten
          </DialogTitle>
          <DialogDescription>
            Ändern Sie Datum, Uhrzeit und Details des Interviews
          </DialogDescription>
        </DialogHeader>

        {/* Candidate Header */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
          <div className={cn(
            "flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center font-semibold text-sm",
            selectedMeetingConfig?.bg, selectedMeetingConfig?.color
          )}>
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground truncate">
              {interview.submission.candidate.full_name}
            </h3>
            <p className="text-sm text-muted-foreground truncate">
              {interview.submission.job.title} @ {interview.submission.job.company_name}
            </p>
          </div>
        </div>

        <div className="space-y-5 mt-2">
          {/* Quick Date Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Schnellauswahl
            </Label>
            <div className="space-y-2">
              {quickDates.map(({ date, time }, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleQuickDateSelect(date, time)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-lg border transition-all",
                    selectedDate && format(selectedDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd') && selectedTime === time
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:border-primary/30 hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <CalendarIcon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-medium">
                      {format(date, 'EEEE, d. MMMM', { locale: de })}
                    </span>
                  </div>
                  <Badge variant="secondary" className="font-mono">
                    {time} Uhr
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date/Time Selection */}
          <Collapsible open={showCustomDate} onOpenChange={setShowCustomDate}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Eigenes Datum & Uhrzeit wählen
                </span>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform",
                  showCustomDate && "rotate-180"
                )} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Datum
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, 'd. MMM yyyy', { locale: de }) : 'Datum wählen'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        disabled={(date) => date < new Date() || isWeekend(date)}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Uhrzeit
                  </Label>
                  <Select value={selectedTime} onValueChange={setSelectedTime}>
                    <SelectTrigger>
                      <SelectValue placeholder="Zeit wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_SLOTS.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time} Uhr
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Meeting Type Grid */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Meeting-Typ
            </Label>
            <div className="grid grid-cols-5 gap-2">
              {MEETING_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = meetingType === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setMeetingType(type.value)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all",
                      isSelected 
                        ? `${type.bg} ${type.border} border-2 ring-1 ring-offset-1` 
                        : "border-border hover:border-primary/30 hover:bg-muted/50"
                    )}
                  >
                    <div className={cn("p-2 rounded-lg", type.bg)}>
                      <Icon className={cn("h-4 w-4", type.color)} />
                    </div>
                    <span className={cn(
                      "text-xs font-medium",
                      isSelected ? type.color : "text-muted-foreground"
                    )}>
                      {type.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Dauer
            </Label>
            <RadioGroup
              value={duration.toString()}
              onValueChange={(value) => setDuration(parseInt(value))}
              className="flex flex-wrap gap-2"
            >
              {DURATION_OPTIONS.map((option) => (
                <div key={option.value}>
                  <RadioGroupItem
                    value={option.value.toString()}
                    id={`duration-${option.value}`}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={`duration-${option.value}`}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-lg border cursor-pointer transition-all",
                      duration === option.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/30 hover:bg-muted/50"
                    )}
                  >
                    <span>{option.icon}</span>
                    <span className="text-sm font-medium">{option.label}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Meeting Link */}
          {meetingType !== 'phone' && meetingType !== 'onsite' && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Meeting-Link
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="https://..."
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateMeetingLink}
                  disabled={generatingLink}
                  className="gap-1.5 shrink-0"
                >
                  {generatingLink ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Generieren
                </Button>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Notizen
            </Label>
            <Textarea
              placeholder="Agenda, Gesprächspunkte, Vorbereitungen..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="mt-6 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isProcessing || !selectedDate}
            className="gap-1.5"
          >
            {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
