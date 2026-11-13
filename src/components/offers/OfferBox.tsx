import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { dayDe, euro, offerApi, overdue, plusWorkdays, shortDe, whenDe, type OfferView } from '@/lib/offerApi';
import i18n from '@/i18n';
import { useTranslation } from 'react-i18next';

// Texte der Kundenseite (offers:client), gelesen beim Aufruf (README Regel 7)
const tc = (key: string, options?: Record<string, unknown>): string => i18n.t(`offers:client.${key}`, options);

interface Props {
  submissionId: string;
  /** Angebot machen bzw. anpassen (Fenster in der Mitte) */
  onAdjust: () => void;
  /** Absage mit Grund (bestehendes Absage-Fenster) */
  onReject: () => void;
  /** Nach der Zusage: Arbeitsvertrag schicken (Paket 3) */
  onContract?: () => void;
}

/** Kurzfassung eines Angebots: „150.000 € + 20.000 € · Start Fr 01.01.“ */
export function offerSummary(o: OfferView): string {
  return [o.variable ? tc('summaryVariable', { salary: euro(o.salary), variable: euro(o.variable) }) : euro(o.salary), o.startDate ? tc('summaryStart', { date: dayDe(o.startDate) }) : null].filter(Boolean).join(' · ');
}

/**
 * Je Stand genau ein Satz, überall gleich (Profil, Fenster; für die Aufgaben baut client-tasks denselben).
 * Der Kunde sieht, dass gesprochen wird, nicht worüber.
 */
export function offerStandLine(o: OfferView, first: string, hhFirst: string, now = Date.now()): string {
  const due = o.responseDue ? tc('stand.answerBy', { date: dayDe(o.responseDue) }) : '';
  if (o.status === 'accept_reported') return tc('stand.acceptReported', { hh: hhFirst, first });
  if (overdue(o)) return tc('stand.overdue', { date: dayDe(o.responseDue) });
  const c = o.candidate;
  if (c?.callbackAt) return tc('stand.talking', { first, hh: hhFirst, due });
  if (c?.mailDueAt && !c.mailSent) return tc('stand.calling', { hh: hhFirst, first, when: whenDe(c.mailDueAt, now), due });
  if (c?.mailSent && c.mailSentAt) return tc('stand.hasOffer', { first, since: shortDe(c.mailSentAt, now), due });
  return tc('stand.withRecruiter', { hh: hhFirst, due });
}

/**
 * Angebot im Bewerberprofil (Box „Was jetzt“): liegt bei Headhunter, Kandidat überlegt,
 * Gegenwunsch, Zusage, Absage – jeweils mit genau den passenden Schritten.
 */
