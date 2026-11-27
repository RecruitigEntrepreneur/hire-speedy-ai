import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { fetchRecruiterPlacements } from '@/lib/placementViews';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CalendarConnectCard } from '@/components/interview/calendar/CalendarConnectCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LigaDashboardCard } from '@/components/recruiter/liga/LigaDashboardCard';
import { LigaAwardDialog } from '@/components/recruiter/liga/LigaAwardDialog';
import {
  Briefcase,
  Loader2,
  CheckCircle,
  Phone,
  Check,
  Video,
  CalendarDays,
  CheckSquare,
  Compass,
  Euro,
  FileText,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatAnonymousCompany } from '@/lib/anonymousCompanyFormat';
import { formatHeadcount } from '@/lib/companyLogo';
import { FirmenLogo } from '@/components/company/FirmenLogo';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { usePageViewTracking } from '@/hooks/useEventTracking';
import { RecruiterStartChecklist } from '@/components/recruiter/RecruiterStartChecklist';
import { PendingButton, RecruiterWaitingBanner, pendingText } from '@/components/recruiter/RecruiterWaiting';
import { useRecruiterPending } from '@/components/verification/RecruiterAccessGate';
import { useMinutenTakt, useUnifiedTaskInbox, type UnifiedTaskItem } from '@/hooks/useUnifiedTaskInbox';
import { buildGuide, prepTexts } from '@/components/recruiter/tasks/taskWindow';
import { dfLocale, loc } from '@/components/recruiter/tasks/sprache';
import { dashboardRows, rowItem, splitJetzt, type JetztRow } from '@/components/recruiter/tasks/jetztRows';
import { useRecruiterInterviewAgenda } from '@/hooks/useRecruiterInterviewAgenda';
import { useRecruiterAnalytics } from '@/hooks/useRecruiterAnalytics';
import { useActivityLogger } from '@/hooks/useCandidateActivityLog';
import { HubSpotImportDialog } from '@/components/candidates/HubSpotImportDialog';
import { CvUploadDialog } from '@/components/candidates/CvUploadDialog';
import { KandidatAnlegenMenu } from '@/components/candidates/KandidatAnlegenMenu';
import { LebenslaufAblage } from '@/components/candidates/LebenslaufAblage';
import { ablageAnfragen, ablageMelden, lebenslaufWaehlen } from '@/lib/lebenslaufAblage';
import { KandidatKurzDialog } from '@/components/candidates/KandidatKurzDialog';
import { PerMailWeiterleitenDialog } from '@/components/candidates/PerMailWeiterleitenDialog';
import { useRecruiterGuide } from '@/components/recruiter/guide/RecruiterGuide';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, isToday, isTomorrow } from 'date-fns';
import { isMissingColumnError } from '@/lib/intakeCapture';
import { istContracting, verdienstJeTag } from '@/lib/recruiterContracting';
import { KachelReiter } from '@/components/dashboard/bento/KachelTeile';
import { Honorar } from '@/components/recruiter/Honorar';
import { GeldZeilen } from '@/components/recruiter/verdienste/ErhaltenKachel';
import { KonditionenHinweis } from '@/components/recruiter/verdienste/KonditionenHinweis';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardStats {
  openJobs: number;
  myCandidates: number;
  activeSubmissions: number;
  earnings: number;
  pipelineBestCase: number;
  pipelineRealCase: number;
  pipelineWorstCase: number;
}

interface PipelineStage {
  /** Anzeige über pipeline.stages.<key> */
  key: 'submitted' | 'in_review' | 'interview' | 'offer';
  statuses: string[];
  color: string;
  count: number;
}

