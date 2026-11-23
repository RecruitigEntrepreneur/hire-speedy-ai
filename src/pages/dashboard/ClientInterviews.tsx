import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fmtRange, interviewApi } from '@/lib/interviewScheduling';
import { fmtTime, fmtWeekdayDayMonth } from '@/lib/localeFormat';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { InterviewCalendarView } from '@/components/interview/InterviewCalendarView';
import { FeedbackDialog } from '@/components/interview/window/FeedbackDialog';
import { NextInterviewHero } from '@/components/interview/agenda/NextInterviewHero';
import { AgendaRow } from '@/components/interview/agenda/AgendaRow';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CounterProposalDialog } from '@/components/interview/agenda/CounterProposalDialog';
import { CancelInterviewDialog } from '@/components/interview/agenda/CancelInterviewDialog';
import { InterviewWindow, type WindowTab, type WindowVariant } from '@/components/interview/window/InterviewWindow';
import { InterviewRequestDialog } from '@/components/interview/request/InterviewRequestDialog';
import { useClientInterviewAgenda, type AgendaInterview } from '@/hooks/useClientInterviewAgenda';
import { useInterviewKeyboardShortcuts } from '@/hooks/useInterviewKeyboardShortcuts';
import { usePageViewTracking } from '@/hooks/useEventTracking';
import { toast } from 'sonner';
import {
  CalendarDays, ChevronDown, ChevronRight, LayoutGrid, List, Loader2, RefreshCw, Search, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type MeetingTypeFilter = 'all' | 'video' | 'phone' | 'onsite';
/** Reiter der Agenda (Apple-Stil, 23.11.2026): statt langer Abschnitte untereinander. */
type Reiter = 'counter' | 'feedback' | 'awaiting' | 'upcoming' | 'past';

/** Adapter für den Kalender (Bestandskomponente), der das alte
 *  Interview-Shape mit submission.candidate erwarten – Name ist hier bereits
 *  reveal-sicher (anonymer Code bis Opt-In). */
const toLegacyShape = (iv: AgendaInterview) => ({
  id: iv.id,
  scheduled_at: iv.scheduledAt,
  duration_minutes: iv.durationMinutes,
  meeting_type: iv.meetingType,
  meeting_link: iv.joinUrl,
  status: iv.status,
  notes: iv.notes,
  feedback: iv.feedback,
  submission: {
    id: iv.submissionId,
    candidate: { full_name: iv.candidateName, email: '' },
    job: { title: iv.jobTitle, company_name: '' },
  },
});

export default function ClientInterviews() {
  const { t } = useTranslation(['clientInterviews', 'interviews']);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useClientInterviewAgenda();

  usePageViewTracking('client_interviews');

  const [viewMode, setViewMode] = useState<'agenda' | 'calendar'>('agenda');
  const [tab, setTab] = useState<Reiter | null>(null);
  const [heroIdx, setHeroIdx] = useState(0);
  const [meetingTypeFilter, setMeetingTypeFilter] = useState<MeetingTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [feedbackFor, setFeedbackFor] = useState<AgendaInterview | null>(null);
  const [counterFor, setCounterFor] = useState<AgendaInterview | null>(null);
  const [cancelFor, setCancelFor] = useState<AgendaInterview | null>(null);
  // Interview-Fenster: Klick auf ein Interview (Zeile, Kasten oben, Kalender) zeigt ALLES zum Termin
  const [windowFor, setWindowFor] = useState<{ iv: AgendaInterview; variant: WindowVariant; start?: WindowTab | 'reschedule' } | null>(null);
  const [processing, setProcessing] = useState(false);
  // „Interview anfragen“: neue Anfrage, neue Termine (ersetzt eine offene Anfrage) oder Umbuchen
  const [requestFor, setRequestFor] = useState<{ submissionId: string; replacesInterviewId: string | null } | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useInterviewKeyboardShortcuts({
    onToggleView: () => setViewMode((p) => (p === 'agenda' ? 'calendar' : 'agenda')),
    onFocusSearch: () => searchInputRef.current?.focus(),
    onCloseDialog: () => {
      setFeedbackFor(null);
      setCounterFor(null);
      setCancelFor(null);
      setWindowFor(null);
      setRequestFor(null);
    },
    enabled: true,
  });

  const matches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (iv: AgendaInterview) => {
      if (meetingTypeFilter !== 'all') {
        const type = iv.meetingType;
        const isVideo = type === 'video' || type === 'teams' || type === 'meet';
        if (meetingTypeFilter === 'video' ? !isVideo : type !== meetingTypeFilter) return false;
      }
      if (q) {
        const hay = `${iv.candidateName} ${iv.jobTitle} ${iv.candidateRole || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    };
  }, [meetingTypeFilter, searchQuery]);

  const counter = (data?.counterProposals || []).filter(matches);
  const awaiting = (data?.awaitingCandidate || []).filter(matches);
  const feedbackDue = (data?.feedbackDue || []).filter(matches);
  const past = (data?.past || []).filter(matches);
  const agendaDays = (data?.agendaDays || [])
    .map((d) => ({ ...d, items: d.items.filter(matches) }))
    .filter((d) => d.items.length > 0);

  const hasAny = (data?.all.length || 0) > 0;
  const hasActiveFilters = meetingTypeFilter !== 'all' || searchQuery.trim() !== '';

  // Deep-Link von „Feedback geben" (CandidateDetail): direkt das Formular des
  // gemeinten Kandidaten öffnen, statt den Kunden nur auf die Liste zu werfen.
  const openFeedbackFor = (location.state as { openFeedbackFor?: string } | null)?.openFeedbackFor;
  useEffect(() => {
    if (!openFeedbackFor || !data?.feedbackDue?.length) return;
    const match = data.feedbackDue.find((iv) => iv.submissionId === openFeedbackFor);
    if (match) setFeedbackFor(match);
    // State konsumiert — verhindert erneutes Öffnen bei Re-Render / Zurück-Navigation.
    navigate(location.pathname, { replace: true, state: null });
  }, [openFeedbackFor, data?.feedbackDue, navigate, location.pathname]);

  // ---- Aktionen ----------------------------------------------------------

  const openTermin = (variant: WindowVariant, start?: WindowTab | 'reschedule') => (iv: AgendaInterview) => setWindowFor({ iv, variant, start });
  const variantOf = (iv: AgendaInterview): WindowVariant =>
    data?.counterProposals.some((x) => x.id === iv.id) ? 'counter'
      : data?.awaitingCandidate.some((x) => x.id === iv.id) ? 'awaiting'
        : data?.feedbackDue.some((x) => x.id === iv.id) ? 'feedback'
          : data?.past.some((x) => x.id === iv.id) ? 'past' : 'agenda';
  const openWindow = (iv: AgendaInterview, start?: WindowTab | 'reschedule') => setWindowFor({ iv, variant: variantOf(iv), start });

  // Link aus dem Outlook-Termin bzw. aus Mails: /dashboard/interviews?interview=<id>
  const linkedInterview = new URLSearchParams(location.search).get('interview');
  useEffect(() => {
    if (!linkedInterview || !data) return;
    const iv = data.all.find((x) => x.id === linkedInterview);
    if (iv) openWindow(iv);
    navigate(location.pathname, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedInterview, data]);

  // Neue Termine / Umbuchen: der Kandidat bestätigt neu, die alte Anfrage wird ersetzt
  const openNewRequest = (iv: AgendaInterview) =>
    setRequestFor({ submissionId: iv.submissionId, replacesInterviewId: iv.id });

  // Kandidat hat eine andere Zeit angefragt → Kunde bestätigt sie direkt
  const handleConfirmAlternative = async (iv: AgendaInterview) => {
    setConfirmingId(iv.id);
    try {
      await interviewApi.confirmAlternative(iv.id);
      toast.success(t('page.confirmed'));
      setWindowFor(null);
      queryClient.invalidateQueries({ queryKey: ['client-interview-agenda'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('page.confirmFailed'));
    } finally {
      setConfirmingId(null);
    }
  };

  // „Leitfaden“: dasselbe Fenster, direkt auf dem Leitfaden
  const handleOpenGuide = (iv: AgendaInterview) => openWindow(iv, 'guide');

  const notifyRecruiter = async (iv: AgendaInterview, type: string, title: string, message: string) => {
    const { data: sub } = await supabase.from('submissions').select('recruiter_id').eq('id', iv.submissionId).single();
    if (sub?.recruiter_id) {
      await supabase.from('notifications').insert({
        user_id: sub.recruiter_id,
        type,
        title,
        message,
        related_type: 'interview',
        related_id: iv.id,
      });
    }
  };

  // Benachrichtigungen an den Headhunter werden gespeichert und in dessen Glocke gelesen;
  // seine Sprache ist hier nicht bekannt, deshalb bleiben Titel und Text deutsch.
  const handleRemind = async (iv: AgendaInterview) => {
    try {
      await notifyRecruiter(
        iv,
        'interview_reminder_requested',
        'Kunde bittet um Erinnerung',
        `Der Kandidat ${iv.candidateName} hat auf die Interview-Anfrage für "${iv.jobTitle}" seit ${Math.floor(iv.waitingHours / 24) || iv.waitingHours} ${iv.waitingHours >= 48 ? 'Tagen' : 'Stunden'} nicht geantwortet. Bitte nachfassen.`,
      );
      toast.success(t('page.reminded'));
    } catch (e) {
      console.error('Erinnern-Fehler:', e);
      toast.error(t('page.remindFailed'));
    }
  };

  const handleNoShow = async (iv: AgendaInterview) => {
    setProcessing(true);
    const { error: e } = await supabase
      .from('interviews')
      .update({
        status: 'no_show',
        no_show_reported: true,
        no_show_by: 'candidate',
        notes: `${iv.notes || ''}\n\n[No-Show: Kandidat nicht erschienen]`.trim(),
      })
      .eq('id', iv.id);
    setProcessing(false);
    if (e) {
      toast.error(t('page.noShowFailed'));
      return;
    }
    await notifyRecruiter(iv, 'interview_no_show', 'No-Show gemeldet', `Der Kandidat ist zum Interview für "${iv.jobTitle}" nicht erschienen.`);
    toast.success(t('page.noShowDone'));
    refetch();
  };

  // ---- Render ------------------------------------------------------------

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <p className="text-muted-foreground">{t('page.loadError')}</p>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" /> {t('page.retry')}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  // ---- „Als Nächstes“ und Reiter ---------------------------------------
  const upcoming = agendaDays.flatMap((d) => d.items);
  // Ohne bestätigten Termin steht oben der nächste Schritt des Kunden: erst angefragte andere Zeiten,
  // dann fällige Feedbacks, die ältesten zuerst.
  const heroListe = data?.nextUp ? [] : [
    ...(data?.counterProposals ?? []).map((iv) => ({ iv, art: 'counter' as const })),
    ...[...(data?.feedbackDue ?? [])].sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? '')).map((iv) => ({ iv, art: 'feedback' as const })),
  ];
  const hero = heroListe.length ? heroListe[Math.min(heroIdx, heroListe.length - 1)] : null;
  const ohneHero = (liste: AgendaInterview[]) => liste.filter((iv) => iv.id !== hero?.iv.id);
  const listen: Record<Reiter, AgendaInterview[]> = {
    counter: ohneHero(counter), feedback: ohneHero(feedbackDue), awaiting, upcoming, past,
  };
  const reiterListe = ([
    { key: 'counter', label: t('page.yourTurn') },
    { key: 'feedback', label: t('page.feedbackDue') },
    { key: 'awaiting', label: t('page.awaiting') },
    { key: 'upcoming', label: t('page.upcoming') },
    { key: 'past', label: t('page.pastTab') },
  ] as { key: Reiter; label: string }[]).filter((r) => listen[r.key].length > 0 || r.key === 'upcoming');
  const aktiv: Reiter = tab && reiterListe.some((r) => r.key === tab) ? tab : reiterListe.find((r) => listen[r.key].length > 0)?.key ?? 'upcoming';
  const nameOf = (iv: AgendaInterview) => (!iv.identityUnlocked && iv.candidateRole ? iv.candidateRole : iv.candidateName);
  const zahlen = [
    (data?.counterProposals.length || 0) > 0 && t('page.sumCounter', { count: data!.counterProposals.length }),
    (data?.feedbackDue.length || 0) > 0 && t('page.sumFeedback', { count: data!.feedbackDue.length }),
    (data?.awaitingCandidate.length || 0) > 0 && t('page.sumAwaiting', { count: data!.awaitingCandidate.length }),
  ].filter(Boolean).join(' · ');
  const artLabel: Record<MeetingTypeFilter, string> = {
    all: t('page.allTypes'), video: t('page.filter.video'), phone: t('interviews:meeting.phone'), onsite: t('interviews:meeting.onsite'),
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Kopf: ein Satz mit den Zahlen, rechts Art des Termins und Ansicht */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-bold">{t('page.title')}</h1>
            <p className="text-sm text-muted-foreground">{zahlen || t('page.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">{artLabel[meetingTypeFilter]}<ChevronDown className="h-3.5 w-3.5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {(['all', 'video', 'phone', 'onsite'] as MeetingTypeFilter[]).map((k) => (
                  <DropdownMenuItem key={k} className={cn('cursor-pointer', meetingTypeFilter === k && 'font-medium')} onClick={() => setMeetingTypeFilter(k)}>{artLabel[k]}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex items-center gap-0.5 rounded-full bg-secondary p-1">
              {([['agenda', List, t('page.agenda')], ['calendar', LayoutGrid, t('page.calendar')]] as const).map(([k, Icon, label]) => (
                <button key={k} type="button" aria-pressed={viewMode === k} onClick={() => setViewMode(k)}
                  className={cn('inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors', viewMode === k ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : !hasAny ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border bg-card py-16 text-center">
            <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
            <p className="font-medium">{t('page.empty')}</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {t('page.emptyLead')}
            </p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => navigate('/dashboard/candidates')}>
              {t('page.toApplications')}
            </Button>
          </div>
        ) : (
          <>
            {/* Oben: der nächste bestätigte Termin, sonst der nächste Schritt des Kunden */}
            {viewMode === 'agenda' && data?.nextUp && (
              // data-tour: Ziel des Kunden-Rundgangs (lib/clientGuide.ts)
              <div data-tour="interviews.next"><NextInterviewHero interview={data.nextUp} onOpen={(iv) => openWindow(iv)} onOpenGuide={handleOpenGuide} onEdit={(iv) => openWindow(iv, 'reschedule')} /></div>
            )}
            {viewMode === 'agenda' && hero && (
              <div className="rounded-[20px] border bg-card p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold tracking-tight">{t('page.next')}</h2>
                  <span className="text-xs text-muted-foreground">{t('page.position', { n: Math.min(heroIdx, heroListe.length - 1) + 1, total: heroListe.length })}</span>
                </div>
                <p className="mt-4 text-xl font-semibold leading-snug tracking-tight">
                  {hero.art === 'feedback' ? t('row.giveFeedback') : t('page.yourTurn')}: {nameOf(hero.iv)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {hero.art === 'feedback'
                    ? [hero.iv.scheduledAt ? t('page.heroWas', { when: `${fmtWeekdayDayMonth(new Date(hero.iv.scheduledAt))}, ${fmtTime(hero.iv.scheduledAt)}` }) : null, hero.iv.jobTitle].filter(Boolean).join(' · ')
                    : [hero.iv.counterSlots[0]?.datetime ? t('row.asksFor', { time: fmtRange(hero.iv.counterSlots[0].datetime, hero.iv.durationMinutes) }) : t('row.asksOther'), hero.iv.jobTitle].join(' · ')}
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Button className="px-5" onClick={() => (hero.art === 'feedback' ? setFeedbackFor(hero.iv) : openTermin('counter')(hero.iv))}>
                      {hero.art === 'feedback' ? t('row.giveFeedback') : t('row.viewRequest')}
                    </Button>
                    {heroListe.length > 1 && <Button variant="secondary" className="px-5" onClick={() => setHeroIdx((x) => (x + 1) % heroListe.length)}>{t('page.later')}</Button>}
                  </div>
                  {heroListe.length > 1 && (
                    <div className="flex items-center gap-1.5">
                      <Button variant="secondary" size="icon" className="h-8 w-8" aria-label={t('page.prev')} onClick={() => setHeroIdx((x) => (x - 1 + heroListe.length) % heroListe.length)}><ChevronRight className="h-4 w-4 rotate-180" /></Button>
                      <Button variant="secondary" size="icon" className="h-8 w-8" aria-label={t('page.nextStep')} onClick={() => setHeroIdx((x) => (x + 1) % heroListe.length)}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Reiter links, Suche rechts */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {viewMode === 'agenda' ? (
                <div role="tablist" className="flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {reiterListe.map((r) => (
                    <button key={r.key} type="button" role="tab" aria-selected={aktiv === r.key} onClick={() => setTab(r.key)}
                      className={cn('h-8 shrink-0 whitespace-nowrap rounded-full px-3.5 text-xs font-medium transition-colors', aktiv === r.key ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground')}>
                      {r.label} <span className="font-normal">{listen[r.key].length}</span>
                    </button>
                  ))}
                </div>
              ) : <span />}
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <button type="button" className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => { setMeetingTypeFilter('all'); setSearchQuery(''); }}>
                    <X className="h-3 w-3" /> {t('page.reset')}
                  </button>
                )}
                <div className="relative w-full sm:w-56">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    placeholder={t('page.searchPh')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 pl-9"
                  />
                </div>
              </div>
            </div>

            {viewMode === 'calendar' ? (
              <div className="rounded-xl border bg-card p-4">
                <InterviewCalendarView
                  interviews={[...agendaDays.flatMap((d) => d.items), ...feedbackDue, ...past]
                    .filter((iv) => iv.scheduledAt)
                    .map(toLegacyShape) as any}
                  onSelectInterview={(legacy: any) => {
                    const iv = data?.all.find((x) => x.id === legacy.id);
                    if (iv) openWindow(iv);
                  }}
                />
              </div>
            ) : listen[aktiv].length === 0 ? (
              <p className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                {aktiv === 'upcoming' ? (hasActiveFilters ? t('page.noConfirmedFilter') : t('page.noConfirmed')) : t('page.noneForFilter')}
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {listen[aktiv].map((iv) => (
                  <AgendaRow
                    key={iv.id}
                    karte
                    iv={iv}
                    variant={aktiv === 'upcoming' ? 'agenda' : aktiv}
                    onDetails={openTermin(aktiv === 'upcoming' ? 'agenda' : aktiv)}
                    onRespondCounter={aktiv === 'counter' ? setCounterFor : undefined}
                    onConfirmAlternative={aktiv === 'counter' ? handleConfirmAlternative : undefined}
                    confirming={confirmingId === iv.id}
                    onNewRequest={aktiv === 'counter' || aktiv === 'upcoming' || aktiv === 'awaiting' ? openNewRequest : undefined}
                    onCancel={aktiv === 'counter' || aktiv === 'upcoming' || aktiv === 'awaiting' ? setCancelFor : undefined}
                    onRemind={aktiv === 'awaiting' ? handleRemind : undefined}
                    onFeedback={aktiv === 'feedback' || aktiv === 'past' ? setFeedbackFor : undefined}
                    onNoShow={aktiv === 'feedback' ? handleNoShow : undefined}
                    onOpenGuide={aktiv === 'counter' || aktiv === 'upcoming' || aktiv === 'feedback' ? handleOpenGuide : undefined}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {processing && (
          <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm shadow-lg">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> {t('page.saving')}
          </div>
        )}
      </div>

      {/* Interview-Fenster */}
      <InterviewWindow
        interview={windowFor?.iv ?? null}
        variant={windowFor?.variant ?? 'agenda'}
        start={windowFor?.start}
        open={!!windowFor}
        onOpenChange={(o) => !o && setWindowFor(null)}
        onConfirmAlternative={handleConfirmAlternative}
        confirming={!!windowFor && confirmingId === windowFor.iv.id}
        onRemind={handleRemind}
        onNewRequest={openNewRequest}
        onCancel={setCancelFor}
        onNextRound={(iv) => setRequestFor({ submissionId: iv.submissionId, replacesInterviewId: null })}
        onChanged={() => refetch()}
      />

      {/* Dialoge */}
      <CounterProposalDialog
        interview={counterFor}
        open={!!counterFor}
        onOpenChange={(o) => !o && setCounterFor(null)}
        onDone={() => refetch()}
        onProposeNew={openNewRequest}
      />

      <CancelInterviewDialog
        interview={cancelFor}
        open={!!cancelFor}
        onOpenChange={(o) => !o && setCancelFor(null)}
        onDone={() => refetch()}
      />


      <FeedbackDialog
        interviewId={feedbackFor?.id ?? null}
        open={!!feedbackFor}
        onOpenChange={(o) => !o && setFeedbackFor(null)}
        candidateName={feedbackFor?.candidateName ?? ''}
        onSaved={() => refetch()}
        onNext={(way) => {
          if (!feedbackFor) return;
          // Nächste Runde: gleich anfragen (die Runde ermittelt das Backend); Angebot und Absage im Profil
          if (way === 'next_round') setRequestFor({ submissionId: feedbackFor.submissionId, replacesInterviewId: null });
          else navigate(`/dashboard/candidates/${feedbackFor.submissionId}`, { state: { open: way } });
        }}
      />

      <InterviewRequestDialog
        open={!!requestFor}
        onOpenChange={(o) => !o && setRequestFor(null)}
        submissionId={requestFor?.submissionId ?? ''}
        replacesInterviewId={requestFor?.replacesInterviewId ?? null}
        onSent={() => {
          setRequestFor(null);
          refetch();
        }}
      />
    </DashboardLayout>
  );
}
