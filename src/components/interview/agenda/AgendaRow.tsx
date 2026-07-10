import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AgendaInterview } from '@/hooks/useClientInterviewAgenda';
import { CandidateAvatar, CandidateName } from './CandidateIdentity';
import { meetingTypeLabel, MeetingTypeIcon } from './meetingType';
import { buildIcs, downloadIcs } from '@/lib/ics';
import { cn } from '@/lib/utils';
import {
  ArrowLeftRight, Bell, CalendarPlus, Hourglass, MoreHorizontal, Star, UserX, Video, XCircle,
} from 'lucide-react';

export type AgendaRowVariant = 'agenda' | 'counter' | 'awaiting' | 'feedback' | 'past';

interface Props {
  iv: AgendaInterview;
  variant: AgendaRowVariant;
  onDetails: (iv: AgendaInterview) => void;
  onEdit?: (iv: AgendaInterview) => void;
  onCancel?: (iv: AgendaInterview) => void;
  onNoShow?: (iv: AgendaInterview) => void;
  onRespondCounter?: (iv: AgendaInterview) => void;
  onRemind?: (iv: AgendaInterview) => void;
  onFeedback?: (iv: AgendaInterview) => void;
  onOpenGuide?: (iv: AgendaInterview) => void;
}

const timeShort = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const dateShort = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });

const waitLabel = (h: number) => (h >= 48 ? `wartet seit ${Math.floor(h / 24)} Tagen` : h >= 1 ? `wartet seit ${h} Std` : 'gerade angefragt');

const PAST_LABEL: Record<string, { label: string; cls: string }> = {
  completed: { label: 'Absolviert', cls: 'text-emerald-600 border-emerald-500/40' },
  cancelled: { label: 'Abgesagt', cls: 'text-muted-foreground' },
  declined: { label: 'Abgelehnt', cls: 'text-muted-foreground' },
  no_show: { label: 'No-Show', cls: 'text-destructive border-destructive/40' },
  scheduled: { label: 'Absolviert', cls: 'text-emerald-600 border-emerald-500/40' },
};

