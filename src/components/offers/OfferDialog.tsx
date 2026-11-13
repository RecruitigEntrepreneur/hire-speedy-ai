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
import i18n from '@/i18n';
import { useTranslation } from 'react-i18next';
import { fmtNumber } from '@/lib/localeFormat';

// Texte der Kundenseite (offers:client.form), gelesen beim Aufruf (README Regel 7).
// Vorbefüllte Zeile an den Kandidaten und Notiz an den Headhunter: Entwurf in der Sprache des Kunden (Oberfläche).
const tf = (key: string, options?: Record<string, unknown>): string => i18n.t(`offers:client.form.${key}`, options);

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
const defaultLine = () => tf('defaultLine');
/** Stichworte für die Zeile an den Kandidaten; nur was die Mail nicht ohnehin sagt. */
const lineChips = () => [
  { key: 'ueberzeugt', label: tf('chips.ueberzeugt'), text: tf('chips.ueberzeugtText') },
  { key: 'team', label: tf('chips.team'), text: tf('chips.teamText') },
];
const SPIELRAUM = ['gehalt', 'start', 'modell'];
const NO_ROOM = 'kein';
/** Was beim Headhunter ankommt: Spielraum als Satz, dahinter sein freier Text. */
function noteForRecruiter(room: string[], note: string): string {
  const parts = SPIELRAUM.filter((x) => room.includes(x)).map((x) => tf(`roomText.${x}`));
  const line = room.includes(NO_ROOM) ? tf('bestOffer')
    : parts.length ? (parts.length > 1 ? tf('roomMany', { head: parts.slice(0, -1).join(', '), last: parts[parts.length - 1] }) : tf('roomOne', { what: parts[0] })) : '';
  return [line, note.trim()].filter(Boolean).join(' ');
}

