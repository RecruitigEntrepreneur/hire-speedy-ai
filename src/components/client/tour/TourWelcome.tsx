import { useContext, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { prefetchStage } from './stageQueries';
import { useTranslation } from 'react-i18next';
import { ClientTourSourceContext, useTourData } from './tourData';

/**
 * Begrüßung des Kunden-Rundgangs: seine Stelle mit Stand. Was echt und was Beispiel ist,
 * sagt der Text darüber; die Kapitel stehen ab Schritt 2 unter „Inhalt“ (Kapitelliste hier
 * störte, Marko 16.11.2026).
 */
export function TourWelcome() {
  const { t } = useTranslation('clientGuide');
  const data = useTourData();
  const { waitingTitle } = useContext(ClientTourSourceContext);
  // Während der Kunde die Begrüßung liest, lädt die Bühne schon ihre Daten (23.11.2026).
  const queryClient = useQueryClient();
  const { user } = useAuth();
  useEffect(() => { prefetchStage(queryClient, data.jobId ?? null, user?.id); }, [queryClient, data.jobId, user?.id]);
  const stand = data.state !== 'none' ? t(`welcome.state.${data.state}`)
    : waitingTitle ? t('welcome.state.waiting') : t('welcome.state.example');
  const meta = [data.location, data.remote ? t(`demo.remote.${data.remote}`) : null].filter(Boolean).join(' · ');
  return (
    <div className="mt-4">
      <div className="rounded-lg border border-border bg-card px-3 py-2.5">
        <p className="text-xs text-muted-foreground">
          {data.example && !waitingTitle ? t('welcome.exampleJob') : t('welcome.yourJob')}
        </p>
        <p className="mt-0.5 text-sm font-semibold">{data.title}</p>
        <p className="text-xs text-muted-foreground">{[meta, stand].filter(Boolean).join(' · ')}</p>
      </div>
    </div>
  );
}
