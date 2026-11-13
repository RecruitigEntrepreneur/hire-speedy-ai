import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, Clock, Loader2, Mail, Phone, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { PublicInterviewShell, StatusIcon } from '@/components/interview/PublicInterviewShell';
import { DECLINE_KEYS, dateTimeParts, dayDe, declineLabel, euro, offerAnswerApi, type OfferPageView } from '@/lib/offerAnswerApi';

/*
 * Antwortseite des Kandidaten (G + H, 25.10.2026): /angebot/:token, ohne Anmeldung.
 * Der persönliche Link aus der Mail „<Headhunter> über Matchunt“ ist der Zugang.
 * Zusage · Mit dem Headhunter sprechen · Absage (Grund Pflicht). Meldet der
 * Headhunter eine Zusage, bestätigt der Kandidat sie hier („Haben Sie zugesagt?“).
 * Der Server liefert eine fertige Sicht; die Seite rechnet nichts aus.
 */

type Step = null | 'accept' | 'talk' | 'decline';
type Done = null | 'accepted' | 'declined' | 'callback' | 'confirmed' | 'not_confirmed';

export default function OfferAnswerPage() {
  const { token = '' } = useParams<{ token: string }>();
  const { t } = useTranslation('offerAnswer');
  const [view, setView] = useState<OfferPageView | null>(null);
  const [failed, setFailed] = useState<null | 'invalid' | 'error'>(null);
  const [step, setStep] = useState<Step>(null);
  const [done, setDone] = useState<Done>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [topic, setTopic] = useState('');

  useEffect(() => { document.title = t('page.docTitle'); }, [t]);
  useEffect(() => {
    let cancelled = false;
    offerAnswerApi.peek(token)
      .then((v) => { if (!cancelled) setView(v); })
      .catch((e) => { if (!cancelled) setFailed(e instanceof Error && /ungültig|invalid|ogiltig|ugyldig/i.test(e.message) ? 'invalid' : 'error'); });
    return () => { cancelled = true; };
  }, [token]);

  const send = async (input: Parameters<typeof offerAnswerApi.answer>[1], result: Done) => {
    setBusy(true);
    try { await offerAnswerApi.answer(token, input); setDone(result); window.scrollTo({ top: 0 }); }
    catch (e) { toast.error(e instanceof Error ? e.message : t('page.saveFailed')); }
    finally { setBusy(false); }
  };

  if (failed === 'invalid') {
    return <Shell><Status icon={XCircle} tone="destructive" title={t('page.invalidTitle')}>{t('page.invalidBody')}</Status></Shell>;
  }
  if (failed) {
    return <Shell><Status icon={AlertCircle} tone="warning" title={t('page.errorTitle')}>{t('page.errorBody')}</Status></Shell>;
  }
  if (!view) {
    return <Shell><div className="flex flex-col items-center py-16 text-center text-sm text-muted-foreground"><Loader2 className="mb-3 h-6 w-6 animate-spin" />{t('page.loading')}</div></Shell>;
  }

  const v = view;
  const hh = v.recruiter;
  const hhFirst = hh?.name.split(' ')[0] ?? t('page.yourHeadhunter');
  const company = v.companyName;
  const o = v.offer;
  const facts = (
    <dl className="grid grid-cols-[8.5rem_1fr] gap-x-3 gap-y-1.5 rounded-xl border border-border bg-card p-4 text-sm">
      <dt className="text-muted-foreground">{t('page.facts.company')}</dt><dd>{v.companyName}</dd>
      <dt className="text-muted-foreground">{t('page.facts.job')}</dt><dd>{v.jobTitle}</dd>
      <dt className="text-muted-foreground">{t('page.facts.salary')}</dt><dd>{t('page.facts.salaryValue', { amount: euro(o.salary) })}</dd>
      {o.variable ? <><dt className="text-muted-foreground">{t('page.facts.variable')}</dt><dd>{t('page.facts.variableValue', { amount: euro(o.variable) })}</dd></> : null}
      {o.startDate && <><dt className="text-muted-foreground">{t('page.facts.start')}</dt><dd>{dayDe(o.startDate)}</dd></>}
      <dt className="text-muted-foreground">{t('page.facts.contract')}</dt><dd>{o.contractType === 'fixed_term' ? t('page.facts.fixedTerm') : t('page.facts.permanent')}{o.probationMonths ? t('page.facts.probation', { count: o.probationMonths }) : ''}</dd>
      {o.workModel && <><dt className="text-muted-foreground">{t('page.facts.workModel')}</dt><dd>{o.workModel}</dd></>}
      {o.extras.length > 0 && <><dt className="text-muted-foreground">{t('page.facts.extras')}</dt><dd>{o.extras.join(', ')}</dd></>}
    </dl>
  );
  const contact = hh && (
    <div className="flex items-center gap-3 rounded-xl border border-border p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
        {hh.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 text-sm">
        <p className="font-medium">{hh.name} <span className="font-normal text-muted-foreground">{t('page.contactRole')}</span></p>
        <p className="text-xs text-muted-foreground">{t('page.contactHint', { name: hhFirst })}</p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {hh.phone && <a href={`tel:${hh.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Phone className="h-3 w-3" />{hh.phone}</a>}
          {hh.email && <a href={`mailto:${hh.email}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Mail className="h-3 w-3" />{hh.email}</a>}
        </div>
      </div>
    </div>
  );
  const eckdaten = <p className="text-xs text-muted-foreground">{t('page.keyFacts', { name: hhFirst })}</p>;

  // Nach dem Antworten
  if (done) {
    const text: Record<Exclude<Done, null>, { title: string; body: string }> = {
      accepted: { title: t('page.done.acceptedTitle', { company }), body: t('page.done.acceptedBody', { name: hhFirst }) },
      confirmed: { title: t('page.done.confirmedTitle'), body: t('page.done.confirmedBody') },
      callback: { title: t('page.done.callbackTitle', { name: hhFirst }), body: t('page.done.callbackBody', { name: hhFirst, company }) },
      declined: { title: t('page.done.declinedTitle'), body: t('page.done.declinedBody', { name: hhFirst, company }) },
      not_confirmed: { title: t('page.done.notConfirmedTitle'), body: t('page.done.notConfirmedBody', { name: hhFirst }) },
    };
    return <Shell><Status icon={CheckCircle2} tone="success" title={text[done].title}>{text[done].body}</Status>{contact}</Shell>;
  }

  switch (v.state) {
    case 'answered':
      return (
        <Shell>
          <Status icon={CheckCircle2} tone="success" title={v.answer === 'declined' ? t('page.answeredDeclined') : t('page.answeredAccepted')}>
            {v.answer === 'declined' ? t('page.done.declinedBody', { name: hhFirst, company }) : t('page.answeredAcceptedBody')}
          </Status>
          {facts}{contact}
        </Shell>
      );
    case 'wish_pending':
      return <Shell><Status icon={Clock} tone="muted" title={t('page.wishTitle', { company })}>{t('page.wishBody', { name: hhFirst })}</Status>{contact}</Shell>;
    case 'expired':
      return <Shell><Status icon={Clock} tone="warning" title={t('page.expiredTitle')}>{t('page.expiredBody', { name: hhFirst })}</Status>{contact}</Shell>;
    case 'closed':
      return (
        <Shell>
          <Status icon={Mail} tone="muted" title={v.superseded ? t('page.supersededTitle') : t('page.closedTitle')}>
            {v.superseded ? t('page.supersededBody', { company }) : v.withdrawn ? t('page.withdrawnBody', { company, name: hhFirst }) : t('page.closedBody')}
          </Status>
          {contact}
        </Shell>
      );
    case 'confirm':
      return (
        <Shell>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">{t('page.confirmTitle')}</h1>
            <p className="text-sm text-muted-foreground">{v.reportedAt ? t('page.confirmBodyAt', { name: hh?.name ?? t('page.yourHeadhunter'), company, ...dateTimeParts(v.reportedAt) }) : t('page.confirmBody', { name: hh?.name ?? t('page.yourHeadhunter'), company })}</p>
          </div>
          {facts}
          {v.message && <p className="text-sm text-muted-foreground">{t('page.messageFrom', { company, message: v.message })}</p>}
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => send({ way: 'confirmed' }, 'confirmed')}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{t('page.yesAccept')}</Button>
            <Button variant="outline" disabled={busy} onClick={() => send({ way: 'not_confirmed' }, 'not_confirmed')}>{t('page.notRight')}</Button>
            <Button variant="outline" disabled={busy} onClick={() => send({ way: 'callback' }, 'callback')}>{t('page.talkFirst', { name: hhFirst })}</Button>
          </div>
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{t('page.confirmHint', { name: hhFirst })}</p>
          {contact}
        </Shell>
      );
    case 'open':
    default:
      return (
        <Shell>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">{t('page.openTitle', { company })}</h1>
            <p className="text-sm text-muted-foreground">{o.version > 1 ? t('page.version', { n: o.version }) : ''}{t('page.answerBy', { date: dayDe(o.responseDue) })}</p>
          </div>
          {v.callbackRequestedAt && (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">{t('page.callbackPending', { name: hhFirst, ...dateTimeParts(v.callbackRequestedAt) })}</p>
          )}
          {facts}
          {v.message && <p className="text-sm text-muted-foreground">{t('page.messageFrom', { company, message: v.message })}</p>}

          {step === null && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setStep('accept')}>{t('page.accept')}</Button>
              <Button variant="outline" onClick={() => setStep('talk')}>{t('page.talk', { name: hhFirst })}</Button>
              <Button variant="outline" onClick={() => { setStep('decline'); setReason(null); }}>{t('page.decline')}</Button>
            </div>
          )}
          {step === 'accept' && (
            <Panel>
              <p className="text-sm">{t('page.acceptHint', { company })}</p>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy} onClick={() => send({ way: 'accepted' }, 'accepted')}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{t('page.acceptNow')}</Button>
                <Button variant="ghost" onClick={() => setStep(null)}>{t('page.back')}</Button>
              </div>
            </Panel>
          )}
          {step === 'talk' && (
            <Panel>
              <p className="text-sm">{t('page.topicQuestion')}</p>
              <Textarea rows={2} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t('page.topicPlaceholder')} />
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy} onClick={() => send({ way: 'callback', topic: topic.trim() || undefined }, 'callback')}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{t('page.callMe', { name: hhFirst })}</Button>
                <Button variant="ghost" onClick={() => setStep(null)}>{t('page.back')}</Button>
              </div>
            </Panel>
          )}
          {step === 'decline' && (
            <Panel>
              <p className="text-sm">{t('page.reasonQuestion')} <span className="text-muted-foreground">{t('page.reasonGoesTo', { company, name: hhFirst })}</span></p>
              <div className="flex flex-wrap gap-1.5">
                {DECLINE_KEYS.map((key) => (
                  <Button key={key} type="button" size="sm" variant="outline" aria-pressed={reason === key} className={cn('h-8 text-xs', reason === key && 'border-primary bg-primary/10 text-primary hover:bg-primary/15')} onClick={() => setReason(key)}>{declineLabel(key)}</Button>
                ))}
              </div>
              {(reason === 'salary' || reason === 'counter_offer') && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2 text-xs">
                  {t('page.talkAboutIt', { name: hhFirst })}{' '}
                  <button type="button" className="font-medium underline underline-offset-2" onClick={() => setStep('talk')}>{t('page.yesTalk')}</button>
                </p>
              )}
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('page.notePlaceholder')} />
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy || !reason} onClick={() => reason && send({ way: 'declined', reasonCategory: reason, note: note.trim() || undefined }, 'declined')}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{t('page.sendDecline')}</Button>
                <Button variant="ghost" onClick={() => setStep(null)}>{t('page.back')}</Button>
              </div>
            </Panel>
          )}
          {eckdaten}
          {contact}
        </Shell>
      );
  }
}

function Shell({ children }: { children: ReactNode }) {
  return <PublicInterviewShell><div className="space-y-4">{children}</div></PublicInterviewShell>;
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">{children}</div>;
}

function Status({ icon, tone, title, children }: { icon: Parameters<typeof StatusIcon>[0]['icon']; tone: 'success' | 'muted' | 'warning' | 'destructive'; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <StatusIcon icon={icon} tone={tone} />
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
