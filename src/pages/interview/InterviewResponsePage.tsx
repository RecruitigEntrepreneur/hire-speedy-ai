import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Trans, useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import i18n from '@/i18n';
import {
  AlertCircle, ArrowLeft, Building2, CalendarPlus, CalendarX, CheckCircle2, Clock, History, Loader2, MapPin, Phone, Video, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  candidateApi, fmtDayLong, fmtDayShort, fmtRange, fmtTime, type CandidateView, durationLabel } from '@/lib/interviewScheduling';
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

// Absagegründe: `value` geht so an die Function und wird gespeichert (bleibt deutsch),
// angezeigt wird interviewResponse:candidate.reasons.<key>.
const OTHER_REASON = 'Anderer Grund';
const KEEP_PREVIOUS = 'Beim bisherigen Termin bleiben';
const DECLINE_REASONS = [
  { key: 'otherOffer', value: 'Ich habe ein anderes Angebot angenommen' },
  { key: 'notFitting', value: 'Die Stelle passt doch nicht zu mir' },
  { key: 'timing', value: 'Zeitlich passt es gerade nicht' },
  { key: 'other', value: OTHER_REASON },
] as const;
type ReasonKey = (typeof DECLINE_REASONS)[number]['key'];

const errorText = (err: unknown) =>
  err instanceof Error && err.message ? err.message : i18n.t('interviewResponse:common.error');
const endOf = (iso: string, minutes: number) => new Date(Date.parse(iso) + minutes * 60000).toISOString();
const timeSpan = (t: TFunction, iso: string, minutes: number) => t('common.timeSpan', { from: fmtTime(iso), to: fmtTime(endOf(iso, minutes)) });
/** Tageslabel der anderen Zeiten in der Sprache der Seite (der Server liefert es deutsch). */
const dayLabel = (d: { label: string; times: string[] }) => (d.times[0] ? fmtDayShort(d.times[0]) : d.label);

export default function InterviewResponsePage() {
  const { token = '' } = useParams<{ token: string }>();
  const { t } = useTranslation('interviewResponse');
  const [searchParams] = useSearchParams();
  const action = searchParams.get('action');

  const [view, setView] = useState<CandidateView | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  // Alte Mail-Links: ?action=decline öffnet die Absage, ?action=counter die andere Zeit.
  const [mode, setMode] = useState<Mode>(action === 'decline' ? 'decline' : action === 'counter' ? 'alternative' : 'pick');
  const [consent, setConsent] = useState(false);
  // Telefon-Interview: leer = hinterlegte Nummer verwenden
  const [phone, setPhone] = useState('');

  useEffect(() => {
    document.title = t('candidate.docTitle');
  }, [t]);

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
          <h1 className="text-xl font-semibold">{t('candidate.invalidTitle')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('candidate.invalidBody')}
          </p>
          <Button variant="outline" className="min-h-11" onClick={() => setAttempt((n) => n + 1)}>{t('candidate.reload')}</Button>
        </div>
      </PublicInterviewShell>
    );
  }

  if (!view) {
    return (
      <PublicInterviewShell>
        <div className="flex items-center justify-center gap-2 pt-16 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-5 w-5 animate-spin" /> {t('candidate.loading')}
        </div>
      </PublicInterviewShell>
    );
  }

  const recruiterName = view.recruiter?.name ?? t('common.yourHeadhunterDat');

  let content: ReactNode;
  switch (view.state) {
    case 'open': {
      const effective: Mode = mode === 'alternative' && !view.allowAlternative ? 'pick' : mode;
      content = effective === 'decline'
        ? <DeclinePanel busy={busy} view={view} onBack={() => setMode('pick')} onDecline={(reason) => run(() => candidateApi.decline(token, reason))} />
        : effective === 'alternative'
          ? <AlternativePanel
              view={view}
              busy={busy}
              consent={consent}
              onConsent={setConsent}
              onBack={() => setMode('pick')}
              phone={phone}
              onPhone={setPhone}
              onSubmit={(start, message) => run(() => candidateApi.alternative(token, start, message, view.consentRequired && consent, phone.trim() || undefined))}
            />
          : <OpenPanel
              view={view}
              initialSlot={searchParams.get('slot')}
              busy={busy}
              consent={consent}
              onConsent={setConsent}
              phone={phone}
              onPhone={setPhone}
              onAccept={(start) => run(() => candidateApi.accept(token, start, view.consentRequired && consent, phone.trim() || undefined))}
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
      content = view.reschedule ? (
        <EndState icon={CheckCircle2} title={t('candidate.keptTitle')} recruiter={view.recruiter}>
          {t('candidate.keptBody', { day: fmtDayLong(view.reschedule.previousStart), time: fmtTime(view.reschedule.previousStart), company: view.companyName })}
        </EndState>
      ) : (
        <EndState icon={XCircle} title={t('candidate.declinedTitle')} recruiter={view.recruiter}>
          {t('candidate.declinedBody', { company: view.companyName, name: view.recruiter?.name ?? t('common.yourHeadhunter') })}
        </EndState>
      );
      break;
    case 'cancelled':
      content = (
        <EndState icon={CalendarX} title={t('candidate.cancelledTitle')} recruiter={view.recruiter}>
          {t('candidate.cancelledBody', { name: recruiterName })}
        </EndState>
      );
      break;
    case 'expired':
      content = (
        <EndState icon={History} title={t('candidate.expiredTitle')} recruiter={view.recruiter}>
          {t('candidate.expiredBody', { name: recruiterName })}
        </EndState>
      );
      break;
    case 'completed':
      content = <EndState icon={CheckCircle2} title={t('candidate.completedTitle')} recruiter={null} />;
      break;
    default:
      content = <EndState icon={AlertCircle} title={t('candidate.unknownTitle')} recruiter={view.recruiter} />;
  }

  return <PublicInterviewShell>{content}</PublicInterviewShell>;
}

