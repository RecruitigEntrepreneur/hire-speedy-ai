import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RecruiterActivityIndicator } from '@/components/dashboard/RecruiterActivityIndicator';
import { JobStats } from '@/hooks/useJobStats';
import { 
  UserCheck, 
  Calendar, 
  Gift,
  Zap,
  ArrowRight,
  Briefcase
} from 'lucide-react';

interface LiveJobCardProps {
  job: JobStats;
  onBoost?: (jobId: string) => void;
}

export function LiveJobCard({ job, onBoost }: LiveJobCardProps) {
  return (
    <Card className="border-border/50 hover:border-primary/30 hover:shadow-md transition-all">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-primary" />
            </div>
            <div>
              <Link 
                to={`/dashboard/jobs/${job.id}`}
                className="font-semibold hover:text-primary transition-colors line-clamp-1"
              >
                {job.title}
              </Link>
              {job.companyName && (
                <p className="text-xs text-muted-foreground">{job.companyName}</p>
              )}
            </div>
          </div>
          {job.newCandidates > 0 && (
            <Badge variant="default" className="bg-primary text-primary-foreground">
              {job.newCandidates} Neu
            </Badge>
          )}
        </div>

        {/* Live Recruiter Activity */}
        <div className="mb-3">
          <RecruiterActivityIndicator activeRecruiters={job.activeRecruiters} />
        </div>

        {/* Stats Grid - Compact */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <UserCheck className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{job.totalCandidates}</span>
            <span className="text-muted-foreground text-xs">Kandidaten</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{job.interviews}</span>
            <span className="text-muted-foreground text-xs">Interviews</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Gift className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{job.offers}</span>
            <span className="text-muted-foreground text-xs">Angebote</span>
          </div>
        </div>

        {/* Pipeline Mini-View - Professional muted colors */}
        <div className="flex items-center gap-1 mb-4">
          <PipelineStep label="Neu" count={job.newCandidates} color="bg-slate-400" />
          <PipelineConnector />
          <PipelineStep label="Shortlist" count={job.shortlisted} color="bg-blue-400" />
          <PipelineConnector />
          <PipelineStep label="Interview" count={job.interviews} color="bg-indigo-400" />
          <PipelineConnector />
          <PipelineStep label="Angebot" count={job.offers} color="bg-violet-400" />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link to={`/dashboard/jobs/${job.id}`}>
              Details
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          {onBoost && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onBoost(job.id)}
              className="text-warning hover:text-warning hover:bg-warning/10"
            >
              <Zap className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PipelineStep({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex-1 text-center">
      <div className={`h-1.5 rounded-full ${color} ${count === 0 ? 'opacity-30' : ''}`} />
      <p className="text-[10px] text-muted-foreground mt-1">{count}</p>
    </div>
  );
}

function PipelineConnector() {
  return <div className="w-2 h-0.5 bg-border" />;
}
