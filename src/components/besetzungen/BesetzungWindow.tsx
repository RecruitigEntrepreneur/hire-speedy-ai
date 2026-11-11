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
import { actionsOf, dateDe, factsOf, first, genitive, researchPanel, statusOf, stepsOf, titleOf, todayKey, type ActionKey } from './besetzungView';
import { FactGrid, StatusPill, StepRow } from './BesetzungParts';
import { BesetzungEndForm } from './BesetzungEndForm';
import { NachbesetzungPanel } from './NachbesetzungPanel';

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
  const hh = item.recruiterName?.split(' ')[0] ?? 'Der Headhunter';
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
    catch (e) { toast.error(e instanceof Error ? e.message : 'Das hat nicht geklappt.'); }
    finally { setBusy(false); }
  };
  const openPdf = async (load: () => Promise<{ url: string }>) => {
    try { const { url } = await load(); window.open(url, '_blank', 'noopener'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Das PDF ist gerade nicht abrufbar.'); }
  };
  const go = (to: string) => { onOpenChange(false); navigate(to); };
  const openEnd = (preset: boolean | null) => { setEndPreset(preset); setForm('end'); };

  // Knöpfe je Phase (K4)
  const LABEL: Record<ActionKey, string> = {
    contract: item.contract && item.contract.status !== 'preparing' ? 'Arbeitsvertrag öffnen' : 'Arbeitsvertrag schicken',
    startCheck: `Hat ${who} angefangen?`,
    startConfirm: p?.startReport && !who.startsWith('PR-') ? `${genitive(who)} Start bestätigen` : 'Start bestätigen',
    endConfirm: 'Absage bestätigen',
    moveStart: 'Start verschoben',
    endReport: 'Besetzung endet',
    contractPdf: 'Vertrag (PDF)',
    invoice: 'Rechnung ansehen',
    researchInvoice: 'Rechnung zur Nachbesetzung',
    profile: 'Bewerberprofil',
    endDocument: 'Unterlage nachreichen',
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
      <Button variant="ghost" onClick={() => setForm(null)}>Abbrechen</Button>
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
          <div><p className="font-medium">Erledigt.</p><p className="text-muted-foreground">{done}</p></div>
        </div>
        <div className="flex justify-end gap-2 border-t pt-3">
          <Button variant="ghost" onClick={() => { setDone(null); setForm(null); }}>Zurück zur Besetzung</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Schließen</Button>
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
          <p className="text-sm font-medium">Hat {who} angefangen?</p>
          <p className="text-xs text-muted-foreground">Erster Arbeitstag laut Vertrag: {dateDe(p.startDate)}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {chip('started', 'Ja, hat angefangen')}
          {chip('later', 'Fängt später an')}
          <Button type="button" size="sm" variant="outline" className="h-7 rounded-full text-xs" onClick={() => openEnd(false)}>Hat nicht angefangen</Button>
        </div>
        {choice === 'started' && field('Erster Arbeitstag', <Input type="date" max={todayKey()} className="h-9 w-48" value={date || p.startDate || ''} onChange={(e) => setDate(e.target.value)} />)}
        {choice === 'later' && (
          <>
            {field('Neuer erster Arbeitstag', <Input type="date" min={tomorrow()} className="h-9 w-48" value={date} onChange={(e) => setDate(e.target.value)} />)}
            <Textarea rows={2} placeholder="Grund in einem Satz (freiwillig)" value={note} onChange={(e) => setNote(e.target.value)} />
          </>
        )}
        <p className="text-xs text-muted-foreground">{hh} erfährt Ihre Antwort sofort.</p>
        {footer(choice === 'later' ? 'Speichern' : 'Bestätigen', choice === 'started' || (choice === 'later' && !!date), () => run(async () => {
          if (choice === 'started') {
            await besetzungApi.startAnswer({ placementId: p.id, way: 'started', startedOn: date || p.startDate || undefined });
            return `Bestätigt: ${who} hat angefangen. ${hh} ist informiert.`;
          }
          await besetzungApi.startAnswer({ placementId: p.id, way: 'later', startDate: date, note: note.trim() || undefined });
          return `Gespeichert. Neuer erster Arbeitstag: ${dateDe(date)}.`;
        }))}
      </div>
    );
  } else if (form === 'check' && p?.startReport) {
    // K7: Headhunter hat zuerst gemeldet
    const sr = p.startReport;
    body = (
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">{who.startsWith('PR-') ? `Start von ${who} bestätigen` : `${genitive(who)} Start bestätigen`}</p>
          <p className="text-xs text-muted-foreground">{sr.byName ?? hh} meldet: angefangen am {dateDe(sr.on)}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">{chip('agree', 'Stimmt')}{chip('disagree', 'Stimmt so nicht')}</div>
        {choice === 'disagree' && <Textarea rows={2} placeholder="Was stimmt nicht? z. B. fängt erst am 15. an" value={note} onChange={(e) => setNote(e.target.value)} />}
        {sr.fixesOn && <p className="text-xs text-muted-foreground">Ohne Antwort gilt es am {dateDe(sr.fixesOn)} als bestätigt.</p>}
        {footer(choice === 'disagree' ? 'Senden' : 'Bestätigen', choice === 'agree' || (choice === 'disagree' && note.trim().length > 0), () => run(async () => {
          await besetzungApi.startAnswer({ placementId: p.id, way: choice === 'agree' ? 'agree' : 'disagree', note: note.trim() || undefined });
          return choice === 'agree' ? `Bestätigt: ${who} hat angefangen.` : 'Gesendet. Matchunt klärt das mit dem Headhunter und meldet sich.';
        }))}
      </div>
    );
  } else if (form === 'move' && p) {
    body = (
      <div className="space-y-3">
        <p className="text-sm font-medium">Start von {who} verschoben</p>
        {field('Neuer erster Arbeitstag', <Input type="date" min={todayKey()} className="h-9 w-48" value={date} onChange={(e) => setDate(e.target.value)} />)}
        <Textarea rows={2} placeholder="Grund in einem Satz (freiwillig)" value={note} onChange={(e) => setNote(e.target.value)} />
        <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">Eine Verschiebung ist zu melden (Rahmenvertrag § 10 Abs. 2). Die Rechnung bleibt so fällig wie gestellt. {hh} und Matchunt werden informiert.</p>
        {footer('Melden', !!date, () => run(async () => { const r = await besetzungApi.moveStart(p.id, date, note.trim()); return `Gemeldet. Neuer erster Arbeitstag: ${dateDe(r.startDate)}.`; }))}
      </div>
    );
  } else if (form === 'doc' && p) {
    body = (
      <div className="space-y-3">
        <p className="text-sm font-medium">Unterlage nachreichen</p>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40">
          <Upload className="h-4 w-4" />
          <span className="flex-1 truncate">{file ? file.name : `Kündigung, Absage oder Nachricht von ${who} (PDF, Bild, Mail · bis 5 MB)`}</span>
          <input type="file" accept={ACCEPT} className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        {footer('Hochladen', !!file, () => run(async () => { await besetzungApi.endDocument(p.id, file!.name, await fileToBase64(file!)); return 'Hochgeladen. Matchunt hat die Unterlage.'; }))}
      </div>
    );
  } else if (form === 'po' && p) {
    body = (
      <div className="space-y-3">
        <p className="text-sm font-medium">Bestellnummer ergänzen</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {field('Bestellnummer', <Input className="h-9" placeholder="z. B. 4500-1182" value={po} onChange={(e) => setPo(e.target.value)} />)}
          {field('Kostenstelle (freiwillig)', <Input className="h-9" placeholder="z. B. 410" value={cost} onChange={(e) => setCost(e.target.value)} />)}
        </div>
        <p className="text-xs text-muted-foreground">Steht auf der Rechnung. Ändern lässt sie sich, bis die Rechnung gestellt ist.</p>
        {footer('Speichern', !!(po.trim() || cost.trim()), () => run(async () => { await besetzungApi.setPurchaseOrder(p.id, po.trim(), cost.trim()); return 'Gespeichert. Die Nummer steht auf der Rechnung.'; }))}
      </div>
    );
  } else {
    body = (
      <>
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Schritte</p>
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
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Eckdaten</p>
          <FactGrid facts={factsOf(item)} onAction={(a) => { if (a === 'po') setForm('po'); }} />
        </div>
        {p && item.group === 'start' && !p.end && !p.startFixedAt && (
          <p className="text-xs text-muted-foreground">{hh} hält Kontakt zu {who} bis zum ersten Tag.</p>
        )}
        {acts.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Aktionen</p>
            <div className="flex flex-wrap gap-2">
              {acts.map((k) => <Button key={k} size="sm" variant={primary(k) ? 'default' : 'outline'} onClick={RUN[k]}>{LABEL[k]}</Button>)}
            </div>
          </div>
        )}
        {item.events.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Verlauf</p>
            <ol className="divide-y text-sm">
              {item.events.map((e, n) => (
                <li key={n} className="flex justify-between gap-3 py-1.5"><span>{e.text}</span><span className="shrink-0 text-xs text-muted-foreground">{dateDe(e.at)}</span></li>
              ))}
            </ol>
          </div>
        )}
        <div className="flex justify-end border-t pt-3"><Button variant="ghost" onClick={() => onOpenChange(false)}>Schließen</Button></div>
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader className="text-left">
          <div className="flex flex-wrap items-center gap-2 pr-6">
            <DialogTitle>Besetzung · {titleOf(item)}</DialogTitle>
            <StatusPill text={status.text} tone={status.tone} />
          </div>
          <DialogDescription>{item.jobTitle}{item.recruiterName ? ` · über ${item.recruiterName}` : ''}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">{body}</div>
      </DialogContent>
    </Dialog>
  );
}
