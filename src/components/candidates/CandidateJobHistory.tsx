import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { History, Briefcase } from 'lucide-react';

interface JobHistory {
  jobId: string;
  jobTitle: string;
  companyName: string;
  status: string;
  submittedAt: string;
}

interface CandidateJobHistoryProps {
  candidateId: string;
  currentSubmissionId?: string;
  compact?: boolean;
}

export function CandidateJobHistory({ 
  candidateId, 
  currentSubmissionId,
  compact = true 
}: CandidateJobHistoryProps) {
  const [history, setHistory] = useState<JobHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [candidateId]);

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from('submissions')
      .select(`
        id,
        status,
        submitted_at,
        job:jobs(id, title, company_name)
      `)
      .eq('candidate_id', candidateId)
      .order('submitted_at', { ascending: false });

    if (!error && data) {
      setHistory(
        data
          .filter((s: any) => s.id !== currentSubmissionId)
          .map((s: any) => ({
            jobId: s.job?.id,
            jobTitle: s.job?.title || 'Unbekannt',
            companyName: s.job?.company_name || '',
            status: s.status,
            submittedAt: s.submitted_at,
          }))
      );
    }
    setLoading(false);
  };

  if (loading || history.length === 0) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'hired': return 'text-emerald-600';
      case 'rejected': return 'text-red-500';
      case 'interview': return 'text-blue-500';
      default: return 'text-muted-foreground';
    }
  };

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className="gap-1 text-[10px] cursor-help text-muted-foreground"
            >
              <History className="h-3 w-3" />
              {history.length} weitere
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs p-3">
            <div className="space-y-2">
              <p className="font-medium text-sm">Weitere Bewerbungen</p>
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <Briefcase className="h-3 w-3 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="font-medium">{h.jobTitle}</span>
                    <span className={`ml-1 ${getStatusColor(h.status)}`}>
                      ({h.status})
                    </span>
                  </div>
                </div>
              ))}
              {history.length > 5 && (
                <p className="text-xs text-muted-foreground">
                  +{history.length - 5} weitere
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <History className="h-4 w-4 text-muted-foreground" />
        Bewerbungs-Historie ({history.length})
      </div>
      <div className="space-y-1">
        {history.map((h, i) => (
          <div 
            key={i} 
            className="flex items-center justify-between text-sm p-2 rounded bg-muted/30"
          >
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <span>{h.jobTitle}</span>
            </div>
            <Badge 
              variant="outline" 
              className={`text-xs ${getStatusColor(h.status)}`}
            >
              {h.status}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
