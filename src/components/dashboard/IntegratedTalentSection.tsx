import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PIPELINE_STAGES } from '@/hooks/useHiringPipeline';
import { CandidateInboxCard, CandidateCardData } from '@/components/dashboard/CandidateInboxCard';
import { Users, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IntegratedTalentSectionProps {
  onActionComplete?: () => void;
}

const MAX_CARDS = 6;

export function IntegratedTalentSection({ onActionComplete }: IntegratedTalentSectionProps) {
  const { user } = useAuth();

  const [candidates, setCandidates] = useState<CandidateCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState('all');

  useEffect(() => {
    if (user) fetchCandidates();
  }, [user]);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          id, status, stage, submitted_at,
          candidates!inner (id, full_name, job_title, experience_years, city),
          jobs!inner (id, title)
        `)
        .order('submitted_at', { ascending: false });

      if (error) {
        console.error('Error fetching candidates:', error);
        return;
      }

      const entries: CandidateCardData[] = [];
      (data || []).forEach((sub: any) => {
        const candidate = sub.candidates;
        const job = sub.jobs;
        const now = new Date();
        const submittedAt = new Date(sub.submitted_at);
        const hoursInStage = Math.floor((now.getTime() - submittedAt.getTime()) / (1000 * 60 * 60));
        entries.push({
          id: candidate.id,
          submissionId: sub.id,
          name: `PR-${candidate.id.slice(0, 6).toUpperCase()}`,
          currentRole: candidate.job_title || 'Nicht angegeben',
          jobId: job.id,
          jobTitle: job.title,
          stage: sub.stage || sub.status,
          status: sub.status,
          submittedAt: sub.submitted_at,
          hoursInStage,
          city: candidate.city,
          experienceYears: candidate.experience_years,
        });
      });
      setCandidates(entries);
    } finally {
      setLoading(false);
    }
  };

  const stageCounts = useMemo(() => {
    return PIPELINE_STAGES.reduce((acc, stage) => {
      acc[stage.key] = candidates.filter(c => c.stage === stage.key && c.status !== 'rejected').length;
      return acc;
    }, {} as Record<string, number>);
  }, [candidates]);

  const activeCount = useMemo(() =>
    candidates.filter(c => c.status !== 'rejected' && c.status !== 'hired').length
  , [candidates]);

  const filteredCandidates = useMemo(() => {
    return candidates
      .filter(c => {
        if (c.status === 'rejected' || c.status === 'hired') return false;
        if (stageFilter !== 'all' && c.stage !== stageFilter) return false;
        return true;
      })
      .sort((a, b) => b.hoursInStage - a.hoursInStage);
  }, [candidates, stageFilter]);

  const visibleCandidates = filteredCandidates.slice(0, MAX_CARDS);
  const remainingCount = filteredCandidates.length - MAX_CARDS;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            <Skeleton className="h-7 w-48" />
            <div className="flex gap-2">
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-7 w-20" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activeCount === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-muted mb-3">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-1">Alles erledigt!</h3>
          <p className="text-sm text-muted-foreground">
            Keine ausstehenden Kandidaten. Ihre Recruiter arbeiten für Sie.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Bewerbungen</h2>
            <span className="text-sm text-muted-foreground">{activeCount} eingegangen</span>
          </div>
          <Button variant="ghost" size="sm" asChild className="text-xs gap-1">
            <Link to="/dashboard/candidates">
              Alle anzeigen
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {/* Stage Tabs */}
        <div className="flex flex-wrap gap-1.5 mb-3 border-b pb-2.5">
          <Button
            variant={stageFilter === 'all' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setStageFilter('all')}
          >
            Alle ({activeCount})
          </Button>
          {PIPELINE_STAGES.slice(0, 5).map(stage => {
            const count = stageCounts[stage.key] || 0;
            if (count === 0) return null;
            return (
              <Button
                key={stage.key}
                variant={stageFilter === stage.key ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setStageFilter(stage.key)}
              >
                {stage.label} ({count})
              </Button>
            );
          })}
        </div>

        {/* Compact Grid */}
        {visibleCandidates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-center">
            <Users className="h-8 w-8 text-muted-foreground/30 mb-1" />
            <p className="text-sm text-muted-foreground">Keine Kandidaten in dieser Phase</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {visibleCandidates.map(candidate => (
              <CandidateInboxCard key={candidate.submissionId} candidate={candidate} />
            ))}
          </div>
        )}

        {/* Footer CTA */}
        {remainingCount > 0 && (
          <div className="mt-3 text-center">
            <Button variant="ghost" size="sm" asChild className="text-xs text-muted-foreground">
              <Link to="/dashboard/candidates">
                +{remainingCount} weitere Bewerbungen anzeigen
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
