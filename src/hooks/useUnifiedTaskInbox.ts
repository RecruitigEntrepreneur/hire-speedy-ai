import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { anonymizeCompanyName } from '@/lib/anonymization';

export interface UnifiedTaskItem {
  itemType: 'alert' | 'task' | 'derived';
  itemId: string;
  recruiterId: string;
  title: string;
  description: string | null;
  recommendedAction: string | null;
  taskCategory: string;
  sortPriority: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  submissionId: string | null;
  candidateId: string | null;
  jobId: string | null;
  playbookId: string | null;
  createdAt: string;
  dueAt: string | null;
  isRead: boolean;
  isArchived: boolean;
  isCompleted: boolean;
  completedAt: string | null;
  snoozedUntil: string | null;
  impactScore: number;
  feeValue: number | null;
  candidateName: string | null;
  candidatePhone: string | null;
  candidateEmail: string | null;
  jobTitle: string | null;
  companyName: string | null;
}

export type TaskFilter = 'all' | 'opt_in' | 'follow_up' | 'interview' | 'manual' | 'other';

const FILTER_CATEGORIES: Record<TaskFilter, string[]> = {
  all: [],
  opt_in: ['opt_in_pending', 'opt_in_pending_24h', 'opt_in_pending_48h'],
  follow_up: ['follow_up_needed', 'ghosting_risk', 'engagement_drop', 'no_activity', 'client_review_stalled'],
  interview: ['interview_prep_missing', 'interview_reminder', 'interview_debrief_due'],
  manual: ['call', 'email', 'follow_up', 'meeting', 'other'],
  other: ['salary_mismatch', 'salary_negotiation', 'closing_opportunity', 'culture_concern', 'document_missing', 'client_feedback_positive', 'client_feedback_negative'],
};

const ALERT_PRIORITY_MAP: Record<string, number> = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
};

const TASK_PRIORITY_TO_ALERT: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
  urgent: 'critical',
  high: 'high',
  normal: 'medium',
  low: 'low',
};

const DAY_MS = 86_400_000;
// Client-Reaktion gilt nach so vielen Tagen ohne Bewegung als überfällig
const STALLED_AFTER_DAYS = 3;
const STALLED_CRITICAL_DAYS = 7;

// ---------------------------------------------------------------------------
// Suppression für abgeleitete Aufgaben.
// Abgeleitete Items existieren nicht als DB-Zeile, sondern als Zustand
// ("Submission hängt", "Debrief fehlt"). "Erledigt"/"Snooze" kann darum nur
// lokal unterdrücken — die Aufgabe kommt wieder, wenn der Zustand anhält.
// Übergangslösung, bis die influence-engine diese Regeln serverseitig erzeugt.
// ---------------------------------------------------------------------------
const SUPPRESS_KEY = 'matchunt_derived_task_suppressions';

function readSuppressions(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SUPPRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Abgelaufene Einträge bereinigen
    const now = Date.now();
    const active: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string' && new Date(v).getTime() > now) active[k] = v;
    }
    return active;
  } catch {
    return {};
  }
}

export function suppressDerivedItem(itemId: string, until: Date) {
  try {
    const map = readSuppressions();
    map[itemId] = until.toISOString();
    localStorage.setItem(SUPPRESS_KEY, JSON.stringify(map));
  } catch {
    // localStorage nicht verfügbar → Item taucht beim nächsten Fetch wieder auf
  }
}

const calcFee = (
  salaryMin: number | null,
  salaryMax: number | null,
  feePercentage: number | null,
): number | null => {
  if (!feePercentage || (!salaryMin && !salaryMax)) return null;
  const avgSalary = salaryMin && salaryMax ? (salaryMin + salaryMax) / 2 : salaryMin || salaryMax;
  if (!avgSalary) return null;
  return Math.round(avgSalary * (feePercentage / 100));
};

