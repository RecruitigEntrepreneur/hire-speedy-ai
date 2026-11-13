import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { CheckCircle2, Clock, Link2Off, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clientLinkApi, fmtDayLong, fmtRange, fmtTime, type ClientLinkView } from '@/lib/interviewScheduling';
import { GermanTime, PublicInterviewShell, QuoteBlock, StatusIcon } from '@/components/interview/PublicInterviewShell';

/*
 * Bestätigung einer vom Kandidaten angefragten Zeit direkt aus der Kundenmail
 * (/interview/bestaetigen/:token). Ohne Anmeldung. Das Öffnen (peek) ändert
 * nichts, erst der Klick auf „Zeit bestätigen“ bucht; so lösen Link-Scanner in
 * Mailprogrammen keine Buchung aus.
 */

const OVERVIEW = '/dashboard/interviews';
const errorText = (err: unknown) =>
  err instanceof Error && err.message ? err.message : i18n.t('interviewResponse:common.error');
const endOf = (iso: string, minutes: number) => new Date(Date.parse(iso) + minutes * 60000).toISOString();

export default function ClientConfirmAlternative() {
  const { token = '' } = useParams<{ token: string }>();
  const { t } = useTranslation('interviewResponse');
  const [view, setView] = useState<ClientLinkView | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = t('client.docTitle');
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    setView(null);
    setLoadFailed(false);
    if (!token) {
      setLoadFailed(true);
      return;
    }
    clientLinkApi.peek(token)
      .then((v) => { if (!cancelled) setView(v); })
      .catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => { cancelled = true; };
  }, [token]);

  const confirm = async () => {
    setBusy(true);
    try {
      setView(await clientLinkApi.confirm(token));
    } catch (err) {
      toast.error(errorText(err));
      try {
        setView(await clientLinkApi.peek(token));
      } catch {
        // Die bisherige Ansicht bleibt stehen.
      }
    } finally {
      setBusy(false);
    }
  };

  if (!view && !loadFailed) {
    return (
      <PublicInterviewShell>
        <div className="flex items-center justify-center gap-2 pt-16 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-5 w-5 animate-spin" /> {t('client.loading')}
        </div>
      </PublicInterviewShell>
    );
  }

  if (loadFailed || !view || view.state === 'expired' || view.state === 'gone') {
    return (
      <PublicInterviewShell>
        <div className="space-y-4 pt-8 text-center">
          <StatusIcon icon={Link2Off} />
          <h1 className="text-xl font-semibold">{t('client.invalidTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('client.invalidBody')}</p>
          <Button asChild variant="outline" size="lg" className="h-12 w-full">
            <Link to={OVERVIEW}>{t('client.toOverview')}</Link>
          </Button>
        </div>
      </PublicInterviewShell>
    );
  }

  if (view.state === 'confirmed') {
    const at = view.scheduledAt ?? view.requestedStart;
    return (
      <PublicInterviewShell>
        <div className="space-y-6 pt-4">
          <div className="space-y-3 text-center">
            <StatusIcon icon={CheckCircle2} tone="success" />
            <h1 className="text-2xl font-semibold tracking-tight">{t('client.confirmedTitle')}</h1>
            <p className="text-sm text-muted-foreground">{t('client.confirmedBody')}</p>
          </div>
          {at && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">{view.candidateLabel} · {view.jobTitle}</p>
              <p className="text-lg font-semibold">{fmtDayLong(at)}</p>
              <p className="text-sm">
                {t('common.timeSpan', { from: fmtTime(at), to: fmtTime(endOf(at, view.durationMinutes)) })}{' '}
                <GermanTime isos={[at]} className="text-muted-foreground" />
              </p>
            </div>
          )}
          <Button asChild size="lg" className="h-12 w-full">
            <Link to={OVERVIEW}>{t('client.toMatchunt')}</Link>
          </Button>
        </div>
      </PublicInterviewShell>
    );
  }

  return (
    <PublicInterviewShell>
      <div className="space-y-6">
        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> {t('client.request')}
            </p>
            <h1 className="text-xl font-semibold leading-tight">{t('client.asksOther', { name: view.candidateLabel })}</h1>
            <p className="text-sm text-muted-foreground">{view.jobTitle}</p>
          </div>
          {view.requestedStart && (
            <div className="rounded-lg bg-secondary/60 p-3">
              <p className="text-base font-semibold">{fmtRange(view.requestedStart, view.durationMinutes)}</p>
              <GermanTime isos={[view.requestedStart]} className="text-xs text-muted-foreground" />
            </div>
          )}
          {view.candidateMessage && <QuoteBlock label={t('client.messageFrom', { name: view.candidateLabel })} text={view.candidateMessage} />}
        </div>

        <div className="space-y-3">
          <Button size="lg" className="h-12 w-full" disabled={busy} onClick={confirm}>
            {busy && <Loader2 className="animate-spin" />}
            {t('client.confirm')}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {t('client.confirmHint')}
          </p>
          <Button asChild variant="outline" size="lg" className="h-12 w-full">
            <Link to={OVERVIEW}>{t('client.proposeOther')}</Link>
          </Button>
          <p className="text-center text-xs text-muted-foreground">{t('client.loginHint')}</p>
        </div>
      </div>
    </PublicInterviewShell>
  );
}
