import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Lock, X } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useClientGuide } from '@/components/recruiter/guide/RecruiterGuide';
import { useClientWaiting } from '@/hooks/useClientWaiting';
import { useAuth } from '@/lib/auth';
import { clientPathClosedDuringTour, clientPathOpenWhileWaiting } from '@/lib/clientStart';

/**
 * Sperre im Wartezustand (Entscheidung 30.10.2026): Bis Matchunt gegengezeichnet hat,
 * sind nur Start, Passwort, Vertrag und Firmendaten offen. Der Rundgang läuft hindurch,
 * denn er wechselt selbst die Seiten und zeigt dort Beispiele (Marko, 31.10.2026).
 */
export default function ClientWaitingGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation('clientDashboard');
  const { waiting } = useClientWaiting();
  const guide = useClientGuide();
  const { pathname } = useLocation();
  const offen = clientPathOpenWhileWaiting(pathname) || (guide.running && !clientPathClosedDuringTour(pathname));
  if (!waiting || offen) return <>{children}</>;
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-md py-16 text-center">
        <Lock className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
        <h1 className="text-xl font-semibold">{t('waiting.lockedTitle')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('waiting.lockedText')}</p>
        <Button asChild variant="outline" className="mt-5"><Link to="/dashboard">{t('waiting.toDashboard')}</Link></Button>
      </div>
    </DashboardLayout>
  );
}

const wasWaitingKey = (userId: string) => `matchunt:client-was-waiting:${userId}`;

/** Einmal nach der Gegenzeichnung, oben im Dashboard. */
export function ClientWaitingBanner({ onTour }: { onTour: () => void }) {
  const { t } = useTranslation('clientDashboard');
  const { waiting } = useClientWaiting();
  const { user } = useAuth();
  const userId = user?.id;
  const [justFreed, setJustFreed] = useState(false);

  useEffect(() => {
    if (!userId) return;
    try {
      if (waiting) window.localStorage.setItem(wasWaitingKey(userId), '1');
      else if (window.localStorage.getItem(wasWaitingKey(userId))) {
        window.localStorage.removeItem(wasWaitingKey(userId));
        setJustFreed(true);
      }
    } catch { /* ohne Speicher entfällt nur die einmalige Meldung */ }
  }, [waiting, userId]);

  if (!justFreed) return null;
  return (
    <div role="status" className="flex flex-wrap items-start gap-2 rounded-lg border border-border/60 px-4 py-3 text-sm">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      <p className="min-w-0 flex-1">{t('waiting.freed')}</p>
      <button type="button" onClick={onTour} className="text-xs underline underline-offset-2">{t('waiting.startTour')}</button>
      <button type="button" aria-label={t('waiting.close')} onClick={() => setJustFreed(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
    </div>
  );
}
