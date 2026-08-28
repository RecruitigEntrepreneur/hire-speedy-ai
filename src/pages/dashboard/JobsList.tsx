import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { JobIntakeStudio, type StudioDraft } from '@/components/dashboard/JobIntakeStudio';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
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

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function JobsList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState<LifecycleTab>('active');
  const [chipFilter, setChipFilter] = useState<'returned' | 'stale' | 'waiting' | null>(null);
  const [boostDialog, setBoostDialog] = useState({ open: false, jobId: '', jobTitle: '' });
  const [briefingDialog, setBriefingDialog] = useState({ open: false, jobId: '', jobTitle: '', notes: '' });
  const [studio, setStudio] = useState<{ open: boolean; draft: StudioDraft | null }>({ open: false, draft: null });

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

      if (ids.length) {
        const [{ data: subs }, { data: ivs }] = await Promise.all([
          supabase.from('submissions').select('job_id, status').in('job_id', ids),
          supabase.from('interviews').select('id, submissions!inner(job_id)').in('submissions.job_id', ids),
        ]);
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
          days_open: daysSince(j.created_at),
          raw: j,
        })),
      );
    } catch (e) {
      console.error('Error fetching jobs:', e);
      toast({ title: 'Fehler beim Laden', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ---- Aktionen ------------------------------------------------------------

  const openInStudio = (j: JobRow) => setStudio({ open: true, draft: { id: j.id, row: j.raw } });

  const handleDuplicate = async (j: JobRow) => {
    // Alle Inhaltsfelder mitkopieren (vorher gingen description/skills/briefing verloren)
    const r = j.raw;
    const { error } = await supabase.from('jobs').insert({
      client_id: user?.id,
      title: `${j.title} (Kopie)`,
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
      toast({ title: 'Fehler beim Duplizieren', variant: 'destructive' });
      return;
    }
    toast({ title: 'Als Entwurf dupliziert' });
    fetchJobs();
  };

  /** Nur für published: Pause/Weiter toggelt NUR paused_at — nie den Status.
   *  (Vorher konnte Reaktivieren jeden Status auf 'published' zwingen = Freigabe-Bypass.) */
  const handlePauseToggle = async (j: JobRow) => {
    const { error } = await supabase
      .from('jobs')
      .update({ paused_at: j.paused_at ? null : new Date().toISOString() })
      .eq('id', j.id);
    if (error) {
      toast({ title: 'Fehler', variant: 'destructive' });
      return;
    }
    toast({ title: j.paused_at ? 'Stelle reaktiviert' : 'Stelle pausiert' });
    fetchJobs();
  };

  const handleClose = async (j: JobRow) => {
    const { error } = await supabase.from('jobs').update({ status: 'closed' }).eq('id', j.id);
    if (!error) {
      toast({ title: 'Stelle geschlossen' });
      fetchJobs();
    }
  };

  const handleDeleteDraft = async (j: JobRow) => {
    const { error } = await supabase.from('jobs').delete().eq('id', j.id).eq('status', 'draft');
    if (error) {
      toast({ title: 'Löschen fehlgeschlagen', variant: 'destructive' });
      return;
    }
    toast({ title: 'Entwurf gelöscht' });
    fetchJobs();
  };

  const handleWithdraw = async (j: JobRow) => {
    const { error } = await supabase.from('jobs').update({ status: 'draft' }).eq('id', j.id);
    if (!error) {
      toast({ title: 'Aus der Prüfung zurückgezogen — wieder als Entwurf verfügbar.' });
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
    { key: 'active', label: 'Aktiv' },
    { key: 'review', label: 'In Freigabe' },
    { key: 'drafts', label: 'Entwürfe' },
    { key: 'archive', label: 'Archiv' },
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
            <h1 className="text-2xl font-bold tracking-tight">Meine Stellen</h1>
            <p className="text-sm text-muted-foreground">
              {counts.active} aktiv · {counts.review} in Freigabe · {counts.drafts} Entwürfe
            </p>
          </div>
          <Button variant="hero" size="sm" onClick={() => setStudio({ open: true, draft: null })}>
            <Plus className="mr-2 h-4 w-4" />
            Neue Stelle
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
                <AlertTriangle className="h-3.5 w-3.5" /> {counts.returned} zurückgegeben
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
                <Eye className="h-3.5 w-3.5" /> {counts.waiting} Kandidaten warten auf Review
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
                <Clock className="h-3.5 w-3.5" /> {counts.stale} Stelle{counts.stale > 1 ? 'n' : ''} lange ohne Kandidaten
              </button>
            )}
          </div>
        )}

        {/* Tabs + Suche */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1 rounded-lg border p-1">
            {TABS.map((t) => (
              <Button
                key={t.key}
                variant={tab === t.key && !chipFilter ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => {
                  setTab(t.key);
                  setChipFilter(null);
                }}
              >
                {t.label}
                <span className="text-muted-foreground">{counts[t.key]}</span>
              </Button>
            ))}
          </div>
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Stellen durchsuchen …"
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
                  {searchQuery || chipFilter ? 'Keine passenden Stellen' : tab === 'drafts' ? 'Keine Entwürfe' : tab === 'review' ? 'Nichts in der Freigabe' : tab === 'archive' ? 'Kein Archiv' : 'Noch keine aktive Stelle'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {searchQuery || chipFilter ? 'Filter anpassen oder zurücksetzen.' : 'Im Studio ist eine neue Stelle in Minuten angelegt.'}
                </p>
              </div>
              {!searchQuery && !chipFilter && tab === 'active' && (
                <Button variant="hero" size="sm" onClick={() => setStudio({ open: true, draft: null })}>
                  Neue Stelle
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1.5">
            {visible.map((j) => {
              const returned = returnedReason(j);
              const lifecycle = tabOf(j);
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
                        <Badge variant="outline" className="h-5 border-emerald-500/40 px-1.5 text-[10px] text-emerald-600">Aktiv</Badge>
                      )}
                      {lifecycle === 'active' && j.paused_at && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">Pausiert seit {formatDate(j.paused_at)}</Badge>
                      )}
                      {lifecycle === 'active' && !j.paused_at && j.submissions_count === 0 && j.days_open > 14 && (
                        <Badge variant="outline" className="h-5 border-amber-500/40 px-1.5 text-[10px] text-amber-600">
                          {j.days_open} d ohne Kandidaten
                        </Badge>
                      )}
                      {lifecycle === 'review' && (
                        <Badge variant="outline" className="h-5 gap-1 border-amber-500/40 px-1.5 text-[10px] text-amber-600">
                          <Clock className="h-3 w-3" />
                          {j.status === 'pending_client_approval' ? 'Interne Freigabe' : 'In Freigabe'}
                        </Badge>
                      )}
                      {lifecycle === 'drafts' && !returned && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                          Entwurf{j.intake_completeness ? ` · Reife ${j.intake_completeness} %` : ''}
                        </Badge>
                      )}
                      {returned && (
                        <Badge variant="outline" className="h-5 max-w-[280px] gap-1 truncate border-amber-500/50 px-1.5 text-[10px] text-amber-600">
                          <AlertTriangle className="h-3 w-3 shrink-0" /> Zurückgegeben: „{returned}"
                        </Badge>
                      )}
                      {lifecycle === 'archive' && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">Geschlossen</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {lifecycle === 'active' &&
                        `${j.submissions_count} Kandidaten · ${j.interviews_count} Interviews${j.new_candidates > 0 ? ` · ${j.new_candidates} neu zu prüfen` : ''}`}
                      {lifecycle === 'review' &&
                        (j.status === 'pending_client_approval'
                          ? `eingereicht am ${formatDate(j.updated_at || j.created_at)} · wartet auf interne Freigabe (Admin/HR)`
                          : `eingereicht am ${formatDate(j.updated_at || j.created_at)} · Prüfung i. d. R. unter 24 Std`)}
                      {lifecycle === 'drafts' && `zuletzt bearbeitet vor ${daysSince(j.updated_at || j.created_at)} Tagen${j.location ? ` · ${j.location}` : ''}`}
                      {lifecycle === 'archive' && `geschlossen · ${j.submissions_count} Kandidaten insgesamt`}
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
                        <Users className="h-3.5 w-3.5" /> Bewerber{j.submissions_count > 0 ? ` (${j.submissions_count})` : ''}
                      </Link>
                    </Button>
                  )}
                  {lifecycle === 'drafts' && !returned && (
                    <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1 border-primary/40 text-xs text-primary" onClick={() => openInStudio(j)}>
                      <Sparkles className="h-3.5 w-3.5" /> Weiter im Studio
                    </Button>
                  )}
                  {returned && (
                    <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1 border-amber-500/40 text-xs text-amber-600" onClick={() => openInStudio(j)}>
                      Ergänzen & einreichen <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {/* Sekundäraktionen */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" aria-label="Weitere Aktionen">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      {lifecycle === 'active' && (
                        <>
                          <DropdownMenuItem onClick={() => handlePauseToggle(j)}>
                            {j.paused_at ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}
                            {j.paused_at ? 'Reaktivieren' : 'Pausieren'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setBriefingDialog({ open: true, jobId: j.id, jobTitle: j.title, notes: j.briefing_notes || '' })}>
                            <FileText className="mr-2 h-4 w-4" /> Briefing-Notizen
                          </DropdownMenuItem>
                        </>
                      )}
                      {lifecycle === 'review' && (
                        <DropdownMenuItem onClick={() => handleWithdraw(j)}>
                          <XCircle className="mr-2 h-4 w-4" /> Aus Prüfung zurückziehen
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleDuplicate(j)}>
                        <Copy className="mr-2 h-4 w-4" /> Duplizieren
                      </DropdownMenuItem>
                      {lifecycle === 'active' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleClose(j)} className="text-destructive focus:text-destructive">
                            <XCircle className="mr-2 h-4 w-4" /> Schließen
                          </DropdownMenuItem>
                        </>
                      )}
                      {lifecycle === 'drafts' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDeleteDraft(j)} className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Entwurf löschen
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
        <JobIntakeStudio
          open={studio.open}
          type={(studio.draft?.row?.employment_type === 'freelance' ? 'freelance' : 'full-time') as 'full-time' | 'freelance'}
          initialDraft={studio.draft}
          onOpenChange={(o) => {
            setStudio((s) => ({ ...s, open: o, draft: o ? s.draft : null }));
            if (!o) fetchJobs();
          }}
        />
      </div>
    </DashboardLayout>
  );
}
