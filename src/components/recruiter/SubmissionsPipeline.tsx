import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
  ArrowUpRight, 
  Phone, 
  Mail, 
  Calendar, 
  AlertTriangle,
  FileText,
  Loader2,
  TrendingUp,
  Euro
} from 'lucide-react';

export interface PipelineSubmission {
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
    salary_min: number | null;
    salary_max: number | null;
    recruiter_fee_percentage: number | null;
  };
  alert_count: number;
  interview_date: string | null;
  potential_earning: number | null;
}

interface SubmissionsPipelineProps {
  submissions: PipelineSubmission[];
  loading?: boolean;
}

const PIPELINE_STAGES = [
  { key: 'submitted', label: 'Eingereicht', statuses: ['submitted', 'pending'], colorClass: 'bg-amber-500', bgClass: 'bg-amber-50', borderClass: 'border-amber-200', textClass: 'text-amber-700' },
  { key: 'in_review', label: 'In Prüfung', statuses: ['in_review'], colorClass: 'bg-blue-500', bgClass: 'bg-blue-50', borderClass: 'border-blue-200', textClass: 'text-blue-700' },
  { key: 'interview', label: 'Interview', statuses: ['interview'], colorClass: 'bg-purple-500', bgClass: 'bg-purple-50', borderClass: 'border-purple-200', textClass: 'text-purple-700' },
  { key: 'offer', label: 'Angebot', statuses: ['offer'], colorClass: 'bg-emerald-500', bgClass: 'bg-emerald-50', borderClass: 'border-emerald-200', textClass: 'text-emerald-700' },
];

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

const formatEarning = (amount: number | null) => {
  if (!amount) return null;
  if (amount >= 1000) {
    return `~€${Math.round(amount / 1000)}k`;
  }
  return `~€${amount.toLocaleString()}`;
};

interface PipelineCardProps {
  submission: PipelineSubmission;
}

function PipelineCard({ submission }: PipelineCardProps) {
  return (
    <Link
      to={`/recruiter/candidates/${submission.candidate.id}`}
      className="block"
    >
      <div className="group p-3 rounded-lg border border-border/60 bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 min-w-[200px]">
        {/* Header: Avatar + Name + Alert */}
        <div className="flex items-start gap-2 mb-2">
          <Avatar className="h-8 w-8 ring-2 ring-background shadow-sm shrink-0">
            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-xs font-semibold">
              {getInitials(submission.candidate.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <h4 className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
                {submission.candidate.full_name}
              </h4>
              {submission.alert_count > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4 animate-pulse shrink-0">
                  <AlertTriangle className="h-2.5 w-2.5" />
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {submission.job.title}
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-3 text-xs mb-2">
          {submission.match_score !== null && (
            <div className="flex items-center gap-1">
              <TrendingUp className={`h-3 w-3 ${getMatchScoreColor(submission.match_score)}`} />
              <span className={`font-semibold ${getMatchScoreColor(submission.match_score)}`}>
                {submission.match_score}%
              </span>
            </div>
          )}
          
          {submission.potential_earning && (
            <div className="flex items-center gap-1 text-emerald-600">
              <Euro className="h-3 w-3" />
              <span className="font-semibold">
                {formatEarning(submission.potential_earning)}
              </span>
            </div>
          )}
        </div>

        {/* Interview Date */}
        {submission.interview_date && (
          <div className="flex items-center gap-1.5 text-purple-600 text-xs mb-2">
            <Calendar className="h-3 w-3" />
            <span className="font-medium">
              {format(new Date(submission.interview_date), 'dd.MM. HH:mm', { locale: de })}
            </span>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex items-center gap-1 pt-2 border-t border-border/40">
          {submission.candidate.phone && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 px-2 text-muted-foreground hover:text-primary text-xs"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = `tel:${submission.candidate.phone}`;
              }}
            >
              <Phone className="h-3 w-3 mr-1" />
              Anrufen
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 px-2 text-muted-foreground hover:text-primary text-xs"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.location.href = `mailto:${submission.candidate.email}`;
            }}
          >
            <Mail className="h-3 w-3 mr-1" />
            Email
          </Button>
        </div>
      </div>
    </Link>
  );
}

interface PipelineColumnProps {
  stage: typeof PIPELINE_STAGES[0];
  submissions: PipelineSubmission[];
}

function PipelineColumn({ stage, submissions }: PipelineColumnProps) {
  return (
    <div className="flex flex-col min-w-[220px] max-w-[280px]">
      {/* Column Header */}
      <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg ${stage.bgClass} border ${stage.borderClass} border-b-0`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${stage.colorClass}`} />
          <span className={`text-sm font-semibold ${stage.textClass}`}>
            {stage.label}
          </span>
        </div>
        <Badge variant="secondary" className="text-xs h-5 px-1.5">
          {submissions.length}
        </Badge>
      </div>
      
      {/* Column Content */}
      <div className={`flex-1 p-2 rounded-b-lg border ${stage.borderClass} border-t-0 bg-muted/20 min-h-[200px]`}>
        <ScrollArea className="h-[280px]">
          <div className="space-y-2 pr-2">
            {submissions.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-muted-foreground text-xs">
                Keine Kandidaten
              </div>
            ) : (
              submissions.map((submission) => (
                <PipelineCard key={submission.id} submission={submission} />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

export function SubmissionsPipeline({ submissions, loading }: SubmissionsPipelineProps) {
  if (loading) {
    return (
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Your Talent Pipeline
            </CardTitle>
            <CardDescription>Track your candidates through the hiring process</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
            <p className="text-sm text-muted-foreground">Lade Pipeline...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group submissions by stage
  const submissionsByStage = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage.key] = submissions.filter(s => stage.statuses.includes(s.status));
    return acc;
  }, {} as Record<string, PipelineSubmission[]>);

  const totalActive = submissions.filter(s => 
    !['rejected', 'withdrawn', 'hired', 'client_rejected'].includes(s.status)
  ).length;

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Your Talent Pipeline
            {totalActive > 0 && (
              <Badge variant="secondary" className="ml-2">
                {totalActive} aktiv
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Track your candidates through the hiring process</CardDescription>
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
          <div className="text-center py-12 px-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold">Noch keine Submissions</h3>
            <p className="text-muted-foreground mt-1 mb-4">
              Reiche Kandidaten bei Jobs ein, um sie hier zu sehen.
            </p>
            <Button variant="default" size="sm" asChild>
              <Link to="/recruiter/jobs">
                Jobs durchsuchen
              </Link>
            </Button>
          </div>
        ) : (
          <ScrollArea className="w-full">
            <div className="flex gap-4 pb-4">
              {PIPELINE_STAGES.map((stage) => (
                <PipelineColumn
                  key={stage.key}
                  stage={stage}
                  submissions={submissionsByStage[stage.key] || []}
                />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