export function OfferBox({ submissionId, onAdjust, onReject, onContract }: Props) {
  useTranslation('offers');
  const queryClient = useQueryClient();
  const ctx = useQuery({ queryKey: ['offer-context', submissionId], queryFn: () => offerApi.context(submissionId), staleTime: 15_000 });
  const [busy, setBusy] = useState(false);
  const [keepNote, setKeepNote] = useState<string | null>(null);
  const [newDue, setNewDue] = useState<string | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  const o = ctx.data?.currentOffer;
  if (!o || o.status === 'superseded') return null;
  const hh = ctx.data?.recruiterName?.trim() || tc('yourRecruiter');
  const hhFirst = hh.split(' ')[0];
  const first = (ctx.data?.candidateName ?? '').split(' ')[0] || tc('theCandidate');
  const late = overdue(o);

  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await work();
      toast.success(done);
      setKeepNote(null); setNewDue(null); setConfirmWithdraw(false);
      queryClient.invalidateQueries({ queryKey: ['offer-context', submissionId] });
      queryClient.invalidateQueries({ queryKey: ['submission-state'] });
      queryClient.invalidateQueries({ queryKey: ['bewerber'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : i18n.t('offers:common.failed'));
    } finally {
      setBusy(false);
    }
  };

  const tone = o.status === 'countered' || late ? 'warn' : o.status === 'accepted' ? 'ok' : o.status === 'declined' ? 'crit' : 'info';
  const r = o.response;

  return (
    <div className={cn('mt-3 rounded-lg border p-3 text-sm',
      tone === 'warn' && 'border-amber-500/30 bg-amber-500/[0.06]',
      tone === 'ok' && 'border-emerald-500/30 bg-emerald-500/[0.06]',
      tone === 'crit' && 'border-destructive/30 bg-destructive/[0.05]',
      tone === 'info' && 'border-primary/20 bg-primary/[0.04]')}>
      {o.status === 'accept_reported' && (
        <>
          <p className="font-medium">{offerStandLine(o, first, hhFirst)}</p>
          <p className="text-muted-foreground">{offerSummary(o)}{o.version > 1 ? tc('version', { n: o.version }) : ''}</p>
          <p className="mt-1 text-muted-foreground">{tc('box.thenContract', { first })}</p>
        </>
      )}
      {(o.status === 'with_recruiter' || o.status === 'considering') && (
        <>
          <p className="font-medium">
            {!late && o.status === 'considering' ? (r?.until ? tc('box.consideringUntil', { first, date: dayDe(r.until) }) : tc('box.considering', { first })) : offerStandLine(o, first, hhFirst)}
          </p>
          <p className="text-muted-foreground">{offerSummary(o)}{o.version > 1 ? tc('version', { n: o.version }) : ''}</p>
          {o.status === 'considering' && r?.note && <p className="mt-1 text-muted-foreground">{tc('box.quote', { hh: hhFirst, text: r.note })}</p>}
          {r?.client_keep && o.status === 'with_recruiter' && <p className="mt-1 text-muted-foreground">{tc('box.youKeep')}</p>}
          {r?.extension_asked && <p className="mt-1 text-muted-foreground">{tc('box.moreTime', { hh: hhFirst, first })}</p>}
          {newDue !== null ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} className="h-8 w-44" aria-label={tc('box.newDeadline')} />
              <Button size="sm" disabled={busy || !newDue} onClick={() => run(() => offerApi.extend(o.id, newDue), tc('box.extended', { date: dayDe(newDue), first, hh: hhFirst }))}>{i18n.t('taskDetail:common.save')}</Button>
              <Button size="sm" variant="ghost" onClick={() => setNewDue(null)}>{i18n.t('offers:common.cancel')}</Button>
            </div>
          ) : confirmWithdraw ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span>{tc('box.withdrawQ')}</span>
              <Button size="sm" variant="destructive" disabled={busy} onClick={() => run(() => offerApi.withdraw(o.id), tc('box.withdrawn', { hh: hhFirst }))}>{tc('box.withdraw')}</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmWithdraw(false)}>{i18n.t('offers:common.cancel')}</Button>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {(late || r?.extension_asked) && <Button size="sm" onClick={() => setNewDue(plusWorkdays(3, late ? undefined : new Date(`${o.responseDue}T12:00:00`)))}>{tc('box.extend')}</Button>}
              <Button size="sm" variant="outline" onClick={onAdjust}>{tc('box.change')}</Button>
              {!late && !r?.extension_asked && <Button size="sm" variant="ghost" onClick={() => setNewDue(plusWorkdays(3, new Date(`${o.responseDue}T12:00:00`)))}>{tc('box.extend')}</Button>}
              <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setConfirmWithdraw(true)}>{tc('box.withdraw')}</Button>
            </div>
          )}
        </>
      )}

      {o.status === 'countered' && (
        <>
          <p className="font-medium">
            {tc('box.wishes', { first, wish: [r?.wish?.salary && tc('box.wishSalary', { amount: euro(r.wish.salary), offered: euro(o.salary) }), r?.wish?.variable && tc('box.wishVariable', { amount: euro(r.wish.variable) }), r?.wish?.startDate && tc('box.wishStart', { date: dayDe(r.wish.startDate) }), r?.wish?.other].filter(Boolean).join(' · ') })}
          </p>
          {r?.reason && <p className="mt-0.5 text-muted-foreground">{tc('box.quote', { hh: hhFirst, text: r.reason })}</p>}
          {keepNote !== null ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Input value={keepNote} onChange={(e) => setKeepNote(e.target.value)} placeholder={tc('box.keepPlaceholder', { hh: hhFirst })} className="h-8 min-w-[16rem] flex-1" aria-label={tc('box.reason')} />
              <Button size="sm" disabled={busy} onClick={() => run(() => offerApi.keep(o.id, keepNote), tc('box.keepSent', { hh: hhFirst, first }))}>
                {busy && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}{i18n.t('contracts:window.send')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setKeepNote(null)}>{i18n.t('offers:common.cancel')}</Button>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" onClick={onAdjust}>{tc('box.adjust')}</Button>
              <Button size="sm" variant="outline" onClick={() => setKeepNote('')}>{tc('box.stayAt', { amount: euro(o.salary) })}</Button>
              <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={onReject}>{tc('box.reject')}</Button>
            </div>
          )}
        </>
      )}

      {o.status === 'accepted' && (
        <>
          <p className="font-medium">{tc('box.accepted', { first, summary: offerSummary(o) })}</p>
          <p className="mt-0.5 text-muted-foreground">{tc('box.sendContractNow', { first })}{onContract ? tc('box.dataReady') : ''}</p>
          {onContract && <div className="mt-2"><Button size="sm" onClick={onContract}>{tc('box.sendContract')}</Button></div>}
        </>
      )}

      {o.status === 'declined' && (
        <>
          <p className="font-medium">{tc('box.declined', { first })}</p>
          <p className="mt-0.5 text-muted-foreground">{[r?.reason_category && tc(`box.reasons.${r.reason_category}`, { defaultValue: r.reason_category }), r?.reason].filter(Boolean).join(': ') || tc('box.noReason')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onAdjust}>{tc('box.newOffer')}</Button>
            <Button size="sm" variant="ghost" asChild><Link to="/dashboard/candidates">{tc('box.otherApplicants')}</Link></Button>
          </div>
        </>
      )}

      {o.status === 'withdrawn' && (
        <>
          <p className="font-medium">{tc('box.offerWithdrawn')}</p>
          <div className="mt-2"><Button size="sm" variant="outline" onClick={onAdjust}>{tc('box.newOffer')}</Button></div>
        </>
      )}
    </div>
  );
}

