import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Briefcase,
  Users,
  FileText,
  ArrowUpRight,
  Loader2,
  Lock,
  CheckCircle,
  MapPin,
  Upload,
  Phone,
  Check,
  ChevronRight,
  ChevronDown,
  Calendar,
  Settings2,
  UserPlus,
  Euro,
  Building2,
  Video,
  Mail,
  Copy,
  MessageSquare,
  Plug,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatAnonymousCompany } from '@/lib/anonymousCompanyFormat';
import { getCompanyLogoUrl, formatHeadcount } from '@/lib/companyLogo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { usePageViewTracking } from '@/hooks/useEventTracking';
import { RecruiterVerificationBanner } from '@/components/verification/RecruiterVerificationBanner';
import { useUnifiedTaskInbox, type UnifiedTaskItem } from '@/hooks/useUnifiedTaskInbox';
import { useRecruiterInterviewAgenda } from '@/hooks/useRecruiterInterviewAgenda';
import { useActivityLogger } from '@/hooks/useCandidateActivityLog';
import { HubSpotImportDialog } from '@/components/candidates/HubSpotImportDialog';
import { CvUploadDialog } from '@/components/candidates/CvUploadDialog';
import { CandidateFormDialog } from '@/components/candidates/CandidateFormDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, isToday, isTomorrow } from 'date-fns';
import { de } from 'date-fns/locale';

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
  key: string;
  label: string;
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

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Guten Morgen';
  if (hour < 18) return 'Guten Tag';
  return 'Guten Abend';
};

const getFirstName = (user: any): string => {
  const fullName = user?.user_metadata?.full_name || user?.email || '';
  if (fullName.includes('@')) return fullName.split('@')[0];
  return fullName.split(' ')[0] || 'Recruiter';
};

const formatEuro = (amount: number): string => {
  if (amount >= 1000) {
    return `€${Math.round(amount / 1000).toLocaleString('de-DE')}k`;
  }
  return `€${amount.toLocaleString('de-DE')}`;
};

