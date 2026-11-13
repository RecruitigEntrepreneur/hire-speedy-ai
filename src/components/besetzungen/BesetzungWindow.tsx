import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { besetzungApi, fileToBase64, type BesetzungItem } from '@/lib/besetzungApi';
import { contractApi } from '@/lib/contractApi';
import { actionsOf, dateDe, factsOf, first, genitiveUi, researchPanel, statusOf, stepsOf, titleOf, todayKey, type ActionKey } from './besetzungView';
import { FactGrid, StatusPill, StepRow } from './BesetzungParts';
import { BesetzungEndForm } from './BesetzungEndForm';
import { NachbesetzungPanel } from './NachbesetzungPanel';
import { useTranslation } from 'react-i18next';

/**
 * Fenster „Besetzung · Name“ (Etappe 2, 25.10.2026; Umbau 11.11.2026, K4–K7, J2/J3):
 * Schritte, Stand der Nachbesetzung, Eckdaten, Knöpfe je Phase und Verlauf. Meldungen direkt
 * hier: Start verschoben, Antritt (K7), Besetzung endet (K5), Bestellnummer („ergänzen“).
 * Der Arbeitsvertrag öffnet das vorhandene Fenster.
 */

export type BesetzungForm = 'move' | 'start' | 'check' | 'end' | 'po' | 'doc';

