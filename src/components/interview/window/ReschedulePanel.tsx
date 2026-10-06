import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { MAX_PROPOSALS, interviewApi, weekStartOf, type AttendeeDraft, type InterviewDetails } from '@/lib/interviewScheduling';
import { initialWeekStart } from '@/lib/interviewRequestUtils';
import { ProposalGrid } from '../request/ProposalGrid';

const MAX_WEEKS_AHEAD = 8;
const DEFAULT_MESSAGE = 'Leider müssen wir den Termin verschieben. Passt Ihnen eine dieser Zeiten?';

interface Props {
  submissionId: string;
  details: InterviewDetails;
  candidateName: string;
  onDone: () => void;
  onCancel: () => void;
}

/**
 * „Termin verschieben“ im Interview-Fenster: neue Zeiten mit gleicher Dauer,
 * gleichem Format und gleichen Teilnehmern. Der bisherige Termin bleibt, bis
 * der Kandidat eine neue Zeit bestätigt.
 */
export function ReschedulePanel({ submissionId, details, candidateName, onDone, onCancel }: Props) {
  const navigate = useNavigate();
  const [nowIso] = useState(() => new Date().toISOString());
  const minWeek = weekStartOf(nowIso);
  const maxWeek = weekStartOf(nowIso, MAX_WEEKS_AHEAD);
  const [weekStart, setWeekStart] = useState(() => initialWeekStart(nowIso));
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [allowAlternative, setAllowAlternative] = useState(true);

  // Kalender-Status und Interview-Zeiten wie im Anfrage-Fenster
  const ctx = useQuery({
    queryKey: ['interview-request-context', submissionId],
    queryFn: () => interviewApi.context(submissionId),
    staleTime: 60_000,
  });

  const attendees: AttendeeDraft[] = details.attendees.map((a) => ({
    userId: a.userId, email: a.email, name: a.name, title: a.title, required: a.required,
    kind: a.external ? 'external' : 'client_user', decisionMaker: a.decisionMaker,
  }));
  const availability = useQuery({
    queryKey: ['interview-availability', submissionId, details.durationMinutes, weekStart, `move:${details.id}`],
    queryFn: () => interviewApi.availability({ submissionId, durationMinutes: details.durationMinutes, weekStart, attendees }),
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[3] === weekStart ? prev : undefined),
    staleTime: 60_000,
    retry: 1,
  });

  const toggle = (iso: string) =>
    setSelected((cur) => {
      const t = Date.parse(iso);
      if (cur.some((s) => Date.parse(s) === t)) return cur.filter((s) => Date.parse(s) !== t);
      return cur.length >= MAX_PROPOSALS ? cur : [...cur, iso];
    });

  const first = candidateName.split(' ')[0];
  const send = useMutation({
    mutationFn: () => interviewApi.reschedule({ interviewId: details.id, slots: [...selected].sort(), message: message.trim(), allowAlternative }),
    onSuccess: (r) => {
      if (r.warning) toast.warning(r.warning);
      else toast.success(`Neue Zeiten sind an ${candidateName} gegangen. Der bisherige Termin bleibt, bis ${first} wählt.`);
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Die Verschiebung hat nicht geklappt.'),
  });

  const goSettings = () => navigate('/dashboard/settings#kalender');

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Neue Zeiten für {candidateName} vorschlagen</h3>
        <p className="text-xs text-muted-foreground">
          Dauer, Format und Teilnehmer bleiben. Der bisherige Termin gilt weiter, bis {first} eine neue Zeit bestätigt.
        </p>
      </div>

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
        onToggle={toggle}
        onAdd={(iso) => setSelected((cur) => (cur.length >= MAX_PROPOSALS ? cur : [...cur, iso]))}
        peopleCount={attendees.length}
        durationMinutes={details.durationMinutes}
        minNoticeHours={ctx.data?.hours?.minNoticeHours ?? 0}
        onCheckTime={(iso) => interviewApi.checkTime({ submissionId, durationMinutes: details.durationMinutes, start: iso, attendees })}
        calendar={ctx.data?.calendar ?? { state: 'not_connected', provider: null, accountEmail: null, itRequest: null }}
        onConnectCalendar={goSettings}
        onOpenHoursSettings={goSettings}
      />

      <label className="flex items-center gap-2 text-sm">
        <Switch checked={allowAlternative} onCheckedChange={setAllowAlternative} />
        {first} darf eine andere Zeit wählen
      </label>

      <div className="space-y-1.5">
        <p className="text-xs font-medium">Nachricht an {first}</p>
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={2000} />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {selected.length === 0 && <span className="text-xs text-muted-foreground">Wählen Sie mindestens eine neue Zeit.</span>}
        <Button type="button" variant="ghost" onClick={onCancel} disabled={send.isPending}>Abbrechen</Button>
        <Button type="button" className="gap-1.5" disabled={selected.length === 0 || send.isPending} onClick={() => send.mutate()}>
          {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Neue Zeiten senden
        </Button>
      </div>
    </div>
  );
}
