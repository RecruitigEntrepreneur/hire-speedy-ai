import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fmtDate } from '@/lib/localeFormat';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BriefingNotesDialog } from '@/components/jobs/BriefingNotesDialog';
import { JobBoostDialog } from '@/components/jobs/JobBoostDialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { errorText, getJobsSearcherCounts, resumeJob } from '@/lib/jobSearch';
import { PauseJobDialog } from '@/components/client/job-manage/PauseJobDialog';
import { stellenVerlauf, verlaufDatum, type VerlaufJob } from '@/lib/stellenVerlauf';
import { VerlaufPunkte } from '@/components/dashboard/StellenVerlauf';
import {
  Plus, Search, Briefcase, Loader2, MoreVertical, Copy, Pause, Play, XCircle,
  Clock, AlertTriangle, Eye, Sparkles, ArrowRight, FileText, Zap, Trash2, Users,
} from 'lucide-react';

type LifecycleTab = 'active' | 'review' | 'drafts' | 'archive';

interface JobRow {
  id: string;
  title: string;
  status: string | null;
  location: string | null;
  employment_type: string | null;
  created_at: string;
  updated_at?: string | null;
  paused_at: string | null;
  briefing_notes: string | null;
  rejection_reason?: string | null;
  intake_completeness?: number | null;
  submissions_count: number;
  new_candidates: number;
  interviews_count: number;
  /** Headhunter, die gerade suchen (laufend oder ruhend) */
  searching: number;
  days_open: number;
  raw: Record<string, any>;
}

const tabOf = (j: JobRow): LifecycleTab =>
  j.status === 'published' ? 'active'
  : j.status === 'pending_approval' || j.status === 'pending_client_approval' ? 'review'
  : j.status === 'draft' ? 'drafts'
  : 'archive';

const returnedReason = (j: JobRow): string | null =>
  j.status === 'draft'
    ? j.rejection_reason ||
      (j.raw?.client_approval_note as string | null) ||
      (j.briefing_notes?.startsWith('[ABGELEHNT]') ? j.briefing_notes.split('\n')[0].replace('[ABGELEHNT]', '').trim() : null)
    : null;

const daysSince = (iso?: string | null) =>
  iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)) : 0;

const formatDate = (iso: string) => fmtDate(iso);

