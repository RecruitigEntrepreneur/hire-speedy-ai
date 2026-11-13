import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { fetchRecruiterPlacements } from '@/lib/placementViews';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LigaDashboardCard } from '@/components/recruiter/liga/LigaDashboardCard';
import { LigaAwardDialog } from '@/components/recruiter/liga/LigaAwardDialog';
import {
  Briefcase,
  Users,
  FileText,
  ArrowUpRight,
  Loader2,
  Lock,
  CheckCircle,
  MapPin,
  Phone,
  Check,
  ChevronRight,
  Calendar,
  Euro,
  Building2,
  Video,
  Compass,
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
import { useMinutenTakt, useUnifiedTaskInbox, type UnifiedTaskItem } from '@/hooks/useUnifiedTaskInbox';
import { buildGuide, prepTexts } from '@/components/recruiter/tasks/taskWindow';
import { dfLocale, loc } from '@/components/recruiter/tasks/sprache';
import { dashboardRows, rowItem, splitJetzt, type JetztRow } from '@/components/recruiter/tasks/jetztRows';
import { VORBEREITEN_TON } from '@/lib/kandidatVorbereiten';
import { useRecruiterInterviewAgenda } from '@/hooks/useRecruiterInterviewAgenda';
import { useActivityLogger } from '@/hooks/useCandidateActivityLog';
import { HubSpotImportDialog } from '@/components/candidates/HubSpotImportDialog';
import { CvUploadDialog } from '@/components/candidates/CvUploadDialog';
import { KandidatAnlegenMenu } from '@/components/candidates/KandidatAnlegenMenu';
import { KandidatKurzDialog } from '@/components/candidates/KandidatKurzDialog';
import { PerMailWeiterleitenDialog } from '@/components/candidates/PerMailWeiterleitenDialog';
import { useRecruiterGuide } from '@/components/recruiter/guide/RecruiterGuide';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, isToday, isTomorrow } from 'date-fns';
import { isMissingColumnError } from '@/lib/intakeCapture';
import { verdienstJeTag } from '@/lib/recruiterContracting';
import { Honorar } from '@/components/recruiter/Honorar';
import { ErhaltenKachel, ErhaltenZeile } from '@/components/recruiter/verdienste/ErhaltenKachel';
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
  if (amount >= 1000) {
    return `€${Math.round(amount / 1000).toLocaleString(loc())}k`;
  }
  return `€${amount.toLocaleString(loc())}`;
};

