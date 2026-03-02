import { Button } from '@/components/ui/button';
import { Star, ArrowUpRight, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ActiveJob {
  id: string;
  title: string;
  location: string;
  earning: number | null;
  submittedCount: number;
  totalSlots: number;
  progressPercent: number;
}

interface MyActiveJobsProps {
  jobs: ActiveJob[];
  onSelectJob: (jobId: string) => void;
}

export function MyActiveJobs({ jobs, onSelectJob }: MyActiveJobsProps) {
  if (jobs.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 px-1">
        <Star className="h-3.5 w-3.5 text-amber-500" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Aktive Jobs ({jobs.length})
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {jobs.map((job) => (
          <div
            key={job.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelectJob(job.id)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSelectJob(job.id); }}
            className="shrink-0 flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/30 bg-card hover:border-primary/30 cursor-pointer transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium truncate max-w-[160px]">{job.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-semibold text-emerald-500 tabular-nums">
                  {job.earning ? `€${(job.earning / 1000).toFixed(1)}k` : 'k.A.'}
                </span>
                <div className="w-12 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500/60"
                    style={{ width: `${Math.min(job.progressPercent, 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{job.submittedCount} einger.</span>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" asChild>
                <Link to={`/recruiter/jobs/${job.id}`} onClick={(e) => e.stopPropagation()}>
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 text-emerald-500" asChild>
                <Link to={`/recruiter/jobs/${job.id}`} onClick={(e) => e.stopPropagation()}>
                  <Plus className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