// Firma nur zeigen, wenn die Submission den Reveal bestätigt — sonst Branchen-Label
const safeCompany = (job: any, revealed: boolean | null | undefined): string | null => {
  if (!job) return null;
  return revealed === true ? job.company_name || null : anonymizeCompanyName(job.industry ?? null);
};

function mapAlertToItem(alert: any): UnifiedTaskItem {
  // Handle nested joins: submissions → candidates, jobs
  const submission = alert.submissions;
  const candidate = submission?.candidates;
  const job = submission?.jobs;

  return {
    itemType: 'alert',
    itemId: alert.id,
    recruiterId: alert.recruiter_id,
    title: alert.title,
    description: alert.message || null,
    recommendedAction: alert.recommended_action || null,
    taskCategory: alert.alert_type,
    sortPriority: ALERT_PRIORITY_MAP[alert.priority] ?? 4,
    priority: alert.priority || 'medium',
    submissionId: alert.submission_id,
    candidateId: submission?.candidate_id || null,
    jobId: submission?.job_id || null,
    playbookId: alert.playbook_id || null,
    createdAt: alert.created_at,
    dueAt: alert.expires_at || null,
    isRead: alert.is_read ?? false,
    isArchived: alert.is_dismissed ?? false,
    isCompleted: alert.action_taken != null,
    completedAt: alert.action_taken_at || null,
    snoozedUntil: alert.snoozed_until || null,
    impactScore: alert.impact_score ?? 50,
    feeValue: calcFee(job?.salary_min ?? null, job?.salary_max ?? null, job?.recruiter_fee_percentage ?? null),
    candidateName: candidate?.full_name || null,
    candidatePhone: candidate?.phone || null,
    candidateEmail: candidate?.email || null,
    jobTitle: job?.title || null,
    companyName: safeCompany(job, submission?.company_revealed),
  };
}

function mapTaskToItem(task: any, job: any): UnifiedTaskItem {
  const candidate = task.candidates;
  const normalizedPriority = TASK_PRIORITY_TO_ALERT[task.priority] || 'medium';

  return {
    itemType: 'task',
    itemId: task.id,
    recruiterId: task.recruiter_id,
    title: task.title,
    description: task.description || null,
    recommendedAction: null,
    taskCategory: task.task_type || 'other',
    sortPriority: ALERT_PRIORITY_MAP[normalizedPriority] ?? 3,
    priority: normalizedPriority,
    submissionId: task.submission_id || null,
    candidateId: task.candidate_id || null,
    jobId: task.job_id || null,
    playbookId: task.playbook_id || null,
    createdAt: task.created_at,
    dueAt: task.due_at || null,
    isRead: false,
    isArchived: task.status === 'cancelled',
    isCompleted: task.status === 'completed',
    completedAt: task.completed_at || null,
    snoozedUntil: null,
    impactScore: 50,
    feeValue: calcFee(job?.salary_min ?? null, job?.salary_max ?? null, job?.recruiter_fee_percentage ?? null),
    candidateName: candidate?.full_name || null,
    candidatePhone: candidate?.phone || null,
    candidateEmail: candidate?.email || null,
    jobTitle: job?.title || null,
    // Reveal ist ohne Submission-Verknüpfung nicht verifizierbar → immer Branchen-Label
    companyName: safeCompany(job, false),
  };
}

