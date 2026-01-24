import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { VerificationStatusBanner } from '@/components/verification/VerificationStatusBanner';
import { UnifiedActionCenter } from '@/components/dashboard/UnifiedActionCenter';
import { EnhancedLiveJobCard } from '@/components/dashboard/EnhancedLiveJobCard';
import { HealthScoreCompact } from '@/components/dashboard/HealthScoreCompact';
import { QuickActionsBar } from '@/components/dashboard/QuickActionsBar';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { useClientDashboard } from '@/hooks/useClientDashboard';
import { usePageViewTracking } from '@/hooks/useEventTracking';
import { 
  Plus, 
  Briefcase,
  ArrowRight,
  RefreshCw
} from 'lucide-react';

export default function ClientDashboard() {
  const { data, isLoading, error, refetch } = useClientDashboard();
  
  usePageViewTracking('client_dashboard');

  const handleActionComplete = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-32 lg:col-span-2" />
          </div>
          <Skeleton className="h-64" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground mb-4">Fehler beim Laden des Dashboards</p>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Erneut versuchen
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const { stats, actions, liveJobs, activity, healthScore } = data || {
    stats: { activeJobs: 0, totalCandidates: 0, pendingInterviews: 0, placements: 0, newCandidatesLast7Days: 0 },
    actions: [],
    liveJobs: [],
    activity: [],
    healthScore: { level: 'good' as const, score: 75, label: 'Gut', message: 'Laden...' },
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Verification Banner */}
        <VerificationStatusBanner />

        {/* Header with Health Score and Quick Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground text-sm">
              Willkommen zurück! Hier ist Ihr Recruiting-Überblick.
            </p>
          </div>
          <Button asChild>
            <Link to="/dashboard/jobs/new">
              <Plus className="h-4 w-4 mr-2" />
              Neuen Job erstellen
            </Link>
          </Button>
        </div>

        {/* Health Score + Quick Actions Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <HealthScoreCompact health={healthScore} />
          <div className="lg:col-span-2 flex items-center">
            <QuickActionsBar className="w-full" />
          </div>
        </div>

        {/* Unified Action Center */}
        <UnifiedActionCenter 
          actions={actions} 
          onActionComplete={handleActionComplete}
          maxActions={6}
        />

        {/* Live Jobs + Activity Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Live Jobs */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                Aktive Jobs
              </h2>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/dashboard/jobs">
                  Alle Jobs
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
            
            {liveJobs.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Briefcase className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground mb-4">Noch keine aktiven Jobs</p>
                  <Button asChild>
                    <Link to="/dashboard/jobs/new">
                      <Plus className="h-4 w-4 mr-2" />
                      Ersten Job erstellen
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {liveJobs.map((job) => (
                  <EnhancedLiveJobCard 
                    key={job.id} 
                    job={job} 
                    onActionComplete={handleActionComplete}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Aktivitäten</h2>
            <ActivityFeed />
          </div>
        </div>

        {/* Quick Stats Summary (minimal, at bottom) */}
        {stats.activeJobs > 0 && (
          <Card className="bg-muted/30">
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Aktive Jobs:</span>
                  <span className="font-semibold">{stats.activeJobs}</span>
                </div>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Kandidaten:</span>
                  <span className="font-semibold">{stats.totalCandidates}</span>
                </div>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Interviews:</span>
                  <span className="font-semibold">{stats.pendingInterviews}</span>
                </div>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Einstellungen:</span>
                  <span className="font-semibold text-success">{stats.placements}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
