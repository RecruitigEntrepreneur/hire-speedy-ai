import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { differenceInHours, differenceInDays, format } from 'date-fns';
import { de } from 'date-fns/locale';
import { AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SlaDeadline {
  id: string;
  submission_id: string;
  sla_type: string;
  deadline: string;
  status: string;
  candidate_name: string;
  job_title: string;
}

interface SlaWarningBannerProps {
  className?: string;
}

export function SlaWarningBanner({ className }: SlaWarningBannerProps) {
  const [urgentDeadlines, setUrgentDeadlines] = useState<SlaDeadline[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchUrgentDeadlines();
  }, []);

  const fetchUrgentDeadlines = async () => {
    try {
      // Fetch SLA deadlines that are approaching (within 48 hours) or breached
      const { data, error } = await supabase
        .from('sla_deadlines')
        .select(`
          id,
          submission_id,
          sla_type,
          deadline,
          status,
          submissions!inner (
            candidates!inner (full_name),
            jobs!inner (title)
          )
        `)
        .in('status', ['active', 'warning', 'breached'])
        .lte('deadline', new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString())
        .order('deadline', { ascending: true })
        .limit(5);

      if (error) throw error;

      const formatted = (data || []).map((d: any) => ({
        id: d.id,
        submission_id: d.submission_id,
        sla_type: d.sla_type,
        deadline: d.deadline,
        status: d.status,
        candidate_name: d.submissions?.candidates?.full_name || 'Unbekannt',
        job_title: d.submissions?.jobs?.title || 'Unbekannt'
      }));

      setUrgentDeadlines(formatted);
    } catch (error) {
      console.error('Error fetching SLA deadlines:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTimeRemaining = (deadline: string) => {
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const hours = differenceInHours(deadlineDate, now);
    const days = differenceInDays(deadlineDate, now);

    if (hours < 0) {
      return { text: `${Math.abs(hours)}h überfällig`, isOverdue: true };
    }
    if (hours < 24) {
      return { text: `${hours}h verbleibend`, isOverdue: false };
    }
    return { text: `${days}d verbleibend`, isOverdue: false };
  };

  const getSlaTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'initial_review': 'Erstprüfung',
      'interview_scheduling': 'Interview-Planung',
      'feedback': 'Feedback',
      'decision': 'Entscheidung',
      'offer': 'Angebot'
    };
    return labels[type] || type;
  };

  if (loading || urgentDeadlines.length === 0) {
    return null;
  }

  const breachedCount = urgentDeadlines.filter(d => d.status === 'breached').length;
  const warningCount = urgentDeadlines.filter(d => d.status !== 'breached').length;

  return (
    <Alert 
      variant={breachedCount > 0 ? 'destructive' : 'default'} 
      className={`border-l-4 ${breachedCount > 0 ? 'border-l-red-500' : 'border-l-yellow-500'} ${className}`}
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        SLA-Warnung
        {breachedCount > 0 && (
          <Badge variant="destructive">{breachedCount} überfällig</Badge>
        )}
        {warningCount > 0 && (
          <Badge variant="secondary">{warningCount} dringend</Badge>
        )}
      </AlertTitle>
      <AlertDescription>
        <div className="mt-3 space-y-2">
          {urgentDeadlines.slice(0, 3).map((deadline) => {
            const timeInfo = getTimeRemaining(deadline.deadline);
            return (
              <div 
                key={deadline.id}
                className="flex items-center justify-between gap-4 p-2 rounded-lg bg-background/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Clock className={`h-4 w-4 flex-shrink-0 ${timeInfo.isOverdue ? 'text-red-500' : 'text-yellow-500'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {deadline.candidate_name} – {getSlaTypeLabel(deadline.sla_type)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {deadline.job_title}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={timeInfo.isOverdue ? 'destructive' : 'outline'} className="text-xs">
                    {timeInfo.text}
                  </Badge>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => navigate(`/dashboard/candidates/${deadline.submission_id}`)}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        {urgentDeadlines.length > 3 && (
          <Button 
            variant="link" 
            className="mt-2 p-0 h-auto"
            onClick={() => navigate('/dashboard/candidates')}
          >
            +{urgentDeadlines.length - 3} weitere anzeigen
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
