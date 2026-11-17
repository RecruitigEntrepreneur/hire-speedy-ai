import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

// Job-Cockpit: Zustandspille, Zug-Banner (Engpass-Diagnose), Funnel-Leiste,
// "Wartet auf Sie"-Liste — alles gespeist aus useBewerber({jobId}).
import { JobStatePill } from '@/components/client/JobCockpit';
import {
  JobTermineCard,
  JobKonditionen,
  JobTeam,
  JobVerlauf,
  type VerlaufEvent,
} from '@/components/client/JobDetailSections';
import { AgreementCard, AnsweredQuestionsCard, ChangeRequestDialog, DetailSheet, FinalistsCard, ForYouCard, JobFactsLine, OthersCard, SearcherLine, JobMoreMenu, JobStatusMenu, SearchStatusCard, ShareStatusDialog, SpeedCard, agreementFactsOf, useJobSearchers, type JobRunState, type ShareData } from '@/components/client/job/JobControl';
import { taskHref, useClientTasks, type ClientTask } from '@/lib/clientTasksApi';
import { ClientTaskWindow } from '@/components/client/tasks/ClientTaskWindow';
import { CandidatesTab, ContractTab, InterviewsTab, JobTabsBar, MarketTab, TeamTab, costLineOf, isJobTab, type HistoryEvent, type JobTab } from '@/components/client/job/JobSubpages';
import { SectionCard } from '@/components/client/job/JobControl';
import { JobsAnalytics } from '@/components/client/jobs/JobsAnalytics';
import { computeJobState } from '@/lib/jobCockpit';
import { useBewerber } from '@/hooks/useBewerber';
import { useClientInterviewAgenda } from '@/hooks/useClientInterviewAgenda';

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  FileDown,
  Circle,
  Clock,
  Loader2,
  Lock,
  Pencil,
  Sparkles,
  UserPlus,
  XCircle,
} from 'lucide-react';
import { InviteMemberDialog } from '@/components/organization/InviteMemberDialog';
import { HeadhunterVorschau, JobSummary } from '@/components/client/job/JobSummary';
import { JobPrepChecklist } from '@/components/client/job/JobPrepChecklist';
import { useMyOrganization } from '@/hooks/useOrganization';
import { resolveIntakeSubmitTarget, notifyApproversOfIntake, notifyCreatorOfDecision } from '@/lib/intakeApproval';
import { stellenVerlauf, verlaufDatum } from '@/lib/stellenVerlauf';
import { VerlaufLeiste } from '@/components/dashboard/StellenVerlauf';
import { isMissingColumnError } from '@/lib/intakeCapture';
import { cn } from '@/lib/utils';
import { PauseJobDialog } from '@/components/client/job-manage/PauseJobDialog';
import { CloseJobDialog } from '@/components/client/job-manage/CloseJobDialog';
import { JobSearchersCard } from '@/components/client/searchers/JobSearchersCard';
import { DirectPositionBanner } from '@/components/client/searchers/DirectPositionBanner';
import { errorText, resumeJob } from '@/lib/jobSearch';
import { fmtDayMonth, fmtNumber } from '@/lib/localeFormat';
import { experienceBandLabel } from '@/lib/clientCandidateLabels';

interface JobSummary {
  key_facts: { icon: string; label: string; value: string }[];
  tasks_structured: { category: string; items: string[] }[];
  requirements_structured: {
    education: string[];
    experience: string[];
    tools: string[];
    soft_skills: string[];
    certifications: string[];
  };
  benefits_extracted: { icon: string; text: string }[];
  ai_insights: {
    role_type: string;
    ideal_profile: string;
    unique_selling_point: string;
    hiring_recommendation: string;
  };
  generated_at: string;
}

interface Job {
  id: string;
  title: string;
  company_name: string;
  briefing_notes?: string | null;
  rejection_reason?: string | null;
  location: string | null;
  remote_type: string | null;
  employment_type: string | null;
  experience_level: string | null;
  status: string | null;
  created_at: string;
  approved_at: string | null;
  salary_min: number | null;
  salary_max: number | null;
  description: string | null;
  requirements: string | null;
  fee_percentage: number | null;
  paused_at: string | null;
  pause_until?: string | null;
  pause_reason?: string | null;
  skills: string[] | null;
  must_haves: string[] | null;
  nice_to_haves: string[] | null;
  office_address: string | null;
  remote_policy: string | null;
  onsite_days_required: number | null;
  urgency: string | null;
  industry: string | null;
  job_summary: JobSummary | null;
  intake_completeness: number | null;
}

