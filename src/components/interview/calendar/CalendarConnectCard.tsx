import { createContext, useContext, useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { toast } from 'sonner';
import { CalendarClock, Check, ExternalLink, Eye, Loader2, PenLine, ShieldCheck, X } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { GoogleKalenderIcon, OutlookKalenderIcon } from '@/components/brand/MarkenLogos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import type { CalendarStatus } from '@/lib/interviewScheduling';
import { CALENDAR_CARD_HIDDEN_KEY, sentAgo, useCalendarReturn, useCalendarStatus } from './useCalendarStatus';

type Variant = 'settings' | 'dashboard' | 'checklist';

/** Kunde („Sie“, clientInterviews) oder Headhunter („du“, recruiterKalender), seit 16.11.2026 ein Baustein für beide. */
type KalNs = 'clientInterviews' | 'recruiterKalender';
const KalenderNs = createContext<KalNs>('clientInterviews');
const useKalT = () => useTranslation(useContext(KalenderNs));
type KalT = ReturnType<typeof useKalT>['t'];
type Calendar = ReturnType<typeof useCalendarStatus>;

const DATENBLATT = '/kalender-datenblatt.html';
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

/**
 * Knopf im Stil der Anbieter, wie „Mit Google anmelden“ (16.11.2026): hell weiß mit grauem Rand,
 * dunkel fast schwarz mit hellem Rand, links das farbige App-Symbol.
 * Achtung: Grundklassen = dunkel, dark: = hell (tailwind darkMode ['class', '.light']).
 */
const ANBIETER_KNOPF = 'inline-flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-2.5 text-xs font-medium transition-colors '
  + 'border-[#8E918F] bg-[#131314] text-[#E3E3E3] hover:bg-[#202124] dark:border-[#DADCE0] dark:bg-white dark:text-[#1F1F1F] dark:hover:bg-[#F8F9FA] '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const errorText = (e: unknown) => (e instanceof Error ? e.message : i18n.t('interviews:error.generic'));

async function copyLink(link: string, t: KalT) {
  try {
    await navigator.clipboard.writeText(link);
    toast.success(t('calendar.copied'));
  } catch {
    // Ohne Zugriff auf die Zwischenablage (z. B. ältere Browser): zum Selbst-Kopieren anzeigen.
    window.prompt(t('calendar.linkForIt'), link);
  }
}

const pendingLine = (status: CalendarStatus, t: KalT) => (status.itRequest
  ? t('calendar.sentTo', { email: status.itRequest.itEmail, when: sentAgo(status.itRequest.sentAt) })
  : t('calendar.sentToIt'));

function DatenblattLink({ className }: { className?: string }) {
  const { t } = useKalT();
  return (
    <a href={DATENBLATT} target="_blank" rel="noopener noreferrer"
       className={cn('inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground', className)}>
      {t('calendar.datasheet')} <ExternalLink className="h-3 w-3" />
    </a>
  );
}

/** Versand des Freigabe-Links an die IT; danach lässt sich der Link auch kopieren. */
function useItRequest(cal: Calendar) {
  const { t } = useKalT();
  const [link, setLink] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const send = (itEmail: string) => cal.requestIt.mutate(itEmail, {
    onSuccess: (result) => {
      setLink(result.link);
      if (result.sent) {
        setSentTo(itEmail);
        toast.success(t('calendar.sentToast', { email: itEmail }));
      } else {
        toast.error(t('calendar.mailFailed'));
      }
    },
    onError: (e) => toast.error(errorText(e)),
  });
  return { link, sentTo, send, sending: cal.requestIt.isPending };
}

function ItPanel({ cal, onClose, compact }: { cal: Calendar; onClose: () => void; compact?: boolean }) {
  const { t } = useKalT();
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
          <h3 className={cn('font-semibold', compact ? 'text-sm' : 'text-base')}>{t('calendar.itTitle')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('calendar.itLead')}
          </p>
        </div>
      </div>
      <div className="max-w-sm space-y-1.5">
        <Label htmlFor={emailId}>{t('calendar.itEmail')}</Label>
        <Input id={emailId} type="email" autoComplete="off" placeholder={t('calendar.itEmailPh')}
               value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={!valid || it.sending}>
          {it.sending && <Loader2 className="h-4 w-4 animate-spin" />}
          {it.sentTo ? t('calendar.resend') : t('calendar.sendToIt')}
        </Button>
        {it.link && (
          <Button type="button" size="sm" variant="outline" onClick={() => void copyLink(it.link!, t)}>{t('calendar.copyLink')}</Button>
        )}
        <DatenblattLink className="ml-1" />
      </div>
      {it.sentTo ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-success/10 px-3 py-2 text-sm">
          <Check className="h-4 w-4 text-success" />
          <span className="flex-1">{t('calendar.sentDone', { email: it.sentTo })}</span>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>{t('calendar.done')}</Button>
        </div>
      ) : (
        <button type="button" onClick={onClose}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
          {t('calendar.later')}
        </button>
      )}
    </form>
  );
}