/* ------------------------------------------------------------------------ */

function InviteHeader({ view }: { view: CandidateView }) {
  const { t } = useTranslation('interviewResponse');
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold leading-tight tracking-tight">
        {view.reschedule
          ? t('candidate.headerReschedule', { company: view.companyName })
          : (view.round ?? 1) > 1 ? t('candidate.headerRound', { company: view.companyName, round: view.round }) : t('candidate.headerFirst', { company: view.companyName })}
      </h1>
      <p className="text-sm text-muted-foreground">
        {view.jobTitle} · {durationLabel(view.durationMinutes)} · {formatText(t, view)}
      </p>
      {view.reschedule?.stillValid && (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <Trans t={t} i18nKey="candidate.previousStays" values={{ when: t('common.dayTime', { day: fmtDayLong(view.reschedule.previousStart), time: fmtTime(view.reschedule.previousStart) }) }} components={{ strong: <strong /> }} />
        </p>
      )}
      <OnsiteBlock view={view} />
      {view.interviewers.length > 0 && (
        <p className="text-sm">
          <span className="text-muted-foreground">{t('candidate.interviewers')}</span>
          {view.interviewers.map((p) => (p.title ? `${p.name}, ${p.title}` : p.name)).join(' · ')}
        </p>
      )}
    </div>
  );
}

const formatText = (t: TFunction, view: CandidateView) =>
  view.format === 'phone' ? t('candidate.formatPhone', { company: view.companyName }) : view.format === 'onsite' ? t('candidate.formatOnsite') : t('candidate.formatTeams');

function OnsiteBlock({ view }: { view: CandidateView }) {
  const { t } = useTranslation('interviewResponse');
  if (view.format !== 'onsite' || !view.onsite) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border bg-card p-3 text-sm">
      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="whitespace-pre-line">{view.onsite.address}</p>
        {view.onsite.note && <p className="mt-1 text-muted-foreground">{view.onsite.note}</p>}
        {view.onsite.contact && <p className="mt-1 text-muted-foreground">{t('candidate.onsiteContact', { name: view.onsite.contact })}</p>}
        <a href={view.onsite.mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-medium underline underline-offset-4">
          {t('candidate.openMap')}
        </a>
      </div>
    </div>
  );
}

/** Telefon-Interview: Unter welcher Nummer erreichen wir Sie? */
function PhoneBox({ view, phone, onPhone }: { view: CandidateView; phone: string; onPhone: (v: string) => void }) {
  const { t } = useTranslation('interviewResponse');
  const [useOther, setUseOther] = useState(false);
  if (view.format !== 'phone') return null;
  const showInput = !view.phoneOnFile || useOther;
  return (
    <section className="space-y-2 rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-medium"><Phone className="h-4 w-4 text-muted-foreground" /> {t('candidate.phoneQuestion')}</p>
      {view.phoneOnFile && !useOther && (
        <p className="text-sm">
          {t('candidate.phoneOnFile', { digits: view.phoneOnFile.replace('··· ', '') })}{' '}
          <button type="button" className="font-medium underline underline-offset-4" onClick={() => setUseOther(true)}>{t('candidate.otherPhone')}</button>
        </p>
      )}
      {showInput && (
        <Input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => onPhone(e.target.value)}
          placeholder="+49 170 1234567"
          className="h-11 text-base sm:text-sm"
        />
      )}
    </section>
  );
}

