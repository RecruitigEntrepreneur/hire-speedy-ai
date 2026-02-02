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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  Plus,
  X,
  Users
} from 'lucide-react';
import { format, setHours, setMinutes, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useInterviewTypes } from '@/hooks/useInterviewTypes';
import { ParticipantRole } from '@/hooks/useInterviewParticipants';

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
  interviewTypeId?: string;
  participants?: { userId: string; role: ParticipantRole }[];
}

interface InterviewSchedulingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: CandidateInfo;
  onSubmit: (details: InterviewDetails) => Promise<void>;
  teamMembers?: { id: string; name: string; email: string }[];
}

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00'
];

const MEETING_TYPES = [
  { value: 'video', label: 'Video-Call', icon: Video, description: 'Video-Link angeben' },
  { value: 'phone', label: 'Telefon', icon: Phone, description: 'Telefoninterview' },
  { value: 'onsite', label: 'Vor-Ort', icon: MapPin, description: 'Persönlich' },
] as const;

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
  onSubmit,
  teamMembers = []
}: InterviewSchedulingDialogProps) {
  // Form state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string>('10:00');
  const [duration, setDuration] = useState<number>(60);
  const [meetingType, setMeetingType] = useState<'video' | 'phone' | 'onsite'>('video');
  const [meetingLink, setMeetingLink] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [selectedInterviewType, setSelectedInterviewType] = useState<string>('');
  const [selectedParticipants, setSelectedParticipants] = useState<{ userId: string; role: ParticipantRole; name: string }[]>([]);
  
  // UI state
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [participantPickerOpen, setParticipantPickerOpen] = useState(false);
  
  // Hooks
  const { types: interviewTypes, loading: typesLoading } = useInterviewTypes();

  const suggestedDates = getSuggestedDates();

  // Handle interview type selection
  const handleInterviewTypeSelect = (typeId: string) => {
    setSelectedInterviewType(typeId);
    const type = interviewTypes.find(t => t.id === typeId);
    if (type) {
      setDuration(type.default_duration);
      if (type.agenda_template) {
        setNotes(type.agenda_template);
      }
    }
  };

  // Add participant
  const addParticipant = (member: { id: string; name: string }) => {
    if (!selectedParticipants.find(p => p.userId === member.id)) {
      setSelectedParticipants(prev => [
        ...prev, 
        { userId: member.id, role: 'panel' as ParticipantRole, name: member.name }
      ]);
    }
    setParticipantPickerOpen(false);
  };

  // Remove participant
  const removeParticipant = (userId: string) => {
    setSelectedParticipants(prev => prev.filter(p => p.userId !== userId));
  };

  // Update participant role
  const updateParticipantRole = (userId: string, role: ParticipantRole) => {
    setSelectedParticipants(prev => 
      prev.map(p => p.userId === userId ? { ...p, role } : p)
    );
  };

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
        notes: notes || undefined,
        interviewTypeId: selectedInterviewType || undefined,
        participants: selectedParticipants.map(p => ({ userId: p.userId, role: p.role }))
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
        notes: notes || undefined,
        interviewTypeId: selectedInterviewType || undefined,
        participants: selectedParticipants.map(p => ({ userId: p.userId, role: p.role }))
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
    setSelectedInterviewType('');
    setSelectedParticipants([]);
  };

  const generateMeetingLink = () => {
    const meetingId = Math.random().toString(36).substring(2, 10);
    setMeetingLink(`https://meet.google.com/${meetingId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
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
          {/* Interview Type Selection */}
          {!typesLoading && interviewTypes.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Interview-Typ</Label>
              <Select value={selectedInterviewType} onValueChange={handleInterviewTypeSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Interview-Typ wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {interviewTypes.map(type => (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center justify-between w-full gap-4">
                        <span>{type.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {type.default_duration} Min
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedInterviewType && (
                <p className="text-xs text-muted-foreground mt-1">
                  {interviewTypes.find(t => t.id === selectedInterviewType)?.description}
                </p>
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
                        <SelectItem value="30">30 Minuten</SelectItem>
                        <SelectItem value="45">45 Minuten</SelectItem>
                        <SelectItem value="60">60 Minuten</SelectItem>
                        <SelectItem value="90">90 Minuten</SelectItem>
                        <SelectItem value="120">2 Stunden</SelectItem>
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
                  onValueChange={(v) => setMeetingType(v as typeof meetingType)}
                  className="grid grid-cols-3 gap-2"
                >
                  {MEETING_TYPES.map((type) => {
                    const Icon = type.icon;
                    
                    return (
                      <div key={type.value}>
                        <RadioGroupItem 
                          value={type.value} 
                          id={type.value} 
                          className="peer sr-only" 
                        />
                        <Label
                          htmlFor={type.value}
                          className={cn(
                            "flex flex-col items-center justify-center rounded-lg border-2 p-2.5 cursor-pointer transition-all text-center",
                            "hover:bg-accent hover:text-accent-foreground",
                            meetingType === type.value && "border-primary bg-primary/5"
                          )}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="text-[10px] mt-1 font-medium">{type.label}</span>
                        </Label>
                      </div>
                    );
                  })}
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

              {/* Multi-Interviewer Section */}
              {teamMembers.length > 0 && (
                <div>
                  <Label className="text-sm font-medium mb-2 block flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Interviewer
                  </Label>
                  
                  {/* Selected participants */}
                  {selectedParticipants.length > 0 && (
                    <div className="space-y-2 mb-2">
                      {selectedParticipants.map((participant) => (
                        <div 
                          key={participant.userId}
                          className="flex items-center justify-between p-2 rounded-lg border bg-muted/30"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {participant.name.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{participant.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Select 
                              value={participant.role} 
                              onValueChange={(v) => updateParticipantRole(participant.userId, v as ParticipantRole)}
                            >
                              <SelectTrigger className="h-7 text-xs w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="lead">Lead</SelectItem>
                                <SelectItem value="panel">Panel</SelectItem>
                                <SelectItem value="observer">Beobachter</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => removeParticipant(participant.userId)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Add participant button */}
                  <Popover open={participantPickerOpen} onOpenChange={setParticipantPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full">
                        <Plus className="h-4 w-4 mr-2" />
                        Interviewer hinzufügen
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Suchen..." />
                        <CommandList>
                          <CommandEmpty>Keine Teammitglieder gefunden</CommandEmpty>
                          <CommandGroup>
                            {teamMembers
                              .filter(m => !selectedParticipants.find(p => p.userId === m.id))
                              .map(member => (
                                <CommandItem
                                  key={member.id}
                                  onSelect={() => addParticipant(member)}
                                >
                                  <Avatar className="h-6 w-6 mr-2">
                                    <AvatarFallback className="text-xs">
                                      {member.name.split(' ').map(n => n[0]).join('')}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="text-sm">{member.name}</p>
                                    <p className="text-xs text-muted-foreground">{member.email}</p>
                                  </div>
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
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
