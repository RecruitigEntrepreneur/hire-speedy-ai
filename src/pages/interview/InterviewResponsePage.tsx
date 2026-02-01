import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Loader2, Calendar as CalendarIcon, Clock, CheckCircle, AlertCircle, 
  Building2, ArrowLeft, Send, X, Plus, Video, Phone, MapPin
} from 'lucide-react';
import { format, setHours, setMinutes, isBefore, startOfToday } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TimeSlot {
  datetime: string;
  status: 'available' | 'selected' | 'expired';
}

interface InterviewData {
  id: string;
  proposed_slots: TimeSlot[];
  duration_minutes: number;
  meeting_format: string;
  meeting_link?: string;
  onsite_address?: string;
  client_message?: string;
  status: string;
  scheduled_at: string | null;
  submission: {
    job: {
      title: string;
      industry?: string;
    };
  };
}

type ViewMode = 'selection' | 'counter' | 'decline' | 'success' | 'counter_success' | 'decline_success';

const MEETING_FORMAT_LABELS: Record<string, { label: string; icon: typeof Video }> = {
  teams: { label: 'Microsoft Teams', icon: Video },
  meet: { label: 'Google Meet', icon: Video },
  video: { label: 'Video-Interview', icon: Video },
  phone: { label: 'Telefon-Interview', icon: Phone },
  onsite: { label: 'Vor-Ort-Interview', icon: MapPin },
};

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
];

