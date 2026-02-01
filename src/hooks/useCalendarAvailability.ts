import { useState, useEffect, useCallback } from 'react';
import { addDays, setHours, setMinutes, format, parseISO, isWithinInterval } from 'date-fns';
import { de } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

interface TimeSlot {
  datetime: Date;
  isAvailable: boolean;
  label: string;
  busyReason?: string;
}

interface BusySlot {
  start: string;
  end: string;
  status: string;
}

interface CalendarAvailability {
  isConnected: boolean;
  provider: 'google' | 'outlook' | null;
  suggestedSlots: TimeSlot[];
  busySlots: BusySlot[];
  loading: boolean;
  error: string | null;
  refreshAvailability: () => Promise<void>;
}

interface UseCalendarAvailabilityOptions {
  durationMinutes?: number;
  daysAhead?: number;
}

// Generate business hour slots for next N weekdays
const generateDefaultSlots = (daysAhead: number = 7, busySlots: BusySlot[] = []): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  let date = new Date();
  let foundDays = 0;
  
  // Business hours: 9-17
  const businessHours = [9, 10, 11, 14, 15, 16];
  
  while (foundDays < Math.min(daysAhead, 5) && slots.length < 15) {
    date = addDays(date, 1);
    const day = date.getDay();
    
    // Skip weekends
    if (day === 0 || day === 6) continue;
    
    foundDays++;
    
    for (const hour of businessHours) {
      const slotStart = setMinutes(setHours(new Date(date), hour), 0);
      const slotEnd = setMinutes(setHours(new Date(date), hour + 1), 0);
      
      // Check if this slot overlaps with any busy slot
      let isBusy = false;
      let busyReason = '';
      
      for (const busy of busySlots) {
        const busyStart = parseISO(busy.start);
        const busyEnd = parseISO(busy.end);
        
        // Check for overlap
        if (
          isWithinInterval(slotStart, { start: busyStart, end: busyEnd }) ||
          isWithinInterval(slotEnd, { start: busyStart, end: busyEnd }) ||
          (slotStart <= busyStart && slotEnd >= busyEnd)
        ) {
          isBusy = true;
          busyReason = busy.status === 'tentative' ? 'Vorläufig belegt' : 'Belegt';
          break;
        }
      }
      
      slots.push({
        datetime: slotStart,
        isAvailable: !isBusy,
        label: format(slotStart, 'EEEE, dd. MMMM • HH:mm', { locale: de }),
        busyReason: isBusy ? busyReason : undefined
      });
    }
  }
  
  return slots;
};

export function useCalendarAvailability(options: UseCalendarAvailabilityOptions = {}): CalendarAvailability {
  const { daysAhead = 7 } = options;
  
  const [isConnected, setIsConnected] = useState(false);
  const [provider, setProvider] = useState<'google' | 'outlook' | null>(null);
  const [suggestedSlots, setSuggestedSlots] = useState<TimeSlot[]>([]);
  const [busySlots, setBusySlots] = useState<BusySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkCalendarConnection = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsConnected(false);
        setProvider(null);
        return { connected: false, provider: null };
      }

      // Check for Microsoft integration
      const { data: msIntegration } = await supabase
        .from('user_integrations')
        .select('id, provider')
        .eq('user_id', user.id)
        .eq('provider', 'microsoft')
        .maybeSingle();

      if (msIntegration) {
        setIsConnected(true);
        setProvider('outlook');
        return { connected: true, provider: 'microsoft' as const };
      }

      // Check for Google integration
      const { data: googleIntegration } = await supabase
        .from('user_integrations')
        .select('id, provider')
        .eq('user_id', user.id)
        .eq('provider', 'google')
        .maybeSingle();

      if (googleIntegration) {
        setIsConnected(true);
        setProvider('google');
        return { connected: true, provider: 'google' as const };
      }

      setIsConnected(false);
      setProvider(null);
      return { connected: false, provider: null };
    } catch (err) {
      console.error('Error checking calendar connection:', err);
      return { connected: false, provider: null };
    }
  }, []);

  const fetchBusySlots = useCallback(async (calendarProvider: 'microsoft' | 'google') => {
    try {
      const startDate = new Date().toISOString();
      const endDate = addDays(new Date(), daysAhead).toISOString();

      if (calendarProvider === 'microsoft') {
        const { data, error: fetchError } = await supabase.functions.invoke('microsoft-auth', {
          body: { 
            action: 'get-free-busy',
            startDate,
            endDate
          }
        });

        if (fetchError) {
          console.error('Error fetching Microsoft busy slots:', fetchError);
          return [];
        }

        return data?.busySlots || [];
      } else if (calendarProvider === 'google') {
        const { data, error: fetchError } = await supabase.functions.invoke('google-auth', {
          body: { 
            action: 'get-free-busy',
            startDate,
            endDate
          }
        });

        if (fetchError) {
          console.error('Error fetching Google busy slots:', fetchError);
          return [];
        }

        return data?.busySlots || [];
      }

      return [];
    } catch (err) {
      console.error('Error fetching busy slots:', err);
      return [];
    }
  }, [daysAhead]);

  const refreshAvailability = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { connected, provider: calendarProvider } = await checkCalendarConnection();

      if (connected && calendarProvider) {
        // Fetch real busy slots from calendar
        const busy = await fetchBusySlots(calendarProvider);
        setBusySlots(busy);
        
        // Generate slots with busy times marked
        const slots = generateDefaultSlots(daysAhead, busy);
        setSuggestedSlots(slots);
      } else {
        // No calendar connected - generate default slots without busy info
        setBusySlots([]);
        const slots = generateDefaultSlots(daysAhead, []);
        setSuggestedSlots(slots);
      }
    } catch (err) {
      console.error('Error refreshing availability:', err);
      setError('Fehler beim Laden der Verfügbarkeit');
      // Fall back to default slots
      setSuggestedSlots(generateDefaultSlots(daysAhead, []));
    } finally {
      setLoading(false);
    }
  }, [checkCalendarConnection, fetchBusySlots, daysAhead]);

  useEffect(() => {
    refreshAvailability();
  }, [refreshAvailability]);

  return {
    isConnected,
    provider,
    suggestedSlots,
    busySlots,
    loading,
    error,
    refreshAvailability
  };
}