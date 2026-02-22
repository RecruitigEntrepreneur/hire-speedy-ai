import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MapPin, Briefcase, Clock, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export interface CandidateCardData {
  id: string;
  submissionId: string;
  name: string;
  currentRole: string;
  jobId: string;
  jobTitle: string;
  stage: string;
  status: string;
  submittedAt: string;
  hoursInStage: number;
  city?: string;
  experienceYears?: number;
}

interface CandidateInboxCardProps {
  candidate: CandidateCardData;
  className?: string;
}

export function CandidateInboxCard({ candidate, className }: CandidateInboxCardProps) {
  const getInitials = (name: string) => {
    if (name.startsWith('PR-')) return name.slice(3, 5).toUpperCase();
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Link
      to={`/dashboard/candidates/${candidate.submissionId}`}
      className={cn(
        "block rounded-lg border bg-card p-3 hover:bg-muted/50 hover:border-primary/20 transition-all group",
        className
      )}
    >
      <div className="flex items-start gap-2.5">
        <Avatar className="h-8 w-8 shrink-0 mt-0.5">
          <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
            {getInitials(candidate.name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm leading-tight truncate">
            {candidate.currentRole}
          </p>

          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <ArrowRight className="h-3 w-3 shrink-0" />
            <span className="truncate">{candidate.jobTitle}</span>
          </div>

          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
            {candidate.city && (
              <span className="flex items-center gap-0.5 truncate">
                <MapPin className="h-2.5 w-2.5 shrink-0" />
                {candidate.city}
              </span>
            )}
            {candidate.experienceYears && (
              <span className="flex items-center gap-0.5 shrink-0">
                <Briefcase className="h-2.5 w-2.5" />
                {candidate.experienceYears}J
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground/70">
            <Clock className="h-2.5 w-2.5" />
            <span>vor {formatDistanceToNow(new Date(candidate.submittedAt), { locale: de })}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
