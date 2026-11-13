import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { fmtDayMonth } from '@/lib/localeFormat';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CalendarClock, Copy, ExternalLink, Loader2, Lock, MapPin, MoreHorizontal, Phone, RefreshCw, Video, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import * as PanelPrimitive from '@radix-ui/react-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { AgendaInterview } from '@/hooks/useClientInterviewAgenda';
import { useInterviewSession } from '@/hooks/useInterviewSession';
import { useLiveInterviewNotes } from '@/hooks/useLiveInterviewNotes';
import { fmtDayLong, fmtDayShort, fmtRange, fmtTime, interviewApi, type InterviewDetails } from '@/lib/interviewScheduling';
import { relativeDay } from '@/lib/interviewRequestUtils';
import { InterviewTimer } from '../InterviewTimer';
import { meetingTypeLabel } from '../agenda/meetingType';
import { LiveNotesPanel } from '../LiveNotesPanel';
import { CandidateFacts } from './CandidateFacts';
import { FeedbackPanel } from './FeedbackPanel';
import { GuideChecklist } from './GuideChecklist';
import { ReschedulePanel } from './ReschedulePanel';

export type WindowVariant = 'counter' | 'awaiting' | 'agenda' | 'feedback' | 'past';
export type WindowTab = 'overview' | 'candidate' | 'guide' | 'notes' | 'feedback';

interface Props {
  interview: AgendaInterview | null;
  variant: WindowVariant;
  /** gezielt öffnen, z. B. „Interview-Guide“ → Leitfaden, „Umbuchen“ → Verschieben */
  start?: WindowTab | 'reschedule';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmAlternative: (iv: AgendaInterview) => void;
  confirming: boolean;
  onRemind: (iv: AgendaInterview) => void;
  /** Neue Termine über das Anfrage-Fenster (offene Anfrage, nicht gebucht) */
  onNewRequest: (iv: AgendaInterview) => void;
  onCancel: (iv: AgendaInterview) => void;
  onNextRound: (iv: AgendaInterview) => void;
  /** Agenda neu laden */
  onChanged: () => void;
}

const LIVE_BEFORE = 10 * 60_000;
const LIVE_AFTER = 30 * 60_000;

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

function relative(iso: string) {
  const diff = Date.parse(iso) - Date.now();
  if (diff > 0 && diff < 3_600_000) return i18n.t('clientInterviews:window.inMinutes', { n: Math.max(1, Math.round(diff / 60_000)) });
  return relativeDay(iso);
}

const timeRange = (iso: string, minutes: number) =>
  i18n.t('clientInterviews:window.timeRange', { from: fmtTime(iso), to: fmtTime(new Date(Date.parse(iso) + minutes * 60_000).toISOString()) });

/**
 * Ein Fenster in der Mitte für alles zu einem Interview: Termin, Leute, Kandidat,
 * Leitfaden, Notizen, Feedback, Verschieben. Mittig wie alle Fenster (Entscheidung
 * 23.10.2026); ein Klick daneben schließt es nicht, damit Notizen nicht verloren gehen.
 */
export function InterviewWindow(props: Props) {
  const { interview: iv, open, onOpenChange } = props;
  const { t } = useTranslation('clientInterviews');
  return (
    <PanelPrimitive.Root open={open && !!iv} onOpenChange={onOpenChange}>
      <PanelPrimitive.Portal>
        <PanelPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <PanelPrimitive.Content
          onInteractOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed left-1/2 top-1/2 z-50 flex h-[min(52rem,92vh)] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border bg-background shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {iv && <WindowBody key={iv.id} {...props} interview={iv} />}
          <PanelPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring" aria-label={t('common.close')}>
            <X className="h-4 w-4" />
          </PanelPrimitive.Close>
        </PanelPrimitive.Content>
      </PanelPrimitive.Portal>
    </PanelPrimitive.Root>
  );
}