/** Eine Interview-Zeile – die Variante bestimmt Zeitblock, Status und Aktionen. */
export function AgendaRow({
  iv, variant, onDetails, onEdit, onCancel, onNoShow, onRespondCounter, onRemind, onFeedback, onOpenGuide,
}: Props) {
  const addToCalendar = () =>
    iv.scheduledAt &&
    downloadIcs(
      `interview-${iv.candidateName.replace(/[^\w]+/g, '-')}`,
      buildIcs({
        title: `Interview · ${iv.candidateName} · ${iv.jobTitle}`,
        location: iv.onsiteAddress || iv.joinUrl || undefined,
        url: iv.joinUrl || undefined,
        start: new Date(iv.scheduledAt),
        durationMinutes: iv.durationMinutes,
      }),
    );

  const leftBlock =
    variant === 'awaiting' ? (
      <div className="flex min-w-[60px] items-center justify-center rounded-lg bg-muted px-2 py-2.5">
        <Hourglass className="h-4 w-4 text-muted-foreground" />
      </div>
    ) : variant === 'counter' ? (
      <div className="flex min-w-[60px] items-center justify-center rounded-lg bg-destructive/10 px-2 py-2.5">
        <ArrowLeftRight className="h-4 w-4 text-destructive" />
      </div>
    ) : iv.scheduledAt ? (
      <div className={cn('min-w-[60px] rounded-lg px-2 py-1.5 text-center', variant === 'agenda' ? 'bg-muted' : 'bg-muted/50')}>
        <p className="text-[10px] font-medium leading-tight text-muted-foreground">{dateShort(iv.scheduledAt)}</p>
        <p className="text-sm font-bold leading-tight">{timeShort(iv.scheduledAt)}</p>
      </div>
    ) : (
      <div className="min-w-[60px]" />
    );

  return (
    <div className="group flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-accent/40">
      {leftBlock}
      <CandidateAvatar iv={iv} />

      <button onClick={() => onDetails(iv)} className="min-w-0 flex-1 text-left">
        <CandidateName iv={iv} />
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          <MeetingTypeIcon type={iv.meetingType} className="h-3 w-3 shrink-0" />
          {meetingTypeLabel(iv.meetingType)}
          {iv.onsiteAddress ? `, ${iv.onsiteAddress}` : ''} · {iv.jobTitle}
          {variant === 'awaiting' && iv.proposedSlots.length > 0 && ` · ${iv.proposedSlots.length} Slots vorgeschlagen`}
        </p>
      </button>

      {/* Status/Zusatz je Variante */}
      {variant === 'agenda' && !iv.confirmed && (
        <Badge variant="outline" className="shrink-0 text-xs text-amber-600">unbestätigt</Badge>
      )}
      {variant === 'counter' && (
        <span className="shrink-0 text-xs font-medium text-destructive">{waitLabel(iv.waitingHours)}</span>
      )}
      {variant === 'awaiting' && (
        <span
          className={cn(
            'shrink-0 text-xs',
            iv.slotsExpired ? 'font-medium text-destructive' : iv.waitingHours >= 48 ? 'font-medium text-amber-600' : 'text-muted-foreground',
          )}
        >
          {iv.slotsExpired ? 'Slots abgelaufen' : waitLabel(iv.waitingHours)}
        </span>
      )}
      {variant === 'past' && (
        <Badge variant="outline" className={cn('shrink-0 text-xs', (PAST_LABEL[iv.status] || PAST_LABEL.cancelled).cls)}>
          {(PAST_LABEL[iv.status] || { label: iv.status }).label}
        </Badge>
      )}

      {/* Primäraktion je Variante */}
      {variant === 'agenda' && iv.joinUrl && (
        <Button asChild size="sm" variant="outline" className="h-7 shrink-0 gap-1 text-xs">
          <a href={iv.joinUrl} target="_blank" rel="noreferrer">
            <Video className="h-3.5 w-3.5" /> Beitreten
          </a>
        </Button>
      )}
      {variant === 'counter' && onRespondCounter && (
        <Button size="sm" variant="destructive" className="h-7 shrink-0 text-xs" onClick={() => onRespondCounter(iv)}>
          Antworten
        </Button>
      )}
      {variant === 'awaiting' && onRemind && (
        <Button size="sm" variant="outline" className="h-7 shrink-0 gap-1 text-xs" onClick={() => onRemind(iv)}>
          <Bell className="h-3.5 w-3.5" /> Erinnern
        </Button>
      )}
      {variant === 'feedback' && onFeedback && (
        <Button size="sm" variant="outline" className="h-7 shrink-0 gap-1 border-amber-500/40 text-xs text-amber-600" onClick={() => onFeedback(iv)}>
          <Star className="h-3.5 w-3.5" /> Feedback geben
        </Button>
      )}

      {/* Sekundäraktionen */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground" aria-label="Weitere Aktionen">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => onDetails(iv)}>Kandidaten-Details</DropdownMenuItem>
          {iv.identityUnlocked && onOpenGuide && (
            <DropdownMenuItem onClick={() => onOpenGuide(iv)}>Interview-Guide</DropdownMenuItem>
          )}
          {iv.scheduledAt && (variant === 'agenda' || variant === 'counter') && (
            <DropdownMenuItem onClick={addToCalendar}>
              <CalendarPlus className="mr-2 h-4 w-4" /> Zum Kalender (.ics)
            </DropdownMenuItem>
          )}
          {onEdit && (variant === 'agenda' || variant === 'awaiting') && (
            <DropdownMenuItem onClick={() => onEdit(iv)}>
              {variant === 'awaiting' ? 'Neue Slots vorschlagen' : 'Umbuchen'}
            </DropdownMenuItem>
          )}
          {variant === 'feedback' && onNoShow && (
            <DropdownMenuItem onClick={() => onNoShow(iv)}>
              <UserX className="mr-2 h-4 w-4" /> No-Show melden
            </DropdownMenuItem>
          )}
          {onCancel && variant !== 'past' && variant !== 'feedback' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onCancel(iv)}>
                <XCircle className="mr-2 h-4 w-4" /> {variant === 'awaiting' ? 'Anfrage zurückziehen' : 'Absagen'}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