interface UpcomingInterview {
  date: string;
  candidateName: string;
  candidateId: string;
  jobTitle: string;
  companyInfo: string;
  isRevealed: boolean;
  confirmed: boolean;
  submissionId: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const greetingKey = (): 'morning' | 'day' | 'evening' => {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'day';
  return 'evening';
};

const getFirstName = (user: any): string => {
  const fullName = user?.user_metadata?.full_name || user?.email || '';
  if (fullName.includes('@')) return fullName.split('@')[0];
  return fullName.split(' ')[0] || '';
};

const formatEuro = (amount: number): string => {
  return `${Math.round(amount).toLocaleString(loc())} €`;
};

const formatEuroFull = (amount: number): string => {
  return `${Math.round(amount).toLocaleString(loc())} €`;
};

const calculatePotentialEarning = (
  salaryMin: number | null,
  salaryMax: number | null,
  feePercentage: number | null
): number | null => {
  if (!feePercentage || (!salaryMin && !salaryMax)) return null;
  const avgSalary = salaryMin && salaryMax
    ? (salaryMin + salaryMax) / 2
    : salaryMin || salaryMax;
  if (!avgSalary) return null;
  return Math.round(avgSalary * (feePercentage / 100));
};

type T = (key: string, options?: Record<string, unknown>) => string;
// ─── Main Component ──────────────────────────────────────────────────────────

export default function RecruiterDashboard() {
  // recruiterTasks: Pillen und Kurzzeilen der Aufgaben (buildGuide, prepTexts)
  const { t, i18n } = useTranslation(['recruiterDashboard', 'recruiterTasks']);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    openJobs: 0,
    myCandidates: 0,
    activeSubmissions: 0,
    earnings: 0,
    pipelineBestCase: 0,
    pipelineRealCase: 0,
    pipelineWorstCase: 0,
  });
  const [loading, setLoading] = useState(true);
  // Begleiteter Rundgang: startet beim ersten Besuch von selbst, oben im Kopf jederzeit neu.
  const guide = useRecruiterGuide();
  const pending = useRecruiterPending();
  useEffect(() => { if (!loading) guide.offer(); }, [loading, guide]);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [hubspotDialogOpen, setHubspotDialogOpen] = useState(false);
  const [cvUploadDialogOpen, setCvUploadDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  // „Kandidaten anlegen“: Text-Einfügen öffnet den Import mit offenem Textfeld, „Ohne Lebenslauf“ die kurze Maske.
  const [cvStartText, setCvStartText] = useState(false);
  const [kurzOpen, setKurzOpen] = useState(false);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [revealedJobIds, setRevealedJobIds] = useState<Set<string>>(new Set());

  // Gleiche Quelle wie /recruiter/influence: Alerts + manuelle + abgeleitete Aufgaben
  const { allItems: taskItems, prepCount, markDone: taskMarkDone } = useUnifiedTaskInbox();
  const takt = useMinutenTakt(taskItems.some(i => i.prep?.art === 'termin'));
  const { data: interviewAgenda } = useRecruiterInterviewAgenda();
  const { logActivity } = useActivityLogger();

  // Reiter wie auf dem Kunden-Dashboard (23.11.2026): ein Reiter erscheint nur, wenn es dafür etwas gibt
  const [stellenTab, setStellenTab] = useState<'all' | 'perm' | 'freelance'>('all');
  const [terminTab, setTerminTab] = useState<'all' | 'today'>('all');
  const stellenContracting = useMemo(() => recentJobs.filter(j => istContracting(j)), [recentJobs]);
  const stellenFest = useMemo(() => recentJobs.filter(j => !istContracting(j)), [recentJobs]);
  const stellenAktiv = stellenTab === 'freelance' && stellenContracting.length ? 'freelance' : stellenTab === 'perm' && stellenContracting.length ? 'perm' : 'all';
  const stellenSicht = (stellenAktiv === 'freelance' ? stellenContracting : stellenAktiv === 'perm' ? stellenFest : recentJobs).slice(0, 4);

  // Quote am Fuß der Interview-Karte: dieselbe Rechnung wie die Seite „Auswertung“, über 12 Monate
  const { analytics: jahr } = useRecruiterAnalytics('365');

  // Anstehende Interviews aus der reveal-sicheren Agenda (inkl. unbestätigter Termine)
  const upcomingInterviews: UpcomingInterview[] = useMemo(() => {
    if (!interviewAgenda) return [];
    return interviewAgenda.agendaDays
      .flatMap(d => d.items)
      .slice(0, 4)
      .map(iv => ({
        date: iv.scheduledAt!,
        candidateName: iv.candidateName,
        candidateId: iv.candidateId || '',
        jobTitle: iv.jobTitle,
        companyInfo: iv.companyLabel,
        isRevealed: iv.companyRevealed,
        confirmed: iv.confirmed,
        submissionId: iv.submissionId,
      }));
  }, [interviewAgenda]);
  const termineHeute = useMemo(() => upcomingInterviews.filter(iv => isToday(new Date(iv.date))), [upcomingInterviews]);
  const terminAktiv = terminTab === 'today' && termineHeute.length ? 'today' : 'all';

  usePageViewTracking('recruiter_dashboard');

  // ─── Data Fetching ──────────────────────────────────────────────────────

  useEffect(() => {
    if (user) {
      fetchDashboardData();
      fetchPipelineData();
      fetchRevealedJobs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);


  // Opt-In-Aufgaben entstehen jetzt im Inbox-Hook aus dem Zustand (stage =
  // interview_requested); das Dashboard schreibt keine Alerts mehr.

  const fetchRevealedJobs = async () => {
    if (!user) return;
    try {
      // Kein Join auf jobs mehr: den Firmennamen liefert recruiter_jobs_view
      // selbst — und zwar nur dann, wenn dieser Recruiter den Reveal hat.
      const { data, error } = await supabase
        .from('submissions')
        .select('job_id')
        .eq('recruiter_id', user.id)
        .eq('company_revealed', true);

      if (!error && data) {
        setRevealedJobIds(new Set(data.map(s => s.job_id)));
      }
    } catch (error) {
      console.error('Error fetching revealed jobs:', error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const basis = 'id, title, company_name, industry, company_size_band, funding_stage, tech_environment, location, salary_min, salary_max, remote_type, recruiter_fee_percentage, hiring_urgency, created_at';
      const neueJobs = (spalten: string) => supabase
        .from('recruiter_jobs_view')
        .select(spalten)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(40);
      // Contracting: Verdienst je Einsatztag (Migration 20260929100000). Vor
      // deren Ausrollen fehlen die Spalten -- dann wie bisher ohne.
      // Firmenlogo nach dem Reveal (Migration 20261019170000) -- vorher ohne.
      const contracting = `${basis}, employment_type, recruiter_day_earning_min, recruiter_day_earning_max`;
      let { data: jobs, error: jobsError } = await neueJobs(`${contracting}, company_logo_url`);
      if (jobsError && isMissingColumnError(jobsError)) ({ data: jobs, error: jobsError } = await neueJobs(contracting));
      if (jobsError && isMissingColumnError(jobsError)) ({ data: jobs, error: jobsError } = await neueJobs(basis));

      if (!jobsError && jobs) {
        setRecentJobs(jobs);

        const { count: totalJobsCount } = await supabase
          .from('recruiter_jobs_view')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'published');

        setStats(prev => ({ ...prev, openJobs: totalJobsCount || 0 }));

        // Kein company_profiles-Fetch mehr: recruiter_jobs_view liefert bewusst
        // keine client_id, und company_profiles ist fuer Recruiter per RLS
        // gesperrt (der Aufruf lieferte immer 0 Zeilen).
      }

      const { count: candidatesCount } = await supabase
        .from('candidates')
        .select('*', { count: 'exact', head: true })
        .eq('recruiter_id', user?.id);

      if (candidatesCount !== null) {
        setStats(prev => ({ ...prev, myCandidates: candidatesCount }));
      }

      // Eigener Anteil aus der abgesicherten Ansicht (Paket 4a)
      const placements = await fetchRecruiterPlacements();

      if (placements) {
        const totalEarnings = placements.reduce((sum, p) => sum + (p.recruiter_payout || 0), 0);
        setStats(prev => ({ ...prev, earnings: totalEarnings }));
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPipelineData = async () => {
    if (!user) return;
    try {
      const { data: submissions } = await supabase
        .from('submissions')
        .select('id, status, job_id')
        .eq('recruiter_id', user.id)
        .not('status', 'in', '("rejected","withdrawn","hired","client_rejected")');

      if (!submissions) return;

      // Gehalts-/Fee-Daten separat: Recruiter lesen Jobs nur ueber
      // recruiter_jobs_view.
      const pipelineJobIds = [...new Set(submissions.map((s: any) => s.job_id).filter(Boolean))] as string[];
      let pipelineJobsById: Record<string, any> = {};
      if (pipelineJobIds.length > 0) {
        const { data: jobRows } = await supabase
          .from('recruiter_jobs_view')
          .select('id, salary_min, salary_max, recruiter_fee_percentage')
          .in('id', pipelineJobIds);
        pipelineJobsById = Object.fromEntries((jobRows || []).map((j: any) => [j.id, j]));
      }
      submissions.forEach((s: any) => { s.jobs = pipelineJobsById[s.job_id] ?? null; });

      const stages: PipelineStage[] = [
        { key: 'submitted', statuses: ['submitted', 'pending'], color: 'bg-foreground/75', count: 0 },
        { key: 'in_review', statuses: ['in_review'], color: 'bg-foreground/75', count: 0 },
        { key: 'interview', statuses: ['interview'], color: 'bg-foreground/75', count: 0 },
        { key: 'offer', statuses: ['offer'], color: 'bg-foreground/75', count: 0 },
      ];

      // Conversion probabilities per stage (industry averages)
      const stageWeights: Record<string, number> = {
        submitted: 0.10,  // 10% of submitted candidates get placed
        pending: 0.10,
        in_review: 0.20,  // 20% of reviewed get placed
        interview: 0.40,  // 40% of interviewed get placed
        offer: 0.75,      // 75% of offers convert
      };

      let bestCase = 0;
      let realCase = 0;
      let worstCase = 0;

      submissions.forEach(s => {
        const stage = stages.find(st => st.statuses.includes(s.status));
        if (stage) stage.count++;

        const job = (s as any).jobs;
        if (job) {
          const earning = calculatePotentialEarning(job.salary_min, job.salary_max, job.recruiter_fee_percentage);
          if (earning) {
            bestCase += earning;
            realCase += Math.round(earning * (stageWeights[s.status] || 0.10));
            // Worst case: only count offers
            if (s.status === 'offer') {
              worstCase += Math.round(earning * 0.50);
            }
          }
        }
      });

      setPipelineStages(stages);
      setStats(prev => ({
        ...prev,
        activeSubmissions: submissions.length,
        pipelineBestCase: bestCase,
        pipelineRealCase: realCase,
        pipelineWorstCase: worstCase,
      }));
    } catch (error) {
      console.error('Error fetching pipeline data:', error);
    }
  };

  // ─── Actions ────────────────────────────────────────────────────────────

  const handleMarkDone = async (item: UnifiedTaskItem) => {
    const { error } = await taskMarkDone(item.itemType, item.itemId);
    if (error) {
      toast.error(t('toast.markDoneFailed'));
      return;
    }

    if (item.candidateId) {
      await logActivity(
        item.candidateId,
        'alert_actioned',
        // Titel im Aktivitätslog: gespeichert, bleibt deutsch
        `Aufgabe erledigt: ${item.title}`,
        item.description || undefined,
        { item_type: item.itemType, task_category: item.taskCategory, priority: item.priority },
        item.submissionId || undefined,
        item.itemType === 'alert' ? item.itemId : undefined
      );
    }

    toast.success(
      item.itemType === 'derived'
        ? t('toast.doneDerived')
        : t('toast.done')
    );
  };

  const handleViewTask = (row: JetztRow) => {
    const item = rowItem(row);
    // „Kunde prüft“ je Stelle: das Stellen-Fenster auf der Seite „Aufgaben“
    if (row.kind === 'bundle') {
      navigate(`/recruiter/influence?item=${encodeURIComponent(item.itemId)}`);
      return;
    }
    // Ins Kandidatenprofil, dort öffnet sich die Aufgabe (14.10.2026), auch das
    // Nachgespräch (20.10.2026, vorher Sprung auf die Interview-Seite). Ohne Kandidat: „Aufgaben“.
    if (item.candidateId) {
      navigate(`/recruiter/candidates/${item.candidateId}?aufgabe=${encodeURIComponent(item.itemId)}`);
      return;
    }
    navigate(`/recruiter/influence?item=${encodeURIComponent(item.itemId)}`);
  };

  // ─── Derived Data ───────────────────────────────────────────────────────

  // Dieselben Zeilen und dieselbe Zahl wie „Jetzt“ auf der Seite „Aufgaben“ (20.10.2026).
  // Deals ohne Bewegung und Opt-Ins unter 24 Stunden stehen dort unten bzw. unter „Wartet“.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const jetztRows = useMemo(() => splitJetzt(taskItems).rows, [taskItems, takt]);
  const topRows = useMemo(() => dashboardRows(jetztRows), [jetztRows]);
  const urgentCount = useMemo(() => jetztRows.filter(r => r.critical).length, [jetztRows]);
  const totalPendingAlerts = jetztRows.length;

  // Neu dabei: noch keine Kandidaten und keine laufende Vorstellung. „Alles erledigt“ wäre dann irreführend.
  const isNewcomer = stats.myCandidates === 0 && stats.activeSubmissions === 0;

  const greetingSubtext = useMemo(() => {
    const nextInterview = upcomingInterviews[0];
    const nextDate = nextInterview ? new Date(nextInterview.date) : null;
    const interviewToday = nextDate && isToday(nextDate);
    const interviewTomorrow = nextDate && isTomorrow(nextDate);
    const timeStr = nextDate ? format(nextDate, 'HH:mm') : '';

    // Urgent tasks + interview today
    if (urgentCount > 0 && interviewToday) {
      return t('subtext.urgentInterviewToday', { count: urgentCount, time: timeStr });
    }
    // Urgent tasks + interview tomorrow
    if (urgentCount > 0 && interviewTomorrow) {
      return t('subtext.urgentInterviewTomorrow', { count: urgentCount });
    }
    // Urgent tasks, no interview soon
    if (urgentCount > 0) {
      return prepCount > 0
        ? t('subtext.urgentWithPrep', { count: urgentCount, candidates: t('subtext.candidates', { count: prepCount }) })
        : t('subtext.urgent', { count: urgentCount });
    }
    // No urgent, but interview today
    if (interviewToday && nextInterview) {
      return t('subtext.interviewToday', { time: timeStr, name: nextInterview.candidateName });
    }
    // No urgent, interview tomorrow
    if (interviewTomorrow) {
      return t('subtext.interviewTomorrow');
    }
    // No urgent, interviews this week
    if (upcomingInterviews.length > 0) {
      return t('subtext.interviewsWeek', { count: upcomingInterviews.length });
    }
    // No interviews, tasks pending → konkrete Top-Aufgabe nennen
    if (totalPendingAlerts > 0) {
      const top = topRows[0];
      if (top?.kind === 'person') {
        return t('subtext.tasksTop', { count: totalPendingAlerts, name: top.group.name, pill: buildGuide(top.group.primary).pill });
      }
      return t('subtext.tasks', { count: totalPendingAlerts });
    }
    if (isNewcomer) return t('subtext.newcomer');
    // All clear
    return t('subtext.allDone');
  }, [urgentCount, prepCount, upcomingInterviews, totalPendingAlerts, topRows, isNewcomer, t, i18n.language]);

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-5xl">
        <RecruiterWaitingBanner />
        <RecruiterStartChecklist />

        {/* ═══ HEADER ═══ Lebenslauf hineinziehen (05.11.2026) */}
        <LebenslaufAblage onFiles={(fs) => ablageMelden(ablageAnfragen(fs))}>
        <Card data-tour="dashboard.header">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {t(`greeting.${greetingKey()}`, { name: getFirstName(user) || t('greeting.fallbackName') })}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {greetingSubtext}
                  <span className="hidden md:inline"> {t('header.dropHint')}</span>
                </p>
              </div>

              {/* Am Handy (16.11.2026, Marko: 2A): „Kandidaten anlegen“ breit, „Rundgang“ als Rahmenknopf
                  daneben in derselben Zeile; auf sehr schmalen Handys bricht der Rundgang um. */}
              <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:flex-nowrap">
                <Button variant="secondary" size="sm" className="rounded-full px-4" onClick={guide.start}>
                  <Compass className="h-4 w-4" aria-hidden="true" />
                  {t('header.tour')}
                </Button>
{pending
                  ? <PendingButton size="sm" label={pendingText('addCandidates')} className="order-first flex-1 sm:order-none sm:flex-none" />
                  : <KandidatAnlegenMenu
                  className="order-first flex-1 sm:order-none sm:flex-none"
                  onLebenslauf={lebenslaufWaehlen}
                  onText={() => { setCvStartText(true); setCvUploadDialogOpen(true); }}
                  onOhneLebenslauf={() => setKurzOpen(true)}
                  onHubspot={() => setHubspotDialogOpen(true)}
                  onPerMail={() => setEmailDialogOpen(true)}
                />}
              </div>
            </div>
          </CardContent>
        </Card>
        </LebenslaufAblage>

        {/* H1: Hinweis auf neue Konditionen, bis zugestimmt ist (nur mit Stichtag) */}
        <KonditionenHinweis />

        {/* Kalender verbinden (16.11.2026): dieselbe Leiste wie beim Kunden, mit du; weg, sobald verbunden oder ausgeblendet */}
        <CalendarConnectCard variant="dashboard" fuer="headhunter" />
        {/* Liga: auf dem Computer unten in der Seitenleiste, hier nur noch am Handy (16.11.2026) */}
        <LigaDashboardCard className="md:hidden" />
        <LigaAwardDialog />

        {/* ═══ BENTO GRID: 2x2 ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* ─── CELL 1: Aufgaben (top-left) ─── */}
          <Card data-tour="dashboard.tasks">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex min-w-0 items-center gap-2">
                  <CheckSquare className="h-4 w-4 shrink-0 text-klick" aria-hidden="true" /><h2 className="text-[15px] font-semibold tracking-tight">{t('tasks.title')}</h2>
                  {totalPendingAlerts > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {totalPendingAlerts}
                    </Badge>
                  )}
                </div>
                {/* Am Handy nur der Pfeil: „Aufgaben“ steht ohnehin unten in der Leiste */}
                <Link to="/recruiter/influence" aria-label={t('tasks.all')} className="shrink-0 text-sm text-klick hover:underline">
                  <span className="hidden sm:inline">{t('tasks.all')} </span>›
                </Link>
              </div>

              {totalPendingAlerts === 0 && isNewcomer ? (
                <div className="text-center py-8">
                  <Briefcase className="mx-auto h-9 w-9 text-muted-foreground/40 mb-2" />
                  <p className="font-medium text-sm">{t('tasks.emptyNewTitle')}</p>
                  <p className="text-xs text-muted-foreground">{t('tasks.emptyNewText')}</p>
                  <Link to="/recruiter/jobs" className="mt-1 inline-block text-xs text-klick hover:underline">{t('tasks.openJobs')} ›</Link>
                </div>
              ) : totalPendingAlerts === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="mx-auto h-9 w-9 text-muted-foreground/40 mb-2" />
                  <p className="font-medium text-sm">{t('tasks.doneTitle')}</p>
                  <p className="text-xs text-muted-foreground">{t('tasks.doneText')}</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {topRows.map((row, idx) => {
                    // Dieselben Zeilen wie die Seite „Aufgaben“ (20.10.2026): je Person eine
                    // Zeile, „Kunde prüft“ je Stelle. Kein Haken bei Aufgaben, die sich durch
                    // die Handlung erledigen; nur eigene Aufgaben hakt man ab.
                    const item = rowItem(row);
                    const person = row.kind === 'person' ? row.group : null;
                    const pill = buildGuide(item).pill;
                    // Stellen desselben Kunden sind eine Zeile (28.10.2026)
                    const n = row.kind === 'bundle' ? [row.bundle, ...row.more].reduce((x, b) => x + b.items.length, 0) : 0;
                    const title = person ? person.name : row.kind === 'bundle'
                      ? (row.more.length && row.bundle.companyName ? t('tasks.bundleTitle', { company: row.bundle.companyName, count: row.more.length + 1 }) : row.bundle.jobTitle || t('tasks.job'))
                      : item.title;
                    const sub = item.prep
                      ? [item.candidateRole, prepTexts(item.prep).kurz].filter(Boolean).join(' · ')
                      : person
                      ? `${item.jobTitle ?? ''}${item.companyName ? ` · ${item.companyName}` : ''}`
                      : row.kind === 'bundle'
                        ? t(`tasks.bundle.${row.bundle.erinnerung === 2 ? (row.bundle.kind === 'feedback' ? 'secondAsk' : 'secondReminder') : row.bundle.kind === 'feedback' ? 'noFeedback' : 'inReview'}`, { count: n, days: row.bundle.days })
                        : '';

                    return (
                      <div
                        key={row.key}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleViewTask(row)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleViewTask(row); }}
                        className={cn(
                          '-mx-2.5 flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition-all cursor-pointer group',
                          'hover:bg-accent/50'
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={cn('text-sm truncate', idx === 0 ? 'font-semibold' : 'font-medium')}>{title}</span>
                            {person && person.others.length > 0 && (
                              <span className="text-[11px] text-muted-foreground shrink-0">+{person.others.length}</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{sub}</p>
                        </div>

                        {row.fee > 0 && (
                          <span className="hidden text-xs text-muted-foreground shrink-0 tabular-nums sm:inline">
                            <Honorar>{formatEuro(row.fee)}</Honorar>
                          </span>
                        )}

                        <span className="shrink-0 whitespace-nowrap text-xs text-klick">{pill} ›</span>

                        <div className="flex items-center gap-0.5 shrink-0 empty:hidden">
                          {item.prep?.art === 'termin' && item.prep.termin?.joinUrl ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 md:h-6 md:w-6" asChild>
                                  <a href={item.prep.termin.joinUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} aria-label={t('tasks.join')}><Video className="h-3 w-3" /></a>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t('tasks.join')}</TooltipContent>
                            </Tooltip>
                          ) : person && item.candidatePhone && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost" size="sm" className="h-8 w-8 p-0 md:h-6 md:w-6"
                                  onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${item.candidatePhone}`; }}
                                >
                                  <Phone className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t('tasks.call')}</TooltipContent>
                            </Tooltip>
                          )}
                          {item.itemType === 'task' ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost" size="sm"
                                  className="h-8 w-8 p-0 md:h-6 md:w-6 text-muted-foreground hover:text-foreground"
                                  onClick={(e) => { e.stopPropagation(); handleMarkDone(item); }}
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t('tasks.done')}</TooltipContent>
                            </Tooltip>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}

                  {totalPendingAlerts > 5 && (
                    <Link to="/recruiter/influence" className="mt-1 block py-1.5 text-sm text-klick hover:underline">
                      {t('tasks.showAll', { count: totalPendingAlerts })} ›
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ─── CELL 2: Dein Geld, darunter die Pipeline als vier Zahlen (23.11.2026, Marko) ─── */}
          <Card data-tour="dashboard.pipeline">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex min-w-0 items-center gap-2"><Euro className="h-4 w-4 shrink-0 text-klick" aria-hidden="true" /><h2 className="text-[15px] font-semibold tracking-tight">{t('overview.title')}</h2></div>
                <Link to="/recruiter/earnings" className="text-sm text-klick hover:underline">{t('overview.earnings')} ›</Link>
              </div>
              <div className="divide-y text-sm">
                <GeldZeilen />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help py-2.5 last:pb-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-muted-foreground">{t('overview.expected')}</span>
                        <span className="font-semibold tabular-nums"><Honorar>{formatEuroFull(stats.pipelineRealCase)}</Honorar></span>
                      </div>
                      <p className="mt-0.5 text-right text-xs text-muted-foreground">
                        <Honorar>{t('pipeline.range', { min: Math.round(stats.pipelineWorstCase).toLocaleString(loc()), max: formatEuro(stats.pipelineBestCase) })}</Honorar>
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                    {t('pipeline.expectedHint')}
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="mt-4 border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-klick" aria-hidden="true" /><h2 className="text-[15px] font-semibold tracking-tight">{t('pipeline.title')}</h2></div>
                  <Link to="/recruiter/submissions" className="text-sm text-klick hover:underline">{t('pipeline.details')} ›</Link>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {pipelineStages.map((stage) => (
                    <div key={stage.key} className="min-w-0">
                      <p className={cn('text-xl font-semibold tracking-tight tabular-nums', stage.count === 0 && 'text-muted-foreground/50')}>{stage.count}</p>
                      <p className="truncate text-xs text-muted-foreground">{t(`pipeline.stages.${stage.key}`)}</p>
                    </div>
                  ))}
                </div>
                {prepCount > 0 && (
                  <Link to="/recruiter/influence" className="mt-3 block text-xs text-klick hover:underline">
                    {t('pipeline.beforeSubmission')}: {prepCount} ›
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ─── CELL 3: Top Jobs (bottom-left) ─── */}
          <Card data-tour="dashboard.topJobs">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex min-w-0 items-center gap-2"><Briefcase className="h-4 w-4 shrink-0 text-klick" aria-hidden="true" /><h2 className="text-[15px] font-semibold tracking-tight">{t('topJobs.title')}</h2></div>
                <Link to="/recruiter/jobs" className="text-sm text-klick hover:underline">{t('topJobs.all', { count: stats.openJobs })} ›</Link>
              </div>

              {recentJobs.length > 0 && (
                <KachelReiter<'all' | 'perm' | 'freelance'>
                  items={[
                    { key: 'all', label: t('topJobs.tabAll', { count: Math.max(stats.openJobs, recentJobs.length) }) },
                    ...(stellenContracting.length && stellenFest.length ? [
                      { key: 'perm' as const, label: t('topJobs.tabPerm', { count: stellenFest.length }) },
                      { key: 'freelance' as const, label: t('topJobs.tabFreelance', { count: stellenContracting.length }) },
                    ] : []),
                  ]}
                  value={stellenAktiv}
                  onChange={setStellenTab}
                />
              )}
              {recentJobs.length === 0 ? (
                <div className="text-center py-8">
                  <Briefcase className="mx-auto h-9 w-9 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">{t('topJobs.none')}</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {stellenSicht.map((job) => {
                    const earning = calculatePotentialEarning(job.salary_min, job.salary_max, job.recruiter_fee_percentage);

                    return (
                      <Link
                        key={job.id}
                        to={`/recruiter/jobs/${job.id}`}
                        className="-mx-2.5 flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/50 transition-all group"
                      >
                        {/* Kein Platzhalter (23.11.2026): ein Bild nur, wenn die Firma offengelegt ist und ein echtes Logo hat */}
                        {revealedJobIds.has(job.id) && job.company_logo_url && (
                          <FirmenLogo url={job.company_logo_url} name={job.company_name} size={32} />
                        )}

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {job.title}
                          </p>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {revealedJobIds.has(job.id) ? (
                              <span className="truncate">{job.company_name}</span>
                            ) : (
                              <span className="truncate">{job.industry || t('topJobs.company')}</span>
                            )}
                            <span className="text-border">·</span>
                            <span className="truncate">{job.location}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-xs font-medium tabular-nums">
                            <Honorar>{verdienstJeTag(job)?.replace('–', ` ${t('topJobs.to')} `) ?? (earning ? formatEuro(earning) : `${job.recruiter_fee_percentage} %`)}</Honorar>
                          </p>
                          {verdienstJeTag(job) && <p className="text-[10px] text-muted-foreground">{t('topJobs.perDay')}</p>}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ─── CELL 4: Anstehende Interviews als Kalenderblatt, am Fuß die Woche (23.11.2026, Marko) ─── */}
          <Card className="flex flex-col">
            <CardContent className="flex flex-1 flex-col p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex min-w-0 items-center gap-2"><CalendarDays className="h-4 w-4 shrink-0 text-klick" aria-hidden="true" /><h2 className="text-[15px] font-semibold tracking-tight">{t('pipeline.upcoming')}</h2></div>
                <Link to="/recruiter/interviews" className="text-sm text-klick hover:underline">{t('pipeline.all')} ›</Link>
              </div>
              <KachelReiter<'all' | 'today'>
                items={[
                  { key: 'all', label: t('pipeline.tabAll', { count: upcomingInterviews.length }) },
                  ...(termineHeute.length ? [{ key: 'today' as const, label: t('pipeline.tabToday', { count: termineHeute.length }) }] : []),
                ]}
                value={terminAktiv}
                onChange={setTerminTab}
              />
              {upcomingInterviews.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">{t('pipeline.noInterviews')}</p>
              ) : (
                <div className="space-y-0.5">
                  {(terminAktiv === 'today' ? termineHeute : upcomingInterviews).map((interview, i) => {
                    const tag = new Date(interview.date);
                    return (
                      <div
                        key={i}
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/recruiter/submissions/${interview.submissionId}`)}
                        onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/recruiter/submissions/${interview.submissionId}`); }}
                        className="-mx-2.5 flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-accent/50 cursor-pointer transition-colors"
                      >
                        <div className="w-11 shrink-0 overflow-hidden rounded-lg border text-center" aria-hidden="true">
                          <p className="bg-secondary text-[11px] leading-[18px] text-muted-foreground">{format(tag, 'EEEEEE', { locale: dfLocale() })}</p>
                          <p className="text-base font-semibold leading-7 tabular-nums">{format(tag, 'd')}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{interview.candidateName}</p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            <span className="sr-only">{format(tag, t('date.dayPattern'), { locale: dfLocale() })}, </span>
                            {t('date.timeOnly', { time: format(tag, 'HH:mm') })} · {interview.confirmed ? interview.jobTitle : t('pipeline.unconfirmed')}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-klick">{t('pipeline.open')} ›</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Fuß (23.11.2026, Marko): eine Quote und ein Satz, führt zur Auswertung */}
              <div className="mt-auto pt-3">
                <Link to="/recruiter/analytics" className="flex items-center gap-4 border-t pt-3">
                  {!jahr || jahr.submitted === 0 ? (
                    <p className="min-w-0 flex-1 text-sm text-muted-foreground">{t('analytics.none')}</p>
                  ) : (
                    <>
                      <p className="shrink-0 text-2xl font-semibold tracking-tight tabular-nums">{jahr.inviteRate != null ? `${jahr.inviteRate} %` : jahr.submitted}</p>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{jahr.inviteRate != null ? t('analytics.sentence') : t('analytics.few')}</p>
                        {jahr.inviteRate != null && <p className="text-xs text-muted-foreground">{t('analytics.sub', { interviews: jahr.interviews, submitted: jahr.submitted })}</p>}
                      </div>
                    </>
                  )}
                  <span className="shrink-0 text-sm text-klick">{t('analytics.link')} ›</span>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Dialogs ─── */}
        <KandidatKurzDialog open={kurzOpen} onOpenChange={setKurzOpen} />
        <CvUploadDialog
          open={cvUploadDialogOpen}
          onOpenChange={(o) => { setCvUploadDialogOpen(o); if (!o) setCvStartText(false); }}
          startWithText={cvStartText}
          onCandidateCreated={(id) => {
            toast.success(t('toast.candidateCreated'));
            navigate(`/recruiter/candidates/${id}`);
          }}
        />
        <HubSpotImportDialog
          open={hubspotDialogOpen}
          onOpenChange={setHubspotDialogOpen}
          onImportComplete={() => {
            toast.success(t('toast.imported'));
          }}
        />

        <PerMailWeiterleitenDialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen} />
      </div>
    </DashboardLayout>
  );
}
