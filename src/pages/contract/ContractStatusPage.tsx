import { useEffect, useState, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { fmtDate } from '@/lib/localeFormat';
import { AlertCircle, CheckCircle2, Clock, Loader2, Mail, Phone, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PublicInterviewShell, StatusIcon } from '@/components/interview/PublicInterviewShell';
import { contractStatusApi, type StatusAnswer, type StatusPageView } from '@/lib/contractApi';
import { dayDe, euro } from '@/lib/offerAnswerApi';

/*
 * Stand des Arbeitsvertrags für den Kandidaten (29.10.2026): /vertrag/:token, ohne Anmeldung.
 * Der persönliche Link aus der Mail „<Headhunter> über Matchunt“ ist der Zugang.
 * Ist angekommen · Noch nicht da · Schon unterschrieben; nach einer Meldung der Firma
 * „Stimmt“ oder „Stimmt so nicht“. Die Knöpfe der Mail öffnen die Seite mit ?a=…;
 * gespeichert wird erst hier per Klick (Mail-Programme öffnen Links vorab).
 */

type Step = null | StatusAnswer;

const todayKey = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
const shortDe = (iso: string | null | undefined) => (iso ? fmtDate(`${iso.slice(0, 10)}T12:00:00Z`) : '');

export default function ContractStatusPage() {
  const { token = '' } = useParams<{ token: string }>();
  const { t } = useTranslation('signing');
  const [search] = useSearchParams();
  const [view, setView] = useState<StatusPageView | null>(null);
  const [failed, setFailed] = useState<null | 'invalid' | 'error'>(null);
  const [step, setStep] = useState<Step>(null);
  const [done, setDone] = useState<Step>(null);
  const [busy, setBusy] = useState(false);
  const [signedOn, setSignedOn] = useState(todayKey());
  const [startDate, setStartDate] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => { document.title = t('status.docTitle'); }, [t]);
  useEffect(() => {
    let cancelled = false;
    contractStatusApi.peek(token)
      .then((v) => {
        if (cancelled) return;
        setView(v);
        setStartDate(v.startDate?.slice(0, 10) ?? '');
        // Knopf aus der Mail: Antwort vorwählen, passend zum Stand
        const a = search.get('a') as StatusAnswer | null;
        if (v.state === 'open' && (a === 'arrived' || a === 'missing' || a === 'signed') && v.candidateStatus !== a) setStep(a);
        if (v.state === 'check' && (a === 'ok' || a === 'differs')) setStep(a);
      })
      .catch((e) => { if (!cancelled) setFailed(e instanceof Error && /ungültig|invalid|ogiltig|ugyldig/i.test(e.message) ? 'invalid' : 'error'); });
    return () => { cancelled = true; };
  }, [token, search]);

  const send = async (input: Parameters<typeof contractStatusApi.answer>[1]) => {
    setBusy(true);
    try {
      const r = await contractStatusApi.answer(token, input);
      setView(r.view);
      setDone(input.way);
      setStep(null);
      window.scrollTo({ top: 0 });
    } catch (e) { toast.error(e instanceof Error ? e.message : t('status.saveFailed')); }
    finally { setBusy(false); }
  };

  if (failed === 'invalid') {
    return <Shell><Status icon={XCircle} tone="destructive" title={t('common.invalidTitle')}>{t('status.invalidBody')}</Status></Shell>;
  }
  if (failed) {
    return <Shell><Status icon={AlertCircle} tone="warning" title={t('common.errorTitle')}>{t('common.errorBody')}</Status></Shell>;
  }
  if (!view) {
    return <Shell><div className="flex flex-col items-center py-16 text-center text-sm text-muted-foreground"><Loader2 className="mb-3 h-6 w-6 animate-spin" />{t('common.loading')}</div></Shell>;
  }
  if (view.state === 'invalid') {
    return <Shell><Status icon={XCircle} tone="destructive" title={t('common.invalidTitle')}>{t('status.invalidBody')}</Status></Shell>;
  }

  const v = view;
  const company = v.companyName ?? t('status.theCompany');
  const hh = v.recruiter ?? null;
  const hhFirst = hh?.name.split(' ')[0] ?? t('common.yourHeadhunter');
  const start = v.startDate ? dayDe(v.startDate) : null;
  const facts = (
    <dl className="grid grid-cols-[8.5rem_1fr] gap-x-3 gap-y-1.5 rounded-xl border border-border bg-card p-4 text-sm">
      <dt className="text-muted-foreground">{t('common.company')}</dt><dd>{company}</dd>
      {v.jobTitle && <><dt className="text-muted-foreground">{t('common.job')}</dt><dd>{v.jobTitle}</dd></>}
      {start && <><dt className="text-muted-foreground">{t('common.firstDay')}</dt><dd>{start}</dd></>}
      {v.salary ? <><dt className="text-muted-foreground">{t('common.salary')}</dt><dd>{v.variable ? t('common.salaryValueVariable', { amount: euro(v.salary), variable: euro(v.variable) }) : t('common.salaryValue', { amount: euro(v.salary) })}</dd></> : null}
    </dl>
  );
  const contact = hh && (
    <div className="flex items-center gap-3 rounded-xl border border-border p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
        {hh.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 text-sm">
        <p className="font-medium">{hh.name} <span className="font-normal text-muted-foreground">{t('status.contactRole')}</span></p>
        <p className="text-xs text-muted-foreground">{t('status.contactHint', { name: hhFirst })}</p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {hh.phone && <a href={`tel:${hh.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Phone className="h-3 w-3" />{hh.phone}</a>}
          {hh.email && <a href={`mailto:${hh.email}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Mail className="h-3 w-3" />{hh.email}</a>}
        </div>
      </div>
    </div>
  );
  const back = <Button variant="ghost" onClick={() => setStep(null)}>{t('common.back')}</Button>;
  const spin = busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />;

  switch (v.state) {
    case 'expired':
      return <Shell><Status icon={Clock} tone="warning" title={t('status.expiredTitle')}>{t('status.contactBody', { name: hhFirst })}</Status>{contact}</Shell>;
    case 'closed':
      return <Shell><Status icon={Mail} tone="muted" title={t('status.closedTitle')}>{t('status.contactBody', { name: hhFirst })}</Status>{contact}</Shell>;
    case 'digital':
      return (
        <Shell>
          <Status icon={Mail} tone="muted" title={t('status.digitalTitle')}>{t('status.digitalBody', { company })}</Status>
          {facts}{contact}
        </Shell>
      );
    case 'reported':
      return (
        <Shell>
          <Status icon={CheckCircle2} tone="success" title={done === 'signed' ? t('status.reportedThanks', { company }) : t('status.reportedTitle')}>
            {v.reportedByYou ? t('status.reportedByYou', { date: shortDe(v.signedOn), company, name: hhFirst }) : t('status.reportedByCompany', { company, name: hhFirst })}
          </Status>
          {facts}{contact}
        </Shell>
      );
    case 'signed':
      return (
        <Shell>
          <Status icon={CheckCircle2} tone="success" title={done === 'ok' ? (start ? t('status.okTitleDate', { date: shortDe(v.startDate) }) : t('status.okTitle')) : done === 'differs' ? t('status.differsTitle') : t('status.signedTitle')}>
            {v.candidateCheck === 'differs'
              ? t('status.differsBody', { company, name: hhFirst })
              : start ? t('status.signedBodyStart', { date: start, name: hhFirst }) : t('status.signedBody', { name: hhFirst })}
          </Status>
          {facts}{contact}
        </Shell>
      );
    case 'check':
      return (
        <Shell>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">{t('status.congrats')}</h1>
            <p className="text-sm text-muted-foreground">{v.signedOn ? t('status.companyReportsSince', { company, date: shortDe(v.signedOn) }) : t('status.companyReports', { company })}{start ? t('status.firstDayIs', { date: start }) : ''}{t('status.isThatRight')}</p>
          </div>
          {facts}
          {step === null && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setStep('ok')}>{t('status.right')}</Button>
              <Button variant="outline" onClick={() => setStep('differs')}>{t('status.notRight')}</Button>
            </div>
          )}
          {step === 'ok' && (
            <Panel>
              <p className="text-sm">{v.signedOn ? (start ? t('status.okQuestionDateStart', { date: shortDe(v.signedOn), start }) : t('status.okQuestionDate', { date: shortDe(v.signedOn) })) : start ? t('status.okQuestionStart', { start }) : t('status.okQuestion')}</p>
              <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => send({ way: 'ok' })}>{spin}{t('status.yesRight')}</Button>{back}</div>
            </Panel>
          )}
          {step === 'differs' && (
            <Panel>
              <p className="text-sm">{t('status.whatsWrong')} <span className="text-muted-foreground">{t('status.goesTo', { name: hhFirst })}</span></p>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('status.wrongPlaceholder')} />
              <div className="flex flex-wrap gap-2"><Button disabled={busy || !note.trim()} onClick={() => send({ way: 'differs', note: note.trim() })}>{spin}{t('status.send')}</Button>{back}</div>
            </Panel>
          )}
          {contact}
        </Shell>
      );
    case 'open':
    default: {
      const banner = done === 'arrived' ? { title: t('status.arrivedTitle', { name: hhFirst }), body: t('status.arrivedBody') }
        : done === 'missing' ? { title: t('status.missingTitle'), body: t('status.missingBody', { company, name: hhFirst }) }
          : null;
      return (
        <Shell>
          {banner ? <Status icon={CheckCircle2} tone="success" title={banner.title}>{banner.body}</Status> : (
            <div className="space-y-1">
              <h1 className="text-xl font-semibold">{t('status.contractWith', { company })}</h1>
              <p className="text-sm text-muted-foreground">{v.sentAt ? t('status.sentOn', { company, date: shortDe(v.sentAt) }) : t('status.preparing', { company })}</p>
            </div>
          )}
          {!banner && v.candidateStatus && (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
              {v.candidateStatus === 'arrived' ? t('status.reportedArrived', { date: shortDe(v.candidateStatusAt) }) : t('status.reportedMissing', { date: shortDe(v.candidateStatusAt), company, name: hhFirst })}
            </p>
          )}
          {facts}
          {step === null && (
            <div className="flex flex-wrap gap-2">
              {v.candidateStatus !== 'arrived' && <Button variant={v.candidateStatus === 'missing' ? 'outline' : 'default'} onClick={() => setStep('arrived')}>{t('status.arrived')}</Button>}
              {!v.candidateStatus && <Button variant="outline" onClick={() => setStep('missing')}>{t('status.missing')}</Button>}
              <Button variant={v.candidateStatus === 'arrived' ? 'default' : 'outline'} onClick={() => setStep('signed')}>{v.candidateStatus === 'arrived' ? t('status.reportSignature') : t('status.alreadySigned')}</Button>
            </div>
          )}
          {step === 'arrived' && (
            <Panel>
              <p className="text-sm">{t('status.arrivedQuestion')}</p>
              <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => send({ way: 'arrived' })}>{spin}{t('status.yesArrived')}</Button>{back}</div>
            </Panel>
          )}
          {step === 'missing' && (
            <Panel>
              <p className="text-sm">{t('status.missingQuestion', { company, name: hhFirst })}</p>
              <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => send({ way: 'missing' })}>{spin}{t('status.yesTell')}</Button>{back}</div>
            </Panel>
          )}
          {step === 'signed' && (
            <Panel>
              <p className="text-sm">{t('status.reportSignature')} <span className="text-muted-foreground">{t('status.confirmsAfter', { company })}</span></p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs text-muted-foreground">{t('status.signedOn')}
                  <Input type="date" value={signedOn} max={todayKey()} onChange={(e) => setSignedOn(e.target.value)} />
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">{t('common.firstDay')}
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy || !signedOn || !startDate} onClick={() => send({ way: 'signed', signedOn, startDate })}>{spin}{t('status.report')}</Button>{back}
              </div>
            </Panel>
          )}
          {contact}
        </Shell>
      );
    }
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