const formatEuroFull = (amount: number): string => {
  return `€${amount.toLocaleString('de-DE')}`;
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

const getAlertTypeLabel = (alertType: string): { label: string; color: string } => {
  const map: Record<string, { label: string; color: string }> = {
    'opt_in_pending': { label: 'Opt-In', color: 'bg-primary/10 text-primary' },
    'opt_in_pending_48h': { label: 'Opt-In', color: 'bg-destructive/10 text-destructive' },
    'opt_in_pending_24h': { label: 'Opt-In', color: 'bg-destructive/10 text-destructive' },
    'interview_prep_missing': { label: 'Vorbereitung', color: 'bg-primary/10 text-primary' },
    'interview_reminder': { label: 'Interview', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    'salary_mismatch': { label: 'Gehalt', color: 'bg-primary/10 text-primary' },
    'ghosting_risk': { label: 'Ghosting', color: 'bg-destructive/10 text-destructive' },
    'engagement_drop': { label: 'Engagement', color: 'bg-primary/10 text-primary' },
    'high_closing_probability': { label: 'Closing', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    'closing_opportunity': { label: 'Closing', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    'follow_up_needed': { label: 'Follow-up', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    // Abgeleitete Aufgaben aus der Unified Inbox
    'client_review_stalled': { label: 'Nachfassen', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    'interview_debrief_due': { label: 'Debrief', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    // Manuelle Aufgaben
    'call': { label: 'Anruf', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
    'email': { label: 'E-Mail', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
    'follow_up': { label: 'Follow-up', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
    'meeting': { label: 'Meeting', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  };
  return map[alertType] || { label: 'Aufgabe', color: 'bg-muted text-muted-foreground' };
};

const formatInterviewDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (isToday(date)) return `Heute, ${format(date, 'HH:mm')} Uhr`;
  if (isTomorrow(date)) return `Morgen, ${format(date, 'HH:mm')} Uhr`;
  return format(date, "EEEE, dd. MMM · HH:mm 'Uhr'", { locale: de });
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function RecruiterDashboard() {
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
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [hubspotDialogOpen, setHubspotDialogOpen] = useState(false);
  const [cvUploadDialogOpen, setCvUploadDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const [candidateFormOpen, setCandidateFormOpen] = useState(false);
  const [candidateFormProcessing, setCandidateFormProcessing] = useState(false);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [revealedJobIds, setRevealedJobIds] = useState<Set<string>>(new Set());

  // Gleiche Quelle wie /recruiter/influence: Alerts + manuelle + abgeleitete Aufgaben
  const { allItems: taskItems, markDone: taskMarkDone } = useUnifiedTaskInbox();
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
      ensureInterviewAlerts();
    }
  }, [user]);


  const ensureInterviewAlerts = async () => {
    if (!user) return;
    try {
      const { data: irSubmissions } = await supabase
        .from('submissions')
        .select('id, candidate_id, job_id, candidates(full_name)')
        .eq('recruiter_id', user.id)
        .eq('stage', 'interview_requested');

      if (!irSubmissions || irSubmissions.length === 0) return;

      // Job-Titel separat: Recruiter lesen Jobs nur ueber recruiter_jobs_view.
      const irJobIds = [...new Set(irSubmissions.map((s: any) => s.job_id).filter(Boolean))] as string[];
      let irJobTitles: Record<string, string> = {};
      if (irJobIds.length > 0) {
        const { data: jobRows } = await supabase
          .from('recruiter_jobs_view')
          .select('id, title')
          .in('id', irJobIds);
        irJobTitles = Object.fromEntries((jobRows || []).map((j: any) => [j.id, j.title]));
      }

      const { data: existingAlerts } = await supabase
        .from('influence_alerts')
        .select('submission_id')
        .eq('recruiter_id', user.id)
        .eq('alert_type', 'opt_in_pending');

      const existingSubmissionIds = new Set((existingAlerts || []).map(a => a.submission_id));

      const missing = irSubmissions.filter(s => !existingSubmissionIds.has(s.id));
      for (const s of missing) {
        const candidateName = (s as any).candidates?.full_name || 'Kandidat';
        const jobTitle = irJobTitles[(s as any).job_id] || 'Position';
        await supabase.from('influence_alerts').insert({
          submission_id: s.id,
          recruiter_id: user.id,
          alert_type: 'opt_in_pending',
          priority: 'critical' as any,
          title: `Interview-Anfrage: ${candidateName} – ${jobTitle}`,
          message: `Ein Kunde möchte ${candidateName} für "${jobTitle}" interviewen. Opt-In einholen.`,
          recommended_action: 'Kontaktieren Sie den Kandidaten und holen Sie die Zustimmung (Opt-In) ein.',
        });
      }
    } catch (err) {
      console.error('Error ensuring interview alerts:', err);
    }
  };

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
      const { data: jobs, error: jobsError } = await supabase
        .from('recruiter_jobs_view')
        .select('id, title, company_name, industry, company_size_band, funding_stage, tech_environment, location, salary_min, salary_max, remote_type, recruiter_fee_percentage, hiring_urgency, created_at')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(4);

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

      const { data: placements } = await supabase
        .from('placements')
        .select('recruiter_payout, submission_id, submissions!inner(recruiter_id)')
        .eq('submissions.recruiter_id', user?.id);

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
        { key: 'submitted', label: 'Eingereicht', statuses: ['submitted', 'pending'], color: 'bg-amber-500', count: 0 },
        { key: 'in_review', label: 'In Prüfung', statuses: ['in_review'], color: 'bg-blue-500', count: 0 },
        { key: 'interview', label: 'Interview', statuses: ['interview'], color: 'bg-purple-500', count: 0 },
        { key: 'offer', label: 'Angebot', statuses: ['offer'], color: 'bg-emerald-500', count: 0 },
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
    await taskMarkDone(item.itemType, item.itemId);

    if (item.candidateId) {
      await logActivity(
        item.candidateId,
        'alert_actioned',
        `Aufgabe erledigt: ${item.title}`,
        item.description || undefined,
        { item_type: item.itemType, task_category: item.taskCategory, priority: item.priority },
        item.submissionId || undefined,
        item.itemType === 'alert' ? item.itemId : undefined
      );
    }

    toast.success(
      item.itemType === 'derived'
        ? 'Erledigt — kommt wieder, falls sich weiterhin nichts bewegt'
        : 'Erledigt'
    );
  };

  const handleViewTask = (item: UnifiedTaskItem) => {
    if (item.candidateId) {
      const taskParam = item.itemType === 'alert' ? `?task=${item.itemId}` : '';
      navigate(`/recruiter/candidates/${item.candidateId}${taskParam}`);
    } else if (item.submissionId) {
      navigate(`/recruiter/submissions/${item.submissionId}`);
    } else {
      navigate('/recruiter/influence');
    }
  };

  // ─── Derived Data ───────────────────────────────────────────────────────

  const topTasks = useMemo(() => taskItems.slice(0, 5), [taskItems]);

  const urgentCount = useMemo(() => {
    return taskItems.filter(i => i.priority === 'critical').length;
  }, [taskItems]);

  const totalPendingAlerts = useMemo(() => taskItems.length, [taskItems]);

  const maxPipelineCount = useMemo(() => {
    return Math.max(...pipelineStages.map(s => s.count), 1);
  }, [pipelineStages]);

  const greetingSubtext = useMemo(() => {
    const nextInterview = upcomingInterviews[0];
    const nextDate = nextInterview ? new Date(nextInterview.date) : null;
    const interviewToday = nextDate && isToday(nextDate);
    const interviewTomorrow = nextDate && isTomorrow(nextDate);
    const timeStr = nextDate ? format(nextDate, 'HH:mm') : '';

    // Urgent tasks + interview today
    if (urgentCount > 0 && interviewToday) {
      return `Du hast ${urgentCount} dringende Aufgaben und ein Interview heute um ${timeStr} Uhr.`;
    }
    // Urgent tasks + interview tomorrow
    if (urgentCount > 0 && interviewTomorrow) {
      return `${urgentCount} dringende Aufgaben – und morgen steht ein Interview an.`;
    }
    // Urgent tasks, no interview soon
    if (urgentCount > 0) {
      return `${urgentCount} dringende Aufgaben warten auf dich.`;
    }
    // No urgent, but interview today
    if (interviewToday && nextInterview) {
      return `Heute um ${timeStr} Uhr: Interview mit ${nextInterview.candidateName}. Viel Erfolg!`;
    }
    // No urgent, interview tomorrow
    if (interviewTomorrow) {
      return 'Morgen steht ein Interview an – alles vorbereitet?';
    }
    // No urgent, interviews this week
    if (upcomingInterviews.length > 0) {
      return `${upcomingInterviews.length} Interview${upcomingInterviews.length > 1 ? 's' : ''} geplant diese Woche.`;
    }
    // No interviews, tasks pending → konkrete Top-Aufgabe nennen
    if (totalPendingAlerts > 0) {
      const top = topTasks[0];
      if (top?.candidateName) {
        return `${totalPendingAlerts} Aufgaben offen — Top-Priorität: ${top.candidateName} (${getAlertTypeLabel(top.taskCategory).label}).`;
      }
      return `${totalPendingAlerts} Aufgaben warten – pack sie an!`;
    }
    // All clear
    return 'Alles erledigt – Zeit, neue Kandidaten einzureichen!';
  }, [urgentCount, upcomingInterviews, totalPendingAlerts, topTasks]);

  const inboundEmail = useMemo(() => {
    if (!user?.id) return '';
    const shortId = user.id.replace(/-/g, '').slice(0, 8);
    return `r_${shortId}@inbound.matchunt.ai`;
  }, [user?.id]);

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(inboundEmail);
      setEmailCopied(true);
      toast.success('E-Mail-Adresse kopiert');
      setTimeout(() => setEmailCopied(false), 2000);
    } catch {
      toast.error('Kopieren fehlgeschlagen');
    }
  };

  const handleSaveNewCandidate = async (candidateData: Record<string, unknown>) => {
    setCandidateFormProcessing(true);
    try {
      const insertData = { ...candidateData, recruiter_id: user?.id };
      const { data, error } = await supabase
        .from('candidates')
        .insert(insertData as never)
        .select('id')
        .single();
      if (error) throw error;
      toast.success('Kandidat angelegt');
      setCandidateFormOpen(false);
      if (data?.id) navigate(`/recruiter/candidates/${data.id}`);
    } catch {
      toast.error('Fehler beim Speichern');
    } finally {
      setCandidateFormProcessing(false);
    }
  };

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
        <RecruiterVerificationBanner />

        {/* ═══ HEADER ═══ */}
        <Card className="border-border/30 shadow-sm">
          <CardContent className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {getGreeting()}, {getFirstName(user)}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {greetingSubtext}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setCandidateFormOpen(true)}
                >
                  <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                  Kandidaten anlegen
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="px-2">
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setCvUploadDialogOpen(true)}>
                      <Upload className="mr-2 h-4 w-4" />
                      CV hochladen
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setHubspotDialogOpen(true)}>
                      <Upload className="mr-2 h-4 w-4" />
                      HubSpot Import
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/recruiter/integrations')}>
                      <Plug className="mr-2 h-4 w-4" />
                      CRM verbinden
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setEmailDialogOpen(true)}>
                      <Mail className="mr-2 h-4 w-4" />
                      Per E-Mail senden
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══ BENTO GRID: 2x2 ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* ─── CELL 1: Aufgaben (top-left) ─── */}
          <Card className="border-border/30 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">Aufgaben</h2>
                  {totalPendingAlerts > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {totalPendingAlerts}
                    </Badge>
                  )}
                  {urgentCount > 0 && (
                    <Badge className="text-xs bg-destructive/10 text-destructive border-0">
                      {urgentCount} dringend
                    </Badge>
                  )}
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground">
                      <Settings2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Alert-Einstellungen</TooltipContent>
                </Tooltip>
              </div>

              {totalPendingAlerts === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="mx-auto h-9 w-9 text-emerald-500/40 mb-2" />
                  <p className="font-medium text-sm">Alles erledigt</p>
                  <p className="text-xs text-muted-foreground">Keine offenen Aufgaben</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {topTasks.map((item) => {
                    const typeInfo = getAlertTypeLabel(item.taskCategory);
                    const isUrgent = item.priority === 'critical';

                    return (
                      <div
                        key={`${item.itemType}-${item.itemId}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleViewTask(item)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleViewTask(item); }}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition-all cursor-pointer group',
                          isUrgent
                            ? 'bg-destructive/[0.04] hover:bg-destructive/[0.08]'
                            : 'hover:bg-accent/50'
                        )}
                      >
                        <div className={cn(
                          'w-1.5 h-1.5 rounded-full shrink-0',
                          isUrgent ? 'bg-destructive' : 'bg-muted-foreground/30'
                        )} />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium truncate">
                              {item.candidateName || item.title}
                            </span>
                            <Badge className={cn('text-[10px] px-1.5 py-0 h-4 border-0 shrink-0', typeInfo.color)}>
                              {typeInfo.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {item.jobTitle}
                            {item.companyName ? ` · ${item.companyName}` : ''}
                          </p>
                        </div>

                        {item.feeValue != null && item.feeValue > 0 && (
                          <span className="text-xs font-semibold text-emerald-600 shrink-0 tabular-nums">
                            {formatEuro(item.feeValue)}
                          </span>
                        )}

                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {item.candidatePhone && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost" size="sm" className="h-6 w-6 p-0"
                                  onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${item.candidatePhone}`; }}
                                >
                                  <Phone className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Anrufen</TooltipContent>
                            </Tooltip>
                          )}
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
                            <TooltipContent>Erledigt</TooltipContent>
                          </Tooltip>
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
                      Alle {totalPendingAlerts} Aufgaben anzeigen
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
                <h2 className="font-semibold">Pipeline</h2>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" asChild>
                  <Link to="/recruiter/submissions">
                    Details
                    <ArrowUpRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>

              <div className="space-y-2.5 mb-4">
                {pipelineStages.map((stage) => (
                  <div key={stage.key} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-20 shrink-0">
                      {stage.label}
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
              </div>

              <div className="pt-3 border-t border-border/40 space-y-1.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-between text-sm cursor-help">
                      <span className="text-muted-foreground">Erwartbar</span>
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-emerald-600">{formatEuroFull(stats.pipelineRealCase)}</span>
                        <span className="text-[11px] text-muted-foreground">
                          ({formatEuro(stats.pipelineWorstCase)} – {formatEuro(stats.pipelineBestCase)})
                        </span>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                    Gewichtet nach Pipeline-Stage: Eingereicht 10%, In Prüfung 20%, Interview 40%, Angebot 75%
                  </TooltipContent>
                </Tooltip>
                {stats.earnings > 0 && (
                  <div className="flex items-center justify-between text-sm pt-1 border-t border-border/30">
                    <span className="text-muted-foreground">Verdient</span>
                    <span className="font-semibold">{formatEuroFull(stats.earnings)}</span>
                  </div>
                )}
              </div>

              {/* Interviews inside Pipeline cell */}
              {upcomingInterviews.length > 0 && (
                <div className="mt-4 pt-3 border-t border-border/40">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground">ANSTEHENDE INTERVIEWS</p>
                    <Link
                      to="/recruiter/interviews"
                      className="text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5"
                    >
                      Alle
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
                            {formatInterviewDate(interview.date)}
                            {!interview.confirmed && (
                              <Badge variant="outline" className="text-[9px] h-4 px-1 border-amber-500/50 text-amber-600 dark:text-amber-400">
                                unbestätigt
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
          <Card className="border-border/30 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Top Jobs</h2>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" asChild>
                  <Link to="/recruiter/jobs">
                    Alle {stats.openJobs} Jobs
                    <ArrowUpRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>

              {recentJobs.length === 0 ? (
                <div className="text-center py-8">
                  <Briefcase className="mx-auto h-9 w-9 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">Keine Jobs verfügbar</p>
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
                        {revealedJobIds.has(job.id) ? (
                          <div className="h-8 w-8 rounded-md overflow-hidden bg-background border border-border/50 flex items-center justify-center shrink-0">
                            <img
                              src={getCompanyLogoUrl(undefined, undefined, job.company_name || '')}
                              alt=""
                              className="h-6 w-6 object-contain"
                              onError={(e) => {
                                e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(job.company_name || 'U')}&background=1e3a5f&color=fff&size=64&bold=true`;
                              }}
                            />
                          </div>
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
                                {job.industry || 'Unternehmen'}
                              </span>
                            )}
                            <span className="text-border">·</span>
                            <span className="truncate">{job.location}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-xs font-semibold text-emerald-600">
                            {earning ? formatEuro(earning) : `${job.recruiter_fee_percentage}%`}
                          </p>
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
              <h2 className="font-semibold mb-3">Übersicht</h2>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div className="flex items-center gap-2 mb-1">
                    <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Offene Jobs</span>
                  </div>
                  <p className="text-xl font-bold">{stats.openJobs}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Kandidaten</span>
                  </div>
                  <p className="text-xl font-bold">{stats.myCandidates}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">In Pipeline</span>
                  </div>
                  <p className="text-xl font-bold">{stats.activeSubmissions}</p>
                </div>
                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Euro className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-xs text-emerald-600">Verdient</span>
                  </div>
                  <p className="text-xl font-bold text-emerald-600">{formatEuroFull(stats.earnings)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  variant="outline" size="sm"
                  className="w-full justify-start text-sm"
                  asChild
                >
                  <Link to="/recruiter/jobs">
                    <Briefcase className="mr-2 h-3.5 w-3.5" />
                    Offene Jobs durchsuchen
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
                    Meine Kandidaten
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
                    Verdienste & Auszahlungen
                    <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Dialogs ─── */}
        <CandidateFormDialog
          open={candidateFormOpen}
          onOpenChange={setCandidateFormOpen}
          candidate={null}
          onSave={handleSaveNewCandidate}
          processing={candidateFormProcessing}
        />
        <CvUploadDialog
          open={cvUploadDialogOpen}
          onOpenChange={setCvUploadDialogOpen}
          onCandidateCreated={(id) => {
            toast.success('Kandidat erfolgreich angelegt');
            navigate(`/recruiter/candidates/${id}`);
          }}
        />
        <HubSpotImportDialog
          open={hubspotDialogOpen}
          onOpenChange={setHubspotDialogOpen}
          onImportComplete={() => {
            toast.success('Kandidaten erfolgreich importiert');
          }}
        />

        {/* Email Inbound Dialog */}
        <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Kandidaten per E-Mail einreichen</DialogTitle>
              <DialogDescription>
                Leite CVs einfach als PDF-Anhang an deine persoenliche Matchunt-Adresse weiter.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-md px-3 py-2.5 text-sm font-mono select-all truncate border border-border/50">
                  {inboundEmail}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 h-9 w-9 p-0"
                  onClick={handleCopyEmail}
                >
                  {emailCopied ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground space-y-2 bg-muted/30 rounded-lg p-3">
                <div className="flex gap-2">
                  <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>PDF-Lebenslaeufe werden automatisch analysiert und als Kandidaten angelegt – auch mehrere auf einmal.</span>
                </div>
                <div className="flex gap-2">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>Schreibe Notizen einfach in den E-Mail-Text dazu – sie werden automatisch erkannt und dem Kandidaten zugeordnet.</span>
                </div>
                <div className="flex gap-2">
                  <Users className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>Notizen ohne CV? Das System erkennt den Kandidatennamen und ordnet alles automatisch zu.</span>
                </div>
                <div className="flex gap-2">
                  <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>Bereits vorhandene Kandidaten werden erkannt und aktualisiert statt doppelt angelegt.</span>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