function WindowBody({
  interview: iv, variant, start, onOpenChange, onConfirmAlternative, confirming, onRemind, onNewRequest, onCancel, onNextRound, onChanged,
}: Props & { interview: AgendaInterview }) {
  const { t } = useTranslation(['clientInterviews', 'interviews']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const details = useQuery({
    queryKey: ['interview-details', iv.id],
    queryFn: () => interviewApi.details(iv.id),
    staleTime: 30_000,
  });
  const d: InterviewDetails | undefined = details.data;

  const now = Date.now();
  const startMs = iv.scheduledAt ? Date.parse(iv.scheduledAt) : null;
  const endMs = startMs !== null ? startMs + iv.durationMinutes * 60_000 : null;
  const booked = iv.status === 'scheduled' && startMs !== null;
  const live = booked && startMs! - LIVE_BEFORE <= now && now <= endMs! + LIVE_AFTER;
  const future = booked && startMs! > now;
  const started = startMs !== null && startMs <= now;

  const [tab, setTab] = useState<WindowTab>(() =>
    start && start !== 'reschedule' ? start : variant === 'feedback' ? 'feedback' : live ? 'guide' : 'overview');
  const [moving, setMoving] = useState(start === 'reschedule' && future);

  const session = useInterviewSession(booked ? iv.id : null);
  const notes = useLiveInterviewNotes(iv.id);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['interview-details', iv.id] });
    onChanged();
  };

  const format = d?.format ?? (iv.meetingType === 'phone' || iv.meetingType === 'onsite' ? iv.meetingType : 'teams');
  const joinUrl = d?.joinUrl ?? iv.joinUrl;
  // Alte Anfragen (Google Meet, Video-Call) mit ihrer echten Bezeichnung
  const formatLabel = iv.meetingType ? meetingTypeLabel(iv.meetingType) : t(`interviews:meeting.${format}`);
  const name = iv.candidateName;
  const first = iv.identityUnlocked ? name.split(' ')[0] : t('window.theCandidate');

  const copyLink = () => {
    if (!joinUrl) return;
    navigator.clipboard.writeText(joinUrl);
    toast.success(t('window.linkCopied'));
  };

  const withdrawMove = async () => {
    if (!d?.reschedule) return;
    try {
      // Grund geht gespeichert an die Function und bleibt deutsch
      await interviewApi.withdraw(d.reschedule.requestId, 'Verschiebung zurückgezogen');
      toast.success(t('window.moveWithdrawn'));
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('interviews:error.generic'));
    }
  };

  return (
    <>
      {/* Kopf */}
      <div className="space-y-3 border-b px-5 py-4 pr-12">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
            {iv.identityUnlocked ? initials(name) : <Lock className="h-4 w-4 text-muted-foreground" />}
          </div>
          <div className="min-w-0 flex-1">
            <PanelPrimitive.Title className={cn('truncate text-base font-semibold', !iv.identityUnlocked && 'font-mono')}>{name}</PanelPrimitive.Title>
            <PanelPrimitive.Description className="text-xs text-muted-foreground">
              {iv.jobTitle}{d ? t('window.round', { n: d.round }) : ''}
              {iv.scheduledAt ? ` · ${fmtDayLong(iv.scheduledAt)} · ${timeRange(iv.scheduledAt, iv.durationMinutes)}` : ''}
              {` · ${formatLabel}`}
              {future && iv.scheduledAt ? ` · ${relative(iv.scheduledAt)}` : ''}
            </PanelPrimitive.Description>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {live && (
              <InterviewTimer
                formattedTime={session.formatTime()}
                isRunning={session.session.isRunning}
                hasStarted={!!session.session.startedAt}
                hasEnded={!!session.session.endedAt}
                onStart={session.startSession}
                onPause={session.pauseSession}
                onResume={session.resumeSession}
                onEnd={async () => { await session.endSession(); setTab('feedback'); }}
              />
            )}
            {booked && format === 'teams' && joinUrl && (
              <>
                <Button asChild size="sm" className="gap-1.5">
                  <a href={joinUrl} target="_blank" rel="noopener noreferrer"><Video className="h-4 w-4" /> {t('row.join')}</a>
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={copyLink}><Copy className="h-3.5 w-3.5" /> {t('window.link')}</Button>
              </>
            )}
            {booked && format === 'phone' && (d?.callPhone ?? iv.callPhone) && (
              <Button asChild size="sm" className="gap-1.5">
                <a href={`tel:${d?.callPhone ?? iv.callPhone}`}><Phone className="h-4 w-4" /> {t('window.call')}</a>
              </Button>
            )}
            {booked && format === 'onsite' && d?.onsite && (
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <a href={d.onsite.mapsUrl} target="_blank" rel="noopener noreferrer"><MapPin className="h-4 w-4" /> {t('window.route')}</a>
              </Button>
            )}
            {future && !d?.reschedule && !moving && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setMoving(true)}>
                <CalendarClock className="h-3.5 w-3.5" /> {t('hero.reschedule')}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={t('row.moreActions')}><MoreHorizontal className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { onOpenChange(false); navigate(`/dashboard/candidates/${iv.submissionId}`); }}>
                  <ExternalLink className="mr-2 h-4 w-4" /> {t('facts.fullProfile')}
                </DropdownMenuItem>
                {['scheduled', 'pending_response', 'pending', 'counter_proposed'].includes(iv.status) && !started && (
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { onOpenChange(false); onCancel(iv); }}>
                    {t('row.cancel')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Status, der eine Handlung braucht */}
        {booked && !started && format === 'teams' && !joinUrl && d && <MissingLink interviewId={iv.id} onSaved={refresh} />}
        {d?.reschedule && (
          <Banner tone="info">
            <span className="flex-1">
              {t('window.moveRequested')}{' '}
              {d.reschedule.slots.length === 1
                ? t('window.moveOne', { first, slot: `${fmtDayShort(d.reschedule.slots[0])} ${fmtTime(d.reschedule.slots[0])}` })
                : d.reschedule.slots[0]
                  ? t('window.moveManyFrom', { first, n: d.reschedule.slots.length, slot: `${fmtDayShort(d.reschedule.slots[0])} ${fmtTime(d.reschedule.slots[0])}` })
                  : t('window.moveMany', { first, n: d.reschedule.slots.length })}
              {d.scheduledAt ? t('window.untilThen', { slot: `${fmtDayShort(d.scheduledAt)} ${fmtTime(d.scheduledAt)}` }) : t('window.untilThenThis')}
            </span>
            <Button size="sm" variant="outline" className="h-7 bg-background text-xs" onClick={withdrawMove}>{t('cancel.withdraw')}</Button>
          </Banner>
        )}
        {variant === 'counter' && iv.counterSlots[0] && (
          <Banner tone="warn">
            <span className="flex-1">
              {t('window.asks', { first, slot: `${fmtDayShort(iv.counterSlots[0].datetime)} ${fmtTime(iv.counterSlots[0].datetime)}` })}
              {d?.movedFrom ? t('window.insteadOld') : ''}.{iv.candidateMessage ? ` „${iv.candidateMessage}“` : ''}
            </span>
            <Button size="sm" className="h-7 text-xs" disabled={confirming} onClick={() => onConfirmAlternative(iv)}>
              {confirming && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} {t('window.confirm')}
            </Button>
            <Button size="sm" variant="outline" className="h-7 bg-background text-xs" onClick={() => { onOpenChange(false); onNewRequest(iv); }}>{t('row.newSlots')}</Button>
          </Banner>
        )}
        {variant === 'awaiting' && (
          <Banner tone={iv.slotsExpired ? 'warn' : 'info'}>
            <span className="flex-1">
              {iv.slotsExpired ? t('window.expired') : t('window.waitingFor', { first, count: iv.proposedSlots.length })}
            </span>
            {!iv.slotsExpired && <Button size="sm" variant="outline" className="h-7 bg-background text-xs" onClick={() => onRemind(iv)}>{t('row.remind')}</Button>}
            <Button size="sm" className="h-7 text-xs" onClick={() => { onOpenChange(false); onNewRequest(iv); }}>{t('row.newSlots')}</Button>
          </Banner>
        )}
      </div>

      {/* Inhalt */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {moving && d ? (
          <ReschedulePanel
            submissionId={iv.submissionId}
            details={d}
            candidateName={name}
            onCancel={() => setMoving(false)}
            onDone={() => { setMoving(false); refresh(); }}
          />
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as WindowTab)} className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">{t('window.tab.overview')}</TabsTrigger>
              <TabsTrigger value="candidate">{t('window.tab.candidate')}</TabsTrigger>
              <TabsTrigger value="guide">{t('hero.guide')}</TabsTrigger>
              <TabsTrigger value="notes">{t('window.tab.notes')}{notes.notes.length ? ` (${notes.notes.length})` : ''}</TabsTrigger>
              <TabsTrigger value="feedback">{t('window.tab.feedback')}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              {details.isLoading ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {t('feedbackDialog.loading')}</p>
              ) : details.error || !d ? (
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">{details.error instanceof Error ? details.error.message : t('window.loadFailed')}</p>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => details.refetch()}><RefreshCw className="h-3.5 w-3.5" /> {t('page.retry')}</Button>
                </div>
              ) : (
                <Overview d={d} name={name} formatLabel={formatLabel} candidateFirst={iv.identityUnlocked ? name.split(' ')[0] : null} />
              )}
            </TabsContent>

            <TabsContent value="candidate">
              <CandidateFacts submissionId={iv.submissionId} />
            </TabsContent>

            <TabsContent value="guide">
              <div className="space-y-6">
                <GuideChecklist interviewId={iv.id} active={tab === 'guide'} />
                <div className="min-h-[14rem] border-t pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('window.tab.notes')}</p>
                  <LiveNotesPanel
                    notes={notes.notes}
                    pinnedNotes={notes.pinnedNotes}
                    elapsedSeconds={session.elapsedSeconds}
                    onAddNote={notes.addNote}
                    onTogglePin={notes.togglePin}
                    onDeleteNote={notes.deleteNote}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="notes">
              <div>
                <LiveNotesPanel
                  notes={notes.notes}
                  pinnedNotes={notes.pinnedNotes}
                  elapsedSeconds={session.elapsedSeconds}
                  onAddNote={notes.addNote}
                  onTogglePin={notes.togglePin}
                  onDeleteNote={notes.deleteNote}
                />
              </div>
            </TabsContent>

            <TabsContent value="feedback">
              <div>
                <FeedbackPanel
                  interviewId={iv.id}
                  round={d?.round ?? 1}
                  candidateName={name}
                  recruiterName={d?.recruiterName}
                  feedback={iv.feedback}
                  questionAnswer={d?.questionAnswer ?? null}
                  started={started}
                  notes={notes.notes}
                  onSaved={refresh}
                  onNext={(way) => {
                    if (way === 'next_round') { onOpenChange(false); onNextRound(iv); return; }
                    // Angebot und Absage laufen im Bewerberprofil
                    if (way === 'offer' || way === 'reject') { onOpenChange(false); navigate(`/dashboard/candidates/${iv.submissionId}`, { state: { open: way } }); }
                  }}
                />
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </>
  );
}

