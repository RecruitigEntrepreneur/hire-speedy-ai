import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { VerificationStatusBanner } from '@/components/verification/VerificationStatusBanner';
import { PositionEntry } from '@/components/dashboard/PositionEntry';
import { BewerbungenTile } from '@/components/dashboard/bento/BewerbungenTile';
import { AktiveJobsTile } from '@/components/dashboard/bento/AktiveJobsTile';
import { BrauchtEntscheidungTile } from '@/components/dashboard/bento/BrauchtEntscheidungTile';
import { AnstehendeInterviewsTile } from '@/components/dashboard/bento/AnstehendeInterviewsTile';
import { useClientDashboard } from '@/hooks/useClientDashboard';
import { usePageViewTracking } from '@/hooks/useEventTracking';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useClientGuide } from '@/components/recruiter/guide/RecruiterGuide';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Compass, RefreshCw } from 'lucide-react';

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

  /* Rundgang (lib/clientGuide.ts): startet von selbst nur für NEUE Kunden --
     Konten ohne jede Stelle, auch ohne Entwurf. Bestehende Kunden erreichen
     ihn über den Knopf "Rundgang" (Entscheidung 24.09.2026). */
  const guide = useClientGuide();
  const { data: stellenAnzahl } = useQuery({
    queryKey: ['client-guide-job-count', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('jobs').select('id', { count: 'exact', head: true }).eq('client_id', user!.id);
      if (error) throw error;
      return count ?? 0;
    },
  });
  useEffect(() => {
    if (!isLoading && stellenAnzahl === 0) guide.offer();
  }, [isLoading, stellenAnzahl, guide]);

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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              {getGreeting()}
              {firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="text-sm text-muted-foreground">Ihr Command Center für alle Kandidaten-Aktivitäten.</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => guide.start()}>
            <Compass className="h-4 w-4" /> Rundgang
          </Button>
        </div>

        {/* Neue Position – fuehrt in dieselbe Aufnahme wie der Link /start */}
        <div data-tour="client.entry">
          <PositionEntry hasJobs={isLoading || (data?.liveJobs?.length ?? 0) > 0} />
        </div>

        {/* 2x2 Bento – vier gleich große Boxen */}
        <TooltipProvider>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <BewerbungenTile />
            <AktiveJobsTile jobs={data?.liveJobs ?? []} loading={isLoading} />
            <div data-tour="client.decide">
              <BrauchtEntscheidungTile actions={data?.actions ?? []} loading={isLoading} />
            </div>
            <AnstehendeInterviewsTile />
          </div>
        </TooltipProvider>
      </div>
    </DashboardLayout>
  );
}
