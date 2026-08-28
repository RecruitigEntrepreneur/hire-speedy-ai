import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { InterviewCalendarView } from '@/components/interview/InterviewCalendarView';
import { InterviewFeedbackForm } from '@/components/interview/InterviewFeedbackForm';
import { InterviewEditDialog } from '@/components/interview/InterviewEditDialog';
import { LiveInterviewCompanion } from '@/components/interview/LiveInterviewCompanion';
import { NextInterviewHero } from '@/components/interview/agenda/NextInterviewHero';
import { AgendaRow } from '@/components/interview/agenda/AgendaRow';
import { ActionChips, type AgendaFocus } from '@/components/interview/agenda/ActionChips';
import { CounterProposalDialog } from '@/components/interview/agenda/CounterProposalDialog';
import { CancelInterviewDialog } from '@/components/interview/agenda/CancelInterviewDialog';
import { TerminSheet, type TerminVariant } from '@/components/interview/agenda/TerminSheet';
import { useClientInterviewAgenda, type AgendaInterview } from '@/hooks/useClientInterviewAgenda';
import { useInterviewKeyboardShortcuts } from '@/hooks/useInterviewKeyboardShortcuts';
import { usePageViewTracking } from '@/hooks/useEventTracking';
import { toast } from 'sonner';
import {
  CalendarDays, ChevronDown, LayoutGrid, List, Loader2, MapPin, Phone, RefreshCw, Search, Video, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type MeetingTypeFilter = 'all' | 'video' | 'phone' | 'onsite';

/** Adapter für Bestandskomponenten (EditDialog, Kalender), die das alte
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
  const { data, isLoading, error, refetch } = useClientInterviewAgenda();

  usePageViewTracking('client_interviews');

  const [viewMode, setViewMode] = useState<'agenda' | 'calendar'>('agenda');
  const [focus, setFocus] = useState<AgendaFocus>(null);
  const [meetingTypeFilter, setMeetingTypeFilter] = useState<MeetingTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPast, setShowPast] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState<AgendaInterview | null>(null);
  const [feedbackFor, setFeedbackFor] = useState<AgendaInterview | null>(null);
  const [counterFor, setCounterFor] = useState<AgendaInterview | null>(null);
  const [cancelFor, setCancelFor] = useState<AgendaInterview | null>(null);
  // Termin-Panel: Klick auf eine Zeile zeigt den TERMIN (Slots, Status, Aktionen)
  // statt ins Bewerberprofil zu springen — das bleibt als Ausstieg im Panel.
  const [terminFor, setTerminFor] = useState<{ iv: AgendaInterview; variant: TerminVariant } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [companionOpen, setCompanionOpen] = useState(false);
  const [companionInterview, setCompanionInterview] = useState<any>(null);

  useInterviewKeyboardShortcuts({
    onToggleView: () => setViewMode((p) => (p === 'agenda' ? 'calendar' : 'agenda')),
    onFocusSearch: () => searchInputRef.current?.focus(),
    onCloseDialog: () => {
      setEditing(null);
      setFeedbackFor(null);
      setCounterFor(null);
      setCancelFor(null);
      setTerminFor(null);
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

  const openTermin = (variant: TerminVariant) => (iv: AgendaInterview) => setTerminFor({ iv, variant });

  const handleOpenGuide = async (iv: AgendaInterview) => {
    if (!iv.identityUnlocked) return;
    // Reveal-sicher: Kandidatendaten kommen aus der gated View, nie aus candidates(*)
    const { data: row, error: e } = await supabase
      .from('client_candidate_view')
      .select('*')
      .eq('submission_id', iv.submissionId)
      .maybeSingle();
    if (e || !row) {
      toast.error('Guide konnte nicht geladen werden.');
      return;
    }
    setCompanionInterview({
      ...toLegacyShape(iv),
      submission: {
        id: iv.submissionId,
        candidate: { ...row, id: row.candidate_id },
        job: { title: iv.jobTitle, company_name: '' },
      },
    });
    setCompanionOpen(true);
  };

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

  const handleEditSave = async (form: {
    scheduled_at: string;
    duration_minutes: number;
    meeting_type: string;
    meeting_link: string;
    notes: string;
  }) => {
    if (!editing) return;
    setProcessing(true);

    const dateChanged =
      !editing.scheduledAt || new Date(form.scheduled_at).getTime() !== new Date(editing.scheduledAt).getTime();

    const update: Record<string, unknown> = {
      scheduled_at: form.scheduled_at,
      duration_minutes: form.duration_minutes,
      meeting_type: form.meeting_type,
      meeting_link: form.meeting_link,
      notes: form.notes,
    };
    // Status nur bei echter (Um-)Terminierung setzen – Notiz-Edits
    // reanimieren keine No-Shows/Absagen mehr.
    if (dateChanged) {
      update.status = 'scheduled';
      update.client_confirmed = true;
      update.client_confirmed_at = new Date().toISOString();
    }

    const { error: e } = await supabase.from('interviews').update(update).eq('id', editing.id);
    setProcessing(false);
    if (e) {
      toast.error('Fehler beim Speichern');
      return;
    }
    if (dateChanged) {
      await notifyRecruiter(
        editing,
        'interview_rescheduled',
        'Interview umgebucht',
        `Der Kunde hat das Interview für "${editing.jobTitle}" auf ${new Date(form.scheduled_at).toLocaleString('de-DE', { dateStyle: 'full', timeStyle: 'short' })} gelegt. Bitte den Kandidaten informieren.`,
      );
      toast.success('Termin gespeichert – der Recruiter informiert den Kandidaten.');
    } else {
      toast.success('Interview aktualisiert');
    }
    setEditing(null);
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
              <NextInterviewHero interview={data.nextUp} onOpenGuide={handleOpenGuide} onEdit={setEditing} />
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
                    if (iv) setEditing(iv);
                  }}
                />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Gegenvorschläge */}
                {sectionVisible('counter') && counter.length > 0 && (
                  <section>
                    <h2 className="mb-1 px-2.5 text-sm font-semibold">
                      Gegenvorschläge <span className="font-normal text-muted-foreground">· {counter.length}</span>
                    </h2>
                    <div className="space-y-0.5">
                      {counter.map((iv) => (
                        <AgendaRow
                          key={iv.id}
                          iv={iv}
                          variant="counter"
                          onDetails={openTermin('counter')}
                          onRespondCounter={setCounterFor}
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
                                onEdit={setEditing}
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

                {/* Wartet auf Kandidaten-Antwort */}
                {sectionVisible('awaiting') && awaiting.length > 0 && (
                  <section>
                    <h2 className="mb-1 px-2.5 text-sm font-semibold">
                      Wartet auf Kandidaten-Antwort{' '}
                      <span className="font-normal text-muted-foreground">· {awaiting.length}</span>
                    </h2>
                    <div className="space-y-0.5">
                      {awaiting.map((iv) => (
                        <AgendaRow
                          key={iv.id}
                          iv={iv}
                          variant="awaiting"
                          onDetails={openTermin('awaiting')}
                          onEdit={setEditing}
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

      {/* Termin-Panel */}
      <TerminSheet
        interview={terminFor?.iv ?? null}
        variant={terminFor?.variant ?? 'agenda'}
        open={!!terminFor}
        onOpenChange={(o) => !o && setTerminFor(null)}
        onEdit={setEditing}
        onRemind={handleRemind}
        onCancel={setCancelFor}
        onRespondCounter={setCounterFor}
        onFeedback={setFeedbackFor}
      />

      {/* Dialoge */}
      <InterviewEditDialog
        interview={editing ? (toLegacyShape(editing) as any) : null}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSave={handleEditSave}
        isProcessing={processing}
      />

      <CounterProposalDialog
        interview={counterFor}
        open={!!counterFor}
        onOpenChange={(o) => !o && setCounterFor(null)}
        onDone={() => refetch()}
        onProposeNew={(iv) => setEditing(iv)}
      />

      <CancelInterviewDialog
        interview={cancelFor}
        open={!!cancelFor}
        onOpenChange={(o) => !o && setCancelFor(null)}
        onDone={() => refetch()}
      />

      <LiveInterviewCompanion open={companionOpen} onOpenChange={setCompanionOpen} interview={companionInterview} />

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
        />
      )}
    </DashboardLayout>
  );
}