interface Props {
  item: BesetzungItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Vorhandenes Vertrags-Fenster */
  onContract: (submissionId: string) => void;
  /** Andere Besetzung öffnen (Ersatz gefunden) */
  onOpenSubmission?: (submissionId: string) => void;
  /** Direkt in eine Meldung, z. B. „end“ aus der Aufgabe „… hat vor dem Start abgesagt“ */
  initialForm?: BesetzungForm | null;
}

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.eml,.msg';
const tomorrow = () => new Date(Date.parse(`${todayKey()}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

export function BesetzungWindow({ item, open, onOpenChange, onContract, onOpenSubmission, initialForm = null }: Props) {
  const { t } = useTranslation('clientPlacements');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<BesetzungForm | null>(null);
  const [endPreset, setEndPreset] = useState<boolean | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState('');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [po, setPo] = useState('');
  const [cost, setCost] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(initialForm); setEndPreset(initialForm === 'end' ? false : null); setDone(null); setChoice(''); setDate(''); setNote(''); setFile(null);
    setPo(item?.placement?.purchaseOrder ?? ''); setCost(item?.placement?.costCenter ?? '');
  }, [open, item?.submissionId, initialForm]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null;
  const p = item.placement;
  const who = first(item.name);
  const hh = item.recruiterName?.split(' ')[0] ?? t('common.theRecruiter');
  const status = statusOf(item);
  const panel = researchPanel(item);
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['besetzungen'] });
    queryClient.invalidateQueries({ queryKey: ['client-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['client-invoices'] });
  };
  const run = async (work: () => Promise<string>) => {
    setBusy(true);
    try { setDone(await work()); refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t('common.failed')); }
    finally { setBusy(false); }
  };
  const openPdf = async (load: () => Promise<{ url: string }>) => {
    try { const { url } = await load(); window.open(url, '_blank', 'noopener'); }
    catch (e) { toast.error(e instanceof Error ? e.message : t('common.pdfUnavailable')); }
  };
  const go = (to: string) => { onOpenChange(false); navigate(to); };
  const openEnd = (preset: boolean | null) => { setEndPreset(preset); setForm('end'); };

  // Knöpfe je Phase (K4)
  const LABEL: Record<ActionKey, string> = {
    contract: item.contract && item.contract.status !== 'preparing' ? t('window.actions.contractOpen') : t('window.actions.contractSend'),
    startCheck: t('window.actions.startCheck', { who }),
    startConfirm: p?.startReport && !who.startsWith('PR-') ? t('window.actions.startConfirmWho', { whose: genitiveUi(who) }) : t('window.actions.startConfirm'),
    endConfirm: t('window.actions.endConfirm'),
    moveStart: t('window.actions.moveStart'),
    endReport: t('window.actions.endReport'),
    contractPdf: t('window.actions.contractPdf'),
    invoice: t('window.actions.invoice'),
    researchInvoice: t('window.actions.researchInvoice'),
    profile: t('window.actions.profile'),
    endDocument: t('window.actions.endDocument'),
  };
  const RUN: Record<ActionKey, () => void> = {
    contract: () => onContract(item.submissionId),
    startCheck: () => setForm('start'),
    startConfirm: () => { setChoice('agree'); setForm('check'); },
    endConfirm: () => openEnd(false),
    moveStart: () => setForm('move'),
    endReport: () => openEnd(null),
    contractPdf: () => void openPdf(() => contractApi.document(item.submissionId)),
    invoice: () => go(`/dashboard/rechnungen?beleg=${item.invoice!.id}`),
    researchInvoice: () => go(`/dashboard/rechnungen?beleg=${p!.researchInvoice!.id}`),
    profile: () => go(`/dashboard/candidates/${item.submissionId}`),
    endDocument: () => setForm('doc'),
  };
  const acts = actionsOf(item);
  const primary = (k: ActionKey) => ['contract', 'startCheck', 'startConfirm', 'endConfirm'].includes(k);

  const field = (label: string, el: React.ReactNode) => <label className="block text-sm"><span className="text-xs text-muted-foreground">{label}</span><div className="mt-1">{el}</div></label>;
  const footer = (cta: string, ok: boolean, submit: () => void) => (
    <div className="flex justify-end gap-2 border-t pt-3">
      <Button variant="ghost" onClick={() => setForm(null)}>{t('common.cancel')}</Button>
      <Button disabled={busy || !ok} onClick={submit}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{cta}</Button>
    </div>
  );
  const chip = (key: string, text: string) => (
    <Button key={key} type="button" size="sm" variant={choice === key ? 'secondary' : 'outline'} className={choice === key ? 'h-7 rounded-full text-xs ring-1 ring-foreground/30' : 'h-7 rounded-full text-xs'} onClick={() => { setChoice(key); setDate(''); }}>{text}</Button>
  );

  let body: React.ReactNode;
  if (done) {
    body = (
      <>
        <div className="flex items-start gap-2 rounded-lg border p-3 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <div><p className="font-medium">{t('window.done')}</p><p className="text-muted-foreground">{done}</p></div>
        </div>
        <div className="flex justify-end gap-2 border-t pt-3">
          <Button variant="ghost" onClick={() => { setDone(null); setForm(null); }}>{t('window.back')}</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
        </div>
      </>
    );
  } else if (form === 'end' && p) {
    body = <BesetzungEndForm item={item} preset={endPreset} onCancel={() => setForm(null)} onDone={(text) => { setDone(text); refresh(); }} />;
  } else if (form === 'start' && p) {
    // K7: Kunde meldet zuerst
    body = (
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">{t('window.startedQ', { who })}</p>
          <p className="text-xs text-muted-foreground">{t('window.firstDayContract', { date: dateDe(p.startDate) })}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {chip('started', t('window.yesStarted'))}
          {chip('later', t('window.later'))}
          <Button type="button" size="sm" variant="outline" className="h-7 rounded-full text-xs" onClick={() => openEnd(false)}>{t('window.notStarted')}</Button>
        </div>
        {choice === 'started' && field(t('window.firstDay'), <Input type="date" max={todayKey()} className="h-9 w-48" value={date || p.startDate || ''} onChange={(e) => setDate(e.target.value)} />)}
        {choice === 'later' && (
          <>
            {field(t('window.newFirstDay'), <Input type="date" min={tomorrow()} className="h-9 w-48" value={date} onChange={(e) => setDate(e.target.value)} />)}
            <Textarea rows={2} placeholder={t('window.reasonOptional')} value={note} onChange={(e) => setNote(e.target.value)} />
          </>
        )}
        <p className="text-xs text-muted-foreground">{t('window.recruiterLearns', { hh })}</p>
        {footer(choice === 'later' ? t('common.save') : t('common.confirm'), choice === 'started' || (choice === 'later' && !!date), () => run(async () => {
          if (choice === 'started') {
            await besetzungApi.startAnswer({ placementId: p.id, way: 'started', startedOn: date || p.startDate || undefined });
            return t('window.startedDone', { who, hh });
          }
          await besetzungApi.startAnswer({ placementId: p.id, way: 'later', startDate: date, note: note.trim() || undefined });
          return t('window.laterDone', { date: dateDe(date) });
        }))}
      </div>
    );
  } else if (form === 'check' && p?.startReport) {
    // K7: Headhunter hat zuerst gemeldet
    const sr = p.startReport;
    body = (
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">{who.startsWith('PR-') ? t('window.confirmStartOf', { who }) : t('window.actions.startConfirmWho', { whose: genitiveUi(who) })}</p>
          <p className="text-xs text-muted-foreground">{t('window.reportsStarted', { name: sr.byName ?? hh, date: dateDe(sr.on) })}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">{chip('agree', t('window.fits'))}{chip('disagree', t('window.notRight'))}</div>
        {choice === 'disagree' && <Textarea rows={2} placeholder={t('window.whatWrong')} value={note} onChange={(e) => setNote(e.target.value)} />}
        {sr.fixesOn && <p className="text-xs text-muted-foreground">{t('window.fixesOn', { date: dateDe(sr.fixesOn) })}</p>}
        {footer(choice === 'disagree' ? t('common.send') : t('common.confirm'), choice === 'agree' || (choice === 'disagree' && note.trim().length > 0), () => run(async () => {
          await besetzungApi.startAnswer({ placementId: p.id, way: choice === 'agree' ? 'agree' : 'disagree', note: note.trim() || undefined });
          return choice === 'agree' ? t('window.agreeDone', { who }) : t('window.disagreeDone');
        }))}
      </div>
    );
  } else if (form === 'move' && p) {
    body = (
      <div className="space-y-3">
        <p className="text-sm font-medium">{t('window.moveTitle', { who })}</p>
        {field(t('window.newFirstDay'), <Input type="date" min={todayKey()} className="h-9 w-48" value={date} onChange={(e) => setDate(e.target.value)} />)}
        <Textarea rows={2} placeholder={t('window.reasonOptional')} value={note} onChange={(e) => setNote(e.target.value)} />
        <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{t('window.moveHint', { hh })}</p>
        {footer(t('common.report'), !!date, () => run(async () => { const r = await besetzungApi.moveStart(p.id, date, note.trim()); return t('window.moveDone', { date: dateDe(r.startDate) }); }))}
      </div>
    );
  } else if (form === 'doc' && p) {
    body = (
      <div className="space-y-3">
        <p className="text-sm font-medium">{t('window.docTitle')}</p>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40">
          <Upload className="h-4 w-4" />
          <span className="flex-1 truncate">{file ? file.name : t('window.docPick', { who })}</span>
          <input type="file" accept={ACCEPT} className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        {footer(t('window.upload'), !!file, () => run(async () => { await besetzungApi.endDocument(p.id, file!.name, await fileToBase64(file!)); return t('window.docDone'); }))}
      </div>
    );
  } else if (form === 'po' && p) {
    body = (
      <div className="space-y-3">
        <p className="text-sm font-medium">{t('window.poTitle')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {field(t('window.po'), <Input className="h-9" placeholder={t('window.poPlaceholder')} value={po} onChange={(e) => setPo(e.target.value)} />)}
          {field(t('window.costCenter'), <Input className="h-9" placeholder={t('window.costPlaceholder')} value={cost} onChange={(e) => setCost(e.target.value)} />)}
        </div>
        <p className="text-xs text-muted-foreground">{t('window.poHint')}</p>
        {footer(t('common.save'), !!(po.trim() || cost.trim()), () => run(async () => { await besetzungApi.setPurchaseOrder(p.id, po.trim(), cost.trim()); return t('window.poDone'); }))}
      </div>
    );
  } else {
    body = (
      <>
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('window.steps')}</p>
          <StepRow steps={stepsOf(item)} />
        </div>
        {panel && (
          <NachbesetzungPanel item={item} panel={panel} busy={busy} run={(w) => void run(w)}
            onEditJob={(jobId) => go(`/dashboard/jobs/${jobId}`)}
            onSubmissions={(jobId) => go(`/dashboard/candidates?job=${jobId}&tab=neu`)}
            onInvoice={(id) => go(`/dashboard/rechnungen?beleg=${id}`)}
            onOpenSubmission={(sub) => { if (onOpenSubmission) onOpenSubmission(sub); else go(`/dashboard/besetzungen?besetzung=${sub}`); }} />
        )}
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('window.facts')}</p>
          <FactGrid facts={factsOf(item)} onAction={(a) => { if (a === 'po') setForm('po'); }} />
        </div>
        {p && item.group === 'start' && !p.end && !p.startFixedAt && (
          <p className="text-xs text-muted-foreground">{t('window.keepsContact', { hh, who })}</p>
        )}
        {acts.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('window.actionsTitle')}</p>
            <div className="flex flex-wrap gap-2">
              {acts.map((k) => <Button key={k} size="sm" variant={primary(k) ? 'default' : 'outline'} onClick={RUN[k]}>{LABEL[k]}</Button>)}
            </div>
          </div>
        )}
        {item.events.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('window.history')}</p>
            <ol className="divide-y text-sm">
              {item.events.map((e, n) => (
                <li key={n} className="flex justify-between gap-3 py-1.5"><span>{e.text}</span><span className="shrink-0 text-xs text-muted-foreground">{dateDe(e.at)}</span></li>
              ))}
            </ol>
          </div>
        )}
        <div className="flex justify-end border-t pt-3"><Button variant="ghost" onClick={() => onOpenChange(false)}>{t('common.close')}</Button></div>
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader className="text-left">
          <div className="flex flex-wrap items-center gap-2 pr-6">
            <DialogTitle>{t('window.title', { title: titleOf(item) })}</DialogTitle>
            <StatusPill text={status.text} tone={status.tone} />
          </div>
          <DialogDescription>{item.jobTitle}{item.recruiterName ? t('common.via', { name: item.recruiterName }) : ''}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">{body}</div>
      </DialogContent>
    </Dialog>
  );
}
