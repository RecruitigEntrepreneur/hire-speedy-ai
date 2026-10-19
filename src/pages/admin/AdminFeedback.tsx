import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import { Loader2, Search, Sparkles, TriangleAlert } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useFeedbackEnabled } from '@/lib/feedback/api';
import { networkOf } from '@/lib/feedback/brief';
import {
  AREA_LABEL,
  KIND_LABEL,
  KIND_OPTIONS,
  OPEN_STATUSES,
  PRIORITY_OPTIONS,
  ROLE_LABEL,
  SEVERITY_LABEL,
  STATUS_LABEL,
  STATUS_SHORT,
  ticketLabel,
  type FeedbackArea,
  type FeedbackKind,
  type FeedbackSeverity,
  type FeedbackStatus,
} from '@/lib/feedback/labels';
import {
  useFeedbackSwitch,
  useFeedbackTeam,
  useFeedbackTickets,
  useMergeTickets,
  useUpdateTickets,
  type FeedbackRow,
} from '@/hooks/useAdminFeedback';
import { PriorityBadge, StatusBadge, initialsOf } from '@/components/admin/feedback/FeedbackBadges';

/**
 * Admin › Feedback: der Ticket-Eingang (Zielbild 19.10.2026).
 *
 * Kennzahlen, Ansichten (Offen, Meine, P0/P1, Wartet auf Deploy, Live, Alle),
 * Filter und eine Tabelle, deren Zeilen die Ticketseite öffnen. Mehrfachauswahl
 * für Status, Zuständig und Zusammenführen von Duplikaten.
 */

type View = 'open' | 'mine' | 'urgent' | 'built' | 'done' | 'closed' | 'all';
type Sort = 'priority' | 'newest';

const VIEWS: { value: View; label: string }[] = [
  { value: 'open', label: 'Offen' },
  { value: 'mine', label: 'Meine' },
  { value: 'urgent', label: 'P0/P1' },
  { value: 'built', label: 'Wartet auf Deploy' },
  { value: 'done', label: 'Live' },
  { value: 'closed', label: 'Verworfen/Duplikat' },
  { value: 'all', label: 'Alle' },
];

const PRIORITY_RANK: Record<string, number> = { p0: 0, p1: 1, p2: 2, p3: 3 };
const isOpen = (r: FeedbackRow) => OPEN_STATUSES.includes(r.status as FeedbackStatus);

function inView(r: FeedbackRow, view: View, me: string | undefined) {
  switch (view) {
    case 'open':
      return isOpen(r);
    case 'mine':
      return isOpen(r) && !!me && r.assignee_id === me;
    case 'urgent':
      return isOpen(r) && (r.priority === 'p0' || r.priority === 'p1');
    case 'built':
      return r.status === 'built';
    case 'done':
      return r.status === 'done';
    case 'closed':
      return r.status === 'dismissed' || r.status === 'duplicate';
    default:
      return true;
  }
}

