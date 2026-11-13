import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ContextView } from '@/components/client/tasks/ClientTaskParts';
import { taskHref, useClientTasks, waitingLabel } from '@/lib/clientTasksApi';
import { dayDe, euro, offerApi } from '@/lib/offerApi';
import { OfferBox } from './OfferBox';
import { useTranslation } from 'react-i18next';

/**
 * Aufgaben-Fenster „Angebot“ (24.10.2026, „eine Aufgabe, ein Fenster“): öffnet sich aus der
 * Dashboard-Leiste, der Seite „Aufgaben“ und dem Profil. Beim Gegenwunsch: Angebot | Wunsch |
 * Rahmen, Begründung des Headhunters, Honorar, dazu Annehmen (Version 2 mit genau den Werten,
 * ein Klick), eigener Vorschlag, beim Angebot bleiben, absagen. Sonst der Stand mit seinen
 * Schritten (Frist verlängern, ändern, zurückziehen …).
 */

interface Props {
  submissionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Eigener Vorschlag / neues Angebot: das Angebotsfenster (im Profil oder dorthin) */
  onAdjust: () => void;
  /** Absagen mit Grund (bestehendes Absage-Fenster) */
  onReject: () => void;
  /** Nach der Zusage: Vertrags-Fenster */
  onContract?: () => void;
}

