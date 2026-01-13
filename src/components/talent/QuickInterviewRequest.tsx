import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarIcon, Clock, Loader2 } from 'lucide-react';
import { format, addDays, setHours, setMinutes } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface QuickInterviewRequestProps {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (date: Date) => Promise<void>;
  candidateName: string;
}

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
];

// Generate suggested dates (next 3 business days)
const getSuggestedDates = () => {
  const suggestions: Date[] = [];
  let date = new Date();
  
  while (suggestions.length < 3) {
    date = addDays(date, 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) { // Skip weekends
      suggestions.push(new Date(date));
    }
  }
  
  return suggestions;
};

export function QuickInterviewRequest({
  children,
  open,
  onOpenChange,
  onSubmit,
  candidateName
}: QuickInterviewRequestProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string>('10:00');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  const suggestedDates = getSuggestedDates();

  const handleQuickSelect = async (date: Date, time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const dateTime = setMinutes(setHours(date, hours), minutes);
    
    setIsSubmitting(true);
    try {
      await onSubmit(dateTime);
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
      await onSubmit(dateTime);
      onOpenChange(false);
      setSelectedDate(undefined);
      setShowCalendar(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="space-y-3">
          <div className="text-sm font-medium">
            Interview mit {candidateName}
          </div>

          {/* Quick Suggestions */}
          {!showCalendar && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Schnellauswahl:</p>
              <div className="grid gap-2">
                {suggestedDates.map((date, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="justify-between h-9 text-xs"
                    onClick={() => handleQuickSelect(date, i === 0 ? '10:00' : i === 1 ? '14:00' : '11:00')}
                    disabled={isSubmitting}
                  >
                    <span className="flex items-center gap-2">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {format(date, 'EEE, dd. MMM', { locale: de })}
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {i === 0 ? '10:00' : i === 1 ? '14:00' : '11:00'}
                    </span>
                  </Button>
                ))}
              </div>
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-xs"
                onClick={() => setShowCalendar(true)}
              >
                Anderes Datum wählen...
              </Button>
            </div>
          )}

          {/* Custom Date Selection */}
          {showCalendar && (
            <div className="space-y-3">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => date < new Date() || date.getDay() === 0 || date.getDay() === 6}
                initialFocus
                className={cn("p-0 pointer-events-auto")}
              />
              
              <div className="flex items-center gap-2">
                <Select value={selectedTime} onValueChange={setSelectedTime}>
                  <SelectTrigger className="flex-1 h-9">
                    <Clock className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map(slot => (
                      <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => {
                    setShowCalendar(false);
                    setSelectedDate(undefined);
                  }}
                >
                  Zurück
                </Button>
                <Button 
                  size="sm" 
                  className="flex-1"
                  onClick={handleCustomSubmit}
                  disabled={!selectedDate || isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Anfragen'
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
