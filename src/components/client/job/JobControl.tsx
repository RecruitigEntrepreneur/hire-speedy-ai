import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, Check, ChevronDown, ChevronRight, FileDown, History, Loader2, Lock, MoreHorizontal, Pause, PencilLine, Play } from 'lucide-react';
import i18n from '@/i18n';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BewerberStatusPill } from '@/components/candidates/BewerberStatusPill';
import type { BewerberItem, BewerberTab } from '@/hooks/useBewerber';
import { avatarUrl, errorText, getJobSearchers, requestJobChange, type JobSearcher } from '@/lib/jobSearch';
import { taskMainLabel, type ClientDoneItem, type ClientTask, type ClientWaitingItem } from '@/lib/clientTasksApi';
import { fmtDate, fmtDayMonth, fmtNumber } from '@/lib/localeFormat';
import { cn } from '@/lib/utils';
import { experienceBandLabel, regionLabel, remoteLabel } from '@/lib/clientCandidateLabels';

// Erfahrungsband ohne den Platzhalter „Nicht angegeben“ (der sagt nichts).
const band = (v: string | null | undefined) => (v && v !== 'Nicht angegeben' ? experienceBandLabel(v) : '');

/**
 * Stellenseite des Kunden, Variante A „Arbeitsliste“ (14.11.2026), nach Recherche
 * (Indeed, JOIN, Greenhouse, Ashby, Paraform). Links: was Sie tun (Arbeitsliste,
 * Finalisten, Termine). Rechts: wie die Suche läuft und was Sie steuern können.
 * Nach dem Livegang wird nicht mehr bearbeitet, sondern eine Änderung angefragt.
 * Entscheidungen über Kandidaten fallen im Profil (Opt-in-Schutz); die Knöpfe hier
 * öffnen dort das passende Fenster.
 */

export function SectionCard({ title, aside, children, className }: { title: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border bg-card p-4', className)}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{title}</h3>
        {aside}
      </div>
      {children}
    </div>
  );
}

export const linkBtn = 'inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground';

const daysSince = (iso: string | null | undefined) => (iso ? Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)) : 0);

