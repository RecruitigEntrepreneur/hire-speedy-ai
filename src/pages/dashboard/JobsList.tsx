import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, UserRound, Copy, Loader2, MoreHorizontal, Pause, Play, Plus, Trash2, XCircle } from 'lucide-react';
import i18n from '@/i18n';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { avatarUrl, errorText, getJobSearchers, getJobsSearcherCounts, resumeJob, type JobSearcher } from '@/lib/jobSearch';
import { PauseJobDialog } from '@/components/client/job-manage/PauseJobDialog';
import { JobPrepChecklist } from '@/components/client/job/JobPrepChecklist';
import { ClientTaskWindow } from '@/components/client/tasks/ClientTaskWindow';
import { JobsAnalytics } from '@/components/client/jobs/JobsAnalytics';
import { stellenVerlauf, verlaufDatum, type VerlaufJob } from '@/lib/stellenVerlauf';
import { useBewerber, type BewerberItem } from '@/hooks/useBewerber';
import { useClientInterviewAgenda, type AgendaInterview } from '@/hooks/useClientInterviewAgenda';
import { taskHref, useClientTasks, type ClientNewsItem, type ClientTask } from '@/lib/clientTasksApi';
import { useMyOrganization } from '@/hooks/useOrganization';
import { useTeamData } from '@/hooks/useTeamData';
import { fmtDate, fmtTime, fmtWeekdayDayMonth } from '@/lib/localeFormat';
import { experienceBandLabel, regionLabel } from '@/lib/clientCandidateLabels';

/**
 * Meine Stellen (15.11.2026, Etappe 1): Kopf mit einem Satz, Reiter, Filter über Gesichter
 * und Fokus-Schalter, große Jobkarten (Weg der Stelle, wer sucht, ein Ereignis, ein Knopf),
 * In Prüfung mit Schritten, Entwürfe mit „was fehlt“, Archiv mit Ergebnis, Auswertung.
 */

type Tab = 'active' | 'review' | 'drafts' | 'archive' | 'analytics';
const TABS: Tab[] = ['active', 'review', 'drafts', 'archive', 'analytics'];
const URL_TAB: Record<string, Tab> = { review: 'review', drafts: 'drafts', archive: 'archive', auswertung: 'analytics' };

interface JobRow {
  id: string;
  title: string;
  status: string | null;
  location: string | null;
  employment_type: string | null;
  created_at: string;
  updated_at: string | null;
  paused_at: string | null;
  client_id: string | null;
  submissions_count: number;
  searching: number;
  raw: Record<string, any>;
}

const DAY = 86_400_000;
const daysSince = (iso?: string | null) => (iso ? Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / DAY)) : 0);
const tabOf = (j: JobRow): Exclude<Tab, 'analytics'> =>
  j.status === 'published' ? 'active'
  : j.status === 'pending_approval' || j.status === 'pending_client_approval' ? 'review'
  : j.status === 'draft' ? 'drafts'
  : 'archive';
const returnedReason = (j: JobRow): string | null =>
  j.status === 'draft'
    ? j.raw?.rejection_reason || (j.raw?.client_approval_note as string | null)
      || (j.raw?.briefing_notes?.startsWith('[ABGELEHNT]') ? String(j.raw.briefing_notes).split('\n')[0].replace('[ABGELEHNT]', '').trim() : null)
    : null;

/** Fehlende Angaben eines Entwurfs nach festen Regeln (vier Gruppen). */
function missingOf(j: JobRow): string[] {
  const r = j.raw ?? {};
  const out: string[] = [];
  const hasText = (v: unknown) => typeof v === 'string' && v.trim().length > 20;
  if (!hasText(r.description)) out.push('tasks');
  if (!(r.must_haves?.length || r.skills?.length || hasText(r.requirements))) out.push('requirements');
  if (!(r.salary_min || r.salary_max || r.day_rate_min || r.day_rate_max)) out.push('pay');
  if (!(r.location || r.remote_type === 'remote')) out.push('location');
  return out;
}

/** Weg der Stelle: 0 Suche · 1 Vorschläge · 2 Interviews · 3 Angebot · 4 Besetzt. */
function stageOf(items: BewerberItem[]): number {
  if (items.some((i) => i.archiveKind === 'eingestellt')) return 4;
  const run = items.filter((i) => i.tab !== 'archiv');
  if (run.some((i) => i.tab === 'angebot')) return 3;
  if (run.some((i) => i.tab === 'interview') || items.some((i) => i.requestedAt)) return 2;
  if (items.length > 0) return 1;
  return 0;
}

/** Zwei Werktage nach einem Datum (für „voraussichtlich live“). */
function plusWorkdays(iso: string, n: number) {
  const d = new Date(iso);
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) left -= 1;
  }
  return d;
}

