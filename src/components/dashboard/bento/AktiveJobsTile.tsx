import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { JobHealthIndicator } from '@/components/jobs/JobHealthIndicator';
import { BentoTile } from './BentoTile';
import type { JobStats } from '@/hooks/useClientDashboard';
import { Briefcase, Users, Calendar, Gift } from 'lucide-react';

interface Props {
  jobs: JobStats[];
  loading?: boolean;
}

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

/** Tile B – Aktive Jobs mit Health-Badge + Funnel (Kand · Intv · Angeb). */
export function AktiveJobsTile({ jobs, loading }: Props) {
  return (
    <BentoTile icon={Briefcase} title="Aktive Jobs" count={loading ? undefined : jobs.length} to="/dashboard/jobs">
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex h-full items-center justify-center py-6 text-center text-sm text-muted-foreground">
          Noch keine aktiven Jobs
        </div>
      ) : (
        <div className="space-y-0.5">
          {jobs.slice(0, 5).map((job) => (
            <Link
              key={job.id}
              to={`/dashboard/jobs/${job.id}`}
              className="group flex items-center gap-3 rounded-lg px-2.5 py-2 transition-all hover:bg-accent/50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium transition-colors group-hover:text-primary">{job.title}</p>
                  {job.status === 'pending_approval' ? (
                    <Badge variant="outline" className="h-5 shrink-0 border-amber-500/40 px-1.5 text-[10px] text-amber-600">
                      In Freigabe
                    </Badge>
                  ) : (
                    <JobHealthIndicator
                      candidatesCount={job.totalCandidates}
                      interviewsCount={job.interviews}
                      activeRecruiters={job.activeRecruiters}
                      daysOpen={daysSince(job.createdAt)}
                      status={job.status}
                    />
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {job.totalCandidates}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {job.interviews}
                  </span>
                  <span className="flex items-center gap-1">
                    <Gift className="h-3 w-3" />
                    {job.offers}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </BentoTile>
  );
}
