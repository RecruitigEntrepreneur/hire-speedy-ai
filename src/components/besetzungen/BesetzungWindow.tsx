import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { besetzungApi, DEPARTURE_GROUPS, fileToBase64, type BesetzungItem, type DepartureOutcome } from '@/lib/besetzungApi';
import { clientTasksApi } from '@/lib/clientTasksApi';
import { contractApi } from '@/lib/contractApi';
import { dateDe, factsOf, first, statusOf, stepsOf, todayKey } from './besetzungView';
import { FactGrid, StatusPill, StepRow } from './BesetzungParts';

/**
 * Fenster „Besetzung · Name“ (Etappe 2, 25.10.2026): Schritte, Eckdaten, Aktionen und
 * Verlauf einer Besetzung. Meldungen direkt hier (Start verschoben, tritt nicht an samt
 * Erklärung, ausgeschieden, Bestellnummer); Vertrag und „Hat angefangen?“ öffnen die
 * vorhandenen Fenster.
 */

type Form = 'move' | 'nicht' | 'doc' | 'po' | 'aus';

interface Props {
  item: BesetzungItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Vorhandenes Vertrags-Fenster */
  onContract: (submissionId: string) => void;
  /** Vorhandenes Aufgaben-Fenster „Hat angefangen?“ */
  onStartCheck: (item: BesetzungItem) => void;
}

const NON_START = [
  { key: 'not_started', label: 'nicht erschienen' }, { key: 'counter_offer', label: 'Gegenangebot angenommen' },
  { key: 'other_job', label: 'andere Stelle angetreten' }, { key: 'personal', label: 'persönliche Gründe' }, { key: 'other', label: 'anderer Grund' },
];
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.eml,.msg';

const DEPARTURE_DONE: Record<DepartureOutcome, string> = {
  claim: 'Gemeldet. Matchunt prüft den Fall. Danach bestätigen Sie die Stelle, und die erneute Suche startet.',
  no_continuity: 'Gemeldet. Der Headhunter und Matchunt sind informiert. Mit Core gibt es keine erneute Suche.',
  excluded: 'Gemeldet. Bei diesem Grund gibt es keine erneute Suche (Rahmenvertrag § 9 Abs. 4). Der Headhunter und Matchunt sind informiert.',
  outside: 'Gemeldet. Das Ausscheiden liegt nach dem Continuity-Zeitraum, eine erneute Suche ist nicht vorgesehen.',
  late: 'Gemeldet. Die Meldefrist war schon abgelaufen. Matchunt meldet sich bei Ihnen.',
};