export default function JobsList() {
  const { t } = useTranslation(['clientJobs', 'clientDashboard']);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>(() => URL_TAB[searchParams.get('tab') ?? ''] ?? 'active');
  const [owner, setOwner] = useState<string | null>(null);
  const [focus, setFocus] = useState(false);
  const [kind, setKind] = useState<string | null>(null);
  const [sort, setSort] = useState<'urgent' | 'newest' | 'oldest' | 'candidates' | 'title'>('urgent');
  const [pauseFor, setPauseFor] = useState<JobRow | null>(null);
  const [activeTask, setActiveTask] = useState<ClientTask | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showResting, setShowResting] = useState(false);
  const [searchers, setSearchers] = useState<Record<string, { rows: JobSearcher[]; photos: (string | null)[] }>>({});

  const bewerber = useBewerber({ tab: null, jobId: null, search: '', sort: 'newest' });
  const items = bewerber.allItems;
  const tasks = useClientTasks();
  const { data: agenda } = useClientInterviewAgenda();
  const { organization: myOrg, myRole, isAdmin } = useMyOrganization();
  const team = useTeamData(myOrg?.id);

  useEffect(() => {
    if (user) void fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchJobs = async () => {
    try {
      // RLS liefert alle Stellen, auf die der Nutzer Zugriff hat (Team-Rollen).
      const { data, error } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const ids = (data || []).map((j: any) => j.id);
      const subs = new Map<string, number>();
      let counts: Record<string, number> = {};
      if (ids.length) {
        const [{ data: s }, c] = await Promise.all([
          supabase.from('submissions').select('job_id').in('job_id', ids),
          getJobsSearcherCounts(ids).catch(() => ({} as Record<string, number>)),
        ]);
        counts = c;
        for (const x of s || []) subs.set(x.job_id, (subs.get(x.job_id) || 0) + 1);
      }
      const rows: JobRow[] = (data || []).map((j: any) => ({
        id: j.id, title: j.title, status: j.status, location: j.location, employment_type: j.employment_type,
        created_at: j.created_at, updated_at: j.updated_at ?? null, paused_at: j.paused_at, client_id: j.client_id ?? null,
        submissions_count: subs.get(j.id) || 0, searching: counts[j.id] || 0, raw: j,
      }));
      setJobs(rows);
      // Fotos der Suchenden nur für laufende Stellen
      const live = rows.filter((r) => r.status === 'published');
      const entries = await Promise.all(live.map(async (r) => {
        const list = (await getJobSearchers(r.id).catch(() => [])) ?? [];
        const current = list.filter((x) => x.status !== 'ended');
        const photos = await Promise.all(current.slice(0, 3).map((x) => avatarUrl(x.avatar_path).catch(() => null)));
        return [r.id, { rows: current, photos }] as const;
      }));
      setSearchers(Object.fromEntries(entries));
    } catch (e) {
      console.error('Error fetching jobs:', e);
      toast({ title: t('list.loadError'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ---- Aktionen
  const openIntake = (j: JobRow) => navigate(`/dashboard/aufnahme/${j.id}`, { state: { from: '/dashboard/jobs' } });
  const newJob = () => navigate('/dashboard/aufnahme', { state: { from: '/dashboard/jobs' } });
  const duplicate = async (j: JobRow) => {
    const r = j.raw;
    const { error } = await supabase.from('jobs').insert({
      client_id: user?.id, title: t('list.copyTitle', { title: j.title }), company_name: r.company_name, description: r.description,
      requirements: r.requirements, location: r.location, remote_type: r.remote_type, employment_type: r.employment_type,
      experience_level: r.experience_level, salary_min: r.salary_min, salary_max: r.salary_max, skills: r.skills,
      must_haves: r.must_haves, nice_to_haves: r.nice_to_haves, industry: r.industry, vacancy_reason: r.vacancy_reason,
      reports_to: r.reports_to, hiring_urgency: r.hiring_urgency, status: 'draft',
    } as any);
    if (error) { toast({ title: t('list.duplicateError'), variant: 'destructive' }); return; }
    toast({ title: t('list.duplicated') });
    setTab('drafts');
    void fetchJobs();
  };
  const resume = async (j: JobRow) => {
    try { await resumeJob(j.id); toast({ title: t('list.resumed') }); void fetchJobs(); }
    catch (e) { toast({ title: errorText(e), variant: 'destructive' }); }
  };
  const withdraw = async (j: JobRow) => {
    const { error } = await supabase.from('jobs').update({ status: 'draft' }).eq('id', j.id);
    if (!error) { toast({ title: t('list.withdrawn') }); void fetchJobs(); }
  };
  const deletePicked = async () => {
    const ids = picked.filter((id) => jobs.find((j) => j.id === id)?.status === 'draft');
    if (!ids.length) return;
    const { error } = await supabase.from('jobs').delete().in('id', ids).eq('status', 'draft');
    setConfirmDelete(false);
    if (error) { toast({ title: t('list.deleteError'), variant: 'destructive' }); return; }
    toast({ title: t('jobs2.drafts.deleted', { count: ids.length }) });
    setPicked([]);
    void fetchJobs();
  };
  const openTask = (task: ClientTask) => (task.submissionId ? navigate(taskHref(task)) : setActiveTask(task));

  // ---- Ableitungen
  const names = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of team.data?.members ?? []) if (x.user_id) m.set(x.user_id, x.full_name || x.email || '');
    return m;
  }, [team.data]);
  // Eigener Name für Initialen (Team-Liste enthält einen selbst nicht immer).
  const myName = names.get(user?.id ?? '') || (user?.user_metadata?.full_name as string | undefined) || user?.email || '';
  const ownerName = (id: string | null) => (!id ? null : id === user?.id ? t('jobs2.me') : names.get(id) || null);
  const itemsByJob = useMemo(() => {
    const m = new Map<string, BewerberItem[]>();
    for (const i of items) m.set(i.jobId, [...(m.get(i.jobId) ?? []), i]);
    return m;
  }, [items]);
  const tasksByJob = useMemo(() => {
    const m = new Map<string, ClientTask[]>();
    for (const x of tasks.data?.tasks ?? []) if (x.jobId) m.set(x.jobId, [...(m.get(x.jobId) ?? []), x]);
    return m;
  }, [tasks.data]);
  const newsByJob = useMemo(() => {
    const jobOfSub = new Map(items.map((i) => [i.submissionId, i.jobId]));
    const m = new Map<string, ClientNewsItem[]>();
    for (const x of tasks.data?.news ?? []) { const jid = jobOfSub.get(x.submissionId); if (jid) m.set(jid, [...(m.get(jid) ?? []), x]); }
    return m;
  }, [tasks.data, items]);
  const counts = useMemo(() => {
    const c: Record<Tab, number> = { active: 0, review: 0, drafts: 0, archive: 0, analytics: 0 };
    for (const j of jobs) c[tabOf(j)] += 1;
    return c;
  }, [jobs]);
  const active = jobs.filter((j) => tabOf(j) === 'active');
  const withTasks = active.filter((j) => (tasksByJob.get(j.id) ?? []).length > 0);
  const oldestTaskOf = (j: JobRow) => Math.max(0, ...(tasksByJob.get(j.id) ?? []).map((x) => daysSince(x.since)));
  const longest = [...withTasks].sort((a, b) => oldestTaskOf(b) - oldestTaskOf(a))[0];

  const inTab = (tab === 'analytics' ? [] : jobs.filter((j) => tabOf(j) === tab));
  // Gesichter: ich zuerst, dann alle aktiven Teammitglieder (auch ohne eigene Stelle), dazu weitere Ersteller.
  const owners = useMemo(() => {
    const m = new Map<string, number>();
    if (user?.id) m.set(user.id, 0);
    for (const x of team.data?.members ?? []) if (x.user_id && x.status === 'active') m.set(x.user_id, m.get(x.user_id) ?? 0);
    for (const j of inTab) if (j.client_id) m.set(j.client_id, (m.get(j.client_id) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => Number(b[0] === user?.id) - Number(a[0] === user?.id) || b[1] - a[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, tab, user?.id, team.data]);
  const q = '';
  const kinds = [...new Set(inTab.map((j) => (j.employment_type ?? '').replace(/_/g, '-')).filter(Boolean))];
  const visible = inTab
    .filter((j) => !owner || j.client_id === owner)
    .filter((j) => !focus || (tasksByJob.get(j.id) ?? []).length > 0 || (tab === 'drafts' && !!returnedReason(j)))
    .filter((j) => !kind || (j.employment_type ?? '').replace(/_/g, '-') === kind)
    .sort((a, b) => {
      const date = (j: JobRow) => j.raw?.approved_at ?? j.updated_at ?? j.created_at;
      if (sort === 'newest') return date(b).localeCompare(date(a));
      if (sort === 'oldest') return date(a).localeCompare(date(b));
      if (sort === 'title') return a.title.localeCompare(b.title);
      if (sort === 'candidates') return b.submissions_count - a.submissions_count;
      if (tab === 'active') {
        const ta = (tasksByJob.get(a.id) ?? []).length, tb = (tasksByJob.get(b.id) ?? []).length;
        if (!!ta !== !!tb) return tb ? 1 : -1;
        if (ta && tb) return oldestTaskOf(b) - oldestTaskOf(a);
      }
      return date(b).localeCompare(date(a));
    });

  const sentence = active.length === 0
    ? t('jobs2.head.none')
    : withTasks.length === 0
      ? t('jobs2.head.calm', { count: active.length })
      : t('jobs2.head.turn', { count: active.length, turn: withTasks.length, title: longest?.title ?? '' });

  const copySources = jobs.filter((j) => j.status !== 'draft').slice(0, 6);

  if (loading) {
    return <DashboardLayout><div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl">
        {/* Kopf: ein Satz statt einer Zahlenzeile */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight">{t('list.title')}</h1>
            <p className="mt-2 max-w-2xl text-base text-muted-foreground">{sentence}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-1.5 rounded-full px-4"><Plus className="h-4 w-4" />{t('list.newJob')}<ChevronDown className="h-3.5 w-3.5 opacity-70" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuItem onClick={newJob}><Plus className="mr-2 h-4 w-4" />{t('jobs2.new.blank')}</DropdownMenuItem>
              {copySources.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[11px] font-normal uppercase tracking-wide text-muted-foreground">{t('jobs2.new.copyLabel')}</DropdownMenuLabel>
                  {copySources.map((j) => (
                    <DropdownMenuItem key={j.id} onClick={() => duplicate(j)}>
                      <Copy className="mr-2 h-4 w-4 shrink-0" /><span className="truncate">{j.title}</span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Reiter */}
        <nav className="mt-8 flex gap-6 overflow-x-auto border-b" aria-label={t('list.title')}>
          {TABS.map((x) => (
            <button key={x} type="button" onClick={() => { setTab(x); setOwner(null); setPicked([]); }}
              className={cn('shrink-0 border-b-2 px-0.5 pb-2.5 text-sm transition-colors', tab === x ? 'border-foreground font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              {t(`jobs2.tab.${x}`)}{x !== 'analytics' && <span className="ml-1.5 text-muted-foreground">{counts[x]}</span>}
            </button>
          ))}
        </nav>

        {tab !== 'analytics' && (
          <div className="mt-5 flex flex-wrap items-center gap-4">
            {/* Filter über Gesichter: wessen Stellen */}
            <div className="flex items-center gap-4">
              {owners.length > 1 && <FaceButton label={t('jobs2.filter.all')} initials={t('jobs2.filter.allShort')} on={!owner} onClick={() => setOwner(null)} />}
              {owners.map(([id, n]) => {
                const nm = (id === user?.id ? myName : null) || ownerName(id) || t('jobs2.filter.colleague');
                return <FaceButton key={id} label={`${id === user?.id ? t('jobs2.me') : nm.split(' ')[0]} · ${n}`} initials={nm.split(/[ @.]/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()} on={owner === id} onClick={() => setOwner(owner === id ? null : id)} />;
              })}
              {isAdmin && (
                <button type="button" onClick={() => navigate('/dashboard/team')} className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-dashed border-border"><Plus className="h-4 w-4" /></span>
                  {t('jobs2.filter.invite')}
                </button>
              )}
            </div>
            <div className="ml-auto flex items-center gap-3">
              {(tab === 'active' || tab === 'drafts') && (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Switch checked={focus} onCheckedChange={setFocus} />{t(tab === 'drafts' ? 'jobs2.filter.focusDrafts' : 'jobs2.filter.focus')}
                </label>
              )}
              {kinds.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 rounded-full">{kind ? i18n.t(`jobdetail.employment.${kind}`, { defaultValue: kind }) : t('jobs2.filter.allKinds')}<ChevronDown className="h-3.5 w-3.5 opacity-60" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setKind(null)}>{t('jobs2.filter.allKinds')}</DropdownMenuItem>
                    {kinds.map((k) => <DropdownMenuItem key={k} onClick={() => setKind(k)}>{i18n.t(`jobdetail.employment.${k}`, { defaultValue: k })}</DropdownMenuItem>)}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 rounded-full">{t(`jobs2.sort.${sort}`)}<ChevronDown className="h-3.5 w-3.5 opacity-60" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {(['urgent', 'newest', 'oldest', 'candidates', 'title'] as const).map((k) => (
                    <DropdownMenuItem key={k} onClick={() => setSort(k)}>{t(`jobs2.sort.${k}`)}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}

        <div className="mt-5" data-tour="jobs.main">
          {tab === 'analytics' ? (
            bewerber.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
              <JobsAnalytics
                items={items}
                title={t('list.title')}
                jobs={jobs.filter((j) => ['published', 'filled', 'closed'].includes(j.status ?? '')).map((j) => ({
                  id: j.id, title: j.title, status: j.status, approved_at: j.raw?.approved_at ?? null, created_at: j.created_at, closed_at: j.raw?.closed_at ?? null,
                }))}
              />
            )
          ) : visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center">
              <p className="text-sm font-medium">{owner || focus || kind ? t('list.empty.filtered') : t(`list.empty.${tab === 'active' ? 'active' : tab}`)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{owner || focus || kind ? t('list.empty.filteredLead') : t('list.empty.lead')}</p>
              {tab === 'active' && !owner && !focus && !kind && <Button className="mt-4 rounded-full" onClick={newJob}>{t('list.newJob')}</Button>}
            </div>
          ) : tab === 'active' ? (
            <div className="space-y-3">
              {visible.map((j) => (
                <ActiveCard
                  key={j.id}
                  job={j}
                  owner={ownerName(j.client_id)}
                  ownerFull={j.client_id === user?.id ? myName : null}
                  items={itemsByJob.get(j.id) ?? []}
                  news={newsByJob.get(j.id) ?? []}
                  searchers={searchers[j.id]}
                  nextInterview={(agenda?.agendaDays ?? []).flatMap((d) => d.items).filter((x) => x.jobId === j.id && x.scheduledAt && Date.parse(x.scheduledAt) > Date.now()).sort((a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!))[0] ?? null}
                  onPause={() => setPauseFor(j)}
                  onResume={() => resume(j)}
                  onDuplicate={() => duplicate(j)}
                />
              ))}
            </div>
          ) : tab === 'review' ? (
            <div className="space-y-4">
              {visible.map((j) => <ReviewCard key={j.id} job={j} owner={ownerName(j.client_id)} ownerFull={j.client_id === user?.id ? myName : null} onWithdraw={() => withdraw(j)} />)}
              {visible[0] && (
                <JobPrepChecklist jobId={visible[0].id} jobTitle={visible[0].title} organizationId={myOrg?.id ?? null} userId={user?.id} canInvite={isAdmin} isOwner={myRole ? myRole === 'owner' : true} />
              )}
            </div>
          ) : tab === 'drafts' ? (
            <DraftsList
              jobs={visible}
              ownerName={ownerName}
              picked={picked}
              onPick={(id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))}
              onPickAll={(ids) => setPicked((p) => (ids.every((id) => p.includes(id)) ? [] : ids))}
              onDelete={() => setConfirmDelete(true)}
              onOpen={openIntake}
              showResting={showResting}
              onToggleResting={() => setShowResting((v) => !v)}
            />
          ) : (
            <div className="space-y-3">
              {visible.map((j) => <ArchiveCard key={j.id} job={j} items={itemsByJob.get(j.id) ?? []} onDuplicate={() => duplicate(j)} />)}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('jobs2.drafts.confirmTitle', { count: picked.length })}</AlertDialogTitle>
            <AlertDialogDescription>{t('jobs2.drafts.confirmText')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={deletePicked} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t('jobs2.drafts.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ClientTaskWindow task={activeTask} open={!!activeTask} onOpenChange={(o) => { if (!o) { setActiveTask(null); void tasks.refetch(); } }} handlers={null} />
      {pauseFor && <PauseJobDialog open onOpenChange={(o) => { if (!o) setPauseFor(null); }} jobId={pauseFor.id} jobTitle={pauseFor.title} onDone={fetchJobs} />}
    </DashboardLayout>
  );
}

// ================================================================== Bausteine

function FaceButton({ label, initials, on, onClick }: { label: string; initials: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className="flex flex-col items-center gap-1 text-[11px]">
      <span className={cn('flex h-9 w-9 items-center justify-center rounded-full border-2 bg-card text-[11px] font-medium transition-colors', on ? 'border-foreground text-foreground' : 'border-border text-muted-foreground hover:border-foreground/40')}>{initials}</span>
      <span className={cn(on ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
    </button>
  );
}

function CardShell({ children, to }: { children: ReactNode; to?: string }) {
  const navigate = useNavigate();
  return (
    <div role={to ? 'link' : undefined} tabIndex={to ? 0 : undefined}
      onClick={to ? (e) => { if ((e.target as HTMLElement).closest('button,a,[role=menuitem],[role=checkbox]')) return; navigate(to); } : undefined}
      onKeyDown={to ? (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) navigate(to); } : undefined}
      className={cn('rounded-2xl border bg-card px-5 py-4 transition-colors', to && 'cursor-pointer hover:border-foreground/20')}>
      {children}
    </div>
  );
}

function OwnerTag({ name, initialsFrom }: { name: string | null; initialsFrom?: string }) {
  // Eigene Stellen ohne Hinweis; nur wenn jemand anderes verantwortlich ist (initialsFrom = null).
  if (!name || initialsFrom) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
      <span className="flex h-5 w-5 items-center justify-center rounded-full border bg-muted/50 text-[9px] font-medium">{(initialsFrom || name).split(/[ @.]/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</span>
      {name}
    </span>
  );
}

function metaLine(j: JobRow, extra?: string | null) {
  return [
    j.employment_type ? i18n.t(`jobdetail.employment.${j.employment_type.replace(/_/g, '-')}`, { defaultValue: j.employment_type }) : null,
    j.location,
    extra,
  ].filter(Boolean).join(' · ');
}

const STEPS = ['search', 'proposals', 'interviews', 'offer', 'hired'] as const;

function initialsOf(i: BewerberItem) {
  if (i.fullName) return i.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  // Anonym: Buchstaben aus dem Code (z. B. „PR-DA2295“ → „DA“), sonst Initialen der Rolle
  const letters = i.anonymizedName.replace(/^[A-Z]+-/, '').replace(/[^A-Za-z]/g, '');
  if (letters.length >= 2) return letters.slice(0, 2).toUpperCase();
  const role = (i.currentRole ?? '').split(/\s+/).filter((w) => /^[A-Za-zÄÖÜäöü]/.test(w));
  return role.length ? role.map((w) => w[0]).slice(0, 2).join('').toUpperCase() : '';
}

const HOT_DAYS = 7;

/**
 * Jobkarte Variante A (15.11.2026): rechts die Kandidaten als Kreise (neue mit Ring),
 * unten genau ein Höhepunkt nach fester Reihenfolge – Meilenstein, Termin heute/morgen,
 * neuer Kandidat – sonst ein ruhiger Satz; rechts unten wer sucht. Kein Aufgaben-Knopf:
 * ein Klick öffnet die Stelle, dort steht der passende Schritt.
 */
function ActiveCard({ job, owner, ownerFull, items, news, searchers, nextInterview, onPause, onResume, onDuplicate }: {
  job: JobRow; owner: string | null; ownerFull?: string | null; items: BewerberItem[]; news: ClientNewsItem[];
  searchers?: { rows: JobSearcher[]; photos: (string | null)[] }; nextInterview: AgendaInterview | null;
  onPause: () => void; onResume: () => void; onDuplicate: () => void;
}) {
  const { t } = useTranslation('clientJobs');
  const navigate = useNavigate();
  const stage = stageOf(items);
  const live = daysSince(job.raw?.approved_at ?? job.created_at);
  const running = items.filter((i) => i.tab !== 'archiv')
    .sort((a, b) => Number(b.tab === 'neu') - Number(a.tab === 'neu') || (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
  const fresh = running.filter((i) => i.tab === 'neu');
  const offer = items.find((i) => i.tab === 'angebot');
  const lastSub = items.map((i) => i.submittedAt).filter(Boolean).sort().pop() ?? null;
  const quiet = !job.paused_at && live >= 21 && daysSince(lastSub ?? job.raw?.approved_at ?? job.created_at) >= 21;
  const n = searchers?.rows.length ?? job.searching;

  // Höhepunkt: 1 Meilenstein · 2 Termin heute/morgen · 3 neuer Kandidat · sonst ruhig
  const milestone = news.filter((x) => daysSince(x.at) <= HOT_DAYS).sort((a, b) => b.at.localeCompare(a.at))[0];
  const ivDay = nextInterview?.scheduledAt ? new Date(nextInterview.scheduledAt) : null;
  const today = new Date(); const tomorrow = new Date(Date.now() + DAY);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const ivSoon = ivDay && (sameDay(ivDay, today) || sameDay(ivDay, tomorrow)) ? ivDay : null;
  const newest = fresh.find((i) => i.submittedAt && daysSince(i.submittedAt) <= HOT_DAYS);

  let highlight: ReactNode;
  if (milestone) {
    highlight = <><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" /><span className="truncate"><span className="font-medium text-foreground">{milestone.title}</span>{milestone.detail ? ` · ${milestone.detail}` : ''}</span></>;
  } else if (ivSoon && nextInterview) {
    highlight = <><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" /><span className="truncate"><span className="font-medium text-foreground">{sameDay(ivSoon, today) ? t('jobs2.card.today', { time: fmtTime(ivSoon) }) : t('jobs2.card.tomorrow', { time: fmtTime(ivSoon) })}</span> {t('jobs2.card.interviewWith', { name: nextInterview.candidateName })}</span></>;
  } else if (newest) {
    const facts = [newest.currentRole, newest.experienceBand && newest.experienceBand !== 'Nicht angegeben' ? experienceBandLabel(newest.experienceBand) : null, regionLabel(newest.region)].filter(Boolean).join(' · ');
    highlight = <><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" /><span className="truncate"><span className="font-medium text-foreground">{t('jobs2.card.new')}</span> {facts || newest.anonymizedName}</span></>;
  } else {
    highlight = <span className="truncate">{job.paused_at
      ? (job.raw?.pause_until ? t('jobs2.active.pausedUntil', { date: fmtDate(job.raw.pause_until) }) : t('jobs2.active.paused'))
      : offer ? t('jobs2.active.offer', { name: offer.fullName || offer.anonymizedName })
      : quiet ? t('jobs2.active.quiet', { count: daysSince(lastSub ?? job.raw?.approved_at) })
      : running.length ? t('jobs2.card.calm') : t('jobs2.card.searching')}</span>;
  }

  const shown = running.slice(0, 4);
  return (
    <CardShell to={`/dashboard/jobs/${job.id}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold tracking-tight">{job.title}</h3>
          <p className="text-[13px] text-muted-foreground">{metaLine(job, t('jobs2.since', { count: live }))}</p>
          <div className="mt-3 w-72 max-w-full">
            <div className="flex gap-1">{STEPS.map((st, i) => <span key={st} className={cn('h-1 flex-1 rounded-full', i <= stage ? 'bg-foreground' : 'bg-border')} />)}</div>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              {STEPS.map((st, i) => <span key={st} className={cn(i === stage && 'font-medium text-foreground')}>{t(`jobs2.step.${st}`)}</span>)}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-3">
          {running.length > 0 && (
            <div className="hidden text-right sm:block">
              <div className="flex justify-end -space-x-1.5">
                {shown.map((i) => {
                  const ini = initialsOf(i);
                  return (
                    <span key={i.submissionId} title={[i.fullName || i.currentRole || i.anonymizedName, i.tab === 'neu' ? t('jobs2.card.newOne') : null].filter(Boolean).join(' · ')}
                      className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-card bg-neutral-700 text-xs font-semibold text-neutral-100 ring-1 ring-neutral-600 dark:bg-neutral-200 dark:text-neutral-800 dark:ring-neutral-300">
                      {ini || <UserRound className="h-4 w-4 text-neutral-300 dark:text-neutral-500" />}
                      {i.tab === 'neu' && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-card bg-sky-500" />}
                    </span>
                  );
                })}
                {running.length > shown.length && <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-card bg-neutral-800 text-xs font-medium text-neutral-300 ring-1 ring-neutral-600 dark:bg-neutral-100 dark:text-neutral-600 dark:ring-neutral-300">+{running.length - shown.length}</span>}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {fresh.length > 0 && <><span className="font-medium text-sky-400 dark:text-sky-600">{t('jobs2.card.newCount', { count: fresh.length })}</span> · </>}
                {t('jobs2.card.running', { count: running.length })}
              </p>
            </div>
          )}
          <OwnerTag name={owner} initialsFrom={ownerFull ?? undefined} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="-mr-2 -mt-1 h-8 w-8 rounded-full text-muted-foreground" aria-label={t('list.moreActions')}><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {job.paused_at
                ? <DropdownMenuItem onClick={onResume}><Play className="mr-2 h-4 w-4" />{t('manage.resume')}</DropdownMenuItem>
                : <DropdownMenuItem onClick={onPause}><Pause className="mr-2 h-4 w-4" />{t('manage.pause')}</DropdownMenuItem>}
              <DropdownMenuItem onClick={onDuplicate}><Copy className="mr-2 h-4 w-4" />{t('list.duplicate')}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate(`/dashboard/jobs/${job.id}?schliessen=1`)} className="text-destructive focus:text-destructive"><XCircle className="mr-2 h-4 w-4" />{t('manage.close')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3 text-[13px] text-muted-foreground">
        <div className="flex min-w-0 items-center gap-2">{highlight}</div>
        <div className="flex shrink-0 items-center gap-2">
          {n > 0 && (
            <span className="flex -space-x-2">
              {(searchers?.photos.length ? searchers.photos : Array.from({ length: Math.min(n, 3) }, () => null)).map((p, i) => (
                p ? <img key={i} src={p} alt="" className="h-6 w-6 rounded-full border-2 border-card object-cover" />
                  : <span key={i} className="h-6 w-6 rounded-full border-2 border-card bg-muted" />
              ))}
            </span>
          )}
          <span>{n > 0 ? t('jobs2.active.searching', { count: n }) : t('jobs2.active.noSearcher')}</span>
        </div>
      </div>
    </CardShell>
  );
}

function ReviewCard({ job, owner, ownerFull, onWithdraw }: { job: JobRow; owner: string | null; ownerFull?: string | null; onWithdraw: () => void }) {
  const { t } = useTranslation('clientJobs');
  const navigate = useNavigate();
  const verlauf = stellenVerlauf(job.raw as VerlaufJob, { kandidaten: 0 });
  const steps = (verlauf?.schritte ?? []).filter((s) => s.key !== 'kandidaten');
  const atMatchunt = verlauf?.aktuell?.key === 'pruefung';
  const enteredReview = (job.raw?.client_approved_at as string | null) ?? (job.raw?.submitted_at as string | null) ?? job.updated_at;
  const etaRaw = atMatchunt && enteredReview ? plusWorkdays(enteredReview, 2) : null;
  // Liegt die übliche Dauer schon hinter uns, kein Datum versprechen.
  const overdue = !!etaRaw && etaRaw.getTime() < new Date().setHours(0, 0, 0, 0);
  const eta = overdue ? null : etaRaw;
  return (
    <CardShell>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold tracking-tight">{job.title}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{metaLine(job)}</p>
        </div>
        <div className="flex items-center gap-2">
          <OwnerTag name={owner} initialsFrom={ownerFull ?? undefined} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground" aria-label={t('list.moreActions')}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56"><DropdownMenuItem onClick={onWithdraw}><XCircle className="mr-2 h-4 w-4" />{t('jobs2.review.withdraw')}</DropdownMenuItem></DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="mt-5 grid max-w-xl gap-2" style={{ gridTemplateColumns: `repeat(${steps.length + (eta ? 0 : 0)}, minmax(0,1fr))` }}>
        {steps.map((s) => (
          <div key={s.key} className={cn('border-t-2 pt-2 text-[11px]', s.zustand === 'offen' ? 'border-border text-muted-foreground' : 'border-foreground')}>
            <p className="font-medium text-foreground">{s.zustand === 'erledigt' && s.datum ? verlaufDatum(s.datum) : s.zustand === 'aktuell' ? t('jobs2.review.now') : s.key === 'live' && eta ? fmtWeekdayDayMonth(eta) : '–'}</p>
            <p className="text-muted-foreground">{s.key === 'live' && eta ? t('jobs2.review.expectedLive') : s.label}</p>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function DraftsList({ jobs, ownerName, picked, onPick, onPickAll, onDelete, onOpen, showResting, onToggleResting }: {
  jobs: JobRow[]; ownerName: (id: string | null) => string | null; picked: string[]; onPick: (id: string) => void; onPickAll: (ids: string[]) => void;
  onDelete: () => void; onOpen: (j: JobRow) => void; showResting: boolean; onToggleResting: () => void;
}) {
  const { t } = useTranslation('clientJobs');
  const returned = jobs.filter((j) => !!returnedReason(j));
  const rest = jobs.filter((j) => !returnedReason(j));
  const working = rest.filter((j) => daysSince(j.updated_at ?? j.created_at) <= 60);
  const resting = rest.filter((j) => daysSince(j.updated_at ?? j.created_at) > 60);
  const ids = jobs.map((j) => j.id);
  const group = (title: string, list: JobRow[]) => list.length > 0 && (
    <div className="space-y-3">
      <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{title} · {list.length}</p>
      {list.map((j) => <DraftCard key={j.id} job={j} owner={ownerName(j.client_id)} picked={picked.includes(j.id)} onPick={() => onPick(j.id)} onOpen={() => onOpen(j)} />)}
    </div>
  );
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-2xl border bg-muted/30 px-5 py-2.5">
        <label className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={ids.length > 0 && ids.every((id) => picked.includes(id))} onCheckedChange={() => onPickAll(ids)} />{t('jobs2.drafts.pickAll')}</label>
        {picked.length > 0 && <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" />{t('jobs2.drafts.deleteCount', { count: picked.length })}</Button>}
      </div>
      {group(t('jobs2.drafts.returned'), returned)}
      {group(t('jobs2.drafts.working'), working)}
      {resting.length > 0 && (
        <div className="space-y-3">
          <button type="button" onClick={onToggleResting} className="flex items-center gap-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground">
            {t('jobs2.drafts.resting', { count: resting.length })}<ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showResting && 'rotate-180')} />
          </button>
          {showResting && resting.map((j) => <DraftCard key={j.id} job={j} owner={ownerName(j.client_id)} picked={picked.includes(j.id)} onPick={() => onPick(j.id)} onOpen={() => onOpen(j)} />)}
        </div>
      )}
    </div>
  );
}

function DraftCard({ job, owner, picked, onPick, onOpen }: { job: JobRow; owner: string | null; picked: boolean; onPick: () => void; onOpen: () => void }) {
  const { t } = useTranslation('clientJobs');
  const navigate = useNavigate();
  const reason = returnedReason(job);
  const missing = missingOf(job);
  const done = 4 - missing.length;
  return (
    <div className={cn('flex gap-4 rounded-2xl border bg-card px-5 py-4', reason && 'border-l-4 border-l-amber-500')}>
      <Checkbox checked={picked} onCheckedChange={onPick} className="mt-1.5" aria-label={t('jobs2.drafts.pick')} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold tracking-tight">{job.title}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {[owner, t('jobs2.drafts.lastEdited', { count: daysSince(job.updated_at ?? job.created_at) })].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => navigate(`/dashboard/jobs/${job.id}`)}>{t('jobs2.drafts.preview')}</Button>
            <Button size="sm" className="rounded-full px-4" onClick={onOpen}>{reason ? t('jobs2.drafts.rework') : missing.length ? t('jobs2.drafts.continue') : t('jobs2.drafts.submit')}</Button>
          </div>
        </div>
        {reason ? (
          <p className="mt-3 text-sm">{t('jobs2.drafts.returnedBecause', { reason })}</p>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="flex w-32 gap-1">{[0, 1, 2, 3].map((i) => <span key={i} className={cn('h-1 flex-1 rounded-full', i < done ? 'bg-foreground' : 'bg-border')} />)}</div>
            <span className="text-sm text-muted-foreground">
              {missing.length === 0 ? t('jobs2.drafts.complete') : t('jobs2.drafts.missing', { list: missing.map((m) => t(`jobs2.missing.${m}`)).join(', '), minutes: missing.length * 2 })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function ArchiveCard({ job, items, onDuplicate }: { job: JobRow; items: BewerberItem[]; onDuplicate: () => void }) {
  const { t } = useTranslation('clientJobs');
  const start = job.raw?.approved_at ?? job.created_at;
  const end = job.raw?.closed_at ?? job.updated_at;
  const hired = items.find((i) => i.archiveKind === 'eingestellt');
  const reason = job.raw?.closed_reason as string | null;
  const result = job.status === 'filled' || hired
    ? (hired ? t('jobs2.archive.filledWith', { name: hired.fullName || hired.anonymizedName, count: end ? Math.round((Date.parse(end) - Date.parse(start)) / DAY) : 0 }) : t('jobs2.archive.filled'))
    : reason ? t(`close.choice.${reason}`, { defaultValue: t('jobs2.archive.closed') }) : t('jobs2.archive.closed');
  return (
    <CardShell to={`/dashboard/jobs/${job.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold tracking-tight">{job.title}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{[result, end ? t('jobs2.archive.closedOn', { date: fmtDate(end) }) : null].filter(Boolean).join(' · ')}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={onDuplicate}><Copy className="h-3.5 w-3.5" />{t('jobs2.archive.again')}</Button>
      </div>
    </CardShell>
  );
}
