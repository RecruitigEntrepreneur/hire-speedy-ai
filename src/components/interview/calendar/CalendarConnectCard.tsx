import { useId, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle, CalendarClock, Check, CheckCircle2, Clock, ExternalLink, Eye, Info, Loader2, PenLine, ShieldCheck, X,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import type { CalendarStatus } from '@/lib/interviewScheduling';
import { CALENDAR_CARD_HIDDEN_KEY, sentAgo, useCalendarReturn, useCalendarStatus } from './useCalendarStatus';

type Variant = 'settings' | 'dashboard' | 'checklist';
type Calendar = ReturnType<typeof useCalendarStatus>;

const DATENBLATT = '/kalender-datenblatt.html';
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

const MicrosoftMark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 21 21" className={cn('h-5 w-5 shrink-0', className)} aria-hidden="true">
    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
  </svg>
);

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Das hat nicht geklappt. Bitte erneut versuchen.');

async function copyLink(link: string) {
  try {
    await navigator.clipboard.writeText(link);
    toast.success('Link kopiert.');
  } catch {
    // Ohne Zugriff auf die Zwischenablage (z. B. ältere Browser): zum Selbst-Kopieren anzeigen.
    window.prompt('Link für Ihre IT', link);
  }
}

const pendingLine = (status: CalendarStatus) => (status.itRequest
  ? `Link an ${status.itRequest.itEmail} gesendet ${sentAgo(status.itRequest.sentAt)}`
  : 'Link an Ihre IT gesendet');

function DatenblattLink({ className }: { className?: string }) {
  return (
    <a href={DATENBLATT} target="_blank" rel="noopener noreferrer"
       className={cn('inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground', className)}>
      Datenblatt für IT und Betriebsrat <ExternalLink className="h-3 w-3" />
    </a>
  );
}

/** Versand des Freigabe-Links an die IT; danach lässt sich der Link auch kopieren. */
function useItRequest(cal: Calendar) {
  const [link, setLink] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const send = (itEmail: string) => cal.requestIt.mutate(itEmail, {
    onSuccess: (result) => {
      setLink(result.link);
      if (result.sent) {
        setSentTo(itEmail);
        toast.success(`Link an ${itEmail} gesendet.`);
      } else {
        toast.error('Die Mail konnte nicht gesendet werden. Kopieren Sie den Link und schicken Sie ihn Ihrer IT selbst.');
      }
    },
    onError: (e) => toast.error(errorText(e)),
  });
  return { link, sentTo, send, sending: cal.requestIt.isPending };
}

function ItPanel({ cal, onClose, compact }: { cal: Calendar; onClose: () => void; compact?: boolean }) {
  const emailId = useId();
  const [email, setEmail] = useState(cal.status?.itRequest?.itEmail ?? '');
  const it = useItRequest(cal);
  const valid = EMAIL.test(email.trim());

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !it.sending) it.send(email.trim());
      }}
    >
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="space-y-1">
          <h3 className={cn('font-semibold', compact ? 'text-sm' : 'text-base')}>Ihre IT muss einmal zustimmen</h3>
          <p className="text-sm text-muted-foreground">
            Microsoft verlangt bei Ihrer Firma eine Freigabe durch die IT. Sie gilt dann für alle Kollegen.
          </p>
        </div>
      </div>
      <div className="max-w-sm space-y-1.5">
        <Label htmlFor={emailId}>E-Mail Ihrer IT</Label>
        <Input id={emailId} type="email" autoComplete="off" placeholder="it@ihre-firma.de"
               value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={!valid || it.sending}>
          {it.sending && <Loader2 className="h-4 w-4 animate-spin" />}
          {it.sentTo ? 'Erneut senden' : 'Link an IT senden'}
        </Button>
        {it.link && (
          <Button type="button" size="sm" variant="outline" onClick={() => void copyLink(it.link!)}>Link kopieren</Button>
        )}
        <DatenblattLink className="ml-1" />
      </div>
      {it.sentTo ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-success/10 px-3 py-2 text-sm">
          <Check className="h-4 w-4 text-success" />
          <span className="flex-1">Gesendet an {it.sentTo}. Sobald Ihre IT zugestimmt hat, verbinden Sie Outlook mit einem Klick.</span>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>Fertig</Button>
        </div>
      ) : (
        <button type="button" onClick={onClose}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Später erledigen
        </button>
      )}
    </form>
  );
}

