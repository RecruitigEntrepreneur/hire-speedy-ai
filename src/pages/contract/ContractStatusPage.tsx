import { useEffect, useState, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
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
const shortDe = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

export default function ContractStatusPage() {
  const { token = '' } = useParams<{ token: string }>();
  const [search] = useSearchParams();
  const [view, setView] = useState<StatusPageView | null>(null);
  const [failed, setFailed] = useState<null | 'invalid' | 'error'>(null);
  const [step, setStep] = useState<Step>(null);
  const [done, setDone] = useState<Step>(null);
  const [busy, setBusy] = useState(false);
  const [signedOn, setSignedOn] = useState(todayKey());
  const [startDate, setStartDate] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => { document.title = 'Ihr Arbeitsvertrag · Matchunt'; }, []);
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
      .catch((e) => { if (!cancelled) setFailed(e instanceof Error && /ungültig/i.test(e.message) ? 'invalid' : 'error'); });
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
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Ihre Antwort konnte nicht gespeichert werden.'); }
    finally { setBusy(false); }
  };

  if (failed === 'invalid') {
    return <Shell><Status icon={XCircle} tone="destructive" title="Dieser Link ist nicht gültig">Bitte öffnen Sie den Link direkt aus der Mail. Vielleicht wurde er beim Kopieren abgeschnitten.</Status></Shell>;
  }
  if (failed) {
    return <Shell><Status icon={AlertCircle} tone="warning" title="Die Seite lädt gerade nicht">Bitte versuchen Sie es in einem Moment noch einmal.</Status></Shell>;
  }
  if (!view) {
    return <Shell><div className="flex flex-col items-center py-16 text-center text-sm text-muted-foreground"><Loader2 className="mb-3 h-6 w-6 animate-spin" />wird geladen …</div></Shell>;
  }
  if (view.state === 'invalid') {
    return <Shell><Status icon={XCircle} tone="destructive" title="Dieser Link ist nicht gültig">Bitte öffnen Sie den Link direkt aus der Mail. Vielleicht wurde er beim Kopieren abgeschnitten.</Status></Shell>;
  }

  const v = view;
  const company = v.companyName ?? 'Die Firma';
  const hh = v.recruiter ?? null;
  const hhFirst = hh?.name.split(' ')[0] ?? 'Ihr Headhunter';
  const start = v.startDate ? dayDe(v.startDate) : null;
  const facts = (
    <dl className="grid grid-cols-[8.5rem_1fr] gap-x-3 gap-y-1.5 rounded-xl border border-border bg-card p-4 text-sm">
      <dt className="text-muted-foreground">Firma</dt><dd>{company}</dd>
      {v.jobTitle && <><dt className="text-muted-foreground">Stelle</dt><dd>{v.jobTitle}</dd></>}
      {start && <><dt className="text-muted-foreground">Erster Arbeitstag</dt><dd>{start}</dd></>}
      {v.salary ? <><dt className="text-muted-foreground">Gehalt</dt><dd>{euro(v.salary)}{v.variable ? ` + ${euro(v.variable)} variabel` : ''} pro Jahr</dd></> : null}
    </dl>
  );
  const contact = hh && (
    <div className="flex items-center gap-3 rounded-xl border border-border p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
        {hh.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 text-sm">
        <p className="font-medium">{hh.name} <span className="font-normal text-muted-foreground">· Ihre Ansprechperson</span></p>
        <p className="text-xs text-muted-foreground">Fragen zum Vertrag klären Sie mit {hhFirst}.</p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {hh.phone && <a href={`tel:${hh.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Phone className="h-3 w-3" />{hh.phone}</a>}
          {hh.email && <a href={`mailto:${hh.email}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Mail className="h-3 w-3" />{hh.email}</a>}
        </div>
      </div>
    </div>
  );
  const back = <Button variant="ghost" onClick={() => setStep(null)}>Zurück</Button>;
  const spin = busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />;

  switch (v.state) {
    case 'expired':
      return <Shell><Status icon={Clock} tone="warning" title="Dieser Link ist abgelaufen">{`Bitte melden Sie sich bei ${hhFirst}.`}</Status>{contact}</Shell>;
    case 'closed':
      return <Shell><Status icon={Mail} tone="muted" title="Dieser Link gilt nicht mehr">{`Bitte melden Sie sich bei ${hhFirst}.`}</Status>{contact}</Shell>;
    case 'digital':
      return (
        <Shell>
          <Status icon={Mail} tone="muted" title="Ihr Vertrag kommt über Matchunt">{`Den Link zum Unterschreiben bekommen Sie per Mail, sobald ${company} unterschrieben hat.`}</Status>
          {facts}{contact}
        </Shell>
      );
    case 'reported':
      return (
        <Shell>
          <Status icon={CheckCircle2} tone="success" title={done === 'signed' ? `Danke! ${company} bestätigt noch` : 'Ihre Unterschrift ist gemeldet'}>
            {v.reportedByYou ? `Sie haben am ${shortDe(v.signedOn)} unterschrieben. ${company} bestätigt das noch, ${hhFirst} begleitet Sie bis zum ersten Tag.` : `${company} bestätigt die Unterschrift noch. ${hhFirst} begleitet Sie bis zum ersten Tag.`}
          </Status>
          {facts}{contact}
        </Shell>
      );
    case 'signed':
      return (
        <Shell>
          <Status icon={CheckCircle2} tone="success" title={done === 'ok' ? `Danke, viel Erfolg${start ? ` am ${shortDe(v.startDate)}` : ''}!` : done === 'differs' ? 'Danke, das klären wir' : 'Ihr Arbeitsvertrag ist unterschrieben'}>
            {v.candidateCheck === 'differs'
              ? `Sie haben uns gesagt, dass die Meldung von ${company} so nicht stimmt. ${hhFirst} und Matchunt klären das und melden sich bei Ihnen.`
              : `${start ? `Ihr erster Arbeitstag: ${start}. ` : ''}${hhFirst} begleitet Sie bis zum ersten Tag.`}
          </Status>
          {facts}{contact}
        </Shell>
      );
    case 'check':
      return (
        <Shell>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">Glückwunsch!</h1>
            <p className="text-sm text-muted-foreground">{company} meldet: Ihr Arbeitsvertrag ist{v.signedOn ? ` seit ${shortDe(v.signedOn)}` : ''} unterschrieben.{start ? ` Ihr erster Arbeitstag: ${start}.` : ''} Stimmt das so?</p>
          </div>
          {facts}
          {step === null && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setStep('ok')}>Stimmt</Button>
              <Button variant="outline" onClick={() => setStep('differs')}>Stimmt so nicht</Button>
            </div>
          )}
          {step === 'ok' && (
            <Panel>
              <p className="text-sm">Unterschrieben{v.signedOn ? ` am ${shortDe(v.signedOn)}` : ''}{start ? `, erster Arbeitstag ${start}` : ''}: Stimmt alles?</p>
              <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => send({ way: 'ok' })}>{spin}Ja, stimmt</Button>{back}</div>
            </Panel>
          )}
          {step === 'differs' && (
            <Panel>
              <p className="text-sm">Was stimmt nicht? <span className="text-muted-foreground">(geht an {hhFirst} und Matchunt)</span></p>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Noch nicht unterschrieben, anderer erster Arbeitstag …" />
              <div className="flex flex-wrap gap-2"><Button disabled={busy || !note.trim()} onClick={() => send({ way: 'differs', note: note.trim() })}>{spin}Senden</Button>{back}</div>
            </Panel>
          )}
          {contact}
        </Shell>
      );
    case 'open':
    default: {
      const banner = done === 'arrived' ? { title: `Danke, ${hhFirst} weiß Bescheid`, body: 'Sobald Sie unterschrieben haben, melden Sie es hier.' }
        : done === 'missing' ? { title: 'Danke, wir geben Bescheid', body: `${company} und ${hhFirst} wissen jetzt, dass der Vertrag noch nicht da ist. ${hhFirst} meldet sich bei Ihnen.` }
          : null;
      return (
        <Shell>
          {banner ? <Status icon={CheckCircle2} tone="success" title={banner.title}>{banner.body}</Status> : (
            <div className="space-y-1">
              <h1 className="text-xl font-semibold">Ihr Arbeitsvertrag mit {company}</h1>
              <p className="text-sm text-muted-foreground">{v.sentAt ? `Laut ${company} am ${shortDe(v.sentAt)} verschickt, direkt von der Firma, per Post oder Mail.` : `${company} bereitet den Vertrag gerade vor.`}</p>
            </div>
          )}
          {!banner && v.candidateStatus && (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
              {v.candidateStatus === 'arrived' ? `Sie haben gemeldet: angekommen (${shortDe(v.candidateStatusAt)}).` : `Sie haben gemeldet: noch nicht da (${shortDe(v.candidateStatusAt)}). ${company} und ${hhFirst} wissen Bescheid.`}
            </p>
          )}
          {facts}
          {step === null && (
            <div className="flex flex-wrap gap-2">
              {v.candidateStatus !== 'arrived' && <Button variant={v.candidateStatus === 'missing' ? 'outline' : 'default'} onClick={() => setStep('arrived')}>Ist angekommen</Button>}
              {!v.candidateStatus && <Button variant="outline" onClick={() => setStep('missing')}>Noch nicht da</Button>}
              <Button variant={v.candidateStatus === 'arrived' ? 'default' : 'outline'} onClick={() => setStep('signed')}>{v.candidateStatus === 'arrived' ? 'Unterschrift melden' : 'Schon unterschrieben'}</Button>
            </div>
          )}
          {step === 'arrived' && (
            <Panel>
              <p className="text-sm">Ist Ihr Arbeitsvertrag bei Ihnen angekommen?</p>
              <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => send({ way: 'arrived' })}>{spin}Ja, angekommen</Button>{back}</div>
            </Panel>
          )}
          {step === 'missing' && (
            <Panel>
              <p className="text-sm">Ihr Vertrag ist noch nicht da? Wir sagen {company} und {hhFirst} Bescheid. {hhFirst} meldet sich bei Ihnen.</p>
              <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => send({ way: 'missing' })}>{spin}Ja, Bescheid geben</Button>{back}</div>
            </Panel>
          )}
          {step === 'signed' && (
            <Panel>
              <p className="text-sm">Unterschrift melden <span className="text-muted-foreground">({company} bestätigt sie danach)</span></p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs text-muted-foreground">Unterschrieben am
                  <Input type="date" value={signedOn} max={todayKey()} onChange={(e) => setSignedOn(e.target.value)} />
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">Erster Arbeitstag
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy || !signedOn || !startDate} onClick={() => send({ way: 'signed', signedOn, startDate })}>{spin}Melden</Button>{back}
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