const digits = (v: string) => {
  const n = Number(v.replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const fmt = (n: number | null) => (n ? fmtNumber(n) : '');
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
  const { t } = useTranslation('offers');
  const ctx = useQuery({ queryKey: ['offer-context', submissionId], queryFn: () => offerApi.context(submissionId), enabled: open, staleTime: 10_000 });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        {ctx.isLoading || !ctx.data ? (
          <>
            <DialogHeader><DialogTitle>{t('answer.title')}</DialogTitle><DialogDescription>{t('common.loading')}</DialogDescription></DialogHeader>
            {ctx.error
              ? <p className="text-sm text-destructive">{ctx.error instanceof Error ? ctx.error.message : t('common.loadError')}</p>
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
  const { t } = useTranslation('offers');
  const queryClient = useQueryClient();
  const hh = c.recruiterName?.trim() || t('client.yourRecruiter');
  const hhFirst = hh.split(' ')[0];
  const name = c.candidateName || t('client.theCandidateAcc');
  const first = (c.candidateName ?? '').split(' ')[0] || t('client.theCandidateDat');
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
  const [candidateMessage, setCandidateMessage] = useState(cur ? cur.candidateMessage ?? '' : defaultLine());
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
      toast.error(e instanceof Error ? e.message : t('errors.create'));
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
          <DialogTitle>{cur ? tf('titleAdjust', { name }) : tf('title', { name })}</DialogTitle>
          <DialogDescription>{c.jobTitle}</DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3 text-sm">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <div>
            <p className="font-medium">{tf('withRecruiter', { hh })}</p>
            <p className="text-muted-foreground">{tf('willCall', { hh: hhFirst, first })}{sentMailAt ? tf('mailLatest', { when: whenDe(sentMailAt, Date.now()), first }) : ''}</p>
          </div>
        </div>
        <div className="flex justify-end"><Button onClick={onClose}>{tf('done')}</Button></div>
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
      tf('mailFix', { amount: euro(fix) }),
      varNum ? tf('mailVariable', { amount: euro(varNum) }) : null,
      tf('mailFirstDay', { date: dayDe(startDate) }),
      [contractType === 'fixed_term' ? tf('fixedTerm') : tf('permanent'), probation ? tf('probation', { count: probation }) : null].filter(Boolean).join(' · '),
      workModel.trim() ? tf('mailPlace', { value: workModel.trim() }) : null,
      extras.length ? tf('mailExtras', { value: extras.join(', ') }) : null,
      tf('mailAnswer', { date: dayDe(responseDue) }),
    ].filter(Boolean) as string[];
    return (
      <>
        <DialogHeader>
          <DialogTitle>{cur ? tf('titleAdjust', { name }) : tf('title', { name })}</DialogTitle>
          <DialogDescription>{c.jobTitle}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 border-b pb-2 text-xs text-muted-foreground">
          <span className="text-emerald-600">{tf('stepConditionsDone')}</span>
          <span className="font-medium text-foreground">{tf('stepCheck')}</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{tf('mailInfo', { first, hh: hhFirst })}</span>
          <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => setStep(1)}>{tf('changeConditions')}</button>
        </div>

        <div className="space-y-2.5 rounded-lg bg-white p-4 text-sm text-neutral-900">
          <p className="text-xs text-neutral-500">{tf('mailFrom', { hh })}</p>
          <p className="text-base font-medium">{tf('mailSubject', { company: c.companyName })}</p>
          <p>{tf('mailHello', { name: c.candidateName })}</p>
          <p>{cur ? tf('mailIntroVersion', { hh, company: c.companyName, n: cur.version + 1 }) : tf('mailIntro', { hh, company: c.companyName })}</p>
          <p>{lines.map((l, i) => <span key={l}>{i > 0 && <br />}{l}</span>)}</p>
          <div>
            <label htmlFor="offer-cand-msg" className="text-xs font-medium">{tf('messageFrom', { company: c.companyName })}</label>
            <div className="mt-1 rounded-md border border-blue-600 bg-white">
              <Textarea id="offer-cand-msg" ref={lineRef} value={candidateMessage} onChange={(e) => setCandidateMessage(e.target.value)} rows={2} maxLength={2000}
                placeholder={tf('messagePlaceholder')}
                className="border-0 bg-transparent text-neutral-900 shadow-none placeholder:text-neutral-400 focus-visible:ring-0 focus-visible:ring-offset-0" />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 px-2 py-1.5">
                <div className="flex flex-wrap gap-1.5">
                  {lineChips().filter((x) => !usedChips.includes(x.key)).map((x) => (
                    <button key={x.key} type="button" onClick={() => addChip(x)} className="rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs text-neutral-700 hover:bg-neutral-100">+ {x.label}</button>
                  ))}
                </div>
                {candidateMessage.trim() && (
                  <button type="button" className="text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-900" onClick={() => { setCandidateMessage(''); setUsedChips([]); }}>{tf('removeLine')}</button>
                )}
              </div>
            </div>
            {lineUnfinished && <p className="mt-1 text-xs text-amber-700">{tf('unfinished')}</p>}
          </div>
          <p className="text-xs text-neutral-500">{tf('notContract', { company: c.companyName })}</p>
          <p>{tf('questions', { hh: hhFirst })}</p>
          <span className="inline-block rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white">{tf('viewAnswer')}</span>
        </div>

        <div className="space-y-2 rounded-lg border p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 font-medium"><Lock className="h-3.5 w-3.5" />{tf('onlyFor', { hh })}</p>
            <p className="text-xs text-muted-foreground">{tf('neverSees', { first })}</p>
          </div>
          <p className="text-xs text-muted-foreground">{tf('whereRoom', { hh: hhFirst, first })}</p>
          <div className="flex flex-wrap gap-1.5">
            {[...SPIELRAUM, NO_ROOM].map((x) => (
              <button key={x} type="button" aria-pressed={room.includes(x)} onClick={() => toggleRoom(x)}
                className={cn('rounded-full border px-3 py-1 text-xs transition-colors', room.includes(x) ? 'border-foreground bg-foreground text-background' : 'hover:bg-accent')}>
                {tf(`room.${x}`)}
              </button>
            ))}
          </div>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1500} placeholder={tf('notePlaceholder', { hh: hhFirst })} aria-label={tf('noteLabel', { hh: hhFirst })} />
        </div>

        <div className="space-y-1 text-xs text-muted-foreground">
          <p>{tf('flow', { hh: hhFirst, first })}</p>
          {fee && <p>{tf('fee', { percent: c.feePercent, target: euro(target), fee: euro(fee) })}</p>}
          {c.otherOpenOffers > 0 && <p>{tf('otherOffers', { count: c.otherOpenOffers })}</p>}
          {cur && <p>{tf('replaced')}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => setStep(1)}>{tf('back')}</Button>
          <Button disabled={!ready || busy || lineUnfinished} onClick={send} className="gap-1.5">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {cur ? tf('sendAdjusted') : tf('sendTo', { hh: hhFirst })}
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{cur ? tf('titleAdjust', { name }) : tf('title', { name })}</DialogTitle>
        <DialogDescription>{tf('descTo', { job: c.jobTitle, hh, hhFirst: hh.split(' ')[0], first })}</DialogDescription>
      </DialogHeader>

      <div className="flex gap-3 border-b pb-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{tf('stepConditions')}</span>
        <span>{tf('stepCheck')}</span>
      </div>

      {!rec && !cur && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3 text-sm">
          {tf('noRec', { hh: hhFirst })}
        </p>
      )}
      {rec && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3 text-sm">
          <p className="font-medium">{tf('recFrom', { hh })}</p>
          {rec.intro && <p className="mt-0.5 text-muted-foreground">{tf('quote', { text: rec.intro })}</p>}
          <ul className="mt-1.5 grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
            {rec.items.map((i) => <li key={i.key}><span className="text-muted-foreground">{i.label}:</span> {i.value}</li>)}
          </ul>
        </div>
      )}
      {wish && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3 text-sm">
          {tf('counterFrom', { first, wish: [wish.salary && i18n.t('offers:client.box.wishFix', { amount: euro(wish.salary) }), wish.variable && i18n.t('offers:client.box.wishVariable', { amount: euro(wish.variable) }), wish.startDate && i18n.t('offers:client.box.wishStart', { date: dayDe(wish.startDate) }), wish.other].filter(Boolean).join(' · ') })}
          {cur?.response?.reason && <span className="text-muted-foreground"> · {tf('quote', { text: cur.response.reason })}</span>}
        </div>
      )}

      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
        <div>
          <label htmlFor="offer-fix" className="text-sm font-medium">{tf('fix')}</label>
          <Input id="offer-fix" inputMode="numeric" value={salary} onChange={(e) => setSalary(fmt(digits(e.target.value)))} placeholder="140.000" className="mt-1" />
          {fix && recFixNum ? <Hint ok={fix >= recFixNum}>{fix >= recFixNum ? tf('fitsRec') : tf('recFrom2', { amount: euro(recFixNum) })}</Hint>
            : inRange !== null && fix ? <Hint ok={inRange}>{inRange ? tf('inRange', { min: euro(c.salaryMin), max: euro(c.salaryMax) }) : tf('outOfRange', { min: euro(c.salaryMin), max: euro(c.salaryMax) })}</Hint> : null}
        </div>
        <div>
          <label htmlFor="offer-var" className="text-sm font-medium">{tf('variable')} <span className="font-normal text-muted-foreground">{tf('optional')}</span></label>
          <Input id="offer-var" inputMode="numeric" value={variable} onChange={(e) => setVariable(fmt(digits(e.target.value)))} placeholder="20.000" className="mt-1" />
        </div>
        <div>
          <label htmlFor="offer-start" className="text-sm font-medium">{tf('firstDay')}</label>
          <Input id="offer-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" />
          {startDate && recStartDate && <Hint ok={startDate >= recStartDate}>{startDate >= recStartDate ? tf('fitsRec') : tf('recStart', { value: recStart?.value })}</Hint>}
        </div>
        <div>
          <label htmlFor="offer-due" className="text-sm font-medium">{tf('answerBy')}</label>
          <Input id="offer-due" type="date" value={responseDue} onChange={(e) => setResponseDue(e.target.value)} className="mt-1" />
          <p className="mt-1 text-xs text-muted-foreground">{tf('default5')}</p>
        </div>
        <div>
          <label htmlFor="offer-contract" className="text-sm font-medium">{tf('contractProbation')}</label>
          <div className="mt-1 flex gap-2">
            <select id="offer-contract" value={contractType} onChange={(e) => setContractType(e.target.value as 'permanent' | 'fixed_term')} className="h-10 flex-1 rounded-md border bg-background px-2 text-sm">
              <option value="permanent">{tf('permanent')}</option>
              <option value="fixed_term">{tf('fixedTerm')}</option>
            </select>
            <select aria-label={tf('probationLabel')} value={probation} onChange={(e) => setProbation(Number(e.target.value))} className="h-10 w-36 rounded-md border bg-background px-2 text-sm">
              {[0, 3, 6].map((m) => <option key={m} value={m}>{m ? tf('probation', { count: m }) : tf('noProbation')}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="offer-model" className="text-sm font-medium">{tf('placeModel')}</label>
          <Input id="offer-model" value={workModel} onChange={(e) => setWorkModel(e.target.value)} maxLength={200} className="mt-1" />
        </div>
      </div>

      <div>
        <p className="text-sm font-medium">{tf('extras')} <span className="font-normal text-muted-foreground">{tf('extrasHint')}</span></p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {[...extraOptions, ...custom.filter((x) => !extraOptions.includes(x))].map((x) => (
            <button key={x} type="button" aria-pressed={extras.includes(x)} onClick={() => toggleExtra(x)}
              className={cn('rounded-full border px-3 py-1 text-xs transition-colors', extras.includes(x) ? 'border-foreground bg-foreground text-background' : 'hover:bg-accent')}>
              {x}
            </button>
          ))}
          <span className="inline-flex items-center gap-1">
            <Input value={newExtra} onChange={(e) => setNewExtra(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExtra(); } }} placeholder={tf('ownExtra')} className="h-7 w-36 text-xs" aria-label={tf('ownExtraLabel')} />
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={addExtra} aria-label={tf('addExtra')}><Plus className="h-3.5 w-3.5" /></Button>
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          {!cur && onAsk && <button type="button" className="text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => { onClose(); onAsk(); }}>{tf('askFirst', { hh: hhFirst })}</button>}
          {!cur && onReject && <button type="button" className="text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => { onClose(); onReject(); }}>{tf('rejectInstead')}</button>}
        </div>
        <Button disabled={!ready} onClick={() => setStep(2)}>{tf('nextCheck')}</Button>
      </div>
    </>
  );
}
