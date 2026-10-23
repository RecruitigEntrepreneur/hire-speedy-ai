import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, FileDown, Loader2, TriangleAlert, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import {
  contractApi, contractData, contractDataPdf, contractDataText, dateDe, download, euro, fileToBase64, todayIso, type ContractContext,
} from '@/lib/contractApi';

interface Props {
  ctx: ContractContext | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Vorauswahl, z. B. aus der Erinnerungs-Mail („verschickt am …“) */
  initialWay?: 'digital' | 'self' | null;
}

const MAX_MB = 8;
const digits = (v: string) => {
  const n = Number(v.replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const fmt = (n: number | null) => (n ? new Intl.NumberFormat('de-DE').format(n) : '');

/** Arbeitsvertrag schicken (Kunde, Paket 3): digital über Matchunt oder selbst. Fenster in der Mitte. */
export function ContractDialog({ ctx, open, onOpenChange, initialWay = null }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [way, setWay] = useState<'digital' | 'self'>('digital');
  const [step, setStep] = useState<'choose' | 'upload'>('choose');
  const [sentOn, setSentOn] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [salary, setSalary] = useState('');
  const [variable, setVariable] = useState('');
  const [startDate, setStartDate] = useState('');
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [fixedTerm, setFixedTerm] = useState<boolean | null>(null);
  const [nonCompete, setNonCompete] = useState<boolean | null>(null);
  const [closeJob, setCloseJob] = useState(true);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !ctx) return;
    setWay(initialWay ?? (ctx.digitalAvailable ? 'digital' : 'self'));
    // Aus der Aufgabe „Digital über Matchunt“ direkt zum Hochladen
    setStep(initialWay === 'digital' && ctx.digitalAvailable ? 'upload' : 'choose');
    setSentOn(initialWay === 'self' ? todayIso() : '');
    setFile(null);
    setSalary(fmt(ctx.offer?.salary ?? null));
    setVariable(fmt(ctx.offer?.variable ?? null));
    setStartDate(ctx.offer?.startDate ?? '');
    setSignerName((user?.user_metadata as any)?.full_name ?? '');
    setSignerEmail(user?.email ?? '');
    setCandidateEmail(ctx.candidateEmail ?? '');
    setFixedTerm(ctx.offer?.contractType === 'fixed_term' ? true : null);
    setNonCompete(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ctx?.submissionId, initialWay]);

  if (!ctx) return null;
  const first = ctx.candidateName.split(' ')[0];
  const hh = ctx.recruiterName ?? 'Ihr Headhunter';
  const o = ctx.offer;
  const strict = fixedTerm === true || nonCompete === true;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['contract', ctx.submissionId] });
    queryClient.invalidateQueries({ queryKey: ['submission-state'] });
    queryClient.invalidateQueries({ queryKey: ['bewerber'] });
  };

  const saveSelf = async () => {
    setBusy(true);
    try {
      await contractApi.sendSelf(ctx.submissionId, sentOn || null);
      toast.success(sentOn ? `Gespeichert. ${hh} weiß Bescheid und hakt bei ${first} nach.` : 'Gespeichert. Melden Sie die Unterschrift hier, sobald sie da ist.');
      refresh();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Das hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };

  const sendDigital = async () => {
    if (!file) return;
    setBusy(true);
    try {
      await contractApi.sendDigital({
        submissionId: ctx.submissionId, fileBase64: await fileToBase64(file), fileName: file.name,
        salary: digits(salary), variable: digits(variable), startDate,
        signerName: signerName.trim(), signerEmail: signerEmail.trim(), candidateEmail: candidateEmail.trim(),
        fixedTerm: !!fixedTerm, nonCompete: !!nonCompete, closeJob,
      });
      toast.success(`Verschickt. Erst unterschreibt ${signerName.trim() || 'die Firma'}, dann ${first}.`);
      refresh();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Das hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(contractDataText(ctx));
    toast.success('Vertragsdaten kopiert.');
  };
  const pdf = async () => download(await contractDataPdf(ctx), `Vertragsdaten_${ctx.candidateName.replace(/\s+/g, '_')}.pdf`);

  const pickFile = (f: File | null) => {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) { toast.error('Bitte eine PDF-Datei wählen.'); return; }
    if (f.size > MAX_MB * 1024 * 1024) { toast.error(`Die Datei ist größer als ${MAX_MB} MB.`); return; }
    setFile(f);
  };

  const yesNo = (value: boolean | null, set: (v: boolean) => void, label: string) => (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span>{label}</span>
      <div className="inline-flex rounded-md border border-border/60 bg-muted/30 p-0.5">
        {[true, false].map((v) => (
          <button key={String(v)} type="button" onClick={() => set(v)}
            className={cn('rounded px-3 py-1 text-xs', value === v ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground')}>{v ? 'ja' : 'nein'}</button>
        ))}
      </div>
    </div>
  );

  const readyDigital = !!file && !!digits(salary) && !!startDate && !!signerName.trim() && /\S+@\S+\.\S+/.test(signerEmail) && /\S+@\S+\.\S+/.test(candidateEmail) && fixedTerm === false && nonCompete === false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="text-left">
          <DialogTitle>Arbeitsvertrag für {ctx.candidateName}</DialogTitle>
          <DialogDescription>
            {o ? `Zusage${o.acceptedAt ? ` vom ${dateDe(o.acceptedAt)}` : ''}: ${euro(o.salary)}${o.variable ? ` + ${euro(o.variable)}` : ''}${o.startDate ? `, Start ${dateDe(o.startDate)}` : ''}` : ctx.jobTitle}
          </DialogDescription>
        </DialogHeader>

        {step === 'choose' ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" disabled={!ctx.digitalAvailable} onClick={() => setWay('digital')}
                className={cn('rounded-lg border p-3 text-left text-sm transition-colors', way === 'digital' ? 'border-primary bg-primary/[0.04]' : 'border-border/60 hover:bg-muted/40', !ctx.digitalAvailable && 'opacity-50')}>
                <p className="font-medium">Digital über Matchunt <span className="ml-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-600">empfohlen</span></p>
                <p className="mt-1 text-muted-foreground">{ctx.digitalAvailable ? `Sie laden Ihren Vertrag hoch. Erst unterschreiben Sie, dann ${first}, per DocuSign. Kostenlos, meist am selben Tag erledigt.` : 'Die digitale Unterschrift ist gerade nicht eingerichtet.'}</p>
              </button>
              <button type="button" onClick={() => setWay('self')}
                className={cn('rounded-lg border p-3 text-left text-sm transition-colors', way === 'self' ? 'border-primary bg-primary/[0.04]' : 'border-border/60 hover:bg-muted/40')}>
                <p className="font-medium">Selbst verschicken</p>
                <p className="mt-1 text-muted-foreground">Papier oder Ihr eigenes Tool. Sie melden die Unterschrift hier mit einem Klick.</p>
              </button>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Vertragsdaten aus der Zusage (zum Übernehmen in Ihren Vertrag)</p>
              <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1">
                {contractData(ctx).map((r) => (
                  <div key={r.label} className="contents">
                    <dt className="text-muted-foreground">{r.label}</dt>
                    <dd className={cn(r.missing && 'text-amber-600 dark:text-amber-400')}>{r.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-xs text-muted-foreground">Übliche Angaben für Vertrag bzw. Nachweis. Ihren Vertragstext formulieren Sie selbst; wir geben keine Rechtsberatung.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={pdf}><FileDown className="h-3.5 w-3.5" />Vertragsdaten als PDF</Button>
                <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={copy}><Copy className="h-3.5 w-3.5" />Kopieren</Button>
              </div>
            </div>

            {way === 'digital' && ctx.digitalDemo && (
              <p className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/[0.06] p-2 text-xs text-amber-700 dark:text-amber-400"><TriangleAlert className="h-4 w-4 shrink-0" />
                DocuSign läuft noch im Testbetrieb: Darüber unterschriebene Verträge sind nicht rechtsverbindlich. Für eine echte Einstellung bitte „Selbst verschicken“.</p>
            )}
            {way === 'self' && (
              <label className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Verschickt am (optional)</span>
                <Input type="date" value={sentOn} max={todayIso()} onChange={(e) => setSentOn(e.target.value)} className="h-8 w-44" />
                <span className="text-xs text-muted-foreground">{hh} hakt dann bei {first} nach.</span>
              </label>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Abbrechen</Button>
              {way === 'digital'
                ? <Button disabled={!ctx.digitalAvailable} onClick={() => setStep('upload')}>Weiter: Vertrag hochladen</Button>
                : <Button disabled={busy} onClick={saveSelf}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Speichern</Button>}
            </div>
          </>
        ) : (
          <>
            <input ref={fileInput} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => fileInput.current?.click()}
              className="flex w-full items-center gap-3 rounded-lg border border-dashed p-4 text-left text-sm hover:bg-muted/40">
              <Upload className="h-5 w-5 text-muted-foreground" />
              {file ? <span><span className="font-medium">{file.name}</span> · {(file.size / 1024 / 1024).toFixed(1)} MB · <span className="text-muted-foreground">ersetzen</span></span>
                : <span>Ihren fertigen Arbeitsvertrag als PDF hochladen (bis {MAX_MB} MB)</span>}
            </button>

            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <label className="block"><span className="text-muted-foreground">Gehalt fix laut Vertrag</span>
                <Input inputMode="numeric" value={salary} onChange={(e) => setSalary(fmt(digits(e.target.value)))} className="mt-1 h-9" /></label>
              <label className="block"><span className="text-muted-foreground">Variabel</span>
                <Input inputMode="numeric" value={variable} onChange={(e) => setVariable(fmt(digits(e.target.value)))} placeholder="keins" className="mt-1 h-9" /></label>
              <label className="block"><span className="text-muted-foreground">Beginn laut Vertrag</span>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 h-9" /></label>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <label className="block"><span className="text-muted-foreground">Unterschreibt für {ctx.companyName}</span>
                <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Name" className="mt-1 h-9" />
                <Input value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} placeholder="Mail" className="mt-1 h-9" /></label>
              <label className="block"><span className="text-muted-foreground">Danach unterschreibt {ctx.candidateName}</span>
                <Input value={candidateEmail} onChange={(e) => setCandidateEmail(e.target.value)} placeholder="Mail" className="mt-1 h-9" />
                <span className="mt-1 block text-xs text-muted-foreground">Mail aus der Freigabe. DocuSign schickt den Umschlag; ein Konto braucht niemand.</span></label>
            </div>
            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
              {yesNo(fixedTerm, setFixedTerm, 'Ist der Vertrag befristet?')}
              {yesNo(nonCompete, setNonCompete, 'Enthält er ein Wettbewerbsverbot nach dem Ende?')}
              {strict && (
                <p className="flex gap-2 text-xs text-amber-700 dark:text-amber-400"><TriangleAlert className="h-4 w-4 shrink-0" />
                  Dafür gilt die strenge Schriftform; eine einfache digitale Unterschrift reicht nicht. Bitte „Selbst verschicken“ wählen.</p>
              )}
              <p className="text-xs text-muted-foreground">{first} kann zusätzlich eine Papierfassung verlangen. Wir hängen eine Unterschriftenseite an, auf der beide unterschreiben.</p>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={closeJob} onChange={(e) => setCloseJob(e.target.checked)} />
              <span>Nach der Unterschrift die Stelle als besetzt schließen. <span className="text-muted-foreground">Bei mehreren Plätzen den Haken entfernen.</span></span>
            </label>

            <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
              <Button variant="ghost" onClick={() => setStep('choose')}>Zurück</Button>
              {strict && <Button variant="outline" onClick={() => { setWay('self'); setStep('choose'); }}>Selbst verschicken</Button>}
              <Button disabled={busy || !readyDigital} onClick={sendDigital}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Zur Unterschrift senden</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