export function BesetzungWindow({ item, open, onOpenChange, onContract, onStartCheck }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [po, setPo] = useState('');
  const [cost, setCost] = useState('');
  const [eventOn, setEventOn] = useState('');
  const [lastDay, setLastDay] = useState('');
  const [knownOn, setKnownOn] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(null); setDone(null); setDate(''); setNote(''); setReason(''); setFile(null);
    setPo(item?.placement?.purchaseOrder ?? ''); setCost(item?.placement?.costCenter ?? '');
    setEventOn(''); setLastDay(''); setKnownOn('');
  }, [open, item?.submissionId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null;
  const p = item.placement;
  const who = first(item.name);
  const hh = item.recruiterName?.split(' ')[0] ?? 'Der Headhunter';
  const status = statusOf(item);
  const startPassed = !!p && p.state === 'agreed' && !!p.startDate && p.startDate <= todayKey();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['besetzungen'] });
    queryClient.invalidateQueries({ queryKey: ['client-tasks'] });
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
  const upload = async (placementId: string, f: File) => besetzungApi.nonStartDocument(placementId, f.name, await fileToBase64(f));

  // Aktionen je Stand
  type Act = { label: string; run: () => void; primary?: boolean };
  const acts: Act[] = [];
  if (item.group === 'start' && !p) acts.push({ label: item.contract && item.contract.status !== 'preparing' ? 'Arbeitsvertrag öffnen' : 'Arbeitsvertrag schicken', run: () => onContract(item.submissionId), primary: true });
  if (item.group === 'start' && p && startPassed) acts.push({ label: 'Hat angefangen?', run: () => onStartCheck(item), primary: true });
  if (p && item.can?.moveStart && !startPassed) acts.push({ label: 'Start verschoben melden', run: () => setForm('move') });
  if (p && item.can?.nonStart && !startPassed) acts.push({ label: 'Tritt nicht an', run: () => setForm('nicht') });
  if (p && item.can?.nonStartDocument) acts.push({ label: 'Erklärung nachreichen', run: () => setForm('doc'), primary: true });
  if (p && item.can?.departure) acts.push({ label: 'Ausgeschieden melden', run: () => setForm('aus') });
  if (p && (!item.invoice?.number || item.invoice.status === 'draft') && !p.nonStartReportedAt) acts.push({ label: p.purchaseOrder ? 'Bestellnummer ändern' : 'Bestellnummer angeben', run: () => setForm('po') });
  if (item.contract?.status === 'final') acts.push({ label: 'Vertrag (PDF)', run: () => void openPdf(() => contractApi.document(item.submissionId)) });
  if (item.invoice?.number && item.invoice.status !== 'draft') acts.push({ label: 'Rechnung ansehen', run: () => { onOpenChange(false); navigate(`/dashboard/rechnungen?beleg=${item.invoice!.id}`); } });
  acts.push({ label: 'Bewerberprofil', run: () => { onOpenChange(false); navigate(`/dashboard/candidates/${item.submissionId}`); } });

  const continuity = !!item.package.continuityDays;
  const field = (label: string, el: React.ReactNode) => <label className="block text-sm"><span className="text-muted-foreground">{label}</span><div className="mt-1">{el}</div></label>;
  const footer = (cta: string, ok: boolean, submit: () => void) => (
    <div className="flex justify-end gap-2 border-t pt-3">
      <Button variant="ghost" onClick={() => setForm(null)}>Abbrechen</Button>
      <Button disabled={busy || !ok} onClick={submit}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{cta}</Button>
    </div>
  );
  const fileField = (optional: boolean) => (
    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40">
      <Upload className="h-4 w-4" />
      <span className="flex-1 truncate">{file ? file.name : `Erklärung von ${who} hochladen (PDF, Bild, Mail · bis 5 MB)${optional ? ' · auch später möglich' : ''}`}</span>
      <input type="file" accept={ACCEPT} className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
    </label>
  );

  let body: React.ReactNode;
  if (done) {
    body = (
      <>
        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <div><p className="font-medium">Erledigt.</p><p className="text-muted-foreground">{done}</p></div>
        </div>
        <div className="flex justify-end border-t pt-3"><Button variant="ghost" onClick={() => onOpenChange(false)}>Schließen</Button></div>
      </>
    );
  } else if (form === 'move' && p) {
    body = (
      <div className="space-y-3">
        <p className="text-sm font-medium">Start von {who} verschoben</p>
        {field('Neuer erster Arbeitstag', <Input type="date" min={todayKey()} className="h-9 w-48" value={date} onChange={(e) => setDate(e.target.value)} />)}
        <Textarea rows={2} placeholder="Grund in einem Satz (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">Eine Verschiebung ist zu melden (Rahmenvertrag § 10 Abs. 2). Die Rechnung bleibt so fällig wie gestellt (§ 8 Abs. 6). {hh} und Matchunt werden informiert.</p>
        {footer('Melden', !!date, () => run(async () => { const r = await besetzungApi.moveStart(p.id, date, note.trim()); return `Gemeldet. Neuer erster Arbeitstag: ${dateDe(r.startDate)}.`; }))}
      </div>
    );
  } else if (form === 'nicht' && p) {
    body = (
      <div className="space-y-3">
        <p className="text-sm font-medium">{who} tritt nicht an</p>
        <div className="flex flex-wrap gap-1.5">
          <span className="w-full text-xs text-muted-foreground">Grund (Pflicht)</span>
          {NON_START.map((r) => <Button key={r.key} type="button" size="sm" variant={reason === r.key ? 'secondary' : 'outline'} className="h-7 text-xs" onClick={() => setReason(r.key)}>{r.label}</Button>)}
        </div>
        <Textarea rows={2} placeholder="Was ist passiert? (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        {fileField(true)}
        <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          {continuity ? 'Mit Continuity wählen Sie zwischen Erstattung und erneuter Suche.' : 'Ein noch nicht gezahltes Honorar entfällt, ein gezahltes wird erstattet.'} Voraussetzung: Meldung binnen 14 Tagen ab Kenntnis, spätestens 14 Tage nach dem {dateDe(p.startDate)}, mit Erklärung der Person (Rahmenvertrag § 8 Abs. 8).
        </p>
        {footer('Nichtantritt melden', !!reason, () => run(async () => {
          await clientTasksApi.confirmStart({ placementId: p.id, way: 'not_started', reason, note: note.trim() || undefined });
          if (file) { await upload(p.id, file); return 'Gemeldet, mit Erklärung. Matchunt prüft den Fall und meldet sich.'; }
          return 'Gemeldet. Matchunt prüft den Fall. Die Erklärung können Sie über „Erklärung nachreichen“ hochladen.';
        }))}
      </div>
    );
  } else if (form === 'doc' && p) {
    body = (
      <div className="space-y-3">
        <p className="text-sm font-medium">Erklärung von {who} nachreichen</p>
        {fileField(false)}
        <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">Die Erklärung der Person gehört zur Meldung des Nichtantritts (Rahmenvertrag § 8 Abs. 8). Es reicht eine Mail oder ein Foto des Schreibens.</p>
        {footer('Hochladen', !!file, () => run(async () => { await upload(p.id, file!); return 'Hochgeladen. Matchunt hat die Erklärung.'; }))}
      </div>
    );
  } else if (form === 'po' && p) {
    body = (
      <div className="space-y-3">
        <p className="text-sm font-medium">Bestellnummer für die Rechnung</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {field('Bestellnummer', <Input className="h-9" placeholder="z. B. 4500-1182" value={po} onChange={(e) => setPo(e.target.value)} />)}
          {field('Kostenstelle (optional)', <Input className="h-9" placeholder="z. B. 4100" value={cost} onChange={(e) => setCost(e.target.value)} />)}
        </div>
        <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">Steht auf der Rechnung. Ist sie bei Ihnen Pflicht, gibt Matchunt die Rechnung erst danach frei.</p>
        {footer('Speichern', !!(po.trim() || cost.trim()), () => run(async () => { await besetzungApi.setPurchaseOrder(p.id, po.trim(), cost.trim()); return 'Gespeichert. Die Nummer steht auf der Rechnung.'; }))}
      </div>
    );
  } else if (form === 'aus' && p) {
    body = (
      <div className="space-y-3">
        <p className="text-sm font-medium">{who} ist ausgeschieden</p>
        {DEPARTURE_GROUPS.map((g) => (
          <div key={g.title} className="flex flex-wrap gap-1.5">
            <span className="w-full text-xs text-muted-foreground">{g.title}</span>
            {g.items.map((c) => <Button key={c.key} type="button" size="sm" variant={reason === c.key ? 'secondary' : 'outline'} className="h-7 text-xs" onClick={() => setReason(c.key)}>{c.label}</Button>)}
          </div>
        ))}
        <div className="grid gap-3 sm:grid-cols-3">
          {field('Kündigung zugegangen bzw. Aufhebung am', <Input type="date" max={todayKey()} className="h-9" value={eventOn} onChange={(e) => { setEventOn(e.target.value); if (!knownOn) setKnownOn(e.target.value); }} />)}
          {field('Letzter Arbeitstag', <Input type="date" className="h-9" value={lastDay} onChange={(e) => setLastDay(e.target.value)} />)}
          {field('Davon erfahren am', <Input type="date" max={todayKey()} className="h-9" value={knownOn} onChange={(e) => setKnownOn(e.target.value)} />)}
        </div>
        <Textarea rows={2} placeholder="Grund in einem Satz (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          {continuity
            ? `${item.package.name}: Matchunt sucht einmal erneut für dieselbe Stelle, ohne weiteres Honorar, wenn der Grund nicht auf Ihrer Seite liegt, also etwa nicht betriebsbedingt (Rahmenvertrag § 9 Abs. 4). Melden binnen 14 Tagen ab Kenntnis, spätestens am ${dateDe(p.reportUntil)}.`
            : `${who} ist im Paket Core: keine erneute Suche. Die Meldung informiert ${hh} und Matchunt.`}
        </p>
        {footer('Melden', !!(reason && eventOn && lastDay && knownOn), () => run(async () => {
          const r = await besetzungApi.reportDeparture({ placementId: p.id, category: reason, eventOn, lastDay, knownOn, note: note.trim() });
          return DEPARTURE_DONE[r.outcome];
        }))}
      </div>
    );
  } else {
    body = (
      <>
        <StepRow steps={stepsOf(item)} />
        <FactGrid facts={factsOf(item)} />
        {p && item.group === 'start' && !startPassed && (
          <p className="text-xs text-muted-foreground">{hh} hält Kontakt zu {who} bis zum ersten Tag.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {acts.map((a) => <Button key={a.label} size="sm" variant={a.primary ? 'default' : 'outline'} onClick={a.run}>{a.label}</Button>)}
        </div>
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
            <DialogTitle>Besetzung · {item.name}</DialogTitle>
            <StatusPill text={status.text} tone={status.tone} />
          </div>
          <DialogDescription>{item.jobTitle}{item.recruiterName ? ` · über ${item.recruiterName}` : ''}</DialogDescription>
        </DialogHeader>
        <div className={cn('space-y-4')}>{body}</div>
      </DialogContent>
    </Dialog>
  );
}
