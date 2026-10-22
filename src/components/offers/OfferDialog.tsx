import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Loader2, Plus, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { dayDe, euro, offerApi, plusWorkdays, type OfferContext, type OfferInput } from '@/lib/offerApi';

interface Props {
  submissionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
}

const digits = (v: string) => {
  const n = Number(v.replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const fmt = (n: number | null) => (n ? new Intl.NumberFormat('de-DE').format(n) : '');
/** „ab 150.000 €“ → 150000 (erste Zahl im Text) */
const firstNumber = (s: string | undefined) => {
  const m = s?.replace(/\./g, '').match(/\d{4,}/);
  return m ? Number(m[0]) : null;
};
/** „ab 01.01.2027“ → 2027-01-01 */
const firstDate = (s: string | undefined) => {
  const m = s?.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
};

/** Angebot machen bzw. anpassen: Fenster in der Mitte, geht an den Headhunter. */
export function OfferDialog({ submissionId, open, onOpenChange, onSent }: Props) {
  const ctx = useQuery({ queryKey: ['offer-context', submissionId], queryFn: () => offerApi.context(submissionId), enabled: open, staleTime: 10_000 });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        {ctx.isLoading || !ctx.data ? (
          <>
            <DialogHeader><DialogTitle>Angebot</DialogTitle><DialogDescription>wird geladen …</DialogDescription></DialogHeader>
            {ctx.error
              ? <p className="text-sm text-destructive">{ctx.error instanceof Error ? ctx.error.message : 'Konnte nicht geladen werden.'}</p>
              : <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </>
        ) : (
          <OfferForm c={ctx.data} onClose={() => onOpenChange(false)} onSent={onSent} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function OfferForm({ c, onClose, onSent }: { c: OfferContext; onClose: () => void; onSent?: () => void }) {
  const queryClient = useQueryClient();
  const hh = c.recruiterName?.trim() || 'Ihr Headhunter';
  const name = c.candidateName || 'den Kandidaten';
  const first = (c.candidateName ?? '').split(' ')[0] || 'dem Kandidaten';
  const cur = c.currentOffer && ['with_recruiter', 'considering', 'countered'].includes(c.currentOffer.status) ? c.currentOffer : null;
  const wish = cur?.status === 'countered' ? cur.response?.wish : null;
  const rec = c.recommendation;
  const recFix = rec?.items.find((i) => i.key === 'fix');
  const recStart = rec?.items.find((i) => i.key === 'start');

  const [salary, setSalary] = useState(fmt(wish?.salary ?? cur?.salary ?? null));
  const [variable, setVariable] = useState(fmt(wish?.variable ?? cur?.variable ?? null));
  const [startDate, setStartDate] = useState(wish?.startDate ?? cur?.startDate ?? firstDate(recStart?.value) ?? '');
  const [responseDue, setResponseDue] = useState(plusWorkdays(5));
  const [contractType, setContractType] = useState<'permanent' | 'fixed_term'>((cur?.contractType as 'permanent' | 'fixed_term') ?? 'permanent');
  const [probation, setProbation] = useState<number>(cur?.probationMonths ?? c.defaults.probationMonths);
  const [workModel, setWorkModel] = useState(cur?.workModel ?? c.defaults.workModel);
  const [extras, setExtras] = useState<string[]>(cur?.extras ?? []);
  const [extraOptions] = useState<string[]>(() => [...new Set([...c.defaults.extras, ...(cur?.extras ?? [])])]);
  const [newExtra, setNewExtra] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState<string[]>([]);

  const fix = digits(salary);
  const varNum = digits(variable);
  const target = (fix ?? 0) + (varNum ?? 0);
  const fee = c.feePercent && target ? Math.round((target * c.feePercent) / 100) : null;
  const recFixNum = firstNumber(recFix?.value);
  const recStartDate = firstDate(recStart?.value);
  const inRange = fix && c.salaryMin && c.salaryMax ? fix >= c.salaryMin && fix <= c.salaryMax : null;
  const ready = !!fix && !!startDate && !!responseDue;

  const input: OfferInput | null = useMemo(() => (ready ? {
    submissionId: c.submissionId, salary: fix!, variable: varNum, startDate, responseDue, contractType, probationMonths: probation,
    workModel: workModel.trim(), extras, message: message.trim(),
  } : null), [ready, c.submissionId, fix, varNum, startDate, responseDue, contractType, probation, workModel, extras, message]);

  const toggleExtra = (x: string) => setExtras((cur) => (cur.includes(x) ? cur.filter((y) => y !== x) : [...cur, x]));
  const addExtra = () => {
    const x = newExtra.trim();
    if (!x) return;
    setCustom((cur) => (cur.includes(x) ? cur : [...cur, x]));
    setExtras((cur) => (cur.includes(x) ? cur : [...cur, x]));
    setNewExtra('');
  };

  const send = async () => {
    if (!input) return;
    setBusy(true);
    try {
      await offerApi.create(input);
      toast.success(`${cur ? 'Angepasstes Angebot' : 'Angebot'} an ${hh} gesendet. ${hh} bespricht es mit ${first}.`);
      queryClient.invalidateQueries({ queryKey: ['offer-context', c.submissionId] });
      queryClient.invalidateQueries({ queryKey: ['submission-state'] });
      queryClient.invalidateQueries({ queryKey: ['bewerber'] });
      onSent?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Das Angebot konnte nicht gesendet werden.');
    } finally {
      setBusy(false);
    }
  };

  const Hint = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
    <p className={cn('mt-1 flex items-center gap-1 text-xs', ok ? 'text-emerald-600' : 'text-amber-600')}>
      {ok ? <Check className="h-3 w-3" /> : <TriangleAlert className="h-3 w-3" />}{children}
    </p>
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle>{cur ? 'Angebot anpassen' : 'Angebot'} für {name}</DialogTitle>
        <DialogDescription>{c.jobTitle} · geht an {hh}, {hh.split(' ')[0]} bespricht es mit {first}</DialogDescription>
      </DialogHeader>

      {rec && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3 text-sm">
          <p className="font-medium">Empfehlung von {hh}</p>
          {rec.intro && <p className="mt-0.5 text-muted-foreground">„{rec.intro}“</p>}
          <ul className="mt-1.5 grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
            {rec.items.map((i) => <li key={i.key}><span className="text-muted-foreground">{i.label}:</span> {i.value}</li>)}
          </ul>
        </div>
      )}
      {wish && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3 text-sm">
          Gegenwunsch von {first}: {[wish.salary && `${euro(wish.salary)} fix`, wish.variable && `${euro(wish.variable)} variabel`, wish.startDate && `Start ${dayDe(wish.startDate)}`, wish.other].filter(Boolean).join(' · ')}
          {cur?.response?.reason && <span className="text-muted-foreground"> · „{cur.response.reason}“</span>}
        </div>
      )}

      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
        <div>
          <label htmlFor="offer-fix" className="text-sm font-medium">Fixgehalt pro Jahr</label>
          <Input id="offer-fix" inputMode="numeric" value={salary} onChange={(e) => setSalary(fmt(digits(e.target.value)))} placeholder="140.000" className="mt-1" />
          {fix && recFixNum ? <Hint ok={fix >= recFixNum}>{fix >= recFixNum ? 'passt zur Empfehlung' : `Empfehlung: ab ${euro(recFixNum)}`}</Hint>
            : inRange !== null && fix ? <Hint ok={inRange}>{inRange ? `im Rahmen der Stelle (${euro(c.salaryMin)} bis ${euro(c.salaryMax)})` : `außerhalb des Rahmens (${euro(c.salaryMin)} bis ${euro(c.salaryMax)})`}</Hint> : null}
        </div>
        <div>
          <label htmlFor="offer-var" className="text-sm font-medium">Variabel bei 100 % <span className="font-normal text-muted-foreground">(optional)</span></label>
          <Input id="offer-var" inputMode="numeric" value={variable} onChange={(e) => setVariable(fmt(digits(e.target.value)))} placeholder="20.000" className="mt-1" />
        </div>
        <div>
          <label htmlFor="offer-start" className="text-sm font-medium">Erster Arbeitstag</label>
          <Input id="offer-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" />
          {startDate && recStartDate && <Hint ok={startDate >= recStartDate}>{startDate >= recStartDate ? 'passt zur Empfehlung' : `Empfehlung: ${recStart?.value}`}</Hint>}
        </div>
        <div>
          <label htmlFor="offer-due" className="text-sm font-medium">Antwort bis</label>
          <Input id="offer-due" type="date" value={responseDue} onChange={(e) => setResponseDue(e.target.value)} className="mt-1" />
          <p className="mt-1 text-xs text-muted-foreground">Standard: 5 Werktage</p>
        </div>
        <div>
          <label htmlFor="offer-contract" className="text-sm font-medium">Vertragsart und Probezeit</label>
          <div className="mt-1 flex gap-2">
            <select id="offer-contract" value={contractType} onChange={(e) => setContractType(e.target.value as 'permanent' | 'fixed_term')} className="h-10 flex-1 rounded-md border bg-background px-2 text-sm">
              <option value="permanent">unbefristet</option>
              <option value="fixed_term">befristet</option>
            </select>
            <select aria-label="Probezeit" value={probation} onChange={(e) => setProbation(Number(e.target.value))} className="h-10 w-36 rounded-md border bg-background px-2 text-sm">
              {[0, 3, 6].map((m) => <option key={m} value={m}>{m ? `${m} Monate Probezeit` : 'ohne Probezeit'}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="offer-model" className="text-sm font-medium">Ort und Arbeitsmodell</label>
          <Input id="offer-model" value={workModel} onChange={(e) => setWorkModel(e.target.value)} maxLength={200} className="mt-1" />
        </div>
      </div>

      <div>
        <p className="text-sm font-medium">Extras <span className="font-normal text-muted-foreground">(aus der Aufnahme, anklickbar)</span></p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {[...extraOptions, ...custom.filter((x) => !extraOptions.includes(x))].map((x) => (
            <button key={x} type="button" aria-pressed={extras.includes(x)} onClick={() => toggleExtra(x)}
              className={cn('rounded-full border px-3 py-1 text-xs transition-colors', extras.includes(x) ? 'border-foreground bg-foreground text-background' : 'hover:bg-accent')}>
              {x}
            </button>
          ))}
          <span className="inline-flex items-center gap-1">
            <Input value={newExtra} onChange={(e) => setNewExtra(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExtra(); } }} placeholder="eigenes Extra" className="h-7 w-36 text-xs" aria-label="Eigenes Extra" />
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={addExtra} aria-label="Extra hinzufügen"><Plus className="h-3.5 w-3.5" /></Button>
          </span>
        </div>
      </div>

      <div>
        <label htmlFor="offer-msg" className="text-sm font-medium">Nachricht an {hh} <span className="font-normal text-muted-foreground">(optional)</span></label>
        <Textarea id="offer-msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={2000} placeholder="Beim Start sind wir flexibel, Februar ginge auch." className="mt-1" />
      </div>

      <div className="space-y-1 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
        <p>Das Angebot geht an {hh}. {hh.split(' ')[0]} bespricht es mit {first} und trägt die Antwort hier ein, meist in 1 bis 3 Tagen. Den Arbeitsvertrag schicken Sie nach der Zusage.</p>
        {fee && <p>Honorar laut Rahmenvertrag: {c.feePercent} % vom Zielgehalt ({euro(target)}) = {euro(fee)} zzgl. USt. Fällig erst, wenn der Vertrag unterschrieben ist.</p>}
        {c.otherOpenOffers > 0 && <p>Für diese Stelle läuft schon {c.otherOpenOffers === 1 ? 'ein weiteres Angebot' : `${c.otherOpenOffers} weitere Angebote`}. Beides ist möglich.</p>}
        {cur && <p>Das bisherige Angebot gilt danach als ersetzt.</p>}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Abbrechen</Button>
        <Button disabled={!ready || busy} onClick={send} className="gap-1.5">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {cur ? 'Angepasstes Angebot senden' : `Angebot an ${hh.split(' ')[0]} senden`}
        </Button>
      </div>
    </>
  );
}