function ConnectButton({ cal, returnPath, label, size = 'default', variant = 'default' }: {
  cal: Calendar; returnPath: string; label: string; size?: 'default' | 'sm'; variant?: 'default' | 'outline';
}) {
  const { t } = useKalT();
  const busy = cal.connect.isPending || cal.connect.isSuccess; // nach Erfolg läuft die Weiterleitung
  return (
    <Button type="button" size={size} variant={variant} disabled={busy}
            onClick={() => cal.connect.mutate(returnPath, { onError: (e) => toast.error(errorText(e)) })}>
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {busy ? t('calendar.toMicrosoft') : label}
    </Button>
  );
}

/** Kleiner Outlook-Knopf mit App-Symbol (Leiste in der Übersicht, Checkliste). */
function OutlookKnopf({ cal, returnPath, label }: { cal: Calendar; returnPath: string; label: string }) {
  const { t } = useKalT();
  const busy = cal.connect.isPending || cal.connect.isSuccess;
  return (
    <button type="button" className={cn(ANBIETER_KNOPF, busy && 'pointer-events-none opacity-70')} disabled={busy}
            onClick={() => cal.connect.mutate(returnPath, { onError: (e) => toast.error(errorText(e)) })}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <OutlookKalenderIcon className="h-4 w-4" />}
      {busy ? t('calendar.toMicrosoft') : label}
    </button>
  );
}

/** Google Kalender: schon zu sehen, aber noch nicht klickbar. */
function GoogleBaldKnopf() {
  const { t } = useKalT();
  return (
    <span aria-disabled="true" title={t('calendar.googleSoon')}
          className={cn(ANBIETER_KNOPF, 'cursor-not-allowed opacity-50 hover:bg-[#131314] dark:hover:bg-white')}>
      <GoogleKalenderIcon className="h-4 w-4" />
      {t('calendar.googleCalendar')}
      <span className="rounded-full border border-[#8E918F] px-1.5 text-[11px] font-normal text-[#BDC1C6] dark:border-[#DADCE0] dark:text-[#5F6368]">{t('calendar.soon')}</span>
    </span>
  );
}

/** Eine App-Kachel: Symbol, Name, Stand in einer Zeile, rechts die Handlung. */
function AppKachel({ icon, name, zeile, rechts, aus = false }: {
  icon: ReactNode; name: string; zeile: ReactNode; rechts?: ReactNode; aus?: boolean;
}) {
  return (
    <div aria-disabled={aus || undefined}
         className={cn('flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5 sm:flex-nowrap', aus && 'opacity-60')}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{name}</p>
        <p className="break-words text-xs text-muted-foreground">{zeile}</p>
      </div>
      {rechts && <div className="flex shrink-0 flex-wrap items-center gap-2">{rechts}</div>}
    </div>
  );
}

