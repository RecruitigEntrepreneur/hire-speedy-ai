import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { interviewApi } from '@/lib/interviewScheduling';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { InterviewCalendarView } from '@/components/interview/InterviewCalendarView';
import { InterviewFeedbackForm } from '@/components/interview/InterviewFeedbackForm';
import { NextInterviewHero } from '@/components/interview/agenda/NextInterviewHero';
import { AgendaRow } from '@/components/interview/agenda/AgendaRow';
import { ActionChips, type AgendaFocus } from '@/components/interview/agenda/ActionChips';
import { CounterProposalDialog } from '@/components/interview/agenda/CounterProposalDialog';
import { CancelInterviewDialog } from '@/components/interview/agenda/CancelInterviewDialog';
import { InterviewWindow, type WindowTab, type WindowVariant } from '@/components/interview/window/InterviewWindow';
import { InterviewRequestDialog } from '@/components/interview/request/InterviewRequestDialog';
import { useClientInterviewAgenda, type AgendaInterview } from '@/hooks/useClientInterviewAgenda';
import { useInterviewKeyboardShortcuts } from '@/hooks/useInterviewKeyboardShortcuts';
import { usePageViewTracking } from '@/hooks/useEventTracking';
import { toast } from 'sonner';
import {
  CalendarDays, ChevronDown, LayoutGrid, List, Loader2, MapPin, Phone, RefreshCw, Search, Video, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type MeetingTypeFilter = 'all' | 'video' | 'phone' | 'onsite';

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
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useClientInterviewAgenda();

  usePageViewTracking('client_interviews');

  const [viewMode, setViewMode] = useState<'agenda' | 'calendar'>('agenda');
  const [focus, setFocus] = useState<AgendaFocus>(null);
  const [meetingTypeFilter, setMeetingTypeFilter] = useState<MeetingTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPast, setShowPast] = useState(false);
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
        const t = iv.meetingType;
        const isVideo = t === 'video' || t === 'teams' || t === 'meet';
        if (meetingTypeFilter === 'video' ? !isVideo : t !== meetingTypeFilter) return false;
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
      toast.success('Termin steht. Einladungen mit Teams-Link sind unterwegs.');
      setWindowFor(null);
      queryClient.invalidateQueries({ queryKey: ['client-interview-agenda'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Der Termin konnte nicht bestätigt werden.');
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

  const handleRemind = async (iv: AgendaInterview) => {
    try {
      await notifyRecruiter(
        iv,
        'interview_reminder_requested',
        'Kunde bittet um Erinnerung',
        `Der Kandidat ${iv.candidateName} hat auf die Interview-Anfrage für "${iv.jobTitle}" seit ${Math.floor(iv.waitingHours / 24) || iv.waitingHours} ${iv.waitingHours >= 48 ? 'Tagen' : 'Stunden'} nicht geantwortet. Bitte nachfassen.`,
      );
      toast.success('Der Recruiter wurde gebeten, beim Kandidaten nachzufassen.');
    } catch (e) {
      console.error('Erinnern-Fehler:', e);
      toast.error('Erinnerung konnte nicht gesendet werden.');
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
      toast.error('No-Show konnte nicht gemeldet werden.');
      return;
    }
    await notifyRecruiter(iv, 'interview_no_show', 'No-Show gemeldet', `Der Kandidat ist zum Interview für "${iv.jobTitle}" nicht erschienen.`);
    toast.success('No-Show gemeldet.');
    refetch();
  };

  // ---- Render ------------------------------------------------------------

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <p className="text-muted-foreground">Interviews konnten nicht geladen werden.</p>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Erneut versuchen
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const sectionVisible = (key: Exclude<AgendaFocus, null>) => focus === null || focus === key;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-bold">Interviews</h1>
            <p className="text-sm text-muted-foreground">Chronologisch — was heute zählt, steht oben.</p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border p-1">
            <Button
              variant={viewMode === 'agenda' ? 'secondary' : 'ghost'}
              size="sm"
              className="gap-1.5"
              onClick={() => setViewMode('agenda')}
            >
              <List className="h-4 w-4" /> Agenda
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
              size="sm"
              className="gap-1.5"
              onClick={() => setViewMode('calendar')}
            >
              <LayoutGrid className="h-4 w-4" /> Kalender
            </Button>
          </div>
        </div>

        {/* Dringlichkeits-Chips */}
        <ActionChips
          counts={{
            counter: data?.counterProposals.length || 0,
            feedback: data?.feedbackDue.length || 0,
            awaiting: data?.awaitingCandidate.length || 0,
          }}
          focus={focus}
          onFocusChange={setFocus}
        />

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : !hasAny ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
            <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
            <p className="font-medium">Noch keine Interviews</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Interviews entstehen aus Bewerbungen: Kandidaten prüfen und direkt eine Interview-Anfrage senden.
            </p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => navigate('/dashboard/candidates')}>
              Zu den Bewerbungen
            </Button>
          </div>
        ) : (
          <>
            {/* Als Nächstes */}
            {focus === null && viewMode === 'agenda' && data?.nextUp && (
              <NextInterviewHero interview={data.nextUp} onOpen={(iv) => openWindow(iv)} onOpenGuide={handleOpenGuide} onEdit={(iv) => openWindow(iv, 'reschedule')} />
            )}

            {/* Filterleiste */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-1 rounded-lg border p-1">
                {(
                  [
                    { key: 'all', label: 'Alle', icon: null },
                    { key: 'video', label: 'Video', icon: Video },
                    { key: 'phone', label: 'Telefon', icon: Phone },
                    { key: 'onsite', label: 'Vor Ort', icon: MapPin },
                  ] as const
                ).map(({ key, label, icon: Icon }) => (
                  <Button
                    key={key}
                    variant={meetingTypeFilter === key ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => setMeetingTypeFilter(key)}
                  >
                    {Icon && <Icon className="h-3.5 w-3.5" />}
                    {label}
                  </Button>
                ))}
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs text-muted-foreground"
                    onClick={() => {
                      setMeetingTypeFilter('all');
                      setSearchQuery('');
                    }}
                  >
                    <X className="h-3 w-3" /> Zurücksetzen
                  </Button>
                )}
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Kandidat oder Position …"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9"
                />
              </div>
            </div>

            {viewMode === 'calendar' ? (
              <div className="rounded-xl border p-4">
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
            ) : (
              <div className="space-y-6">
                {/* Sie sind am Zug: Kandidat fragt eine andere Zeit an */}
                {sectionVisible('counter') && counter.length > 0 && (
                  <section>
                    <h2 className="mb-1 px-2.5 text-sm font-semibold">
                      Sie sind am Zug <span className="font-normal text-muted-foreground">· {counter.length}</span>
                    </h2>
                    <div className="space-y-0.5">
                      {counter.map((iv) => (
                        <AgendaRow
                          key={iv.id}
                          iv={iv}
                          variant="counter"
                          onDetails={openTermin('counter')}
                          onRespondCounter={setCounterFor}
                          onConfirmAlternative={handleConfirmAlternative}
                          confirming={confirmingId === iv.id}
                          onNewRequest={openNewRequest}
                          onCancel={setCancelFor}
                          onOpenGuide={handleOpenGuide}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Agenda */}
                {focus === null && (
                  <section>
                    {agendaDays.length === 0 ? (
                      <p className="px-2.5 py-4 text-sm text-muted-foreground">
                        Keine bestätigten Termine{hasActiveFilters ? ' für diesen Filter' : ''}.
                      </p>
                    ) : (
                      agendaDays.map((day) => (
                        <div key={day.key} className="mb-2">
                          <p className="mb-0.5 px-2.5 pt-2 text-xs text-muted-foreground">{day.label}</p>
                          <div className="space-y-0.5">
                            {day.items.map((iv) => (
                              <AgendaRow
                                key={iv.id}
                                iv={iv}
                                variant="agenda"
                                onDetails={openTermin('agenda')}
                                onNewRequest={openNewRequest}
                                onCancel={setCancelFor}
                                onOpenGuide={handleOpenGuide}
                              />
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </section>
                )}

                {/* Wartet auf den Kandidaten */}
                {sectionVisible('awaiting') && awaiting.length > 0 && (
                  <section>
                    <h2 className="mb-1 px-2.5 text-sm font-semibold">
                      Wartet auf den Kandidaten{' '}
                      <span className="font-normal text-muted-foreground">· {awaiting.length}</span>
                    </h2>
                    <div className="space-y-0.5">
                      {awaiting.map((iv) => (
                        <AgendaRow
                          key={iv.id}
                          iv={iv}
                          variant="awaiting"
                          onDetails={openTermin('awaiting')}
                          onNewRequest={openNewRequest}
                          onCancel={setCancelFor}
                          onRemind={handleRemind}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Feedback fällig */}
                {sectionVisible('feedback') && feedbackDue.length > 0 && (
                  <section>
                    <h2 className="mb-1 px-2.5 text-sm font-semibold">
                      Feedback fällig <span className="font-normal text-muted-foreground">· {feedbackDue.length}</span>
                    </h2>
                    <div className="space-y-0.5">
                      {feedbackDue.map((iv) => (
                        <AgendaRow
                          key={iv.id}
                          iv={iv}
                          variant="feedback"
                          onDetails={openTermin('feedback')}
                          onFeedback={setFeedbackFor}
                          onNoShow={handleNoShow}
                          onOpenGuide={handleOpenGuide}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Vergangen */}
                {focus === null && past.length > 0 && (
                  <section>
                    <button
                      onClick={() => setShowPast((s) => !s)}
                      className="flex items-center gap-1.5 px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                      aria-expanded={showPast}
                    >
                      <ChevronDown className={cn('h-4 w-4 transition-transform', !showPast && '-rotate-90')} />
                      Vergangen · {past.length}
                    </button>
                    {showPast && (
                      <div className="mt-1 space-y-0.5">
                        {past.map((iv) => (
                          <AgendaRow key={iv.id} iv={iv} variant="past" onDetails={openTermin('past')} onFeedback={setFeedbackFor} />
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </div>
            )}
          </>
        )}

        {processing && (
          <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm shadow-lg">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> Wird gespeichert …
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


      {feedbackFor && (
        <InterviewFeedbackForm
          interviewId={feedbackFor.id}
          candidateName={feedbackFor.candidateName}
          open={!!feedbackFor}
          onOpenChange={(o) => !o && setFeedbackFor(null)}
          onSuccess={() => {
            setFeedbackFor(null);
            refetch();
          }}
          // „Weiter / Nächste Runde“: gleich die nächste Runde anfragen (die Runde ermittelt das Backend)
          onNextRound={() => setRequestFor({ submissionId: feedbackFor.submissionId, replacesInterviewId: null })}
        />
      )}

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
