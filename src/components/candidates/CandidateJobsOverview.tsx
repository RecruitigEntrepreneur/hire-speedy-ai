import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Briefcase, Clock, Building2, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface CandidateJobsOverviewProps {
  candidateId: string;
}

interface JobSubmission {
  id: string;
  status: string;
  submitted_at: string;
  job: {
    id: string;
    title: string;
    company_name: string;
    status: string;
  };
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  submitted: { label: 'Eingereicht', variant: 'default' },
  accepted: { label: 'Akzeptiert', variant: 'secondary' },
  rejected: { label: 'Abgelehnt', variant: 'destructive' },
  interview: { label: 'Interview', variant: 'outline' },
  offer: { label: 'Angebot', variant: 'secondary' },
  hired: { label: 'Eingestellt', variant: 'secondary' },
};

export function CandidateJobsOverview({ candidateId }: CandidateJobsOverviewProps) {
  const { data: submissions, isLoading } = useQuery({
    queryKey: ['candidate-jobs', candidateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          id,
          status,
          submitted_at,
          job:jobs(id, title, company_name, status)
        `)
        .eq('candidate_id', candidateId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      return data as unknown as JobSubmission[];
    },
    enabled: !!candidateId
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!submissions || submissions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Keine Bewerbungen vorhanden</p>
        </CardContent>
      </Card>
    );
  }

  const activeCount = submissions.filter(s => !['rejected', 'hired'].includes(s.status)).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Alle Bewerbungen
          <Badge variant="outline" className="ml-auto">
            {activeCount} aktiv / {submissions.length} gesamt
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {submissions.map((submission) => {
          const status = statusConfig[submission.status] || { label: submission.status, variant: 'default' as const };
          
          return (
            <Link
              key={submission.id}
              to={`/recruiter/jobs/${submission.job.id}`}
              className="block"
            >
              <div className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{submission.job.title}</p>
                    <p className="text-sm text-muted-foreground">{submission.job.company_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <Badge variant={status.variant}>{status.label}</Badge>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(submission.submitted_at), { addSuffix: true, locale: de })}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