/** Beim Buchen ist kein Teams-Link entstanden: eigenen Link eintragen, alle bekommen ihn per Mail. */
function MissingLink({ interviewId, onSaved }: { interviewId: string; onSaved: () => void }) {
  const { t } = useTranslation(['clientInterviews', 'interviews']);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await interviewApi.setLink(interviewId, url.trim());
      toast.success(t('window.linkSaved'));
      setUrl('');
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('interviews:error.link'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Banner tone="warn">
      <span className="w-full">{t('window.noLink')}</span>
      <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://teams.microsoft.com/…" className="h-8 flex-1 bg-background text-sm" aria-label={t('window.linkAria')} />
      <Button size="sm" className="h-8" disabled={busy || !/^https:\/\/\S{8,}$/.test(url.trim())} onClick={save}>
        {busy && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} {t('window.saveLink')}
      </Button>
    </Banner>
  );
}

function Banner({ tone, children }: { tone: 'info' | 'warn'; children: ReactNode }) {
  return (
    <div className={cn(
      'flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm',
      tone === 'warn' ? 'border-warning/40 bg-warning/10' : 'border-primary/30 bg-primary/5',
    )}>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Overview({ d, name, formatLabel, candidateFirst }: { d: InterviewDetails; name: string; formatLabel: string; candidateFirst: string | null }) {
  const { t } = useTranslation('clientInterviews');
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Section title={t('window.appointment')}>
        {d.scheduledAt ? (
          <p className="text-sm">{fmtDayLong(d.scheduledAt)} · {timeRange(d.scheduledAt, d.durationMinutes)} <span className="text-muted-foreground">{t('window.germanTime')}</span></p>
        ) : d.proposedSlots.length ? (
          <ul className="space-y-0.5 text-sm">
            {d.proposedSlots.map((s) => <li key={s}>{fmtRange(s, d.durationMinutes)}</li>)}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t('window.noAppointment')}</p>
        )}
        <p className="text-sm">
          {formatLabel}
          {d.inOutlook && d.scheduledAt ? <span className="text-muted-foreground">{t('window.inOutlook')}</span> : ''}
        </p>
        {d.format === 'teams' && d.joinUrl && <p className="truncate text-xs text-muted-foreground">{d.joinUrl}</p>}
        {d.format === 'phone' && d.callPhone && <p className="text-sm">{t('window.youCall')} <a className="underline" href={`tel:${d.callPhone}`}>{d.callPhone}</a></p>}
        {d.format === 'onsite' && d.onsite && (
          <p className="whitespace-pre-line text-sm">
            {d.onsite.address}{d.onsite.note ? `\n${d.onsite.note}` : ''}
            {d.onsite.contactName || d.onsite.contactPhone ? `\n${t('window.onsiteContact', { contact: [d.onsite.contactName, d.onsite.contactPhone].filter(Boolean).join(', ') })}` : ''}
          </p>
        )}
        {d.movedFrom && (
          <p className="text-xs text-muted-foreground">{t('window.movedFrom', { slot: `${fmtDayShort(d.movedFrom.previousStart)} ${fmtTime(d.movedFrom.previousStart)}` })}</p>
        )}
      </Section>

      <Section title={t('request.who')}>
        <ul className="space-y-1 text-sm">
          {/* Alte Anfragen ohne Teilnehmerliste: mindestens Sie */}
          {!d.attendees.some((a) => a.organizer) && <li>{t('request.you')}</li>}
          {d.attendees.map((a) => (
            <li key={`${a.email}-${a.name}`}>
              {a.organizer ? `${t('request.you')} · ` : ''}{a.name}
              <span className="text-muted-foreground">
                {a.title ? `, ${a.title}` : ''}{a.decisionMaker ? ` · ${t('people.decider')}` : ''}{!a.required ? ` · ${t('people.optional')}` : ''}
              </span>
            </li>
          ))}
          <li>{name} <span className="text-muted-foreground">· {t('window.tab.candidate')}</span></li>
          {d.recruiterName && <li className="text-muted-foreground">{t('window.headhunter', { name: d.recruiterName })}</li>}
        </ul>
      </Section>

      <div className="sm:col-span-2"><Section title={t('window.history')}>
        <ul className="space-y-1.5 text-sm">
          {d.timeline.map((entry, i) => (
            <li key={i} className="flex gap-2">
              <span className="w-[5.5rem] shrink-0 tabular-nums text-muted-foreground">{fmtDayMonth(entry.at)} {fmtTime(entry.at)}</span>
              {/* Mit freigegebener Identität steht der Vorname statt „Kandidat“. Der Text kommt
                  aus der Function (deutsch) und bleibt, wie er ist. */}
              <span>{candidateFirst ? entry.text.replace(/^Kandidat /, `${candidateFirst} `) : entry.text}</span>
            </li>
          ))}
        </ul>
        {d.clientMessage && <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{t('window.yourMessage', { text: d.clientMessage })}</p>}
      </Section></div>
    </div>
  );
}
