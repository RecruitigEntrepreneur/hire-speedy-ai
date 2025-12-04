import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Trophy, TrendingUp, Users } from 'lucide-react';
import { RankingBadge } from './RankingBadge';
import { cn } from '@/lib/utils';

interface RankedCandidate {
  submission_id: string;
  candidate_id: string;
  full_name: string;
  rank_position: number;
  overall_rank_score: number;
  match_score: number | null;
  confidence_score: number | null;
  interview_readiness_score: number | null;
  closing_probability: number | null;
  engagement_level: string | null;
  status: string;
}

interface RankingLeaderboardProps {
  candidates: RankedCandidate[];
  jobTitle?: string;
  onCandidateClick?: (submissionId: string) => void;
  maxDisplay?: number;
}

export function RankingLeaderboard({
  candidates,
  jobTitle,
  onCandidateClick,
  maxDisplay = 5,
}: RankingLeaderboardProps) {
  const displayCandidates = candidates.slice(0, maxDisplay);

  const getEngagementColor = (level: string | null) => {
    switch (level) {
      case 'high': return 'text-emerald-600';
      case 'medium': return 'text-amber-600';
      case 'low': return 'text-red-600';
      default: return 'text-muted-foreground';
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'bg-muted';
    if (score >= 70) return 'bg-emerald-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  if (candidates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="h-5 w-5 text-amber-500" />
            Top Kandidaten
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mb-2 opacity-50" />
            <p>Keine Kandidaten verfügbar</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5 text-amber-500" />
          Top Kandidaten
          {jobTitle && (
            <span className="font-normal text-muted-foreground text-sm">
              für {jobTitle}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {displayCandidates.map((candidate, index) => (
          <div
            key={candidate.submission_id}
            className={cn(
              'flex items-center gap-4 p-3 rounded-lg border transition-colors',
              index < 3 ? 'bg-muted/50' : 'bg-background',
              onCandidateClick && 'cursor-pointer hover:bg-accent'
            )}
            onClick={() => onCandidateClick?.(candidate.submission_id)}
          >
            <RankingBadge rank={candidate.rank_position} />
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{candidate.full_name}</span>
                <span className={cn('text-xs', getEngagementColor(candidate.engagement_level))}>
                  {candidate.engagement_level === 'high' && '🔥'}
                  {candidate.engagement_level === 'medium' && '👍'}
                  {candidate.engagement_level === 'low' && '❄️'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Progress 
                  value={candidate.overall_rank_score} 
                  className="h-2 flex-1"
                />
                <span className="text-sm font-semibold text-primary">
                  {candidate.overall_rank_score}
                </span>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2">
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Match</div>
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold', getScoreColor(candidate.match_score))}>
                  {candidate.match_score ?? '-'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Bereit</div>
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold', getScoreColor(candidate.interview_readiness_score))}>
                  {candidate.interview_readiness_score ?? '-'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Close</div>
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold', getScoreColor(candidate.closing_probability))}>
                  {candidate.closing_probability ?? '-'}
                </div>
              </div>
            </div>

            {candidate.rank_position <= 3 && (
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            )}
          </div>
        ))}

        {candidates.length > maxDisplay && (
          <p className="text-center text-sm text-muted-foreground">
            +{candidates.length - maxDisplay} weitere Kandidaten
          </p>
        )}
      </CardContent>
    </Card>
  );
}
