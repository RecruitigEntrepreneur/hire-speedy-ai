import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { VerificationStatusBanner } from '@/components/verification/VerificationStatusBanner';
import { QuickJobImport } from '@/components/dashboard/QuickJobImport';
import { PremiumActionCenter } from '@/components/dashboard/PremiumActionCenter';
import { CompactJobCard } from '@/components/dashboard/CompactJobCard';
import { useClientDashboard } from '@/hooks/useClientDashboard';
import { usePageViewTracking } from '@/hooks/useEventTracking';
import { 
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
          <Skeleton className="h-24" />
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
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

  const { actions, liveJobs } = data || {
    actions: [],
    liveJobs: [],
  };

  const pendingCount = actions.length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Verification Banner */}
        <VerificationStatusBanner />

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            {pendingCount > 0 
              ? `Sie haben ${pendingCount} ausstehende Entscheidung${pendingCount > 1 ? 'en' : ''}.`
              : 'Willkommen zurück! Alle Aufgaben erledigt.'
            }
          </p>
        </div>

        {/* Quick Job Import */}
        <QuickJobImport />

        {/* Premium Action Center */}
        <PremiumActionCenter 
          actions={actions} 
          onActionComplete={handleActionComplete}
          maxActions={6}
        />

        {/* Active Jobs */}
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
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <Briefcase className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-2">Noch keine aktiven Jobs</p>
                <p className="text-sm text-muted-foreground">
                  Importieren Sie eine Stellenausschreibung oben, um zu starten.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {liveJobs.map((job) => (
                <CompactJobCard 
                  key={job.id} 
                  job={job} 
                  onActionComplete={handleActionComplete}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
