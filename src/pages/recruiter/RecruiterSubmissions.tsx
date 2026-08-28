import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SubmissionsFunnelGrid } from '@/components/recruiter/SubmissionsFunnelGrid';
import {
  STAGE_COLUMNS,
  isClosedStage,
  normalizeStage,
  stageLabel,
  type CanonicalStage,
} from '@/lib/submissionStage';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Progress } from '@/components/ui/progress';
import { PlaybookViewer } from '@/components/influence/PlaybookViewer';
import {
  Loader2,
  Search,
  Briefcase,
  User,
  Clock,
  Calendar,
  MessageSquare,
  ArrowRight,
  Filter,
  Phone,
  Mail,
  BookOpen,
  AlertTriangle,
  TrendingUp,
  Target,
  Zap
} from 'lucide-react';
import { CompanyRevealIcon } from '@/components/recruiter/CompanyRevealBadge';
import { getDisplayCompanyName } from '@/lib/anonymousCompanyFormat';
import { cn } from '@/lib/utils';

interface CandidateBehavior {
  confidence_score: number | null;
  interview_readiness_score: number | null;
  closing_probability: number | null;
  engagement_level: string | null;
}

interface InfluenceAlert {
  id: string;
  alert_type: string;
  priority: string;
}

interface Submission {
  id: string;
  /** Wahrheit fuer den Prozessfortschritt (CHECK submissions_stage_check). */
  stage: string;
  /** Abgeleitet aus stage via DB-Trigger — nur noch fuer Altcode. */
  status: string;
  submitted_at: string;
  updated_at: string;
  recruiter_notes: string;
  client_notes: string;
  rejection_reason: string;
  job_id: string;
  candidate_id: string;
  // Triple-Blind Felder
  company_revealed: boolean;
  full_access_granted: boolean;
  jobs: {
    id: string;
    title: string;
    company_name: string;
    industry: string | null;
    company_size_band: string | null;
    funding_stage: string | null;
    tech_environment: string[] | null;
    hiring_urgency: string | null;
    location: string | null;
    remote_type: string | null;
  };
  candidates: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
  };
  interviews: {
    id: string;
    scheduled_at: string;
    status: string;
  }[];
  candidate_behavior: CandidateBehavior[];
  influence_alerts: InfluenceAlert[];
}

// Stage-Vokabular und Normalisierung liegen in src/lib/submissionStage.ts —
// eine Quelle fuer Kanban, Liste und Funnel-Uebersicht. Vorher hatten Kanban
// und Funnel zwei verschiedene Stage-Listen direkt uebereinander.

/**
 * client_notes enthaelt teils JSON (pending_interview_request der Terminanfrage)
 * statt Prosa — das landete roh als `{"pending_interview_request": {"client_...`
 * auf der Karte. Hier wird daraus ein Satz; freier Text bleibt unveraendert.
 */
function clientNoteText(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = String(raw).trim();
  if (!text.startsWith('{') && !text.startsWith('[')) return text;
  try {
    const parsed = JSON.parse(text);
    const req = parsed?.pending_interview_request;
    if (req) {
      const slots = Array.isArray(req.client_time_slots) ? req.client_time_slots.length : 0;
      const msg = typeof req.client_message === 'string' ? req.client_message.trim() : '';
      if (msg) return msg;
      return slots > 0
        ? `Interview-Anfrage mit ${slots} Terminvorschlägen`
        : 'Interview-Anfrage liegt vor';
    }
    return null;
  } catch {
    return text;
  }
}

/**
 * Naechster Termin der Einreichung. Ohne scheduled_at ergab
 * `new Date(null)` den 1.1.1970 — genau das stand auf den Karten.
 */
function nextInterviewDate(sub: Submission): string | null {
  const dated = (sub.interviews || [])
    .filter((iv) => !!iv.scheduled_at)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  if (!dated.length) return null;
  return new Date(dated[0].scheduled_at).toLocaleDateString('de-DE');
}

