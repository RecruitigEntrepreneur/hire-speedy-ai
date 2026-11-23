import { Fragment } from 'react';
import { CalendarClock, CheckCircle2, Clock, FileSignature, FileText, Gift, HelpCircle, MessageSquare, PauseCircle, Receipt, RefreshCw, UserCheck, UserX, Users, type LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  TASK_ACTION, TASK_CHIP, sinceLabel, waitingLabel,
  type ClientDoneItem, type ClientTask, type ClientTaskKind, type ClientWaitingItem, type TaskChip, type TaskContext,
} from '@/lib/clientTasksApi';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { intlLocale } from '@/i18n/languages';

const byLabel = (by: string) => i18n.t(`clientTasks:by.${['candidate', 'recruiter', 'matchunt'].includes(by) ? by : 'other'}`);

/**
 * Bausteine der Kunden-Aufgaben (23.10.2026): eine Zeile für Liste und Kachel, Karten für
 * den Kopf des Bewerberprofils (wie „AUFGABEN“ im Headhunter-Profil).
 */

export const TASK_ICON: Record<ClientTaskKind, LucideIcon> = {
  review: Users, alternative: CalendarClock, expired_request: CalendarClock, feedback: MessageSquare, decide_unsure: HelpCircle,
  make_offer: Gift, counter: Gift, offer_overdue: Clock, send_contract: FileText, contract_signed_check: FileText,
  docusign_sign: FileSignature, confirm_signature: FileSignature, recruiter_question: HelpCircle, confirm_start: UserCheck, invoice: Receipt, purchase_order: Receipt,
  start_check: UserCheck, end_confirm: UserX, research_position: RefreshCw, research_offer: RefreshCw, job_paused: PauseCircle,
};