function GoogleKachel() {
  const { t } = useKalT();
  return (
    <AppKachel aus icon={<GoogleKalenderIcon className="h-6 w-6" />} name={t('calendar.googleCalendar')} zeile={t('calendar.googleAccount')}
               rechts={<Badge variant="secondary" className="font-normal">{t('calendar.soon')}</Badge>} />
  );
}

/** Hinten (Einstellungen › Kalender, Terminseite): Outlook und Google als App-Kacheln untereinander. */
function KalenderKacheln({ cal, status, returnPath }: { cal: Calendar; status: CalendarStatus; returnPath: string }) {
  const { t } = useKalT();
  const mail = status.accountEmail;
  let zeile: ReactNode;
  let rechts: ReactNode;
  if (status.state === 'connected') {
    zeile = <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 shrink-0" />{mail ? t('calendar.connectedAs', { email: mail }) : t('calendar.connectedShort')}</span>;
    rechts = <DisconnectButton cal={cal} />;
  } else if (status.state === 'expired') {
    zeile = mail ? `${t('calendar.expiredTile')} · ${mail}` : t('calendar.expiredTile');
    rechts = <ConnectButton cal={cal} returnPath={returnPath} label={t('calendar.reconnect')} size="sm" />;
  } else if (status.state === 'it_pending') {
    zeile = t('calendar.waitingItLine', { line: pendingLine(status, t) });
    rechts = <><ResendButton cal={cal} status={status} /><ConnectButton cal={cal} returnPath={returnPath} label={t('calendar.connectNow')} size="sm" variant="outline" /></>;
  } else {
    zeile = t('calendar.outlookAccount');
    rechts = <ConnectButton cal={cal} returnPath={returnPath} label={t('calendar.connect')} size="sm" />;
  }
  return (
    <div className="space-y-2">
      <AppKachel icon={<OutlookKalenderIcon className="h-6 w-6" />} name={t('calendar.outlookCalendar')} zeile={zeile} rechts={rechts} />
      <GoogleKachel />
    </div>
  );
}

