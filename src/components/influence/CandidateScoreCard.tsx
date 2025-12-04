import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  Heart, 
  Calendar, 
  Target,
  Clock
} from 'lucide-react';
import { CandidateBehavior } from '@/hooks/useCandidateBehavior';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface CandidateScoreCardProps {
  behavior: CandidateBehavior;
  compact?: boolean;
}

export function CandidateScoreCard({ behavior, compact = false }: CandidateScoreCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'bg-emerald-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getScoreTextColor = (score: number) => {
    if (score >= 70) return 'text-emerald-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  const getEngagementBadge = (level: string) => {
    const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      high: { label: 'Hoch', variant: 'default' },
      medium: { label: 'Mittel', variant: 'secondary' },
      low: { label: 'Niedrig', variant: 'destructive' },
      neutral: { label: 'Neutral', variant: 'outline' },
    };
    return config[level] || config.neutral;
  };

  const engagementConfig = getEngagementBadge(behavior.engagement_level);

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Confidence</span>
          <span className={`font-medium ${getScoreTextColor(behavior.confidence_score)}`}>
            {behavior.confidence_score}%
          </span>
        </div>
        <Progress 
          value={behavior.confidence_score} 
          className="h-1.5"
        />
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Readiness</span>
          <span className={`font-medium ${getScoreTextColor(behavior.interview_readiness_score)}`}>
            {behavior.interview_readiness_score}%
          </span>
        </div>
        <Progress 
          value={behavior.interview_readiness_score} 
          className="h-1.5"
        />
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Closing</span>
          <span className={`font-medium ${getScoreTextColor(behavior.closing_probability)}`}>
            {behavior.closing_probability}%
          </span>
        </div>
        <Progress 
          value={behavior.closing_probability} 
          className="h-1.5"
        />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Kandidaten-Scores
          </CardTitle>
          <Badge variant={engagementConfig.variant}>
            {engagementConfig.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Confidence Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Heart className="h-4 w-4 text-pink-500" />
              <span>Confidence Score</span>
            </div>
            <span className={`font-semibold ${getScoreTextColor(behavior.confidence_score)}`}>
              {behavior.confidence_score}%
            </span>
          </div>
          <Progress 
            value={behavior.confidence_score} 
            className="h-2"
          />
        </div>

        {/* Interview Readiness */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-purple-500" />
              <span>Interview Readiness</span>
            </div>
            <span className={`font-semibold ${getScoreTextColor(behavior.interview_readiness_score)}`}>
              {behavior.interview_readiness_score}%
            </span>
          </div>
          <Progress 
            value={behavior.interview_readiness_score} 
            className="h-2"
          />
        </div>

        {/* Closing Probability */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span>Closing Probability</span>
            </div>
            <span className={`font-semibold ${getScoreTextColor(behavior.closing_probability)}`}>
              {behavior.closing_probability}%
            </span>
          </div>
          <Progress 
            value={behavior.closing_probability} 
            className="h-2"
          />
        </div>

        {/* Last Engagement */}
        {behavior.last_engagement_at && (
          <div className="pt-2 border-t flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Letztes Engagement</span>
            </div>
            <span>
              {formatDistanceToNow(new Date(behavior.last_engagement_at), { addSuffix: true, locale: de })}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
