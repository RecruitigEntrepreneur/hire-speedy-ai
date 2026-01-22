import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Brain, Target, TrendingUp, AlertTriangle, CheckCircle, Database, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MLHealthData {
  totalEvents: number;
  eventsWithOutcome: number;
  hiredCount: number;
  rejectedCount: number;
  withdrawnCount: number;
  matchOutcomesTotal: number;
  matchOutcomesWithOutcome: number;
  recentEvents: number;
}

export function MLHealthWidget() {
  const [data, setData] = useState<MLHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  async function fetchMLHealth() {
    try {
      // Fetch ml_training_events stats
      const { data: eventStats } = await supabase
        .from('ml_training_events')
        .select('final_outcome, created_at');

      // Fetch match_outcomes stats
      const { data: matchStats } = await supabase
        .from('match_outcomes')
        .select('actual_outcome');

      if (eventStats && matchStats) {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        setData({
          totalEvents: eventStats.length,
          eventsWithOutcome: eventStats.filter(e => e.final_outcome).length,
          hiredCount: eventStats.filter(e => e.final_outcome === 'hired').length,
          rejectedCount: eventStats.filter(e => e.final_outcome === 'rejected').length,
          withdrawnCount: eventStats.filter(e => e.final_outcome === 'withdrawn').length,
          matchOutcomesTotal: matchStats.length,
          matchOutcomesWithOutcome: matchStats.filter(m => m.actual_outcome).length,
          recentEvents: eventStats.filter(e => new Date(e.created_at) > weekAgo).length,
        });
      }
    } catch (error) {
      console.error('Error fetching ML health:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMLHealth();
  }, []);

  async function handleSeedData() {
    setSeeding(true);
    try {
      const { data, error } = await supabase.functions.invoke('seed-ml-training-data', {
        body: { count: 200 }
      });

      if (error) throw error;

      toast.success('Training-Daten generiert', {
        description: `${data.summary.total} Events: ${data.summary.hired} Hired, ${data.summary.rejected} Rejected, ${data.summary.withdrawn} Withdrawn`
      });

      // Refresh data
      await fetchMLHealth();
    } catch (error) {
      console.error('Error seeding data:', error);
      toast.error('Fehler beim Generieren', {
        description: error instanceof Error ? error.message : 'Unbekannter Fehler'
      });
    } finally {
      setSeeding(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            ML Training Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  // Calculate readiness for ML training
  const targetOutcomes = 500;
  const targetHires = 50;
  const outcomesProgress = Math.min((data.eventsWithOutcome / targetOutcomes) * 100, 100);
  const hiresProgress = Math.min((data.hiredCount / targetHires) * 100, 100);
  const isReady = data.eventsWithOutcome >= targetOutcomes && data.hiredCount >= targetHires;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          ML Training Health
        </CardTitle>
        <CardDescription>
          Status der Datensammlung für Placement Prediction Model
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Readiness Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isReady ? (
              <>
                <CheckCircle className="h-5 w-5 text-emerald-500" />
                <span className="font-medium text-emerald-600">Training-ready</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <span className="font-medium text-amber-600">Daten werden gesammelt...</span>
              </>
            )}
          </div>
          {!isReady && data.eventsWithOutcome < 100 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeedData}
              disabled={seeding}
            >
              {seeding ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Seed 200 Events
            </Button>
          )}
        </div>

        {/* Outcomes Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-1">
              <Database className="h-4 w-4" />
              Outcomes Total
            </span>
            <span className="font-medium">{data.eventsWithOutcome} / {targetOutcomes}</span>
          </div>
          <Progress value={outcomesProgress} className="h-2" />
        </div>

        {/* Hires Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-1">
              <Target className="h-4 w-4" />
              Successful Placements
            </span>
            <span className="font-medium">{data.hiredCount} / {targetHires}</span>
          </div>
          <Progress value={hiresProgress} className="h-2" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-primary">{data.totalEvents}</div>
            <div className="text-xs text-muted-foreground">Training Events</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-emerald-600">{data.recentEvents}</div>
            <div className="text-xs text-muted-foreground">Diese Woche</div>
          </div>
        </div>

        {/* Outcome Breakdown */}
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            {data.hiredCount} Hired
          </Badge>
          <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-200">
            {data.rejectedCount} Rejected
          </Badge>
          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-200">
            {data.withdrawnCount} Withdrawn
          </Badge>
        </div>

        {/* Match Outcomes Sync Status */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              Match Outcomes Sync
            </span>
            <span>
              {data.matchOutcomesWithOutcome} / {data.matchOutcomesTotal} synced
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
