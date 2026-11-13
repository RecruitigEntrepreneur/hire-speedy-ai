import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { contractApi, dateDe, type ContractContext } from '@/lib/contractApi';
import { clientTasksApi, taskHref, useClientTasks, waitingLabel, type ClientTask } from '@/lib/clientTasksApi';
import { ContractBox, type ContractOpen } from './ContractBox';
import { ContractDialog, ContractSteps } from './ContractDialog';
import { ContractReportDialog } from './ContractReportDialog';
import i18n from '@/i18n';
import { useTranslation } from 'react-i18next';

const tk = (key: string, options?: Record<string, unknown>): string => i18n.t(`contracts:client.task.${key}`, options);

/**
 * Aufgaben-Fenster „Arbeitsvertrag“ (24.10.2026, „eine Aufgabe, ein Fenster“): öffnet sich aus
 * der Dashboard-Leiste, der Aufgaben-Kachel, der Seite „Aufgaben“ und der Karte im Profil.
 * Noch nicht verschickt: Schritte Weg → Vertrag → Fertig (das Hochladen inline). Danach: Stand
 * und die passenden Schritte (unterschreiben, Link erneut senden, Unterzeichner ändern …).
 * Ersetzt das allgemeine Aufgaben-Fenster und das zweite Vertrags-Fenster.
 */

interface Props {
  submissionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Direkt in einen Schritt (aus Mail-Links, Aufgaben-Antworten) */
  intent?: ContractOpen;
  /** Rücksprung aus der eigenen Unterschrift (?vertrag=zurueck&event=…) */
  returnEvent?: string | null;
  /** Die Aufgabe, aus der das Fenster kam (für „Erledigt“ und „Noch nicht“) */
  task?: ClientTask | null;
}

const DAY = 86_400_000;
const daysUntil = (iso: string | null | undefined) => {
  if (!iso) return null;
  const d = Math.round((Date.parse(`${iso.slice(0, 10)}T12:00:00`) - Date.parse(`${new Date().toLocaleDateString('sv-SE')}T12:00:00`)) / DAY);
  return d === 0 ? tk('today') : d === 1 ? tk('tomorrow') : d > 1 ? tk('inDays', { count: d }) : null;
};

function titleFor(ctx: ContractContext): string {
  const first = ctx.candidateName.split(' ')[0];
  const c = ctx.contract;
  const sig = ctx.signing;
  switch (c?.status) {
    case 'sent_self': return tk('titles.sent_self', { first });
    case 'sent_digital': return sig?.youSign ? tk('titles.youSignFirst') : tk('titles.signerSigns', { signer: c.companySignerName ?? i18n.t('contracts:client.theCompany') });
    case 'company_signed': return tk('titles.company_signed', { first });
    case 'reported': return tk('titles.reported');
    case 'signed': return tk('titles.signed');
    case 'final': return tk('titles.final');
    case 'dropped': return tk('titles.dropped', { first });
    case 'declined': return tk('titles.declined', { first });
    default: return tk('titles.send', { first });
  }
}