export function OfferTaskWindow({ submissionId, open, onOpenChange, onAdjust, onReject, onContract }: Props) {
  const { t } = useTranslation('offers');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ['offer-context', submissionId], queryFn: () => offerApi.context(submissionId!), enabled: open && !!submissionId, staleTime: 10_000 });
  const tasks = useClientTasks();
  const [done, setDone] = useState<string | null>(null);
  const [keepNote, setKeepNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setDone(null); setKeepNote(null); } }, [open, submissionId]);

  const ctx = q.data ?? null;
  const o = ctx?.currentOffer ?? null;
  const first = (ctx?.candidateName ?? '').split(' ')[0] || t('client.theCandidate');
  const hhFirst = (ctx?.recruiterName ?? t('client.yourRecruiter')).split(' ')[0];
  // Entscheidungshilfe aus der Aufgabe (Angebot | Wunsch | Rahmen, Begründung, Honorar)
  const counterTask = o ? (tasks.data?.tasks ?? []).find((t) => t.key === `counter:${o.id}`) ?? null : null;
  const next = (tasks.data?.tasks ?? []).find((t) => t.submissionId !== submissionId) ?? null;

  const refetchAll = () => {
    queryClient.invalidateQueries({ queryKey: ['offer-context', submissionId] });
    queryClient.invalidateQueries({ queryKey: ['submission-state'] });
    queryClient.invalidateQueries({ queryKey: ['bewerber'] });
    queryClient.invalidateQueries({ queryKey: ['client-tasks'] });
  };
  const run = async (work: () => Promise<unknown>, text: string) => {
    setBusy(true);
    try { await work(); setDone(text); refetchAll(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t('common.failed')); }
    finally { setBusy(false); }
  };
  const handoff = (fn: () => void) => { onOpenChange(false); fn(); };

  const wish = o?.response?.wish;
  const wishText = [wish?.salary ? t('client.box.wishFix', { amount: euro(wish.salary) }) : null, wish?.variable ? t('client.box.wishVariable', { amount: euro(wish.variable) }) : null, wish?.startDate ? t('client.box.wishStart', { date: dayDe(wish.startDate) }) : null, wish?.other ?? null].filter(Boolean).join(' · ');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        {!ctx ? (
          <>
            <DialogHeader className="text-left"><DialogTitle>{t('answer.title')}</DialogTitle><DialogDescription>{t('common.loading')}</DialogDescription></DialogHeader>
            {q.error ? <p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : t('common.loadError')}</p> : <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </>
        ) : done ? (
          <>
            <DialogHeader className="text-left"><DialogTitle>{t('client.task.offerFor', { first })}</DialogTitle><DialogDescription>{ctx.jobTitle}</DialogDescription></DialogHeader>
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <div><p className="font-medium">{t('client.task.done')}</p><p className="text-muted-foreground">{done}</p></div>
            </div>
            {next ? (
              <div className="rounded-lg border p-3 text-sm">
                <p className="text-xs text-muted-foreground">{t('client.task.nextTask')}</p>
                <p className="font-medium">{next.title}</p>
                <p className="text-xs text-muted-foreground">{next.who}{next.jobTitle ? ` · ${next.jobTitle}` : ''} · {waitingLabel(next)}</p>
              </div>
            ) : <p className="text-sm text-muted-foreground">{t('client.task.allDone')}</p>}
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
              {next && <Button onClick={() => { onOpenChange(false); navigate(taskHref(next)); }}>{t('client.task.next')}</Button>}
            </div>
          </>
        ) : o?.status === 'countered' ? (
          <>
            <DialogHeader className="text-left">
              <DialogTitle>{t('client.task.counterTitle', { first })}</DialogTitle>
              <DialogDescription>{o.responseDue ? t('client.task.versionDue', { job: ctx.jobTitle, n: o.version, date: dayDe(o.responseDue) }) : t('client.task.versionOnly', { job: ctx.jobTitle, n: o.version })}</DialogDescription>
            </DialogHeader>
            {counterTask?.context
              ? <ContextView context={counterTask.context} />
              : <p className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">{t('client.box.wishes', { first, wish: wishText || t('client.box.changes') })}{o.response?.reason ? ` · ${t('client.box.quote', { hh: hhFirst, text: o.response.reason })}` : ''}</p>}
            {keepNote !== null ? (
              <div className="space-y-2 text-sm">
                <Input value={keepNote} onChange={(e) => setKeepNote(e.target.value)} placeholder={t('client.task.keepPlaceholder', { hh: hhFirst })} aria-label={t('client.box.reason')} />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setKeepNote(null)}>{t('client.task.back')}</Button>
                  <Button disabled={busy} onClick={() => run(() => offerApi.keep(o.id, keepNote.trim()), t('client.task.keepDone', { hh: hhFirst, first }))}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{t('client.box.stayAt', { amount: euro(o.salary) })}</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" disabled={busy} onClick={() => run(() => offerApi.acceptCounter(o.id), t('client.task.acceptDone', { first, n: o.version + 1, wish: wishText || t('client.task.wishedValues'), hh: hhFirst }))}
                    className="rounded-lg border border-primary bg-primary/[0.04] p-3 text-left text-sm transition-colors hover:bg-primary/[0.08]">
                    <p className="font-medium">{t('client.task.accept')}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t('client.task.acceptHint', { n: o.version + 1 })}</p>
                  </button>
                  <button type="button" onClick={() => handoff(onAdjust)} className="rounded-lg border border-border/60 p-3 text-left text-sm transition-colors hover:bg-muted/40">
                    <p className="font-medium">{t('client.task.own')}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t('client.task.ownHint')}</p>
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <div className="flex flex-wrap gap-3 text-xs">
                    <button type="button" className="text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => setKeepNote('')}>{t('client.task.keep')}</button>
                    <button type="button" className="text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => handoff(onReject)}>{t('client.box.reject')}</button>
                  </div>
                  <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <DialogHeader className="text-left">
              <DialogTitle>{t('client.task.offerFor', { first })}</DialogTitle>
              <DialogDescription>{ctx.jobTitle}</DialogDescription>
            </DialogHeader>
            {o ? (
              <OfferBox submissionId={ctx.submissionId} onAdjust={() => handoff(onAdjust)} onReject={() => handoff(onReject)} onContract={onContract ? () => handoff(onContract) : undefined} />
            ) : <p className="text-sm text-muted-foreground">{t('client.task.noOffer')}</p>}
            <div className="flex justify-end border-t pt-3"><Button variant="ghost" onClick={() => onOpenChange(false)}>{t('common.close')}</Button></div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
