import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Bell,
  ClipboardCopy,
  Code2,
  ExternalLink,
  GitMerge,
  ImageOff,
  Loader2,
  Mail,
  RefreshCw,
  Sparkles,
  TriangleAlert,
  User,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  briefOf,
  consoleOf,
  marksOf,
  networkOf,
  ticketMarkdown,
  timeOf,
  trailOf,
} from '@/lib/feedback/brief';
import { describeShort } from '@/lib/feedback/elements';
import {
  AREA_LABEL,
  KIND_LABEL,
  parseTicket,
  PRIORITY_OPTIONS,
  ROLE_LABEL,
  SEVERITY_LABEL,
  shortBrowser,
  STATUS_FLOW,
  STATUS_LABEL,
  ticketLabel,
  type FeedbackArea,
  type FeedbackKind,
  type FeedbackSeverity,
  type FeedbackStatus,
} from '@/lib/feedback/labels';
import {
  useAddComment,
  useFeedbackImageUrls,
  useFeedbackTeam,
  useFeedbackTicket,
  useFeedbackTickets,
  useMergeTickets,
  useRegenerateBrief,
  useTicketDuplicates,
  useTicketEvents,
  useUpdateTickets,
  type FeedbackEvent,
  type FeedbackPatch,
  type FeedbackRow,
} from '@/hooks/useAdminFeedback';
import { PriorityBadge, StatusBadge } from '@/components/admin/feedback/FeedbackBadges';

/**
 * Ticketseite /admin/feedback/FB-0012 (Zielbild 19.10.2026).
 *
 * Links das Briefing für das Entwickler-Team (KI, aus Ausschnitten, Klickpfad
 * und Fehlern), rechts das Original mit Bild, Absendern und Technik, unten
 * Verlauf und Team-Kommentare. „Für Claude Code kopieren“ legt den ganzen
 * Auftrag in die Zwischenablage.
 */

const MARK_COLOR = '#D85A30';

export default function AdminFeedbackTicket() {
  const { ticket: param } = useParams<{ ticket: string }>();
  const { data: row, isLoading, error } = useFeedbackTicket(param);

  return (
    <DashboardLayout fluid>
      <div className="space-y-4">
        <Link to="/admin/feedback" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Alle Tickets
        </Link>
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error || !row ? (
          <Card>
            <CardContent className="p-8 text-sm text-muted-foreground">
              {error ? 'Das Ticket konnte nicht geladen werden.' : `${param ?? 'Ticket'} gibt es nicht.`}
            </CardContent>
          </Card>
        ) : (
          <Ticket key={row.id} row={row} />
        )}
      </div>
    </DashboardLayout>
  );
}