/** Headhunter der Stelle, einmal geladen für Suchstand und „Beteiligt“. */
export function useJobSearchers(jobId: string) {
  const [rows, setRows] = useState<JobSearcher[] | null>(null);
  useEffect(() => {
    let alive = true;
    if (!jobId) return;
    getJobSearchers(jobId).then((r) => { if (alive) setRows(r ?? []); }, () => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [jobId]);
  return rows;
}

// ================================================================== Kopf

export type JobRunState = 'active' | 'paused' | 'terminal';

/** „● Aktiv ▾“: Status als Auswahl, jede Möglichkeit mit ihrer Folge in einem Satz (Indeed, Monster). */
export function JobStatusMenu({ state, stateLabel, canManage, onPause, onResume, onClose }: {
  state: JobRunState; stateLabel: string; canManage: boolean; onPause: () => void; onResume: () => void; onClose: () => void;
}) {
  const { t } = useTranslation('clientJobs');
  const dot = state === 'active' ? 'bg-success' : state === 'paused' ? 'bg-amber-500' : 'bg-muted-foreground';
  const trigger = (
    <Button variant="outline" size="sm" className="gap-2" disabled={state === 'terminal' || !canManage}>
      <span className={cn('h-2 w-2 rounded-full', dot)} aria-hidden="true" />
      {stateLabel}
      {state !== 'terminal' && canManage && <ChevronDown className="h-3.5 w-3.5" />}
    </Button>
  );
  if (state === 'terminal' || !canManage) return <span title={!canManage && state !== 'terminal' ? t('manage.noRights') : undefined}>{trigger}</span>;
  const item = (icon: ReactNode, title: string, text: string, onClick: () => void, current = false, danger = false) => (
    <DropdownMenuItem onClick={current ? undefined : onClick} className={cn('items-start gap-2 py-2', danger && 'text-destructive focus:text-destructive')}>
      <span className="mt-0.5">{icon}</span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-medium">{title}{current && <Check className="h-3.5 w-3.5" />}</span>
        <span className="block text-xs text-muted-foreground">{text}</span>
      </span>
    </DropdownMenuItem>
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {item(<Play className="h-4 w-4" />, state === 'paused' ? t('cockpit.state.resume') : t('cockpit.state.active'), t('cockpit.state.activeText'), onResume, state === 'active')}
        {item(<Pause className="h-4 w-4" />, state === 'paused' ? t('cockpit.state.paused') : t('cockpit.state.pause'), t('cockpit.state.pauseText'), onPause, state === 'paused')}
        <DropdownMenuSeparator />
        {item(<Lock className="h-4 w-4" />, t('cockpit.state.close'), t('cockpit.state.closeText'), onClose, false, true)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** ⋯ im Kopf: Änderung anfragen, Verlauf. */
export function JobMoreMenu({ canRequest, onRequestChange, onHistory }: { canRequest: boolean; onRequestChange: () => void; onHistory: () => void }) {
  const { t } = useTranslation('clientJobs');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 w-9 p-0" aria-label={t('cockpit.head.more')}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {canRequest && (
          <DropdownMenuItem onClick={onRequestChange}><PencilLine className="mr-2 h-4 w-4" />{t('cockpit.head.requestChange')}</DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onHistory}><History className="mr-2 h-4 w-4" />{t('cockpit.head.history')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Zwei ruhige Zeilen unter dem Titel: gewünschter Start bzw. Besetzung bis, und was sich diese Woche getan hat. */
export function JobHeadLines({ startLabel, hiringDeadline, items, done, interviewsThisWeek }: {
  startLabel: string | null; hiringDeadline: string | null; items: BewerberItem[]; done: ClientDoneItem[]; interviewsThisWeek: number;
}) {
  const { t } = useTranslation('clientJobs');
  const weekAgo = Date.now() - 7 * 86_400_000;
  const newProposals = items.filter((i) => i.submittedAt && Date.parse(i.submittedAt) >= weekAgo).length;
  const answered = done.filter((d) => d.kind === 'recruiter_question' && Date.parse(d.doneAt) >= weekAgo).length;
  const week = [
    newProposals ? t('cockpit.week.proposals', { count: newProposals }) : null,
    interviewsThisWeek ? t('cockpit.week.interviews', { count: interviewsThisWeek }) : null,
    answered ? t('cockpit.week.answered', { count: answered }) : null,
  ].filter(Boolean);
  const weeksLeft = hiringDeadline ? Math.ceil((Date.parse(hiringDeadline) - Date.now()) / (7 * 86_400_000)) : null;
  const goal = hiringDeadline
    ? `${t('cockpit.week.deadline', { date: fmtDate(hiringDeadline) })}${weeksLeft !== null && weeksLeft > 0 ? ` · ${t('cockpit.week.weeksLeft', { count: weeksLeft })}` : ''}`
    : startLabel ? t('cockpit.week.start', { start: startLabel }) : null;
  if (!goal && week.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap justify-between gap-x-6 gap-y-1 text-xs text-muted-foreground">
      {goal && <span>{goal}</span>}
      <span>{week.length ? `${t('cockpit.week.title')} ${week.join(', ')}.` : t('cockpit.week.quiet')}</span>
    </div>
  );
}

/** K3 · Steckbrief im Kopf: vereinbarte Eckdaten in einer Zeile, darunter die wichtigsten Fähigkeiten. */
export function JobFactsLine({ facts, startLabel, skills }: { facts: [string, string][]; startLabel: string | null; skills: string[] }) {
  const { t } = useTranslation('clientJobs');
  const all: [string, string][] = startLabel ? [...facts, [t('cockpit.facts.start'), startLabel]] : facts;
  if (all.length === 0 && skills.length === 0) return null;
  return (
    <div className="mt-4 space-y-2 border-t pt-3">
      {all.length > 0 && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {all.map(([label, value]) => (
            <span key={label}><span className="text-muted-foreground">{label}:</span> <span className="font-medium">{value}</span></span>
          ))}
        </div>
      )}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {skills.map((s) => <span key={s} className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{s}</span>)}
        </div>
      )}
    </div>
  );
}

/** K5 · Wer für Sie sucht: Fotos und Namen, wer wie viel vorgestellt hat, letzte Aktivität. */
export function SearcherLine({ searchers, onDetails }: { searchers: JobSearcher[] | null; onDetails: () => void }) {
  const { t } = useTranslation('clientJobs');
  const current = (searchers ?? []).filter((s) => s.status !== 'ended')
    .sort((a, b) => b.candidates - a.candidates || (b.last_submission_at ?? b.started_at).localeCompare(a.last_submission_at ?? a.started_at));
  const [photos, setPhotos] = useState<Record<string, string | null>>({});
  const key = current.map((s) => s.recruiter_id).join(',');
  useEffect(() => {
    let alive = true;
    void Promise.all(current.slice(0, 4).map(async (s) => [s.recruiter_id, await avatarUrl(s.avatar_path)] as const))
      .then((entries) => { if (alive) setPhotos(Object.fromEntries(entries)); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (searchers === null) return null;
  const lastActive = current.map((s) => s.last_submission_at ?? s.started_at).sort().pop() ?? null;
  const initials = (n: string | null) => (n ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const lead = current[0];
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 border-t pt-3">
      {current.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('cockpit.searchers.none')}</p>
      ) : (
        <>
          <span className="flex -space-x-2">
            {current.slice(0, 4).map((s) => (
              photos[s.recruiter_id]
                ? <img key={s.recruiter_id} src={photos[s.recruiter_id]!} alt="" className="h-7 w-7 rounded-full border-2 border-card object-cover" />
                : <span key={s.recruiter_id} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-semibold text-muted-foreground">{initials(s.full_name)}</span>
            ))}
          </span>
          <p className="min-w-0 flex-1 text-sm">
            <span className="text-muted-foreground">{t('cockpit.searchers.line', { count: current.length })}</span>{' '}
            <span className="font-medium">{lead.full_name}</span>
            {lead.candidates > 0 && <span className="text-muted-foreground"> ({t('cockpit.involved.proposals', { count: lead.candidates })})</span>}
            {current.length > 1 && <span className="text-muted-foreground"> {t('cockpit.searchers.more', { count: current.length - 1 })}</span>}
            {lastActive && <span className="text-muted-foreground"> · {t('cockpit.searchers.active', { date: fmtDayMonth(lastActive) })}</span>}
          </p>
          <button type="button" className={linkBtn} onClick={onDetails}>{t('cockpit.searchers.all')}<ArrowRight className="h-3 w-3" /></button>
        </>
      )}
    </div>
  );
}

// ================================================================== Links

/**
 * Arbeitsliste: „Sie sind dran“ (eine Zeile je Aufgabe; der erste Eintrag mit Kontext, bei
 * neuen Vorschlägen mit Schnellantwort), „Wartet auf andere“ (wer wartet auf wen, wie lange),
 * „Abgeschlossen“ (Absagen, Einstellungen).
 */
export function WorkList({ tasks, waiting, items, jobId, loading, onOpen }: {
  tasks: ClientTask[]; waiting: ClientWaitingItem[]; items: BewerberItem[]; jobId: string; loading: boolean; onOpen: (t: ClientTask) => void;
}) {
  const { t } = useTranslation('clientJobs');
  const navigate = useNavigate();
  const bySub = useMemo(() => new Map(items.map((i) => [i.submissionId, i])), [items]);
  const taskSubs = new Set(tasks.map((x) => x.submissionId).filter(Boolean));
  const others = items
    .filter((i) => i.tab !== 'archiv' && !taskSubs.has(i.submissionId))
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
  const rejected = items.filter((i) => i.archiveKind === 'abgelehnt' || i.archiveKind === 'zurueckgezogen' || i.archiveKind === 'abgelaufen').length;
  const hired = items.filter((i) => i.archiveKind === 'eingestellt').length;
  const oldest = tasks.reduce((m, x) => Math.max(m, daysSince(x.since)), 0);
  const profile = (submissionId: string, open?: string) => navigate(`/dashboard/candidates/${submissionId}`, open ? { state: { open } } : undefined);
  const nameOf = (i: BewerberItem | undefined) => (i ? i.fullName || i.anonymizedName : null);

  return (
    <SectionCard
      title={t('cockpit.work.title')}
      aside={<button type="button" className={linkBtn} onClick={() => navigate(`/dashboard/candidates?job=${jobId}&tab=alle`)}>{t('cockpit.work.inbox')}<ArrowRight className="h-3 w-3" /></button>}
    >
      {loading ? (
        <div className="py-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {tasks.length > 0 ? (
            <p className="text-sm">
              <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle" aria-hidden="true" />
              <span className="font-medium">{t('cockpit.work.waiting', { count: tasks.length })}</span>
              {oldest > 0 && <span className="text-muted-foreground"> · {t('cockpit.work.oldest', { count: oldest })}</span>}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{t('cockpit.work.nothing')}</p>
          )}

          {tasks.length > 0 && <p className="mt-3 text-[11px] uppercase tracking-wide text-muted-foreground">{t('cockpit.work.yours')}</p>}
          {tasks.map((task, idx) => {
            const item = task.submissionId ? bySub.get(task.submissionId) : undefined;
            const quick = task.kind === 'review' && !!task.submissionId;
            const context = idx === 0 && item ? [
              band(item.experienceBand) || null,
              item.availabilityDate ? t('cockpit.work.from', { date: fmtDayMonth(item.availabilityDate) }) : item.noticePeriod || null,
              item.salaryBand || null,
              regionLabel(item.region) || null,
            ].filter(Boolean).join(' · ') : '';
            return (
              <div key={task.key} className="border-t py-2.5 first:border-t-0">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => onOpen(task)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-medium">
                      {nameOf(item) ? <>{nameOf(item)} <span className="font-normal text-muted-foreground">· {item?.currentRole || task.title}</span></> : task.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[task.title !== (item?.currentRole ?? '') && nameOf(item) ? task.title : null, task.detail, t('cockpit.work.since', { count: daysSince(task.since) })].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                  {quick ? (
                    <span className="flex shrink-0 gap-1.5">
                      <Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => profile(task.submissionId!, 'interview')}>{t('cockpit.work.interview')}</Button>
                      <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => profile(task.submissionId!, 'reject')}>{t('cockpit.work.reject')}</Button>
                    </span>
                  ) : (
                    <Button size="sm" variant={task.urgent ? 'default' : 'outline'} className="h-7 shrink-0 px-2.5 text-xs" onClick={() => onOpen(task)}>
                      {taskMainLabel(task.kind)}
                    </Button>
                  )}
                </div>
                {context && (
                  <button type="button" onClick={() => profile(task.submissionId!)} className="mt-1.5 block w-full rounded-md bg-muted/40 px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/60">
                    {context}{item?.aiSummary ? ` · „${item.aiSummary.length > 110 ? `${item.aiSummary.slice(0, 110)}…` : item.aiSummary}“` : ''} · {t('cockpit.work.openProfile')}
                  </button>
                )}
              </div>
            );
          })}

          {(others.length > 0 || waiting.some((w) => !w.submissionId)) && (
            <p className="mt-3 text-[11px] uppercase tracking-wide text-muted-foreground">{t('cockpit.work.others')}</p>
          )}
          {others.slice(0, 8).map((item) => (
            <button key={item.submissionId} type="button" onClick={() => profile(item.submissionId)}
              className="flex w-full items-center gap-3 border-t py-2 text-left transition-colors first:border-t-0 hover:bg-muted/40">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{nameOf(item)} {(item.currentRole || band(item.experienceBand)) && <span className="text-muted-foreground">· {item.currentRole || band(item.experienceBand)}</span>}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {waiting.find((w) => w.submissionId === item.submissionId)?.title ?? t('cockpit.work.since', { count: Math.floor(item.hoursWaiting / 24) })}
                </span>
              </span>
              <BewerberStatusPill item={item} />
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
            </button>
          ))}
          {waiting.filter((w) => !w.submissionId).slice(0, 3).map((w) => (
            <p key={w.key} className="border-t py-2 text-xs text-muted-foreground">{w.title}{w.who ? ` · ${w.who}` : ''}</p>
          ))}

          {(rejected > 0 || hired > 0) && (
            <button type="button" className={cn(linkBtn, 'mt-3')} onClick={() => navigate(`/dashboard/candidates?job=${jobId}&tab=archiv`)}>
              {t('cockpit.work.closed', { rejected, hired })}<ChevronRight className="h-3 w-3" />
            </button>
          )}
          {items.length === 0 && <p className="mt-2 text-sm text-muted-foreground">{t('cockpit.work.empty')}</p>}
        </>
      )}
    </SectionCard>
  );
}

/**
 * Finalisten nebeneinander (ab 2 im Interview oder Angebot). Bewusst ohne KI-Wertung
 * oder Zählung der Muss-Kriterien (wie im Kandidatenprofil: keine Zahl, kein Haken;
 * DSGVO Art. 22). Nur Fakten aus dem Profil; die Entscheidung fällt im Profil.
 */
export function FinalistsCard({ items }: { items: BewerberItem[] }) {
  const { t } = useTranslation('clientJobs');
  const navigate = useNavigate();
  const finalists = items.filter((i) => i.tab === 'interview' || i.tab === 'angebot').slice(0, 3);
  if (finalists.length < 2) return null;

  const rows: [string, (i: BewerberItem) => ReactNode][] = [
    [t('cockpit.final.role'), (i) => i.currentRole || '–'],
    [t('cockpit.final.experience'), (i) => band(i.experienceBand) || '–'],
    [t('cockpit.final.available'), (i) => (i.availabilityDate ? fmtDate(i.availabilityDate) : i.noticePeriod || '–')],
    [t('cockpit.final.pay'), (i) => i.salaryBand || '–'],
    [t('cockpit.final.region'), (i) => [regionLabel(i.region), i.remotePreference ? remoteLabel(i.remotePreference, '') : ''].filter(Boolean).join(' · ') || '–'],
    [t('cockpit.final.stage'), (i) => <BewerberStatusPill item={i} />],
  ];
  const cols = `minmax(7rem,1.1fr) repeat(${finalists.length}, minmax(0,1fr))`;
  return (
    <SectionCard title={t('cockpit.final.title')} aside={<span className="text-xs text-muted-foreground">{t('cockpit.final.hint')}</span>}>
      <div className="overflow-x-auto">
        <div className="grid min-w-[22rem] text-xs" style={{ gridTemplateColumns: cols }}>
          <span />
          {finalists.map((f) => (
            <button key={f.submissionId} type="button" onClick={() => navigate(`/dashboard/candidates/${f.submissionId}`)} className="truncate pb-1.5 text-left text-sm font-medium hover:underline">
              {f.fullName || f.anonymizedName}
            </button>
          ))}
          {rows.map(([label, cell]) => (
            <div key={label} className="contents">
              <span className="border-t py-1.5 text-muted-foreground">{label}</span>
              {finalists.map((f) => <span key={f.submissionId} className="border-t py-1.5 pr-2">{cell(f)}</span>)}
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

// ================================================================== Rechts

/** „So läuft die Suche“: Satz plus schlanke Stufenlinie (suchen → Vorschläge → Interview → Angebot). */
export function SearchStatusCard({ liveDays, searchers, items, tabCounts, hiredCount, isPaused, isTerminal }: {
  liveDays: number; searchers: JobSearcher[] | null; items: BewerberItem[]; tabCounts: Record<BewerberTab, number>;
  hiredCount: number; isPaused: boolean; isTerminal: boolean;
}) {
  const { t } = useTranslation('clientJobs');
  const subs = items.map((i) => i.submittedAt).filter(Boolean).sort() as string[];
  const first = subs[0] ?? null;
  const last = subs[subs.length - 1] ?? null;
  const active = (searchers ?? []).filter((s) => s.status !== 'ended').length;
  const liveStart = Date.now() - liveDays * 86_400_000;
  const firstAfter = first ? Math.max(0, Math.round((Date.parse(first) - liveStart) / 86_400_000)) : null;
  const quietDays = last ? daysSince(last) : liveDays;
  const steps: [string, number][] = [
    [t('cockpit.status.steps.searching'), active],
    [t('cockpit.status.steps.proposals'), items.length],
    [t('cockpit.status.steps.interview'), tabCounts.interview],
    [hiredCount > 0 ? t('cockpit.status.steps.hired') : t('cockpit.status.steps.offer'), hiredCount > 0 ? hiredCount : tabCounts.angebot],
  ];
  const lines = [
    first ? t('cockpit.status.first', { count: firstAfter ?? 0 }) : isTerminal ? null : t('cockpit.status.noneYet'),
    last ? t('cockpit.status.last', { date: fmtDayMonth(last) }) : null,
  ].filter(Boolean);
  return (
    <SectionCard title={t('cockpit.status.title')}>
      <div className="grid grid-cols-4 gap-1.5">
        {steps.map(([label, n]) => (
          <div key={label}>
            <div className={cn('h-0.5 rounded-full', n > 0 ? 'bg-foreground' : 'bg-border')} />
            <p className="mt-1.5 text-sm font-semibold">{n}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {[isTerminal ? null : isPaused ? t('cockpit.status.paused') : t('cockpit.status.live', { count: liveDays }), ...lines].filter(Boolean).join(' · ')}
      </p>
      {!isTerminal && !isPaused && liveDays >= 21 && quietDays >= 21 && (
        <p className="mt-2 text-xs text-muted-foreground">{t('cockpit.status.quiet', { count: quietDays })}</p>
      )}
    </SectionCard>
  );
}

/** „Was die Suche schneller macht“: offene Fragen, eigene Absagegründe, Konditionen anfragen. */
export function SpeedCard({ openQuestions, items, onAnswer, onRequestChange, canRequest }: {
  openQuestions: ClientTask[]; items: BewerberItem[]; onAnswer: (t: ClientTask) => void; onRequestChange: () => void; canRequest: boolean;
}) {
  const { t } = useTranslation('clientJobs');
  useTranslation('clientCandidates');
  const reasons = new Map<string, number>();
  for (const i of items) if (i.archiveKind === 'abgelehnt' && i.rejectReason) reasons.set(i.rejectReason, (reasons.get(i.rejectReason) ?? 0) + 1);
  const rejectedTotal = items.filter((i) => i.archiveKind === 'abgelehnt').length;
  const withReason = [...reasons.values()].reduce((a, b) => a + b, 0);
  const top = [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const row = (label: ReactNode, hint: ReactNode, action?: ReactNode) => (
    <div className="flex items-center justify-between gap-3 border-t py-2 first:border-t-0">
      <div className="min-w-0"><p className="text-sm">{label}</p><p className="text-xs text-muted-foreground">{hint}</p></div>
      {action}
    </div>
  );
  return (
    <SectionCard title={t('cockpit.speed.title')}>
      {row(
        t('cockpit.speed.questions', { count: openQuestions.length }),
        t('cockpit.speed.questionsHint'),
        openQuestions.length > 0 ? <Button size="sm" variant="outline" className="h-7 shrink-0 px-2.5 text-xs" onClick={() => onAnswer(openQuestions[0])}>{t('cockpit.speed.answer')}</Button> : undefined,
      )}
      {rejectedTotal > 0 && row(
        t('cockpit.speed.reasons', { with: withReason, total: rejectedTotal }),
        top.length ? top.map(([key, n]) => `${i18n.t(`clientCandidates:rejection.reasons.${key}`, { defaultValue: key })} ${n}×`).join(' · ') : t('cockpit.speed.reasonsNone'),
      )}
      {canRequest && row(
        t('cockpit.speed.change'),
        t('cockpit.speed.changeHint'),
        <Button size="sm" variant="outline" className="h-7 shrink-0 px-2.5 text-xs" onClick={onRequestChange}>{t('cockpit.speed.changeCta')}</Button>,
      )}
    </SectionCard>
  );
}

type FactsJob = {
  employment_type?: string | null;
  experience_level?: string | null;
  day_rate_min?: number | null;
  day_rate_max?: number | null;
  utilization_days_per_week?: number | null;
  contract_duration_months?: number | null;
  extension_possible?: boolean | null;
  onsite_days_required?: number | null;
};
const LEVELS = new Set(['junior', 'mid', 'senior', 'lead', 'principal']);

/** Die wichtigsten vereinbarten Eckdaten (t aus dem Namespace clientJobs). */
export function agreementFactsOf(job: FactsJob, salaryLabel: string | null, t: (key: string, opts?: Record<string, unknown>) => string): [string, string][] {
  const freelance = job.employment_type === 'freelance';
  const rates = [job.day_rate_min, job.day_rate_max].filter((v): v is number => !!v);
  const rate = rates.length ? [...new Set(rates.map((v) => fmtNumber(v)))].join('–') : null;
  const facts: [string, string][] = [];
  if (freelance && rate) facts.push([t('cockpit.facts.budget'), t('cockpit.facts.dayRate', { rate })]);
  if (!freelance && salaryLabel) facts.push([t('cockpit.facts.salary'), salaryLabel]);
  if (job.experience_level) facts.push([t('cockpit.facts.level'), LEVELS.has(job.experience_level) ? t(`summary.level.${job.experience_level}`) : job.experience_level]);
  if (freelance && job.utilization_days_per_week) facts.push([t('cockpit.facts.load'), t('cockpit.facts.days', { count: job.utilization_days_per_week })]);
  if (freelance && job.contract_duration_months) {
    facts.push([t('cockpit.facts.duration'), `${t('cockpit.facts.months', { count: job.contract_duration_months })}${job.extension_possible ? ` · ${t('cockpit.facts.extension')}` : ''}`]);
  }
  if (job.onsite_days_required) facts.push([t('cockpit.facts.onsite'), t('cockpit.facts.days', { count: job.onsite_days_required })]);
  return facts;
}

export function AgreementCard({ facts, onDetails, onHeadhunterView, onRequestChange, canRequest }: {
  facts: [string, string][]; onDetails: () => void; onHeadhunterView: () => void; onRequestChange: () => void; canRequest: boolean;
}) {
  const { t } = useTranslation('clientJobs');
  return (
    <SectionCard title={t('cockpit.agreement.title')} aside={<button type="button" className={linkBtn} onClick={onDetails}>{t('cockpit.agreement.details')}<ArrowRight className="h-3 w-3" /></button>}>
      {facts.length > 0 ? (
        <dl className="mb-3 space-y-1 text-sm">
          {facts.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mb-3 text-xs text-muted-foreground">{t('cockpit.agreement.inHead')}</p>
      )}
      <div className="flex flex-col gap-1.5">
        <button type="button" className={linkBtn} onClick={onHeadhunterView}>{t('cockpit.agreement.hhView')}<ArrowRight className="h-3 w-3" /></button>
        {canRequest && <button type="button" className={linkBtn} onClick={onRequestChange}>{t('cockpit.agreement.change')}<ArrowRight className="h-3 w-3" /></button>}
      </div>
    </SectionCard>
  );
}

/** „Beteiligt“: wer sucht und wer schon geliefert hat, dazu das Team. */
export function InvolvedCard({ searchers, onDetails, invite }: { searchers: JobSearcher[] | null; onDetails: () => void; invite?: ReactNode }) {
  const { t } = useTranslation('clientJobs');
  const current = (searchers ?? []).filter((s) => s.status !== 'ended');
  const delivering = current.filter((s) => s.candidates > 0).sort((a, b) => b.candidates - a.candidates);
  const silent = current.length - delivering.length;
  return (
    <SectionCard title={t('cockpit.involved.title')} aside={<button type="button" className={linkBtn} onClick={onDetails}>{t('cockpit.involved.details')}<ArrowRight className="h-3 w-3" /></button>}>
      {searchers === null ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : current.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('cockpit.involved.nobody')}</p>
      ) : (
        <div>
          {delivering.slice(0, 4).map((s) => (
            <div key={s.activation_id} className="flex justify-between gap-3 border-t py-1.5 text-sm first:border-t-0">
              <span className="truncate">{s.full_name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {t('cockpit.involved.proposals', { count: s.candidates })}{s.last_submission_at ? ` · ${t('cockpit.involved.last', { date: fmtDayMonth(s.last_submission_at) })}` : ''}
              </span>
            </div>
          ))}
          {silent > 0 && <p className="mt-1 text-xs text-muted-foreground">{t('cockpit.involved.silent', { count: silent })}</p>}
        </div>
      )}
      {invite && <div className="mt-2">{invite}</div>}
    </SectionCard>
  );
}

/** Beantwortete Fragen der Headhunter als kleine FAQ der Stelle. */
export function AnsweredQuestionsCard({ done }: { done: ClientDoneItem[] }) {
  const { t } = useTranslation('clientJobs');
  const answered = done.filter((d) => d.kind === 'recruiter_question' && d.answer).sort((a, b) => b.doneAt.localeCompare(a.doneAt));
  if (answered.length === 0) return null;
  return (
    <SectionCard title={t('cockpit.faq.title', { count: answered.length })}>
      {answered.slice(0, 6).map((q) => (
        <div key={q.key} className="border-t py-2 first:border-t-0">
          <p className="text-sm">{q.label}</p>
          <p className="text-xs text-muted-foreground">{q.answer} · {fmtDayMonth(q.doneAt)}</p>
        </div>
      ))}
    </SectionCard>
  );
}

// ================================================================== Fenster

/** Seitenfenster für Selteneres: Stellenbeschreibung, Headhunter-Ansicht, Beteiligte, Verlauf. */
export function DetailSheet({ open, onOpenChange, title, description, children }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="mt-4 space-y-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

/** Änderung bei Matchunt anfragen (Text Pflicht). */
export function ChangeRequestDialog({ jobId, open, onOpenChange }: { jobId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation('clientJobs');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setNote(''); }, [open]);
  const ok = note.trim().length >= 5;
  const send = async () => {
    if (!ok) return;
    setBusy(true);
    try {
      await requestJobChange(jobId, 'change', note.trim());
      toast.success(t('cockpit.request.done'));
      onOpenChange(false);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('cockpit.request.title')}</DialogTitle>
          <DialogDescription>{t('cockpit.request.text')}</DialogDescription>
        </DialogHeader>
        <Textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('cockpit.request.placeholder')} maxLength={2000} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={send} disabled={busy || !ok}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('cockpit.request.send')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Stand teilen

export interface ShareData {
  title: string;
  meta: string;
  statusLine: string;
  steps: [string, number][];
  finalists: { name: string; facts: string }[];
  appointments: string[];
  facts: [string, string][];
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/** Druckbare Seite im eigenen Fenster; der Browser speichert sie als PDF. Kandidaten so anonym wie auf der Seite. */
function printShare(data: ShareData, parts: Record<'status' | 'finalists' | 'appointments' | 'terms', boolean>, t: (k: string, o?: Record<string, unknown>) => string) {
  const w = window.open('', '_blank', 'noopener=no,width=820,height=1000');
  if (!w) return false;
  const sec = (title: string, body: string) => `<h2>${esc(title)}</h2>${body}`;
  const html = `<!doctype html><html lang="${esc(i18n.language)}"><head><meta charset="utf-8"><title>${esc(data.title)}</title>
<style>body{font:13px/1.55 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111;margin:40px;max-width:720px}
h1{font-size:20px;margin:0 0 4px}h2{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#666;margin:24px 0 8px;border-top:1px solid #ddd;padding-top:12px}
.m{color:#666;margin:0}.steps{display:flex;gap:24px}.steps b{display:block;font-size:18px}table{border-collapse:collapse;width:100%}td{padding:4px 8px 4px 0;border-bottom:1px solid #eee;vertical-align:top}
.f{color:#888;font-size:11px;margin-top:32px}</style></head><body>
<h1>${esc(data.title)}</h1><p class="m">${esc(data.meta)}</p><p class="m">${esc(t('cockpit.share.asOf', { date: fmtDate(new Date()) }))}</p>
${parts.status ? sec(t('cockpit.status.title'), `<div class="steps">${data.steps.map(([l, n]) => `<div><b>${n}</b>${esc(l)}</div>`).join('')}</div><p>${esc(data.statusLine)}</p>`) : ''}
${parts.finalists && data.finalists.length ? sec(t('cockpit.final.title'), `<table>${data.finalists.map((f) => `<tr><td><b>${esc(f.name)}</b></td><td>${esc(f.facts)}</td></tr>`).join('')}</table>`) : ''}
${parts.appointments && data.appointments.length ? sec(t('cockpit.share.appointments'), `<table>${data.appointments.map((a) => `<tr><td>${esc(a)}</td></tr>`).join('')}</table>`) : ''}
${parts.terms && data.facts.length ? sec(t('cockpit.agreement.title'), `<table>${data.facts.map(([l, v]) => `<tr><td>${esc(l)}</td><td>${esc(v)}</td></tr>`).join('')}</table>`) : ''}
<p class="f">${esc(t('cockpit.share.footer'))}</p>
<script>window.onload=function(){setTimeout(function(){window.print()},200)}<\/script></body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}

export function ShareStatusDialog({ open, onOpenChange, data }: { open: boolean; onOpenChange: (o: boolean) => void; data: ShareData }) {
  const { t } = useTranslation('clientJobs');
  const [parts, setParts] = useState({ status: true, finalists: true, appointments: true, terms: false });
  const toggle = (k: keyof typeof parts) => setParts((p) => ({ ...p, [k]: !p[k] }));
  const make = () => {
    if (!printShare(data, parts, t)) { toast.error(t('cockpit.share.blocked')); return; }
    onOpenChange(false);
  };
  const opts: [keyof typeof parts, string][] = [
    ['status', t('cockpit.status.title')],
    ['finalists', t('cockpit.final.title')],
    ['appointments', t('cockpit.share.appointments')],
    ['terms', t('cockpit.agreement.title')],
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('cockpit.share.title')}</DialogTitle>
          <DialogDescription>{t('cockpit.share.text')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t('cockpit.share.parts')}</p>
          {opts.map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <Checkbox checked={parts[k]} onCheckedChange={() => toggle(k)} />{label}
            </label>
          ))}
        </div>
        <div className="rounded-lg border bg-muted/30 p-3 text-xs leading-5">
          <p className="font-medium">{data.title}</p>
          {parts.status && <p className="text-muted-foreground">{data.steps.map(([l, n]) => `${n} ${l}`).join(' · ')}</p>}
          {parts.finalists && data.finalists.length > 0 && <p className="text-muted-foreground">{data.finalists.map((f) => f.name).join(', ')}</p>}
          {parts.appointments && data.appointments[0] && <p className="text-muted-foreground">{data.appointments[0]}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={make} className="gap-1.5"><FileDown className="h-4 w-4" />{t('cockpit.share.pdf')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ================================================================== Für Sie (Highlights)

const SNOOZE_KEY = 'matchunt-foryou-later';
const today = () => new Date().toISOString().slice(0, 10);
function readSnoozed(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SNOOZE_KEY) || '{}') as { day?: string; keys?: string[] };
    return raw.day === today() ? raw.keys ?? [] : [];
  } catch { return []; }
}
function writeSnoozed(keys: string[]) {
  try { localStorage.setItem(SNOOZE_KEY, JSON.stringify({ day: today(), keys })); } catch { /* privates Fenster */ }
}

/**
 * „Für Sie“ (15.11.2026, Apple-Highlights): ein Schritt groß, in einem Satz, mit einem Knopf
 * und „Später“. Weiterblättern über Punkte und Pfeile; „Alle anzeigen“ zeigt alle Schritte
 * ruhig nach Heute und Diese Woche. „Später“ schiebt nur für heute ans Ende (im Browser gemerkt).
 */
export function ForYouCard({ tasks, waiting, items, loading, onOpen }: {
  tasks: ClientTask[]; waiting: ClientWaitingItem[]; items: BewerberItem[]; loading: boolean; onOpen: (t: ClientTask) => void;
}) {
  const { t } = useTranslation('clientJobs');
  const [snoozed, setSnoozed] = useState<string[]>(() => readSnoozed());
  const [idx, setIdx] = useState(0);
  const [all, setAll] = useState(false);
  const bySub = useMemo(() => new Map(items.map((i) => [i.submissionId, i])), [items]);

  const ordered = [...tasks].sort((a, b) =>
    Number(snoozed.includes(a.key)) - Number(snoozed.includes(b.key))
    || Number(b.urgent) - Number(a.urgent)
    || (a.since ?? '').localeCompare(b.since ?? ''));
  const cur = ordered[Math.min(idx, Math.max(0, ordered.length - 1))];

  const nameOf = (task: ClientTask) => {
    const it = task.submissionId ? bySub.get(task.submissionId) : undefined;
    if (it?.fullName) return it.fullName;
    if (it?.currentRole) return it.currentRole;
    return task.who || null;
  };
  const later = () => {
    if (!cur) return;
    const next = [...new Set([...snoozed, cur.key])];
    setSnoozed(next);
    writeSnoozed(next);
    setIdx(0);
  };

  if (loading) {
    return <div className="rounded-[20px] border bg-card p-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  }

  if (ordered.length === 0) {
    return (
      <div className="rounded-[20px] border bg-card p-6">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{t('foryou.title')}</h3>
        <p className="mt-4 text-xl font-semibold tracking-tight">{t('foryou.nothing')}</p>
        {waiting[0] && <p className="mt-2 text-sm text-muted-foreground">{t('foryou.expected', { what: waiting[0].title })}</p>}
      </div>
    );
  }

  if (all) {
    const isToday = (x: ClientTask) => x.urgent || daysSince(x.since) >= 3;
    const groups: [string, ClientTask[]][] = [[t('foryou.today'), ordered.filter(isToday)], [t('foryou.week'), ordered.filter((x) => !isToday(x))]];
    return (
      <div className="rounded-[20px] border bg-card p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{t('foryou.title')}</h3>
          <button type="button" className={linkBtn} onClick={() => setAll(false)}>{t('foryou.back')}</button>
        </div>
        {groups.filter(([, list]) => list.length).map(([label, list]) => (
          <div key={label} className="mt-4">
            <p className="text-sm font-semibold">{label}</p>
            {list.map((x) => (
              <button key={x.key} type="button" onClick={() => onOpen(x)} className="flex w-full items-start gap-3 border-b py-3 text-left last:border-b-0 hover:bg-muted/30">
                <span className={cn('mt-0.5 h-5 w-5 shrink-0 rounded-full border-[1.5px]', label === t('foryou.today') ? 'border-amber-500' : 'border-border')} />
                <span className="min-w-0">
                  <span className="block text-sm">{nameOf(x) ? t('foryou.headline', { title: x.title, who: nameOf(x) }) : x.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{[x.detail, t('cockpit.work.since', { count: daysSince(x.since) })].filter(Boolean).join(' · ')}</span>
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  }

  const dots = Math.min(ordered.length, 7);
  return (
    <div className="rounded-[20px] border bg-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{t('foryou.title')}</h3>
        <span className="text-xs text-muted-foreground">{t('foryou.position', { n: Math.min(idx, ordered.length - 1) + 1, total: ordered.length })}</span>
      </div>
      <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.06em] text-amber-400 dark:text-amber-600">
        {daysSince(cur.since) === 0 ? t('foryou.since_zero') : t('foryou.since', { count: daysSince(cur.since) })}
      </p>
      <p className="mt-2 text-xl font-semibold leading-snug tracking-tight">{nameOf(cur) ? t('foryou.headline', { title: cur.title, who: nameOf(cur) }) : cur.title}</p>
      {cur.detail && <p className="mt-2 text-sm text-muted-foreground">{cur.detail}</p>}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button className="rounded-full px-5" onClick={() => onOpen(cur)}>{taskMainLabel(cur.kind)}</Button>
        {ordered.length > 1 && <Button variant="secondary" className="rounded-full px-5" onClick={later}>{t('foryou.later')}</Button>}
      </div>
      {ordered.length > 1 && (
        <div className="mt-5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: dots }, (_, i) => (
              <button key={i} type="button" aria-label={String(i + 1)} onClick={() => setIdx(i)}
                className={cn('h-1.5 rounded-full transition-all', i === Math.min(idx, dots - 1) ? 'w-4 bg-foreground' : 'w-1.5 bg-border')} />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full" aria-label={t('foryou.prev')} onClick={() => setIdx((i) => (i - 1 + ordered.length) % ordered.length)}><ChevronRight className="h-4 w-4 rotate-180" /></Button>
            <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full" aria-label={t('foryou.next')} onClick={() => setIdx((i) => (i + 1) % ordered.length)}><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="secondary" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={() => setAll(true)}>{t('foryou.all')}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** „Läuft bei anderen“: Kandidaten, bei denen gerade jemand anderes am Zug ist. */
export function OthersCard({ tasks, waiting, items }: { tasks: ClientTask[]; waiting: ClientWaitingItem[]; items: BewerberItem[] }) {
  const { t } = useTranslation('clientJobs');
  const navigate = useNavigate();
  const taskSubs = new Set(tasks.map((x) => x.submissionId).filter(Boolean));
  const others = items.filter((i) => i.tab !== 'archiv' && !taskSubs.has(i.submissionId))
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
  if (others.length === 0) return null;
  return (
    <SectionCard title={t('foryou.othersTitle')}>
      {others.slice(0, 5).map((item) => (
        <button key={item.submissionId} type="button" onClick={() => navigate(`/dashboard/candidates/${item.submissionId}`)}
          className="flex w-full items-center gap-3 border-t py-2 text-left first:border-t-0 hover:bg-muted/40">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">{item.fullName || item.currentRole || item.anonymizedName}</span>
            <span className="block truncate text-xs text-muted-foreground">{waiting.find((w) => w.submissionId === item.submissionId)?.title ?? ''}</span>
          </span>
          <BewerberStatusPill item={item} />
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
        </button>
      ))}
      {others.length > 5 && <p className="mt-1 text-xs text-muted-foreground">{t('foryou.othersMore', { count: others.length - 5 })}</p>}
    </SectionCard>
  );
}
