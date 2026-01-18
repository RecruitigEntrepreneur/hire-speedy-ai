import { useState, useEffect } from 'react';
import { addDays, setHours, setMinutes, format } from 'date-fns';
import { de } from 'date-fns/locale';

interface TimeSlot {
  datetime: Date;
  isAvailable: boolean;
  label: string;
}

interface CalendarAvailability {
  isConnected: boolean;
  provider: 'google' | 'outlook' | null;
  suggestedSlots: TimeSlot[];
  loading: boolean;
  error: string | null;
}

interface UseCalendarAvailabilityOptions {
  durationMinutes?: number;
  daysAhead?: number;
}

// Generate business hour slots for next 3 weekdays
const generateDefaultSlots = (daysAhead: number = 7): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  let date = new Date();
  let foundDays = 0;
  
  // Default interview times
  const defaultTimes = [
    { hour: 10, minute: 0 },
    { hour: 14, minute: 0 },
    { hour: 11, minute: 0 },
    { hour: 15, minute: 0 },
    { hour: 9, minute: 0 }
  ];
  
  while (foundDays < 3 && slots.length < 5) {
    date = addDays(date, 1);
    const day = date.getDay();
    
    // Skip weekends
    if (day === 0 || day === 6) continue;
    
    const timeOption = defaultTimes[foundDays % defaultTimes.length];
    const slotDate = setMinutes(setHours(new Date(date), timeOption.hour), timeOption.minute);
    
    slots.push({
      datetime: slotDate,
      isAvailable: true,
      label: format(slotDate, 'EEEE, dd. MMMM • HH:mm', { locale: de })
    });
    
    foundDays++;
  }
  
  return slots;
};

export function useCalendarAvailability(options: UseCalendarAvailabilityOptions = {}): CalendarAvailability {
  const { daysAhead = 7 } = options;
  
  const [isConnected, setIsConnected] = useState(false);
  const [provider, setProvider] = useState<'google' | 'outlook' | null>(null);
  const [suggestedSlots, setSuggestedSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // For Phase 1: No calendar integration yet
    // Calendar connectivity will be added in Phase 2
    // For now, just generate default slots based on business hours
    
    setIsConnected(false);
    setProvider(null);
    setSuggestedSlots(generateDefaultSlots(daysAhead));
    setLoading(false);
    setError(null);
  }, [daysAhead]);

  return {
    isConnected,
    provider,
    suggestedSlots,
    loading,
    error
  };
}