// Abgeleitete Aufgabe: Einreichung liegt beim Client, ohne Reaktion
function mapStalledSubmission(sub: any, now: number): UnifiedTaskItem | null {
  const anchorIso = sub.status === 'in_review' ? sub.updated_at || sub.submitted_at : sub.submitted_at;
  if (!anchorIso) return null;
  const days = Math.floor((now - new Date(anchorIso).getTime()) / DAY_MS);
  if (days < STALLED_AFTER_DAYS) return null;

  const job = sub.jobs;
  const candidate = sub.candidates;
  const fee = calcFee(job?.salary_min ?? null, job?.salary_max ?? null, job?.recruiter_fee_percentage ?? null);
  const priority: 'critical' | 'high' = days >= STALLED_CRITICAL_DAYS ? 'critical' : 'high';

  return {
    itemType: 'derived',
    itemId: `derived-stalled-${sub.id}`,
    recruiterId: sub.recruiter_id,
    title: `Keine Client-Reaktion seit ${days} Tagen`,
    description: `${candidate?.full_name || 'Kandidat'} liegt seit ${days} Tagen unbeantwortet beim Client — der Deal kühlt ab.`,
    recommendedAction: 'Beim Client nachfassen und Feedback zur Einreichung erfragen.',
    taskCategory: 'client_review_stalled',
    sortPriority: ALERT_PRIORITY_MAP[priority],
    priority,
    submissionId: sub.id,
    candidateId: sub.candidate_id || null,
    jobId: sub.job_id || null,
    playbookId: null,
    createdAt: anchorIso,
    dueAt: new Date(new Date(anchorIso).getTime() + STALLED_AFTER_DAYS * DAY_MS).toISOString(),
    isRead: false,
    isArchived: false,
    isCompleted: false,
    completedAt: null,
    snoozedUntil: null,
    impactScore: fee ? Math.min(90, 55 + Math.round(fee / 1000)) : 60,
    feeValue: fee,
    candidateName: candidate?.full_name || null,
    candidatePhone: candidate?.phone || null,
    candidateEmail: candidate?.email || null,
    jobTitle: job?.title || null,
    companyName: safeCompany(job, sub.company_revealed),
  };
}

// Abgeleitete Aufgabe: Interview vorbei, kein Feedback erfasst
function mapDebriefDue(iv: any, now: number): UnifiedTaskItem | null {
  const sub = iv.submissions;
  if (!sub || !iv.scheduled_at) return null;
  const endsAt = new Date(iv.scheduled_at).getTime() + (iv.duration_minutes ?? 60) * 60_000;
  if (endsAt > now) return null;

  const job = sub.jobs;
  const candidate = sub.candidates;
  const fee = calcFee(job?.salary_min ?? null, job?.salary_max ?? null, job?.recruiter_fee_percentage ?? null);
  const hoursSince = Math.floor((now - endsAt) / 3_600_000);
  const priority: 'critical' | 'high' = hoursSince >= 72 ? 'critical' : 'high';

  return {
    itemType: 'derived',
    itemId: `derived-debrief-${iv.id}`,
    recruiterId: sub.recruiter_id,
    title: 'Debrief fällig — Interview ist vorbei',
    description: `Das Interview mit ${candidate?.full_name || 'Kandidat'} war vor ${hoursSince < 48 ? `${hoursSince} Std.` : `${Math.floor(hoursSince / 24)} Tagen`} — Eindruck einholen, solange er frisch ist.`,
    recommendedAction: 'Kandidat anrufen (Debrief) und Client-Feedback einholen.',
    taskCategory: 'interview_debrief_due',
    sortPriority: ALERT_PRIORITY_MAP[priority],
    priority,
    submissionId: iv.submission_id,
    candidateId: sub.candidate_id || null,
    jobId: sub.job_id || null,
    playbookId: null,
    createdAt: iv.scheduled_at,
    dueAt: new Date(endsAt + 24 * 3_600_000).toISOString(),
    isRead: false,
    isArchived: false,
    isCompleted: false,
    completedAt: null,
    snoozedUntil: null,
    impactScore: fee ? Math.min(95, 65 + Math.round(fee / 1000)) : 70,
    feeValue: fee,
    candidateName: candidate?.full_name || null,
    candidatePhone: candidate?.phone || null,
    candidateEmail: candidate?.email || null,
    jobTitle: job?.title || null,
    companyName: safeCompany(job, sub.company_revealed),
  };
}

