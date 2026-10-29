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
  // Unterschrift über Matchunt: Kandidat bekommt seinen Link von uns, der Headhunter sieht, ob er geöffnet ist
  const embedded = ctx?.signing?.mode === 'embedded';
  const candLink = ctx?.signing?.candidate ?? null;
  // Gegenprobe: wer zuerst bestätigt, du oder der Kandidat (29.10.2026)
  const checkOpen = !!c && ['signed', 'final'].includes(status) && c.reportedRole === 'client' && !c.recruiterCheck && !c.candidateCheck;
  // Was der Kandidat von uns weiß und geantwortet hat
  const candAnswer = c?.candidateStatus === 'arrived' ? `Antwort: angekommen (${dateDe(c.candidateStatusAt)})`
    : c?.candidateStatus === 'missing' ? `Antwort: noch nicht da (${dateDe(c.candidateStatusAt)})` : 'noch keine Antwort';
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
  const defaultClientText = status === 'preparing' ? `Wie weit ist der Vertrag für ${first}? ${first} wartet darauf, um zu unterschreiben.`
    : status === 'sent_self' ? `Ist der unterschriebene Vertrag von ${first} bei Ihnen zurück? Dann melden Sie die Unterschrift bitte im Dashboard.`
      : status === 'sent_digital' ? `Der Vertrag für ${first} wartet in DocuSign auf Ihre Unterschrift. Danach bekommt ${first} ihn zum Unterschreiben.`
        : `${first} hat den Vertrag in DocuSign abgelehnt${c?.declineReason ? ` („${c.declineReason}“)` : ''}. Schicken Sie einen angepassten Vertrag?`;
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
    if (o === 'unreachable') { await logCall(false, 'Nicht erreicht'); toast.success('Festgehalten. Versuch es später noch einmal.'); return; }
    if (o === 'new_contract') {
      await logCall(true, 'Erreicht: neuer Vertrag nötig', { outcome: 'new_contract' });
      toast.success('Festgehalten. Frag jetzt den Kunden nach einem angepassten Vertrag.');
    }
  };
  const saveUntil = async () => {
    if (!untilDate) return;
    await logCall(true, `Erreicht: unterschreibt bis ${dateDe(untilDate)}`, { outcome: 'until', until: untilDate });
    toast.success(`Festgehalten. Die Zeile wartet bis ${dateDe(untilDate)}.`);
  };
  const saveQuestions = async () => {
    const q = questions.trim();
    if (!q) return;
    await logCall(true, 'Erreicht: hat Fragen zum Vertrag', { outcome: 'questions' }, q);
    setClientText(`${first} hat Fragen zum Vertrag: „${q}“. Können Sie das mit ${first} klären?`);
    toast.success('Festgehalten. Gib die Fragen unten an den Kunden weiter.');
  };
  const askTheClient = async () => {
    if (!ctx) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('recruiter-notify', { body: { action: 'client_nudge', submissionId: ctx.submissionId, text: shownClientText, anlass: 'contract' } });
    const failure = await functionError(error, data);
    setBusy(false);
    if (failure) { toast.error(failure); return; }
    toast.success('Kunde gefragt. Die Zeile wartet 3 Werktage auf seine Antwort.');
    setHistoryTick(t => t + 1);
    notifyTasksChanged();
    onDone?.();
  };
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
                    {step(!!c?.sentAt, embedded ? 'Vertrag hochgeladen' : 'Versendet über DocuSign', timeDe(c?.sentAt))}
                    {step(!!c?.companySignedAt, `${firma} hat unterschrieben`, timeDe(c?.companySignedAt))}
                    {step(!!c?.candidateSignedAt || status === 'final', `${first} unterschreibt`,
                      c?.candidateSignedAt ? timeDe(c.candidateSignedAt) : embedded && status === 'company_signed' ? linkLine(candLink, null) : null)}
                  </>
                ) : (
                  <>
                    {step(status !== 'preparing', status === 'preparing' ? `${firma} bereitet den Vertrag vor` : `${firma} hat den Vertrag ${c?.sentAt ? `am ${dateDe(c.sentAt)} ` : ''}selbst geschickt`)}
                    {(c?.candidateInformedAt || c?.candidateStatus) && step(c?.candidateStatus === 'arrived',
                      c?.candidateInformedAt ? `${first} informiert ${dateDe(c.candidateInformedAt)} · ${candAnswer}` : `${first}: ${candAnswer}`)}
                  </>
                )}
                {status === 'reported' && step(false, c?.reportedRole === 'candidate'
                  ? `${first} hat selbst gemeldet: unterschrieben am ${dateDe(c?.signedOn)}. ${firma} bestätigt noch.`
                  : `Du hast gemeldet (${dateDe(c?.signedOn)}). ${firma} bestätigt noch.`)}
                {['signed', 'final'].includes(status) && step(true, `Unterschrieben am ${dateDe(c?.signedOn)}`, values)}
                {['signed', 'final'].includes(status) && c?.recruiterCheck === 'ok' && step(true, 'Von dir bestätigt')}
                {['signed', 'final'].includes(status) && c?.recruiterCheck === 'differs' && step(true, `Abweichung gemeldet: ${c.recruiterCheckNote ?? ''}`)}
                {['signed', 'final'].includes(status) && c?.candidateCheck === 'ok' && step(true, `Von ${first} bestätigt`, dateDe(c.candidateCheckedAt))}
                {['signed', 'final'].includes(status) && c?.candidateCheck === 'differs' && step(true, `${first} sagt: stimmt so nicht${c.candidateCheckNote ? ` („${c.candidateCheckNote}“)` : ''} · Matchunt klärt das`)}
              </ul>
              {quietUntil && <p className="mt-2 text-xs text-emerald-600">Nichts zu tun bis {dateDe(quietUntil)}. Danach steht der Vertrag wieder unter „Jetzt“.</p>}
              {c?.candidateStatus === 'missing' && ['preparing', 'sent_self'].includes(status) && (
                <p className="mt-2 text-amber-700 dark:text-amber-400">{first} hat den Vertrag noch nicht. {firma} weiß es und soll ihn erneut schicken; ruf {first} kurz an.</p>
              )}
              {status === 'declined' && <p className="mt-2 text-amber-700 dark:text-amber-400">In DocuSign abgelehnt{c?.declineReason ? `: „${c.declineReason}“` : ''}. Bitte mit allen klären.</p>}
              {status === 'dropped' && <p className="mt-2 text-muted-foreground">{first} ist abgesprungen{c?.dropReason ? `: „${c.dropReason}“` : ''}.</p>}
              {['sent_digital', 'company_signed'].includes(status) && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {embedded
                    ? (status === 'company_signed'
                      ? `${first} hat den Link per Mail von Matchunt.${candLink && !candLink.openedAt ? ` Noch nicht geöffnet: ruf ${first} an, ob die Mail angekommen ist.` : ''}`
                      : `Erst unterschreibt ${firma}, dann bekommt ${first} einen Link per Mail von Matchunt.`)
                    : `DocuSign meldet die Unterschrift von selbst; DocuSign erinnert ${first} zusätzlich.`}
                </p>
              )}
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

            {followOpen && (
              <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Nachfassen</p>
                <div className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-medium text-primary-foreground">1</span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">Bei {first}</span>
                      {ctx.candidatePhone && <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" asChild><a href={`tel:${ctx.candidatePhone}`}><Phone className="h-3 w-3" />{first} anrufen</a></Button>}
                    </div>
                    <p className="text-xs text-muted-foreground">Was sagt {first}?</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(status === 'declined'
                        ? [['new_contract', 'Neuer Vertrag nötig']] as [CallOutcome, string][]
                        : [['signed', 'Hat unterschrieben'], ['until', 'Unterschreibt bis …'], ['questions', 'Hat Fragen'], ['unreachable', 'Nicht erreicht']] as [CallOutcome, string][]
                      ).map(([k, label]) => (
                        <Button key={k} size="sm" variant={callOutcome === k ? 'default' : 'outline'} className="h-7 text-xs" disabled={busy} onClick={() => pickCall(k)}>{label}</Button>
                      ))}
                      {canDrop && <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => setDropReason('')}>Abgesprungen</Button>}
                    </div>
                    {callOutcome === 'signed' && !canReport && <p className="text-xs text-muted-foreground">DocuSign meldet die Unterschrift von selbst, sobald {first} unterschrieben hat.</p>}
                    {callOutcome === 'until' && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input type="date" value={untilDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setUntilDate(e.target.value)} className="h-8 w-40" aria-label="Unterschreibt bis" />
                        <Button size="sm" className="h-8 text-xs" disabled={busy || !untilDate} onClick={saveUntil}>Festhalten</Button>
                        <span className="text-xs text-muted-foreground">Bis dahin wartet die Zeile unter „Wartet auf andere“.</span>
                      </div>
                    )}
                    {callOutcome === 'questions' && (
                      <div className="space-y-1.5">
                        <Textarea value={questions} onChange={(e) => setQuestions(e.target.value)} rows={2} placeholder="Welche Fragen hat sie? z. B. Probezeit, Startdatum" className="text-sm" />
                        <Button size="sm" className="h-8 text-xs" disabled={busy || !questions.trim()} onClick={saveQuestions}>Festhalten</Button>
                      </div>
                    )}
                  </div>
                </div>
                {askClient && (
                  <div className="flex gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px] text-muted-foreground">2</span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <span className="font-medium">Beim Kunden</span>
                      <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm italic text-foreground/90">{shownClientText}</p>
                      <Button size="sm" variant="outline" className="h-8 text-xs" disabled={busy} onClick={askTheClient}>Kunden fragen</Button>
                      <p className="text-xs text-muted-foreground">Mail und Benachrichtigung an das Kundenteam. Höchstens einmal in drei Tagen.</p>
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
                <Input value={dropReason} onChange={(e) => setDropReason(e.target.value)} placeholder={`Warum ist ${first} abgesprungen?`} className="h-8 min-w-[16rem] flex-1" aria-label="Grund" />
                <Button size="sm" variant="destructive" disabled={busy || !dropReason.trim()} onClick={() => run(() => contractApi.drop(submissionId!, dropReason.trim()), `Gespeichert. ${firma} ist informiert.`)}>Abgesprungen melden</Button>
                <Button size="sm" variant="ghost" onClick={() => setDropReason(null)}>Abbrechen</Button>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
              {ctx.candidatePhone && !followOpen && !['final', 'dropped'].includes(status) && (
                <Button size="sm" variant="outline" className="gap-1" asChild><a href={`tel:${ctx.candidatePhone}`}><Phone className="h-3.5 w-3.5" />{first} anrufen</a></Button>
              )}
              {onLater && followOpen && (
                <Button size="sm" variant="outline" onClick={() => { const d = new Date(Date.now() + 86_400_000); d.setHours(9, 0, 0, 0); onLater(d); }}>Morgen wieder</Button>
              )}
              {embedded && status === 'company_signed' && dropReason === null && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => contractApi.resendLink(submissionId!), `Neuer Link an ${first} ist unterwegs.`)}>Link an {first} erneut senden</Button>
              )}
              {canDrop && !followOpen && dropReason === null && <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setDropReason('')}>{first} ist abgesprungen</Button>}
              {canReport && <Button size="sm" onClick={() => setShowReport(true)}>{first} hat unterschrieben</Button>}
              {(!canReport || followOpen) && !checkOpen && <Button size="sm" variant="ghost" onClick={onClose}>Schließen</Button>}
            </div>
            {canReport && <p className="text-xs text-muted-foreground">Meldest du zuerst, bestätigt {firma}. Erst dann ist die Einstellung verbindlich.</p>}

            <ContractReportDialog ctx={ctx} open={showReport} onOpenChange={setShowReport} onDone={() => { notifyTasksChanged(); onDone?.(); }} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
