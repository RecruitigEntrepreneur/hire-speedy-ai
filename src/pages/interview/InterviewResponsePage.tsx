import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertCircle, ArrowLeft, CalendarPlus, CalendarX, CheckCircle2, Clock, History, Loader2, Video, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  candidateApi, fmtDayLong, fmtDayShort, fmtRange, fmtTime, type CandidateView,
} from '@/lib/interviewScheduling';
import {
  GermanTime, PublicInterviewShell, QuoteBlock, RecruiterContactCard, StatusIcon,
} from '@/components/interview/PublicInterviewShell';

/*
 * Kandidatenseite der Interview-Einladung (/interview/respond/:token).
 * Ohne Anmeldung; der Token im Pfad ist der Zugang. Der Server liefert eine
 * fertige Sicht (CandidateView) und nach jeder Aktion die neue Sicht zurück;
 * die Seite rechnet nichts selbst aus. Alle Zeiten in deutscher Zeit.
 */

type Mode = 'pick' | 'alternative' | 'decline';

const OTHER_REASON = 'Anderer Grund';
const DECLINE_REASONS = [
  'Ich habe ein anderes Angebot angenommen',
  'Die Stelle passt doch nicht zu mir',
  'Zeitlich passt es gerade nicht',
  OTHER_REASON,
] as const;

const errorText = (err: unknown) =>
  err instanceof Error && err.message ? err.message : 'Das hat nicht geklappt. Bitte erneut versuchen.';
const endOf = (iso: string, minutes: number) => new Date(Date.parse(iso) + minutes * 60000).toISOString();
const timeSpan = (iso: string, minutes: number) => `${fmtTime(iso)}–${fmtTime(endOf(iso, minutes))} Uhr`;

export default function InterviewResponsePage() {
  const { token = '' } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const action = searchParams.get('action');

  const [view, setView] = useState<CandidateView | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  // Alte Mail-Links: ?action=decline öffnet die Absage, ?action=counter die andere Zeit.
  const [mode, setMode] = useState<Mode>(action === 'decline' ? 'decline' : action === 'counter' ? 'alternative' : 'pick');
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    document.title = 'Interview-Einladung · Matchunt';
  }, []);

  useEffect(() => {
    let cancelled = false;
    setView(null);
    setLoadFailed(false);
    if (!token) {
      setLoadFailed(true);
      return;
    }
    candidateApi.load(token)
      .then((v) => { if (!cancelled) setView(v); })
      .catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => { cancelled = true; };
  }, [token, attempt]);

  /** Führt eine Aktion aus; bei Fehler Meldung zeigen und die Sicht neu laden. */
  const run = async (task: () => Promise<CandidateView>) => {
    setBusy(true);
    try {
      const next = await task();
      setView(next);
      setMode('pick');
      window.scrollTo(0, 0);
    } catch (err) {
      toast.error(errorText(err));
      try {
        setView(await candidateApi.load(token));
      } catch {
        // Die bisherige Sicht bleibt stehen; die Meldung oben reicht.
      }
    } finally {
      setBusy(false);
    }
  };

  if (loadFailed) {
    return (
      <PublicInterviewShell>
        <div className="space-y-4 pt-8 text-center">
          <StatusIcon icon={AlertCircle} />
          <h1 className="text-xl font-semibold">Dieser Link ist ungültig oder abgelaufen.</h1>
          <p className="text-sm text-muted-foreground">
            Bitte nutzen Sie den Link aus der neuesten E-Mail zu Ihrem Interview oder melden Sie sich bei Ihrem Headhunter.
          </p>
          <Button variant="outline" className="min-h-11" onClick={() => setAttempt((n) => n + 1)}>Erneut laden</Button>
        </div>
      </PublicInterviewShell>
    );
  }

  if (!view) {
    return (
      <PublicInterviewShell>
        <div className="flex items-center justify-center gap-2 pt-16 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-5 w-5 animate-spin" /> Einladung wird geladen …
        </div>
      </PublicInterviewShell>
    );
  }

  const recruiterName = view.recruiter?.name ?? 'Ihrem Headhunter';

  let content: ReactNode;
  switch (view.state) {
    case 'open': {
      const effective: Mode = mode === 'alternative' && !view.allowAlternative ? 'pick' : mode;
      content = effective === 'decline'
        ? <DeclinePanel busy={busy} onBack={() => setMode('pick')} onDecline={(reason) => run(() => candidateApi.decline(token, reason))} />
        : effective === 'alternative'
          ? <AlternativePanel
              view={view}
              busy={busy}
              consent={consent}
              onConsent={setConsent}
              onBack={() => setMode('pick')}
              onSubmit={(start, message) => run(() => candidateApi.alternative(token, start, message, view.consentRequired && consent))}
            />
          : <OpenPanel
              view={view}
              initialSlot={searchParams.get('slot')}
              busy={busy}
              consent={consent}
              onConsent={setConsent}
              onAccept={(start) => run(() => candidateApi.accept(token, start, view.consentRequired && consent))}
              onAlternative={() => { setMode('alternative'); window.scrollTo(0, 0); }}
              onDecline={() => { setMode('decline'); window.scrollTo(0, 0); }}
            />;
      break;
    }
    case 'scheduled':
      content = <ScheduledPanel view={view} />;
      break;
    case 'alternative_requested':
      content = <RequestedPanel view={view} />;
      break;
    case 'declined':
      content = (
        <EndState icon={XCircle} title="Sie haben das Interview abgelehnt." recruiter={view.recruiter}>
          {view.companyName} und {view.recruiter?.name ?? 'Ihr Headhunter'} sind informiert.
        </EndState>
      );
      break;
    case 'cancelled':
      content = (
        <EndState icon={CalendarX} title="Dieses Interview wurde abgesagt." recruiter={view.recruiter}>
          Bei Fragen melden Sie sich bei {recruiterName}.
        </EndState>
      );
      break;
    case 'expired':
      content = (
        <EndState icon={History} title="Diese Einladung ist abgelaufen." recruiter={view.recruiter}>
          Wenn Sie weiterhin Interesse haben, melden Sie sich bei {recruiterName}.
        </EndState>
      );
      break;
    case 'completed':
      content = <EndState icon={CheckCircle2} title="Dieses Interview hat bereits stattgefunden." recruiter={null} />;
      break;
    default:
      content = <EndState icon={AlertCircle} title="Diese Einladung kann gerade nicht angezeigt werden." recruiter={view.recruiter} />;
  }

  return <PublicInterviewShell>{content}</PublicInterviewShell>;
}