const formatEuroFull = (amount: number): string => {
  return `€${amount.toLocaleString(loc())}`;
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
const formatInterviewDate = (dateStr: string, t: T): string => {
  const date = new Date(dateStr);
  const time = format(date, 'HH:mm');
  if (isToday(date)) return t('date.today', { time });
  if (isTomorrow(date)) return t('date.tomorrow', { time });
  return t('date.other', { date: format(date, t('date.dayPattern'), { locale: dfLocale() }), time });
};

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
        .limit(4);
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
        { key: 'submitted', statuses: ['submitted', 'pending'], color: 'bg-amber-500', count: 0 },
        { key: 'in_review', statuses: ['in_review'], color: 'bg-blue-500', count: 0 },
        { key: 'interview', statuses: ['interview'], color: 'bg-purple-500', count: 0 },
        { key: 'offer', statuses: ['offer'], color: 'bg-emerald-500', count: 0 },
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

  const maxPipelineCount = useMemo(() => {
    return Math.max(...pipelineStages.map(s => s.count), 1);
  }, [pipelineStages]);

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
        <RecruiterStartChecklist />

        {/* ═══ HEADER ═══ */}
        <Card className="border-border/30 shadow-sm" data-tour="dashboard.header">
          <CardContent className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {t(`greeting.${greetingKey()}`, { name: getFirstName(user) || t('greeting.fallbackName') })}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {greetingSubtext}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={guide.start}>
                  <Compass className="mr-1.5 h-3.5 w-3.5" />
                  {t('header.tour')}
                </Button>
<KandidatAnlegenMenu
                  onLebenslauf={() => setCvUploadDialogOpen(true)}
                  onText={() => { setCvStartText(true); setCvUploadDialogOpen(true); }}
                  onOhneLebenslauf={() => setKurzOpen(true)}
                  onHubspot={() => setHubspotDialogOpen(true)}
                  onPerMail={() => setEmailDialogOpen(true)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* H1: Hinweis auf neue Konditionen, bis zugestimmt ist (nur mit Stichtag) */}
        <KonditionenHinweis />

        <LigaDashboardCard />
        <LigaAwardDialog />

        {/* ═══ BENTO GRID: 2x2 ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* ─── CELL 1: Aufgaben (top-left) ─── */}
          <Card className="border-border/30 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">{t('tasks.title')}</h2>
                  {totalPendingAlerts > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {totalPendingAlerts}
                    </Badge>
                  )}
                  {urgentCount > 0 && (
                    <Badge className="text-xs bg-destructive/10 text-destructive border-0">
                      {t('tasks.urgent', { count: urgentCount })}
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground"
                  onClick={() => navigate('/recruiter/influence')}
                >
                  {t('tasks.all')}
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>

              {totalPendingAlerts === 0 && isNewcomer ? (
                <div className="text-center py-8">
                  <Briefcase className="mx-auto h-9 w-9 text-muted-foreground/40 mb-2" />
                  <p className="font-medium text-sm">{t('tasks.emptyNewTitle')}</p>
                  <p className="text-xs text-muted-foreground">{t('tasks.emptyNewText')}</p>
                  <Button variant="link" size="sm" className="mt-1 h-auto p-0 text-xs" asChild>
                    <Link to="/recruiter/jobs">{t('tasks.openJobs')}</Link>
                  </Button>
                </div>
              ) : totalPendingAlerts === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="mx-auto h-9 w-9 text-emerald-500/40 mb-2" />
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
                          'flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition-all cursor-pointer group',
                          row.critical
                            ? 'bg-destructive/[0.04] hover:bg-destructive/[0.08]'
                            : 'hover:bg-accent/50'
                        )}
                      >
                        <div className={cn(
                          'w-1.5 h-1.5 rounded-full shrink-0',
                          row.critical ? 'bg-destructive' : 'bg-muted-foreground/30'
                        )} />

                        <div className="flex-1 min-w-0">
                          {idx === 0 && <p className="text-[10px] font-semibold uppercase tracking-wide text-destructive">{t('tasks.next')}</p>}
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium truncate">{title}</span>
                            <Badge variant="secondary" className={cn('h-4 shrink-0 px-1.5 text-[10px] font-medium', item.prep && VORBEREITEN_TON[item.prep.art])}>{pill}</Badge>
                            {person && person.others.length > 0 && (
                              <span className="text-[11px] text-muted-foreground shrink-0">+{person.others.length}</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{sub}</p>
                        </div>

                        {row.fee > 0 && (
                          <span className="text-xs font-semibold text-emerald-600 shrink-0 tabular-nums">
                            <Honorar>{formatEuro(row.fee)}</Honorar>
                          </span>
                        )}

                        <div className="flex items-center gap-0.5 shrink-0">
                          {item.prep?.art === 'termin' && item.prep.termin?.joinUrl ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" asChild>
                                  <a href={item.prep.termin.joinUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} aria-label={t('tasks.join')}><Video className="h-3 w-3" /></a>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t('tasks.join')}</TooltipContent>
                            </Tooltip>
                          ) : person && item.candidatePhone && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost" size="sm" className="h-6 w-6 p-0"
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
                                  className="h-6 w-6 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                                  onClick={(e) => { e.stopPropagation(); handleMarkDone(item); }}
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t('tasks.done')}</TooltipContent>
                            </Tooltip>
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {totalPendingAlerts > 5 && (
                    <Button
                      variant="ghost" size="sm"
                      className="w-full text-xs text-muted-foreground mt-1"
                      onClick={() => navigate('/recruiter/influence')}
                    >
                      {t('tasks.showAll', { count: totalPendingAlerts })}
                      <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ─── CELL 2: Pipeline (top-right) ─── */}
          <Card className="border-border/30 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">{t('pipeline.title')}</h2>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" asChild>
                  <Link to="/recruiter/submissions">
                    {t('pipeline.details')}
                    <ArrowUpRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>

              <div className="space-y-2.5 mb-4">
                {pipelineStages.map((stage) => (
                  <div key={stage.key} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-20 shrink-0">
                      {t(`pipeline.stages.${stage.key}`)}
                    </span>
                    <div className="flex-1 h-2.5 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', stage.color)}
                        style={{ width: `${Math.max((stage.count / maxPipelineCount) * 100, stage.count > 0 ? 12 : 0)}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold w-6 text-right tabular-nums">
                      {stage.count}
                    </span>
                  </div>
                ))}
                {prepCount > 0 && (
                  <Link to="/recruiter/influence" className="flex items-center justify-between gap-3 border-t border-border/40 pt-2.5 text-xs text-muted-foreground hover:text-foreground">
                    <span>{t('pipeline.beforeSubmission')}</span>
                    <span className="w-6 text-right text-sm font-semibold tabular-nums text-foreground">{prepCount}</span>
                  </Link>
                )}
              </div>

              <div className="pt-3 border-t border-border/40 space-y-1.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-between text-sm cursor-help">
                      <span className="text-muted-foreground">{t('pipeline.expected')}</span>
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-emerald-600"><Honorar>{formatEuroFull(stats.pipelineRealCase)}</Honorar></span>
                        <span className="text-[11px] text-muted-foreground">
                          <Honorar>{`(${formatEuro(stats.pipelineWorstCase)} – ${formatEuro(stats.pipelineBestCase)})`}</Honorar>
                        </span>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                    {t('pipeline.expectedHint')}
                  </TooltipContent>
                </Tooltip>
                {/* „Erhalten“ statt „Verdient“ (H1, Umbau 11.11.2026): nur, was als Gutschrift ausgezahlt ist */}
                <ErhaltenZeile />
              </div>

              {/* Interviews inside Pipeline cell */}
              {upcomingInterviews.length > 0 && (
                <div className="mt-4 pt-3 border-t border-border/40">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground">{t('pipeline.upcoming')}</p>
                    <Link
                      to="/recruiter/interviews"
                      className="text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5"
                    >
                      {t('pipeline.all')}
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {upcomingInterviews.map((interview, i) => (
                      <div
                        key={i}
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/recruiter/submissions/${interview.submissionId}`)}
                        onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/recruiter/submissions/${interview.submissionId}`); }}
                        className="flex gap-2.5 p-2 rounded-md bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <Video className="h-3.5 w-3.5 text-purple-500 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium flex items-center gap-1.5">
                            {formatInterviewDate(interview.date, t)}
                            {!interview.confirmed && (
                              <Badge variant="outline" className="text-[9px] h-4 px-1 border-amber-500/50 text-amber-600 dark:text-amber-400">
                                {t('pipeline.unconfirmed')}
                              </Badge>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {interview.candidateName} · {interview.jobTitle}
                          </p>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ─── CELL 3: Top Jobs (bottom-left) ─── */}
          <Card className="border-border/30 shadow-sm" data-tour="dashboard.topJobs">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">{t('topJobs.title')}</h2>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" asChild>
                  <Link to="/recruiter/jobs">
                    {t('topJobs.all', { count: stats.openJobs })}
                    <ArrowUpRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>

              {recentJobs.length === 0 ? (
                <div className="text-center py-8">
                  <Briefcase className="mx-auto h-9 w-9 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">{t('topJobs.none')}</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {recentJobs.map((job) => {
                    const earning = calculatePotentialEarning(job.salary_min, job.salary_max, job.recruiter_fee_percentage);

                    return (
                      <Link
                        key={job.id}
                        to={`/recruiter/jobs/${job.id}`}
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/50 transition-all group"
                      >
                        {revealedJobIds.has(job.id) || job.company_name ? (
                          <FirmenLogo url={job.company_logo_url} name={job.company_name} size={32} />
                        ) : (
                          <div className="h-8 w-8 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                            <Lock className="h-3.5 w-3.5 text-muted-foreground/50" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                            {job.title}
                          </p>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {revealedJobIds.has(job.id) ? (
                              <span className="truncate">{job.company_name}</span>
                            ) : (
                              <span className="flex items-center gap-0.5 truncate">
                                <Lock className="h-2.5 w-2.5" />
                                {job.industry || t('topJobs.company')}
                              </span>
                            )}
                            <span className="text-border">·</span>
                            <span className="truncate">{job.location}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-xs font-semibold text-emerald-600">
                            <Honorar>{verdienstJeTag(job) ?? (earning ? formatEuro(earning) : `${job.recruiter_fee_percentage}%`)}</Honorar>
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

          {/* ─── CELL 4: Quick Stats & Actions (bottom-right) ─── */}
          <Card className="border-border/30 shadow-sm">
            <CardContent className="p-5">
              <h2 className="font-semibold mb-3">{t('overview.title')}</h2>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div className="flex items-center gap-2 mb-1">
                    <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{t('overview.openJobs')}</span>
                  </div>
                  <p className="text-xl font-bold">{stats.openJobs}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{t('overview.candidates')}</span>
                  </div>
                  <p className="text-xl font-bold">{stats.myCandidates}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{t('overview.inPipeline')}</span>
                  </div>
                  <p className="text-xl font-bold">{stats.activeSubmissions}</p>
                </div>
                <ErhaltenKachel />
              </div>

              <div className="space-y-2">
                <Button
                  variant="outline" size="sm"
                  className="w-full justify-start text-sm"
                  asChild
                >
                  <Link to="/recruiter/jobs">
                    <Briefcase className="mr-2 h-3.5 w-3.5" />
                    {t('overview.browseJobs')}
                    <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                </Button>
                <Button
                  variant="outline" size="sm"
                  className="w-full justify-start text-sm"
                  asChild
                >
                  <Link to="/recruiter/candidates">
                    <Users className="mr-2 h-3.5 w-3.5" />
                    {t('overview.myCandidates')}
                    <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                </Button>
                <Button
                  variant="outline" size="sm"
                  className="w-full justify-start text-sm"
                  asChild
                >
                  <Link to="/recruiter/earnings">
                    <Euro className="mr-2 h-3.5 w-3.5" />
                    {t('overview.earnings')}
                    <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                </Button>
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
