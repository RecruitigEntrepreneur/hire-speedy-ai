import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { contractApi, dateDe, euro, todayIso, type ContractContext } from '@/lib/contractApi';

interface Props {
  ctx: ContractContext | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** report = melden; values = Meldung des Headhunters mit anderen Werten bestätigen */
  mode?: 'report' | 'values';
  onDone?: () => void;
}

const digits = (v: string) => {
  const n = Number(v.replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const fmt = (n: number | null) => (n ? new Intl.NumberFormat('de-DE').format(n) : '');

/**
 * „Vertrag unterschrieben“ melden (Paket 3): Kunde (24 h rückgängig), Headhunter
 * (Kunde bestätigt) oder Matchunt (mit Beleg direkt). Fenster in der Mitte.
 */
export function ContractReportDialog({ ctx, open, onOpenChange, mode = 'report', onDone }: Props) {
  const queryClient = useQueryClient();
  const c = ctx?.contract ?? null;
  const [signedOn, setSignedOn] = useState(todayIso());
  const [salary, setSalary] = useState('');
  const [variable, setVariable] = useState('');
  const [startDate, setStartDate] = useState('');
  const [note, setNote] = useState('');
  const [evidence, setEvidence] = useState('');
  const [closeJob, setCloseJob] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !ctx) return;
    setSignedOn(c?.signedOn ?? todayIso());
    setSalary(fmt(c?.salary ?? ctx.offer?.salary ?? null));
    setVariable(fmt(c?.variable ?? ctx.offer?.variable ?? null));
    setStartDate(c?.startDate ?? ctx.offer?.startDate ?? '');
    setNote(''); setEvidence(''); setCloseJob(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ctx?.submissionId]);

  if (!ctx) return null;
  const role = ctx.role;
  const first = ctx.candidateName.split(' ')[0];
  const sal = digits(salary);
  const vari = digits(variable);
  const fee = ctx.feePercent && sal ? Math.round(((sal + (vari ?? 0)) * ctx.feePercent) / 100) : null;
  const ready = !!signedOn && signedOn <= todayIso() && !!sal && !!startDate;
  const title = role === 'recruiter' ? `${first} hat unterschrieben` : mode === 'values' ? `Unterschrift mit anderen Werten bestätigen` : `Vertrag mit ${ctx.candidateName} unterschrieben`;

  const save = async () => {
    setBusy(true);
    try {
      const values = { submissionId: ctx.submissionId, signedOn, salary: sal, variable: vari, startDate };
      if (mode === 'values') await contractApi.confirm(ctx.submissionId, 'values', values);
      else await contractApi.report({ ...values, closeJob: role === 'client' ? closeJob : undefined, note: note || undefined, evidence: evidence || undefined });
      toast.success(role === 'client' ? (mode === 'values' ? 'Bestätigt. Die Einstellung ist verbindlich.' : 'Unterschrift gemeldet. 24 Stunden lang können Sie zurücknehmen.')
        : role === 'recruiter' ? `Gemeldet. ${ctx.companyName} bestätigt noch.` : evidence ? 'Mit Beleg bestätigt.' : 'Gemeldet. Der Kunde bestätigt noch.');
      queryClient.invalidateQueries({ queryKey: ['contract', ctx.submissionId] });
      queryClient.invalidateQueries({ queryKey: ['submission-state'] });
      queryClient.invalidateQueries({ queryKey: ['bewerber'] });
      onDone?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Das hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {ctx.jobTitle} · {role === 'recruiter' ? ctx.companyName : `über ${ctx.recruiterName ?? 'Ihren Headhunter'}`}. Beide Seiten haben unterschrieben; das Datum ist die letzte Unterschrift.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <label className="block"><span className="text-muted-foreground">Unterschrieben am</span>
            <Input type="date" value={signedOn} max={todayIso()} onChange={(e) => setSignedOn(e.target.value)} className="mt-1 h-9" /></label>
          <label className="block"><span className="text-muted-foreground">Erster Arbeitstag</span>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 h-9" /></label>
          <label className="block"><span className="text-muted-foreground">Gehalt fix laut Vertrag</span>
            <Input inputMode="numeric" value={salary} onChange={(e) => setSalary(fmt(digits(e.target.value)))} className="mt-1 h-9" /></label>
          <label className="block"><span className="text-muted-foreground">Variabel bei 100 %</span>
            <Input inputMode="numeric" value={variable} onChange={(e) => setVariable(fmt(digits(e.target.value)))} placeholder="keins" className="mt-1 h-9" /></label>
        </div>
        {ctx.offer && sal && sal !== ctx.offer.salary && (
          <p className="text-xs text-amber-600 dark:text-amber-400">Weicht von der Zusage ab ({euro(ctx.offer.salary)}). Es gilt der Wert laut Vertrag.</p>
        )}

        {role === 'client' && mode === 'report' && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={closeJob} onChange={(e) => setCloseJob(e.target.checked)} />
            <span>Stelle danach als besetzt schließen. <span className="text-muted-foreground">Andere Headhunter werden informiert. Bei mehreren Plätzen den Haken entfernen.</span></span>
          </label>
        )}
        {role === 'recruiter' && (
          <label className="block text-sm"><span className="text-muted-foreground">Notiz (optional)</span>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={`z. B. ${first} hat es heute am Telefon bestätigt`} className="mt-1 h-9" /></label>
        )}
        {role === 'admin' && mode === 'report' && (
          <label className="block text-sm"><span className="text-muted-foreground">Beleg (Mail des Kunden, Telefonnotiz). Mit Beleg ist die Meldung sofort verbindlich, ohne bestätigt der Kunde.</span>
            <Textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} rows={2} placeholder="z. B. Telefonat mit Frau Linn am 22.10.: Vertrag am 15.10. unterschrieben" className="mt-1" /></label>
        )}

        <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
          {role === 'client' && fee !== null && <p>Honorar: {ctx.feePercent} % von {euro(sal! + (vari ?? 0))} = <span className="font-medium text-foreground">{euro(fee)}</span> zzgl. USt.</p>}
          {role === 'client' && mode === 'report' && <p className="mt-1">24 Stunden lang können Sie die Meldung zurücknehmen. Danach ist die Einstellung verbindlich. {ctx.recruiterName ?? 'Ihr Headhunter'} bestätigt die Unterschrift parallel bei {first}.</p>}
          {role === 'client' && mode === 'values' && <p className="mt-1">Mit Ihrer Bestätigung ist die Einstellung verbindlich. Es gelten die Werte laut Vertrag.</p>}
          {role === 'recruiter' && <p>{ctx.companyName} bekommt „Stimmt das?“. Erst nach der Bestätigung ist die Einstellung verbindlich.</p>}
          {role === 'admin' && <p>Stand der Zusage: {ctx.offer ? `${euro(ctx.offer.salary)}${ctx.offer.variable ? ` + ${euro(ctx.offer.variable)}` : ''}, Start ${dateDe(ctx.offer.startDate)}` : 'keine Zusage im System'}.</p>}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button disabled={busy || !ready} onClick={save}>
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {role === 'client' ? (mode === 'values' ? 'Bestätigen' : 'Unterschrift bestätigen') : 'Melden'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