function ConnectButton({ cal, returnPath, label, size = 'default', variant = 'default' }: {
  cal: Calendar; returnPath: string; label: string; size?: 'default' | 'sm'; variant?: 'default' | 'outline';
}) {
  const busy = cal.connect.isPending || cal.connect.isSuccess; // nach Erfolg läuft die Weiterleitung
  return (
    <Button type="button" size={size} variant={variant} disabled={busy}
            onClick={() => cal.connect.mutate(returnPath, { onError: (e) => toast.error(errorText(e)) })}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : variant === 'default' ? <MicrosoftMark className="h-4 w-4" /> : null}
      {busy ? 'Weiter zu Microsoft …' : label}
    </Button>
  );
}

function DisconnectButton({ cal }: { cal: Calendar }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" disabled={cal.disconnect.isPending}>
          {cal.disconnect.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Trennen
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Outlook trennen?</AlertDialogTitle>
          <AlertDialogDescription>
            Danach sieht Matchunt nicht mehr, wann Sie belegt sind, und trägt Interviews nicht mehr in Ihren Kalender ein.
            Sie können jederzeit neu verbinden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={() => cal.disconnect.mutate(undefined, {
            onSuccess: () => toast.success('Outlook ist getrennt.'),
            onError: (e) => toast.error(errorText(e)),
          })}>
            Trennen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ResendButton({ cal, status, size = 'sm' }: { cal: Calendar; status: CalendarStatus; size?: 'sm' | 'default' }) {
  const it = useItRequest(cal);
  const itEmail = status.itRequest?.itEmail;
  if (!itEmail) return null;
  return (
    <>
      <Button type="button" size={size} variant="outline" disabled={it.sending} onClick={() => it.send(itEmail)}>
        {it.sending && <Loader2 className="h-4 w-4 animate-spin" />}
        Erneut senden
      </Button>
      {it.link && (
        <Button type="button" size={size} variant="ghost" onClick={() => void copyLink(it.link!)}>Link kopieren</Button>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Einstellungen › Kalender (Screens 1, 2a, 2b)
// ---------------------------------------------------------------------------

function SettingsBody({ cal, itFlow, closeIt }: { cal: Calendar; itFlow: boolean; closeIt: () => void }) {
  const returnPath = `${window.location.pathname}#kalender`;
  const { status } = cal;

  if (cal.isLoading) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Kalender-Stand wird geladen …</p>;
  }
  if (!status) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="flex-1 text-muted-foreground">Der Stand Ihrer Kalender-Verbindung konnte nicht geladen werden.</span>
        <Button type="button" size="sm" variant="outline" onClick={() => void cal.refetch()}>Erneut versuchen</Button>
      </div>
    );
  }
  if (status.state === 'not_configured') {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Info className="h-4 w-4 shrink-0" />Die Kalender-Verbindung wird gerade eingerichtet.</p>;
  }
  if (itFlow && status.state !== 'connected') return <ItPanel cal={cal} onClose={closeIt} />;

  if (status.state === 'connected') {
    return (
      <div className="flex flex-wrap items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="font-medium">
            Outlook ist verbunden
            {status.accountEmail && <span className="font-normal text-muted-foreground"> · {status.accountEmail}</span>}
          </p>
          <p className="text-sm text-muted-foreground">Ihre belegten Zeiten und die Ihrer Kollegen werden berücksichtigt.</p>
        </div>
        <DisconnectButton cal={cal} />
      </div>
    );
  }

  if (status.state === 'expired') {
    return (
      <div className="flex flex-wrap items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="font-medium">Die Verbindung zu Outlook ist abgelaufen.</p>
          <p className="text-sm text-muted-foreground">
            {status.accountEmail ? `${status.accountEmail} · ` : ''}Bis Sie neu verbinden, sieht Matchunt Ihre belegten Zeiten nicht.
          </p>
        </div>
        <ConnectButton cal={cal} returnPath={returnPath} label="Neu verbinden" size="sm" />
      </div>
    );
  }

  if (status.state === 'it_pending') {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="font-medium">Wartet auf Ihre IT <span className="font-normal text-muted-foreground">· {pendingLine(status)}</span></p>
            <p className="text-sm text-muted-foreground">Hat Ihre IT schon zugestimmt? Dann verbinden Sie Outlook jetzt.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pl-8">
          <ConnectButton cal={cal} returnPath={returnPath} label="Jetzt verbinden" size="sm" />
          <ResendButton cal={cal} status={status} />
          <DatenblattLink className="ml-1" />
        </div>
      </div>
    );
  }

  // not_connected (Screen 1)
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Ihren Kalender verbinden</h3>
        <p className="text-sm text-muted-foreground">
          Dann sehen Sie bei Interview-Anfragen Ihre belegten Zeiten, und Kandidaten bekommen nur Zeiten, in denen Sie wirklich frei sind.
          Interviews trägt Matchunt selbst ein.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-lg border-2 border-primary bg-primary/5 px-4 py-3">
          <MicrosoftMark />
          <span className="flex-1 text-sm font-medium">Microsoft 365 / Outlook</span>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" /></span>
        </div>
        <div aria-disabled="true"
             className="flex cursor-not-allowed items-center gap-3 rounded-lg border border-border px-4 py-3 opacity-60">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold text-muted-foreground">G</span>
          <span className="flex-1 text-sm font-medium">Google</span>
          <Badge variant="secondary" className="font-normal">später</Badge>
        </div>
      </div>
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="flex gap-2.5 rounded-lg bg-muted/50 px-3 py-2.5">
          <Eye className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p><strong className="font-medium">Wir lesen:</strong> nur frei oder belegt, auch von Kollegen, die Sie zu Interviews einladen. Keine Titel oder Inhalte.</p>
        </div>
        <div className="flex gap-2.5 rounded-lg bg-muted/50 px-3 py-2.5">
          <PenLine className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p><strong className="font-medium">Wir schreiben:</strong> nur Ihre Matchunt-Interviews.</p>
        </div>
      </div>
      <ConnectButton cal={cal} returnPath={returnPath} label="Outlook verbinden" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard (Screen 3): schmale Zeile, wegklickbar
// ---------------------------------------------------------------------------

function DashboardRow({ cal, itFlow, closeIt, className }: { cal: Calendar; itFlow: boolean; closeIt: () => void; className?: string }) {
  const { user } = useAuth();
  // null = dem Merker im Konto folgen; true/false = gerade hier geklickt
  const [hiddenLocal, setHiddenLocal] = useState<boolean | null>(null);
  const hidden = hiddenLocal ?? !!user?.user_metadata?.[CALENDAR_CARD_HIDDEN_KEY];
  const { status } = cal;
  const returnPath = '/dashboard';

  const remember = (value: string | null) => {
    void supabase.auth.updateUser({ data: { [CALENDAR_CARD_HIDDEN_KEY]: value } }).then(({ error }) => {
      if (error) console.warn('[kalender] Ausblenden nicht gespeichert', error.message);
    });
  };
  const hide = () => {
    setHiddenLocal(true);
    remember(new Date().toISOString());
    toast('Ausgeblendet. Sie finden das unter Einstellungen › Kalender.', {
      action: { label: 'Rückgängig', onClick: () => { setHiddenLocal(false); remember(null); } },
    });
  };

  if (!status) return null;
  const relevant = status.state === 'not_connected' || status.state === 'expired' || status.state === 'it_pending';
  const showIt = itFlow && status.state !== 'connected' && status.state !== 'not_configured';
  if (!showIt && (!relevant || hidden)) return null;

  const title = status.state === 'expired'
    ? 'Die Verbindung zu Outlook ist abgelaufen'
    : 'Bevor die ersten Kandidaten kommen: Kalender verbinden';
  const stand = status.state === 'it_pending'
    ? `Wartet auf Ihre IT · ${pendingLine(status)}`
    : status.state === 'expired'
    ? 'Bis Sie neu verbinden, sieht Matchunt Ihre belegten Zeiten nicht.'
    : 'Noch nicht verbunden · Kandidaten bekommen dann nur Zeiten, in denen Sie wirklich frei sind.';

  return (
    <div className={cn('rounded-lg border border-border/60 bg-card shadow-sm', className)}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          status.state === 'it_pending' || status.state === 'expired' ? 'bg-warning/15 text-warning' : 'bg-primary/10 text-primary')}>
          <CalendarClock className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{stand}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status.state === 'it_pending' && <ResendButton cal={cal} status={status} />}
          <ConnectButton cal={cal} returnPath={returnPath} size="sm"
                         label={status.state === 'expired' ? 'Neu verbinden' : 'Jetzt verbinden'}
                         variant={status.state === 'it_pending' ? 'outline' : 'default'} />
        </div>
        <button type="button" onClick={hide} aria-label="Ausblenden"
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      {showIt && (
        <div className="border-t border-border/60 px-4 py-4">
          <ItPanel cal={cal} onClose={closeIt} compact />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Checkliste: eine Zeile Stand + nächster Schritt
// ---------------------------------------------------------------------------

function ChecklistLine({ cal, itFlow, closeIt, className }: { cal: Calendar; itFlow: boolean; closeIt: () => void; className?: string }) {
  const { status } = cal;
  const returnPath = window.location.pathname;
  if (!status) return null;
  if (itFlow && status.state !== 'connected' && status.state !== 'not_configured') {
    return <div className={className}><ItPanel cal={cal} onClose={closeIt} compact /></div>;
  }

  const text = status.state === 'connected'
    ? `Outlook ist verbunden${status.accountEmail ? ` · ${status.accountEmail}` : ''}`
    : status.state === 'it_pending'
    ? `Wartet auf Ihre IT · ${pendingLine(status)}`
    : status.state === 'expired'
    ? 'Die Verbindung zu Outlook ist abgelaufen.'
    : status.state === 'not_configured'
    ? 'Die Kalender-Verbindung wird gerade eingerichtet.'
    : 'Damit Kandidaten nur freie Zeiten sehen.';

  return (
    <div className={cn('flex flex-wrap items-center gap-2 text-sm', className)}>
      <span className="flex-1 text-muted-foreground">{text}</span>
      {status.state === 'it_pending' && <ResendButton cal={cal} status={status} />}
      {(status.state === 'not_connected' || status.state === 'expired' || status.state === 'it_pending') && (
        <ConnectButton cal={cal} returnPath={returnPath} size="sm"
                       label={status.state === 'expired' ? 'Neu verbinden' : status.state === 'it_pending' ? 'Jetzt verbinden' : 'Outlook verbinden'}
                       variant={status.state === 'it_pending' ? 'outline' : 'default'} />
      )}
    </div>
  );
}

/**
 * Kalender-Verbindung (Outlook) des Kunden in drei Formen:
 * settings = Einstellungen › Kalender, dashboard = wegklickbare Zeile im
 * Dashboard, checklist = eine Zeile Stand mit nächstem Schritt.
 * Verarbeitet auch den Rücksprung aus Microsoft (?kalender=…).
 */
export function CalendarConnectCard({ variant = 'settings', className }: { variant?: Variant; className?: string }) {
  const cal = useCalendarStatus();
  const { itFlow, closeIt } = useCalendarReturn();

  if (variant === 'dashboard') return <DashboardRow cal={cal} itFlow={itFlow} closeIt={closeIt} className={className} />;
  if (variant === 'checklist') return <ChecklistLine cal={cal} itFlow={itFlow} closeIt={closeIt} className={className} />;
  return (
    <div className={cn('rounded-lg border border-border/60 p-4 sm:p-5', className)}>
      <SettingsBody cal={cal} itFlow={itFlow} closeIt={closeIt} />
    </div>
  );
}
