import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Circle, Loader2, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useActivityLogger } from '@/hooks/useCandidateActivityLog';
import { functionError } from '@/lib/functionError';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { notifyTasksChanged } from '@/hooks/useUnifiedTaskInbox';
import { contractApi, dateDe, euro, linkLine, timeDe } from '@/lib/contractApi';
import { ContractReportDialog } from './ContractReportDialog';
import { useTranslation } from 'react-i18next';
import { tFor } from '@/lib/localeFormat';

interface Props {
  submissionId: string | null;
  onClose: () => void;
  onDone?: () => void;
  /** Vertagen (Aufgabe „Vertrag nachfassen“), schließt das Fenster */
  onLater?: (until: Date) => void;
}

/** Ergebnis des Anrufs beim Kandidaten (29.10.2026). */
type CallOutcome = 'signed' | 'until' | 'questions' | 'unreachable' | 'new_contract';

/**
 * Vertrag begleiten (Headhunter, Paket 3): Stand der Unterschrift, Gegenprobe nach
 * der Kundenmeldung, selbst melden, abgesprungen. Fenster in der Mitte.
 */
export function ContractWindow({ submissionId, onClose, onDone, onLater }: Props) {
  const { t } = useTranslation('contracts');
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ['contract', submissionId], queryFn: () => contractApi.context(submissionId!), enabled: !!submissionId, staleTime: 10_000 });
  const [showReport, setShowReport] = useState(false);
  const [dropReason, setDropReason] = useState<string | null>(null);
  const [differs, setDiffers] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { logActivity } = useActivityLogger();
  // Nachfassen (29.10.2026): Anruf beim Kandidaten mit Ergebnis, Frage an den Kunden, Verlauf
  const [callOutcome, setCallOutcome] = useState<CallOutcome | null>(null);
  const [untilDate, setUntilDate] = useState('');
  const [questions, setQuestions] = useState('');
  const [clientText, setClientText] = useState<string | null>(null);
  const [history, setHistory] = useState<{ title: string; created_at: string }[]>([]);
  const [historyTick, setHistoryTick] = useState(0);
  useEffect(() => { setCallOutcome(null); setUntilDate(''); setQuestions(''); setClientText(null); }, [submissionId]);
  useEffect(() => {
    if (!submissionId) { setHistory([]); return; }
    supabase.from('candidate_activity_log').select('title, created_at').eq('related_submission_id', submissionId)
      .order('created_at', { ascending: false }).limit(4)
      .then(({ data }) => setHistory((data ?? []) as any));
  }, [submissionId, historyTick]);

  const ctx = q.data ?? null;
  const c = ctx?.contract ?? null;
  const first = (ctx?.candidateName ?? '').split(' ')[0] || t('common.theCandidate');
  const firma = ctx?.companyName ?? t('common.theClient');
  // Nachricht an den Kunden in seiner Sprache. Der Vertragskontext kennt weder Profilsprache noch Land: Deutsch (wie bisher)
  const clientLang = 'de';
  const tClient = (key: string, options?: Record<string, unknown>) => tFor(clientLang, 'contracts')(`clientText.${key}`, options) as string;
  const firstClient = (ctx?.candidateName ?? '').split(' ')[0] || (tFor(clientLang, 'contracts')('common.theCandidate') as string);

  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await work();
      toast.success(done);
      setDropReason(null); setDiffers(null);
      queryClient.invalidateQueries({ queryKey: ['contract', submissionId] });
      notifyTasksChanged();
      onDone?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setBusy(false);
    }
  };

  const status = c?.status ?? 'preparing';
  // Unterschrift über Matchunt: Kandidat bekommt seinen Link von uns, der Headhunter sieht, ob er geöffnet ist
  const embedded = ctx?.signing?.mode === 'embedded';
  const candLink = ctx?.signing?.candidate ?? null;
  // Gegenprobe: wer zuerst bestätigt, du oder der Kandidat (29.10.2026)
  const checkOpen = !!c && ['signed', 'final'].includes(status) && c.reportedRole === 'client' && !c.recruiterCheck && !c.candidateCheck;
  // Was der Kandidat von uns weiß und geantwortet hat
  const candAnswer = c?.candidateStatus === 'arrived' ? t('window.answerArrived', { date: dateDe(c.candidateStatusAt) })
    : c?.candidateStatus === 'missing' ? t('window.answerMissing', { date: dateDe(c.candidateStatusAt) }) : t('window.noAnswer');
  const canReport = ['preparing', 'sent_self', 'declined'].includes(status);
  const canDrop = ['preparing', 'sent_self', 'sent_digital', 'company_signed', 'declined'].includes(status);
  // Bis Tag 10 nichts zu tun (gleiche Regel wie „Wartet auf andere“, 28.10.2026)
  const anchor = status === 'sent_digital' && c?.sentAt ? c.sentAt : ctx?.offer?.acceptedAt ?? null;
  const followAt = anchor && ['preparing', 'sent_self', 'sent_digital'].includes(status) ? new Date(Date.parse(anchor) + 10 * 86_400_000) : null;
  const quietUntil = followAt && followAt.getTime() > Date.now() && c?.candidateStatus !== 'missing' ? followAt.toISOString() : null;
  // Nachfassen: offen, solange nicht unterschrieben, abgesprungen oder gemeldet
  const followOpen = ctx?.role === 'recruiter' && ['preparing', 'sent_self', 'sent_digital', 'company_signed', 'declined'].includes(status);
  // DocuSign nach der Firma: die Unterschrift meldet DocuSign selbst, den Kunden zu fragen bringt nichts
  const askClient = followOpen && status !== 'company_signed';
  const defaultClientText = status === 'preparing' ? tClient('preparing', { first: firstClient })
    : status === 'sent_self' ? tClient('sentSelf', { first: firstClient })
      : status === 'sent_digital' ? tClient('sentDigital', { first: firstClient })
        : c?.declineReason ? tClient('declinedReason', { first: firstClient, reason: c.declineReason }) : tClient('declined', { first: firstClient });
  const shownClientText = clientText ?? defaultClientText;
  const logCall = async (reached: boolean, title: string, extra: Record<string, unknown> = {}, note?: string) => {
    if (!ctx) return;
    await logActivity(ctx.candidateId, 'call', title, note, { reached, task_category: 'contract_followup', ...extra }, ctx.submissionId);
    setHistoryTick(t => t + 1);
    notifyTasksChanged();
    onDone?.();
  };
  const pickCall = async (o: CallOutcome) => {
    setCallOutcome(o);
    if (o === 'signed') { if (canReport) setShowReport(true); else await logCall(true, `Erreicht: ${first} hat unterschrieben`, { outcome: 'signed' }); return; }
    // Titel im Aktivitätslog: gespeichert, bleiben deutsch
    if (o === 'unreachable') { await logCall(false, 'Nicht erreicht'); toast.success(t('window.toast.unreachable')); return; }
    if (o === 'new_contract') {
      await logCall(true, 'Erreicht: neuer Vertrag nötig', { outcome: 'new_contract' });
      toast.success(t('window.toast.newContract'));
    }
  };
  const saveUntil = async () => {
    if (!untilDate) return;
    await logCall(true, `Erreicht: unterschreibt bis ${new Date(`${untilDate}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, { outcome: 'until', until: untilDate });
    toast.success(t('window.toast.until', { date: dateDe(untilDate) }));
  };
  const saveQuestions = async () => {
    const q = questions.trim();
    if (!q) return;
    await logCall(true, 'Erreicht: hat Fragen zum Vertrag', { outcome: 'questions' }, q);
    setClientText(tClient('questions', { first: firstClient, questions: q }));
    toast.success(t('window.toast.questions'));
  };
  const askTheClient = async () => {
    if (!ctx) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('recruiter-notify', { body: { action: 'client_nudge', submissionId: ctx.submissionId, text: shownClientText, anlass: 'contract', lang: clientLang } });
    const failure = await functionError(error, data);
    setBusy(false);
    if (failure) { toast.error(failure); return; }
    toast.success(t('window.toast.asked'));
    setHistoryTick(t => t + 1);
    notifyTasksChanged();
    onDone?.();
  };
  const values = c ? [
    c.salary ? (c.variable ? t('window.valuesVariable', { salary: euro(c.salary), variable: euro(c.variable) }) : t('window.values', { salary: euro(c.salary) })) : null,
    c.startDate ? t('window.valuesStart', { date: dateDe(c.startDate) }) : null,
  ].filter(Boolean).join(' · ') : '';
  const step = (done: boolean, label: string, when?: string | null) => (
    <li className="flex items-center gap-2">
      {done ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
      <span className={cn(!done && 'text-muted-foreground')}>{label}</span>
      {when && <span className="text-xs text-muted-foreground">{when}</span>}
    </li>
  );

  return (
    <Dialog open={!!submissionId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        {!ctx ? (
          <>
            <DialogHeader><DialogTitle>{t('window.title')}</DialogTitle><DialogDescription>{t('common.loading')}</DialogDescription></DialogHeader>
            {q.error ? <p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : t('common.loadError')}</p> : <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </>
        ) : (
          <>
            <DialogHeader className="text-left">
              <DialogTitle>{t(checkOpen ? 'window.headingCheck' : 'window.headingFollow', { name: ctx.candidateName })}</DialogTitle>
              <DialogDescription>{firma} · {ctx.jobTitle}</DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
              <ul className="space-y-1">
                {step(true, t('window.stepAccepted'), ctx.offer?.acceptedAt ? dateDe(ctx.offer.acceptedAt) : null)}
                {c?.way === 'digital' || ['sent_digital', 'company_signed'].includes(status) ? (
                  <>
                    {step(!!c?.sentAt, embedded ? t('window.stepUploaded') : t('window.stepDocuSign'), timeDe(c?.sentAt))}
                    {step(!!c?.companySignedAt, t('window.stepCompanySigned', { company: firma }), timeDe(c?.companySignedAt))}
                    {step(!!c?.candidateSignedAt || status === 'final', t('window.stepCandidateSigns', { first }),
                      c?.candidateSignedAt ? timeDe(c.candidateSignedAt) : embedded && status === 'company_signed' ? linkLine(candLink, null) : null)}
                  </>
                ) : (
                  <>
                    {step(status !== 'preparing', status === 'preparing' ? t('window.stepPreparing', { company: firma }) : c?.sentAt ? t('window.stepSentSelfOn', { company: firma, date: dateDe(c.sentAt) }) : t('window.stepSentSelf', { company: firma }))}
                    {(c?.candidateInformedAt || c?.candidateStatus) && step(c?.candidateStatus === 'arrived',
                      c?.candidateInformedAt ? t('window.stepInformed', { first, date: dateDe(c.candidateInformedAt), answer: candAnswer }) : t('window.stepCandidateAnswer', { first, answer: candAnswer }))}
                  </>
                )}
                {status === 'reported' && step(false, c?.reportedRole === 'candidate'
                  ? t('window.reportedByCandidate', { first, date: dateDe(c?.signedOn), company: firma })
                  : t('window.reportedByYou', { date: dateDe(c?.signedOn), company: firma }))}
                {['signed', 'final'].includes(status) && step(true, t('window.signedOn', { date: dateDe(c?.signedOn) }), values)}
                {['signed', 'final'].includes(status) && c?.recruiterCheck === 'ok' && step(true, t('window.confirmedByYou'))}
                {['signed', 'final'].includes(status) && c?.recruiterCheck === 'differs' && step(true, t('window.differsReported', { note: c.recruiterCheckNote ?? '' }))}
                {['signed', 'final'].includes(status) && c?.candidateCheck === 'ok' && step(true, t('window.confirmedByCandidate', { first }), dateDe(c.candidateCheckedAt))}
                {['signed', 'final'].includes(status) && c?.candidateCheck === 'differs' && step(true, c.candidateCheckNote ? t('window.candidateDiffersNote', { first, note: c.candidateCheckNote }) : t('window.candidateDiffers', { first }))}
              </ul>
              {quietUntil && <p className="mt-2 text-xs text-emerald-600">{t('window.quietUntil', { date: dateDe(quietUntil) })}</p>}
              {c?.candidateStatus === 'missing' && ['preparing', 'sent_self'].includes(status) && (
                <p className="mt-2 text-amber-700 dark:text-amber-400">{t('window.missing', { first, company: firma })}</p>
              )}
              {status === 'declined' && <p className="mt-2 text-amber-700 dark:text-amber-400">{c?.declineReason ? t('window.declinedReason', { reason: c.declineReason }) : t('window.declined')}</p>}
              {status === 'dropped' && <p className="mt-2 text-muted-foreground">{c?.dropReason ? t('window.droppedReason', { first, reason: c.dropReason }) : t('window.dropped', { first })}</p>}
              {['sent_digital', 'company_signed'].includes(status) && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {embedded
                    ? (status === 'company_signed'
                      ? `${t('window.linkByMatchunt', { first })}${candLink && !candLink.openedAt ? t('window.linkNotOpened', { first }) : ''}`
                      : t('window.companyFirst', { company: firma, first }))
                    : t('window.docuSignReports', { first })}
                </p>
              )}
            </div>

            {checkOpen && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3 text-sm">
                <p className="font-medium">{t('window.checkTitle', { company: firma, first, date: dateDe(c!.signedOn) })}</p>
                <p className="mt-0.5 text-muted-foreground">{t('window.checkText', { values, first })}</p>
                {differs !== null ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Input value={differs} onChange={(e) => setDiffers(e.target.value)} placeholder={t('window.differsPlaceholder')} className="h-8 min-w-[16rem] flex-1" aria-label={t('window.differsLabel')} />
                    <Button size="sm" disabled={busy || !differs.trim()} onClick={() => run(() => contractApi.check(submissionId!, 'differs', differs.trim()), t('window.differsSent'))}>{t('window.send')}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDiffers(null)}>{t('common.cancel')}</Button>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" disabled={busy} onClick={() => run(() => contractApi.check(submissionId!, 'ok'), t('window.confirmed'))}>{t('window.fits')}</Button>
                    <Button size="sm" variant="outline" onClick={() => setDiffers('')}>{t('window.differs')}</Button>
                  </div>
                )}
              </div>
            )}

            {followOpen && (
              <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('window.followUp')}</p>
                <div className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-medium text-primary-foreground">1</span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{t('window.atCandidate', { first })}</span>
                      {ctx.candidatePhone && <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" asChild><a href={`tel:${ctx.candidatePhone}`}><Phone className="h-3 w-3" />{t('window.call', { first })}</a></Button>}
                    </div>
                    <p className="text-xs text-muted-foreground">{t('window.whatSays', { first })}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(status === 'declined'
                        ? ['new_contract'] as CallOutcome[]
                        : ['signed', 'until', 'questions', 'unreachable'] as CallOutcome[]
                      ).map((k) => (
                        <Button key={k} size="sm" variant={callOutcome === k ? 'default' : 'outline'} className="h-7 text-xs" disabled={busy} onClick={() => pickCall(k)}>{t(`window.outcomes.${k}`)}</Button>
                      ))}
                      {canDrop && <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => setDropReason('')}>{t('window.dropped2')}</Button>}
                    </div>
                    {callOutcome === 'signed' && !canReport && <p className="text-xs text-muted-foreground">{t('window.docuSignSelf', { first })}</p>}
                    {callOutcome === 'until' && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input type="date" value={untilDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setUntilDate(e.target.value)} className="h-8 w-40" aria-label={t('window.untilLabel')} />
                        <Button size="sm" className="h-8 text-xs" disabled={busy || !untilDate} onClick={saveUntil}>{t('window.record')}</Button>
                        <span className="text-xs text-muted-foreground">{t('window.untilWaits')}</span>
                      </div>
                    )}
                    {callOutcome === 'questions' && (
                      <div className="space-y-1.5">
                        <Textarea value={questions} onChange={(e) => setQuestions(e.target.value)} rows={2} placeholder={t('window.questionsPlaceholder')} className="text-sm" />
                        <Button size="sm" className="h-8 text-xs" disabled={busy || !questions.trim()} onClick={saveQuestions}>{t('window.record')}</Button>
                      </div>
                    )}
                  </div>
                </div>
                {askClient && (
                  <div className="flex gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px] text-muted-foreground">2</span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <span className="font-medium">{t('window.atClient')}</span>
                      <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm italic text-foreground/90">{shownClientText}</p>
                      <Button size="sm" variant="outline" className="h-8 text-xs" disabled={busy} onClick={askTheClient}>{t('window.askClient')}</Button>
                      <p className="text-xs text-muted-foreground">{t('window.askClientInfo')}</p>
                    </div>
                  </div>
                )}
                {history.length > 0 && (
                  <ul className="space-y-0.5 border-t border-border/60 pt-2 text-xs">
                    {history.map((h, i) => <li key={i} className="flex gap-2"><span className="w-12 shrink-0 text-muted-foreground tabular-nums">{dateDe(h.created_at)}</span><span>{h.title}</span></li>)}
                  </ul>
                )}
              </div>
            )}

            {dropReason !== null && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Input value={dropReason} onChange={(e) => setDropReason(e.target.value)} placeholder={t('window.dropPlaceholder', { first })} className="h-8 min-w-[16rem] flex-1" aria-label={t('window.dropLabel')} />
                <Button size="sm" variant="destructive" disabled={busy || !dropReason.trim()} onClick={() => run(() => contractApi.drop(submissionId!, dropReason.trim()), t('window.dropSaved', { company: firma }))}>{t('window.reportDrop')}</Button>
                <Button size="sm" variant="ghost" onClick={() => setDropReason(null)}>{t('common.cancel')}</Button>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
              {ctx.candidatePhone && !followOpen && !['final', 'dropped'].includes(status) && (
                <Button size="sm" variant="outline" className="gap-1" asChild><a href={`tel:${ctx.candidatePhone}`}><Phone className="h-3.5 w-3.5" />{t('window.call', { first })}</a></Button>
              )}
              {onLater && followOpen && (
                <Button size="sm" variant="outline" onClick={() => { const d = new Date(Date.now() + 86_400_000); d.setHours(9, 0, 0, 0); onLater(d); }}>{t('window.tomorrowAgain')}</Button>
              )}
              {embedded && status === 'company_signed' && dropReason === null && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => contractApi.resendLink(submissionId!), t('window.linkResent', { first }))}>{t('window.resendLink', { first })}</Button>
              )}
              {canDrop && !followOpen && dropReason === null && <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setDropReason('')}>{t('window.hasDropped', { first })}</Button>}
              {canReport && <Button size="sm" onClick={() => setShowReport(true)}>{t('window.hasSigned', { first })}</Button>}
              {(!canReport || followOpen) && !checkOpen && <Button size="sm" variant="ghost" onClick={onClose}>{t('common.close')}</Button>}
            </div>
            {canReport && <p className="text-xs text-muted-foreground">{t('window.reportHint', { company: firma })}</p>}

            <ContractReportDialog ctx={ctx} open={showReport} onOpenChange={setShowReport} onDone={() => { notifyTasksChanged(); onDone?.(); }} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