/* ------------------------------------------------------------------------ */

function InviteHeader({ view }: { view: CandidateView }) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold leading-tight tracking-tight">{view.companyName} möchte Sie kennenlernen</h1>
      <p className="text-sm text-muted-foreground">
        {view.jobTitle} · {view.durationMinutes} Min · Microsoft Teams
      </p>
      {view.interviewers.length > 0 && (
        <p className="text-sm">
          <span className="text-muted-foreground">Gesprächspartner: </span>
          {view.interviewers.map((p) => (p.title ? `${p.name}, ${p.title}` : p.name)).join(' · ')}
        </p>
      )}
    </div>
  );
}

function ConsentBox({ view, consent, onConsent }: { view: CandidateView; consent: boolean; onConsent: (v: boolean) => void }) {
  if (!view.consentRequired) return null;
  return (
    <label
      htmlFor="interview-consent"
      className={cn(
        'flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm leading-relaxed',
        consent ? 'border-primary/60 bg-secondary/40' : 'border-border bg-card',
      )}
    >
      <Checkbox
        id="interview-consent"
        checked={consent}
        onCheckedChange={(v) => onConsent(v === true)}
        className="mt-0.5 h-5 w-5"
        aria-required
      />
      <span>{view.consentText}</span>
    </label>
  );
}