export function useUnifiedTaskInbox(filter: TaskFilter = 'all') {
  const { user } = useAuth();
  const [items, setItems] = useState<UnifiedTaskItem[]>([]);
  const [completedItems, setCompletedItems] = useState<UnifiedTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);
      const now = new Date().toISOString();
      const nowMs = Date.now();

      // Query 1: influence_alerts with nested submission → candidate + job
      const alertsQuery = supabase
        .from('influence_alerts')
        .select(`
          *,
          submissions(
            candidate_id,
            job_id,
            company_revealed,
            candidates(full_name, phone, email)
          )
        `)
        .eq('recruiter_id', user.id)
        .eq('is_dismissed', false)
        .is('action_taken', null)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('created_at', { ascending: false });

      // Query 2: recruiter_tasks with nested candidate + job
      // recruiter_tasks hat keine FKs auf submissions/jobs — nur der candidates-Join
      // funktioniert; Job-Infos werden unten separat per in('id', …) nachgeladen.
      const tasksQuery = supabase
        .from('recruiter_tasks')
        .select(`
          *,
          candidates(full_name, phone, email)
        `)
        .eq('recruiter_id', user.id)
        .not('status', 'in', '("completed","cancelled")')
        .order('created_at', { ascending: false });

      // Query 3: Einreichungen, die unbeantwortet beim Client liegen (abgeleitet)
      const stalledQuery = supabase
        .from('submissions')
        .select(`
          id, recruiter_id, candidate_id, job_id, status, submitted_at, updated_at, company_revealed,
          candidates(full_name, phone, email)
        `)
        .eq('recruiter_id', user.id)
        .in('status', ['submitted', 'pending', 'in_review']);

      // Query 4: vergangene Interviews ohne Feedback → Debrief fällig (abgeleitet)
      const debriefQuery = supabase
        .from('interviews')
        .select(`
          id, submission_id, scheduled_at, duration_minutes, status, feedback,
          submissions!inner(
            recruiter_id, candidate_id, job_id, company_revealed,
            candidates(full_name, phone, email)
          )
        `)
        .eq('submissions.recruiter_id', user.id)
        .not('status', 'in', '("declined","cancelled","no_show")')
        .not('scheduled_at', 'is', null)
        .lt('scheduled_at', now)
        .is('feedback', null);

      // Query 5+6: zuletzt Erledigtes für die Sidebar
      const completedAlertsQuery = supabase
        .from('influence_alerts')
        .select(`
          *,
          submissions(
            candidate_id, job_id, company_revealed,
            candidates(full_name, phone, email)
          )
        `)
        .eq('recruiter_id', user.id)
        .not('action_taken', 'is', null)
        .order('action_taken_at', { ascending: false })
        .limit(10);

      const completedTasksQuery = supabase
        .from('recruiter_tasks')
        .select(`
          *,
          candidates(full_name, phone, email)
        `)
        .eq('recruiter_id', user.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(10);

      const [alertsResult, tasksResult, stalledResult, debriefResult, completedAlertsResult, completedTasksResult] =
        await Promise.all([alertsQuery, tasksQuery, stalledQuery, debriefQuery, completedAlertsQuery, completedTasksQuery]);

      for (const [label, res] of [
        ['alerts', alertsResult],
        ['tasks', tasksResult],
        ['stalled submissions', stalledResult],
        ['debrief interviews', debriefResult],
        ['completed alerts', completedAlertsResult],
        ['completed tasks', completedTasksResult],
      ] as const) {
        if (res.error) console.error(`Error fetching ${label}:`, res.error);
      }

      // Job-Infos zentral nachladen. Recruiter duerfen public.jobs nicht mehr
      // direkt lesen, deshalb ist ein eingebetteter jobs(...)-Join in den
      // Queries oben nicht mehr moeglich — die Firmenidentitaet wird nur ueber
      // recruiter_jobs_view (reveal-gated) aufgeloest.
      const rowsWithSubmission: any[] = [
        ...(alertsResult.data || []),
        ...(completedAlertsResult.data || []),
        ...(debriefResult.data || []),
      ];
      const allJobIds = [
        ...new Set(
          [
            ...(tasksResult.data || []).map((t: any) => t.job_id),
            ...(completedTasksResult.data || []).map((t: any) => t.job_id),
            ...(stalledResult.data || []).map((s: any) => s.job_id),
            ...rowsWithSubmission.map((r: any) => r.submissions?.job_id),
          ].filter(Boolean)
        ),
      ] as string[];

      let taskJobsById: Record<string, any> = {};
      if (allJobIds.length > 0) {
        const { data: jobRows, error: jobsError } = await supabase
          .from('recruiter_jobs_view')
          .select('id, title, company_name, industry, salary_min, salary_max, recruiter_fee_percentage')
          .in('id', allJobIds);
        if (jobsError) console.error('Error fetching task jobs:', jobsError);
        taskJobsById = Object.fromEntries((jobRows || []).map((j: any) => [j.id, j]));
      }

      // Job-Objekt dort wieder anhaengen, wo vorher der PostgREST-Join stand,
      // damit die Mapper unveraendert weiterarbeiten koennen.
      rowsWithSubmission.forEach((r: any) => {
        if (r.submissions?.job_id) r.submissions.jobs = taskJobsById[r.submissions.job_id] ?? null;
      });
      (stalledResult.data || []).forEach((s: any) => {
        if (s.job_id) s.jobs = taskJobsById[s.job_id] ?? null;
      });

      // Map alerts — erst jetzt, damit die Job-Infos oben schon anhaengen.
      const alertItems: UnifiedTaskItem[] = (alertsResult.data || [])
        .map(mapAlertToItem)
        .filter(item => {
          // Filter out snoozed items (if snoozed_until column exists)
          if (item.snoozedUntil && new Date(item.snoozedUntil) > new Date()) {
            return false;
          }
          return true;
        });

      // Map tasks
      const taskItems: UnifiedTaskItem[] = (tasksResult.data || []).map((t: any) =>
        mapTaskToItem(t, t.job_id ? taskJobsById[t.job_id] : null)
      );

      // Abgeleitete Items: nicht doppeln, falls die Engine dieselbe Regel schon
      // als Alert erzeugt (UNIQUE submission_id+alert_type serverseitig), und
      // lokale Suppressions ("Erledigt"/Snooze auf abgeleiteten Items) beachten.
      const alertKeys = new Set(alertItems.map(a => `${a.taskCategory}:${a.submissionId}`));
      const suppressions = readSuppressions();

      const derivedItems: UnifiedTaskItem[] = [
        ...(stalledResult.data || []).map((s: any) => mapStalledSubmission(s, nowMs)),
        ...(debriefResult.data || []).map((iv: any) => mapDebriefDue(iv, nowMs)),
      ]
        .filter((i): i is UnifiedTaskItem => i !== null)
        .filter(i => !alertKeys.has(`${i.taskCategory}:${i.submissionId}`))
        .filter(i => !suppressions[i.itemId]);

      // Merge + sort: by sortPriority ASC, then impact DESC, then createdAt DESC
      const merged = [...alertItems, ...taskItems, ...derivedItems].sort((a, b) => {
        if (a.sortPriority !== b.sortPriority) return a.sortPriority - b.sortPriority;
        if (a.impactScore !== b.impactScore) return b.impactScore - a.impactScore;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      setItems(merged);

      const completedMerged = [
        ...(completedAlertsResult.data || []).map(mapAlertToItem),
        ...(completedTasksResult.data || []).map((t: any) =>
          mapTaskToItem(t, t.job_id ? taskJobsById[t.job_id] : null)
        ),
      ]
        .filter(i => i.isCompleted)
        .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime())
        .slice(0, 10);

      setCompletedItems(completedMerged);
    } catch (err) {
      console.error('Unified inbox fetch error:', err);
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Aufgaben');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchItems();

    if (user) {
      // Subscribe to both source tables for realtime updates
      const alertChannel = supabase
        .channel('unified-inbox-alerts')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'influence_alerts',
            filter: `recruiter_id=eq.${user.id}`,
          },
          () => { fetchItems(); }
        )
        .subscribe();

      const taskChannel = supabase
        .channel('unified-inbox-tasks')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'recruiter_tasks',
            filter: `recruiter_id=eq.${user.id}`,
          },
          () => { fetchItems(); }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(alertChannel);
        supabase.removeChannel(taskChannel);
      };
    }
  }, [user, fetchItems]);

  // Filtered items
  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;

    const categories = FILTER_CATEGORIES[filter];
    if (!categories.length) return items;

    // For 'manual' filter: show only tasks (not alerts)
    if (filter === 'manual') {
      return items.filter(i => i.itemType === 'task');
    }

    return items.filter(i => categories.includes(i.taskCategory));
  }, [items, filter]);

  // Counts per filter
  const filterCounts = useMemo(() => {
    const counts: Record<TaskFilter, number> = {
      all: items.length,
      opt_in: 0,
      follow_up: 0,
      interview: 0,
      manual: 0,
      other: 0,
    };

    items.forEach(item => {
      if (item.itemType === 'task') {
        counts.manual++;
      } else if (FILTER_CATEGORIES.opt_in.includes(item.taskCategory)) {
        counts.opt_in++;
      } else if (FILTER_CATEGORIES.follow_up.includes(item.taskCategory)) {
        counts.follow_up++;
      } else if (FILTER_CATEGORIES.interview.includes(item.taskCategory)) {
        counts.interview++;
      } else {
        counts.other++;
      }
    });

    return counts;
  }, [items]);

  const urgentItems = useMemo(
    () => filteredItems.filter(i => i.priority === 'critical'),
    [filteredItems]
  );
  const openItems = useMemo(
    () => filteredItems.filter(i => i.priority !== 'critical'),
    [filteredItems]
  );

  // Actions
  const markDone = async (itemType: 'alert' | 'task' | 'derived', itemId: string) => {
    if (itemType === 'alert') {
      await supabase
        .from('influence_alerts')
        .update({
          action_taken: 'completed',
          action_taken_at: new Date().toISOString(),
          is_read: true,
        })
        .eq('id', itemId);
    } else if (itemType === 'task') {
      await supabase
        .from('recruiter_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', itemId);
    } else {
      // Abgeleitet: 3 Tage unterdrücken — kommt wieder, wenn der Zustand anhält
      suppressDerivedItem(itemId, new Date(Date.now() + 3 * DAY_MS));
    }

    setItems(prev => prev.filter(i => i.itemId !== itemId));
  };

  const snooze = async (itemType: 'alert' | 'task' | 'derived', itemId: string, until: Date) => {
    if (itemType === 'alert') {
      await supabase
        .from('influence_alerts')
        .update({ snoozed_until: until.toISOString() } as any)
        .eq('id', itemId);
    } else if (itemType === 'task') {
      // For tasks, we shift the due_at
      await supabase
        .from('recruiter_tasks')
        .update({ due_at: until.toISOString() })
        .eq('id', itemId);
    } else {
      suppressDerivedItem(itemId, until);
    }

    setItems(prev => prev.filter(i => i.itemId !== itemId));
  };

  const dismiss = async (itemType: 'alert' | 'task' | 'derived', itemId: string) => {
    if (itemType === 'alert') {
      await supabase
        .from('influence_alerts')
        .update({ is_dismissed: true })
        .eq('id', itemId);
    } else if (itemType === 'task') {
      await supabase
        .from('recruiter_tasks')
        .update({ status: 'cancelled' })
        .eq('id', itemId);
    } else {
      suppressDerivedItem(itemId, new Date(Date.now() + 30 * DAY_MS));
    }

    setItems(prev => prev.filter(i => i.itemId !== itemId));
  };

  return {
    items: filteredItems,
    allItems: items,
    urgentItems,
    openItems,
    completedItems,
    loading,
    error,
    refetch: fetchItems,
    markDone,
    snooze,
    dismiss,
    filterCounts,
    pendingCount: items.length,
    urgentCount: items.filter(i => i.priority === 'critical').length,
  };
}
