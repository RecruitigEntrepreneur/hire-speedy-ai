import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, addDays, setHours, setMinutes, isBefore, startOfToday } from 'date-fns';
import { de } from 'date-fns/locale';
import { CalendarIcon, Sparkles, X, Clock } from 'lucide-react';
import { InterviewWizardData } from './types';

interface Step2Props {
  data: InterviewWizardData;
  onChange: (data: Partial<InterviewWizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
];

// Generate smart suggested slots (next 5 business days at common times)
function generateSmartSlots(): Date[] {
  const slots: Date[] = [];
  const now = new Date();
  const defaultTimes = ['10:00', '14:00', '11:00', '15:00', '09:30'];
  let date = new Date(now);
  let slotIndex = 0;
  
  while (slots.length < 5) {
    date = addDays(date, 1);
    const day = date.getDay();
    // Skip weekends
    if (day !== 0 && day !== 6) {
      const [hours, minutes] = defaultTimes[slotIndex % defaultTimes.length].split(':').map(Number);
      const slot = setMinutes(setHours(new Date(date), hours), minutes);
      slots.push(slot);
      slotIndex++;
    }
  }
  
  return slots;
}

export function InterviewWizardStep2Slots({ data, onChange, onNext, onBack }: Step2Props) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const addSlot = (date: Date, time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const slot = setMinutes(setHours(new Date(date), hours), minutes);
    
    // Check if slot already exists
    if (data.proposedSlots.some(s => s.getTime() === slot.getTime())) return;
    if (data.proposedSlots.length >= 5) return;
    
    onChange({ proposedSlots: [...data.proposedSlots, slot].sort((a, b) => a.getTime() - b.getTime()) });
  };

  const removeSlot = (index: number) => {
    onChange({ proposedSlots: data.proposedSlots.filter((_, i) => i !== index) });
  };

  const smartSuggest = () => {
    const slots = generateSmartSlots();
    onChange({ proposedSlots: slots });
  };

  const isSlotInPast = (date: Date, time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const slot = setMinutes(setHours(new Date(date), hours), minutes);
    return isBefore(slot, new Date());
  };

  return (
    <div className="space-y-6">
      {/* Smart Suggest button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={smartSuggest}>
          <Sparkles className="h-4 w-4 mr-2" />
          Smart Suggest
        </Button>
      </div>

      {/* Date + Time Picker */}
      <div className="flex gap-4">
        {/* Calendar */}
        <div className="flex-shrink-0">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[200px] justify-start text-left">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, 'dd. MMMM', { locale: de }) : 'Datum wählen'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  setSelectedDate(date);
                  setCalendarOpen(false);
                }}
                disabled={(date) => isBefore(date, startOfToday())}
                initialFocus
                locale={de}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Time Slots Grid */}
        {selectedDate && (
          <div className="flex-1 border rounded-lg p-3">
            <p className="text-sm font-medium mb-2">
              {format(selectedDate, 'EEEE, dd. MMMM', { locale: de })}
            </p>
            <div className="grid grid-cols-6 gap-1">
              {TIME_SLOTS.map((time) => {
                const isPast = isSlotInPast(selectedDate, time);
                const isSelected = data.proposedSlots.some(s => {
                  const [hours, minutes] = time.split(':').map(Number);
                  const slot = setMinutes(setHours(new Date(selectedDate), hours), minutes);
                  return s.getTime() === slot.getTime();
                });

                return (
                  <button
                    key={time}
                    type="button"
                    disabled={isPast || isSelected || data.proposedSlots.length >= 5}
                    onClick={() => addSlot(selectedDate, time)}
                    className={cn(
                      'py-1.5 px-2 text-xs rounded transition-colors',
                      isPast && 'opacity-30 cursor-not-allowed bg-muted',
                      isSelected && 'bg-primary text-primary-foreground',
                      !isPast && !isSelected && data.proposedSlots.length < 5 && 'hover:bg-accent cursor-pointer',
                      !isPast && !isSelected && data.proposedSlots.length >= 5 && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {time}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Selected Slots */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Ausgewählt ({data.proposedSlots.length}/5):
        </Label>
        {data.proposedSlots.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Wählen Sie mindestens einen Termin aus
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.proposedSlots.map((slot, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="pl-3 pr-1 py-1.5 flex items-center gap-2"
              >
                <Clock className="h-3 w-3" />
                {format(slot, 'EEE, dd.MM. HH:mm', { locale: de })}
                <button
                  type="button"
                  onClick={() => removeSlot(index)}
                  className="hover:bg-muted rounded p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="ghost" onClick={onBack}>
          ← Zurück
        </Button>
        <Button onClick={onNext} disabled={data.proposedSlots.length === 0}>
          Weiter →
        </Button>
      </div>
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={cn('block', className)}>{children}</label>;
}