function OpenPanel({ view, initialSlot, busy, consent, onConsent, onAccept, onAlternative, onDecline }: {
  view: CandidateView;
  /** Termin aus dem Mail-Link (?slot=…) vorauswählen */
  initialSlot?: string | null;
  busy: boolean;
  consent: boolean;
  onConsent: (v: boolean) => void;
  onAccept: (start: string) => void;
  onAlternative: () => void;
  onDecline: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(() => {
    const wanted = initialSlot ? Date.parse(initialSlot) : NaN;
    return view.slots.find((s) => s.available && Date.parse(s.start) === wanted)?.start ?? null;
  });
  // Ist der gewählte Termin nach einem Neuladen nicht mehr frei, gilt er als nicht gewählt.
  const chosen = selected && view.slots.some((s) => s.start === selected && s.available) ? selected : null;
  const anyFree = view.slots.some((s) => s.available);
  const missingConsent = view.consentRequired && !consent;

  return (
    <div className="space-y-6">
      <InviteHeader view={view} />
      <RecruiterContactCard recruiter={view.recruiter} />
      {view.message && <QuoteBlock label={`Nachricht von ${view.companyName}`} text={view.message} />}

      <section className="space-y-3" aria-labelledby="slot-heading">
        <div>
          <h2 id="slot-heading" className="text-base font-semibold">Wählen Sie einen Termin</h2>
          <p className="text-xs text-muted-foreground">Alle Zeiten: <GermanTime isos={view.slots.map((s) => s.start)} /></p>
        </div>
        <div role="radiogroup" aria-labelledby="slot-heading" className="space-y-2">
          {view.slots.map((slot) => {
            const active = chosen === slot.start;
            return (
              <button
                key={slot.start}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={!slot.available || busy}
                onClick={() => setSelected(slot.start)}
                className={cn(
                  'flex min-h-[52px] w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active ? 'border-primary bg-secondary/60' : 'border-border bg-card hover:bg-accent',
                  !slot.available && 'cursor-not-allowed opacity-50 hover:bg-card',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                    active ? 'border-primary' : 'border-muted-foreground/50',
                  )}
                >
                  {active && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                </span>
                <span className={cn('flex-1 text-sm font-medium', !slot.available && 'line-through')}>
                  {fmtRange(slot.start, view.durationMinutes)}
                </span>
                {!slot.available && <span className="text-xs text-muted-foreground">nicht mehr frei</span>}
              </button>
            );
          })}
        </div>
        {!anyFree && (
          <p className="text-sm text-muted-foreground">
            Die vorgeschlagenen Termine sind inzwischen vergeben.{' '}
            {view.allowAlternative ? 'Wählen Sie unten eine andere Zeit.' : `Bitte melden Sie sich bei ${view.recruiter?.name ?? 'Ihrem Headhunter'}.`}
          </p>
        )}
      </section>

      <ConsentBox view={view} consent={consent} onConsent={onConsent} />

      <div className="space-y-3">
        <Button
          size="lg"
          className="h-12 w-full"
          disabled={!chosen || missingConsent || busy}
          onClick={() => chosen && onAccept(chosen)}
        >
          {busy && <Loader2 className="animate-spin" />}
          Interview bestätigen
        </Button>
        {chosen && missingConsent && (
          <p className="text-center text-xs text-muted-foreground">Bitte bestätigen Sie zuerst die Einwilligung.</p>
        )}
        {view.allowAlternative && (
          <Button variant="outline" size="lg" className="h-12 w-full" disabled={busy} onClick={onAlternative}>
            Keiner passt? Andere Zeit wählen
          </Button>
        )}
        <div className="flex justify-center">
          <button
            type="button"
            disabled={busy}
            onClick={onDecline}
            className="min-h-11 px-3 text-sm font-medium text-destructive underline-offset-4 hover:underline disabled:opacity-50"
          >
            Interview ablehnen
          </button>
        </div>
      </div>
    </div>
  );
}

function Chip({ active, disabled, onClick, children, className }: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'min-h-11 rounded-full border px-4 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-accent',
        className,
      )}
    >
      {children}
    </button>
  );
}

