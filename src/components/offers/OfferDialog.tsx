import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Loader2, Lock, Plus, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { dayDe, euro, offerApi, plusWorkdays, whenDe, type OfferContext, type OfferInput } from '@/lib/offerApi';
import { EinsatzForm } from './EinsatzForm';

interface Props {
  submissionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
  /** Statt des Angebots: erst eine Frage an den Headhunter */
  onAsk?: () => void;
  /** Statt des Angebots: doch absagen */
  onReject?: () => void;
}

/** Vorbelegt, bis der Kunde etwas anderes schreibt: Die Zeile steht direkt über dem Senden-Knopf. */
const DEFAULT_LINE = 'Wir würden uns sehr freuen, Sie bald in unserem Team zu begrüßen.';
/** Stichworte für die Zeile an den Kandidaten; nur was die Mail nicht ohnehin sagt. */
const LINE_CHIPS = [
  { key: 'ueberzeugt', label: 'Was uns überzeugt hat', text: 'Besonders überzeugt hat uns, ' },
  { key: 'team', label: 'Team vorab kennenlernen', text: 'Gern zeigen wir Ihnen vor dem Start Ihr künftiges Team.' },
];
const SPIELRAUM = [
  { key: 'gehalt', label: 'Gehalt', text: 'beim Gehalt' },
  { key: 'start', label: 'Startdatum', text: 'beim Startdatum' },
  { key: 'modell', label: 'Arbeitsmodell', text: 'beim Arbeitsmodell' },
];
const NO_ROOM = 'kein';
/** Was beim Headhunter ankommt: Spielraum als Satz, dahinter sein freier Text. */
function noteForRecruiter(room: string[], note: string): string {
  const parts = SPIELRAUM.filter((x) => room.includes(x.key)).map((x) => x.text);
  const line = room.includes(NO_ROOM) ? 'Das ist unser bestes Angebot.'
    : parts.length ? `Spielraum ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} und ${parts[parts.length - 1]}` : parts[0]}.` : '';
  return [line, note.trim()].filter(Boolean).join(' ');
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
export function OfferDialog({ submissionId, open, onOpenChange, onSent, onAsk, onReject }: Props) {
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
        ) : ctx.data.contracting ? (
          // Contracting: kein Angebot über ein Gehalt, sondern „Einsatz anfragen“ (Etappe 1, 11.11.2026)
          <EinsatzForm c={ctx.data} onClose={() => onOpenChange(false)} onSent={onSent} onAsk={onAsk} onReject={onReject} />
        ) : (
          <OfferForm c={ctx.data} onClose={() => onOpenChange(false)} onSent={onSent} onAsk={onAsk} onReject={onReject} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function OfferForm({ c, onClose, onSent, onAsk, onReject }: { c: OfferContext; onClose: () => void; onSent?: () => void; onAsk?: () => void; onReject?: () => void }) {
  const queryClient = useQueryClient();
  const hh = c.recruiterName?.trim() || 'Ihr Headhunter';
  const hhFirst = hh.split(' ')[0];
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
  const [note, setNote] = useState('');
  const [room, setRoom] = useState<string[]>([]);
  const [candidateMessage, setCandidateMessage] = useState(cur ? cur.candidateMessage ?? '' : DEFAULT_LINE);
  const [usedChips, setUsedChips] = useState<string[]>([]);
  const [step, setStep] = useState<1 | 2>(1);
  const [sentMailAt, setSentMailAt] = useState<string | null | undefined>(undefined);
  const lineRef = useRef<HTMLTextAreaElement>(null);
  // Das Profil lädt beim Aktualisieren neu und baut dieses Fenster dabei neu auf: erst beim Schließen
  // aktualisieren, sonst wäre die Bestätigung weg
  const sentRef = useRef(false);
  const afterClose = useRef(onSent);
  afterClose.current = onSent;
  useEffect(() => () => {
    if (!sentRef.current) return;
    queryClient.invalidateQueries({ queryKey: ['offer-context', c.submissionId] });
    queryClient.invalidateQueries({ queryKey: ['submission-state'] });
    queryClient.invalidateQueries({ queryKey: ['bewerber'] });
    afterClose.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const message = noteForRecruiter(room, note);
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
  // „Besonders überzeugt hat uns, “ darf nicht halb fertig zum Kandidaten gehen
  const lineUnfinished = /,\s*$/.test(candidateMessage);

  const input: OfferInput | null = useMemo(() => (ready ? {
    submissionId: c.submissionId, salary: fix!, variable: varNum, startDate, responseDue, contractType, probationMonths: probation,
    workModel: workModel.trim(), extras, message: message.trim(), candidateMessage: candidateMessage.trim(),
  } : null), [ready, c.submissionId, fix, varNum, startDate, responseDue, contractType, probation, workModel, extras, message, candidateMessage]);

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
      const res = await offerApi.create(input);
      setSentMailAt(res.candidateMailAt ?? null);
      sentRef.current = true;
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

  if (sentMailAt !== undefined) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{cur ? 'Angebot anpassen' : 'Angebot'} für {name}</DialogTitle>
          <DialogDescription>{c.jobTitle}</DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3 text-sm">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <div>
            <p className="font-medium">Angebot liegt bei {hh}</p>
            <p className="text-muted-foreground">{hhFirst} ruft {first} an.{sentMailAt ? ` Spätestens ${whenDe(sentMailAt, Date.now())} bekommt ${first} es per Mail.` : ''}</p>
          </div>
        </div>
        <div className="flex justify-end"><Button onClick={onClose}>Fertig</Button></div>
      </>
    );
  }

  if (step === 2) {
    const toggleRoom = (key: string) => setRoom((list) => (key === NO_ROOM
      ? (list.includes(NO_ROOM) ? [] : [NO_ROOM])
      : list.includes(key) ? list.filter((x) => x !== key) : [...list.filter((x) => x !== NO_ROOM), key]));
    const addChip = (chip: { key: string; text: string }) => {
      setCandidateMessage((cur_) => `${cur_.trim() ? `${cur_.trim()} ` : ''}${chip.text}`);
      setUsedChips((list) => [...list, chip.key]);
      window.setTimeout(() => {
        const el = lineRef.current;
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      }, 0);
    };
    const lines = [
      `Fixgehalt: ${euro(fix)} pro Jahr`,
      varNum ? `Variabel bei 100 %: ${euro(varNum)}` : null,
      `Erster Arbeitstag: ${dayDe(startDate)}`,
      [contractType === 'fixed_term' ? 'befristet' : 'unbefristet', probation ? `${probation} Monate Probezeit` : null].filter(Boolean).join(' · '),
      workModel.trim() ? `Ort und Modell: ${workModel.trim()}` : null,
      extras.length ? `Extras: ${extras.join(', ')}` : null,
      `Antwort bis ${dayDe(responseDue)}`,
    ].filter(Boolean) as string[];
    return (
      <>
        <DialogHeader>
          <DialogTitle>{cur ? 'Angebot anpassen' : 'Angebot'} für {name}</DialogTitle>
          <DialogDescription>{c.jobTitle}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 border-b pb-2 text-xs text-muted-foreground">
          <span className="text-emerald-600">✓ Konditionen</span>
          <span className="font-medium text-foreground">2 Prüfen und senden</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Diese Mail bekommt {first} nach dem Anruf von {hhFirst}</span>
          <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => setStep(1)}>Konditionen ändern</button>
        </div>

        <div className="space-y-2.5 rounded-lg bg-white p-4 text-sm text-neutral-900">
          <p className="text-xs text-neutral-500">Von {hh} über Matchunt</p>
          <p className="text-base font-medium">Ihr Angebot von {c.companyName}</p>
          <p>Guten Tag {c.candidateName},</p>
          <p>wie mit {hh} besprochen, hier die Eckdaten Ihres Angebots von {c.companyName}{cur ? ` (Version ${cur.version + 1})` : ''}:</p>
          <p>{lines.map((l, i) => <span key={l}>{i > 0 && <br />}{l}</span>)}</p>
          <div>
            <label htmlFor="offer-cand-msg" className="text-xs font-medium">Nachricht von {c.companyName}:</label>
            <div className="mt-1 rounded-md border border-blue-600 bg-white">
              <Textarea id="offer-cand-msg" ref={lineRef} value={candidateMessage} onChange={(e) => setCandidateMessage(e.target.value)} rows={2} maxLength={2000}
                placeholder="Keine persönliche Zeile. Zum Beispiel: Wir freuen uns sehr, Sie im Team zu begrüßen."
                className="border-0 bg-transparent text-neutral-900 shadow-none placeholder:text-neutral-400 focus-visible:ring-0 focus-visible:ring-offset-0" />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 px-2 py-1.5">
                <div className="flex flex-wrap gap-1.5">
                  {LINE_CHIPS.filter((x) => !usedChips.includes(x.key)).map((x) => (
                    <button key={x.key} type="button" onClick={() => addChip(x)} className="rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs text-neutral-700 hover:bg-neutral-100">+ {x.label}</button>
                  ))}
                </div>
                {candidateMessage.trim() && (
                  <button type="button" className="text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-900" onClick={() => { setCandidateMessage(''); setUsedChips([]); }}>Zeile entfernen</button>
                )}
              </div>
            </div>
            {lineUnfinished && <p className="mt-1 text-xs text-amber-700">Bitte den Satz zu Ende schreiben oder entfernen.</p>}
          </div>
          <p className="text-xs text-neutral-500">Das sind die Eckdaten, noch kein Arbeitsvertrag. Verbindlich ist erst der Arbeitsvertrag, den Sie mit {c.companyName} unterschreiben.</p>
          <p>Fragen klären Sie mit {hhFirst}: Antworten Sie einfach auf diese Mail.</p>
          <span className="inline-block rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white">Angebot ansehen und antworten</span>
        </div>

        <div className="space-y-2 rounded-lg border p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 font-medium"><Lock className="h-3.5 w-3.5" />Nur für {hh}</p>
            <p className="text-xs text-muted-foreground">{first} sieht das nie</p>
          </div>
          <p className="text-xs text-muted-foreground">Wo hat {hhFirst} im Gespräch mit {first} Spielraum?</p>
          <div className="flex flex-wrap gap-1.5">
            {[...SPIELRAUM, { key: NO_ROOM, label: 'Kein Spielraum', text: '' }].map((x) => (
              <button key={x.key} type="button" aria-pressed={room.includes(x.key)} onClick={() => toggleRoom(x.key)}
                className={cn('rounded-full border px-3 py-1 text-xs transition-colors', room.includes(x.key) ? 'border-foreground bg-foreground text-background' : 'hover:bg-accent')}>
                {x.label}
              </button>
            ))}
          </div>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1500} placeholder={`Noch etwas für ${hhFirst}? Zum Beispiel: Februar ginge auch.`} aria-label={`Noch etwas für ${hhFirst}`} />
        </div>

        <div className="space-y-1 text-xs text-muted-foreground">
          <p>Das Angebot geht zuerst an {hhFirst}. {first} bekommt es spätestens nach 2 Stunden (nachts ab 8 Uhr) und antwortet selbst. Den Arbeitsvertrag schicken Sie nach der bestätigten Zusage.</p>
          {fee && <p>Honorar laut Rahmenvertrag: {c.feePercent} % vom Zielgehalt ({euro(target)}) = {euro(fee)} zzgl. USt. Fällig erst, wenn der Vertrag unterschrieben ist.</p>}
          {c.otherOpenOffers > 0 && <p>Für diese Stelle {c.otherOpenOffers === 1 ? 'läuft schon ein weiteres Angebot' : `laufen schon ${c.otherOpenOffers} weitere Angebote`}. Mehrere Angebote gleichzeitig sind möglich.</p>}
          {cur && <p>Das bisherige Angebot gilt danach als ersetzt.</p>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => setStep(1)}>‹ Zurück</Button>
          <Button disabled={!ready || busy || lineUnfinished} onClick={send} className="gap-1.5">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {cur ? 'Angepasstes Angebot senden' : `Angebot an ${hhFirst} senden`}
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{cur ? 'Angebot anpassen' : 'Angebot'} für {name}</DialogTitle>
        <DialogDescription>{c.jobTitle} · geht an {hh}, {hh.split(' ')[0]} bespricht es mit {first}</DialogDescription>
      </DialogHeader>

      <div className="flex gap-3 border-b pb-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">1 Konditionen</span>
        <span>2 Prüfen und senden</span>
      </div>

      {!rec && !cur && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3 text-sm">
          {hhFirst} hat noch keine Empfehlung geschickt. Sie können trotzdem anbieten, sie sagt Ihnen aber, was es für die Zusage braucht.
        </p>
      )}
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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          {!cur && onAsk && <button type="button" className="text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => { onClose(); onAsk(); }}>Erst Frage an {hhFirst}</button>}
          {!cur && onReject && <button type="button" className="text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => { onClose(); onReject(); }}>Doch absagen</button>}
        </div>
        <Button disabled={!ready} onClick={() => setStep(2)}>Weiter: Prüfen und senden</Button>
      </div>
    </>
  );
}
