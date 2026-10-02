import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Info, Loader2, Lock, Send, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  INTERVIEW_DURATIONS,
  MAX_PROPOSALS,
  interviewApi,
  normalizeRules,
  weekStartOf,
  type AttendeeDraft,
  type MailPreview,
  type RequestContext,
  type SendInput,
  type SendResult,
} from '@/lib/interviewScheduling';
import {
  attendeeIdentity,
  fmtDateDayMonth,
  initialWeekStart,
  joinNames,
  roundTitle,
  sameAttendee,
} from '@/lib/interviewRequestUtils';
import { ParticipantsSection } from './ParticipantsSection';
import { ProposalGrid } from './ProposalGrid';
import { AlternativeSection } from './AlternativeSection';
import { MailPreviewDialog } from './MailPreviewDialog';

interface Props {
  ctx: RequestContext;
  replacesInterviewId?: string | null;
  onClose: () => void;
  onSent?: (r: SendResult) => void;
}

const MAX_WEEKS_AHEAD = 8;
const SETTINGS_CALENDAR = '/dashboard/settings#kalender';

function initialAttendees(ctx: RequestContext): AttendeeDraft[] {
  const me: AttendeeDraft = {
    userId: ctx.me.userId,
    email: ctx.me.email,
    name: ctx.me.name,
    title: ctx.me.title,
    required: true,
    kind: 'client_user',
  };
  const list: AttendeeDraft[] = [me];
  if (ctx.round >= 2) {
    for (const a of ctx.previousAttendees ?? []) {
      if (!a?.email || list.some((x) => sameAttendee(x, a))) continue;
      list.push({ ...a, title: a.title ?? null, userId: a.userId ?? null });
    }
  }
  return list;
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={className}>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Chip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
        active ? 'border-foreground bg-foreground text-background' : 'bg-background hover:border-primary/40 hover:bg-accent',
      )}
    >
      {children}
    </button>
  );
}

