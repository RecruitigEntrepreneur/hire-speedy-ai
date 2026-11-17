import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ClientStartChecklist } from '@/components/dashboard/ClientStartChecklist';
import { ClientWaitingBanner } from '@/components/client/ClientWaiting';
import { useClientWaiting } from '@/hooks/useClientWaiting';
import { CalendarConnectCard } from '@/components/interview/calendar/CalendarConnectCard';
import { PositionEntry } from '@/components/dashboard/PositionEntry';
import { BewerbungenTile } from '@/components/dashboard/bento/BewerbungenTile';
import { AktiveJobsTile } from '@/components/dashboard/bento/AktiveJobsTile';
import { IhreAufgabenTile } from '@/components/dashboard/bento/IhreAufgabenTile';
import { MilestoneBand } from '@/components/dashboard/MilestoneBand';
import { AnstehendeInterviewsTile } from '@/components/dashboard/bento/AnstehendeInterviewsTile';
import { useClientDashboard } from '@/hooks/useClientDashboard';
import { usePageViewTracking } from '@/hooks/useEventTracking';
import { useAuth } from '@/lib/auth';
import { useClientGuide } from '@/components/recruiter/guide/RecruiterGuide';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Compass, RefreshCw } from 'lucide-react';

function greetingKey(): 'morning' | 'day' | 'evening' {
  const h = new Date().getHours();
  if (h < 11) return 'morning';
  if (h < 18) return 'day';
  return 'evening';
}

export default function ClientDashboard() {
  const { t } = useTranslation('clientDashboard');
  const { data, isLoading, error, refetch } = useClientDashboard();
  const { user } = useAuth();

  usePageViewTracking('client_dashboard');

  /* Rundgang (lib/clientGuide.ts, Fassung 3 vom 16.11.2026): startet einmal von selbst für
     JEDEN Kunden, auch für bestehende -- an der eigenen Stelle, Kandidaten am Beispiel.
     Wer „Später“ wählt oder ihn beendet hat, startet ihn über den Knopf „Rundgang“. */
  const guide = useClientGuide();
  const { waiting } = useClientWaiting();
  useEffect(() => {
    if (!isLoading) guide.offer();
  }, [isLoading, guide]);

  const rawName = String(
    (user?.user_metadata as { full_name?: string } | undefined)?.full_name || user?.email?.split('@')[0] || '',
  ).split(' ')[0];
  const firstName = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : '';

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <p className="mb-4 text-muted-foreground">{t('page.loadError')}</p>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('page.retry')}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout fluid>
      <div className="space-y-6">
        {/* Ihr Start bei Matchunt: Vertrag, erste Position, Firmendaten, Rundgang
            (lib/clientStart.ts). Ersetzt den alten Kasten „Verifikation
            erforderlich“, der AGB und KYC aus dem früheren Onboarding verlangte. */}
        <ClientWaitingBanner onTour={() => guide.start()} />
        <ClientStartChecklist onTour={() => guide.start()} />

        {/* Kalender verbinden, bevor die ersten Kandidaten kommen -- nur solange
            nicht verbunden (oder abgelaufen / wartet auf die IT), wegklickbar. */}
        {!waiting && <CalendarConnectCard variant="dashboard" />}

        {/* Header / Begrüßung */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              {firstName ? t(`page.greetingName.${greetingKey()}`, { name: firstName }) : t(`page.greeting.${greetingKey()}`)}
            </h1>
            <p className="text-sm text-muted-foreground">{waiting ? t('page.subtitleWaiting') : t('page.subtitle')}</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => guide.start()}>
            <Compass className="h-4 w-4" /> {t('page.tour')}
          </Button>
        </div>

        {/* Im Wartezustand gibt es noch nichts zu zählen: Kennzahlen und leere Listen kommen mit der Gegenzeichnung. */}
        {!waiting && <>
        {/* Neuigkeit: Meilensteine (Zusage, Gegenwunsch …) mit dem nächsten Schritt (24.10.2026) */}
        <MilestoneBand />

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
              <IhreAufgabenTile />
            </div>
            <AnstehendeInterviewsTile />
          </div>
        </TooltipProvider>
        </>}
      </div>
    </DashboardLayout>
  );
}