function AlternativePanel({ view, busy, consent, onConsent, onBack, onSubmit }: {
  view: CandidateView;
  busy: boolean;
  consent: boolean;
  onConsent: (v: boolean) => void;
  onBack: () => void;
  onSubmit: (start: string, message: string) => void;
}) {
  const [day, setDay] = useState<string | null>(view.alternatives[0]?.date ?? null);
  const [start, setStart] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const current = view.alternatives.find((d) => d.date === day) ?? view.alternatives[0] ?? null;
  const allTimes = view.alternatives.flatMap((d) => d.times);
  const chosen = start && allTimes.includes(start) ? start : null;
  const book = view.alternativeMode === 'book';
  const missingConsent = view.consentRequired && !consent;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Zurück zu den Vorschlägen
      </button>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight">Welche Zeit passt Ihnen?</h1>
        <p className="text-sm text-muted-foreground">
          {book
            ? 'Alle Zeiten sind beim Unternehmen frei.'
            : `${view.companyName} bestätigt Ihre Anfrage, meist innerhalb eines Werktags.`}
        </p>
      </div>

      {view.alternatives.length === 0 ? (
        <div className="space-y-4">
          <p className="rounded-xl border border-border bg-card p-4 text-sm">
            Im Moment gibt es keine weiteren freien Zeiten. Bitte melden Sie sich bei {view.recruiter?.name ?? 'Ihrem Headhunter'}.
          </p>
          <RecruiterContactCard recruiter={view.recruiter} />
        </div>
      ) : (
        <>
          <section className="space-y-3" aria-label="Tag wählen">
            <p className="text-xs text-muted-foreground">Alle Zeiten: <GermanTime isos={allTimes} /></p>
            <div className="flex flex-wrap gap-2">
              {view.alternatives.map((d) => (
                <Chip key={d.date} active={current?.date === d.date} disabled={busy} onClick={() => setDay(d.date)}>
                  {d.label}
                </Chip>
              ))}
            </div>
          </section>

          {current && (
            <section className="space-y-3" aria-label={`Uhrzeit am ${current.label} wählen`}>
              <h2 className="text-sm font-semibold">{current.label}</h2>
              {current.times.length === 0 ? (
                <p className="text-sm text-muted-foreground">An diesem Tag ist nichts mehr frei.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {current.times.map((t) => (
                    <Chip key={t} active={chosen === t} disabled={busy} onClick={() => setStart(t)} className="rounded-lg px-2">
                      {fmtTime(t)}
                    </Chip>
                  ))}
                </div>
              )}
            </section>
          )}

          <div className="space-y-2">
            <label htmlFor="alternative-message" className="text-sm font-medium">
              Nachricht an {view.companyName} <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id="alternative-message"
              value={message}
              maxLength={500}
              rows={3}
              placeholder="Vormittags bin ich im Kundentermin …"
              onChange={(e) => setMessage(e.target.value)}
              disabled={busy}
              className="text-base sm:text-sm"
            />
          </div>

          <ConsentBox view={view} consent={consent} onConsent={onConsent} />

          <div className="space-y-2">
            <Button
              size="lg"
              className="h-auto min-h-12 w-full whitespace-normal py-3"
              disabled={!chosen || missingConsent || busy}
              onClick={() => chosen && onSubmit(chosen, message.trim())}
            >
              {busy && <Loader2 className="animate-spin" />}
              {chosen
                ? `${fmtDayShort(chosen)} · ${fmtTime(chosen)} ${book ? 'bestätigen' : 'anfragen'}`
                : 'Bitte eine Zeit wählen'}
            </Button>
            {chosen && missingConsent && (
              <p className="text-center text-xs text-muted-foreground">Bitte bestätigen Sie zuerst die Einwilligung.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function DeclinePanel({ busy, onBack, onDecline }: { busy: boolean; onBack: () => void; onDecline: (reason: string) => void }) {
  const [reason, setReason] = useState<string | null>(null);
  const [other, setOther] = useState('');

  const submit = () => {
    const text = other.trim();
    const value = reason === OTHER_REASON ? (text ? `${OTHER_REASON}: ${text}` : OTHER_REASON) : reason ?? '';
    onDecline(value);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight">Möchten Sie das Interview ablehnen?</h1>
        <p className="text-sm text-muted-foreground">Ein Grund ist freiwillig, hilft aber bei der weiteren Suche.</p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Grund (optional)">
        {DECLINE_REASONS.map((r) => (
          <Chip
            key={r}
            active={reason === r}
            disabled={busy}
            onClick={() => setReason((cur) => (cur === r ? null : r))}
            className="h-auto py-2 text-left"
          >
            {r}
          </Chip>
        ))}
      </div>

      {reason === OTHER_REASON && (
        <div className="space-y-2">
          <label htmlFor="decline-other" className="text-sm font-medium">
            Möchten Sie den Grund nennen? <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Textarea
            id="decline-other"
            value={other}
            maxLength={500}
            rows={3}
            onChange={(e) => setOther(e.target.value)}
            disabled={busy}
            className="text-base sm:text-sm"
          />
        </div>
      )}

      <div className="space-y-3">
        <Button variant="destructive" size="lg" className="h-12 w-full" disabled={busy} onClick={submit}>
          {busy && <Loader2 className="animate-spin" />}
          Interview ablehnen
        </Button>
        <Button variant="outline" size="lg" className="h-12 w-full" disabled={busy} onClick={onBack}>
          Zurück
        </Button>
      </div>
    </div>
  );
}

function ScheduledPanel({ view }: { view: CandidateView }) {
  const s = view.scheduled;
  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <StatusIcon icon={CheckCircle2} tone="success" />
        <h1 className="text-2xl font-semibold tracking-tight">Ihr Interview steht</h1>
        <p className="text-sm text-muted-foreground">{view.companyName} · {view.jobTitle}</p>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        {s?.start && (
          <div>
            <p className="text-lg font-semibold">{fmtDayLong(s.start)}</p>
            <p className="text-sm">
              {timeSpan(s.start, view.durationMinutes)}{' '}
              <GermanTime isos={[s.start]} className="text-muted-foreground" />
            </p>
          </div>
        )}
        <p className="flex items-center gap-2 text-sm">
          <Video className="h-4 w-4 text-muted-foreground" /> Microsoft Teams
        </p>
        {view.interviewers.length > 0 && (
          <p className="text-sm">
            <span className="text-muted-foreground">Gesprächspartner: </span>
            {view.interviewers.map((p) => (p.title ? `${p.name}, ${p.title}` : p.name)).join(' · ')}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {s?.joinUrl ? (
          <Button asChild size="lg" className="h-12 w-full">
            <a href={s.joinUrl} target="_blank" rel="noopener noreferrer"><Video /> Teams-Besprechung öffnen</a>
          </Button>
        ) : (
          <p className="rounded-xl border border-border bg-card p-4 text-sm">Den Teams-Link bekommen Sie mit der Kalendereinladung per Mail.</p>
        )}
        {s?.icsUrl && (
          <Button asChild variant="outline" size="lg" className="h-12 w-full">
            <a href={s.icsUrl} download="interview.ics"><CalendarPlus /> Zum Kalender hinzufügen</a>
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {s?.joinUrl ? 'Kalendereinladung mit Teams-Link kommt per Mail. ' : ''}
        Teilnahme mit Teams-App oder im Browser. Erinnerung 24 h und 1 h vorher.
      </p>

      <div className="space-y-3">
        <p className="text-sm">Umbuchen oder absagen? Melden Sie sich bei {view.recruiter?.name ?? 'Ihrem Headhunter'}.</p>
        <RecruiterContactCard recruiter={view.recruiter} />
      </div>
    </div>
  );
}

function RequestedPanel({ view }: { view: CandidateView }) {
  const r = view.requested;
  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <StatusIcon icon={Clock} tone="warning" />
        <h1 className="text-2xl font-semibold tracking-tight">Ihre Anfrage ist beim Unternehmen</h1>
        <p className="text-sm text-muted-foreground">{view.companyName} · {view.jobTitle}</p>
      </div>

      {r?.start && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Angefragt</p>
          <p className="text-lg font-semibold">{fmtDayLong(r.start)}</p>
          <p className="text-sm">
            {timeSpan(r.start, view.durationMinutes)}{' '}
            <GermanTime isos={[r.start]} className="text-muted-foreground" />
          </p>
        </div>
      )}
      {r?.message && <QuoteBlock label="Ihre Nachricht" text={r.message} />}

      <p className="text-sm">
        Sie bekommen eine Mail, sobald {view.companyName} bestätigt, meist innerhalb eines Werktags.{' '}
        {view.recruiter?.name ?? 'Ihr Headhunter'} ist informiert.
      </p>
      <RecruiterContactCard recruiter={view.recruiter} />
    </div>
  );
}

function EndState({ icon, title, recruiter, children }: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  recruiter: CandidateView['recruiter'];
  children?: ReactNode;
}) {
  return (
    <div className="space-y-6 pt-4">
      <div className="space-y-3 text-center">
        <StatusIcon icon={icon} />
        <h1 className="text-xl font-semibold">{title}</h1>
        {children && <p className="text-sm text-muted-foreground">{children}</p>}
      </div>
      <RecruiterContactCard recruiter={recruiter} />
    </div>
  );
}
