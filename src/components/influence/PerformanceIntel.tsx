import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Target,
  Zap,
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { RecruiterInfluenceScore } from '@/hooks/useRecruiterInfluenceScore';

interface PerformanceIntelProps {
  score: RecruiterInfluenceScore | null;
  loading?: boolean;
}

type SpeedTier = 'S' | 'A' | 'B' | 'C';

export function PerformanceIntel({ score, loading = false }: PerformanceIntelProps) {
  
  // Calculate Speed Tier based on average response time
  const getSpeedTier = (): SpeedTier => {
    if (!score) return 'C';
    
    // Based on alerts actioned vs ignored ratio and opt-in acceleration
    const actionRate = score.alerts_actioned / Math.max(score.alerts_actioned + score.alerts_ignored, 1);
    const optInSpeed = score.opt_in_acceleration_rate;
    
    if (actionRate >= 0.9 && optInSpeed >= 20) return 'S';
    if (actionRate >= 0.7 && optInSpeed >= 10) return 'A';
    if (actionRate >= 0.5 && optInSpeed >= 0) return 'B';
    return 'C';
  };

  const speedTier = getSpeedTier();

  const getTierColor = (tier: SpeedTier) => {
    switch (tier) {
      case 'S': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
      case 'A': return 'text-blue-500 bg-blue-500/10 border-blue-500/30';
      case 'B': return 'text-amber-500 bg-amber-500/10 border-amber-500/30';
      case 'C': return 'text-muted-foreground bg-muted/50 border-muted';
    }
  };

  const getTierLabel = (tier: SpeedTier) => {
    switch (tier) {
      case 'S': return 'Blitzschnell';
      case 'A': return 'Schnell';
      case 'B': return 'Standard';
      case 'C': return 'Verbesserbar';
    }
  };

  const getInfluenceScoreColor = (influenceScore: number) => {
    if (influenceScore >= 80) return 'text-emerald-500';
    if (influenceScore >= 60) return 'text-blue-500';
    if (influenceScore >= 40) return 'text-amber-500';
    return 'text-destructive';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Performance Intel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Skeleton className="h-24" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Performance Intel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* KPI 1: Influence Score */}
        <div className="text-center p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
          <div className={`text-5xl font-bold ${score ? getInfluenceScoreColor(score.influence_score) : 'text-muted-foreground'}`}>
            {score?.influence_score || 0}
          </div>
          <div className="text-sm text-muted-foreground mt-1">Influence Score</div>
          <div className="flex items-center justify-center gap-1 mt-2 text-xs text-muted-foreground">
            <Minus className="h-3 w-3" />
            <span>von 100 Punkten</span>
          </div>
        </div>

        {/* KPI 2: Speed Tier */}
        <div className="flex items-center justify-between p-3 rounded-lg border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-sm font-medium">Speed Tier</div>
              <div className="text-xs text-muted-foreground">Reaktionsgeschwindigkeit</div>
            </div>
          </div>
          <div className={`px-3 py-1.5 rounded-lg border font-bold text-lg ${getTierColor(speedTier)}`}>
            {speedTier}
          </div>
        </div>

        {/* KPI 3: Placements Influenced */}
        <div className="flex items-center justify-between p-3 rounded-lg border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Trophy className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-sm font-medium">Placements</div>
              <div className="text-xs text-muted-foreground">Durch Influence verbessert</div>
            </div>
          </div>
          <div className="text-2xl font-bold">
            {score?.total_influenced_placements || 0}
          </div>
        </div>

        {/* Mini Stats */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t">
          <div className="text-center">
            <div className="text-lg font-semibold">{score?.alerts_actioned || 0}</div>
            <div className="text-xs text-muted-foreground">Alerts bearbeitet</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">{score?.playbooks_used || 0}</div>
            <div className="text-xs text-muted-foreground">Playbooks genutzt</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