export default function AdminFeedback() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const me = user?.id;

  const [view, setView] = useState<View>('open');
  const [area, setArea] = useState<FeedbackArea | 'all'>('all');
  const [kind, setKind] = useState<FeedbackKind | 'all'>('all');
  const [priority, setPriority] = useState<string>('all');
  const [assignee, setAssignee] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('priority');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: rows = [], isLoading, error } = useFeedbackTickets();
  const { data: team = [] } = useFeedbackTeam();
  const { data: enabled = false, isLoading: switchLoading } = useFeedbackEnabled();
  const toggle = useFeedbackSwitch();
  const update = useUpdateTickets();
  const merge = useMergeTickets();

  const teamName = useMemo(() => new Map(team.map((t) => [t.user_id, t.name || t.email || 'Admin'])), [team]);
  const reportsOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.duplicate_of) m.set(r.duplicate_of, (m.get(r.duplicate_of) ?? 0) + 1);
    return m;
  }, [rows]);

  const stats = useMemo(() => {
    const week = Date.now() - 7 * 86_400_000;
    const done = rows.filter((r) => r.status === 'done' && r.status_changed_at);
    const durations = done
      .filter((r) => new Date(r.status_changed_at!).getTime() > Date.now() - 30 * 86_400_000)
      .map((r) => new Date(r.status_changed_at!).getTime() - new Date(r.created_at).getTime());
    const avgDays = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length / 86_400_000 : null;
    return [
      { label: 'Neu', value: rows.filter((r) => r.status === 'new').length, alert: false },
      { label: 'P0/P1 offen', value: rows.filter((r) => isOpen(r) && (r.priority === 'p0' || r.priority === 'p1')).length, alert: true },
      { label: 'In Arbeit', value: rows.filter((r) => r.status === 'in_progress').length, alert: false },
      { label: 'Wartet auf Deploy', value: rows.filter((r) => r.status === 'built').length, alert: false },
      { label: 'Live (7 Tage)', value: done.filter((r) => new Date(r.status_changed_at!).getTime() > week).length, alert: false },
      {
        label: 'Ø bis live (30 Tage)',
        value: avgDays == null ? '—' : `${avgDays.toLocaleString('de-DE', { maximumFractionDigits: 1 })} T`,
        alert: false,
      },
    ];
  }, [rows]);

  const viewCount = (v: View) => rows.filter((r) => inView(r, v, me)).length;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (!inView(r, view, me)) return false;
      if (area !== 'all' && r.area !== area) return false;
      if (kind !== 'all' && r.kind !== kind) return false;
      if (priority !== 'all' && (priority === 'none' ? r.priority : r.priority !== priority)) return false;
      if (assignee !== 'all' && (assignee === 'none' ? r.assignee_id : r.assignee_id !== assignee)) return false;
      if (q) {
        const hay = [ticketLabel(r.ticket_no), String(r.ticket_no), r.title, r.message, r.page_path, r.reporter_name, r.reporter_company, r.source_file]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return list.sort((a, b) => {
      if (sort === 'priority') {
        const pa = PRIORITY_RANK[a.priority ?? ''] ?? 9;
        const pb = PRIORITY_RANK[b.priority ?? ''] ?? 9;
        if (pa !== pb) return pa - pb;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [rows, view, me, area, kind, priority, assignee, search, sort]);

  const selectedRows = rows.filter((r) => selected.has(r.id));
  const toggleOne = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allVisibleSelected ? new Set() : new Set(visible.map((r) => r.id)));

  const bulk = (patch: Parameters<typeof update.mutate>[0]['patch'], done: string) =>
    update.mutate(
      { ids: [...selected], patch },
      {
        onSuccess: () => {
          toast.success(done);
          setSelected(new Set());
        },
        onError: () => toast.error('Konnte nicht gespeichert werden.'),
      },
    );

  const mergeSelected = () => {
    const sorted = [...selectedRows].sort((a, b) => a.ticket_no - b.ticket_no);
    const main = sorted[0];
    if (!main || sorted.length < 2) return;
    merge.mutate(
      { mainId: main.id, duplicateIds: sorted.slice(1).map((r) => r.id) },
      {
        onSuccess: () => {
          toast.success(`${sorted.length - 1} Ticket(s) in ${ticketLabel(main.ticket_no)} zusammengeführt`);
          setSelected(new Set());
        },
        onError: () => toast.error('Zusammenführen hat nicht geklappt.'),
      },
    );
  };

  const onToggle = (value: boolean) =>
    toggle.mutate(value, {
      onSuccess: () => toast.success(value ? 'Feedback-Lasche ist für alle an' : 'Feedback-Lasche ist aus (nur Admins sehen sie)'),
      onError: () => toast.error('Schalter konnte nicht gespeichert werden.'),
    });

  const ago = (iso: string) => formatDistanceToNowStrict(new Date(iso), { locale: de });

  return (
    <DashboardLayout fluid>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Feedback</h1>
            <p className="text-sm text-muted-foreground">
              Tickets aus der Feedback-Lasche, mit KI-Briefing für das Entwickler-Team.
            </p>
          </div>
          <Card className={cn('w-full sm:w-auto', !enabled && 'border-amber-500/40 bg-amber-500/5')}>
            <CardContent className="flex items-center gap-4 p-3">
              <div>
                <p className="text-sm font-medium">Feedback-Lasche für alle</p>
                <p className="text-xs text-muted-foreground">
                  {enabled ? 'An: Kunden, Headhunter und Aufnahme-Links sehen sie.' : 'Aus (Notaus): nur Admins sehen sie.'}
                </p>
              </div>
              <Switch
                checked={enabled}
                disabled={switchLoading || toggle.isPending}
                onCheckedChange={onToggle}
                aria-label="Feedback-Lasche für alle"
              />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((s) => (
            <Card key={s.label} className={cn(s.alert && Number(s.value) > 0 && 'border-destructive/40 bg-destructive/5')}>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={cn('text-xl font-semibold', s.alert && Number(s.value) > 0 && 'text-destructive')}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {VIEWS.map((v) => {
            const count = viewCount(v.value);
            return (
              <button
                key={v.value}
                type="button"
                onClick={() => {
                  setView(v.value);
                  setSelected(new Set());
                }}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs transition-colors',
                  view === v.value ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {v.label}
                {v.value !== 'all' && count > 0 && <span className="ml-1.5 tabular-nums opacity-70">{count}</span>}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="FB-0012, Text, Seite, Datei" className="h-9 pl-9" />
          </div>
          <FilterSelect value={area} onChange={(v) => setArea(v as FeedbackArea | 'all')} options={[['all', 'Alle Bereiche'], ...Object.entries(AREA_LABEL)]} />
          <FilterSelect value={kind} onChange={(v) => setKind(v as FeedbackKind | 'all')} options={[['all', 'Alle Arten'], ...KIND_OPTIONS.map((o) => [o.value, o.label] as [string, string])]} />
          <FilterSelect
            value={priority}
            onChange={setPriority}
            options={[['all', 'Alle Prioritäten'], ...PRIORITY_OPTIONS.map((o) => [o.value, o.label] as [string, string]), ['none', 'Ohne Priorität']]}
          />
          <FilterSelect
            value={assignee}
            onChange={setAssignee}
            options={[['all', 'Alle Zuständigen'], ['none', 'Niemand'], ...team.map((t) => [t.user_id, t.name || t.email || 'Admin'] as [string, string])]}
          />
          <FilterSelect value={sort} onChange={(v) => setSort(v as Sort)} options={[['priority', 'Nach Priorität'], ['newest', 'Neueste zuerst']]} />
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
            <span className="font-medium">{selected.size} ausgewählt</span>
            <Select onValueChange={(v) => bulk({ status: v as FeedbackStatus }, `Status: ${STATUS_LABEL[v as FeedbackStatus]}`)}>
              <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue placeholder="Status setzen" /></SelectTrigger>
              <SelectContent>
                {(['new', 'in_progress', 'built', 'done', 'dismissed'] as FeedbackStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={(v) => bulk({ assignee_id: v === 'none' ? null : v }, 'Zuständig gesetzt')}>
              <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Zuständig setzen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Niemand</SelectItem>
                {team.map((t) => (
                  <SelectItem key={t.user_id} value={t.user_id}>{t.name || t.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-8 text-xs" disabled={selected.size < 2 || merge.isPending} onClick={mergeSelected}>
              Zusammenführen
            </Button>
            <span className="text-xs text-muted-foreground">
              {selected.size >= 2 && `Hauptticket wird ${ticketLabel(Math.min(...selectedRows.map((r) => r.ticket_no)))}`}
            </span>
            <Button size="sm" variant="ghost" className="ml-auto h-8 text-xs" onClick={() => setSelected(new Set())}>
              Auswahl aufheben
            </Button>
          </div>
        )}

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="p-6 text-sm text-destructive">
                Die Tickets konnten nicht geladen werden. Möglicherweise ist die Migration
                20261019150000_feedback_lasche.sql noch nicht angewandt (LOVABLE_DB_PROMPTS.md, Nr. 20).
              </div>
            ) : visible.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                {view === 'open' ? 'Keine offenen Tickets.' : 'Nichts in dieser Ansicht.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="w-10 px-3 py-2">
                        <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} aria-label="Alle auswählen" />
                      </th>
                      <th className="w-[84px] px-2 py-2 font-normal">Ticket</th>
                      <th className="w-[52px] px-2 py-2 font-normal">Prio</th>
                      <th className="px-2 py-2 font-normal">Titel</th>
                      <th className="w-[190px] px-2 py-2 font-normal">Bereich · Seite</th>
                      <th className="w-[150px] px-2 py-2 font-normal">Von</th>
                      <th className="w-[130px] px-2 py-2 font-normal">Status</th>
                      <th className="w-[56px] px-2 py-2 font-normal">Wer</th>
                      <th className="w-[72px] px-3 py-2 text-right font-normal">Alter</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r) => {
                      const reports = 1 + (reportsOf.get(r.id) ?? 0);
                      const net = networkOf(r.network_errors).length;
                      const open = () => navigate(`/admin/feedback/${ticketLabel(r.ticket_no)}`);
                      return (
                        <tr
                          key={r.id}
                          onClick={open}
                          className={cn(
                            'cursor-pointer border-b border-border align-top transition-colors last:border-0 hover:bg-muted/50',
                            selected.has(r.id) && 'bg-muted/60',
                          )}
                        >
                          <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} aria-label={`${ticketLabel(r.ticket_no)} auswählen`} />
                          </td>
                          <td className="px-2 py-2.5 font-mono text-xs tabular-nums">{ticketLabel(r.ticket_no)}</td>
                          <td className="px-2 py-2.5"><PriorityBadge priority={r.priority} /></td>
                          <td className="px-2 py-2.5">
                            <p className={cn('line-clamp-2', r.status === 'new' && 'font-medium')}>
                              {r.title ?? r.message.split('\n')[0]}
                            </p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                              {[
                                r.kind ? KIND_LABEL[r.kind as FeedbackKind] : null,
                                r.severity ? SEVERITY_LABEL[r.severity as FeedbackSeverity] : null,
                                reports > 1 ? `${reports} Meldungen` : null,
                                net ? `${net} Netzwerkfehler` : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                              {r.ai_status === 'pending' && (
                                <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> KI schreibt</span>
                              )}
                              {r.ai_status === 'failed' && (
                                <span className="inline-flex items-center gap-1 text-amber-600"><TriangleAlert className="h-3 w-3" /> ohne Briefing</span>
                              )}
                            </p>
                          </td>
                          <td className="px-2 py-2.5">
                            <p>{AREA_LABEL[(r.area ?? 'other') as FeedbackArea]}</p>
                            <p className="truncate text-xs text-muted-foreground" title={r.page_path ?? ''}>{r.page_path ?? '—'}</p>
                          </td>
                          <td className="px-2 py-2.5">
                            <p>{ROLE_LABEL[r.reporter_role ?? ''] ?? '—'}</p>
                            <p className="truncate text-xs text-muted-foreground">{r.reporter_company || r.reporter_name || r.reporter_email || '—'}</p>
                          </td>
                          <td className="px-2 py-2.5"><StatusBadge status={r.status} short /></td>
                          <td className="px-2 py-2.5">
                            {r.assignee_id ? (
                              <span
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium"
                                title={teamName.get(r.assignee_id)}
                              >
                                {initialsOf(teamName.get(r.assignee_id))}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs text-muted-foreground">{ago(r.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">
          Status-Ablauf: {(['new', 'in_progress', 'built', 'done'] as FeedbackStatus[]).map((s) => STATUS_SHORT[s]).join(' → ')}. Bei „Live
          erledigt“ bekommen alle Absender eine Nachricht in der Glocke. Bilder werden nach 90 Tagen gelöscht.
        </p>
      </div>
    </DashboardLayout>
  );
}

function FilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-auto min-w-[150px] text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>{l}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
