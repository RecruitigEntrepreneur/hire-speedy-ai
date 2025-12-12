import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Calendar, 
  X, 
  ChevronRight,
  MapPin,
  Banknote,
  Clock,
  Mail,
  Phone,
  Star,
  TrendingUp,
  Briefcase
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface HardFacts {
  role_seniority: string;
  top_skills: string[];
  location_commute: string;
  work_model: string;
  salary_range: string;
  availability: string;
}

interface ClientCandidateCardProps {
  submissionId: string;
  candidateId: string;
  candidateName: string;
  currentRole: string;
  matchScore: number | null;
  dealProbability: number;
  status: string;
  hardFacts: HardFacts;
  executiveSummary: string[];
  jobTitle: string;
  onRequestInterview: () => void;
  onReject: () => void;
  onBookmark: () => void;
  isBookmarked?: boolean;
  className?: string;
}

export function ClientCandidateCard({
  submissionId,
  candidateId,
  candidateName,
  currentRole,
  matchScore,
  dealProbability,
  status,
  hardFacts,
  executiveSummary,
  jobTitle,
  onRequestInterview,
  onReject,
  onBookmark,
  isBookmarked = false,
  className
}: ClientCandidateCardProps) {
  const getMatchScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getMatchScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20';
    if (score >= 60) return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20';
    return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20';
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      submitted: { label: 'Neu', variant: 'default' },
      interview: { label: 'Interview', variant: 'secondary' },
      offer: { label: 'Angebot', variant: 'outline' },
      hired: { label: 'Eingestellt', variant: 'default' },
      rejected: { label: 'Abgelehnt', variant: 'outline' }
    };
    return configs[status] || { label: status, variant: 'outline' as const };
  };

  const initials = candidateName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const statusConfig = getStatusConfig(status);
  const score = matchScore || 0;

  return (
    <Card className={cn(
      "group relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-primary/30",
      className
    )}>
      {/* Match Score Indicator Bar */}
      <div 
        className={cn("absolute top-0 left-0 h-1 transition-all", getMatchScoreColor(score))}
        style={{ width: `${score}%` }}
      />

      <div className="p-4">
        {/* Header Row */}
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* Name & Role */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground truncate">
                {candidateName}
              </h3>
              <Badge variant={statusConfig.variant} className="text-xs shrink-0">
                {statusConfig.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate">{currentRole}</p>
            <p className="text-xs text-muted-foreground/70 truncate">für {jobTitle}</p>
          </div>

          {/* Scores */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className={cn(
              "px-2.5 py-1 rounded-full text-sm font-bold border",
              getMatchScoreBg(score)
            )}>
              {score}%
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span>Deal {dealProbability}%</span>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{hardFacts.location_commute}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Banknote className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{hardFacts.salary_range}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{hardFacts.availability}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{hardFacts.work_model}</span>
          </div>
        </div>

        {/* Skills */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {hardFacts.top_skills.slice(0, 4).map((skill, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs font-normal">
              {skill}
            </Badge>
          ))}
          {hardFacts.top_skills.length > 4 && (
            <Badge variant="outline" className="text-xs font-normal">
              +{hardFacts.top_skills.length - 4}
            </Badge>
          )}
        </div>

        {/* Summary Preview */}
        {executiveSummary.length > 0 && (
          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
            {executiveSummary[0]}
          </p>
        )}

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2">
          <Button 
            size="sm" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRequestInterview();
            }}
            className="flex-1"
          >
            <Calendar className="h-4 w-4 mr-1.5" />
            Interview
          </Button>
          <Button 
            size="sm" 
            variant="destructive"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onReject();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onBookmark();
            }}
            className={isBookmarked ? 'text-yellow-500 border-yellow-500/50' : ''}
          >
            <Star className={cn("h-4 w-4", isBookmarked && "fill-current")} />
          </Button>
          <Link to={`/dashboard/candidates/${submissionId}`}>
            <Button size="sm" variant="ghost">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
