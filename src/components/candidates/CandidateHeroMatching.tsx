import { useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, ChevronRight } from 'lucide-react';
import { useMatchScoreV31, V31MatchResult, PolicyTier } from '@/hooks/useMatchScoreV31';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface CandidateHeroMatchingProps {
  candidateId: string;
  onNavigateToMatching: () => void;
}

export function CandidateHeroMatching({ candidateId, onNavigateToMatching }: CandidateHeroMatchingProps) {
  const { calculateBatchMatch, loading, results, sortByRelevance } = useMatchScoreV31();

  // Fetch published job IDs
  const { data: jobIds } = useQuery({
    queryKey: ['published-job-ids'],
    queryFn: async () => {
      const { data } = await supabase
        .from('jobs')
        .select('id')
        .eq('status', 'published')
        .limit(50);
      return (data || []).map(j => j.id);
    },
    staleTime: 5 * 60 * 1000,
  });

  // Calculate matches when jobIds are available
  useEffect(() => {
    if (jobIds && jobIds.length > 0 && candidateId) {
      calculateBatchMatch(candidateId, jobIds, 'preview');
    }
  }, [jobIds, candidateId, calculateBatchMatch]);

  // Tier counts
  const tierCounts = useMemo(() => {
    const counts: Record<PolicyTier, number> = { hot: 0, standard: 0, maybe: 0, hidden: 0 };
    results.forEach(r => counts[r.policy]++);
    return counts;
  }, [results]);

  // Top 3 sorted results (non-hidden)
  const top3 = useMemo(() => {
    const visible = results.filter(r => r.policy !== 'hidden');
    return sortByRelevance(visible).slice(0, 3);
  }, [results, sortByRelevance]);

  // Fetch job titles for top 3
  const topJobIds = useMemo(() => top3.map(r => r.jobId), [top3]);
  const { data: jobTitles } = useQuery({
    queryKey: ['job-titles', topJobIds],
    queryFn: async () => {
      if (topJobIds.length === 0) return {};
      const { data } = await supabase
        .from('jobs')
        .select('id, title')
        .in('id', topJobIds);
      const map: Record<string, string> = {};
      (data || []).forEach(j => { map[j.id] = j.title; });
      return map;
    },
    enabled: topJobIds.length > 0,
  });

  const hasJobs = jobIds && jobIds.length > 0;
  const hasResults = results.length > 0;
  const visibleCount = tierCounts.hot + tierCounts.standard + tierCounts.maybe;

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            KI-Matching V3.1
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-16" />
          </div>
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-2 flex-1" />
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!hasJobs) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            KI-Matching V3.1
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Keine offenen Jobs vorhanden</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            KI-Matching V3.1
          </CardTitle>
          <button
            onClick={onNavigateToMatching}
            className="text-xs text-primary hover:underline flex items-center gap-0.5"
          >
            Alle anzeigen
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Tier badges */}
        {hasResults && visibleCount > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tierCounts.hot > 0 && (
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 border-green-200">
                🔥 {tierCounts.hot} Hot
              </Badge>
            )}
            {tierCounts.standard > 0 && (
              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 border-blue-200">
                ✓ {tierCounts.standard} Standard
              </Badge>
            )}
            {tierCounts.maybe > 0 && (
              <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 border-amber-200">
                ? {tierCounts.maybe} Maybe
              </Badge>
            )}
          </div>
        )}

        {/* Top 3 matches */}
        {top3.length > 0 ? (
          <div className="space-y-2">
            {top3.map(match => (
              <div key={match.jobId} className="flex items-center gap-3">
                <span className="text-xs truncate min-w-0 flex-shrink-0 max-w-[140px]">
                  {jobTitles?.[match.jobId] || 'Laden...'}
                </span>
                <Progress value={match.overall} className="h-1.5 flex-1" />
                <span className="text-xs font-medium tabular-nums w-8 text-right">
                  {Math.round(match.overall)}%
                </span>
              </div>
            ))}
          </div>
        ) : hasResults ? (
          <p className="text-xs text-muted-foreground">Keine passenden Matches gefunden</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
