import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2, Clock, Loader2, Mail, Phone, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { PublicInterviewShell, StatusIcon } from '@/components/interview/PublicInterviewShell';
import { DECLINE_OPTIONS, dateTimeDe, dayDe, euro, offerAnswerApi, type OfferPageView } from '@/lib/offerAnswerApi';

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
  const [view, setView] = useState<OfferPageView | null>(null);
  const [failed, setFailed] = useState<null | 'invalid' | 'error'>(null);
  const [step, setStep] = useState<Step>(null);
  const [done, setDone] = useState<Done>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [topic, setTopic] = useState('');

  useEffect(() => { document.title = 'Ihr Angebot · Matchunt'; }, []);
  useEffect(() => {
    let cancelled = false;
    offerAnswerApi.peek(token)
      .then((v) => { if (!cancelled) setView(v); })
      .catch((e) => { if (!cancelled) setFailed(e instanceof Error && /ungültig/i.test(e.message) ? 'invalid' : 'error'); });
    return () => { cancelled = true; };
  }, [token]);

  const send = async (input: Parameters<typeof offerAnswerApi.answer>[1], result: Done) => {
    setBusy(true);
    try { await offerAnswerApi.answer(token, input); setDone(result); window.scrollTo({ top: 0 }); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Ihre Antwort konnte nicht gespeichert werden.'); }
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

  const v = view;
  const hh = v.recruiter;
  const hhFirst = hh?.name.split(' ')[0] ?? 'Ihr Headhunter';
  const o = v.offer;
  const facts = (
    <dl className="grid grid-cols-[8.5rem_1fr] gap-x-3 gap-y-1.5 rounded-xl border border-border bg-card p-4 text-sm">
      <dt className="text-muted-foreground">Firma</dt><dd>{v.companyName}</dd>
      <dt className="text-muted-foreground">Stelle</dt><dd>{v.jobTitle}</dd>
      <dt className="text-muted-foreground">Fixgehalt</dt><dd>{euro(o.salary)} pro Jahr</dd>
      {o.variable ? <><dt className="text-muted-foreground">Variabel</dt><dd>{euro(o.variable)} pro Jahr</dd></> : null}
      {o.startDate && <><dt className="text-muted-foreground">Erster Arbeitstag</dt><dd>{dayDe(o.startDate)}</dd></>}
      <dt className="text-muted-foreground">Vertrag</dt><dd>{o.contractType === 'fixed_term' ? 'befristet' : 'unbefristet'}{o.probationMonths ? ` · ${o.probationMonths} Monate Probezeit` : ''}</dd>
      {o.workModel && <><dt className="text-muted-foreground">Arbeitsmodell</dt><dd>{o.workModel}</dd></>}
      {o.extras.length > 0 && <><dt className="text-muted-foreground">Extras</dt><dd>{o.extras.join(', ')}</dd></>}
    </dl>
  );
  const contact = hh && (
    <div className="flex items-center gap-3 rounded-xl border border-border p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
        {hh.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 text-sm">
        <p className="font-medium">{hh.name} <span className="font-normal text-muted-foreground">· Ihre Ansprechperson</span></p>
        <p className="text-xs text-muted-foreground">Fragen zum Angebot klären Sie mit {hhFirst}.</p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {hh.phone && <a href={`tel:${hh.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Phone className="h-3 w-3" />{hh.phone}</a>}
          {hh.email && <a href={`mailto:${hh.email}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Mail className="h-3 w-3" />{hh.email}</a>}
        </div>
      </div>
    </div>
  );
  const eckdaten = <p className="text-xs text-muted-foreground">Das sind die Eckdaten, noch kein Arbeitsvertrag. Gegenwünsche besprechen Sie mit {hhFirst}; {hhFirst} gibt sie an die Firma weiter.</p>;

  // Nach dem Antworten
  if (done) {
    const text: Record<Exclude<Done, null>, { title: string; body: string }> = {
      accepted: { title: `Danke, Ihre Zusage ist bei ${v.companyName}`, body: `Als Nächstes kommt Ihr Arbeitsvertrag, über Matchunt oder direkt von der Firma. Wir sagen Ihnen Bescheid, sobald er unterwegs ist. ${hhFirst} begleitet Sie bis zum ersten Tag.` },
      confirmed: { title: 'Danke, bestätigt', body: 'Als Nächstes kommt Ihr Arbeitsvertrag, über Matchunt oder direkt von der Firma. Wir sagen Ihnen Bescheid, sobald er unterwegs ist.' },
      callback: { title: `${hhFirst} ruft Sie zurück`, body: `Spätestens in 2 Stunden, abends erst am nächsten Morgen. ${v.companyName} sieht nur, dass Sie mit ${hhFirst} sprechen. Wünsche gibt ${hhFirst} an die Firma weiter.` },
      declined: { title: 'Danke für Ihre Rückmeldung', body: `${v.companyName} und ${hhFirst} sind informiert.` },
      not_confirmed: { title: 'Danke, das klären wir', body: `Die Zusage gilt nicht. ${hhFirst} meldet sich bei Ihnen, Matchunt sieht sich den Fall an.` },
    };
    return <Shell><Status icon={CheckCircle2} tone="success" title={text[done].title}>{text[done].body}</Status>{contact}</Shell>;
  }

  switch (v.state) {
    case 'answered':
      return (
        <Shell>
          <Status icon={CheckCircle2} tone="success" title={v.answer === 'declined' ? 'Sie haben abgesagt' : 'Sie haben zugesagt'}>
            {v.answer === 'declined' ? `${v.companyName} und ${hhFirst} sind informiert.` : 'Ihr Arbeitsvertrag kommt über Matchunt oder direkt von der Firma. Wir sagen Ihnen Bescheid, sobald er unterwegs ist.'}
          </Status>
          {facts}{contact}
        </Shell>
      );
    case 'expired':
      return <Shell><Status icon={Clock} tone="warning" title="Die Antwortfrist ist abgelaufen">{`Bitte sprechen Sie mit ${hhFirst}. Die Firma kann die Frist verlängern.`}</Status>{contact}</Shell>;
    case 'closed':
      return (
        <Shell>
          <Status icon={Mail} tone="muted" title={v.superseded ? 'Es gibt eine neue Version' : 'Dieses Angebot gilt nicht mehr'}>
            {v.superseded ? `${v.companyName} hat das Angebot angepasst. Die neue Version kommt per Mail, bitte nutzen Sie den Link daraus.` : v.withdrawn ? `${v.companyName} hat das Angebot zurückgezogen. ${hhFirst} meldet sich bei Ihnen.` : 'Bitte nutzen Sie den Link aus der neuesten Mail.'}
          </Status>
          {contact}
        </Shell>
      );
    case 'confirm':
      return (
        <Shell>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">Haben Sie zugesagt?</h1>
            <p className="text-sm text-muted-foreground">{hh?.name ?? 'Ihr Headhunter'} hat {v.companyName}{v.reportedAt ? ` am ${dateTimeDe(v.reportedAt)} Uhr` : ''} Ihre Zusage gemeldet. Bitte bestätigen Sie kurz, dann kommt der Arbeitsvertrag.</p>
          </div>
          {facts}
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => send({ way: 'confirmed' }, 'confirmed')}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Ja, ich sage zu</Button>
            <Button variant="outline" disabled={busy} onClick={() => send({ way: 'not_confirmed' }, 'not_confirmed')}>Stimmt so nicht</Button>
            <Button variant="outline" disabled={busy} onClick={() => send({ way: 'callback' }, 'callback')}>Erst mit {hhFirst} sprechen</Button>
          </div>
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">Ohne Ihre Bestätigung gilt die Zusage nicht. Nach 24 Stunden erinnern wir Sie einmal, {hhFirst} ruft Sie dann an.</p>
          {contact}
        </Shell>
      );
    case 'open':
    default:
      return (
        <Shell>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">Ihr Angebot von {v.companyName}</h1>
            <p className="text-sm text-muted-foreground">{o.version > 1 ? `Version ${o.version} · ` : ''}Antwort bis {dayDe(o.responseDue)}</p>
          </div>
          {v.callbackRequestedAt && (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">{hhFirst} ruft Sie zurück (angefragt am {dateTimeDe(v.callbackRequestedAt)} Uhr). Sie können trotzdem jederzeit hier antworten.</p>
          )}
          {facts}
          {v.message && <p className="text-sm text-muted-foreground">Nachricht von {v.companyName}: „{v.message}“</p>}

          {step === null && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setStep('accept')}>Ich sage zu</Button>
              <Button variant="outline" onClick={() => setStep('talk')}>Mit {hhFirst} sprechen</Button>
              <Button variant="outline" onClick={() => { setStep('decline'); setReason(null); }}>Ich sage ab</Button>
            </div>
          )}
          {step === 'accept' && (
            <Panel>
              <p className="text-sm">Mit „Verbindlich zusagen“ sagen Sie {v.companyName} zu den Eckdaten oben zu. Den Arbeitsvertrag unterschreiben Sie danach gesondert.</p>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy} onClick={() => send({ way: 'accepted' }, 'accepted')}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Verbindlich zusagen</Button>
                <Button variant="ghost" onClick={() => setStep(null)}>Zurück</Button>
              </div>
            </Panel>
          )}
          {step === 'talk' && (
            <Panel>
              <p className="text-sm">Worum geht es? (optional)</p>
              <Textarea rows={2} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="z. B. Startdatum, Gehalt, Homeoffice …" />
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy} onClick={() => send({ way: 'callback', topic: topic.trim() || undefined }, 'callback')}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{hhFirst} soll mich anrufen</Button>
                <Button variant="ghost" onClick={() => setStep(null)}>Zurück</Button>
              </div>
            </Panel>
          )}
          {step === 'decline' && (
            <Panel>
              <p className="text-sm">Was ist der Grund? <span className="text-muted-foreground">(geht an {v.companyName} und {hhFirst})</span></p>
              <div className="flex flex-wrap gap-1.5">
                {DECLINE_OPTIONS.map((r) => (
                  <Button key={r.key} type="button" size="sm" variant="outline" aria-pressed={reason === r.key} className={cn('h-8 text-xs', reason === r.key && 'border-primary bg-primary/10 text-primary hover:bg-primary/15')} onClick={() => setReason(r.key)}>{r.label}</Button>
                ))}
              </div>
              {(reason === 'salary' || reason === 'counter_offer') && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2 text-xs">
                  Oft lässt sich darüber reden. Möchten Sie vorher mit {hhFirst} sprechen?{' '}
                  <button type="button" className="font-medium underline underline-offset-2" onClick={() => setStep('talk')}>Ja, erst sprechen</button>
                </p>
              )}
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Möchten Sie noch etwas sagen? (optional)" />
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy || !reason} onClick={() => reason && send({ way: 'declined', reasonCategory: reason, note: note.trim() || undefined }, 'declined')}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Absage senden</Button>
                <Button variant="ghost" onClick={() => setStep(null)}>Zurück</Button>
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
