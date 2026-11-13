import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Circle, FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { contractApi, contractDataPdf, dateDe, download, euro, linkLine, timeDe } from '@/lib/contractApi';
import { ContractDialog } from './ContractDialog';
import { ContractReportDialog } from './ContractReportDialog';
import i18n from '@/i18n';
import { useTranslation } from 'react-i18next';

export type ContractOpen = 'contract' | 'digital' | 'melden' | 'werte' | 'verschickt' | 'abgesprungen' | 'unterschreiben' | 'unterzeichner' | null;

interface Props {
  submissionId: string;
  /** Fenster direkt öffnen (aus Liste, Erinnerungs-Mail ?vertrag=…) */
  openRequest?: ContractOpen;
  onOpenHandled?: () => void;
  /** Rücksprung aus der eigenen Unterschrift bei DocuSign (?vertrag=zurueck&event=…) */
  returnEvent?: string | null;
  onReturnHandled?: () => void;
  /** Im Aufgaben-Fenster: Bestätigung nach dem Rücksprung ist da (Fenster zeigt „Erledigt“) */
  onSignedBack?: (at: string | null) => void;
  /** Aus der Aufgabe „Ist er unterschrieben?“: zusätzlich „Noch nicht“ (fragt in einer Woche wieder) */
  onNotYet?: () => void;
}

/** Nach dem Rücksprung so lange nachfragen (DocuSign erlaubt eine Abfrage erst nach 20 s) */
const RETURN_CHECKS_MS = [0, 21_000, 60_000, 120_000];

/**
 * Arbeitsvertrag im Bewerberprofil (Kunde, Paket 3): nach der Zusage bis zur
 * verbindlichen Unterschrift, jeweils mit genau den passenden Schritten.
 */