export function ContractTaskWindow({ submissionId, open, onOpenChange, intent = null, returnEvent = null, task = null }: Props) {
  const { t } = useTranslation('contracts');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ['contract', submissionId], queryFn: () => contractApi.context(submissionId!), enabled: open && !!submissionId, staleTime: 10_000 });
  const tasks = useClientTasks();
  const [done, setDone] = useState<string | null>(null);
  const [report, setReport] = useState(false);
  const [dropReason, setDropReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDone(null);
    setReport(intent === 'melden');
    setDropReason(intent === 'abgesprungen' ? '' : null);
  }, [open, intent, submissionId]);

  const ctx = q.data ?? null;
  const c = ctx?.contract ?? null;
  const first = (ctx?.candidateName ?? '').split(' ')[0] || t('client.theCandidate');
  const status = c?.status ?? 'preparing';
  // Noch zu verschicken (auch nach Zurückziehen oder Ablehnen): Schritte im Fenster
  const sendable = !!ctx?.offer && (!c || (status === 'preparing' && !c.sentAt) || status === 'declined') && !['verschickt'].includes(intent ?? '');
  const sendSelfFirst = intent === 'verschickt' && (!c || status === 'preparing');

  const refetchAll = () => {
    queryClient.invalidateQueries({ queryKey: ['contract', submissionId] });
    queryClient.invalidateQueries({ queryKey: ['submission-state'] });
    queryClient.invalidateQueries({ queryKey: ['bewerber'] });
    queryClient.invalidateQueries({ queryKey: ['client-tasks'] });
  };
  const finish = (text: string) => { setDone(text); refetchAll(); };

  // „Nächste Aufgabe“: die erste, die nicht zu diesem Vertrag gehört
  const next = (tasks.data?.tasks ?? []).find((x) => x.submissionId !== submissionId) ?? null;

  const drop = async () => {
    if (!submissionId || !dropReason?.trim()) return;
    setBusy(true);
    try { await contractApi.drop(submissionId, dropReason.trim()); finish(tk('dropSaved', { hh: ctx?.recruiterName?.split(' ')[0] ?? t('client.yourRecruiter') })); }
    catch (e) { toast.error(e instanceof Error ? e.message : t('common.failed')); }
    finally { setBusy(false); }
  };
  const notYet = async () => {
    if (!task) return;
    await clientTasksApi.logDone(task, `${task.title}: Noch nicht`).catch(() => undefined);
    finish(tk('notYetSaved'));
  };

  const facts = ctx ? [
    ctx.offer?.acceptedAt ? tk('acceptedOn', { date: dateDe(ctx.offer.acceptedAt) }) : null,
    ctx.offer?.startDate ? (daysUntil(ctx.offer.startDate) ? tk('startOnIn', { date: dateDe(ctx.offer.startDate), when: daysUntil(ctx.offer.startDate) }) : tk('startOn', { date: dateDe(ctx.offer.startDate) })) : null,
    ctx.recruiterName ? tk('keepsContact', { hh: ctx.recruiterName.split(' ')[0] }) : null,
  ].filter(Boolean).join(' · ') : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        {!ctx ? (
          <>
            <DialogHeader className="text-left"><DialogTitle>{tk('title')}</DialogTitle><DialogDescription>{t('common.loading')}</DialogDescription></DialogHeader>
            {q.error ? <p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : t('common.loadError')}</p> : <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </>
        ) : done ? (
          <>
            <DialogHeader className="text-left"><DialogTitle>{tk('forFirst', { first })}</DialogTitle><DialogDescription>{ctx.jobTitle}</DialogDescription></DialogHeader>
            {sendable || status !== 'final' ? <ContractSteps at={3} /> : null}
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <div><p className="font-medium">{tk('done')}</p><p className="text-muted-foreground">{done}</p></div>
            </div>
            {next ? (
              <div className="rounded-lg border p-3 text-sm">
                <p className="text-xs text-muted-foreground">{tk('nextTask')}</p>
                <p className="font-medium">{next.title}</p>
                <p className="text-xs text-muted-foreground">{next.who}{next.jobTitle ? ` · ${next.jobTitle}` : ''} · {waitingLabel(next)}</p>
              </div>
            ) : <p className="text-sm text-muted-foreground">{tk('allDone')}</p>}
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
              {next && <Button onClick={() => { onOpenChange(false); navigate(taskHref(next)); }}>{tk('next')}</Button>}
            </div>
          </>
        ) : (
          <>
            <DialogHeader className="text-left">
              <DialogTitle>{titleFor(ctx)}</DialogTitle>
              <DialogDescription>{facts || ctx.jobTitle}</DialogDescription>
            </DialogHeader>

            {status === 'declined' && sendable && (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-sm">{c?.declineReason ? tk('declinedReason', { reason: c.declineReason }) : tk('declined')}</p>
            )}
            {sendable && ctx.candidateNotice && ctx.candidateNotice !== 'sofort' && (
              <p className="text-xs text-muted-foreground">{tk('notice', { first, notice: ctx.candidateNotice })}</p>
            )}

            {(sendable || sendSelfFirst) ? (
              dropReason !== null ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Input value={dropReason} onChange={(e) => setDropReason(e.target.value)} placeholder={t('client.box.dropPlaceholder', { first })} className="h-8 min-w-[16rem] flex-1" aria-label={t('client.box.dropReason')} />
                  <Button size="sm" variant="destructive" disabled={busy || !dropReason.trim()} onClick={drop}>{t('client.box.reportDrop')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setDropReason(null)}>{t('common.cancel')}</Button>
                </div>
              ) : (
                <ContractDialog
                  ctx={ctx} open inline onOpenChange={(o) => { if (!o) onOpenChange(false); }} onDone={finish}
                  initialWay={sendSelfFirst ? 'self' : intent === 'digital' ? 'digital' : null}
                  footerExtra={<>
                    <button type="button" className="text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => setReport(true)}>{tk('alreadySigned')}</button>
                    <button type="button" className="text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => setDropReason('')}>{t('client.box.hasDropped', { first })}</button>
                  </>}
                />
              )
            ) : (
              <ContractBox
                submissionId={ctx.submissionId}
                openRequest={intent && !['melden', 'abgesprungen', 'contract', 'digital', 'verschickt'].includes(intent) ? intent : null}
                returnEvent={returnEvent}
                onSignedBack={() => finish(tk('youSigned', { first }))}
                onNotYet={task?.kind === 'contract_signed_check' ? notYet : undefined}
              />
            )}

            <ContractReportDialog ctx={ctx} open={report} onOpenChange={setReport} onDone={() => finish(tk('reported'))} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