export default function InterviewResponsePage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const initialAction = searchParams.get('action');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [interview, setInterview] = useState<InterviewData | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('selection');
  
  // Counter proposal state
  const [counterSlots, setCounterSlots] = useState<Date[]>([]);
  const [counterMessage, setCounterMessage] = useState('');
  const [counterDate, setCounterDate] = useState<Date | undefined>();
  const [counterCalendarOpen, setCounterCalendarOpen] = useState(false);
  
  // Decline state
  const [declineReason, setDeclineReason] = useState('');

  useEffect(() => {
    if (token) {
      fetchInterview();
    }
  }, [token]);

  useEffect(() => {
    if (initialAction === 'counter') setViewMode('counter');
    else if (initialAction === 'decline') setViewMode('decline');
  }, [initialAction]);

  const fetchInterview = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('interviews')
        .select(`
          id,
          proposed_slots,
          duration_minutes,
          meeting_format,
          meeting_link,
          onsite_address,
          client_message,
          status,
          scheduled_at,
          submission:submissions(
            job:jobs(title, industry)
          )
        `)
        .eq('response_token', token)
        .single();

      if (fetchError) throw fetchError;
      
      if (!data) {
        setError('Ungültiger oder abgelaufener Link');
        return;
      }

      // Check status
      if (data.status === 'scheduled') {
        setViewMode('success');
      } else if (data.status === 'declined') {
        setViewMode('decline_success');
      } else if (data.status === 'counter_proposed') {
        setViewMode('counter_success');
      } else if (data.status !== 'pending_response') {
        setError('Diese Einladung wurde bereits bearbeitet');
        return;
      }

      const transformedData: InterviewData = {
        id: data.id,
        proposed_slots: (data.proposed_slots as unknown as TimeSlot[]) || [],
        duration_minutes: data.duration_minutes || 60,
        meeting_format: data.meeting_format || 'video',
        meeting_link: data.meeting_link,
        onsite_address: data.onsite_address,
        client_message: data.client_message,
        status: data.status || 'pending_response',
        scheduled_at: data.scheduled_at,
        submission: {
          job: {
            title: (data.submission as any)?.job?.title || 'Position',
            industry: (data.submission as any)?.job?.industry,
          }
        }
      };

      setInterview(transformedData);
    } catch (err) {
      console.error('Error fetching interview:', err);
      setError('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (selectedIndex === null || !interview) return;

    setSubmitting(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('process-interview-response', {
        body: {
          action: 'accept',
          responseToken: token,
          selectedSlotIndex: selectedIndex,
        },
      });

      if (invokeError) throw invokeError;
      if (!data?.success) throw new Error(data?.error || 'Fehler bei der Bestätigung');

      setViewMode('success');
      toast.success('Termin erfolgreich bestätigt!');
      await fetchInterview();
    } catch (err: any) {
      console.error('Error accepting:', err);
      toast.error(err.message || 'Fehler bei der Terminbestätigung');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCounter = async () => {
    if (counterSlots.length === 0) return;

    setSubmitting(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('process-interview-response', {
        body: {
          action: 'counter',
          responseToken: token,
          counterSlots: counterSlots.map(s => s.toISOString()),
          message: counterMessage || undefined,
        },
      });

      if (invokeError) throw invokeError;
      if (!data?.success) throw new Error(data?.error || 'Fehler beim Senden');

      setViewMode('counter_success');
      toast.success('Gegenvorschlag erfolgreich gesendet!');
    } catch (err: any) {
      console.error('Error sending counter:', err);
      toast.error(err.message || 'Fehler beim Senden des Gegenvorschlags');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    setSubmitting(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('process-interview-response', {
        body: {
          action: 'decline',
          responseToken: token,
          declineReason: declineReason || undefined,
        },
      });

      if (invokeError) throw invokeError;
      if (!data?.success) throw new Error(data?.error || 'Fehler beim Absagen');

      setViewMode('decline_success');
      toast.success('Absage wurde übermittelt');
    } catch (err: any) {
      console.error('Error declining:', err);
      toast.error(err.message || 'Fehler bei der Absage');
    } finally {
      setSubmitting(false);
    }
  };

  const addCounterSlot = (date: Date, time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const slot = setMinutes(setHours(new Date(date), hours), minutes);
    
    if (counterSlots.some(s => s.getTime() === slot.getTime())) return;
    if (counterSlots.length >= 3) return;
    
    setCounterSlots(prev => [...prev, slot].sort((a, b) => a.getTime() - b.getTime()));
  };

  const removeCounterSlot = (index: number) => {
    setCounterSlots(prev => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Lade Interview-Details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Fehler</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!interview) return null;

  const formatConfig = MEETING_FORMAT_LABELS[interview.meeting_format] || { label: 'Interview', icon: Video };
  const FormatIcon = formatConfig.icon;
  const companyDescription = interview.submission.job.industry 
    ? `${interview.submission.job.industry}-Unternehmen`
    : 'Technologie-Unternehmen';

  // Success states
  if (viewMode === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted py-8 px-4">
        <div className="max-w-lg mx-auto">
          <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <CardContent className="pt-6 text-center">
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-green-800 dark:text-green-200 mb-2">Termin bestätigt!</h2>
              <p className="text-green-700 dark:text-green-300 mb-6">
                Sie erhalten eine Bestätigungs-E-Mail mit allen Details und einem Kalender-Event.
              </p>
              {interview.scheduled_at && (
                <div className="bg-white dark:bg-card rounded-lg p-6 border border-green-200 mb-4">
                  <p className="text-lg font-semibold">
                    {format(new Date(interview.scheduled_at), "EEEE, d. MMMM yyyy", { locale: de })}
                  </p>
                  <p className="text-3xl font-bold text-primary mt-2">
                    {format(new Date(interview.scheduled_at), "HH:mm", { locale: de })} Uhr
                  </p>
                  <p className="text-muted-foreground mt-2">
                    Dauer: {interview.duration_minutes} Minuten
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (viewMode === 'counter_success') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted py-8 px-4">
        <div className="max-w-lg mx-auto">
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
            <CardContent className="pt-6 text-center">
              <CalendarIcon className="h-16 w-16 text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-200 mb-2">Gegenvorschlag gesendet!</h2>
              <p className="text-blue-700 dark:text-blue-300">
                Das Unternehmen wurde über Ihre alternativen Termine informiert und wird sich bei Ihnen melden.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (viewMode === 'decline_success') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted py-8 px-4">
        <div className="max-w-lg mx-auto">
          <Card className="border-muted">
            <CardContent className="pt-6 text-center">
              <X className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Absage übermittelt</h2>
              <p className="text-muted-foreground">
                Das Unternehmen wurde über Ihre Absage informiert.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
            <CalendarIcon className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Interview-Einladung</h1>
          <p className="text-muted-foreground mt-2">
            {interview.submission.job.title}
          </p>
        </div>

        {/* Job Info Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                <Building2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold">{interview.submission.job.title}</h3>
                <p className="text-muted-foreground text-sm">{companyDescription}</p>
                <div className="flex flex-wrap gap-3 mt-3">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <FormatIcon className="h-4 w-4" />
                    <span>{formatConfig.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{interview.duration_minutes} Minuten</span>
                  </div>
                </div>
              </div>
            </div>

            {interview.client_message && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg border-l-4 border-primary">
                <p className="text-xs text-muted-foreground mb-1">Nachricht des Unternehmens:</p>
                <p className="text-sm italic">„{interview.client_message}"</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main Content based on View Mode */}
        {viewMode === 'selection' && (
          <Card>
            <CardHeader>
              <CardTitle>Terminvorschläge</CardTitle>
              <CardDescription>
                Wählen Sie einen passenden Termin aus
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {interview.proposed_slots.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  Keine Termine verfügbar
                </p>
              ) : (
                interview.proposed_slots.map((slot, index) => {
                  const slotDate = new Date(slot.datetime);
                  const isPast = isBefore(slotDate, new Date());
                  const isSelected = selectedIndex === index;

                  return (
                    <button
                      key={index}
                      onClick={() => !isPast && setSelectedIndex(index)}
                      disabled={isPast}
                      className={cn(
                        'w-full p-4 rounded-lg border-2 text-left transition-all',
                        isPast 
                          ? 'opacity-50 cursor-not-allowed bg-muted border-muted' 
                          : isSelected 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-primary/50 hover:bg-accent/50'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {format(slotDate, "EEEE, d. MMMM yyyy", { locale: de })}
                          </p>
                          <p className="text-lg font-semibold text-primary">
                            {format(slotDate, "HH:mm", { locale: de })} Uhr
                          </p>
                        </div>
                        {isPast ? (
                          <Badge variant="secondary">Abgelaufen</Badge>
                        ) : isSelected ? (
                          <CheckCircle className="h-6 w-6 text-primary" />
                        ) : null}
                      </div>
                    </button>
                  );
                })
              )}

              {/* Action Buttons */}
              <div className="pt-4 space-y-3">
                <Button 
                  onClick={handleAccept} 
                  disabled={selectedIndex === null || submitting}
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Wird bestätigt...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Termin annehmen
                    </>
                  )}
                </Button>

                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setViewMode('counter')}
                    disabled={submitting}
                  >
                    🔄 Gegenvorschlag
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setViewMode('decline')}
                    disabled={submitting}
                    className="text-destructive border-destructive/50 hover:bg-destructive/10"
                  >
                    ❌ Absagen
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {viewMode === 'counter' && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setViewMode('selection')}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <CardTitle>Gegenvorschlag</CardTitle>
                  <CardDescription>Schlagen Sie alternative Termine vor (max. 3)</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Date + Time Selection */}
              <div className="flex gap-2">
                <Popover open={counterCalendarOpen} onOpenChange={setCounterCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {counterDate ? format(counterDate, 'dd.MM.yyyy', { locale: de }) : 'Datum wählen'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={counterDate}
                      onSelect={(date) => {
                        setCounterDate(date);
                        setCounterCalendarOpen(false);
                      }}
                      disabled={(date) => isBefore(date, startOfToday())}
                      initialFocus
                      locale={de}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {counterDate && (
                <div className="grid grid-cols-4 gap-1">
                  {TIME_SLOTS.map((time) => (
                    <Button
                      key={time}
                      variant="outline"
                      size="sm"
                      disabled={counterSlots.length >= 3}
                      onClick={() => addCounterSlot(counterDate, time)}
                      className="text-xs"
                    >
                      {time}
                    </Button>
                  ))}
                </div>
              )}

              {/* Selected Counter Slots */}
              {counterSlots.length > 0 && (
                <div className="space-y-2">
                  <Label>Ihre Terminvorschläge:</Label>
                  <div className="space-y-2">
                    {counterSlots.map((slot, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <span className="text-sm">
                          {format(slot, "EEE, dd.MM. 'um' HH:mm 'Uhr'", { locale: de })}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCounterSlot(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Message */}
              <div className="space-y-2">
                <Label htmlFor="counterMessage">Nachricht (optional)</Label>
                <Textarea
                  id="counterMessage"
                  placeholder="Die vorgeschlagenen Termine passen leider nicht..."
                  value={counterMessage}
                  onChange={(e) => setCounterMessage(e.target.value)}
                  rows={3}
                />
              </div>

              <Button
                onClick={handleCounter}
                disabled={counterSlots.length === 0 || submitting}
                className="w-full"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Wird gesendet...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Gegenvorschlag senden
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {viewMode === 'decline' && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setViewMode('selection')}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <CardTitle>Absagen</CardTitle>
                  <CardDescription>Möchten Sie das Interview wirklich absagen?</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="declineReason">Grund für Absage (optional)</Label>
                <Textarea
                  id="declineReason"
                  placeholder="z.B. Stelle bereits besetzt, andere Prioritäten..."
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  rows={3}
                />
              </div>

              <Button
                variant="destructive"
                onClick={handleDecline}
                disabled={submitting}
                className="w-full"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Wird gesendet...
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    Interview absagen
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          🔒 Ihre Daten werden erst nach Ihrer Zustimmung freigegeben (DSGVO-konform).
        </p>
      </div>
    </div>
  );
}