/** Etikett „im Budget“ / „am oberen Rand“ / „überfällig“ */
export function Chip({ chip, className }: { chip: TaskChip; className?: string }) {
  return (
    <span className={cn('inline-block whitespace-nowrap rounded px-1.5 py-px align-middle text-[11px] font-medium',
      chip.tone === 'bad' ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-muted-foreground', className)}>
      {chip.text}
    </span>
  );
}

/** Aufgabe als Karte auf der Seite „Aufgaben“ (22.11.2026): Aufgabe, Stelle, unten Wartezeit und die eine Handlung. */
export function TaskCard({ task, onOpen }: { task: ClientTask; onOpen: (t: ClientTask) => void }) {
  useTranslation('clientTasks');
  const c = task.context;
  const istRechnung = task.kind === 'invoice' || task.kind === 'purchase_order';
  return (
    <button type="button" onClick={() => onOpen(task)} className="flex flex-col rounded-xl border bg-card p-4 text-left transition-colors hover:bg-secondary/70" data-tour-task-row={task.kind}>
      <p className="w-full truncate text-sm font-medium">
        {task.title}
        {c?.chip?.tone === 'bad' && <Chip chip={c.chip} className="ml-2" />}
      </p>
      <p className="w-full truncate text-xs text-muted-foreground">{[task.jobTitle ?? task.who, istRechnung && c?.line.length ? c.line[0] : null].filter(Boolean).join(' · ')}</p>
      <span className="mt-4 flex w-full items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{sinceLabel(task.since)}</span>
        <span className="whitespace-nowrap font-medium text-klick" data-tour-task={task.kind}>{TASK_ACTION[task.kind]} ›</span>
      </span>
    </button>
  );
}

export function TaskRow({ task, onOpen, compact = false, active = false }: { task: ClientTask; onOpen: (t: ClientTask) => void; compact?: boolean; active?: boolean }) {
  useTranslation('clientTasks');
  const Icon = TASK_ICON[task.kind] ?? CheckCircle2;
  const c = task.context;
  // Zeile auf der Seite: Fakten statt Kurztext, darunter warum es eilt (Kachel bleibt kompakt)
  const facts = !compact && c?.line.length ? c.line : null;
  // Etikett direkt hinter den Wert, zu dem es gehört (Wunsch, Fälligkeit), sonst ans Ende
  const chipAt = facts && c?.chip ? (() => { const i = facts.findIndex((p) => /^(Wunsch|fällig)/.test(p)); return i >= 0 ? i : facts.length - 1; })() : -1;
  return (
    <div className={cn('flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-secondary/60', active && 'ring-1 ring-klick')} data-tour-task-row={task.kind}>
      {/* Apple-Stil (21.11.2026): kein roter Grund und kein Farbpunkt mehr; die Abschnitte ordnen nach Dringlichkeit. */}
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(task)}>
        <p className="truncate text-sm font-medium">{task.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {task.who}{task.jobTitle && task.who !== task.jobTitle ? ` · ${task.jobTitle}` : ''}{compact || facts ? '' : ` · ${task.detail}`}
        </p>
        {facts && (
          <p className="truncate text-xs">
            {/* Handy (17.11.2026): Etikett vorn, sonst verschwindet es hinter „…“ */}
            {chipAt >= 0 && c?.chip && <Chip chip={c.chip} className="mr-1.5 sm:hidden" />}
            {facts.map((p, i) => (
              <Fragment key={i}>{i > 0 && ' · '}{p}{i === chipAt && c?.chip && <Chip chip={c.chip} className="mx-1 max-sm:hidden" />}</Fragment>
            ))}
          </p>
        )}
        {!compact && (c?.quote || c?.why) && (
          <p className="truncate text-xs text-muted-foreground">
            {c?.quote ? `${c.quote.by.split(' ')[0]}: „${c.quote.text}“` : ''}{c?.quote && c?.why ? ' · ' : ''}{c?.why ?? ''}
          </p>
        )}
        {!compact && task.note && <p className="truncate text-xs text-muted-foreground">{task.note}</p>}
      </button>
      {!compact && <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{waitingLabel(task)}</span>}
      {/* „seit 33 Tagen“ statt „33 Tagen“ (17.11.2026) */}
      {compact && <span className="shrink-0 text-xs text-muted-foreground">{sinceLabel(task.since)}</span>}
      {/* Auf dem Handy reicht die Zeile als Knopf, der Text bekommt den Platz */}
      <button type="button" className="hidden shrink-0 whitespace-nowrap text-xs font-medium text-klick hover:underline sm:inline-flex" onClick={() => onOpen(task)} data-tour-task={task.kind}>{TASK_ACTION[task.kind]} ›</button>
    </div>
  );
}

export function WaitingRow({ item, onOpen }: { item: ClientWaitingItem; onOpen?: (w: ClientWaitingItem) => void }) {
  const label = byLabel(item.by);
  const clickable = !!onOpen && isContractWaiting(item.key) && !!item.submissionId;
  return (
    <div className={cn('flex items-center gap-3 rounded-lg px-2.5 py-2', clickable && 'cursor-pointer hover:bg-accent/50')} onClick={clickable ? () => onOpen!(item) : undefined}
      role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined} onKeyDown={clickable ? (e) => { if (e.key === 'Enter') onOpen!(item); } : undefined}>
      <span className="w-20 shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{item.title}</p>
        <p className="truncate text-xs text-muted-foreground">{item.who}{item.jobTitle ? ` · ${item.jobTitle}` : ''} · {item.detail}</p>
      </div>
    </div>
  );
}

export function DoneRow({ item }: { item: ClientDoneItem }) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground">
      <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground/70" />
      <span className="min-w-0 flex-1 truncate">{item.label}{item.answer ? ` · ${item.answer}` : ''}</span>
      <span className="shrink-0 text-xs">{new Date(item.doneAt).toLocaleString(intlLocale(i18n.language), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
    </div>
  );
}

/**
 * Entscheidungshilfe oben im Aufgaben-Fenster (23.10.2026): Kurzprofil, Gegenüberstellung,
 * Verlauf, ein Satz des Headhunters – was der Kunde zum Entscheiden braucht.
 */
export function TaskContextBlock({ task }: { task: ClientTask }) {
  return <ContextView context={task.context} detail={task.detail} questions={task.ref.questions} note={task.note} />;
}

/** Dieselbe Entscheidungshilfe ohne Aufgabe drumherum (z. B. oben im Feedback-Fenster). */
export function ContextView({ context: c, detail, questions = [], note }: { context: TaskContext | null; detail?: string; questions?: string[]; note?: string | null }) {
  return (
    <div className="space-y-2.5 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
      {!c && !questions.length && detail && <p>{detail}</p>}
      {c && c.facts.length > 0 && (
        <dl className="grid grid-cols-[minmax(6rem,8.5rem)_1fr] gap-x-3 gap-y-1 text-[13px]">
          {c.facts.map((f) => (
            <Fragment key={f.label}>
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd className="min-w-0">{f.value}{f.chip && <Chip chip={f.chip} className="ml-1.5" />}</dd>
            </Fragment>
          ))}
        </dl>
      )}
      {c?.compare && (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr>
                <th className="w-24" />
                {c.compare.heads.map((h) => <th key={h} className="pb-1 pr-2 text-left text-xs font-normal text-muted-foreground">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {c.compare.rows.map((r) => (
                <tr key={r.label} className={cn(r.changed && 'bg-secondary')}>
                  <td className="py-0.5 pl-1 pr-2 text-muted-foreground">{r.label}</td>
                  {r.cells.map((cell, i) => <td key={i} className={cn('py-0.5 pr-2', r.changed && i < 2 && 'font-medium')}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {c?.timeline && (
        <ol className="space-y-1.5 text-[13px]">
          {c.timeline.map((s) => (
            <li key={s.text} className="flex items-start gap-2">
              <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', s.state === 'done' ? 'bg-emerald-500' : s.state === 'now' ? 'bg-amber-500' : 'bg-muted-foreground/30')} />
              <span className={cn(s.state === 'now' && 'font-medium', s.state === 'next' && 'text-muted-foreground')}>{s.text}</span>
            </li>
          ))}
        </ol>
      )}
      {c?.quote && (
        <p className="rounded-md border bg-card px-2.5 py-1.5 text-[13px]"><span className="text-muted-foreground">{c.quote.by}:</span> „{c.quote.text}“</p>
      )}
      {questions.length > 0 && <ol className="list-decimal space-y-0.5 rounded-md border bg-card py-1.5 pl-7 pr-2.5 text-[13px]">{questions.map((q) => <li key={q}>{q}</li>)}</ol>}
      {c?.why && <p className="text-xs text-muted-foreground">{c.why}</p>}
      {c?.foot && <p className="text-xs text-muted-foreground">{c.foot}</p>}
      {note && <p className="text-xs text-amber-600 dark:text-amber-400">{note}</p>}
    </div>
  );
}

/** Läuft-bei-anderen-Einträge rund um den Arbeitsvertrag (öffnen das Vertrags-Fenster) */
export const isContractWaiting = (key: string) => /^(sign-company|docusign-cand|contract-self|contract-undo):/.test(key);

/** Karte im Profilkopf: reines Weiß bzw. Schwarz auf der grauen Fläche, mit feiner Kante, damit sie sich
 *  in beiden Modi abhebt (22.11.2026: Weiß auf Hellgrau war kaum zu sehen). */
const PROFIL_KARTE = 'rounded-lg bg-background px-3 py-2 shadow-[0_0_0_1px_hsl(var(--foreground)/0.07),0_1px_3px_hsl(var(--foreground)/0.06)]';

/** Kopf des Bewerberprofils: „Ihre Aufgaben“ und „Läuft bei anderen“ als Karten. */
export function ProfileTaskCards({ tasks, waiting, onOpen, onOpenWaiting }: { tasks: ClientTask[]; waiting: ClientWaitingItem[]; onOpen: (t: ClientTask) => void; onOpenWaiting?: (w: ClientWaitingItem) => void }) {
  const { t: tr } = useTranslation('clientTasks');
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <p className="mb-1.5 text-[13px] font-semibold tracking-tight">{tr('cards.yourTasks', { count: tasks.length })}</p>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tr('cards.nothing')}</p>
        ) : (
          <div className="space-y-1.5">
            {tasks.map((t) => (
              <button key={t.key} type="button" onClick={() => onOpen(t)}
                className={cn(PROFIL_KARTE, 'block w-full text-left transition-shadow hover:shadow-[0_0_0_1px_hsl(var(--klick)/0.5),0_1px_3px_hsl(var(--foreground)/0.06)]')}>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="rounded bg-secondary px-1.5 py-0.5 font-medium text-muted-foreground">{TASK_CHIP[t.kind]}</span>
                  <span className="text-muted-foreground">{waitingLabel(t)}</span>
                </div>
                <div className="mt-1 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{t.detail}</p>
                    {t.note && <p className="text-xs text-muted-foreground">{t.note}</p>}
                  </div>
                  {/* Die Aufgabe ist die Karte mit der Handlung: blau, damit sie sich von „Läuft bei anderen“ abhebt */}
                  <span className="shrink-0 whitespace-nowrap text-xs font-medium text-klick">{TASK_ACTION[t.kind]} ›</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        <p className="mb-1.5 text-[13px] font-semibold tracking-tight">{tr('cards.withOthers', { count: waiting.length })}</p>
        {waiting.length === 0 ? (
          <p className="text-sm text-muted-foreground">–</p>
        ) : (
          <div className="space-y-1.5">
            {waiting.map((w) => {
              // Vertrag: klickbar, öffnet das Aufgaben-Fenster im Modus „läuft“
              const clickable = !!onOpenWaiting && isContractWaiting(w.key);
              const body = (
                <>
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">{byLabel(w.by)}</span>
                  <p className="mt-1 text-sm font-medium">{w.title}</p>
                  <p className="text-xs text-muted-foreground">{w.detail}</p>
                </>
              );
              return clickable
                ? <button key={w.key} type="button" onClick={() => onOpenWaiting!(w)} className={cn(PROFIL_KARTE, 'block w-full text-left')}>{body}</button>
                : <div key={w.key} className={PROFIL_KARTE}>{body}</div>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Platzhalter in Kartengröße, solange die Aufgaben laden: der Kopf hat gleich seine Höhe (29.10.2026). */
export function ProfileTaskCardsLoading() {
  const { t: tr } = useTranslation('clientTasks');
  return (
    <div className="grid gap-3 sm:grid-cols-2" aria-busy="true">
      <div>
        <p className="mb-1.5 text-[13px] font-semibold tracking-tight">{tr('cards.yourTasksTitle')}</p>
        <Skeleton className="h-[78px] w-full rounded-lg" />
      </div>
      <div>
        <p className="mb-1.5 text-[13px] font-semibold tracking-tight">{tr('cards.withOthersTitle')}</p>
        <Skeleton className="h-4 w-8" />
      </div>
    </div>
  );
}
