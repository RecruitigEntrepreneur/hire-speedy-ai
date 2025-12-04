import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { LeaderboardEntry } from '@/hooks/useFunnelAnalytics';
import { cn } from '@/lib/utils';

interface RecruiterLeaderboardComponentProps {
  entries: LeaderboardEntry[];
  isLoading?: boolean;
  maxDisplay?: number;
  showRevenue?: boolean;
}

export function RecruiterLeaderboardComponent({
  entries,
  isLoading,
  maxDisplay = 10,
  showRevenue = false,
}: RecruiterLeaderboardComponentProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Recruiter Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-8 h-8 bg-muted rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-32" />
                  <div className="h-3 bg-muted rounded w-24" />
                </div>
                <div className="h-6 bg-muted rounded w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayEntries = entries.slice(0, maxDisplay);

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Badge className="bg-yellow-500 hover:bg-yellow-600">🥇 1st</Badge>;
    if (rank === 2) return <Badge className="bg-gray-400 hover:bg-gray-500">🥈 2nd</Badge>;
    if (rank === 3) return <Badge className="bg-amber-600 hover:bg-amber-700">🥉 3rd</Badge>;
    return <Badge variant="outline">#{rank}</Badge>;
  };

  const getRankChange = (change: number) => {
    if (change > 0) {
      return (
        <span className="flex items-center text-green-600 text-xs">
          <TrendingUp className="w-3 h-3 mr-0.5" />
          +{change}
        </span>
      );
    }
    if (change < 0) {
      return (
        <span className="flex items-center text-red-600 text-xs">
          <TrendingDown className="w-3 h-3 mr-0.5" />
          {change}
        </span>
      );
    }
    return (
      <span className="flex items-center text-muted-foreground text-xs">
        <Minus className="w-3 h-3" />
      </span>
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Recruiter Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        {displayEntries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No leaderboard data available yet</p>
            <p className="text-sm">Rankings will appear after analytics are calculated</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayEntries.map((entry, index) => (
              <div
                key={entry.id}
                className={cn(
                  'flex items-center gap-4 p-3 rounded-lg transition-colors',
                  index === 0 && 'bg-yellow-50 dark:bg-yellow-950/20',
                  index === 1 && 'bg-gray-50 dark:bg-gray-950/20',
                  index === 2 && 'bg-amber-50 dark:bg-amber-950/20',
                  index > 2 && 'hover:bg-muted/50'
                )}
              >
                <div className="flex items-center gap-3 min-w-[100px]">
                  {getRankBadge(entry.rank_position)}
                  {getRankChange(entry.rank_change)}
                </div>

                <Avatar className="h-10 w-10">
                  <AvatarFallback className={cn(
                    index === 0 && 'bg-yellow-100 text-yellow-800',
                    index === 1 && 'bg-gray-200 text-gray-800',
                    index === 2 && 'bg-amber-100 text-amber-800'
                  )}>
                    {getInitials(entry.recruiter_name || 'RR')}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {entry.recruiter_name || `Recruiter ${entry.recruiter_id.slice(0, 8)}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {entry.submissions} submissions • {entry.conversion_rate?.toFixed(1) || 0}% conversion
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-lg font-bold">{entry.placements}</p>
                  <p className="text-xs text-muted-foreground">placements</p>
                </div>

                {showRevenue && entry.total_revenue > 0 && (
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">
                      €{entry.total_revenue.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">revenue</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {entries.length > maxDisplay && (
          <div className="mt-4 text-center">
            <button className="text-sm text-primary hover:underline">
              View all {entries.length} recruiters →
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