function ScoreBadge({ score, label, icon: Icon }: { score: number | null; label: string; icon: React.ElementType }) {
  const value = score ?? 0;
  const color = value >= 70 ? 'text-green-600' : value >= 40 ? 'text-amber-600' : 'text-red-600';
  
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={`h-3 w-3 ${color}`} />
      <span className={`text-xs font-medium ${color}`}>{value}%</span>
    </div>
  );
}

function QuickActions({ 
  submission, 
  onPlaybookOpen 
}: { 
  submission: Submission; 
  onPlaybookOpen: (submissionId: string) => void;
}) {
  const handleCall = () => {
    if (submission.candidates?.phone) {
      window.open(`tel:${submission.candidates.phone}`, '_self');
    }
  };

  const handleEmail = () => {
    if (submission.candidates?.email) {
      window.open(`mailto:${submission.candidates.email}?subject=Bezüglich ${submission.jobs?.title}`, '_self');
    }
  };

  return (
    <div className="flex items-center gap-1 mt-2">
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-7 w-7 p-0"
        onClick={(e) => { e.stopPropagation(); handleCall(); }}
        disabled={!submission.candidates?.phone}
        title="Anrufen"
      >
        <Phone className="h-3.5 w-3.5" />
      </Button>
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-7 w-7 p-0"
        onClick={(e) => { e.stopPropagation(); handleEmail(); }}
        title="Email senden"
      >
        <Mail className="h-3.5 w-3.5" />
      </Button>
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-7 w-7 p-0"
        onClick={(e) => { e.stopPropagation(); onPlaybookOpen(submission.id); }}
        title="Playbook öffnen"
      >
        <BookOpen className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default function RecruiterSubmissions() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [alertFilter, setAlertFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [showClosed, setShowClosed] = useState(false);
  const [selectedPlaybookSubmission, setSelectedPlaybookSubmission] = useState<string | null>(null);
  const [selectedPlaybook, setSelectedPlaybook] = useState<any | null>(null);
  const [playbooks, setPlaybooks] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchSubmissions();
      fetchPlaybooks();
    }
  }, [user]);

  const fetchSubmissions = async () => {
    try {
      // Kein eingebetteter jobs(...)-Join: Recruiter duerfen public.jobs nicht
      // mehr direkt lesen, der Join liefert sonst still null.
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          *,
          candidates (id, full_name, email, phone),
          interviews (id, scheduled_at, status),
          candidate_behavior (confidence_score, interview_readiness_score, closing_probability, engagement_level),
          influence_alerts (id, alert_type, priority)
        `)
        .eq('recruiter_id', user?.id)
        .order('submitted_at', { ascending: false });

      if (!error && data) {
        const jobIds = [...new Set(data.map((s: any) => s.job_id).filter(Boolean))] as string[];
        let jobsById: Record<string, any> = {};
        if (jobIds.length > 0) {
          const { data: jobRows } = await supabase
            .from('recruiter_jobs_view')
            .select('id, title, company_name, industry, company_size_band, funding_stage, tech_environment, hiring_urgency, location, remote_type, salary_min, salary_max, recruiter_fee_percentage')
            .in('id', jobIds);
          jobsById = Object.fromEntries((jobRows || []).map((j: any) => [j.id, j]));
        }
        data.forEach((s: any) => { s.jobs = jobsById[s.job_id] ?? null; });
        setSubmissions(data as any);
      }
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlaybooks = async () => {
    const { data } = await supabase
      .from('coaching_playbooks')
      .select('*')
      .eq('is_active', true);
    if (data) setPlaybooks(data);
  };

  // Eine normalisierte Stage pro Submission — Kanban, Liste, Filter und Funnel
  // rechnen damit, statt jeweils sub.stage roh zu lesen.
  const normalized = useMemo(
    () => submissions.map((sub) => ({ sub, stage: normalizeStage(sub.stage, sub.status) })),
    [submissions],
  );

  const filteredSubmissions = normalized.filter(({ sub, stage }) => {
    const matchesSearch =
      sub.candidates?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.jobs?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.jobs?.company_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || stage === statusFilter;
    const hasAlerts = sub.influence_alerts && sub.influence_alerts.length > 0;
    const matchesAlertFilter = alertFilter === 'all' ||
      (alertFilter === 'with_alerts' && hasAlerts) ||
      (alertFilter === 'no_alerts' && !hasAlerts);
    return matchesSearch && matchesStatus && matchesAlertFilter;
  });

  const getSubmissionsByStatus = (stage: string) =>
    filteredSubmissions.filter((x) => x.stage === stage).map((x) => x.sub);

  /** Der Kanban ist die Arbeitsansicht: nur belegte UND laufende Phasen. Leere
   *  Spalten zeigen nichts, beendete Vorgaenge sind erledigt — beide zusammen
   *  fressen die Breite, die den aktiven Phasen fehlt. Die Zahlen zu Absagen
   *  stehen vollstaendig in der Uebersicht darueber. */
  const visibleColumns = useMemo(() => {
    const counts = new Map<CanonicalStage, number>();
    filteredSubmissions.forEach(({ stage }) => counts.set(stage, (counts.get(stage) ?? 0) + 1));
    const belegt = STAGE_COLUMNS.filter((c) => (counts.get(c.key) ?? 0) > 0);
    const aktiv = belegt.filter((c) => !c.closed);
    const beendet = belegt.filter((c) => c.closed);
    return {
      columns: showClosed ? belegt : aktiv,
      leer: STAGE_COLUMNS.filter((c) => !c.closed).length - aktiv.length,
      beendetSpalten: beendet.length,
      beendetCount: beendet.reduce((sum, c) => sum + (counts.get(c.key) ?? 0), 0),
    };
  }, [filteredSubmissions, showClosed]);

  /** Funnel-Zahlen aus derselben Quelle wie der Kanban. Vorher speiste sich die
   *  Uebersicht aus useRecruiterStats mit eigenem Stage-Vokabular und zeigte
   *  deshalb andere Zahlen als die Spalten 200 px darunter. */
  const funnelBreakdown = useMemo(() => {
    const acc = new Map<CanonicalStage, { count: number; potentialEarning: number }>();
    normalized.forEach(({ sub, stage }) => {
      const job = sub.jobs as any;
      const min = job?.salary_min ?? null;
      const max = job?.salary_max ?? null;
      const pct = job?.recruiter_fee_percentage ?? null;
      const avg = min && max ? (min + max) / 2 : min || max || 0;
      const fee = pct && avg ? Math.round(avg * (pct / 100)) : 0;
      const cur = acc.get(stage) ?? { count: 0, potentialEarning: 0 };
      acc.set(stage, { count: cur.count + 1, potentialEarning: cur.potentialEarning + fee });
    });
    return STAGE_COLUMNS.map((c) => ({
      stage: c.key,
      label: c.label,
      closed: !!c.closed,
      count: acc.get(c.key)?.count ?? 0,
      potentialEarning: acc.get(c.key)?.potentialEarning ?? 0,
    }));
  }, [normalized]);

  /** Kopfzeile: "in Bearbeitung" darf nur zaehlen, was wirklich laeuft. */
  const activeCount = useMemo(
    () => normalized.filter(({ stage }) => !isClosedStage(stage)).length,
    [normalized],
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Heute';
    if (diffDays === 1) return 'Gestern';
    if (diffDays < 7) return `Vor ${diffDays} Tagen`;
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = STAGE_COLUMNS.find(s => s.key === status);
    return (
      <Badge className={`${statusConfig?.color || 'bg-muted'} text-white`}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  const getBehavior = (sub: Submission): CandidateBehavior | null => {
    return sub.candidate_behavior?.[0] || null;
  };

  const getAlertCount = (sub: Submission) => {
    return sub.influence_alerts?.length || 0;
  };

  const getCriticalAlertCount = (sub: Submission) => {
    return sub.influence_alerts?.filter(a => a.priority === 'critical' || a.priority === 'high').length || 0;
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Meine Pipeline</h1>
              <p className="text-muted-foreground">
                {activeCount} in Bearbeitung
                {submissions.length > activeCount && (
                  <span className="text-muted-foreground/70">
                    {' '}
                    · {submissions.length - activeCount} beendet
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/recruiter/influence">
                <Button variant="outline" size="sm">
                  <Zap className="h-4 w-4 mr-2" />
                  Influence Dashboard
                </Button>
              </Link>
              <Button
                variant={viewMode === 'kanban' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('kanban')}
              >
                Kanban
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                Liste
              </Button>
            </div>
          </div>

          {/* Submissions Funnel Overview */}
          <SubmissionsFunnelGrid breakdown={funnelBreakdown} />

          {/* Filters */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Suche nach Kandidat, Job oder Firma..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={alertFilter} onValueChange={setAlertFilter}>
              <SelectTrigger className="w-[160px]">
                <AlertTriangle className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Alerts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="with_alerts">Mit Alerts</SelectItem>
                <SelectItem value="no_alerts">Ohne Alerts</SelectItem>
              </SelectContent>
            </Select>
            {viewMode === 'list' && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  {STAGE_COLUMNS.map((status) => (
                    <SelectItem key={status.key} value={status.key}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Kanban View */}
          {viewMode === 'kanban' && (
            <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {visibleColumns.leer > 0 && <span>{visibleColumns.leer} leere Phasen ausgeblendet</span>}
              {visibleColumns.beendetCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowClosed((v) => !v)}
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {showClosed
                    ? `${visibleColumns.beendetCount} beendete ausblenden`
                    : `${visibleColumns.beendetCount} beendete einblenden`}
                </button>
              )}
            </div>
            {/* Spalten teilen sich die Breite (flex-1 + basis-0) und greifen erst
                bei zu vielen Phasen auf Scrollen zurueck — vorher belegte jede
                fix 320 px, wodurch schon drei Spalten den Bereich sprengten. */}
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-4">
                {visibleColumns.columns.map((column) => {
                  const columnSubmissions = getSubmissionsByStatus(column.key);
                  return (
                    <div
                      key={column.key}
                      className={cn(
                        'min-w-[15rem] flex-1 basis-0',
                        column.closed && 'opacity-75',
                      )}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`h-3 w-3 rounded-full ${column.color}`} />
                        <h3 className="font-semibold">{column.label}</h3>
                        <Badge variant="secondary" className="ml-auto">
                          {columnSubmissions.length}
                        </Badge>
                      </div>
                      <div className="space-y-3">
                        {columnSubmissions.map((sub) => {
                          const behavior = getBehavior(sub);
                          const alertCount = getAlertCount(sub);
                          const criticalCount = getCriticalAlertCount(sub);
                          
                          return (
                            <Card key={sub.id} className="cursor-pointer hover:shadow-md transition-shadow">
                              <CardContent className="p-4">
                                <div className="space-y-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate font-medium">{sub.candidates?.full_name}</p>
                                      <p className="truncate text-sm text-muted-foreground">{sub.candidates?.email}</p>
                                    </div>
                                    {alertCount > 0 && (
                                      <Badge variant={criticalCount > 0 ? "destructive" : "secondary"} className="text-xs">
                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                        {alertCount}
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  {/* Candidate Scores */}
                                  {behavior && (
                                    <div className="bg-muted/50 rounded-lg p-2 space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <ScoreBadge score={behavior.confidence_score} label="Conf" icon={TrendingUp} />
                                        <ScoreBadge score={behavior.interview_readiness_score} label="Ready" icon={Target} />
                                        <ScoreBadge score={behavior.closing_probability} label="Close" icon={Zap} />
                                      </div>
                                      <div className="flex gap-1">
                                        <Progress value={behavior.confidence_score ?? 0} className="h-1 flex-1" />
                                        <Progress value={behavior.interview_readiness_score ?? 0} className="h-1 flex-1" />
                                        <Progress value={behavior.closing_probability ?? 0} className="h-1 flex-1" />
                                      </div>
                                    </div>
                                  )}
                                  
                                  <Link to={`/recruiter/jobs/${sub.job_id}`}>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                                      <Briefcase className="h-3 w-3" />
                                      <span className="truncate">{sub.jobs?.title}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                                      <CompanyRevealIcon 
                                        companyRevealed={sub.company_revealed} 
                                        fullAccess={sub.full_access_granted} 
                                      />
                                      <span className="truncate">
                                        {getDisplayCompanyName(
                                          sub.jobs?.company_name || '',
                                          sub.jobs?.industry,
                                          sub.company_revealed,
                                          {
                                            industry: sub.jobs?.industry,
                                            companySize: sub.jobs?.company_size_band,
                                            fundingStage: sub.jobs?.funding_stage,
                                            techStack: sub.jobs?.tech_environment,
                                            location: sub.jobs?.location,
                                            urgency: sub.jobs?.hiring_urgency,
                                            remoteType: sub.jobs?.remote_type,
                                          }
                                        )}
                                      </span>
                                    </div>
                                  </Link>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    <span>{formatDate(sub.updated_at)}</span>
                                  </div>
                                  {clientNoteText(sub.client_notes) && (
                                    <div className="flex items-start gap-2 text-xs bg-muted/50 p-2 rounded">
                                      <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                      <span className="line-clamp-2">{clientNoteText(sub.client_notes)}</span>
                                    </div>
                                  )}
                                  {nextInterviewDate(sub) && (
                                    <div className="flex items-center gap-2 text-xs text-purple-600">
                                      <Calendar className="h-3 w-3" />
                                      <span>Interview: {nextInterviewDate(sub)}</span>
                                    </div>
                                  )}
                                  {sub.rejection_reason && (
                                    <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                                      {sub.rejection_reason}
                                    </div>
                                  )}
                                  
                                  {/* Quick Actions */}
                                  <QuickActions 
                                    submission={sub} 
                                    onPlaybookOpen={setSelectedPlaybookSubmission}
                                  />
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            </>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <Card>
              <CardContent className="p-0">
                {filteredSubmissions.length === 0 ? (
                  <div className="text-center py-16">
                    <User className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <h3 className="mt-4 text-lg font-semibold">Keine Einreichungen</h3>
                    <p className="text-muted-foreground">
                      {searchQuery || statusFilter !== 'all' 
                        ? 'Versuche andere Filter'
                        : 'Reiche deinen ersten Kandidaten ein'}
                    </p>
                    <Link to="/recruiter/jobs">
                      <Button className="mt-4">
                        Jobs durchsuchen <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredSubmissions.map(({ sub, stage }) => {
                      const behavior = getBehavior(sub);
                      const alertCount = getAlertCount(sub);

                      return (
                        <div key={sub.id} className="p-4 hover:bg-muted/30 transition-colors">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-full bg-gradient-navy flex items-center justify-center text-primary-foreground font-medium">
                                {sub.candidates?.full_name?.charAt(0) || '?'}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{sub.candidates?.full_name}</p>
                                  {alertCount > 0 && (
                                    <Badge variant="destructive" className="text-xs h-5">
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                      {alertCount}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">{sub.candidates?.email}</p>
                              </div>
                            </div>
                            
                            {/* Scores in List View */}
                            {behavior && (
                              <div className="hidden lg:flex items-center gap-4">
                                <div className="text-center">
                                  <div className="text-xs text-muted-foreground">Conf</div>
                                  <div className={`font-medium ${(behavior.confidence_score ?? 0) >= 70 ? 'text-green-600' : (behavior.confidence_score ?? 0) >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                                    {behavior.confidence_score ?? 0}%
                                  </div>
                                </div>
                                <div className="text-center">
                                  <div className="text-xs text-muted-foreground">Ready</div>
                                  <div className={`font-medium ${(behavior.interview_readiness_score ?? 0) >= 70 ? 'text-green-600' : (behavior.interview_readiness_score ?? 0) >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                                    {behavior.interview_readiness_score ?? 0}%
                                  </div>
                                </div>
                                <div className="text-center">
                                  <div className="text-xs text-muted-foreground">Close</div>
                                  <div className={`font-medium ${(behavior.closing_probability ?? 0) >= 70 ? 'text-green-600' : (behavior.closing_probability ?? 0) >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                                    {behavior.closing_probability ?? 0}%
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            <div className="hidden md:block text-right">
                              <Link to={`/recruiter/jobs/${sub.job_id}`} className="font-medium hover:underline">
                                {sub.jobs?.title}
                              </Link>
                              <p className="text-sm text-muted-foreground">
                                {getDisplayCompanyName(
                                  sub.jobs?.company_name || '',
                                  sub.jobs?.industry,
                                  sub.company_revealed,
                                  {
                                    industry: sub.jobs?.industry,
                                    companySize: sub.jobs?.company_size_band,
                                    fundingStage: sub.jobs?.funding_stage,
                                    techStack: sub.jobs?.tech_environment,
                                    location: sub.jobs?.location,
                                    urgency: sub.jobs?.hiring_urgency,
                                    remoteType: sub.jobs?.remote_type,
                                  }
                                )}
                              </p>
                            </div>
                            <div className="hidden lg:block text-sm text-muted-foreground">
                              {formatDate(sub.updated_at)}
                            </div>
                            {getStatusBadge(stage)}
                            
                            {/* Quick Actions in List */}
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0"
                                onClick={() => sub.candidates?.phone && window.open(`tel:${sub.candidates.phone}`, '_self')}
                                disabled={!sub.candidates?.phone}
                              >
                                <Phone className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0"
                                onClick={() => window.open(`mailto:${sub.candidates?.email}`, '_self')}
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0"
                                onClick={() => setSelectedPlaybookSubmission(sub.id)}
                              >
                                <BookOpen className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {clientNoteText(sub.client_notes) && (
                            <div className="mt-3 ml-14 text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                              <span className="font-medium">Feedback:</span>{' '}
                              {clientNoteText(sub.client_notes)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        
        {/* Playbook Selection Sheet */}
        <Sheet open={!!selectedPlaybookSubmission && !selectedPlaybook} onOpenChange={() => setSelectedPlaybookSubmission(null)}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Coaching Playbooks wählen</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-3">
              {playbooks.map((playbook) => (
                <Card 
                  key={playbook.id} 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedPlaybook(playbook)}
                >
                  <CardContent className="p-4">
                    <h4 className="font-medium">{playbook.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{playbook.description}</p>
                    <Badge variant="outline" className="mt-2">{playbook.trigger_type}</Badge>
                  </CardContent>
                </Card>
              ))}
              {playbooks.length === 0 && (
                <p className="text-muted-foreground text-center py-8">
                  Keine Playbooks verfügbar
                </p>
              )}
            </div>
          </SheetContent>
        </Sheet>
        
        {/* Playbook Viewer */}
        <PlaybookViewer 
          playbook={selectedPlaybook}
          open={!!selectedPlaybook}
          onClose={() => {
            setSelectedPlaybook(null);
            setSelectedPlaybookSubmission(null);
          }}
          candidateName={selectedPlaybookSubmission ? submissions.find(s => s.id === selectedPlaybookSubmission)?.candidates?.full_name : undefined}
          companyName={selectedPlaybookSubmission ? (() => {
            const sub = submissions.find(s => s.id === selectedPlaybookSubmission);
            if (!sub) return undefined;
            return getDisplayCompanyName(
              sub.jobs?.company_name || '',
              sub.jobs?.industry,
              sub.company_revealed,
              {
                industry: sub.jobs?.industry,
                companySize: sub.jobs?.company_size_band,
                fundingStage: sub.jobs?.funding_stage,
                techStack: sub.jobs?.tech_environment,
                location: sub.jobs?.location,
                urgency: sub.jobs?.hiring_urgency,
                remoteType: sub.jobs?.remote_type,
              }
            );
          })() : undefined}
        />
      </div>
    </DashboardLayout>
  );
}