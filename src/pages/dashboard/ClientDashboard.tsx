import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ClientStartChecklist } from '@/components/dashboard/ClientStartChecklist';
import { ClientWaitingBanner } from '@/components/client/ClientWaiting';
import { useClientWaiting } from '@/hooks/useClientWaiting';
import { CalendarConnectCard } from '@/components/interview/calendar/CalendarConnectCard';
import { EntwuerfeHandy, PositionEntry } from '@/components/dashboard/PositionEntry';
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
import { useNavigate } from 'react-router-dom';
import { Compass, Plus, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const navigate = useNavigate();
  const hatStellen = isLoading || (data?.liveJobs?.length ?? 0) > 0;
  /** Handy: Knopf „Neue Position aufnehmen“ im Kopf statt der Karte (nur laufende Kunden). */
  const kopfKnopf = !waiting && hatStellen;

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

        {/* Header / Begrüßung. Handy, laufender Kunde (17.11.2026): „Neue Position aufnehmen“
            als Knopf neben „Rundgang“, Entwürfe eingeklappt darunter; die Karte entfällt dort. */}
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">
                {firstName ? t(`page.greetingName.${greetingKey()}`, { name: firstName }) : t(`page.greeting.${greetingKey()}`)}
              </h1>
              <p className="text-sm text-muted-foreground">{waiting ? t('page.subtitleWaiting') : t('page.subtitle')}</p>
            </div>
            <div className={cn('flex gap-2', kopfKnopf && 'max-md:w-full')}>
              {kopfKnopf && (
                <Button size="sm" data-tour="client.entry" className="min-w-0 flex-1 gap-1.5 md:hidden" onClick={() => navigate('/dashboard/aufnahme')}>
                  <Plus className="h-4 w-4 shrink-0" /> <span className="truncate">{t('entry.newTitle')}</span>
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => guide.start()}>
                <Compass className="h-4 w-4" /> {t('page.tour')}
              </Button>
            </div>
          </div>
          {kopfKnopf && <EntwuerfeHandy className="mt-2.5 md:hidden" />}
        </div>

        {/* Im Wartezustand gibt es noch nichts zu zählen: Kennzahlen und leere Listen kommen mit der Gegenzeichnung. */}
        {!waiting && <>
        {/* Neuigkeit: Meilensteine (Zusage, Gegenwunsch …) mit dem nächsten Schritt (24.10.2026) */}
        <MilestoneBand />

        {/* Neue Position – fuehrt in dieselbe Aufnahme wie der Link /start */}
        <div data-tour="client.entry" className={cn(hatStellen && 'max-md:hidden')}>
          <PositionEntry hasJobs={hatStellen} />
        </div>

        {/* 2x2 Bento – vier gleich große Boxen. Handy: Bewerbungen, Ihre Aufgaben, Aktive Jobs,
            Interviews (17.11.2026); am Desktop lösen sich die Hüllen auf (md:contents). */}
        <TooltipProvider>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <BewerbungenTile />
            <div className="max-md:order-2 md:contents">
              <AktiveJobsTile jobs={data?.liveJobs ?? []} loading={isLoading} />
            </div>
            <div data-tour="client.decide" className="max-md:order-1">
              <IhreAufgabenTile />
            </div>
            <div className="max-md:order-3 md:contents">
              <AnstehendeInterviewsTile />
            </div>
          </div>
        </TooltipProvider>
        </>}
      </div>
    </DashboardLayout>
  );
}
