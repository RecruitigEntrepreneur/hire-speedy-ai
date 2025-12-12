import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Trophy,
  Medal,
  Zap,
  TrendingUp
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

interface LeaderboardEntry {
  recruiter_id: string;
  influence_score: number;
  total_influenced_placements: number;
  alerts_actioned: number;
  recruiter_name?: string;
}

interface TeamLeaderboardProps {
  limit?: number;
}

export function TeamLeaderboard({ limit = 5 }: TeamLeaderboardProps) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      // Fetch recruiter influence scores
      const { data: scores, error: scoresError } = await supabase
        .from('recruiter_influence_scores')
        .select('recruiter_id, influence_score, total_influenced_placements, alerts_actioned')
        .order('influence_score', { ascending: false })
        .limit(limit);

      if (scoresError) throw scoresError;

      if (!scores || scores.length === 0) {
        setEntries([]);
        return;
      }

      // Fetch recruiter profiles for names
      const recruiterIds = scores.map(s => s.recruiter_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', recruiterIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

      const entriesWithNames: LeaderboardEntry[] = scores.map(s => ({
        ...s,
        recruiter_name: profileMap.get(s.recruiter_id) || 'Recruiter',
      }));

      setEntries(entriesWithNames);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Trophy className="h-4 w-4 text-amber-500" />;
      case 2: return <Medal className="h-4 w-4 text-slate-400" />;
      case 3: return <Medal className="h-4 w-4 text-amber-700" />;
      default: return <span className="text-sm font-medium text-muted-foreground">{rank}</span>;
    }
  };

  const getRankBg = (rank: number, isCurrentUser: boolean) => {
    if (isCurrentUser) return 'bg-primary/10 border-primary/30';
    switch (rank) {
      case 1: return 'bg-amber-500/10 border-amber-500/20';
      case 2: return 'bg-slate-500/10 border-slate-500/20';
      case 3: return 'bg-amber-700/10 border-amber-700/20';
      default: return 'bg-muted/30 border-transparent';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Team Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: limit }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            Team Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Trophy className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Noch keine Daten vorhanden</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            Team Leaderboard
          </CardTitle>
          <Badge variant="outline" className="text-xs">Top {limit}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {entries.map((entry, index) => {
            const rank = index + 1;
            const isCurrentUser = entry.recruiter_id === user?.id;
            
            return (
              <div
                key={entry.recruiter_id}
                className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${getRankBg(rank, isCurrentUser)}`}
              >
                {/* Rank */}
                <div className="w-6 flex items-center justify-center">
                  {getRankIcon(rank)}
                </div>
                
                {/* Name */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium truncate ${isCurrentUser ? 'text-primary' : ''}`}>
                      {entry.recruiter_name}
                    </span>
                    {isCurrentUser && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Du</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{entry.total_influenced_placements} Placements</span>
                    <span>•</span>
                    <span>{entry.alerts_actioned} Actions</span>
                  </div>
                </div>
                
                {/* Score */}
                <div className="text-right">
                  <div className={`text-lg font-bold ${
                    entry.influence_score >= 80 ? 'text-emerald-500' :
                    entry.influence_score >= 60 ? 'text-blue-500' :
                    entry.influence_score >= 40 ? 'text-amber-500' : 'text-muted-foreground'
                  }`}>
                    {entry.influence_score}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Score</div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