function Ticket({ row }: { row: FeedbackRow }) {
  const navigate = useNavigate();
  const brief = briefOf(row.ai_brief);
  const marks = marksOf(row.marks);
  const trail = trailOf(row.breadcrumbs);
  const network = networkOf(row.network_errors);
  const consoleErrors = consoleOf(row.console_errors);
  const vp = (row.viewport ?? {}) as { w?: number; h?: number; dpr?: number };

  const { data: duplicates = [] } = useTicketDuplicates(row.id);
  const { data: events = [] } = useTicketEvents(row.id);
  const { data: team = [] } = useFeedbackTeam();
  const { data: all = [] } = useFeedbackTickets();
  const imagePaths = useMemo(
    () => [row.screenshot_path, ...(row.crop_paths ?? [])].filter((p): p is string => !!p),
    [row.screenshot_path, row.crop_paths],
  );
  const { data: urls = {} } = useFeedbackImageUrls(imagePaths);

  const update = useUpdateTickets();
  const merge = useMergeTickets();
  const regenerate = useRegenerateBrief();

  const teamName = useMemo(() => new Map(team.map((t) => [t.user_id, t.name || t.email || 'Admin'])), [team]);
  const reporters = [row, ...duplicates];
  const notifyCount = reporters.filter((r) => r.user_id && !r.user_notified_at).length;
  const ticket = ticketLabel(row.ticket_no);
  const hasToken = (row.page_path ?? '').includes('[token]');

  const save = (patch: FeedbackPatch, done: string) =>
    update.mutate({ ids: [row.id], patch }, { onSuccess: () => toast.success(done), onError: () => toast.error('Konnte nicht gespeichert werden.') });

  const setStatus = (status: FeedbackStatus) =>
    save(
      { status },
      status === 'done' && notifyCount > 0
        ? `Live erledigt — ${notifyCount} Absender bekommen eine Nachricht in der Glocke`
        : `Status: ${STATUS_LABEL[status]}`,
    );

  const toggleCriterion = (i: number) => {
    const next = row.criteria_done.includes(i) ? row.criteria_done.filter((x) => x !== i) : [...row.criteria_done, i].sort();
    update.mutate({ ids: [row.id], patch: { criteria_done: next } });
  };

  const mergeInto = (mainNo: number) => {
    const main = all.find((r) => r.ticket_no === mainNo);
    if (!main || main.id === row.id) {
      toast.error('Dieses Hauptticket gibt es nicht.');
      return;
    }
    merge.mutate(
      { mainId: main.id, duplicateIds: [row.id] },
      {
        onSuccess: () => {
          toast.success(`${ticket} in ${ticketLabel(main.ticket_no)} zusammengeführt`);
          navigate(`/admin/feedback/${ticketLabel(main.ticket_no)}`);
        },
        onError: () => toast.error('Zusammenführen hat nicht geklappt.'),
      },
    );
  };

  const mergeHere = (other: FeedbackRow) =>
    merge.mutate(
      { mainId: row.id, duplicateIds: [other.id] },
      {
        onSuccess: () => toast.success(`${ticketLabel(other.ticket_no)} hierher zusammengeführt`),
        onError: () => toast.error('Zusammenführen hat nicht geklappt.'),
      },
    );

  const copyForClaude = async () => {
    try {
      await navigator.clipboard.writeText(ticketMarkdown(row, reporters.length, window.location.origin));
      toast.success('Auftrag für Claude Code kopiert');
    } catch {
      toast.error('Zwischenablage nicht verfügbar.');
    }
  };

  const runBrief = () =>
    regenerate.mutate(row.id, {
      onSuccess: () => toast.success('Briefing neu formuliert'),
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Die KI hat gerade nicht geantwortet.'),
    });

  const similar = (brief?.similar ?? [])
    .map((no) => all.find((r) => r.ticket_no === no))
    .filter((r): r is FeedbackRow => !!r && r.id !== row.id && r.duplicate_of !== row.id);

  return (
    <div className="space-y-4">
      {/* Kopf */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-xs text-muted-foreground">{ticket}</p>
              <h1 className="text-xl font-semibold leading-snug">{row.title ?? brief?.title ?? row.message.split('\n')[0]}</h1>
              <p className="mt-1 text-xs text-muted-foreground">
                {AREA_LABEL[(row.area ?? 'other') as FeedbackArea]} · eingegangen {format(new Date(row.created_at), "dd.MM.yyyy 'um' HH:mm", { locale: de })}
                {reporters.length > 1 && ` · ${reporters.length} Meldungen`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={copyForClaude}>
                <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" /> Für Claude Code kopieren
              </Button>
              <Button size="sm" variant="outline" onClick={runBrief} disabled={regenerate.isPending || row.ai_status === 'pending'}>
                {regenerate.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                Neu formulieren
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!row.page_path || hasToken}
                title={hasToken ? 'Seite mit Zugangs-Token — nur der Kunde kann sie öffnen' : undefined}
                onClick={() => window.open(row.page_path!, '_blank', 'noopener')}
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Seite öffnen
              </Button>
            </div>
          </div>

          {/* Status-Ablauf */}
          <div className="flex flex-wrap items-center gap-1.5">
            {row.status === 'duplicate' || row.status === 'dismissed' ? (
              <>
                <StatusBadge status={row.status} />
                {row.status === 'duplicate' && row.duplicate_of && (
                  <DuplicateTarget id={row.duplicate_of} all={all} />
                )}
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setStatus('new')}>
                  Wieder öffnen
                </Button>
              </>
            ) : (
              <>
                {STATUS_FLOW.map((s, i) => {
                  const current = STATUS_FLOW.indexOf(row.status as FeedbackStatus);
                  return (
                    <span key={s} className="flex items-center gap-1.5">
                      {i > 0 && <span className="text-muted-foreground">→</span>}
                      <button
                        type="button"
                        onClick={() => s !== row.status && setStatus(s)}
                        disabled={update.isPending}
                        className={cn(
                          'rounded-full border px-3 py-1 text-xs transition-colors',
                          s === row.status
                            ? 'border-foreground bg-foreground text-background'
                            : i < current
                            ? 'border-border text-foreground/70 line-through decoration-muted-foreground/40'
                            : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground',
                        )}
                      >
                        {STATUS_LABEL[s]}
                      </button>
                    </span>
                  );
                })}
                <span className="mx-1 h-4 w-px bg-border" />
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setStatus('dismissed')}>
                  Verwerfen
                </Button>
                <MergePopover onMerge={mergeInto} pending={merge.isPending} />
              </>
            )}
          </div>
          {row.status !== 'done' && notifyCount > 0 && row.status !== 'duplicate' && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Bell className="h-3.5 w-3.5" /> Bei „Live erledigt“ bekommen {notifyCount === 1 ? 'der Absender' : `${notifyCount} Absender`} eine Nachricht in der Glocke.
            </p>
          )}

          {/* Priorität und Zuständig */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={row.priority ?? 'none'} onValueChange={(v) => save({ priority: v === 'none' ? null : v }, `Priorität: ${v.toUpperCase()}`)}>
              <SelectTrigger className="h-8 w-[260px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ohne Priorität</SelectItem>
                {PRIORITY_OPTIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label} · {p.hint}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={row.assignee_id ?? 'none'} onValueChange={(v) => save({ assignee_id: v === 'none' ? null : v }, 'Zuständig gesetzt')}>
              <SelectTrigger className="h-8 w-[220px] text-xs">
                <SelectValue placeholder="Zuständig" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Zuständig: niemand</SelectItem>
                {team.map((t) => (
                  <SelectItem key={t.user_id} value={t.user_id}>
                    Zuständig: {t.name || t.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {brief && row.priority && brief.priority !== row.priority && (
              <span className="text-xs text-muted-foreground">KI schlug {brief.priority.toUpperCase()} vor</span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* Briefing */}
        <Card className="self-start">
          <CardContent className="space-y-4 p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Code2 className="h-4 w-4" /> Briefing für das Entwickler-Team
              {row.ai_model && <span className="font-normal text-muted-foreground">· KI ({row.ai_model.replace(/^.*\//, '')})</span>}
            </h2>

            {row.ai_status === 'pending' && !brief && (
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4 animate-pulse" /> Die KI schreibt das Briefing …
                </p>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            )}
            {row.ai_status === 'failed' && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p>Das KI-Briefing ist fehlgeschlagen{row.ai_error ? `: ${row.ai_error}` : '.'}</p>
                  <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={runBrief} disabled={regenerate.isPending}>
                    Noch einmal versuchen
                  </Button>
                </div>
              </div>
            )}

            {brief && (
              <>
                <Section title="Zusammenfassung">{brief.summary}</Section>
                <Section title="Wirkung">
                  {brief.impact}
                  {brief.priority_reason && (
                    <span className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                      <PriorityBadge priority={brief.priority} /> {brief.priority_reason}
                    </span>
                  )}
                </Section>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Section title="Ist">{brief.actual}</Section>
                  <Section title="Soll">{brief.expected}</Section>
                </div>
                <Section title="Schritte zum Nachstellen">
                  <ol className="list-decimal space-y-0.5 pl-5">
                    {brief.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </Section>
              </>
            )}

            <Section title="Betroffene Stelle">
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
                <dt className="text-muted-foreground">Seite</dt>
                <dd className="break-all">{row.page_path ?? '—'}</dd>
                <dt className="text-muted-foreground">Route</dt>
                <dd className="font-mono text-xs">{row.route_pattern ?? '—'}</dd>
                <dt className="text-muted-foreground">Datei</dt>
                <dd className="break-all font-mono text-xs">{row.source_file ?? '—'}</dd>
                {brief?.element && (
                  <>
                    <dt className="text-muted-foreground">Element</dt>
                    <dd>{brief.element}</dd>
                  </>
                )}
                {marks.map((m, i) =>
                  m.element ? (
                    <FragmentRow key={i} label={`Rahmen ${i + 1}`}>
                      {describeShort(m.element)}
                      {m.element.inside?.length ? <span className="text-muted-foreground"> · darin: {m.element.inside.join(', ')}</span> : null}
                    </FragmentRow>
                  ) : null,
                )}
              </dl>
            </Section>

            {brief && (
              <>
                <Section title="Vermutete Ursache">{brief.suspected_cause}</Section>
                <Section title="Lösungsvorschlag">{brief.fix_suggestion}</Section>
                <Section title={`Akzeptanzkriterien (${row.criteria_done.length}/${brief.acceptance_criteria.length})`}>
                  <ul className="space-y-1.5">
                    {brief.acceptance_criteria.map((c, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Checkbox
                          id={`crit-${i}`}
                          checked={row.criteria_done.includes(i)}
                          onCheckedChange={() => toggleCriterion(i)}
                          className="mt-0.5"
                        />
                        <label htmlFor={`crit-${i}`} className={cn('cursor-pointer', row.criteria_done.includes(i) && 'text-muted-foreground line-through')}>
                          {c}
                        </label>
                      </li>
                    ))}
                  </ul>
                </Section>
                {brief.test_steps.length > 0 && (
                  <Section title="So prüfen">
                    <ol className="list-decimal space-y-0.5 pl-5">
                      {brief.test_steps.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                  </Section>
                )}
                {brief.open_questions.length > 0 && (
                  <Section title="Offene Fragen">
                    <ul className="list-disc space-y-0.5 pl-5">
                      {brief.open_questions.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </Section>
                )}
                {similar.length > 0 && (
                  <Section title="Ähnliche Tickets">
                    <ul className="space-y-1.5">
                      {similar.map((s) => (
                        <li key={s.id} className="flex flex-wrap items-center gap-2">
                          <Link to={`/admin/feedback/${ticketLabel(s.ticket_no)}`} className="font-mono text-xs underline-offset-2 hover:underline">
                            {ticketLabel(s.ticket_no)}
                          </Link>
                          <span className="min-w-0 flex-1 truncate">{s.title ?? s.message.split('\n')[0]}</span>
                          <StatusBadge status={s.status} short />
                          {s.status !== 'duplicate' && (
                            <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => mergeHere(s)} disabled={merge.isPending}>
                              <GitMerge className="mr-1 h-3 w-3" /> Hierher zusammenführen
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Original und Technik */}
        <div className="space-y-4 self-start">
          <Card>
            <CardContent className="space-y-3 p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <User className="h-4 w-4" /> Original vom Nutzer
              </h2>
              {row.screenshot_path ? (
                <a
                  href={urls[row.screenshot_path]}
                  target="_blank"
                  rel="noreferrer"
                  title="Bild in voller Größe öffnen"
                  className="relative block overflow-hidden rounded-md border border-border bg-muted"
                  style={{ aspectRatio: vp.w && vp.h ? `${vp.w} / ${vp.h}` : '16 / 10' }}
                >
                  {urls[row.screenshot_path] ? (
                    <img src={urls[row.screenshot_path]} alt="Bild der Seite beim Absenden" className="absolute inset-0 h-full w-full" />
                  ) : (
                    <Loader2 className="absolute inset-0 m-auto h-5 w-5 animate-spin text-muted-foreground" />
                  )}
                  {marks.map((m, i) => (
                    <div
                      key={i}
                      className="absolute rounded-sm"
                      style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `${m.w * 100}%`, height: `${m.h * 100}%`, border: `2px dashed ${MARK_COLOR}` }}
                    >
                      <span
                        className="absolute -left-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                        style={{ background: MARK_COLOR }}
                      >
                        {i + 1}
                      </span>
                    </div>
                  ))}
                </a>
              ) : (
                <div className="flex items-center gap-2 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                  <ImageOff className="h-4 w-4 shrink-0" />
                  {row.screenshot_deleted_at
                    ? `Bild nach 90 Tagen gelöscht (${format(new Date(row.screenshot_deleted_at), 'dd.MM.yyyy')}).`
                    : row.screenshot_note ?? 'Kein Bild mitgeschickt.'}
                </div>
              )}
              {row.blackout_count > 0 && <p className="text-xs text-muted-foreground">{row.blackout_count} Stelle(n) vom Nutzer geschwärzt.</p>}
              {(row.crop_paths ?? []).length > 0 && (
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Ausschnitte (die sieht die KI)</p>
                  <div className="flex flex-wrap gap-2">
                    {row.crop_paths.map((p, i) => (
                      <a key={p} href={urls[p]} target="_blank" rel="noreferrer" className="relative block h-16 overflow-hidden rounded border border-border bg-muted">
                        {urls[p] && <img src={urls[p]} alt={`Ausschnitt ${i + 1}`} className="h-full w-auto" />}
                        <span className="absolute left-1 top-1 rounded-full px-1 text-[10px] font-semibold text-white" style={{ background: MARK_COLOR }}>
                          {i + 1}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {reporters.map((r) => (
                  <div key={r.id} className="space-y-1">
                    <blockquote className="whitespace-pre-wrap border-l-2 pl-3 text-sm" style={{ borderColor: MARK_COLOR }}>
                      {r.message}
                    </blockquote>
                    <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                      {r.id !== row.id && (
                        <Link to={`/admin/feedback/${ticketLabel(r.ticket_no)}`} className="font-mono underline-offset-2 hover:underline">
                          {ticketLabel(r.ticket_no)}
                        </Link>
                      )}
                      <span>{ROLE_LABEL[r.reporter_role ?? ''] ?? '—'}</span>
                      {r.reporter_name && <span>· {r.reporter_name}</span>}
                      {r.reporter_company && <span>· {r.reporter_company}</span>}
                      {r.reporter_email && (
                        <a href={`mailto:${r.reporter_email}?subject=${encodeURIComponent(`Ihr Feedback ${ticketLabel(r.ticket_no)}`)}`} className="inline-flex items-center gap-0.5 underline-offset-2 hover:underline">
                          · <Mail className="h-3 w-3" /> {r.reporter_email}
                        </a>
                      )}
                      <span>· {format(new Date(r.created_at), 'dd.MM. HH:mm')}</span>
                      {r.kind && <span>· {KIND_LABEL[r.kind as FeedbackKind]}</span>}
                      {r.severity && <span>· {SEVERITY_LABEL[r.severity as FeedbackSeverity]}</span>}
                      {r.user_notified_at && (
                        <span className="inline-flex items-center gap-0.5">
                          · <Bell className="h-3 w-3" /> benachrichtigt
                        </span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-4 text-sm">
              <h2 className="text-sm font-semibold">Technik</h2>
              <p className="text-xs text-muted-foreground">
                {shortBrowser(row.user_agent)}
                {vp.w ? ` · ${vp.w}×${vp.h}${vp.dpr && vp.dpr !== 1 ? ` @${vp.dpr}x` : ''}` : ''} · App-Stand {row.app_version ?? '—'}
              </p>
              {trail.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium">Klickpfad (ohne getippte Werte)</p>
                  <ol className="max-h-72 space-y-0.5 overflow-y-auto text-xs">
                    {trail.map((t, i) => (
                      <li key={i} className={cn('flex gap-2', t.type === 'error' && 'text-destructive')}>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{timeOf(t.t)}</span>
                        <span className="min-w-0 break-words">{t.label}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {network.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium">Netzwerkfehler ({network.length})</p>
                  <ul className="space-y-0.5 font-mono text-[11px]">
                    {network.map((n, i) => (
                      <li key={i} className="break-all">
                        <span className="text-muted-foreground">{timeOf(n.t)}</span> {n.method} {n.url} →{' '}
                        <span className="text-destructive">{n.status || 'keine Verbindung'}</span> <span className="text-muted-foreground">({n.ms} ms)</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {consoleErrors.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-xs font-medium">Konsolenfehler ({consoleErrors.length})</summary>
                  <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto font-mono text-[11px]">
                    {consoleErrors.map((c, i) => (
                      <li key={i} className="break-all">
                        <span className="text-muted-foreground">{timeOf(c.t)}</span> {c.m}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Timeline feedbackId={row.id} events={events} teamName={teamName} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-xs font-medium text-muted-foreground">{title}</h3>
      <div className="rounded-md border border-border px-3 py-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function FragmentRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

function DuplicateTarget({ id, all }: { id: string; all: FeedbackRow[] }) {
  const main = all.find((r) => r.id === id);
  if (!main) return null;
  return (
    <Link to={`/admin/feedback/${ticketLabel(main.ticket_no)}`} className="text-xs underline-offset-2 hover:underline">
      von {ticketLabel(main.ticket_no)}: {main.title ?? main.message.split('\n')[0]}
    </Link>
  );
}

function MergePopover({ onMerge, pending }: { onMerge: (ticketNo: number) => void; pending: boolean }) {
  const [value, setValue] = useState('');
  const no = parseTicket(value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 text-xs">
          <GitMerge className="mr-1 h-3.5 w-3.5" /> Duplikat von …
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2" align="start">
        <p className="text-xs text-muted-foreground">Dieses Ticket in ein anderes zusammenführen. Seine Absender werden mit dem Hauptticket benachrichtigt.</p>
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="FB-0007" className="h-8 text-sm" />
        <Button size="sm" className="h-8 w-full text-xs" disabled={no == null || pending} onClick={() => no != null && onMerge(no)}>
          Zusammenführen
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function eventText(e: FeedbackEvent): ReactNode {
  const d = (e.data ?? {}) as Record<string, any>;
  switch (e.kind) {
    case 'created':
      return `Eingegangen${d.has_image ? ' mit Bild' : ''}${d.crops ? `, ${d.crops} Ausschnitt(e)` : ''}`;
    case 'ai_brief':
      return `Briefing ${e.actor_id ? 'neu formuliert' : 'von der KI erstellt'}${d.priority ? `, Vorschlag ${String(d.priority).toUpperCase()}` : ''}`;
    case 'ai_failed':
      return `KI-Briefing fehlgeschlagen${e.body ? `: ${e.body}` : ''}`;
    case 'status':
      return `Status: ${STATUS_LABEL[d.from as FeedbackStatus] ?? d.from ?? '—'} → ${STATUS_LABEL[d.to as FeedbackStatus] ?? d.to}`;
    case 'priority':
      return `Priorität: ${d.from ? String(d.from).toUpperCase() : '—'} → ${d.to ? String(d.to).toUpperCase() : '—'}`;
    case 'assignee':
      return d.to ? 'Zuständig geändert' : 'Zuständig entfernt';
    case 'duplicate':
      return d.into_ticket ? `Als Duplikat in ${ticketLabel(d.into_ticket)} zusammengeführt` : `${ticketLabel(d.merged_ticket)} hierher zusammengeführt`;
    case 'criteria':
      return `Akzeptanzkriterien: ${(d.done ?? []).length} abgehakt`;
    case 'notified':
      return `Absender von ${ticketLabel(d.ticket)} per Glocke benachrichtigt`;
    default:
      return e.kind;
  }
}

function Timeline({ feedbackId, events, teamName }: { feedbackId: string; events: FeedbackEvent[]; teamName: Map<string, string> }) {
  const add = useAddComment();
  const [text, setText] = useState('');
  const submit = () => {
    const body = text.trim();
    if (!body) return;
    add.mutate(
      { feedbackId, body },
      { onSuccess: () => setText(''), onError: () => toast.error('Kommentar konnte nicht gespeichert werden.') },
    );
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Verlauf und Team-Kommentare</h2>
        <ol className="space-y-2">
          {events.map((e) => {
            const who = e.actor_id ? teamName.get(e.actor_id) ?? 'Admin' : 'System';
            return (
              <li key={e.id} className="flex gap-3 text-sm">
                <span className="w-24 shrink-0 text-xs tabular-nums text-muted-foreground">{format(new Date(e.created_at), 'dd.MM. HH:mm')}</span>
                {e.kind === 'comment' ? (
                  <div className="min-w-0 flex-1 rounded-md bg-muted/60 px-3 py-2">
                    <p className="text-xs font-medium">{who}</p>
                    <p className="whitespace-pre-wrap">{e.body}</p>
                  </div>
                ) : (
                  <p className="min-w-0 flex-1 text-muted-foreground">
                    {eventText(e)} <span className="text-xs">· {who}</span>
                  </p>
                )}
              </li>
            );
          })}
        </ol>
        <div className="space-y-2">
          <Textarea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Kommentar fürs Team (nur intern sichtbar)"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
            }}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={submit} disabled={!text.trim() || add.isPending}>
              Kommentieren
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
