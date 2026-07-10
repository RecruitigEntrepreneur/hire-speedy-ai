import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { VerificationStatusBanner } from '@/components/verification/VerificationStatusBanner';
import { NeueStelleBar } from '@/components/dashboard/NeueStelleBar';
import { BewerbungenTile } from '@/components/dashboard/bento/BewerbungenTile';
import { AktiveJobsTile } from '@/components/dashboard/bento/AktiveJobsTile';
import { BrauchtEntscheidungTile } from '@/components/dashboard/bento/BrauchtEntscheidungTile';
import { AnstehendeInterviewsTile } from '@/components/dashboard/bento/AnstehendeInterviewsTile';
import { useClientDashboard } from '@/hooks/useClientDashboard';
import { usePageViewTracking } from '@/hooks/useEventTracking';
import { useAuth } from '@/lib/auth';
import { RefreshCw } from 'lucide-react';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Guten Morgen';
  if (h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

export default function ClientDashboard() {
  const { data, isLoading, error, refetch } = useClientDashboard();
  const { user } = useAuth();

  usePageViewTracking('client_dashboard');

  const rawName = String(
    (user?.user_metadata as { full_name?: string } | undefined)?.full_name || user?.email?.split('@')[0] || '',
  ).split(' ')[0];
  const firstName = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : '';

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <p className="mb-4 text-muted-foreground">Fehler beim Laden des Dashboards</p>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Erneut versuchen
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout fluid>
      <div className="space-y-6">
        {/* Verification Banner */}
        <VerificationStatusBanner />

        {/* Header / Begrüßung */}
        <div>
          <h1 className="text-2xl font-bold">
            {getGreeting()}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground">Ihr Command Center für alle Kandidaten-Aktivitäten.</p>
        </div>

        {/* Neue Stelle – Typ zuerst, dann Upload-Art */}
        <NeueStelleBar />

        {/* 2x2 Bento – vier gleich große Boxen */}
        <TooltipProvider>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <BewerbungenTile />
            <AktiveJobsTile jobs={data?.liveJobs ?? []} loading={isLoading} />
            <BrauchtEntscheidungTile actions={data?.actions ?? []} loading={isLoading} />
            <AnstehendeInterviewsTile />
          </div>
        </TooltipProvider>
      </div>
    </DashboardLayout>
  );
}
