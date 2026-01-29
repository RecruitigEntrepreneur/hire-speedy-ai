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
  TrendingUp,
  Briefcase,
  Clock,
  Building2
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
  const configs: Record<string, { label: string; color: string; bgClass: string }> = {
    pending: { 
      label: 'Eingereicht', 
      color: 'text-amber-700', 
      bgClass: 'bg-amber-50 border-amber-200' 
    },
    in_review: { 
      label: 'In Prüfung', 
      color: 'text-blue-700', 
      bgClass: 'bg-blue-50 border-blue-200' 
    },
    interview: { 
      label: 'Interview', 
      color: 'text-purple-700', 
      bgClass: 'bg-purple-50 border-purple-200' 
    },
    offer: { 
      label: 'Angebot', 
      color: 'text-emerald-700', 
      bgClass: 'bg-emerald-50 border-emerald-200' 
    },
    hired: { 
      label: 'Eingestellt', 
      color: 'text-green-700', 
      bgClass: 'bg-green-50 border-green-200' 
    },
    rejected: { 
      label: 'Abgelehnt', 
      color: 'text-red-700', 
      bgClass: 'bg-red-50 border-red-200' 
    },
    withdrawn: { 
      label: 'Zurückgezogen', 
      color: 'text-muted-foreground', 
      bgClass: 'bg-muted/50 border-muted' 
    },
    client_rejected: { 
      label: 'Client Absage', 
      color: 'text-red-700', 
      bgClass: 'bg-red-50 border-red-200' 
    },
  };
  return configs[status] || { label: status, color: 'text-muted-foreground', bgClass: 'bg-muted/50 border-muted' };
};

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const getMatchScoreColor = (score: number) => {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-500';
};

export function RecentSubmissionsCard({ submissions, loading }: RecentSubmissionsCardProps) {
  if (loading) {
    return (
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Your Talent Submissions
            </CardTitle>
            <CardDescription>Track your recent candidate submissions</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
            <p className="text-sm text-muted-foreground">Lade Submissions...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Your Talent Submissions
          </CardTitle>
          <CardDescription>Track your recent candidate submissions</CardDescription>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/recruiter/submissions">
            Alle anzeigen
            <ArrowUpRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {submissions.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold">Noch keine Submissions</h3>
            <p className="text-muted-foreground mt-1 mb-4">
              Reiche Kandidaten bei Jobs ein, um sie hier zu sehen.
            </p>
            <Button variant="default" size="sm" asChild>
              <Link to="/recruiter/jobs">
                <Briefcase className="mr-2 h-4 w-4" />
                Jobs durchsuchen
              </Link>
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
                <Link
                  key={submission.id}
                  to={`/recruiter/candidates/${submission.candidate.id}`}
                  className="block"
                >
                  <div className="group p-4 rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200">
                    {/* Top Row: Avatar, Name, Status, Alerts */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Avatar className="h-12 w-12 ring-2 ring-background shadow-sm">
                          <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-sm font-semibold">
                            {getInitials(submission.candidate.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                              {submission.candidate.full_name}
                            </h4>
                            {submission.alert_count > 0 && (
                              <Badge variant="destructive" className="text-xs px-1.5 py-0.5 h-5 animate-pulse">
                                <AlertTriangle className="h-3 w-3 mr-0.5" />
                                {submission.alert_count} {submission.alert_count === 1 ? 'Alert' : 'Alerts'}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
                            {submission.candidate.job_title && (
                              <>
                                <span>{submission.candidate.job_title}</span>
                                <span className="text-muted-foreground/50">→</span>
                              </>
                            )}
                            <span className="font-medium text-foreground/80">{submission.job.title}</span>
                          </p>
                        </div>
                      </div>
                      
                      {/* Status Badge */}
                      <Badge 
                        variant="outline" 
                        className={`${statusConfig.bgClass} ${statusConfig.color} border font-medium whitespace-nowrap`}
                      >
                        {statusConfig.label}
                      </Badge>
                    </div>

                    {/* Info Row: Match Score, Interview Date, Last Update */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                      {submission.match_score !== null && (
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className={`h-4 w-4 ${getMatchScoreColor(submission.match_score)}`} />
                          <span className={`font-semibold ${getMatchScoreColor(submission.match_score)}`}>
                            {submission.match_score}%
                          </span>
                          <span className="text-muted-foreground text-xs">Match</span>
                        </div>
                      )}
                      
                      {submission.interview_date && (
                        <div className="flex items-center gap-1.5 text-purple-600">
                          <Calendar className="h-4 w-4" />
                          <span className="font-medium">
                            {format(new Date(submission.interview_date), 'dd.MM. HH:mm', { locale: de })}
                          </span>
                        </div>
                      )}

                      {submission.job.company_name && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                          <span className="truncate max-w-[120px]">{submission.job.company_name}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-muted-foreground ml-auto">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-xs">{updatedAgo}</span>
                      </div>
                    </div>

                    {/* Notes Preview (if exists) */}
                    {submission.recruiter_notes && (
                      <div className="mt-3 pt-3 border-t border-border/40">
                        <p className="text-sm text-muted-foreground line-clamp-2 italic">
                          "{submission.recruiter_notes}"
                        </p>
                      </div>
                    )}

                    {/* Quick Action Buttons */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
                      <div className="flex items-center gap-1">
                        {submission.candidate.phone && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-2 text-muted-foreground hover:text-primary"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              window.location.href = `tel:${submission.candidate.phone}`;
                            }}
                          >
                            <Phone className="h-4 w-4 mr-1" />
                            Anrufen
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 px-2 text-muted-foreground hover:text-primary"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.location.href = `mailto:${submission.candidate.email}`;
                          }}
                        >
                          <Mail className="h-4 w-4 mr-1" />
                          Email
                        </Button>
                      </div>
                      <span className="text-xs text-primary font-medium group-hover:underline flex items-center gap-1">
                        Kandidat anzeigen
                        <ArrowUpRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
