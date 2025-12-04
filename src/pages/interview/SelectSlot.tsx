import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, Calendar, Clock, CheckCircle, AlertCircle, Building2
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';

interface TimeSlot {
  datetime: string;
  status: 'available' | 'selected' | 'expired';
}

interface InterviewData {
  id: string;
  proposed_slots: TimeSlot[];
  selected_slot_index: number | null;
  scheduled_at: string | null;
  status: string;
  duration_minutes: number;
  submission: {
    job: {
      title: string;
      company_name: string;
    };
  };
}

export default function SelectSlot() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [interview, setInterview] = useState<InterviewData | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (token) {
      fetchInterview();
    }
  }, [token]);

  const fetchInterview = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('interviews')
        .select(`
          id,
          proposed_slots,
          selected_slot_index,
          scheduled_at,
          status,
          duration_minutes,
          submission:submissions(
            job:jobs(title, company_name)
          )
        `)
        .eq('selection_token', token)
        .single();

      if (fetchError) throw fetchError;
      
      if (!data) {
        setError('Ungültiger oder abgelaufener Link');
        return;
      }

      // Transform data
      const transformedData: InterviewData = {
        id: data.id,
        proposed_slots: (data.proposed_slots as unknown as TimeSlot[]) || [],
        selected_slot_index: data.selected_slot_index,
        scheduled_at: data.scheduled_at,
        status: data.status || 'pending',
        duration_minutes: data.duration_minutes || 60,
        submission: {
          job: {
            title: (data.submission as any)?.job?.title || 'Position',
            company_name: (data.submission as any)?.job?.company_name || 'Unternehmen',
          }
        }
      };

      setInterview(transformedData);

      // Check if already selected
      if (transformedData.selected_slot_index !== null) {
        setSelectedIndex(transformedData.selected_slot_index);
        setSuccess(true);
      }
    } catch (err) {
      console.error('Error fetching interview:', err);
      setError('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSlot = async () => {
    if (selectedIndex === null || !interview) return;

    setSubmitting(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('schedule-interview', {
        body: {
          action: 'select_slot',
          selection_token: token,
          slot_index: selectedIndex,
        },
      });

      if (invokeError) throw invokeError;
      if (!data?.success) throw new Error(data?.error || 'Fehler bei der Auswahl');

      setSuccess(true);
      toast.success('Termin erfolgreich bestätigt!');
      
      // Refresh data
      await fetchInterview();
    } catch (err: any) {
      console.error('Error selecting slot:', err);
      toast.error(err.message || 'Fehler bei der Terminauswahl');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Lade Terminoptionen...</p>
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

  const isAlreadyScheduled = interview.scheduled_at !== null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
            <Calendar className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Interview-Terminauswahl</h1>
          <p className="text-muted-foreground mt-2">
            Wählen Sie einen passenden Termin für Ihr Interview
          </p>
        </div>

        {/* Job Info */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                <Building2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">{interview.submission.job.title}</h3>
                <p className="text-muted-foreground">{interview.submission.job.company_name}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Dauer: {interview.duration_minutes} Minuten
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Success State */}
        {success && isAlreadyScheduled && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6 text-center">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-green-800 mb-2">Termin bestätigt!</h2>
              <p className="text-green-700 mb-4">
                Ihr Interview ist für den folgenden Zeitpunkt geplant:
              </p>
              <div className="bg-white rounded-lg p-4 border border-green-200">
                <p className="text-lg font-semibold">
                  {format(new Date(interview.scheduled_at!), "EEEE, d. MMMM yyyy", { locale: de })}
                </p>
                <p className="text-2xl font-bold text-primary">
                  {format(new Date(interview.scheduled_at!), "HH:mm", { locale: de })} Uhr
                </p>
              </div>
              <p className="text-sm text-green-600 mt-4">
                Sie erhalten eine Bestätigungs-E-Mail mit allen Details.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Slot Selection */}
        {!isAlreadyScheduled && (
          <Card>
            <CardHeader>
              <CardTitle>Verfügbare Termine</CardTitle>
              <CardDescription>
                Klicken Sie auf einen Termin, um ihn auszuwählen
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
                  const isPast = slotDate < new Date();
                  const isSelected = selectedIndex === index;

                  return (
                    <button
                      key={index}
                      onClick={() => !isPast && setSelectedIndex(index)}
                      disabled={isPast}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                        isPast 
                          ? 'opacity-50 cursor-not-allowed bg-muted border-muted' 
                          : isSelected 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-primary/50 hover:bg-accent/50'
                      }`}
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

              <Button 
                onClick={handleSelectSlot} 
                disabled={selectedIndex === null || submitting}
                className="w-full mt-4"
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
                    Termin bestätigen
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Bei Fragen kontaktieren Sie bitte den zuständigen Recruiter.
        </p>
      </div>
    </div>
  );
}
