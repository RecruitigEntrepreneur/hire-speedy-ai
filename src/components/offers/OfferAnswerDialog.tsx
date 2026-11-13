import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Clock, Loader2, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { notifyTasksChanged } from '@/hooks/useUnifiedTaskInbox';
import { DECLINE_REASONS, dayDe, declineLabel, euro, offerApi, overdue, shortDe, whenDe, workModelLabel, type AnswerWay, type RecruiterOfferContext } from '@/lib/offerApi';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { term } from '@/lib/candidateTerms';
import { fmtNumber } from '@/lib/localeFormat';

interface Props {
  /** Einreichung, zu der das Angebot gehört; null = Fenster zu */
  submissionId: string | null;
  onClose: () => void;
  onDone?: () => void;
}

// „Überlegt noch“ gibt es seit G + H nicht mehr: Es gilt die Antwortfrist des Kunden
// Beschriftung: offers:answer.ways.<key>
const WAYS: AnswerWay[] = ['accepted', 'countered', 'declined'];
const digits = (v: string) => {
  const n = Number(v.replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const fmt = (n: number | null) => (n ? fmtNumber(n) : '');
const first = (name: string | null) => (name ?? '').trim().split(/\s+/)[0] || i18n.t('offers:answer.theCandidate');
/** Restzeit: „1:52 Std.“ bzw. „12 Min.“ */
const leftDe = (ms: number) => {
  const min = Math.max(1, Math.ceil(ms / 60_000));
  return min < 60 ? i18n.t('offers:answer.leftMinutes', { min }) : i18n.t('offers:answer.leftHours', { h: Math.floor(min / 60), mm: String(min % 60).padStart(2, '0') });
};

/** Minütlich neu rechnen, damit die Uhr läuft */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

/**
 * Angebot überbringen (Headhunter, 22.10.2026; G + H 25.10.2026): Angebot des Kunden auf einen Blick,
 * anrufen, „Gespräch geführt“ schickt die Mail an den Kandidaten sofort (sonst nach 2 Std.).
 * Antworten gibt der Kandidat selbst; hier nur, was er am Telefon sagt. Fenster in der Mitte.
 */
export function OfferAnswerDialog({ submissionId, onClose, onDone }: Props) {
  const { t } = useTranslation('offers');
  const ctx = useQuery({
    queryKey: ['offer-recruiter-context', submissionId],
    queryFn: () => offerApi.recruiterContext(submissionId!),
    enabled: !!submissionId,
    staleTime: 10_000,
  });
  return (
    <Dialog open={!!submissionId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        {ctx.isLoading || !ctx.data ? (
          <>
            <DialogHeader><DialogTitle>{t('answer.title')}</DialogTitle><DialogDescription>{t('common.loading')}</DialogDescription></DialogHeader>
            {ctx.error
              ? <p className="text-sm text-destructive">{ctx.error instanceof Error ? ctx.error.message : t('common.loadError')}</p>
              : <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </>
        ) : (
          <AnswerForm c={ctx.data} onClose={onClose} onDone={onDone} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AnswerForm({ c, onClose, onDone }: { c: RecruiterOfferContext; onClose: () => void; onDone?: () => void }) {
  const { t } = useTranslation('offers');
  const queryClient = useQueryClient();
  const now = useNow();
  const o = c.currentOffer;
  const name = first(c.candidateName);
  const firma = c.companyName;
  const [way, setWay] = useState<AnswerWay | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [startConfirmed, setStartConfirmed] = useState(o?.startDate ?? '');
  const [wishSalary, setWishSalary] = useState('');
  const [wishVariable, setWishVariable] = useState('');
  const [wishStart, setWishStart] = useState('');
  const [wishOther, setWishOther] = useState('');
  const [reason, setReason] = useState('');
  const [reasonCategory, setReasonCategory] = useState<string | null>(null);
  const [agrees, setAgrees] = useState(false);
  useEffect(() => { setStartConfirmed(o?.startDate ?? ''); }, [o?.id, o?.startDate]);

  if (!o || o.status === 'superseded') {
    return (
      <>
        <DialogHeader><DialogTitle>{t('answer.noOffer')}</DialogTitle><DialogDescription>{c.candidateName} · {c.jobTitle}</DialogDescription></DialogHeader>
        <p className="text-sm text-muted-foreground">{t('answer.noOfferText')}</p>
      </>
    );
  }
  const cand = o.candidate;
  // 'considering' nur noch bei älteren Angeboten von vor G + H
  const open = o.status === 'with_recruiter' || o.status === 'considering';
  const mailDue = cand?.mailDueAt ? Date.parse(cand.mailDueAt) : null;
  const mailSent = !!cand?.mailSent || (mailDue !== null && mailDue <= now);
  const mailSentAt = cand?.mailSentAt ?? (mailSent ? cand?.mailDueAt ?? null : null);
  const late = overdue(o);
  const callbackOpen = open && !late && !!cand?.callbackAt;
  const clockRunning = open && !late && !mailSent && mailDue !== null;
  const notConfirmed = open && !late && !!cand?.notConfirmedAt;
  const keep = o.response?.client_keep ?? null;
  const askedMore = !!o.response?.extension_asked;
  const reportedLong = o.status === 'accept_reported' && !!cand?.acceptReportedAt && now - Date.parse(cand.acceptReportedAt) >= 24 * 3_600_000;

  const nach = c.nachgespraech;
  // Nur für den Headhunter: Schmerzgrenze aus dem Nachgespräch, sonst der genannte Wunsch
  const grenze = (nach?.angebot_fix_min as number | null) ?? null;
  const wunsch = (nach?.gehalt_besprochen ? (nach?.gehalt_kandidat as number | null) : null) ?? c.akte.expectedSalary;
  const gehaltHinweis = grenze ? t('answer.painLimit', { amount: euro(grenze) }) : wunsch ? t('answer.wish', { amount: euro(wunsch) }) : null;

  // Extras und „Ort · Modell“ sind gespeichert, wie der Kunde sie geschickt hat; bekannte Teile werden übersetzt
  const facts: [string, string][] = [
    [t('answer.facts.salary'), gehaltHinweis ? t('answer.salaryWithHint', { amount: euro(o.salary), hint: gehaltHinweis }) : euro(o.salary)],
    ...(o.variable ? [[t('answer.facts.variable'), t('answer.variableAt100', { amount: euro(o.variable) })] as [string, string]] : []),
    [t('answer.facts.start'), o.startDate ? dayDe(o.startDate) : t('answer.open')],
    [t('answer.facts.contract'), [o.contractType === 'fixed_term' ? t('answer.fixedTerm') : t('answer.permanent'), o.probationMonths ? t('answer.probation', { count: o.probationMonths }) : null].filter(Boolean).join(' · ')],
    ...(o.extras.length ? [[t('answer.facts.extras'), o.extras.map((x) => term(x)).join(' · ')] as [string, string]] : []),
    ...(o.workModel ? [[t('answer.facts.place'), workModelLabel(o.workModel)] as [string, string]] : []),
  ];

  const ready = way === 'accepted' ? true
    : way === 'countered' ? !!(digits(wishSalary) || digits(wishVariable) || wishStart || wishOther.trim()) && agrees
      : way === 'declined' ? !!reasonCategory : false;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['offer-recruiter-context', c.submissionId] });
    notifyTasksChanged();
    onDone?.();
  };

  const run = async (key: string, fn: () => Promise<unknown>, done: string, close = false) => {
    setBusy(key);
    try {
      await fn();
      toast.success(done);
      refresh();
      if (close) onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setBusy(null);
    }
  };

  const talked = () => run('talked', () => offerApi.talked(o.id), mailSent ? t('answer.toast.noted') : t('answer.toast.mailOut', { name }));
  const askMore = () => run('more', () => offerApi.askExtension(o.id), t('answer.toast.askedMore', { company: firma }));
  const callback = (outcome: 'stays' | 'unreachable') => run(outcome, () => offerApi.callbackDone(o.id, outcome),
    outcome === 'stays' ? t('answer.toast.stays', { name }) : t('answer.toast.unreachable'), outcome === 'stays');

  const save = () => way && run('save', () => offerApi.respond({
    offerId: o.id, way,
    wishSalary: way === 'countered' ? digits(wishSalary) : undefined,
    wishVariable: way === 'countered' ? digits(wishVariable) : undefined,
    wishStart: way === 'countered' ? wishStart || null : undefined,
    wishOther: way === 'countered' ? wishOther : undefined,
    reason: way === 'countered' || way === 'declined' ? reason : undefined,
    reasonCategory: way === 'declined' ? reasonCategory ?? 'other' : undefined,
    startConfirmed: way === 'accepted' && startConfirmed ? startConfirmed : undefined,
    candidateAgrees: way === 'countered' ? agrees : undefined,
  }), way === 'accepted' ? t('answer.toast.accepted', { name, company: firma })
    : way === 'countered' ? t('answer.toast.countered', { company: firma }) : t('answer.toast.declined', { company: firma }), true);

  const callButton = c.candidatePhone ? (
    <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" asChild>
      <a href={`tel:${c.candidatePhone}`}><Phone className="h-3 w-3" />{t('answer.call', { name })}</a>
    </Button>
  ) : null;

  return (
    <>
      <DialogHeader className="text-left">
        <DialogTitle>{t('answer.heading', { name: c.candidateName })}</DialogTitle>
        <DialogDescription>
          {firma} · {c.jobTitle}{o.version > 1 ? ` · ${t('answer.version', { n: o.version })}` : ''}{o.responseDue ? ` · ${t('answer.answerUntil', { date: dayDe(o.responseDue) })}` : ''}
        </DialogDescription>
      </DialogHeader>

      {/* Zuerst, was jetzt zu tun ist */}
      {open && late && (
        <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3 text-sm">
          <p className="font-medium">{t('answer.expiredTitle', { date: dayDe(o.responseDue) })}</p>
          <p>{t('answer.expiredText', { name, company: firma })}</p>
          <div className="flex flex-wrap gap-2">
            {callButton}
            <Button size="sm" className="h-8" disabled={!!busy || askedMore} onClick={askMore}>
              {busy === 'more' && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}{askedMore ? t('answer.askedForMore') : t('answer.askClientMore')}
            </Button>
          </div>
        </div>
      )}
      {clockRunning && (
        <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium"><Clock className="h-3.5 w-3.5" />{t('answer.mailIn', { name, left: leftDe(mailDue! - now) })}</p>
          {keep && <p>{keep.note ? t('answer.keepsOfferNote', { company: firma, note: keep.note }) : t('answer.keepsOffer', { company: firma })}</p>}
          <p>{t('answer.callFirst', { when: whenDe(cand!.mailDueAt!, now) })}</p>
          <div className="flex flex-wrap gap-2">
            {callButton}
            <Button size="sm" className="h-8" disabled={!!busy} onClick={talked}>
              {busy === 'talked' && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}{t('answer.talkedSend')}
            </Button>
          </div>
        </div>
      )}
      {notConfirmed && (
        <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3 text-sm">
          <p className="font-medium">{t('answer.notConfirmedTitle', { name })}</p>
          <p>{t('answer.notConfirmedText', { name })}</p>
          <div className="flex flex-wrap gap-2">
            {callButton}
            <Button size="sm" className="h-8" disabled={!!busy} onClick={talked}>
              {busy === 'talked' && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}{t('answer.talked')}
            </Button>
          </div>
        </div>
      )}
      {callbackOpen && (
        <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">{t('answer.wantsToTalk', { name })}</p>
            {cand?.callbackDueAt && <p className="text-xs font-medium text-amber-600">{t('answer.callbackUntil', { when: shortDe(cand.callbackDueAt, now) })}</p>}
          </div>
          <p className="text-muted-foreground">
            {cand?.callbackTopic ? t('answer.viaOfferPageTopic', { when: whenDe(cand!.callbackAt!, now), topic: cand.callbackTopic }) : t('answer.viaOfferPage', { when: whenDe(cand!.callbackAt!, now) })}
          </p>
          <div className="flex flex-wrap gap-2">
            {callButton}
            <Button size="sm" variant="outline" className="h-8 text-xs" disabled={!!busy} onClick={() => setWay('countered')}>{t('answer.calledCounter')}</Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" disabled={!!busy} onClick={() => callback('stays')}>
              {busy === 'stays' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}{t('answer.calledStays')}
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" disabled={!!busy} onClick={() => callback('unreachable')}>
              {busy === 'unreachable' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}{t('answer.notReached')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('answer.staysHint', { name })}</p>
        </div>
      )}

      <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
        <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1">
          {facts.map(([k, v]) => (
            <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
        {o.message && <p className="mt-2 border-t border-border/60 pt-2 text-muted-foreground">{t('answer.companyToYou', { company: firma, text: o.message })}</p>}
        {o.candidateMessage && <p className="mt-2 border-t border-border/60 pt-2 text-muted-foreground">{t('answer.companyToCandidate', { company: firma, name, text: o.candidateMessage })}</p>}
        {keep && !clockRunning && <p className="mt-2 border-t border-border/60 pt-2 text-muted-foreground">{keep.note ? t('answer.keepsOfferNote', { company: firma, note: keep.note }) : t('answer.keepsOffer', { company: firma })}</p>}
      </div>

      {open && !late && mailSent && !callbackOpen && !notConfirmed && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-muted-foreground">
            {mailSentAt ? t('answer.hasInWritingSince', { name, since: shortDe(mailSentAt, now) }) : t('answer.hasInWriting', { name })}
            {cand?.talkedAt ? t('answer.talkedAt', { when: whenDe(cand.talkedAt, now) }) : ''}
          </p>
          {callButton}
        </div>
      )}

      {!open ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-muted-foreground">
            {o.status === 'accept_reported'
              ? `${cand?.acceptReportedAt ? t('answer.reportedAcceptAt', { when: whenDe(cand.acceptReportedAt, now), name }) : t('answer.reportedAccept', { name })}${reportedLong ? t('answer.reportedLong', { name }) : ''}`
              : o.status === 'countered' ? t('answer.counterWithClient', { company: firma })
                : o.status === 'accepted' ? t(cand?.confirmedAt || cand?.answeredByCandidate ? 'answer.acceptedSelf' : 'answer.accepted', { name, company: firma })
                  : o.status === 'declined' ? t(cand?.answeredByCandidate ? 'answer.declinedOnPage' : 'answer.declined', { name }) : t('answer.withdrawn')}
          </p>
          {o.status === 'accept_reported' && callButton}
        </div>
      ) : !late && (
        <>
          <div>
            <p className="mb-1.5 text-sm font-medium">{t('answer.answeredByPhone', { name })}</p>
            <div className="grid grid-cols-3 gap-1 rounded-md border border-border/60 bg-muted/30 p-1">
              {WAYS.map((w) => (
                <button key={w} type="button" onClick={() => setWay(way === w ? null : w)}
                  className={cn('rounded px-2 py-1.5 text-sm', way === w ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                  {t(`answer.ways.${w}`)}
                </button>
              ))}
            </div>
          </div>

          {way === 'accepted' && (
            <div className="space-y-2 text-sm">
              <label className="flex flex-wrap items-center gap-2">
                <span className="w-32 text-muted-foreground">{t('answer.startConfirmed')}</span>
                <Input type="date" value={startConfirmed} onChange={(e) => setStartConfirmed(e.target.value)} className="h-8 w-44" />
              </label>
              <p className="text-muted-foreground">{t('answer.acceptHint', { name })}</p>
            </div>
          )}

          {way === 'countered' && (
            <div className="space-y-2 text-sm">
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="block"><span className="text-muted-foreground">{t('answer.wishSalary')}</span>
                  <Input inputMode="numeric" value={wishSalary} onChange={(e) => setWishSalary(fmt(digits(e.target.value)))} placeholder={t('answer.insteadOf', { amount: euro(o.salary) })} className="mt-1 h-8" /></label>
                <label className="block"><span className="text-muted-foreground">{t('answer.wishVariable')}</span>
                  <Input inputMode="numeric" value={wishVariable} onChange={(e) => setWishVariable(fmt(digits(e.target.value)))} placeholder={t('answer.unchanged')} className="mt-1 h-8" /></label>
                <label className="block"><span className="text-muted-foreground">{t('answer.wishStart')}</span>
                  <Input type="date" value={wishStart} onChange={(e) => setWishStart(e.target.value)} className="mt-1 h-8" /></label>
              </div>
              <label className="block"><span className="text-muted-foreground">{t('answer.wishOther')}</span>
                <Input value={wishOther} onChange={(e) => setWishOther(e.target.value)} placeholder={t('answer.wishOtherPlaceholder')} className="mt-1 h-8" /></label>
              <label className="block"><span className="text-muted-foreground">{t('answer.reasonOwnWords', { company: firma })}</span>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1" placeholder={t('answer.reasonPlaceholder')} /></label>
              <label className={cn('flex cursor-pointer items-start gap-2 rounded-md border p-2.5', agrees ? 'border-primary bg-primary/5' : 'border-amber-500/30 bg-amber-500/[0.06]')}>
                <Checkbox checked={agrees} onCheckedChange={(v) => setAgrees(v === true)} className="mt-0.5" />
                <span>{t('answer.agrees', { name })}</span>
              </label>
              <p className="text-muted-foreground">{t('answer.agreesHint', { company: firma, name, n: o.version + 1 })}</p>
            </div>
          )}

          {way === 'declined' && (
            <div className="space-y-2 text-sm">
              <div className="flex flex-wrap gap-1.5">
                {DECLINE_REASONS.map((r) => (
                  <Button key={r.key} size="sm" variant={reasonCategory === r.key ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setReasonCategory(r.key)}>{declineLabel(r.key)}</Button>
                ))}
              </div>
              <label className="block"><span className="text-muted-foreground">{t('answer.ownWordsOptional')}</span>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1" /></label>
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
        {open && !late && !way && (
          <button type="button" disabled={!!busy || askedMore} onClick={askMore} className="mr-auto text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:no-underline">
            {askedMore ? t('answer.youAskedMore', { company: firma }) : t('answer.needsMoreTime', { name, company: firma })}
          </button>
        )}
        <Button variant="ghost" onClick={onClose}>{open && way ? t('common.cancel') : t('common.close')}</Button>
        {open && way && (
          <Button disabled={!!busy || !ready} onClick={save}>
            {busy === 'save' && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {way === 'accepted' ? t('answer.ways.accepted') : way === 'countered' ? t('answer.sendTo', { company: firma }) : t('answer.ways.declined')}
          </Button>
        )}
      </div>
    </>
  );
}