export default function ClientJobDetail() {
  const { id, tab } = useParams<{ id: string; tab?: string }>();
  const activeTab: JobTab = isJobTab(tab) ? tab : 'uebersicht';
  const navigate = useNavigate();
  // Dieselbe Aufnahme wie auf dem Dashboard; Schliessen fuehrt hierher zurueck.
  const openIntake = () => navigate(`/dashboard/aufnahme/${id}`, { state: { from: `/dashboard/jobs/${id}` } });
  const { user } = useAuth();
  const { t } = useTranslation();
  const { t: tj } = useTranslation('clientJobDetail');
  const { toast } = useToast();
  const {
    organization: myOrg,
    myRole: myOrgRole,
    isAdmin: isOrgAdmin,
    isLoading: orgLoading,
  } = useMyOrganization();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  // Bewerber-Daten kommen aus demselben Hook wie die Inbox — identische
  // Tab-Eimer (tabOf), identische Zustände (computeState), identische Codes.
  const {
    allItems: bewerberItems,
    tabCounts,
    isLoading: bewerberLoading,
    error: bewerberError,
    refetch: refetchBewerber,
  } = useBewerber({ tab: null, jobId: id ?? null, search: '', sort: 'newest' });

  // Interview-Agenda (zeit-basiert, reveal-sicher) — hier job-gefiltert.
  const { data: agendaData } = useClientInterviewAgenda();
  const clientTasks = useClientTasks();
  const [activeTask, setActiveTask] = useState<ClientTask | null>(null);
  const { t: tjobs } = useTranslation('clientJobs');
  const searchers = useJobSearchers(id ?? '');
  const [sheet, setSheet] = useState<'stelle' | 'hh' | 'beteiligt' | null>(null);
  const [changeOpen, setChangeOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  // Dialog states
  const [searchParams, setSearchParams] = useSearchParams();
  const [pauseOpen, setPauseOpen] = useState(searchParams.get('pausieren') === '1');
  const [closeOpen, setCloseOpen] = useState(searchParams.get('schliessen') === '1');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [decidingIntake, setDecidingIntake] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnNoteDraft, setReturnNoteDraft] = useState('');

  useEffect(() => {
    if (id && user) {
      fetchJobData();
    }
  }, [id, user]);

  const fetchJobData = async () => {
    try {
      // Kein client_id-Filter: RLS (can_access_job) erlaubt auch eingeladenen
      // Team-Mitgliedern (Admin/HR bzw. HM/Viewer als Job-Collaborator) den Zugriff —
      // ein harter Filter auf den Ersteller sperrte das gesamte Team aus.
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (jobError) throw jobError;
      if (!jobData) {
        toast({ title: t('jobdetail.not_found'), variant: 'destructive' });
        return;
      }

      setJob({
        ...jobData,
        job_summary: jobData.job_summary as unknown as JobSummary | null,
        intake_completeness: jobData.intake_completeness ?? null
      } as Job);

      // Bewerber-Daten laufen komplett über useBewerber (reveal-gated View,
      // team-scoped) — die Seite hält keine eigene Submissions-Kopie mehr.
    } catch (error) {
      console.error('Error fetching job data:', error);
      toast({ title: t('jobdetail.error_load'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Kandidaten-Entscheidungen (Interview, Ablehnung, Stage-Wechsel) passieren
  // bewusst NICHT auf dieser Seite: die früheren Inline-Dialoge schrieben am
  // Opt-In-Gate vorbei (Triple-Blind-Bypass). Alle Aktionen laufen über die
  // Bewerber-Inbox bzw. die Kandidaten-Detailseite mit den sicheren Flows.

  // Weitersuchen nach einer Pause: über die Datenbankfunktion (Rechte, Suchen der
  // Headhunter laufen weiter, alle werden informiert).
  const handleResume = async () => {
    if (!job) return;
    try {
      await resumeJob(job.id);
      toast({ title: t('jobdetail.toast.resumed') });
      fetchJobData();
    } catch (error) {
      toast({ title: errorText(error), variant: 'destructive' });
    }
  };

  const clearManageParam = () => {
    if (searchParams.get('pausieren') || searchParams.get('schliessen')) {
      const next = new URLSearchParams(searchParams);
      next.delete('pausieren');
      next.delete('schliessen');
      setSearchParams(next, { replace: true });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!job) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">{t('jobdetail.not_found')}</h2>
          <Button asChild className="mt-4">
            <Link to="/dashboard/jobs">{t('jobdetail.back')}</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  // ---- Lebenszyklus-Phase: Entwurf/Freigabe/Zurückgegeben bekommen ein
  // eigenes, ehrliches Layout statt des Aktiv-Cockpits. ---------------------
  const reviewRejectionReason =
    job.status === 'draft'
      ? job.rejection_reason ||
        (job.briefing_notes?.startsWith('[ABGELEHNT]')
          ? job.briefing_notes.split('\n')[0].replace('[ABGELEHNT]', '').trim()
          : null)
      : null;

  // Interne Rückgabe-Notiz (Team-Freigabe) — getrennt von der Matchunt-Ablehnung
  const clientReturnNote: string | null =
    job.status === 'draft'
      ? (((job as unknown as Record<string, unknown>).client_approval_note as string | null) ?? null)
      : null;

  const phase =
    job.status === 'draft' ? (reviewRejectionReason || clientReturnNote ? 'returned' : 'draft')
    : job.status === 'pending_approval' ? 'review'
    : job.status === 'pending_client_approval' ? 'client_approval'
    : 'live';

  if (phase !== 'live') {
    const raw = job as unknown as Record<string, any>;
    const reife: number = raw.intake_completeness ?? 0;
    const isFreelanceJob = job.employment_type === 'freelance';
    const missing: string[] = [];
    if (!isFreelanceJob && !job.salary_min && !job.salary_max) missing.push('Gehaltsband');
    if (!job.location && job.remote_type !== 'remote') missing.push('Standort');
    const canSubmit = missing.length === 0 && reife >= 30;

    const submitForReview = async () => {
      setSubmittingReview(true);
      // Hiring Manager + aktivierte interne Freigabe → erst zu Admin/HR
      const target = await resolveIntakeSubmitTarget(user!.id);
      let { error } = await supabase
        .from('jobs')
        .update({ status: target.status, rejection_reason: null, rejected_at: null, client_approval_note: null } as any)
        .eq('id', job.id);
      if (error && isMissingColumnError(error)) {
        ({ error } = await supabase.from('jobs').update({ status: 'pending_approval' }).eq('id', job.id));
      }
      setSubmittingReview(false);
      if (error) {
        toast({ title: tj('toast.submitError'), variant: 'destructive' });
        return;
      }
      if (target.status === 'pending_client_approval' && target.organizationId) {
        await notifyApproversOfIntake(target.organizationId, job.id, job.title, user?.id);
        toast({ title: tj('toast.submittedInternal') });
      } else {
        toast({ title: tj('toast.submitted') });
      }
      fetchJobData();
    };

    const withdraw = async () => {
      const { error } = await supabase.from('jobs').update({ status: 'draft' }).eq('id', job.id);
      if (!error) {
        toast({ title: tj('toast.withdrawn') });
        fetchJobData();
      }
    };

    // Interne Freigabe: Admin/HR geben frei (→ Matchunt) oder geben mit Kommentar zurück
    const canApproveIntake = ['owner', 'admin', 'hr'].includes(myOrgRole ?? '');
    const jobCreatorId = (job as unknown as { client_id: string }).client_id;

    const approveIntake = async () => {
      setDecidingIntake(true);
      const { error } = await supabase
        .from('jobs')
        .update({
          status: 'pending_approval',
          client_approved_by: user?.id ?? null,
          client_approved_at: new Date().toISOString(),
          client_approval_note: null,
        })
        .eq('id', job.id);
      setDecidingIntake(false);
      if (error) {
        toast({ title: tj('toast.approveError'), variant: 'destructive' });
        return;
      }
      if (jobCreatorId && jobCreatorId !== user?.id) {
        await notifyCreatorOfDecision(jobCreatorId, job.id, job.title, 'approved');
      }
      toast({ title: tj('toast.approved') });
      fetchJobData();
    };

    const returnIntake = async () => {
      if (!returnNoteDraft.trim()) return;
      setDecidingIntake(true);
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'draft', client_approval_note: returnNoteDraft.trim() })
        .eq('id', job.id);
      setDecidingIntake(false);
      if (error) {
        toast({ title: tj('toast.returnError'), variant: 'destructive' });
        return;
      }
      if (jobCreatorId && jobCreatorId !== user?.id) {
        await notifyCreatorOfDecision(jobCreatorId, job.id, job.title, 'returned', returnNoteDraft.trim());
      }
      setShowReturnDialog(false);
      setReturnNoteDraft('');
      toast({ title: tj('toast.returned') });
      fetchJobData();
    };

    // Derselbe Verlauf wie in Jobliste und Dashboard (lib/stellenVerlauf).
    // Entwuerfe haben keinen -- sie stehen noch in der Aufnahme.
    const verlauf = stellenVerlauf(raw as unknown as Parameters<typeof stellenVerlauf>[0]);
    const eingereichtAm = verlaufDatum(verlauf?.schritte[0]?.datum ?? null);
    const descriptor: string | null = raw.reveal_envelope?.descriptor ?? null;
    const ortZeile = [
      job.location,
      [job.remote_type ? t(`jobdetail.remote.${job.remote_type}`, { defaultValue: job.remote_type }) : null,
        job.onsite_days_required ? t('jobdetail.stelle.onsite_days', { count: job.onsite_days_required }) : null].filter(Boolean).join(', '),
    ].filter(Boolean).join(' · ');
    // Honorar nur für Owner/Admin/Finance (wie im Live-Cockpit).
    const darfHonorar = !orgLoading && (!myOrg || ['owner', 'admin', 'finance'].includes(myOrgRole ?? ''));
    // Contracting hat kein Paket. Eingereichte Contracting-Stellen trugen bis
    // 02.11.2026 trotzdem 'core' -- auch die zeigen hier nichts.
    const paketKey: string | undefined = job.employment_type === 'freelance' ? undefined : raw.intake_payload?.commercial?.package_key;
    const paketName = paketKey ? ({ core: 'Core', continuity_90: 'Continuity 90', continuity_180: 'Continuity 180' } as Record<string, string>)[paketKey] ?? paketKey : null;
    const paket = paketName
      ? darfHonorar && job.fee_percentage ? tj('draft.packageFee', { name: paketName, pct: job.fee_percentage }) : tj('draft.package', { name: paketName })
      : null;

    return (
      <DashboardLayout>
        <div className="mx-auto max-w-4xl space-y-4">
          <Link to="/dashboard/jobs" className="inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('jobdetail.back')}
          </Link>

          {phase === 'returned' && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {reviewRejectionReason ? tj('draft.returnedReview') : tj('draft.returnedTeam')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {tj('draft.reason', { reason: reviewRejectionReason || clientReturnNote })}
                </p>
              </div>
            </div>
          )}

          {/* Phasen-Hero; data-tour: Ziel des Kunden-Rundgangs bei einer Stelle in Prüfung (lib/clientGuide.ts) */}
          <div className="rounded-xl border bg-card p-5" data-tour="job.review">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold capitalize md:text-2xl">{job.title}</h1>
              {(phase === 'review' || phase === 'client_approval') && verlauf ? (
                <Badge variant="outline" className="gap-1 border-amber-500/40 text-xs text-amber-600">
                  <Clock className="h-3 w-3" /> {verlauf.kurz}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">{tj('draft.badge')}</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {phase === 'review' || phase === 'client_approval'
                ? [eingereichtAm ? tj('draft.submittedOn', { date: eingereichtAm }) : tj('draft.submitted'), ortZeile, paket].filter(Boolean).join(' · ')
                : `${tj('draft.lastEdited', { count: Math.max(0, Math.floor((Date.now() - new Date((raw.updated_at as string) || job.created_at).getTime()) / 86_400_000)) })}${job.location ? ` · ${job.location}` : ''}${job.remote_type ? ` · ${t(`jobdetail.remote.${job.remote_type === 'remote' || job.remote_type === 'onsite' ? job.remote_type : 'hybrid'}`)}` : ''}`}
            </p>

            {verlauf && <VerlaufLeiste verlauf={verlauf} className="mt-4" />}

            {/* In der Prüfung gibt es nichts zu tun: der Kunde will wissen, was jetzt
                passiert. Korrekturen laufen über die Rückgabe mit Hinweis (JobApprovalDialog). */}
            {phase === 'review' ? (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-sm leading-6">
                <Clock className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                <p>{tj('draft.reviewInfo')}</p>
              </div>
            ) : (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
              {phase === 'client_approval' ? (
                canApproveIntake ? (
                  <>
                    <Button variant="hero" size="sm" className="gap-1.5" onClick={approveIntake} disabled={decidingIntake}>
                      {decidingIntake ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      {tj('draft.approveSend')}
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowReturnDialog(true)} disabled={decidingIntake}>
                      <XCircle className="h-4 w-4" /> {tj('draft.returnWithComment')}
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-muted-foreground">
                      {tj('draft.approversNotified')}
                    </span>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={withdraw}>
                      <XCircle className="h-4 w-4" /> {tj('draft.withdraw')}
                    </Button>
                  </>
                )
              ) : (
                <>
                  {/* Eingereicht wird nur noch ueber die Aufnahme -- dort prueft sie, ob
                      das Profil ausgearbeitet ist. Vorher kam "Senior Hunter" mit
                      Briefing-Reife 0 durch (24.09.2026). */}
                  <Button variant="hero" size="sm" className="gap-1.5" onClick={openIntake}>
                    <Sparkles className="h-4 w-4" /> {tj('draft.continueIntake')}
                  </Button>
                </>
              )}
            </div>
            )}
          </div>

          {phase === 'review' && !orgLoading && (
            <JobPrepChecklist
              jobId={job.id}
              jobTitle={job.title}
              organizationId={myOrg?.id ?? null}
              userId={user?.id}
              canInvite={isOrgAdmin}
              isOwner={myOrgRole ? myOrgRole === 'owner' : true}
            />
          )}

          {/* Alles aus der Aufnahme. Die frühere Kachel „Briefing-Reife“ zeigte seit der
              gemeinsamen Aufnahme immer 0 (intake_completeness wird nicht mehr berechnet),
              die Recruiter-Vorschau las die alte Skill-Spalte must_haves. */}
          <JobSummary job={raw} />
          <HeadhunterVorschau descriptor={descriptor} vertraulich={Boolean(raw.confidential_search)} />

          {phase === 'review' && (
            <p className="text-sm text-muted-foreground">
              {tj('draft.supportHint')}{' '}
              <a className="text-primary hover:underline" href={`mailto:support@matchunt.ai?subject=${encodeURIComponent(`Stelle in Prüfung: ${job.title}`)}`}>
                {tj('draft.supportLink')}
              </a>
            </p>
          )}

          {/* Interne Rückgabe mit Kommentar (Team-Freigabe) */}
          <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{tj('returnDialog.title')}</DialogTitle>
                <DialogDescription>
                  {tj('returnDialog.description')}
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={returnNoteDraft}
                onChange={(e) => setReturnNoteDraft(e.target.value)}
                placeholder={tj('returnDialog.placeholder')}
                rows={4}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowReturnDialog(false)}>
                  {tj('returnDialog.cancel')}
                </Button>
                <Button onClick={returnIntake} disabled={!returnNoteDraft.trim() || decidingIntake}>
                  {decidingIntake && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {tj('returnDialog.submit')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    );
  }

  // ---- Live-Cockpit: Zustand, Diagnose und Funnel aus useBewerber ----------
  const jobState = computeJobState(job.status, job.paused_at);
  const isTerminal = job.status === 'closed' || job.status === 'filled';
  // Ehrliche Laufzeit: ab Freigabe (approved_at), nicht ab Entwurfs-Anlage.
  const liveSince = job.approved_at || job.created_at;
  const liveDays = Math.max(0, Math.floor((Date.now() - new Date(liveSince).getTime()) / 86_400_000));
  const liveVerlauf = stellenVerlauf(job as unknown as Parameters<typeof stellenVerlauf>[0], {
    kandidaten: bewerberItems.length,
    ersterKandidatAm: bewerberItems.map((i) => i.submittedAt).filter(Boolean).sort()[0] ?? null,
  });
  const hiredCount = bewerberItems.filter((i) => i.archiveKind === 'eingestellt').length;

  // Interview-Agenda auf diese Stelle gefiltert (inkl. fälliger Feedbacks)
  const jobAgenda = {
    feedbackDue: (agendaData?.feedbackDue || []).filter((iv) => iv.jobId === job.id),
    upcoming: (agendaData?.agendaDays || []).flatMap((d) => d.items).filter((iv) => iv.jobId === job.id),
    counterProposals: (agendaData?.counterProposals || []).filter((iv) => iv.jobId === job.id),
    awaitingCandidate: (agendaData?.awaitingCandidate || []).filter((iv) => iv.jobId === job.id),
  };

  const rawJob = job as unknown as Record<string, unknown>;
  const revealEnvelope = rawJob.reveal_envelope as { descriptor?: string | null } | null;
  const descriptor = revealEnvelope?.descriptor ?? null;
  // Fee nur für den Hauptaccount: Solo-Kunden (ohne Org) sowie Owner/Admin/Finance.
  // Erst nach geladener Org-Info entscheiden — sonst blitzt das Honorar für
  // HM/Viewer im Ladefenster auf. (Serverseitige Spaltenabsicherung: eigener Task.)
  const canSeeFee =
    !orgLoading && (!myOrg || ['owner', 'admin', 'finance'].includes(myOrgRole ?? ''));
  // Viewer sind lesend unterwegs: keine Verwaltungs-Aktionen anbieten.
  const isViewer = myOrgRole === 'viewer';
  // Pausieren/Schließen: Owner, Admin, HR (Kundenvertrag § 3 Abs. 2); ohne Organisation der Ersteller.
  const canManage = !myOrg || ['owner', 'admin', 'hr'].includes(myOrgRole ?? '');

  // Schlanker Verlauf aus vorhandenen Daten (echte Event-Tabelle: späteres Thema)
  const fmtVerlaufDatum = (iso: string) => fmtDayMonth(iso);
  const verlaufEvents: VerlaufEvent[] = [];
  if (job.approved_at) {
    verlaufEvents.push({ when: job.approved_at, text: t('jobdetail.verlauf.published') });
  }
  for (const item of bewerberItems) {
    verlaufEvents.push({
      when: item.submittedAt,
      text: t('jobdetail.verlauf.vorschlag', { name: item.anonymizedName }),
    });
  }
  for (const iv of (agendaData?.all || []).filter((x) => x.jobId === job.id)) {
    if (iv.scheduledAt) {
      verlaufEvents.push({
        when: iv.createdAt,
        text: t('jobdetail.verlauf.interview', {
          name: iv.candidateName,
          date: fmtVerlaufDatum(iv.scheduledAt),
        }),
      });
    }
  }
  if (job.paused_at) {
    verlaufEvents.push({ when: job.paused_at, text: t('jobdetail.verlauf.pausiert') });
  }
  if (typeof rawJob.closed_at === 'string') {
    verlaufEvents.push({ when: rawJob.closed_at, text: t('jobdetail.verlauf.geschlossen') });
  }
  verlaufEvents.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
  const verlaufShown = verlaufEvents.slice(0, 8);

  const fmtK = (n: number) => `${Math.round(n / 1000)}k`;
  const dayRate = job as unknown as { day_rate_min?: number | null; day_rate_max?: number | null };
  const dayRateLabel = dayRate.day_rate_min || dayRate.day_rate_max
    ? [dayRate.day_rate_min, dayRate.day_rate_max].filter((v): v is number => !!v)
        .map((v) => fmtNumber(v)).filter((v, i, a) => a.indexOf(v) === i).join('–')
    : null;
  const salaryLabel =
    job.salary_min && job.salary_max
      ? `€${fmtK(job.salary_min)} – €${fmtK(job.salary_max)}`
      : job.salary_min || job.salary_max
        ? `€${fmtK((job.salary_min || job.salary_max)!)}`
        : null;
  const metaLine = [
    job.company_name,
    [job.location, job.remote_type ? t(`jobdetail.remote.${job.remote_type}`, { defaultValue: job.remote_type }) : null]
      .filter(Boolean)
      .join(', '),
    job.employment_type
      ? t(`jobdetail.employment.${job.employment_type.replace(/_/g, '-')}`, { defaultValue: job.employment_type })
      : null,
    // Gehalt steht im Steckbrief darunter (K3), nicht doppelt in dieser Zeile.
    // Geschlossene/besetzte Stellen behaupten keine Live-Laufzeit mehr.
    isTerminal
      ? null
      : job.paused_at
        ? job.pause_until
          ? `${tj('live.pausedUntil', { date: fmtDayMonth(job.pause_until) })}${job.pause_reason ? ` · ${job.pause_reason}` : ''}`
          : t('jobdetail.meta.paused_since', {
              date: fmtDayMonth(job.paused_at),
            })
        : liveDays === 0
          ? t('jobdetail.meta.live_today')
          : liveDays === 1
            ? t('jobdetail.meta.live_since_one')
            : t('jobdetail.meta.live_since', { days: liveDays }),
  ]
    .filter(Boolean)
    .join(' · ');

  const agreementFacts = agreementFactsOf(rawJob, salaryLabel, tjobs);

  // Aufgaben dieser Stelle (dieselbe Liste wie Seite „Aufgaben“ und Kandidatenprofil).
  const jobTasks = (clientTasks.data?.tasks ?? []).filter((x) => x.jobId === job.id);
  const jobWaiting = (clientTasks.data?.waiting ?? []).filter((x) => x.jobId === job.id);
  const jobDone = (clientTasks.data?.done ?? []).filter((x) => x.jobId === job.id);
  const openQuestions = jobTasks.filter((x) => x.kind === 'recruiter_question');
  const openTask = (task: ClientTask) => (task.submissionId ? navigate(taskHref(task)) : setActiveTask(task));
  const isLiveJob = ['published', 'paused'].includes(job.status ?? '');
  const hasSearch = ['published', 'paused', 'closed', 'filled'].includes(job.status ?? '');
  const runState: JobRunState = isTerminal || !isLiveJob ? 'terminal' : job.paused_at ? 'paused' : 'active';
  const canRequest = !isViewer && !isTerminal;

  // Gewünschter Start aus der Aufnahme (Briefing-Antwort), falls kein Besetzungsdatum gesetzt ist.
  const startRaw = String(((rawJob.intake_payload as { briefing_answers?: { start?: { value?: unknown } } } | null)?.briefing_answers?.start?.value) ?? '').trim();
  const startLabel = startRaw ? (['asap', 'sofort'].includes(startRaw.toLowerCase()) ? tjobs(`summary.start.${startRaw.toLowerCase()}`) : startRaw) : null;
  const weekAgo = Date.now() - 7 * 86_400_000;
  const interviewsThisWeek = (agendaData?.all || []).filter((x) => x.jobId === job.id && x.scheduledAt && Date.parse(x.createdAt) >= weekAgo).length;

  // Daten für „Stand teilen“ (so anonym wie auf der Seite)
  // ---- Daten der Unterseiten
  const jobInterviews = (agendaData?.all || []).filter((x) => x.jobId === job.id);
  const upcomingCount = jobInterviews.filter((x) => x.scheduledAt && Date.parse(x.scheduledAt) >= Date.now()).length;
  const runningItems = bewerberItems.filter((x) => x.tab !== 'archiv');
  const allSearchers = searchers ?? [];
  const searchSentence = searchers === null ? null : [
    tjobs('market.begun', { count: allSearchers.length }),
    tjobs('market.delivered', { count: allSearchers.filter((x) => x.candidates > 0).length }),
    tjobs('market.ended', { count: allSearchers.filter((x) => x.status === 'ended').length }),
  ].join(' · ');
  const budgetLabel = job.employment_type === 'freelance' ? (dayRateLabel ? tjobs('cockpit.facts.dayRate', { rate: dayRateLabel }) : null) : salaryLabel;
  const costLine = costLineOf({
    freelance: job.employment_type === 'freelance',
    dayMin: dayRate.day_rate_min, dayMax: dayRate.day_rate_max,
    daysPerWeek: (rawJob.utilization_days_per_week as number | null) ?? null,
    feePct: job.fee_percentage, salaryMin: job.salary_min, salaryMax: job.salary_max,
  }, tjobs);
  const historyEvents: HistoryEvent[] = [];
  if (job.approved_at) historyEvents.push({ when: job.approved_at, kind: 'stelle', text: tjobs('team.ev.published'), who: 'Matchunt' });
  if (job.paused_at) historyEvents.push({ when: job.paused_at, kind: 'stelle', text: tjobs('team.ev.paused') });
  if (typeof rawJob.closed_at === 'string') historyEvents.push({ when: rawJob.closed_at, kind: 'stelle', text: tjobs('team.ev.closed') });
  for (const sx of allSearchers) {
    if (sx.started_at) historyEvents.push({ when: sx.started_at, kind: 'stelle', text: tjobs('team.ev.started', { name: sx.full_name ?? '' }) });
    if (sx.ended_at) historyEvents.push({ when: sx.ended_at, kind: 'stelle', text: tjobs('team.ev.ended', { name: sx.full_name ?? '' }) });
  }
  for (const it of bewerberItems) {
    const nm = it.fullName || it.anonymizedName;
    if (it.submittedAt) historyEvents.push({ when: it.submittedAt, kind: 'kandidaten', text: tjobs('team.ev.proposed', { name: nm }) });
    if (it.requestedAt) historyEvents.push({ when: it.requestedAt, kind: 'interviews', text: tjobs('team.ev.requested', { name: nm }) });
    if (it.rejectedAt) historyEvents.push({ when: it.rejectedAt, kind: 'kandidaten', text: it.rejectReason ? tjobs('team.ev.rejectedReason', { name: nm, reason: t(`clientCandidates:rejection.reasons.${it.rejectReason}`, { defaultValue: it.rejectReason }) }) : tjobs('team.ev.rejected', { name: nm }) });
  }
  for (const iv of jobInterviews) {
    if (iv.scheduledAt && Date.parse(iv.scheduledAt) <= Date.now()) historyEvents.push({ when: iv.scheduledAt, kind: 'interviews', text: tjobs('team.ev.interview', { name: iv.candidateName }) });
  }
  for (const d of jobDone) {
    if (d.kind === 'recruiter_question') historyEvents.push({ when: d.doneAt, kind: 'stelle', text: tjobs('team.ev.answered', { question: d.label }) });
  }
  historyEvents.sort((a, b) => Date.parse(b.when) - Date.parse(a.when));

  const headSkills = [...new Set([...(job.must_haves ?? []), ...(job.skills ?? [])].map((x) => x.trim()).filter(Boolean))].slice(0, 8);

  const shareData: ShareData = {
    title: job.title,
    meta: metaLine,
    statusLine: [
      tjobs('cockpit.status.live', { count: liveDays }),
      tjobs('cockpit.status.searchersLine', { count: (searchers ?? []).filter((x) => x.status !== 'ended').length }),
    ].join(' · '),
    steps: [
      [tjobs('cockpit.status.steps.proposals'), bewerberItems.length],
      [tjobs('cockpit.status.steps.interview'), tabCounts.interview],
      [tjobs('cockpit.status.steps.offer'), tabCounts.angebot],
      [tjobs('cockpit.status.steps.hired'), hiredCount],
    ],
    finalists: bewerberItems.filter((x) => x.tab === 'interview' || x.tab === 'angebot').slice(0, 3).map((x) => ({
      name: x.fullName || x.anonymizedName,
      facts: [x.currentRole, x.experienceBand !== 'Nicht angegeben' ? experienceBandLabel(x.experienceBand) : '', x.salaryBand].filter(Boolean).join(' · '),
    })),
    appointments: [...jobAgenda.upcoming].slice(0, 3).map((iv) => `${iv.scheduledAt ? fmtDayMonth(iv.scheduledAt) : ''} · ${iv.candidateName ?? ''}`.trim()),
    facts: agreementFacts,
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-4">
        <Link
          to="/dashboard/jobs"
          className="inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('jobdetail.back')}
        </Link>

        {/* Kopf: Titel, Status als Auswahl, Stand teilen, ⋯. Bearbeitet wird nach dem Livegang nicht mehr. */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 basis-72">
              <h1 className="text-xl font-bold md:text-2xl">{job.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{metaLine}</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <JobStatusMenu
                state={runState}
                stateLabel={t(`jobdetail.state.${jobState.key}`)}
                canManage={canManage && !isViewer}
                onPause={() => setPauseOpen(true)}
                onResume={handleResume}
                onClose={() => setCloseOpen(true)}
              />
              {!isViewer && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShareOpen(true)}>
                  <FileDown className="h-3.5 w-3.5" />{tjobs('cockpit.share.button')}
                </Button>
              )}
              <JobMoreMenu canRequest={canRequest} onRequestChange={() => setChangeOpen(true)} onHistory={() => navigate(`/dashboard/jobs/${job.id}/team`)} />
            </div>
          </div>
          <JobFactsLine facts={agreementFacts} startLabel={startLabel} skills={headSkills} />
          {hasSearch && <SearcherLine searchers={searchers} onDetails={() => setSheet('beteiligt')} />}
          {!bewerberLoading && !bewerberError && liveVerlauf?.aktuell && (
            <VerlaufLeiste verlauf={liveVerlauf} className="mt-4" />
          )}
          {bewerberError && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-destructive/10 px-4 py-3">
              <p className="text-sm font-medium text-destructive">{t('jobdetail.bewerber_error')}</p>
              <Button size="sm" variant="outline" onClick={() => refetchBewerber()}>
                {t('bewerber.error.retry')}
              </Button>
            </div>
          )}
          <JobTabsBar
            jobId={job.id}
            active={activeTab}
            counts={{ kandidaten: runningItems.length, interviews: upcomingCount }}
            dots={{
              kandidaten: jobTasks.some((x) => !!x.submissionId),
              interviews: jobAgenda.feedbackDue.length > 0,
              markt: openQuestions.length > 0,
            }}
          />
        </div>

        {activeTab === 'uebersicht' && (
          <>
        {/* Rückfrage „Stelle schon direkt vergeben?“ (Bestandskunde eines Headhunters) */}
        <DirectPositionBanner jobId={job.id} jobTitle={job.title} canAnswer={canManage} />

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          {/* Links: was Sie tun */}
          <div className="space-y-4">
            {bewerberLoading ? (
              <Skeleton className="h-48 w-full rounded-xl" />
            ) : !bewerberError ? (
              <ForYouCard
                tasks={isViewer ? [] : jobTasks}
                waiting={jobWaiting}
                items={bewerberItems}
                loading={!isViewer && clientTasks.isLoading}
                onOpen={openTask}
              />
            ) : null}
            {!bewerberLoading && !bewerberError && <FinalistsCard items={bewerberItems} />}
            <JobTermineCard agenda={jobAgenda} empty={isTerminal ? undefined : { title: tjobs('cockpit.dates.emptyTitle'), text: tjobs('cockpit.dates.emptyText') }} />
            {!bewerberLoading && !bewerberError && <OthersCard tasks={jobTasks} waiting={jobWaiting} items={bewerberItems} />}
          </div>

          {/* Rechts: wie die Suche läuft und was Sie steuern */}
          <div className="space-y-4">
            {hasSearch && (
              <SearchStatusCard
                liveDays={liveDays}
                searchers={searchers}
                items={bewerberItems}
                tabCounts={tabCounts}
                hiredCount={hiredCount}
                isPaused={!!job.paused_at}
                isTerminal={isTerminal}
              />
            )}
            {!isViewer && !isTerminal && (
              <SpeedCard
                openQuestions={openQuestions}
                items={bewerberItems}
                onAnswer={openTask}
                onRequestChange={() => setChangeOpen(true)}
                canRequest={canRequest}
              />
            )}
            <AgreementCard
              facts={[]}
              onDetails={() => setSheet('stelle')}
              onHeadhunterView={() => setSheet('hh')}
              onRequestChange={() => setChangeOpen(true)}
              canRequest={canRequest}
            />
            <AnsweredQuestionsCard done={jobDone} />
          </div>
        </div>
          </>
        )}

        {activeTab === 'kandidaten' && (
          bewerberLoading ? <Skeleton className="h-64 w-full rounded-xl" /> : (
            <CandidatesTab items={bewerberItems} tasks={isViewer ? [] : jobTasks} jobId={job.id} onOpen={openTask} />
          )
        )}
        {activeTab === 'interviews' && (
          <InterviewsTab interviews={jobInterviews} feedbackDue={jobAgenda.feedbackDue} />
        )}
        {activeTab === 'markt' && (
          <MarketTab
            searchersNode={hasSearch ? <JobSearchersCard key={`${job.paused_at ?? 'live'}-${job.status}`} jobId={job.id} jobTitle={job.title} closed={isTerminal} /> : null}
            searchSentence={searchSentence}
            items={bewerberItems}
            budgetLabel={budgetLabel}
            openQuestions={isViewer ? [] : openQuestions}
            done={jobDone}
            onAnswer={openTask}
            previewNode={<HeadhunterVorschau descriptor={descriptor} vertraulich={Boolean(rawJob.confidential_search)} />}
            onRequestChange={() => setChangeOpen(true)}
            canRequest={canRequest}
          />
        )}
        {activeTab === 'vertrag' && (
          <ContractTab
            facts={agreementFacts.filter(([label]) => label !== tjobs('cockpit.facts.budget') && label !== tjobs('cockpit.facts.salary'))}
            konditionenNode={
              <JobKonditionen
                salaryLabel={salaryLabel}
                feePercentage={job.fee_percentage}
                canSeeFee={canSeeFee}
                descriptor={descriptor}
                contracting={job.employment_type === 'freelance' ? { budget: dayRateLabel } : null}
              />
            }
            canSeeFee={canSeeFee}
            costLine={costLine}
            offers={bewerberItems.filter((x) => x.tab === 'angebot' || x.archiveKind === 'eingestellt')}
            onRequestChange={() => setChangeOpen(true)}
            canRequest={canRequest}
          />
        )}
        {activeTab === 'auswertung' && (
          <JobsAnalytics
            single
            title={job.title}
            items={bewerberItems}
            jobs={[{ id: job.id, title: job.title, status: job.status, approved_at: job.approved_at, created_at: job.created_at, closed_at: (rawJob.closed_at as string | null) ?? null }]}
          />
        )}
        {activeTab === 'team' && (
          <TeamTab
            teamNode={myOrg ? (
              <SectionCard title={t('jobdetail.sections.team')}>
                <JobTeam organizationId={myOrg.id} jobId={job.id} jobTitle={job.title} isOrgAdmin={isOrgAdmin} />
              </SectionCard>
            ) : null}
            events={historyEvents}
            summaryNode={
              <SectionCard title={t('jobdetail.sections.stelle')}>
                <JobSummary job={rawJob} ohneRahmen schmal />
              </SectionCard>
            }
          />
        )}
      </div>

      {/* Seltenes in Seitenfenstern */}
      <DetailSheet open={sheet === 'stelle'} onOpenChange={(o) => !o && setSheet(null)} title={t('jobdetail.sections.stelle')}>
        <JobSummary job={rawJob} ohneRahmen />
        <div className="rounded-xl border p-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{t('jobdetail.sections.konditionen')}</p>
          <JobKonditionen
            salaryLabel={salaryLabel}
            feePercentage={job.fee_percentage}
            canSeeFee={canSeeFee}
            descriptor={descriptor}
            contracting={job.employment_type === 'freelance' ? { budget: dayRateLabel } : null}
          />
        </div>
      </DetailSheet>
      <DetailSheet open={sheet === 'hh'} onOpenChange={(o) => !o && setSheet(null)} title={tjobs('cockpit.agreement.hhView')} description={tjobs('cockpit.agreement.hhViewText')}>
        <HeadhunterVorschau descriptor={descriptor} vertraulich={Boolean(rawJob.confidential_search)} />
        <JobSummary job={rawJob} ohneRahmen />
      </DetailSheet>
      <DetailSheet open={sheet === 'beteiligt'} onOpenChange={(o) => !o && setSheet(null)} title={tjobs('cockpit.involved.title')}>
        {hasSearch && <JobSearchersCard key={`${job.paused_at ?? 'live'}-${job.status}`} jobId={job.id} jobTitle={job.title} closed={isTerminal} />}
        {myOrg && (
          <div className="rounded-xl border p-4">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{t('jobdetail.sections.team')}</p>
            <JobTeam organizationId={myOrg.id} jobId={job.id} jobTitle={job.title} isOrgAdmin={isOrgAdmin} />
          </div>
        )}
      </DetailSheet>

      <ChangeRequestDialog jobId={job.id} open={changeOpen} onOpenChange={setChangeOpen} />
      <ShareStatusDialog open={shareOpen} onOpenChange={setShareOpen} data={shareData} />
      <ClientTaskWindow task={activeTask} open={!!activeTask} onOpenChange={(o) => { if (!o) { setActiveTask(null); void clientTasks.refetch(); } }} handlers={null} />

      <PauseJobDialog
        open={pauseOpen}
        onOpenChange={(o) => { setPauseOpen(o); if (!o) clearManageParam(); }}
        jobId={job.id}
        jobTitle={job.title}
        onDone={fetchJobData}
      />
      <CloseJobDialog
        open={closeOpen}
        onOpenChange={(o) => { setCloseOpen(o); if (!o) clearManageParam(); }}
        jobId={job.id}
        jobTitle={job.title}
        candidates={bewerberItems
          .filter((i) => i.archiveKind !== 'abgelehnt')
          .map((i) => ({ submissionId: i.submissionId, label: `${i.fullName || i.anonymizedName}${i.currentRole ? ` · ${i.currentRole}` : ''}` }))}
        onClosed={fetchJobData}
        onPauseInstead={() => setPauseOpen(true)}
      />
    </DashboardLayout>
  );
}
