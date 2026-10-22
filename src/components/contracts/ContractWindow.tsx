import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Circle, Loader2, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { notifyTasksChanged } from '@/hooks/useUnifiedTaskInbox';
import { contractApi, dateDe, euro, timeDe } from '@/lib/contractApi';
import { ContractReportDialog } from './ContractReportDialog';

interface Props {
  submissionId: string | null;
  onClose: () => void;
  onDone?: () => void;
}

/**
 * Vertrag begleiten (Headhunter, Paket 3): Stand der Unterschrift, Gegenprobe nach
 * der Kundenmeldung, selbst melden, abgesprungen. Fenster in der Mitte.
 */
export function ContractWindow({ submissionId, onClose, onDone }: Props) {
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ['contract', submissionId], queryFn: () => contractApi.context(submissionId!), enabled: !!submissionId, staleTime: 10_000 });
  const [showReport, setShowReport] = useState(false);
  const [dropReason, setDropReason] = useState<string | null>(null);
  const [differs, setDiffers] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ctx = q.data ?? null;
  const c = ctx?.contract ?? null;
  const first = (ctx?.candidateName ?? '').split(' ')[0] || 'der Kandidat';
  const firma = ctx?.companyName ?? 'Der Kunde';

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
      toast.error(e instanceof Error ? e.message : 'Das hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };

  const status = c?.status ?? 'preparing';
  const checkOpen = !!c && ['signed', 'final'].includes(status) && c.reportedRole === 'client' && !c.recruiterCheck;
  const canReport = ['preparing', 'sent_self', 'declined'].includes(status);
  const canDrop = ['preparing', 'sent_self', 'sent_digital', 'company_signed', 'declined'].includes(status);
  const values = c ? [c.salary ? `${euro(c.salary)}${c.variable ? ` + ${euro(c.variable)}` : ''}` : null, c.startDate ? `Start ${dateDe(c.startDate)}` : null].filter(Boolean).join(' · ') : '';
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
            <DialogHeader><DialogTitle>Vertrag</DialogTitle><DialogDescription>wird geladen …</DialogDescription></DialogHeader>
            {q.error ? <p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : 'Konnte nicht geladen werden.'}</p> : <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </>
        ) : (
          <>
            <DialogHeader className="text-left">
              <DialogTitle>{checkOpen ? 'Gegenprobe' : 'Vertrag begleiten'}: {ctx.candidateName}</DialogTitle>
              <DialogDescription>{firma} · {ctx.jobTitle}</DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
              <ul className="space-y-1">
                {step(true, 'Zusage', ctx.offer?.acceptedAt ? dateDe(ctx.offer.acceptedAt) : null)}
                {c?.way === 'digital' || ['sent_digital', 'company_signed'].includes(status) ? (
                  <>
                    {step(!!c?.sentAt, 'Versendet über DocuSign', timeDe(c?.sentAt))}
                    {step(!!c?.companySignedAt, `${firma} hat unterschrieben`, timeDe(c?.companySignedAt))}
                    {step(!!c?.candidateSignedAt || status === 'final', `${first} unterschreibt`, timeDe(c?.candidateSignedAt))}
                  </>
                ) : (
                  step(status !== 'preparing', status === 'preparing' ? `${firma} bereitet den Vertrag vor` : `${firma} hat den Vertrag ${c?.sentAt ? `am ${dateDe(c.sentAt)} ` : ''}selbst geschickt`)
                )}
                {status === 'reported' && step(false, `Du hast gemeldet (${dateDe(c?.signedOn)}). ${firma} bestätigt noch.`)}
                {['signed', 'final'].includes(status) && step(true, `Unterschrieben am ${dateDe(c?.signedOn)}`, values)}
                {['signed', 'final'].includes(status) && c?.recruiterCheck === 'ok' && step(true, 'Von dir bestätigt')}
                {['signed', 'final'].includes(status) && c?.recruiterCheck === 'differs' && step(true, `Abweichung gemeldet: ${c.recruiterCheckNote ?? ''}`)}
              </ul>
              {status === 'declined' && <p className="mt-2 text-amber-700 dark:text-amber-400">In DocuSign abgelehnt{c?.declineReason ? `: „${c.declineReason}“` : ''}. Bitte mit allen klären.</p>}
              {status === 'dropped' && <p className="mt-2 text-muted-foreground">{first} ist abgesprungen{c?.dropReason ? `: „${c.dropReason}“` : ''}.</p>}
              {['sent_digital', 'company_signed'].includes(status) && <p className="mt-2 text-xs text-muted-foreground">DocuSign meldet die Unterschrift von selbst; DocuSign erinnert {first} zusätzlich.</p>}
            </div>

            {checkOpen && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3 text-sm">
                <p className="font-medium">{firma} meldet: {first} hat am {dateDe(c!.signedOn)} unterschrieben</p>
                <p className="mt-0.5 text-muted-foreground">{values}. Passt das zu dem, was {first} sagt?</p>
                {differs !== null ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Input value={differs} onChange={(e) => setDiffers(e.target.value)} placeholder="Was weicht ab? z. B. Start laut Kandidat 01.02." className="h-8 min-w-[16rem] flex-1" aria-label="Abweichung" />
                    <Button size="sm" disabled={busy || !differs.trim()} onClick={() => run(() => contractApi.check(submissionId!, 'differs', differs.trim()), 'Danke. Matchunt klärt das mit dem Kunden.')}>Senden</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDiffers(null)}>Abbrechen</Button>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" disabled={busy} onClick={() => run(() => contractApi.check(submissionId!, 'ok'), 'Bestätigt.')}>Stimmt</Button>
                    <Button size="sm" variant="outline" onClick={() => setDiffers('')}>Weicht ab</Button>
                  </div>
                )}
              </div>
            )}

            {dropReason !== null && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Input value={dropReason} onChange={(e) => setDropReason(e.target.value)} placeholder={`Warum ist ${first} abgesprungen?`} className="h-8 min-w-[16rem] flex-1" aria-label="Grund" />
                <Button size="sm" variant="destructive" disabled={busy || !dropReason.trim()} onClick={() => run(() => contractApi.drop(submissionId!, dropReason.trim()), `Gespeichert. ${firma} ist informiert.`)}>Abgesprungen melden</Button>
                <Button size="sm" variant="ghost" onClick={() => setDropReason(null)}>Abbrechen</Button>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
              {ctx.candidatePhone && !['final', 'dropped'].includes(status) && (
                <Button size="sm" variant="outline" className="gap-1" asChild><a href={`tel:${ctx.candidatePhone}`}><Phone className="h-3.5 w-3.5" />{first} anrufen</a></Button>
              )}
              {canDrop && dropReason === null && <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setDropReason('')}>{first} ist abgesprungen</Button>}
              {canReport && <Button size="sm" onClick={() => setShowReport(true)}>{first} hat unterschrieben</Button>}
              {!canReport && !checkOpen && <Button size="sm" variant="ghost" onClick={onClose}>Schließen</Button>}
            </div>
            {canReport && <p className="text-xs text-muted-foreground">Meldest du zuerst, bestätigt {firma}. Erst dann ist die Einstellung verbindlich.</p>}

            <ContractReportDialog ctx={ctx} open={showReport} onOpenChange={setShowReport} onDone={() => { notifyTasksChanged(); onDone?.(); }} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
