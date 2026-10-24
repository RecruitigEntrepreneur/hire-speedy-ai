import { Fragment } from 'react';
import { CalendarClock, CheckCircle2, Clock, FileSignature, FileText, Gift, HelpCircle, MessageSquare, Receipt, UserCheck, Users, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  TASK_ACTION, TASK_CHIP, sinceLabel, waitingLabel,
  type ClientDoneItem, type ClientTask, type ClientTaskKind, type ClientWaitingItem, type TaskChip, type TaskContext,
} from '@/lib/clientTasksApi';

/**
 * Bausteine der Kunden-Aufgaben (23.10.2026): eine Zeile für Liste und Kachel, Karten für
 * den Kopf des Bewerberprofils (wie „AUFGABEN“ im Headhunter-Profil).
 */

const ICON: Record<ClientTaskKind, LucideIcon> = {
  review: Users, alternative: CalendarClock, expired_request: CalendarClock, feedback: MessageSquare, decide_unsure: HelpCircle,
  make_offer: Gift, counter: Gift, offer_overdue: Clock, send_contract: FileText, contract_signed_check: FileText,
  docusign_sign: FileSignature, confirm_signature: FileSignature, recruiter_question: HelpCircle, confirm_start: UserCheck, invoice: Receipt,
};

/** Etikett „im Budget“ / „am oberen Rand“ / „überfällig“ */
export function Chip({ chip, className }: { chip: TaskChip; className?: string }) {
  return (
    <span className={cn('inline-block whitespace-nowrap rounded px-1.5 py-px align-middle text-[11px] font-medium',
      chip.tone === 'good' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
        : chip.tone === 'warn' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'bg-destructive/10 text-destructive', className)}>
      {chip.text}
    </span>
  );
}

export function TaskRow({ task, onOpen, compact = false, active = false }: { task: ClientTask; onOpen: (t: ClientTask) => void; compact?: boolean; active?: boolean }) {
  const Icon = ICON[task.kind] ?? CheckCircle2;
  const c = task.context;
  // Zeile auf der Seite: Fakten statt Kurztext, darunter warum es eilt (Kachel bleibt kompakt)
  const facts = !compact && c?.line.length ? c.line : null;
  // Etikett direkt hinter den Wert, zu dem es gehört (Wunsch, Fälligkeit), sonst ans Ende
  const chipAt = facts && c?.chip ? (() => { const i = facts.findIndex((p) => /^(Wunsch|fällig)/.test(p)); return i >= 0 ? i : facts.length - 1; })() : -1;
  return (
    <div className={cn('flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors', task.urgent ? 'bg-destructive/[0.04] hover:bg-destructive/[0.08]' : 'hover:bg-accent/50', active && 'ring-1 ring-primary')}>
      <span className={cn('h-2 w-2 shrink-0 rounded-full', task.urgent ? 'bg-destructive' : 'bg-amber-500')} />
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(task)}>
        <p className="truncate text-sm font-medium">{task.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {task.who}{task.jobTitle && task.who !== task.jobTitle ? ` · ${task.jobTitle}` : ''}{compact || facts ? '' : ` · ${task.detail}`}
        </p>
        {facts && (
          <p className="truncate text-xs">
            {facts.map((p, i) => (
              <Fragment key={i}>{i > 0 && ' · '}{p}{i === chipAt && c?.chip && <Chip chip={c.chip} className="mx-1" />}</Fragment>
            ))}
          </p>
        )}
        {!compact && (c?.quote || c?.why) && (
          <p className="truncate text-xs text-muted-foreground">
            {c?.quote ? `${c.quote.by.split(' ')[0]}: „${c.quote.text}“` : ''}{c?.quote && c?.why ? ' · ' : ''}{c?.why ?? ''}
          </p>
        )}
        {!compact && task.note && <p className="truncate text-xs text-amber-600 dark:text-amber-400">{task.note}</p>}
      </button>
      {!compact && <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{waitingLabel(task)}</span>}
      {compact && <span className="shrink-0 text-xs text-muted-foreground">{sinceLabel(task.since).replace('seit ', '')}</span>}
      {/* Auf dem Handy reicht die Zeile als Knopf, der Text bekommt den Platz */}
      <Button size="sm" variant={task.urgent ? 'default' : 'outline'} className="hidden h-7 shrink-0 text-xs sm:inline-flex" onClick={() => onOpen(task)}>{TASK_ACTION[task.kind]}</Button>
    </div>
  );
}

export function WaitingRow({ item, onOpen }: { item: ClientWaitingItem; onOpen?: (w: ClientWaitingItem) => void }) {
  const label = item.by === 'candidate' ? 'Kandidat' : item.by === 'recruiter' ? 'Headhunter' : item.by === 'matchunt' ? 'Matchunt' : 'Termin';
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
      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
      <span className="min-w-0 flex-1 truncate">{item.label}{item.answer ? ` · ${item.answer}` : ''}</span>
      <span className="shrink-0 text-xs">{new Date(item.doneAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
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
                <tr key={r.label} className={cn(r.changed && 'bg-amber-500/10')}>
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

/** Kopf des Bewerberprofils: „IHRE AUFGABEN“ und „LÄUFT BEI ANDEREN“ als Karten. */
export function ProfileTaskCards({ tasks, waiting, onOpen, onOpenWaiting }: { tasks: ClientTask[]; waiting: ClientWaitingItem[]; onOpen: (t: ClientTask) => void; onOpenWaiting?: (w: ClientWaitingItem) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Ihre Aufgaben ({tasks.length})</p>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Gerade nichts für Sie zu tun.</p>
        ) : (
          <div className="space-y-1.5">
            {tasks.map((t) => (
              <button key={t.key} type="button" onClick={() => onOpen(t)}
                className={cn('block w-full rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:bg-accent/40', t.urgent ? 'border-l-[3px] border-l-destructive' : 'border-l-[3px] border-l-amber-500')}>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className={cn('rounded px-1.5 py-0.5 font-medium', t.urgent ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400')}>{TASK_CHIP[t.kind]}</span>
                  <span className="text-muted-foreground">{waitingLabel(t)}</span>
                </div>
                <p className="mt-1 text-sm font-medium">{t.title}</p>
                <p className="text-xs text-muted-foreground">{t.detail}</p>
                {t.note && <p className="text-xs text-amber-600 dark:text-amber-400">{t.note}</p>}
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Läuft bei anderen ({waiting.length})</p>
        {waiting.length === 0 ? (
          <p className="text-sm text-muted-foreground">–</p>
        ) : (
          <div className="space-y-1.5">
            {waiting.map((w) => {
              // Vertrag: klickbar, öffnet das Aufgaben-Fenster im Modus „läuft“
              const clickable = !!onOpenWaiting && isContractWaiting(w.key);
              const body = (
                <>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{w.by === 'candidate' ? 'Kandidat' : w.by === 'recruiter' ? 'Headhunter' : w.by === 'matchunt' ? 'Matchunt' : 'Termin'}</span>
                  <p className="mt-1 text-sm font-medium">{w.title}</p>
                  <p className="text-xs text-muted-foreground">{w.detail}</p>
                </>
              );
              return clickable
                ? <button key={w.key} type="button" onClick={() => onOpenWaiting!(w)} className="block w-full rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:bg-accent/40">{body}</button>
                : <div key={w.key} className="rounded-lg border bg-card px-3 py-2">{body}</div>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
