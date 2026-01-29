import { Link } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  ArrowUpRight, 
  Phone, 
  Mail, 
  Calendar, 
  AlertTriangle,
  FileText,
  Loader2,
  TrendingUp
} from 'lucide-react';

export interface RecentSubmission {
  id: string;
  status: string;
  stage: string | null;
  match_score: number | null;
  updated_at: string;
  recruiter_notes: string | null;
  candidate: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    job_title: string | null;
  };
  job: {
    id: string;
    title: string;
    company_name: string | null;
  };
  alert_count: number;
  interview_date: string | null;
}

interface RecentSubmissionsCardProps {
  submissions: RecentSubmission[];
  loading?: boolean;
}

const getStatusConfig = (status: string) => {
  const configs: Record<string, { label: string; className: string }> = {
    pending: { label: 'Eingereicht', className: 'bg-amber-100 text-amber-700 border-amber-200' },
    in_review: { label: 'In Prüfung', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    interview: { label: 'Interview', className: 'bg-purple-100 text-purple-700 border-purple-200' },
    offer: { label: 'Angebot', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    hired: { label: 'Eingestellt', className: 'bg-green-100 text-green-700 border-green-200' },
    rejected: { label: 'Abgelehnt', className: 'bg-red-100 text-red-700 border-red-200' },
    withdrawn: { label: 'Zurückgezogen', className: 'bg-muted text-muted-foreground' },
    client_rejected: { label: 'Client Absage', className: 'bg-red-100 text-red-700 border-red-200' },
  };
  return configs[status] || { label: status, className: 'bg-muted text-muted-foreground' };
};

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export function RecentSubmissionsCard({ submissions, loading }: RecentSubmissionsCardProps) {
  if (loading) {
    return (
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Your Talent Submissions</CardTitle>
            <CardDescription>Recent submissions and their status</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Your Talent Submissions</CardTitle>
          <CardDescription>See statuses and data of recent talent submissions</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/recruiter/submissions">
            View all
            <ArrowUpRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {submissions.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No submissions yet</h3>
            <p className="text-muted-foreground">Submit candidates to jobs to see them here.</p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link to="/recruiter/jobs">Browse Jobs</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((submission) => {
              const statusConfig = getStatusConfig(submission.status);
              const updatedAgo = formatDistanceToNow(new Date(submission.updated_at), { 
                addSuffix: true, 
                locale: de 
              });

              return (
                <div
                  key={submission.id}
                  className="p-4 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-accent/30 transition-all"
                >
                  {/* Header: Avatar, Name, Alerts */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-gradient-navy text-primary-foreground text-sm">
                          {getInitials(submission.candidate.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium truncate">{submission.candidate.full_name}</h4>
                          {submission.alert_count > 0 && (
                            <Badge variant="destructive" className="text-xs px-1.5 py-0 h-5">
                              <AlertTriangle className="h-3 w-3 mr-0.5" />
                              {submission.alert_count}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {submission.candidate.job_title || 'Kandidat'} → {submission.job.title}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {updatedAgo}
                    </span>
                  </div>

                  {/* Status Row: Badge, Match Score, Interview Date */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <Badge variant="outline" className={statusConfig.className}>
                      {statusConfig.label}
                    </Badge>
                    {submission.match_score !== null && (
                      <div className="flex items-center gap-1 text-sm">
                        <TrendingUp className="h-3.5 w-3.5 text-emerald" />
                        <span className="font-medium">{submission.match_score}%</span>
                      </div>
                    )}
                    {submission.interview_date && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{format(new Date(submission.interview_date), 'dd.MM. HH:mm', { locale: de })}</span>
                      </div>
                    )}
                  </div>

                  {/* Notes Preview (if exists) */}
                  {submission.recruiter_notes && (
                    <p className="text-sm text-muted-foreground line-clamp-1 mb-3 italic">
                      "{submission.recruiter_notes}"
                    </p>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/30">
                    <div className="flex items-center gap-1">
                      {submission.candidate.phone && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <a href={`tel:${submission.candidate.phone}`}>
                            <Phone className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <a href={`mailto:${submission.candidate.email}`}>
                          <Mail className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs" asChild>
                      <Link to={`/recruiter/submissions/${submission.id}`}>
                        Details
                        <ArrowUpRight className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