export default function JobsList() {
  const { t } = useTranslation(['clientJobs', 'clientDashboard']);
  const { user } = useAuth();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  // ?tab=review: das Abschlussfenster der Aufnahme fuehrt direkt zu "In Pruefung",
  // wo die gerade eingereichte Stelle steht.
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<LifecycleTab>(() => {
    const fromUrl = searchParams.get('tab');
    return fromUrl === 'review' || fromUrl === 'drafts' || fromUrl === 'archive' ? fromUrl : 'active';
  });
  const [chipFilter, setChipFilter] = useState<'returned' | 'stale' | 'waiting' | null>(null);
  const [pauseFor, setPauseFor] = useState<JobRow | null>(null);
  const [boostDialog, setBoostDialog] = useState({ open: false, jobId: '', jobTitle: '' });
  const [briefingDialog, setBriefingDialog] = useState({ open: false, jobId: '', jobTitle: '', notes: '' });

  useEffect(() => {
    if (user) fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /** 3 gebatchte Queries statt vorher ~3 pro Job (bei 26 Jobs: 78 Requests). */
  const fetchJobs = async () => {
    try {
      // Kein client_id-Filter mehr: RLS liefert alle Jobs, auf die der User
      // Zugriff hat (Admin/HR: alle Org-Jobs; Hiring Manager/Viewer: zugewiesene).
      const { data: jobsData, error } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const ids = (jobsData || []).map((j: any) => j.id);
      const subsByJob = new Map<string, { total: number; fresh: number }>();
      const ivByJob = new Map<string, number>();
      let searchingByJob: Record<string, number> = {};

      if (ids.length) {
        const [{ data: subs }, { data: ivs }, counts] = await Promise.all([
          supabase.from('submissions').select('job_id, status').in('job_id', ids),
          supabase.from('interviews').select('id, submissions!inner(job_id)').in('submissions.job_id', ids),
          getJobsSearcherCounts(ids).catch(() => ({} as Record<string, number>)),
        ]);
        searchingByJob = counts;
        for (const s of subs || []) {
          const e = subsByJob.get(s.job_id) || { total: 0, fresh: 0 };
          e.total += 1;
          if (s.status === 'submitted') e.fresh += 1;
          subsByJob.set(s.job_id, e);
        }
        for (const iv of ivs || []) {
          const jid = (iv as any).submissions?.job_id;
          if (jid) ivByJob.set(jid, (ivByJob.get(jid) || 0) + 1);
        }
      }

      setJobs(
        (jobsData || []).map((j: any) => ({
          id: j.id,
          title: j.title,
          status: j.status,
          location: j.location,
          employment_type: j.employment_type,
          created_at: j.created_at,
          updated_at: j.updated_at,
          paused_at: j.paused_at,
          briefing_notes: j.briefing_notes,
          rejection_reason: j.rejection_reason ?? null,
          intake_completeness: j.intake_completeness ?? null,
          submissions_count: subsByJob.get(j.id)?.total || 0,
          new_candidates: subsByJob.get(j.id)?.fresh || 0,
          interviews_count: ivByJob.get(j.id) || 0,
          searching: searchingByJob[j.id] || 0,
          days_open: daysSince(j.created_at),
          raw: j,
        })),
      );
    } catch (e) {
      console.error('Error fetching jobs:', e);
      toast({ title: t('list.loadError'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ---- Aktionen ------------------------------------------------------------

  // Eine Aufnahme fuer alles: dieselbe wie auf dem Dashboard und unter /start.
  const navigate = useNavigate();
  const openInStudio = (j: JobRow) => navigate(`/dashboard/aufnahme/${j.id}`, { state: { from: '/dashboard/jobs' } });

  const handleDuplicate = async (j: JobRow) => {
    // Alle Inhaltsfelder mitkopieren (vorher gingen description/skills/briefing verloren)
    const r = j.raw;
    const { error } = await supabase.from('jobs').insert({
      client_id: user?.id,
      title: t('list.copyTitle', { title: j.title }),
      company_name: r.company_name,
      description: r.description,
      requirements: r.requirements,
      location: r.location,
      remote_type: r.remote_type,
      employment_type: r.employment_type,
      experience_level: r.experience_level,
      salary_min: r.salary_min,
      salary_max: r.salary_max,
      skills: r.skills,
      must_haves: r.must_haves,
      nice_to_haves: r.nice_to_haves,
      briefing_notes: r.briefing_notes,
      industry: r.industry,
      vacancy_reason: r.vacancy_reason,
      reports_to: r.reports_to,
      hiring_urgency: r.hiring_urgency,
      status: 'draft',
    } as any);
    if (error) {
      toast({ title: t('list.duplicateError'), variant: 'destructive' });
      return;
    }
    toast({ title: t('list.duplicated') });
    fetchJobs();
  };

  // Pausieren mit Ende und Grund (Fenster), Weitersuchen direkt; Schließen fragt
  // auf der Stellenseite nach dem Grund (dort sind die Kandidaten für „besetzt“).
  const handleResume = async (j: JobRow) => {
    try {
      await resumeJob(j.id);
      toast({ title: t('list.resumed') });
      fetchJobs();
    } catch (e) {
      toast({ title: errorText(e), variant: 'destructive' });
    }
  };

  const handleDeleteDraft = async (j: JobRow) => {
    const { error } = await supabase.from('jobs').delete().eq('id', j.id).eq('status', 'draft');
    if (error) {
      toast({ title: t('list.deleteError'), variant: 'destructive' });
      return;
    }
    toast({ title: t('list.deleted') });
    fetchJobs();
  };

  const handleWithdraw = async (j: JobRow) => {
    const { error } = await supabase.from('jobs').update({ status: 'draft' }).eq('id', j.id);
    if (!error) {
      toast({ title: t('list.withdrawn') });
      fetchJobs();
    }
  };

  // ---- Ableitungen -----------------------------------------------------------

  const counts = useMemo(() => {
    const c = { active: 0, review: 0, drafts: 0, archive: 0, returned: 0, stale: 0, waiting: 0 };
    for (const j of jobs) {
      c[tabOf(j)] += 1;
      if (returnedReason(j)) c.returned += 1;
      if (j.status === 'published' && !j.paused_at && j.submissions_count === 0 && j.days_open > 14) c.stale += 1;
      if (j.status === 'published' && j.new_candidates > 0) c.waiting += j.new_candidates;
    }
    return c;
  }, [jobs]);

  const visible = useMemo(() => {
    let list = jobs.filter((j) => tabOf(j) === tab);
    if (chipFilter === 'returned') list = jobs.filter((j) => !!returnedReason(j));
    if (chipFilter === 'stale') list = jobs.filter((j) => j.status === 'published' && !j.paused_at && j.submissions_count === 0 && j.days_open > 14);
    if (chipFilter === 'waiting') list = jobs.filter((j) => j.status === 'published' && j.new_candidates > 0);
    const q = searchQuery.trim().toLowerCase();
    if (q) list = list.filter((j) => j.title.toLowerCase().includes(q) || (j.location || '').toLowerCase().includes(q));
    return list;
  }, [jobs, tab, chipFilter, searchQuery]);

  const TABS: { key: LifecycleTab; label: string }[] = [
    { key: 'active', label: t('list.tab.active') },
    { key: 'review', label: t('list.tab.review') },
    { key: 'drafts', label: t('list.tab.drafts') },
    { key: 'archive', label: t('list.tab.archive') },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('list.title')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('list.counts', { active: counts.active, review: counts.review, drafts: counts.drafts })}
            </p>
          </div>
          <Button variant="hero" size="sm" onClick={() => navigate('/dashboard/aufnahme', { state: { from: '/dashboard/jobs' } })}>
            <Plus className="mr-2 h-4 w-4" />
            {t('list.newJob')}
          </Button>
        </div>

        {/* Dringlichkeits-Chips — nur wenn es wirklich etwas gibt */}
        {(counts.returned > 0 || counts.waiting > 0 || counts.stale > 0) && (
          <div className="flex flex-wrap gap-2">
            {counts.returned > 0 && (
              <button
                onClick={() => setChipFilter(chipFilter === 'returned' ? null : 'returned')}
                aria-pressed={chipFilter === 'returned'}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 transition-all hover:bg-amber-500/15 dark:text-amber-400',
                  chipFilter === 'returned' && 'ring-2 ring-amber-500/40',
                )}
              >
                <AlertTriangle className="h-3.5 w-3.5" /> {t('list.chipReturned', { count: counts.returned })}
              </button>
            )}
            {counts.waiting > 0 && (
              <button
                onClick={() => setChipFilter(chipFilter === 'waiting' ? null : 'waiting')}
                aria-pressed={chipFilter === 'waiting'}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-all hover:bg-primary/15',
                  chipFilter === 'waiting' && 'ring-2 ring-primary/40',
                )}
              >
                <Eye className="h-3.5 w-3.5" /> {t('list.chipWaiting', { count: counts.waiting })}
              </button>
            )}
            {counts.stale > 0 && (
              <button
                onClick={() => setChipFilter(chipFilter === 'stale' ? null : 'stale')}
                aria-pressed={chipFilter === 'stale'}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive transition-all hover:bg-destructive/15',
                  chipFilter === 'stale' && 'ring-2 ring-destructive/40',
                )}
              >
                <Clock className="h-3.5 w-3.5" /> {t('list.chipStale', { count: counts.stale })}
              </button>
            )}
          </div>
        )}

        {/* Tabs + Suche */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1 rounded-lg border p-1">
            {TABS.map((x) => (
              <Button
                key={x.key}
                variant={tab === x.key && !chipFilter ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => {
                  setTab(x.key);
                  setChipFilter(null);
                }}
              >
                {x.label}
                <span className="text-muted-foreground">{counts[x.key]}</span>
              </Button>
            ))}
          </div>
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('list.searchPh')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-8"
            />
          </div>
        </div>

        {/* Liste */}
        {visible.length === 0 ? (
          <Card className="border-dashed border-border/50">
            <CardContent className="flex items-center justify-center gap-4 py-10">
              <Briefcase className="h-8 w-8 text-muted-foreground/40" />
              <div>
                <h3 className="text-sm font-medium">
                  {searchQuery || chipFilter ? t('list.empty.filtered') : tab === 'drafts' ? t('list.empty.drafts') : tab === 'review' ? t('list.empty.review') : tab === 'archive' ? t('list.empty.archive') : t('list.empty.active')}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {searchQuery || chipFilter ? t('list.empty.filteredLead') : t('list.empty.lead')}
                </p>
              </div>
              {!searchQuery && !chipFilter && tab === 'active' && (
                <Button variant="hero" size="sm" onClick={() => navigate('/dashboard/aufnahme', { state: { from: '/dashboard/jobs' } })}>
                  {t('list.newJob')}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1.5" data-tour="jobs.main">
            {visible.map((j) => {
              const returned = returnedReason(j);
              const lifecycle = tabOf(j);
              // Derselbe Verlauf wie im Job-Detail (lib/stellenVerlauf).
              const verlauf = stellenVerlauf(j.raw as VerlaufJob, { kandidaten: j.submissions_count });
              return (
                <div
                  key={j.id}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:border-primary/30',
                    returned ? 'border-amber-500/40' : 'border-border/50',
                  )}
                >
                  <Link to={`/dashboard/jobs/${j.id}`} className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-semibold capitalize transition-colors group-hover:text-primary">
                        {j.title}
                      </h3>
                      {lifecycle === 'active' && !j.paused_at && (
                        <Badge variant="outline" className="h-5 border-emerald-500/40 px-1.5 text-[10px] text-emerald-600">{t('list.badge.active')}</Badge>
                      )}
                      {lifecycle === 'active' && j.paused_at && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                          {j.raw?.pause_until ? t('list.badge.pausedUntil', { date: formatDate(j.raw.pause_until) }) : t('list.badge.pausedSince', { date: formatDate(j.paused_at) })}
                        </Badge>
                      )}
                      {lifecycle === 'active' && !j.paused_at && j.submissions_count === 0 && j.days_open > 14 && (
                        <Badge variant="outline" className="h-5 border-amber-500/40 px-1.5 text-[10px] text-amber-600">
                          {t('list.badge.noCandidates', { days: j.days_open })}
                        </Badge>
                      )}
                      {lifecycle === 'review' && (
                        <Badge variant="outline" className="h-5 gap-1 border-amber-500/40 px-1.5 text-[10px] text-amber-600">
                          <Clock className="h-3 w-3" />
                          {verlauf?.kurz ?? t('clientDashboard:verlauf.short.pruefung')}
                        </Badge>
                      )}
                      {verlauf?.aktuell && (lifecycle === 'review' || (lifecycle === 'active' && !j.paused_at)) && (
                        <VerlaufPunkte verlauf={verlauf} />
                      )}
                      {lifecycle === 'drafts' && !returned && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                          {j.intake_completeness ? t('list.badge.draftReady', { pct: j.intake_completeness }) : t('list.badge.draft')}
                        </Badge>
                      )}
                      {returned && (
                        <Badge variant="outline" className="h-5 max-w-[280px] gap-1 truncate border-amber-500/50 px-1.5 text-[10px] text-amber-600">
                          <AlertTriangle className="h-3 w-3 shrink-0" /> {t('list.badge.returned', { reason: returned })}
                        </Badge>
                      )}
                      {lifecycle === 'archive' && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{t('list.badge.closed')}</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {lifecycle === 'active' && (
                        <>
                          {j.searching > 0 ? (
                            <span className="text-emerald-600">{t('list.searching', { count: j.searching })}</span>
                          ) : (
                            <span>{t('searchers.none')}</span>
                          )}
                          {t('list.activeLine', { candidates: j.submissions_count, interviews: j.interviews_count })}{j.new_candidates > 0 ? t('list.newToReview', { count: j.new_candidates }) : ''}
                        </>
                      )}
                      {lifecycle === 'review' && verlauf?.aktuell &&
                        [
                          `${verlauf.aktuell.label} · ${verlauf.aktuell.hinweis ?? ''}`,
                          verlauf.schritte[0].datum ? t('list.submittedOn', { date: verlaufDatum(verlauf.schritte[0].datum) }) : null,
                        ].filter(Boolean).join(' · ')}
                      {lifecycle === 'drafts' && `${t('list.lastEdited', { count: daysSince(j.updated_at || j.created_at) })}${j.location ? ` · ${j.location}` : ''}`}
                      {lifecycle === 'archive' && t('list.archiveLine', { count: j.submissions_count })}
                    </p>
                  </Link>

                  {/* Primäraktion je Zustand */}
                  {lifecycle === 'active' && !j.paused_at && j.submissions_count === 0 && j.days_open > 7 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 gap-1 border-amber-500/40 text-xs text-amber-600"
                      onClick={() => setBoostDialog({ open: true, jobId: j.id, jobTitle: j.title })}
                    >
                      <Zap className="h-3.5 w-3.5" /> Boost
                    </Button>
                  )}
                  {lifecycle === 'active' && (
                    <Button asChild variant="outline" size="sm" className="h-8 shrink-0 gap-1 text-xs">
                      <Link to={`/dashboard/candidates?job=${j.id}&tab=alle`}>
                        <Users className="h-3.5 w-3.5" /> {t('list.applicants')}{j.submissions_count > 0 ? ` (${j.submissions_count})` : ''}
                      </Link>
                    </Button>
                  )}
                  {lifecycle === 'drafts' && !returned && (
                    <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1 border-primary/40 text-xs text-primary" onClick={() => openInStudio(j)}>
                      <Sparkles className="h-3.5 w-3.5" /> {t('list.continueIntake')}
                    </Button>
                  )}
                  {returned && (
                    <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1 border-amber-500/40 text-xs text-amber-600" onClick={() => openInStudio(j)}>
                      {t('list.completeSubmit')} <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {/* Sekundäraktionen */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" aria-label={t('list.moreActions')}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      {lifecycle === 'active' && (
                        <>
                          {j.paused_at ? (
                            <DropdownMenuItem onClick={() => handleResume(j)}>
                              <Play className="mr-2 h-4 w-4" /> {t('manage.resume')}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => setPauseFor(j)}>
                              <Pause className="mr-2 h-4 w-4" /> {t('manage.pause')}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => setBriefingDialog({ open: true, jobId: j.id, jobTitle: j.title, notes: j.briefing_notes || '' })}>
                            <FileText className="mr-2 h-4 w-4" /> {t('list.briefingNotes')}
                          </DropdownMenuItem>
                        </>
                      )}
                      {lifecycle === 'review' && (
                        <DropdownMenuItem onClick={() => handleWithdraw(j)}>
                          <XCircle className="mr-2 h-4 w-4" /> {t('list.withdraw')}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleDuplicate(j)}>
                        <Copy className="mr-2 h-4 w-4" /> {t('list.duplicate')}
                      </DropdownMenuItem>
                      {lifecycle === 'active' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => navigate(`/dashboard/jobs/${j.id}?schliessen=1`)} className="text-destructive focus:text-destructive">
                            <XCircle className="mr-2 h-4 w-4" /> {t('manage.close')}
                          </DropdownMenuItem>
                        </>
                      )}
                      {lifecycle === 'drafts' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDeleteDraft(j)} className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> {t('list.deleteDraft')}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}

        {/* Dialoge */}
        <JobBoostDialog
          open={boostDialog.open}
          onOpenChange={(open) => setBoostDialog((p) => ({ ...p, open }))}
          jobId={boostDialog.jobId}
          jobTitle={boostDialog.jobTitle}
        />
        <BriefingNotesDialog
          open={briefingDialog.open}
          onOpenChange={(open) => setBriefingDialog((p) => ({ ...p, open }))}
          jobId={briefingDialog.jobId}
          jobTitle={briefingDialog.jobTitle}
          initialNotes={briefingDialog.notes}
          onSaved={fetchJobs}
        />

      </div>
      {pauseFor && (
        <PauseJobDialog
          open
          onOpenChange={(o) => { if (!o) setPauseFor(null); }}
          jobId={pauseFor.id}
          jobTitle={pauseFor.title}
          onDone={fetchJobs}
        />
      )}
    </DashboardLayout>
  );
}