const phoneMissing = (view: CandidateView, phone: string) => view.format === 'phone' && !view.phoneOnFile && phone.trim().length < 6;

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

function OpenPanel({ view, initialSlot, busy, consent, onConsent, phone, onPhone, onAccept, onAlternative, onDecline }: {
  view: CandidateView;
  phone: string;
  onPhone: (v: string) => void;
  /** Termin aus dem Mail-Link (?slot=…) vorauswählen */
  initialSlot?: string | null;
  busy: boolean;
  consent: boolean;
  onConsent: (v: boolean) => void;
  onAccept: (start: string) => void;
  onAlternative: () => void;
  onDecline: () => void;
}) {
  const { t } = useTranslation('interviewResponse');
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
      {view.message && <QuoteBlock label={t('candidate.messageFrom', { company: view.companyName })} text={view.message} />}

      <section className="space-y-3" aria-labelledby="slot-heading">
        <div>
          <h2 id="slot-heading" className="text-base font-semibold">{view.reschedule ? (view.slots.length === 1 ? t('candidate.confirmNewTime') : t('candidate.chooseNewTime')) : t('candidate.chooseSlot')}</h2>
          <p className="text-xs text-muted-foreground">{t('common.allTimes')} <GermanTime isos={view.slots.map((s) => s.start)} /></p>
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
                {!slot.available && <span className="text-xs text-muted-foreground">{t('candidate.notFree')}</span>}
              </button>
            );
          })}
        </div>
        {!anyFree && (
          <p className="text-sm text-muted-foreground">
            {t('candidate.allTaken')}{' '}
            {view.allowAlternative ? t('candidate.chooseOtherBelow') : t('candidate.contactRecruiter', { name: view.recruiter?.name ?? t('common.yourHeadhunterDat') })}
          </p>
        )}
      </section>

      <PhoneBox view={view} phone={phone} onPhone={onPhone} />

      <ConsentBox view={view} consent={consent} onConsent={onConsent} />

      <div className="space-y-3">
        <Button
          size="lg"
          className="h-12 w-full"
          disabled={!chosen || missingConsent || phoneMissing(view, phone) || busy}
          onClick={() => chosen && onAccept(chosen)}
        >
          {busy && <Loader2 className="animate-spin" />}
          {t('candidate.confirmInterview')}
        </Button>
        {chosen && missingConsent && (
          <p className="text-center text-xs text-muted-foreground">{t('candidate.consentFirst')}</p>
        )}
        {chosen && !missingConsent && phoneMissing(view, phone) && (
          <p className="text-center text-xs text-muted-foreground">{t('candidate.phoneRequired')}</p>
        )}
        {view.allowAlternative && (
          <Button variant="outline" size="lg" className="h-12 w-full" disabled={busy} onClick={onAlternative}>
            {t('candidate.noneFits')}
          </Button>
        )}
        <div className="flex justify-center">
          <button
            type="button"
            disabled={busy}
            onClick={onDecline}
            className={cn('min-h-11 px-3 text-sm font-medium underline-offset-4 hover:underline disabled:opacity-50', view.reschedule ? 'text-foreground' : 'text-destructive')}
          >
            {view.reschedule ? t('candidate.keepPrevious') : t('candidate.declineInterview')}
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