/** Inhalt des Fensters „Interview anfragen“, sobald der Kontext geladen ist. */
export function RequestForm({ ctx, replacesInterviewId, onClose, onSent }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [nowIso] = useState(() => new Date().toISOString());
  const minWeek = weekStartOf(nowIso);
  const maxWeek = weekStartOf(nowIso, MAX_WEEKS_AHEAD);

  const [duration, setDuration] = useState(60);
  const [attendees, setAttendees] = useState<AttendeeDraft[]>(() => initialAttendees(ctx));
  const [weekStart, setWeekStart] = useState(() => initialWeekStart(nowIso));
  const [selected, setSelected] = useState<string[]>([]);
  const [allowAlternative, setAllowAlternative] = useState(true);
  const [defaultRules] = useState(() => normalizeRules(ctx.hours));
  const [rules, setRules] = useState(defaultRules);
  const [message, setMessage] = useState(ctx.defaultMessage ?? '');
  const [preview, setPreview] = useState<MailPreview | null>(null);

  const isMe = (a: AttendeeDraft) => sameAttendee(a, { userId: ctx.me.userId, email: ctx.me.email });
  const calendarConnected = ctx.calendar.state === 'connected';
  const replaces = replacesInterviewId ?? ctx.openRequest?.interviewId ?? null;
  const recruiter = ctx.recruiterName?.trim() || null;

  const attendeeSig = attendees.map((a) => `${attendeeIdentity(a)}:${a.required ? 1 : 0}`).join('|');
  const availability = useQuery({
    queryKey: ['interview-availability', ctx.submissionId, duration, weekStart, attendeeSig],
    queryFn: () => interviewApi.availability({ submissionId: ctx.submissionId, durationMinutes: duration, weekStart, attendees }),
    // Beim Umschalten von Teilnehmern/Dauer das alte Raster derselben Woche stehen lassen statt zu flackern
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[3] === weekStart ? prev : undefined),
    staleTime: 60_000,
    retry: 1,
  });

  const toggleSlot = (iso: string) =>
    setSelected((cur) => {
      const t = Date.parse(iso);
      if (cur.some((s) => Date.parse(s) === t)) return cur.filter((s) => Date.parse(s) !== t);
      if (cur.length >= MAX_PROPOSALS) return cur;
      return [...cur, iso];
    });

  const buildInput = (): SendInput => ({
    submissionId: ctx.submissionId,
    durationMinutes: duration,
    slots: [...selected].sort((a, b) => Date.parse(a) - Date.parse(b)),
    attendees: attendees.map((a) => (isMe(a) ? { ...a, required: true } : a)),
    allowAlternative,
    alternativeRules: rules,
    message: message.trim(),
    round: ctx.round,
    replacesInterviewId: replaces,
  });

  const send = useMutation({
    mutationFn: (input: SendInput) => interviewApi.send(input),
    onSuccess: (result) => {
      toast.success(
        recruiter
          ? `Anfrage gesendet. Kandidat und ${recruiter} sind informiert.`
          : 'Anfrage gesendet. Kandidat und Headhunter sind informiert.',
      );
      if (result.warning) toast.warning(result.warning);
      queryClient.invalidateQueries({ queryKey: ['client-interview-agenda'] });
      queryClient.invalidateQueries({ queryKey: ['interview-availability'] });
      onClose();
      onSent?.(result);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const previewMail = useMutation({
    mutationFn: (input: SendInput) => interviewApi.preview(input),
    onSuccess: (p) => setPreview(p),
    onError: (err: Error) => toast.error(err.message),
  });

  const goSettings = () => {
    onClose();
    navigate(SETTINGS_CALENDAR);
  };

  const candidateShown = ctx.identityUnlocked ? ctx.candidateName || ctx.candidateLabel : ctx.candidateLabel;
  const inviteNames = joinNames(attendees.map((a) => (isMe(a) ? 'Sie' : a.name)));

  return (
    <>
      <DialogHeader className="space-y-1 border-b px-4 py-4 pr-12 text-left sm:px-6">
        <DialogTitle>{roundTitle(ctx.round)}</DialogTitle>
        <DialogDescription className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          {!ctx.identityUnlocked && <Lock className="h-3.5 w-3.5 shrink-0" aria-label="anonym" />}
          <span className={cn('text-foreground', !ctx.identityUnlocked && 'font-mono')}>{candidateShown}</span>
          <span>· für „{ctx.jobTitle}“</span>
          {recruiter && <span>· Headhunter: {recruiter}</span>}
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4 sm:px-6">
        {ctx.openRequest ? (
          <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p>
              Es gibt bereits eine offene Anfrage vom {fmtDateDayMonth(ctx.openRequest.createdAt)}. Mit dem Senden ersetzen Sie sie.
            </p>
          </div>
        ) : replacesInterviewId ? (
          <div className="flex gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p>Diese Anfrage ersetzt den bisherigen Termin. Der Kandidat bestätigt einen der neuen Termine.</p>
          </div>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <Section title="Format">
            <div className="flex flex-wrap gap-2">
              <Chip active>
                <Video className="h-3.5 w-3.5" /> Microsoft Teams
              </Chip>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Teams-Link entsteht automatisch · Teilnahme mit App oder im Browser, kein Konto nötig
            </p>
          </Section>
          <Section title="Dauer">
            <div className="flex flex-wrap gap-2">
              {INTERVIEW_DURATIONS.map((d) => (
                <Chip key={d} active={duration === d} onClick={() => setDuration(d)}>
                  {d} Min
                </Chip>
              ))}
            </div>
          </Section>
        </div>

        <Section title="Wer ist dabei">
          <ParticipantsSection
            me={ctx.me}
            team={ctx.team ?? []}
            attendees={attendees}
            onChange={(next) => setAttendees(next.some(isMe) ? next : attendees)}
            people={availability.data?.people}
            calendarConnected={calendarConnected}
          />
        </Section>

        <Section title="1 · Ihre Terminvorschläge">
          <ProposalGrid
            weekStart={weekStart}
            canGoBack={weekStart > minWeek}
            canGoForward={weekStart < maxWeek}
            onWeekChange={(delta) => setWeekStart((w) => weekStartOf(`${w}T12:00:00.000Z`, delta))}
            data={availability.data}
            isLoading={availability.isLoading}
            isFetching={availability.isFetching}
            error={availability.error}
            onRetry={() => availability.refetch()}
            selected={selected}
            onToggle={toggleSlot}
            onAdd={(iso) => setSelected((cur) => (cur.length >= MAX_PROPOSALS ? cur : [...cur, iso]))}
            peopleCount={attendees.length}
            calendar={ctx.calendar}
            onConnectCalendar={goSettings}
            onOpenHoursSettings={goSettings}
          />
        </Section>

        <Section title="2 · Falls keiner passt">
          <AlternativeSection
            allow={allowAlternative}
            onAllowChange={setAllowAlternative}
            rules={rules}
            onRulesChange={setRules}
            defaultRules={defaultRules}
          />
        </Section>

        <Section title="Nachricht an den Kandidaten">
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={7} maxLength={2000} className="text-sm" />
        </Section>

        <Section title="So geht es weiter">
          <ol className="space-y-1.5 text-sm">
            {[
              recruiter ? `Kandidat und Headhunter ${recruiter} werden benachrichtigt` : 'Kandidat und Headhunter werden benachrichtigt',
              'Der Kandidat bestätigt einen Ihrer Termine, wählt eine andere Zeit oder lehnt ab',
              `Steht der Termin: ${inviteNames} bekommen die Einladung mit Teams-Link, der Kandidat seine eigene`,
            ].map((text, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
                  {i + 1}
                </span>
                <span className="text-muted-foreground">{text}</span>
              </li>
            ))}
          </ol>
        </Section>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <button
          type="button"
          onClick={() => previewMail.mutate(buildInput())}
          disabled={previewMail.isPending}
          className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-primary underline underline-offset-2 hover:opacity-80 disabled:opacity-60 sm:self-auto"
        >
          {previewMail.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Mail ansehen, so wie der Kandidat sie bekommt
        </button>
        <div className="flex flex-col items-stretch gap-1 sm:flex-row sm:items-center sm:gap-3">
          {selected.length === 0 && (
            <span className="text-xs text-muted-foreground sm:text-right">Wählen Sie mindestens einen Termin.</span>
          )}
          <Button
            type="button"
            onClick={() => send.mutate(buildInput())}
            disabled={selected.length === 0 || send.isPending}
            className="gap-1.5"
          >
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Anfrage senden
          </Button>
        </div>
      </div>

      <MailPreviewDialog preview={preview} open={!!preview} onOpenChange={(o) => !o && setPreview(null)} />
    </>
  );
}