function DisconnectButton({ cal }: { cal: Calendar }) {
  const { t } = useKalT();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" disabled={cal.disconnect.isPending}>
          {cal.disconnect.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('calendar.disconnect')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('calendar.disconnectTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('calendar.disconnectLead')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={() => cal.disconnect.mutate(undefined, {
            onSuccess: () => toast.success(t('calendar.disconnected')),
            onError: (e) => toast.error(errorText(e)),
          })}>
            {t('calendar.disconnect')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ResendButton({ cal, status, size = 'sm' }: { cal: Calendar; status: CalendarStatus; size?: 'sm' | 'default' }) {
  const { t } = useKalT();
  const it = useItRequest(cal);
  const itEmail = status.itRequest?.itEmail;
  if (!itEmail) return null;
  return (
    <>
      <Button type="button" size={size} variant="outline" disabled={it.sending} onClick={() => it.send(itEmail)}>
        {it.sending && <Loader2 className="h-4 w-4 animate-spin" />}
        {t('calendar.resend')}
      </Button>
      {it.link && (
        <Button type="button" size={size} variant="ghost" onClick={() => void copyLink(it.link!, t)}>{t('calendar.copyLink')}</Button>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Einstellungen › Kalender (Screens 1, 2a, 2b)
// ---------------------------------------------------------------------------

function SettingsBody({ cal, itFlow, closeIt, ohneTitel = false, ruecksprung }: { cal: Calendar; itFlow: boolean; closeIt: () => void; ohneTitel?: boolean; ruecksprung?: string }) {
  const { t } = useKalT();
  const returnPath = ruecksprung ?? `${window.location.pathname}#kalender`;
  const { status } = cal;

  if (cal.isLoading) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t('calendar.loading')}</p>;
  }
  if (!status) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="flex-1 text-muted-foreground">{t('calendar.loadError')}</span>
        <Button type="button" size="sm" variant="outline" onClick={() => void cal.refetch()}>{t('page.retry')}</Button>
      </div>
    );
  }
  // Ohne Microsoft-App gibt es für den Kunden nichts zu verbinden: nichts anzeigen.
  if (status.state === 'not_configured') return null;
  if (itFlow && status.state !== 'connected') return <ItPanel cal={cal} onClose={closeIt} />;

  // App-Kacheln (16.11.2026, Marko: „Hinten nehmen wir die App-Kacheln“), in jedem Stand dieselbe Form.
  const lead = status.state === 'connected' ? t('calendar.connectedLead')
    : status.state === 'expired' ? t('calendar.expiredLead')
    : status.state === 'it_pending' ? t('calendar.waitingItLead')
    : t('calendar.connectLead');
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        {!ohneTitel && <h3 className="text-base font-semibold">{t('calendar.connectTitle')}</h3>}
        <p className="text-sm text-muted-foreground">{lead}</p>
      </div>
      <KalenderKacheln cal={cal} status={status} returnPath={returnPath} />
      {status.state === 'not_connected' && (
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex gap-2.5 rounded-lg bg-muted/50 px-3 py-2.5">
            <Eye className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p><strong className="font-medium">{t('calendar.weRead')}</strong> {t('calendar.weReadText')}</p>
          </div>
          <div className="flex gap-2.5 rounded-lg bg-muted/50 px-3 py-2.5">
            <PenLine className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p><strong className="font-medium">{t('calendar.weWrite')}</strong> {t('calendar.weWriteText')}</p>
          </div>
        </div>
      )}
      {status.state === 'it_pending' && <DatenblattLink />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard (Screen 3): schmale Zeile, wegklickbar
// ---------------------------------------------------------------------------

function DashboardRow({ cal, itFlow, closeIt, className }: { cal: Calendar; itFlow: boolean; closeIt: () => void; className?: string }) {
  const { t } = useKalT();
  const { user } = useAuth();
  // null = dem Merker im Konto folgen; true/false = gerade hier geklickt
  const [hiddenLocal, setHiddenLocal] = useState<boolean | null>(null);
  const hidden = hiddenLocal ?? !!user?.user_metadata?.[CALENDAR_CARD_HIDDEN_KEY];
  const { status } = cal;
  const returnPath = useContext(KalenderNs) === 'recruiterKalender' ? '/recruiter' : '/dashboard';

  const remember = (value: string | null) => {
    void supabase.auth.updateUser({ data: { [CALENDAR_CARD_HIDDEN_KEY]: value } }).then(({ error }) => {
      if (error) console.warn('[kalender] Ausblenden nicht gespeichert', error.message);
    });
  };
  const hide = () => {
    setHiddenLocal(true);
    remember(new Date().toISOString());
    toast(t('calendar.hidden'), {
      action: { label: t('calendar.undo'), onClick: () => { setHiddenLocal(false); remember(null); } },
    });
  };

  if (!status) return null;
  const relevant = status.state === 'not_connected' || status.state === 'expired' || status.state === 'it_pending';
  const showIt = itFlow && status.state !== 'connected' && status.state !== 'not_configured';
  if (!showIt && (!relevant || hidden)) return null;

  const title = status.state === 'expired'
    ? t('calendar.expiredShort')
    : t('calendar.dashTitle');
  const stand = status.state === 'it_pending'
    ? t('calendar.waitingItLine', { line: pendingLine(status, t) })
    : status.state === 'expired'
    ? t('calendar.expiredLead')
    : t('calendar.dashNotConnected');

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
          <OutlookKnopf cal={cal} returnPath={returnPath}
                        label={status.state === 'expired' ? t('calendar.reconnect') : status.state === 'it_pending' ? t('calendar.connectNow') : t('calendar.outlookCalendar')} />
          {status.state === 'not_connected' && <GoogleBaldKnopf />}
        </div>
        <button type="button" onClick={hide} aria-label={t('calendar.hide')}
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
  const { t } = useKalT();
  const { status } = cal;
  const returnPath = window.location.pathname;
  if (!status || status.state === 'not_configured') return null;
  if (itFlow && status.state !== 'connected') {
    return <div className={className}><ItPanel cal={cal} onClose={closeIt} compact /></div>;
  }

  const text = status.state === 'connected'
    ? `${t('calendar.connected')}${status.accountEmail ? ` · ${status.accountEmail}` : ''}`
    : status.state === 'it_pending'
    ? t('calendar.waitingItLine', { line: pendingLine(status, t) })
    : status.state === 'expired'
    ? t('calendar.expired')
    : t('calendar.checklistOpen');

  return (
    <div className={cn('flex flex-wrap items-center gap-2 text-sm', className)}>
      <span className="flex-1 text-muted-foreground">{text}</span>
      {status.state === 'it_pending' && <ResendButton cal={cal} status={status} />}
      {(status.state === 'not_connected' || status.state === 'expired' || status.state === 'it_pending') && (
        <OutlookKnopf cal={cal} returnPath={returnPath}
                      label={status.state === 'expired' ? t('calendar.reconnect') : status.state === 'it_pending' ? t('calendar.connectNow') : t('calendar.connectOutlook')} />
      )}
    </div>
  );
}

/** Ohne Microsoft-App bei Matchunt (z. B. lokal): beide Kacheln zu sehen, beide „Bald“. */
export function KalenderKachelnBald({ fuer = 'kunde' }: { fuer?: 'kunde' | 'headhunter' }) {
  return (
    <KalenderNs.Provider value={fuer === 'headhunter' ? 'recruiterKalender' : 'clientInterviews'}>
      <KachelnBald />
    </KalenderNs.Provider>
  );
}

function KachelnBald() {
  const { t } = useKalT();
  return (
    <div className="space-y-2">
      <AppKachel aus icon={<OutlookKalenderIcon className="h-6 w-6" />} name={t('calendar.outlookCalendar')} zeile={t('calendar.outlookAccount')}
                 rechts={<Badge variant="secondary" className="font-normal">{t('calendar.soon')}</Badge>} />
      <GoogleKachel />
    </div>
  );
}

/**
 * Kalender-Verbindung (Outlook) von Kunde oder Headhunter in drei Formen:
 * settings = Einstellungen › Kalender, dashboard = wegklickbare Zeile im
 * Dashboard, checklist = eine Zeile Stand mit nächstem Schritt.
 * Verarbeitet auch den Rücksprung aus Microsoft (?kalender=…).
 */
export function CalendarConnectCard({ variant = 'settings', className, fuer = 'kunde', eingebettet = false, ruecksprung }: {
  variant?: Variant; className?: string; fuer?: 'kunde' | 'headhunter';
  /** In einem eigenen Schritt (Terminseite): ohne Rahmen und ohne eigene Überschrift. */
  eingebettet?: boolean;
  /** Wohin Microsoft zurückspringt (Standard: diese Seite). */
  ruecksprung?: string;
}) {
  const cal = useCalendarStatus();
  const { itFlow, closeIt } = useCalendarReturn();

  const inhalt = variant === 'dashboard' ? <DashboardRow cal={cal} itFlow={itFlow} closeIt={closeIt} className={className} />
    : variant === 'checklist' ? <ChecklistLine cal={cal} itFlow={itFlow} closeIt={closeIt} className={className} />
    : eingebettet
    ? <div className={className}><SettingsBody cal={cal} itFlow={itFlow} closeIt={closeIt} ohneTitel ruecksprung={ruecksprung} /></div>
    : (
      <div className={cn('rounded-lg border border-border/60 p-4 sm:p-5', className)}>
        <SettingsBody cal={cal} itFlow={itFlow} closeIt={closeIt} ruecksprung={ruecksprung} />
      </div>
    );
  return <KalenderNs.Provider value={fuer === 'headhunter' ? 'recruiterKalender' : 'clientInterviews'}>{inhalt}</KalenderNs.Provider>;
}
