import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, Clock, FileDown, FileSignature, Loader2, Mail, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublicInterviewShell, StatusIcon } from '@/components/interview/PublicInterviewShell';
import { dateDe, euro, signLinkApi, timeDe, type SignPageView } from '@/lib/contractApi';

/*
 * Unterschrift über Matchunt (23.10.2026): /unterschrift/:token, ohne Anmeldung.
 * Der persönliche Link aus der Matchunt-Mail ist der Zugang. Für den Unterzeichner
 * der Firma ohne Konto und für den Kandidaten. „Ansehen und unterschreiben“ führt
 * zu DocuSign; danach springt DocuSign mit ?zurueck=1&event=… hierher zurück.
 * Der Server liefert eine fertige Sicht; die Seite rechnet nichts aus.
 */

/** Nach dem Rücksprung nachfragen (DocuSign erlaubt eine Abfrage erst nach 20 s) */
const RETURN_CHECKS_MS = [0, 21_000, 60_000, 120_000];

export default function SignLinkPage() {
  const { token = '' } = useParams<{ token: string }>();
  const { t } = useTranslation('signing');
  const [params] = useSearchParams();
  const returned = params.get('zurueck') === '1';
  const event = params.get('event');

  const [view, setView] = useState<SignPageView | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  // checking = Bestätigung wird geholt, late = DocuSign meldet sich noch nicht, left = ohne Unterschrift zurück
  const [back, setBack] = useState<null | 'checking' | 'late' | 'left'>(returned ? (event === 'signing_complete' ? 'checking' : 'left') : null);
  const [renewedTo, setRenewedTo] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => { document.title = t('sign.docTitle'); }, [t]);

  useEffect(() => {
    let cancelled = false;
    // Adresse ohne ?zurueck=…, damit ein Neuladen nicht erneut „zurück“ auswertet
    if (returned) window.history.replaceState(null, '', `/unterschrift/${token}`);
    if (returned && event === 'signing_complete') {
      let done = false;
      RETURN_CHECKS_MS.forEach((ms, i) => {
        timers.current.push(window.setTimeout(async () => {
          if (done || cancelled) return;
          try {
            const v = await signLinkApi.returned(token);
            setView(v);
            if (v.state !== 'ready') { done = true; setBack(null); }
            else if (i === RETURN_CHECKS_MS.length - 1) setBack('late');
          } catch {
            if (i === RETURN_CHECKS_MS.length - 1) setBack('late');
          }
        }, ms));
      });
    } else {
      // Abgelehnt in DocuSign: Stand holen, damit „abgelehnt“ sofort sichtbar ist
      (returned && event === 'decline' ? signLinkApi.returned(token) : signLinkApi.peek(token))
        .then((v) => { if (!cancelled) setView(v); })
        .catch(() => { if (!cancelled) setFailed(true); });
    }
    return () => { cancelled = true; timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const start = async () => {
    setBusy(true);
    try {
      const { url } = await signLinkApi.start(token);
      window.location.assign(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('sign.startFailed'));
      setBusy(false);
    }
  };
  const renew = async () => {
    setBusy(true);
    try { const r = await signLinkApi.renew(token); setRenewedTo(r.email); }
    catch (e) { toast.error(e instanceof Error ? e.message : t('sign.failed')); }
    finally { setBusy(false); }
  };
  const download = async () => {
    try { const { url } = await signLinkApi.document(token); window.open(url, '_blank', 'noopener'); }
    catch (e) { toast.error(e instanceof Error ? e.message : t('sign.copyFailed')); }
  };

  if (failed) {
    return <Shell><Status icon={AlertCircle} tone="warning" title={t('common.errorTitle')}>{t('common.errorBody')}</Status></Shell>;
  }
  if (!view || (back === 'checking' && (!view || view.state === 'ready'))) {
    return (
      <Shell>
        <div className="flex flex-col items-center py-16 text-center text-sm text-muted-foreground">
          <Loader2 className="mb-3 h-6 w-6 animate-spin" />
          {back === 'checking' ? t('sign.checking') : t('common.loading')}
        </div>
      </Shell>
    );
  }

  const v = view;
  const company = v.role === 'company';
  const candidateFirst = (v.candidateName ?? '').split(' ')[0] || t('sign.theCandidate');
  const facts = (
    <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1.5 rounded-xl border border-border bg-card p-4 text-sm">
      {company && <><dt className="text-muted-foreground">{t('sign.employee')}</dt><dd>{v.candidateName}</dd></>}
      {!company && <><dt className="text-muted-foreground">{t('sign.employer')}</dt><dd>{v.companyName}</dd></>}
      <dt className="text-muted-foreground">{t('common.job')}</dt><dd>{v.jobTitle}</dd>
      {v.startDate && <><dt className="text-muted-foreground">{t('sign.begin')}</dt><dd>{dateDe(v.startDate)}</dd></>}
      {v.salary ? <><dt className="text-muted-foreground">{t('common.salary')}</dt><dd>{v.variable ? t('common.salaryValueVariable', { amount: euro(v.salary), variable: euro(v.variable) }) : t('common.salaryValue', { amount: euro(v.salary) })}</dd></> : null}
      {company && v.uploadedBy && <><dt className="text-muted-foreground">{t('sign.uploadedBy')}</dt><dd>{v.uploadedBy}</dd></>}
    </dl>
  );
  const demo = v.demo ? <p className="text-xs text-muted-foreground">{t('sign.demo')}</p> : null;

  switch (v.state) {
    case 'invalid':
      return <Shell><Status icon={XCircle} tone="destructive" title={t('common.invalidTitle')}>{t('sign.invalidBody')}</Status></Shell>;
    case 'withdrawn':
      return <Shell><Status icon={AlertCircle} tone="warning" title={t('sign.withdrawnTitle')}>{company ? t('sign.withdrawnCompany') : v.recruiterName ? t('sign.withdrawnCandidateNamed', { company: v.companyName, name: v.recruiterName }) : t('sign.withdrawnCandidate', { company: v.companyName })}</Status></Shell>;
    case 'revoked':
      return <Shell><Status icon={Mail} tone="muted" title={t('sign.revokedTitle')}>{t('sign.revokedBody')}</Status></Shell>;
    case 'expired':
      return (
        <Shell>
          <Status icon={Clock} tone="warning" title={t('sign.expiredTitle')}>
            {renewedTo ? t('sign.renewedTo', { email: renewedTo }) : t('sign.expiredBody')}
          </Status>
          {!renewedTo && <Button className="w-full" disabled={busy} onClick={renew}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{t('sign.renew', { email: v.email })}</Button>}
        </Shell>
      );
    case 'not_yet':
      return (
        <Shell>
          <Status icon={Clock} tone="muted" title={t('sign.notYetTitle')}>{t('sign.notYetBody', { company: v.companyName })}</Status>
          {facts}
        </Shell>
      );
    case 'signed':
      return (
        <Shell>
          <Status icon={CheckCircle2} tone="success" title={company ? t('sign.signedCompanyTitle') : t('sign.signedCandidateTitle')}>
            {company
              ? t('sign.signedCompanyBody', { when: timeDe(v.companySignedAt), company: v.companyName, name: candidateFirst })
              : t('sign.signedCandidateBody', { when: timeDe(v.candidateSignedAt) })}
          </Status>
          {facts}
        </Shell>
      );
    case 'done':
      return (
        <Shell>
          <Status icon={CheckCircle2} tone="success" title={company ? t('sign.doneCompanyTitle') : t('sign.doneCandidateTitle')}>
            {company ? t('sign.doneCompanyBody', { name: v.candidateName }) : v.startDate ? t('sign.doneCandidateBodyStart', { date: dateDe(v.startDate) }) : t('sign.doneCandidateBody')}
          </Status>
          {facts}
          {v.canDownload && <Button variant="outline" className="w-full gap-1.5" onClick={download}><FileDown className="h-4 w-4" />{t('sign.download')}</Button>}
          {!v.canDownload && !company && <p className="text-xs text-muted-foreground">{t('sign.copyByMail')}</p>}
        </Shell>
      );
    case 'ready':
    default:
      return (
        <Shell>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{company ? t('sign.forCompany', { company: v.companyName }) : t('sign.yourContract')}</p>
            <h1 className="text-xl font-semibold">{company ? t('sign.contractFor', { name: v.candidateName }) : t('sign.contractWith', { company: v.companyName })}</h1>
            <p className="text-sm text-muted-foreground">
              {company
                ? t('sign.greetingCompany', { name: v.signerName, company: v.companyName, candidate: candidateFirst })
                : v.companySignedAt
                  ? t('sign.greetingCandidateDate', { name: (v.signerName ?? '').split(' ')[0], company: v.companyName, date: dateDe(v.companySignedAt) })
                  : t('sign.greetingCandidate', { name: (v.signerName ?? '').split(' ')[0], company: v.companyName })}
            </p>
          </div>
          {back === 'left' && <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">{t('sign.left')}</p>}
          {back === 'late' && <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">{t('sign.late')}</p>}
          {facts}
          <Button className="w-full gap-1.5" size="lg" disabled={busy} onClick={start}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />}
            {back === 'left' ? t('sign.continue') : t('sign.viewAndSign')}
          </Button>
          <p className="text-xs text-muted-foreground">{t('sign.docusignHint')}</p>
          {!company && v.recruiterName && <p className="text-xs text-muted-foreground">{t('sign.questions', { name: v.recruiterName })}</p>}
          {demo}
        </Shell>
      );
  }
}

function Shell({ children }: { children: ReactNode }) {
  return <PublicInterviewShell><div className="space-y-4">{children}</div></PublicInterviewShell>;
}

function Status({ icon, tone, title, children }: { icon: Parameters<typeof StatusIcon>[0]['icon']; tone: 'success' | 'muted' | 'warning' | 'destructive'; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <StatusIcon icon={icon} tone={tone} />
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