export function ContractBox({ submissionId, openRequest = null, onOpenHandled, returnEvent = null, onReturnHandled, onSignedBack, onNotYet }: Props) {
  const { t: tt } = useTranslation('contracts');
  const t = (key: string, options?: Record<string, unknown>) => tt(`client.box.${key}`, options);
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ['contract', submissionId], queryFn: () => contractApi.context(submissionId), staleTime: 15_000 });
  const [showSend, setShowSend] = useState<null | 'digital' | 'self' | 'any'>(null);
  const [showReport, setShowReport] = useState<null | 'report' | 'values'>(null);
  const [dropReason, setDropReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Unterzeichner ändern: null = zu, sonst Eingabe
  const [signer, setSigner] = useState<null | { self: boolean; name: string; email: string }>(null);
  // Rücksprung aus DocuSign: checking → signed | late | left
  const [back, setBack] = useState<null | { state: 'checking' | 'signed' | 'late' | 'left'; at?: string | null }>(null);
  const timers = useRef<number[]>([]);

  const refetchAll = () => {
    queryClient.invalidateQueries({ queryKey: ['contract', submissionId] });
    queryClient.invalidateQueries({ queryKey: ['submission-state'] });
    queryClient.invalidateQueries({ queryKey: ['bewerber'] });
    queryClient.invalidateQueries({ queryKey: ['client-tasks'] });
  };

  /** „Jetzt unterschreiben“: weiter zu DocuSign im selben Fenster */
  const signNow = async () => {
    setBusy(true);
    try {
      const { url } = await contractApi.signUrl(submissionId);
      window.location.assign(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : i18n.t('contracts:client.box.signStartFailed'));
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!openRequest || !q.data) return;
    if (openRequest === 'contract') setShowSend('any');
    if (openRequest === 'digital') setShowSend('digital');
    if (openRequest === 'verschickt') setShowSend('self');
    if (openRequest === 'melden') setShowReport('report');
    if (openRequest === 'werte') setShowReport('values');
    if (openRequest === 'abgesprungen') setDropReason('');
    if (openRequest === 'unterschreiben') void signNow();
    if (openRequest === 'unterzeichner') setSigner({ self: false, name: '', email: '' });
    onOpenHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequest, q.data]);

  // Zurück von DocuSign: Bestätigung holen, wie beim Headhunter-Vertrag (0 / 21 / 60 / 120 s)
  useEffect(() => {
    if (!returnEvent) return;
    onReturnHandled?.();
    if (returnEvent !== 'signing_complete') {
      setBack({ state: 'left' });
      if (returnEvent === 'decline') void contractApi.refresh(submissionId, true).then(refetchAll).catch(() => undefined);
      return;
    }
    setBack({ state: 'checking' });
    let done = false;
    RETURN_CHECKS_MS.forEach((ms, i) => {
      timers.current.push(window.setTimeout(async () => {
        if (done) return;
        try {
          const r = await contractApi.refresh(submissionId, true);
          if (r.contract?.companySignedAt || !['sent_digital'].includes(r.contract?.status ?? '')) {
            done = true;
            setBack({ state: 'signed', at: r.contract?.companySignedAt ?? null });
            refetchAll();
            onSignedBack?.(r.contract?.companySignedAt ?? null);
          } else if (i === RETURN_CHECKS_MS.length - 1) {
            setBack({ state: 'late' });
          }
        } catch {
          if (i === RETURN_CHECKS_MS.length - 1) setBack({ state: 'late' });
        }
      }, ms));
    });
    // Kein Aufräumen hier: das Profil setzt returnEvent gleich zurück, die Nachfragen laufen weiter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnEvent]);
  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; }, []);

  const ctx = q.data ?? null;
  if (!ctx) return null;
  const c = ctx.contract;
  const first = ctx.candidateName.split(' ')[0];
  const hh = ctx.recruiterName ?? tt('client.yourRecruiter');
  const hhFirst = hh.split(' ')[0];

  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await work();
      toast.success(done);
      setDropReason(null);
      refetchAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tt('common.failed'));
    } finally {
      setBusy(false);
    }
  };
  const openPdf = async () => {
    try { const { url } = await contractApi.document(submissionId); window.open(url, '_blank', 'noopener'); }
    catch (e) { toast.error(e instanceof Error ? e.message : t('pdfUnavailable')); }
  };
  const dataPdf = async () => download(await contractDataPdf(ctx), `Vertragsdaten_${ctx.candidateName.replace(/\s+/g, '_')}.pdf`);
  const values = (v: { salary: number | null; variable: number | null; startDate: string | null }) =>
    [v.salary ? (v.variable ? tt('client.valuesVariable', { salary: euro(v.salary), variable: euro(v.variable) }) : euro(v.salary)) : null, v.startDate ? tt('client.valuesStart', { date: dateDe(v.startDate) }) : null].filter(Boolean).join(' · ');

  const status = c?.status ?? 'preparing';
  const notSent = status === 'preparing' && !c?.sentAt;
  const tone = status === 'final' || status === 'signed' ? 'ok' : status === 'reported' || status === 'declined' ? 'warn' : status === 'dropped' ? 'muted' : 'info';

  const dropRow = dropReason !== null ? (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Input value={dropReason} onChange={(e) => setDropReason(e.target.value)} placeholder={t('dropPlaceholder', { first })} className="h-8 min-w-[16rem] flex-1" aria-label={t('dropReason')} />
      <Button size="sm" variant="destructive" disabled={busy || !dropReason.trim()} onClick={() => run(() => contractApi.drop(submissionId, dropReason.trim()), t('dropSaved', { hh: hhFirst }))}>{t('reportDrop')}</Button>
      <Button size="sm" variant="ghost" onClick={() => setDropReason(null)}>{tt('common.cancel')}</Button>
    </div>
  ) : null;
  const dropButton = <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setDropReason('')}>{t('hasDropped', { first })}</Button>;

  const sig = ctx.signing ?? null;
  const embedded = sig?.mode === 'embedded' || c?.signingMode === 'embedded';
  const signerLabel = sig?.youSign ? tt('client.you') : (c?.companySignerName ?? tt('client.theCompany'));
  const changeSigner = async () => {
    if (!signer) return;
    setBusy(true);
    try {
      const r = await contractApi.changeSigner(submissionId, signer.self ? { signerSelf: true } : { signerName: signer.name.trim(), signerEmail: signer.email.trim() });
      refetchAll();
      if (r.signUrl) { toast.success(t('signerNew')); window.location.assign(r.signUrl); return; }
      toast.success(t('signerNewLink', { name: signer.name.trim() }));
      setSigner(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tt('common.failed'));
    } finally {
      setBusy(false);
    }
  };
  const signerRow = signer ? (
    <div className="mt-2 space-y-2 rounded-md border border-border/60 bg-background/60 p-2">
      <div className="inline-flex rounded-md border border-border/60 bg-muted/30 p-0.5">
        {[true, false].map((v) => (
          <button key={String(v)} type="button" onClick={() => setSigner({ ...signer, self: v })}
            className={cn('rounded px-3 py-1 text-xs', signer.self === v ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground')}>{v ? t('me') : t('someoneElse')}</button>
        ))}
      </div>
      {!signer.self && (
        <div className="flex flex-wrap gap-2">
          <Input value={signer.name} onChange={(e) => setSigner({ ...signer, name: e.target.value })} placeholder={t('name')} className="h-8 min-w-[10rem] flex-1" aria-label={t('name')} />
          <Input value={signer.email} onChange={(e) => setSigner({ ...signer, email: e.target.value })} placeholder={t('mail')} className="h-8 min-w-[12rem] flex-1" aria-label={t('mail')} />
        </div>
      )}
      <p className="text-xs text-muted-foreground">{signer.self ? t('signerSelfHint') : t('signerOtherHint')}{t('sameContract')}</p>
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || (!signer.self && (!signer.name.trim() || !/\S+@\S+\.\S+/.test(signer.email)))} onClick={changeSigner}>{signer.self ? t('changeSign') : t('changeLink')}</Button>
        <Button size="sm" variant="ghost" onClick={() => setSigner(null)}>{tt('common.cancel')}</Button>
      </div>
    </div>
  ) : null;

  const step = (done: boolean, label: string, when?: string | null) => (
    <li className="flex items-center gap-2">
      {done ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
      <span className={cn(!done && 'text-muted-foreground')}>{label}</span>
      {when && <span className="text-xs text-muted-foreground">{when}</span>}
    </li>
  );

  return (
    <div className={cn('mt-3 rounded-lg border p-3 text-sm',
      tone === 'ok' && 'border-emerald-500/30 bg-emerald-500/[0.06]',
      tone === 'warn' && 'border-amber-500/30 bg-amber-500/[0.06]',
      tone === 'info' && 'border-primary/20 bg-primary/[0.04]',
      tone === 'muted' && 'border-border bg-muted/30')}>

      {back?.state === 'signed' && status === 'company_signed' && (
        <p className="mb-2 rounded-md border border-emerald-500/30 bg-emerald-500/[0.06] px-2.5 py-1.5 text-emerald-800 dark:text-emerald-300">{back.at ? t('signedBackAt', { when: timeDe(back.at), first }) : t('signedBack', { first })}</p>
      )}

      {notSent && c?.way !== 'digital' && (
        <>
          <p className="font-medium">{ctx.offer ? t('acceptedValues', { first, values: values({ salary: ctx.offer.salary, variable: ctx.offer.variable, startDate: ctx.offer.startDate }) }) : t('accepted', { first })}</p>
          <p className="mt-0.5 text-muted-foreground">{t('sendNow', { first })}</p>
          {dropRow ?? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setShowSend('any')}>{t('sendContract')}</Button>
              <Button size="sm" variant="outline" onClick={() => setShowReport('report')}>{t('reportSigned')}</Button>
              {dropButton}
            </div>
          )}
        </>
      )}

      {notSent && c?.way === 'digital' && (
        <>
          <p className="font-medium">{t('digitalWithdrawn')}</p>
          <p className="mt-0.5 text-muted-foreground">{t('uploadAgain')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setShowSend('digital')}>{t('resend')}</Button>
            <Button size="sm" variant="outline" onClick={() => setShowSend('self')}>{t('sendSelf')}</Button>
          </div>
        </>
      )}

      {status === 'sent_self' && (
        <>
          <p className="font-medium">{t('sentSelf', { date: dateDe(c!.sentAt), first })} <span className="font-normal text-muted-foreground">{t('yourInfo')}</span></p>
          {c!.candidateStatus === 'missing' ? (
            <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2">
              <p className="font-medium">{t('notArrived', { first })} <span className="font-normal text-muted-foreground">{t('reportedOn', { date: dateDe(c!.candidateStatusAt) })}</span></p>
              <p className="mt-0.5 text-muted-foreground">{t('checkResend', { first })}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setShowSend('self')}>{t('resentOn')}</Button>
                <Button size="sm" variant="outline" onClick={() => setShowSend('digital')}>{t('viaMatchunt')}</Button>
              </div>
            </div>
          ) : (
            <p className="mt-0.5 text-muted-foreground">
              {c!.candidateStatus === 'arrived' ? t('arrived', { first, date: dateDe(c!.candidateStatusAt) }) : c!.candidateInformedAt ? t('informed', { first }) : ''}
              {t('hhFollows', { hh: hhFirst, first })}
            </p>
          )}
          {dropRow ?? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setShowReport('report')}>{t('reportSignature')}</Button>
              {onNotYet && <Button size="sm" variant="outline" onClick={onNotYet}>{t('notYet')}</Button>}
              <Button size="sm" variant="outline" className="gap-1" onClick={dataPdf}><FileDown className="h-3.5 w-3.5" />{t('dataPdf')}</Button>
              {dropButton}
            </div>
          )}
        </>
      )}

      {(status === 'sent_digital' || status === 'company_signed') && embedded && (
        <>
          <p className="font-medium">{t('signState')}</p>
          {back?.state === 'checking' && <p className="mt-1 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />{t('checking')}</p>}
          {back?.state === 'late' && <p className="mt-1 text-amber-700 dark:text-amber-400">{t('late')}</p>}
          {back?.state === 'left' && !c!.companySignedAt && <p className="mt-1 text-amber-700 dark:text-amber-400">{t('left')}</p>}
          <ul className="mt-1 space-y-1">
            {step(true, t('uploaded'), timeDe(c!.sentAt))}
            {c!.companySignedAt
              ? step(true, sig?.youSign ? t('youSignedApp') : t(sig?.companyViaApp ? 'signerSignedApp' : 'signerSigned', { signer: signerLabel }), timeDe(c!.companySignedAt))
              : step(false, sig?.youSign ? t('yourSignature') : t('signerFirst', { signer: signerLabel }), sig?.companyViaApp ? t('inMatchunt') : linkLine(sig?.company, sig?.companyEmail))}
            {c!.companySignedAt
              ? step(false, t('candidateSigns', { first }), linkLine(sig?.candidate, sig?.candidateEmail))
              : step(false, t('thenCandidate', { first }), t('getsLink'))}
          </ul>
          {signerRow ?? dropRow ?? (
            <div className="mt-2 flex flex-wrap gap-2">
              {status === 'sent_digital' && sig?.youSign && back?.state !== 'checking' && <Button size="sm" disabled={busy} onClick={signNow}>{back?.state === 'left' ? t('continueSign') : t('signNow')}</Button>}
              {status === 'sent_digital' && !sig?.companyViaApp && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => contractApi.resendLink(submissionId), t('linkResentSigner', { name: c!.companySignerName ?? tt('client.theSigner') }))}>{t('resendLink')}</Button>}
              {status === 'company_signed' && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => contractApi.resendLink(submissionId), t('linkResentSigner', { name: first }))}>{t('resendLinkTo', { first })}</Button>}
              {status === 'sent_digital' && <Button size="sm" variant="ghost" onClick={() => setSigner({ self: !sig?.youSign, name: '', email: '' })}>{t('changeSigner')}</Button>}
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => contractApi.refresh(submissionId), t('refreshed'))}>{t('refresh')}</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => contractApi.voidDigital(submissionId, true), t('voidSelf'))}>{t('sendSelfAfterAll')}</Button>
              {dropButton}
            </div>
          )}
          {ctx.digitalDemo && <p className="mt-2 text-xs text-muted-foreground">{t('demo')}</p>}
        </>
      )}

      {(status === 'sent_digital' || status === 'company_signed') && !embedded && (
        <>
          <p className="font-medium">{t('signState')}</p>
          <ul className="mt-1 space-y-1">
            {step(true, t('sentDocuSign'), timeDe(c!.sentAt))}
            {step(!!c!.companySignedAt, t(c!.companySignedAt ? 'signerSigned' : 'signerFirst', { signer: c!.companySignerName ?? tt('client.theCompany') }), timeDe(c!.companySignedAt))}
            {step(false, c!.companySignedAt ? t('notSignedNudge', { first, hh: hhFirst }) : t('thenSigns', { first }))}
          </ul>
          {!c!.companySignedAt && <p className="mt-1 text-xs text-muted-foreground">{t('noMail')}</p>}
          {signerRow ?? dropRow ?? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => contractApi.refresh(submissionId), t('refreshed'))}>{t('refresh')}</Button>
              {status === 'sent_digital' && <Button size="sm" variant="outline" onClick={() => setSigner({ self: true, name: '', email: '' })}>{t('changeSigner')}</Button>}
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => contractApi.voidDigital(submissionId, false), t('voidResend'))}>{t('withdrawResend')}</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => contractApi.voidDigital(submissionId, true), t('voidSelf'))}>{t('sendSelfAfterAll')}</Button>
              {dropButton}
            </div>
          )}
        </>
      )}

      {status === 'reported' && (
        <>
          <p className="font-medium">{c!.reportedRole === 'candidate' ? t('candidateReports', { first, date: dateDe(c!.signedOn) }) : t('someoneReports', { who: c!.reportedRole === 'admin' ? 'Matchunt' : (ctx.reporterName ?? hh), first, date: dateDe(c!.signedOn) })}</p>
          <p className="mt-0.5 text-muted-foreground">{c!.reportNote ? t('isItRightNote', { values: values(c!), note: c!.reportNote }) : t('isItRight', { values: values(c!) })}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => run(() => contractApi.confirm(submissionId, 'yes'), t('confirmed'))}>{t('yesRight')}</Button>
            <Button size="sm" variant="outline" onClick={() => setShowReport('values')}>{t('otherValues')}</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => contractApi.confirm(submissionId, 'not_yet'), t('hhInformed', { hh: hhFirst }))}>{t('notYet')}</Button>
          </div>
        </>
      )}

      {status === 'signed' && (
        <>
          <p className="font-medium">{t('reportedSignature', { date: dateDe(c!.signedOn), values: values(c!) })}</p>
          <p className="mt-0.5 text-muted-foreground">{t('undoUntil', { when: timeDe(c!.undoUntil) })}{c!.candidateCheck === 'ok' ? t('candidateConfirmed', { first }) : t('candidateGetsMail', { first, hh: hhFirst })}</p>
          <div className="mt-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => contractApi.undo(submissionId), t('undone'))}>{t('undo')}</Button></div>
        </>
      )}

      {status === 'final' && (
        <>
          <p className="font-medium">{t('finalTitle', { date: dateDe(c!.signedOn) })}</p>
          <p className="mt-0.5 text-muted-foreground">
            {values(c!)}{c!.way === 'digital' ? t('viaDocuSign') : ''}
            {c!.candidateCheck === 'ok' ? t('confirmedByCandidate', { first }) : c!.recruiterCheck === 'ok' ? t('confirmedByHh', { hh: hhFirst, first }) : ''}
          </p>
          {c!.hasSignedDocument && <div className="mt-2"><Button size="sm" variant="outline" className="gap-1" onClick={openPdf}><FileDown className="h-3.5 w-3.5" />{t('contractPdf')}</Button></div>}
        </>
      )}

      {status === 'declined' && (
        <>
          <p className="font-medium">{t('declinedTitle')}</p>
          <p className="mt-0.5 text-muted-foreground">{c!.declineReason ? tt('client.quote', { text: c!.declineReason }) : t('noReason')} {t('hhInformed', { hh: hhFirst })}</p>
          {dropRow ?? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setShowSend('digital')}>{t('adjustResend')}</Button>
              <Button size="sm" variant="outline" onClick={() => setShowSend('self')}>{t('sendSelf')}</Button>
              {dropButton}
            </div>
          )}
        </>
      )}

      {status === 'dropped' && (
        <>
          <p className="font-medium">{t('dropped', { first })}</p>
          <p className="mt-0.5 text-muted-foreground">{c!.dropReason ? tt('client.quote', { text: c!.dropReason }) : ''}</p>
          <div className="mt-2"><Button size="sm" variant="ghost" asChild><Link to="/dashboard/candidates">{t('otherApplicants')}</Link></Button></div>
        </>
      )}

      {busy && <Loader2 className="mt-2 h-4 w-4 animate-spin text-muted-foreground" />}

      <ContractDialog ctx={ctx} open={showSend !== null} onOpenChange={(o) => { if (!o) setShowSend(null); }} initialWay={showSend === 'any' ? null : showSend} />
      <ContractReportDialog ctx={ctx} open={showReport !== null} mode={showReport ?? 'report'} onOpenChange={(o) => { if (!o) setShowReport(null); }} />
    </div>
  );
}