function AlternativePanel({ view, busy, consent, onConsent, phone, onPhone, onBack, onSubmit }: {
  phone: string;
  onPhone: (v: string) => void;
  view: CandidateView;
  busy: boolean;
  consent: boolean;
  onConsent: (v: boolean) => void;
  onBack: () => void;
  onSubmit: (start: string, message: string) => void;
}) {
  const { t } = useTranslation('interviewResponse');
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
        <ArrowLeft className="h-4 w-4" /> {t('candidate.backToProposals')}
      </button>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight">{t('candidate.whichTime')}</h1>
        <p className="text-sm text-muted-foreground">
          {book
            ? t('candidate.allFree')
            : t('candidate.companyConfirms', { company: view.companyName })}
        </p>
      </div>

      {view.alternatives.length === 0 ? (
        <div className="space-y-4">
          <p className="rounded-xl border border-border bg-card p-4 text-sm">
            {t('candidate.noMoreTimes', { name: view.recruiter?.name ?? t('common.yourHeadhunterDat') })}
          </p>
          <RecruiterContactCard recruiter={view.recruiter} />
        </div>
      ) : (
        <>
          <section className="space-y-3" aria-label={t('candidate.chooseDay')}>
            <p className="text-xs text-muted-foreground">{t('common.allTimes')} <GermanTime isos={allTimes} /></p>
            <div className="flex flex-wrap gap-2">
              {view.alternatives.map((d) => (
                <Chip key={d.date} active={current?.date === d.date} disabled={busy} onClick={() => setDay(d.date)}>
                  {dayLabel(d)}
                </Chip>
              ))}
            </div>
          </section>

          {current && (
            <section className="space-y-3" aria-label={t('candidate.chooseTimeOn', { day: dayLabel(current) })}>
              <h2 className="text-sm font-semibold">{dayLabel(current)}</h2>
              {current.times.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('candidate.dayFull')}</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {current.times.map((time) => (
                    <Chip key={time} active={chosen === time} disabled={busy} onClick={() => setStart(time)} className="rounded-lg px-2">
                      {fmtTime(time)}
                    </Chip>
                  ))}
                </div>
              )}
            </section>
          )}

          <div className="space-y-2">
            <label htmlFor="alternative-message" className="text-sm font-medium">
              {t('candidate.messageTo', { company: view.companyName })} <span className="font-normal text-muted-foreground">{t('common.optional')}</span>
            </label>
            <Textarea
              id="alternative-message"
              value={message}
              maxLength={500}
              rows={3}
              placeholder={t('candidate.messagePlaceholder')}
              onChange={(e) => setMessage(e.target.value)}
              disabled={busy}
              className="text-base sm:text-sm"
            />
          </div>

          <PhoneBox view={view} phone={phone} onPhone={onPhone} />

          <ConsentBox view={view} consent={consent} onConsent={onConsent} />

          <div className="space-y-2">
            <Button
              size="lg"
              className="h-auto min-h-12 w-full whitespace-normal py-3"
              disabled={!chosen || missingConsent || phoneMissing(view, phone) || busy}
              onClick={() => chosen && onSubmit(chosen, message.trim())}
            >
              {busy && <Loader2 className="animate-spin" />}
              {chosen
                ? t(book ? 'candidate.confirmAt' : 'candidate.requestAt', { day: fmtDayShort(chosen), time: fmtTime(chosen) })
                : t('candidate.pickTime')}
            </Button>
            {chosen && missingConsent && (
              <p className="text-center text-xs text-muted-foreground">{t('candidate.consentFirst')}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function DeclinePanel({ busy, view, onBack, onDecline }: { busy: boolean; view: CandidateView; onBack: () => void; onDecline: (reason: string) => void }) {
  const { t } = useTranslation('interviewResponse');
  const [reason, setReason] = useState<ReasonKey | null>(null);
  const [other, setOther] = useState('');

  if (view.reschedule) {
    // Verschiebung: Ablehnen heißt nur „beim bisherigen Termin bleiben“
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight">{t('candidate.keepTitle')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('candidate.keepBody', { day: fmtDayLong(view.reschedule.previousStart), time: fmtTime(view.reschedule.previousStart), company: view.companyName })}
          </p>
        </div>
        <div className="space-y-3">
          <Button size="lg" className="h-12 w-full" disabled={busy} onClick={() => onDecline(KEEP_PREVIOUS)}>
            {busy && <Loader2 className="animate-spin" />}
            {t('candidate.keepButton')}
          </Button>
          <Button variant="outline" size="lg" className="h-12 w-full" disabled={busy} onClick={onBack}>
            {t('common.back')}
          </Button>
        </div>
      </div>
    );
  }

  const submit = () => {
    const text = other.trim();
    const picked = DECLINE_REASONS.find((r) => r.key === reason);
    const value = reason === 'other' ? (text ? `${OTHER_REASON}: ${text}` : OTHER_REASON) : picked?.value ?? '';
    onDecline(value);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight">{t('candidate.declineTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('candidate.declineBody')}</p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t('candidate.reasonGroup')}>
        {DECLINE_REASONS.map((r) => (
          <Chip
            key={r.key}
            active={reason === r.key}
            disabled={busy}
            onClick={() => setReason((cur) => (cur === r.key ? null : r.key))}
            className="h-auto py-2 text-left"
          >
            {t(`candidate.reasons.${r.key}`)}
          </Chip>
        ))}
      </div>

      {reason === 'other' && (
        <div className="space-y-2">
          <label htmlFor="decline-other" className="text-sm font-medium">
            {t('candidate.reasonQuestion')} <span className="font-normal text-muted-foreground">{t('common.optional')}</span>
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
          {t('candidate.declineInterview')}
        </Button>
        <Button variant="outline" size="lg" className="h-12 w-full" disabled={busy} onClick={onBack}>
          {t('common.back')}
        </Button>
      </div>
    </div>
  );
}

function ScheduledPanel({ view }: { view: CandidateView }) {
  const { t } = useTranslation('interviewResponse');
  const s = view.scheduled;
  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <StatusIcon icon={CheckCircle2} tone="success" />
        <h1 className="text-2xl font-semibold tracking-tight">{(view.round ?? 1) > 1 ? t('candidate.scheduledRound', { round: view.round }) : t('candidate.scheduledFirst')}</h1>
        <p className="text-sm text-muted-foreground">{view.companyName} · {view.jobTitle}</p>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        {s?.start && (
          <div>
            <p className="text-lg font-semibold">{fmtDayLong(s.start)}</p>
            <p className="text-sm">
              {timeSpan(t, s.start, view.durationMinutes)}{' '}
              <GermanTime isos={[s.start]} className="text-muted-foreground" />
            </p>
          </div>
        )}
        <p className="flex items-center gap-2 text-sm">
          {view.format === 'phone' ? <Phone className="h-4 w-4 text-muted-foreground" /> : view.format === 'onsite' ? <Building2 className="h-4 w-4 text-muted-foreground" /> : <Video className="h-4 w-4 text-muted-foreground" />}
          {view.format === 'phone'
            ? (view.callPhone ? t('candidate.companyCallsNumber', { company: view.companyName, digits: view.callPhone.replace('··· ', '') }) : t('candidate.companyCalls', { company: view.companyName }))
            : view.format === 'onsite' ? t('candidate.onsite') : t('candidate.formatTeams')}
        </p>
        <OnsiteBlock view={view} />
        {view.interviewers.length > 0 && (
          <p className="text-sm">
            <span className="text-muted-foreground">{t('candidate.interviewers')}</span>
            {view.interviewers.map((p) => (p.title ? `${p.name}, ${p.title}` : p.name)).join(' · ')}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {view.format === 'teams' && (s?.joinUrl ? (
          <Button asChild size="lg" className="h-12 w-full">
            <a href={s.joinUrl} target="_blank" rel="noopener noreferrer"><Video /> {t('candidate.openTeams')}</a>
          </Button>
        ) : (
          <p className="rounded-xl border border-border bg-card p-4 text-sm">{t('candidate.linkLater')}</p>
        ))}
        {view.format === 'onsite' && view.onsite && (
          <Button asChild size="lg" className="h-12 w-full">
            <a href={view.onsite.mapsUrl} target="_blank" rel="noopener noreferrer"><MapPin /> {t('candidate.openRoute')}</a>
          </Button>
        )}
        {s?.icsUrl && (
          <Button asChild variant="outline" size="lg" className="h-12 w-full">
            <a href={s.icsUrl} download="interview.ics"><CalendarPlus /> {t('candidate.addCalendar')}</a>
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {view.format === 'teams'
          ? (s?.joinUrl ? t('candidate.teamsInfoWithLink') : t('candidate.teamsInfo'))
          : t('candidate.otherInfo')}
      </p>

      <div className="space-y-3">
        <p className="text-sm">{t('candidate.changeOrCancel', { name: view.recruiter?.name ?? t('common.yourHeadhunterDat') })}</p>
        <RecruiterContactCard recruiter={view.recruiter} />
      </div>
    </div>
  );
}

function RequestedPanel({ view }: { view: CandidateView }) {
  const { t } = useTranslation('interviewResponse');
  const r = view.requested;
  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <StatusIcon icon={Clock} tone="warning" />
        <h1 className="text-2xl font-semibold tracking-tight">{t('candidate.requestedTitle')}</h1>
        <p className="text-sm text-muted-foreground">{view.companyName} · {view.jobTitle}</p>
      </div>

      {r?.start && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">{t('candidate.requested')}</p>
          <p className="text-lg font-semibold">{fmtDayLong(r.start)}</p>
          <p className="text-sm">
            {timeSpan(t, r.start, view.durationMinutes)}{' '}
            <GermanTime isos={[r.start]} className="text-muted-foreground" />
          </p>
        </div>
      )}
      {r?.message && <QuoteBlock label={t('candidate.yourMessage')} text={r.message} />}

      <p className="text-sm">
        {t('candidate.requestedBody', { company: view.companyName, name: view.recruiter?.name ?? t('common.yourHeadhunter') })}
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
