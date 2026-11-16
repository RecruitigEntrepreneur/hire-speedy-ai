import { useEffect, useState, type ComponentProps } from 'react';
import { CheckCircle2, Clock, Lock, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { useRecruiterPending } from '@/components/verification/RecruiterAccessGate';

/**
 * Wartezustand des Headhunters (Entscheidung 30.10.2026): Mit seiner Unterschrift ist
 * das Dashboard offen, aber nur zum Ansehen, bis Matchunt gegengezeichnet hat. Der
 * Vertrag und die Datenschutzvereinbarung gelten erst dann.
 */
// Texte: src/i18n/locales/recruiterDashboard (pending.*), gelesen beim Aufruf (README Regel 7).
export const pendingText = (key: 'hint' | 'notYet' | 'search' | 'adCopy' | 'addCandidate' | 'addCandidates' | 'emptyNote'): string => i18n.t(`recruiterDashboard:pending.${key}`);

/** Der gesperrte Knopf. Bleibt sichtbar, damit klar ist, was gleich möglich wird. */
export function PendingButton({ label, ...props }: { label: string } & Omit<ComponentProps<typeof Button>, 'children' | 'disabled'>) {
  return <Button {...props} disabled title={pendingText('hint')}><Lock className="mr-1 h-3.5 w-3.5" />{label}</Button>;
}

const wasPendingKey = (userId: string) => `matchunt:recruiter-was-pending:${userId}`;

/** Oben im Dashboard: der Streifen im Wartezustand, danach einmal die Freigabe. */
export function RecruiterWaitingBanner() {
  const { t } = useTranslation('recruiterDashboard');
  const pending = useRecruiterPending();
  const { user } = useAuth();
  const userId = user?.id;
  const [justFreed, setJustFreed] = useState(false);

  useEffect(() => {
    if (!userId) return;
    try {
      if (pending) window.localStorage.setItem(wasPendingKey(userId), '1');
      else if (window.localStorage.getItem(wasPendingKey(userId))) {
        window.localStorage.removeItem(wasPendingKey(userId));
        setJustFreed(true);
      }
    } catch { /* ohne Speicher entfällt nur die einmalige Meldung */ }
  }, [pending, userId]);

  if (pending) {
    // Ruhig: Er muss nichts tun, also keine Warnfarbe (Regel vom 02.11.2026).
    return <div role="status" className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
      <Clock className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{t('pending.banner')}</p>
    </div>;
  }
  if (justFreed) {
    return <div role="status" className="flex items-start gap-2 rounded-lg border border-border/60 px-4 py-3 text-sm">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      <p className="flex-1">{t('pending.freed')}</p>
      <button type="button" aria-label={t('pending.close')} onClick={() => setJustFreed(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
    </div>;
  }
  return null;
}
