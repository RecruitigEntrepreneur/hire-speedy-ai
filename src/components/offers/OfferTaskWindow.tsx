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
import { OfferBox, offerSummary } from './OfferBox';

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
  const first = (ctx?.candidateName ?? '').split(' ')[0] || 'Der Kandidat';
  const hhFirst = (ctx?.recruiterName ?? 'Ihr Headhunter').split(' ')[0];
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
    catch (e) { toast.error(e instanceof Error ? e.message : 'Das hat nicht geklappt.'); }
    finally { setBusy(false); }
  };
  const handoff = (fn: () => void) => { onOpenChange(false); fn(); };

  const wish = o?.response?.wish;
  const wishText = [wish?.salary ? `${euro(wish.salary)} fix` : null, wish?.variable ? `${euro(wish.variable)} variabel` : null, wish?.startDate ? `Start ${dayDe(wish.startDate)}` : null, wish?.other ?? null].filter(Boolean).join(' · ');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        {!ctx ? (
          <>
            <DialogHeader className="text-left"><DialogTitle>Angebot</DialogTitle><DialogDescription>wird geladen …</DialogDescription></DialogHeader>
            {q.error ? <p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : 'Konnte nicht geladen werden.'}</p> : <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </>
        ) : done ? (
          <>
            <DialogHeader className="text-left"><DialogTitle>Angebot für {first}</DialogTitle><DialogDescription>{ctx.jobTitle}</DialogDescription></DialogHeader>
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <div><p className="font-medium">Erledigt.</p><p className="text-muted-foreground">{done}</p></div>
            </div>
            {next ? (
              <div className="rounded-lg border p-3 text-sm">
                <p className="text-xs text-muted-foreground">Nächste Aufgabe</p>
                <p className="font-medium">{next.title}</p>
                <p className="text-xs text-muted-foreground">{next.who}{next.jobTitle ? ` · ${next.jobTitle}` : ''} · {waitingLabel(next)}</p>
              </div>
            ) : <p className="text-sm text-muted-foreground">Damit ist alles erledigt.</p>}
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Schließen</Button>
              {next && <Button onClick={() => { onOpenChange(false); navigate(taskHref(next)); }}>Weiter zur nächsten</Button>}
            </div>
          </>
        ) : o?.status === 'countered' ? (
          <>
            <DialogHeader className="text-left">
              <DialogTitle>{first} hat einen Gegenwunsch</DialogTitle>
              <DialogDescription>{ctx.jobTitle} · Ihr Angebot {offerSummary(o)}{o.version > 1 ? ` · Version ${o.version}` : ''}</DialogDescription>
            </DialogHeader>
            {counterTask?.context
              ? <ContextView context={counterTask.context} />
              : <p className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">{first} wünscht {wishText || 'Änderungen'}{o.response?.reason ? ` · ${hhFirst}: „${o.response.reason}“` : ''}</p>}
            {keepNote !== null ? (
              <div className="space-y-2 text-sm">
                <Input value={keepNote} onChange={(e) => setKeepNote(e.target.value)} placeholder={`Kurze Begründung für ${hhFirst} (optional), z. B. mehr ist im Budget nicht drin`} aria-label="Begründung" />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setKeepNote(null)}>Zurück</Button>
                  <Button disabled={busy} onClick={() => run(() => offerApi.keep(o.id, keepNote.trim()), `${hhFirst} ist informiert und spricht noch einmal mit ${first}.`)}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Bei {euro(o.salary)} bleiben</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" disabled={busy} onClick={() => run(() => offerApi.acceptCounter(o.id), `Angenommen. ${hhFirst} bekommt Version ${o.version + 1} mit ${wishText || 'den gewünschten Werten'} und sagt es ${first}.`)}
                    className="rounded-lg border border-primary bg-primary/[0.04] p-3 text-left text-sm transition-colors hover:bg-primary/[0.08]">
                    <p className="font-medium">Annehmen</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Version {o.version + 1} mit genau diesen Werten, ein Klick.</p>
                  </button>
                  <button type="button" onClick={() => handoff(onAdjust)} className="rounded-lg border border-border/60 p-3 text-left text-sm transition-colors hover:bg-muted/40">
                    <p className="font-medium">Eigener Vorschlag</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Werte selbst setzen, z. B. dazwischen.</p>
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <div className="flex flex-wrap gap-3 text-xs">
                    <button type="button" className="text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => setKeepNote('')}>Beim Angebot bleiben</button>
                    <button type="button" className="text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => handoff(onReject)}>Absagen</button>
                  </div>
                  <Button variant="ghost" onClick={() => onOpenChange(false)}>Schließen</Button>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <DialogHeader className="text-left">
              <DialogTitle>Angebot für {first}</DialogTitle>
              <DialogDescription>{ctx.jobTitle}{o ? ` · ${offerSummary(o)}` : ''}</DialogDescription>
            </DialogHeader>
            {o ? (
              <OfferBox submissionId={ctx.submissionId} onAdjust={() => handoff(onAdjust)} onReject={() => handoff(onReject)} onContract={onContract ? () => handoff(onContract) : undefined} />
            ) : <p className="text-sm text-muted-foreground">Noch kein Angebot.</p>}
            <div className="flex justify-end border-t pt-3"><Button variant="ghost" onClick={() => onOpenChange(false)}>Schließen</Button></div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
