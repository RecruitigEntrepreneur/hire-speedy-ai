import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Eye,
  Info,
  Lock,
  Pause,
  Pencil,
  Play,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { InviteMemberDialog } from '@/components/organization/InviteMemberDialog';
import { useTeamData } from '@/hooks/useTeamData';
import type { AgendaInterview } from '@/hooks/useClientInterviewAgenda';
import { cn } from '@/lib/utils';

const fmtTermin = (iso: string) =>
  `${new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}, ${new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;

const fmtTag = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

export interface JobAgendaSlice {
  feedbackDue: AgendaInterview[];
  upcoming: AgendaInterview[];
  counterProposals: AgendaInterview[];
  awaitingCandidate: AgendaInterview[];
}

// Termine & Feedback: vergangene Interviews ohne Feedback zuerst (die häufigste
// Blockade), dann der nächste Termin — reine Navigation zu den sicheren Flows.
export function JobTermineCard({ agenda }: { agenda: JobAgendaSlice }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const rows: { key: string; text: string; tone: 'crit' | 'warn' | 'neutral'; submissionId: string }[] = [];

  for (const iv of agenda.feedbackDue) {
    rows.push({
      key: `fb-${iv.id}`,
      text: iv.scheduledAt
        ? t('jobdetail.termine.feedback', { name: iv.candidateName, date: fmtTag(iv.scheduledAt) })
        : t('jobdetail.termine.feedback_nodate', { name: iv.candidateName }),
      tone: 'crit',
      submissionId: iv.submissionId,
    });
  }
  for (const iv of agenda.counterProposals) {
    rows.push({
      key: `cp-${iv.id}`,
      text: t('jobdetail.termine.counter', { name: iv.candidateName }),
      tone: 'warn',
      submissionId: iv.submissionId,
    });
  }
  const next = agenda.upcoming.find((iv) => iv.confirmed) ?? agenda.upcoming[0];
  if (next?.scheduledAt) {
    rows.push({
      key: `up-${next.id}`,
      text: t('jobdetail.termine.next', { date: fmtTermin(next.scheduledAt), name: next.candidateName }),
      tone: 'neutral',
      submissionId: next.submissionId,
    });
  }
  for (const iv of agenda.awaitingCandidate) {
    rows.push({
      key: `aw-${iv.id}`,
      text: t('jobdetail.termine.waiting', { name: iv.candidateName }),
      tone: 'neutral',
      submissionId: iv.submissionId,
    });
  }

  if (rows.length === 0) return null;
  const more = agenda.upcoming.length - 1;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('jobdetail.termine.title')}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 px-2 text-xs text-primary"
          onClick={() => navigate('/dashboard/interviews')}
        >
          {t('jobdetail.termine.all')}
          <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
      <div>
        {rows.map((row) => (
          <button
            key={row.key}
            onClick={() => navigate(`/dashboard/candidates/${row.submissionId}`)}
            className={cn(
              'flex w-full items-center gap-2.5 border-t py-2.5 text-left text-sm transition-colors first:border-t-0 hover:bg-muted/40',
              row.tone === 'crit' && 'text-destructive',
              row.tone === 'warn' && 'text-warning'
            )}
          >
            {row.tone === 'crit' ? (
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            <span className="min-w-0 flex-1 truncate">{row.text}</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
          </button>
        ))}
      </div>
      {more > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">{t('jobdetail.termine.more', { count: more })}</p>
      )}
    </div>
  );
}

export interface StellendetailsJob {
  location: string | null;
  remote_type: string | null;
  onsite_days_required: number | null;
  employment_type: string | null;
  industry: string | null;
  must_haves: string[] | null;
  nice_to_haves: string[] | null;
  description: string | null;
}

// Stellendetails für den Kunden: Fakten zum Nachschlagen (er kennt seine eigene
// Stelle) — keine Marketing-Kacheln. Der Bearbeiten-Einstieg ist der Zweck.
export function JobStellendetails({
  job,
  onEdit,
  isViewer,
}: {
  job: StellendetailsJob;
  onEdit: () => void;
  isViewer: boolean;
}) {
  const { t } = useTranslation();
  const [descOpen, setDescOpen] = useState(false);

  const standort = [
    job.location,
    job.remote_type ? t(`jobdetail.remote.${job.remote_type}`, { defaultValue: job.remote_type }) : null,
    job.onsite_days_required ? t('jobdetail.stelle.onsite_days', { count: job.onsite_days_required }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const rows: { label: string; value: string }[] = [
    { label: t('jobdetail.stelle.standort'), value: standort },
    {
      label: t('jobdetail.stelle.anstellung'),
      value: job.employment_type
        ? t(`jobdetail.employment.${job.employment_type}`, { defaultValue: job.employment_type })
        : '',
    },
    { label: t('jobdetail.stelle.branche'), value: job.industry || '' },
  ].filter((r) => r.value);

  const desc = (job.description || '').trim();

  return (
    <div className="space-y-3">
      {rows.length > 0 && (
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="w-40 py-1 pr-3 align-top text-muted-foreground">{r.label}</td>
                <td className="py-1">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {(job.must_haves?.length ?? 0) > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('jobdetail.stelle.muss')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(job.must_haves || []).map((s) => (
              <Badge key={s} variant="secondary" className="font-normal">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {(job.nice_to_haves?.length ?? 0) > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('jobdetail.stelle.wunsch')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(job.nice_to_haves || []).map((s) => (
              <Badge key={s} variant="outline" className="font-normal text-muted-foreground">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {desc && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('jobdetail.stelle.beschreibung')}
          </p>
          <p
            className={cn(
              'whitespace-pre-line text-sm text-muted-foreground',
              !descOpen && 'line-clamp-4'
            )}
          >
            {desc}
          </p>
          {desc.length > 280 && (
            <button
              onClick={() => setDescOpen((v) => !v)}
              className="mt-1 text-xs font-medium text-primary hover:underline"
            >
              {descOpen ? t('jobdetail.stelle.weniger') : t('jobdetail.stelle.mehr')}
            </button>
          )}
        </div>
      )}

      {!isViewer && (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
          {t('jobdetail.stelle.edit')}
        </Button>
      )}
    </div>
  );
}

// Konditionen & Anonymität: Gehaltsband, Honorar (rollenbasiert), Reveal-Regel
// und die Recruiter-Vorschau — der Triple-Blind-USP, auch in der Live-Phase.
export function JobKonditionen({
  salaryLabel,
  feePercentage,
  canSeeFee,
  revealTrigger,
  descriptor,
}: {
  salaryLabel: string | null;
  feePercentage: number | null;
  canSeeFee: boolean;
  revealTrigger: string | null;
  descriptor: string | null;
}) {
  const { t } = useTranslation();

  const revealLabel =
    revealTrigger === 'opt_in'
      ? t('jobdetail.konditionen.reveal_opt_in')
      : revealTrigger === 'offer'
        ? t('jobdetail.konditionen.reveal_offer')
        : t('jobdetail.konditionen.reveal_interview');

  return (
    <div className="space-y-3">
      <table className="w-full text-sm">
        <tbody>
          {salaryLabel && (
            <tr>
              <td className="w-40 py-1 pr-3 align-top text-muted-foreground">
                {t('jobdetail.konditionen.salary')}
              </td>
              <td className="py-1">{salaryLabel}</td>
            </tr>
          )}
          {canSeeFee && feePercentage != null && (
            <tr>
              <td className="w-40 py-1 pr-3 align-top text-muted-foreground">
                {t('jobdetail.konditionen.fee')}
              </td>
              <td className="py-1">
                {t('jobdetail.konditionen.fee_value', { pct: feePercentage })}
                <Badge variant="outline" className="ml-2 text-[10px] font-normal text-muted-foreground">
                  {t('jobdetail.konditionen.fee_hint')}
                </Badge>
              </td>
            </tr>
          )}
          <tr>
            <td className="w-40 py-1 pr-3 align-top text-muted-foreground">
              {t('jobdetail.konditionen.reveal')}
            </td>
            <td className="py-1">{revealLabel}</td>
          </tr>
        </tbody>
      </table>

      <div className="rounded-lg bg-muted/40 p-3">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          {t('jobdetail.konditionen.preview_title')}
        </p>
        <p className="text-sm italic text-muted-foreground">
          „{descriptor || t('jobdetail.konditionen.preview_empty')}“
        </p>
        <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" aria-hidden="true" />
          {t('jobdetail.konditionen.preview_hint')}
        </p>
      </div>
    </div>
  );
}

// Team & Zugriff: wer sieht diese Stelle? Org-weite Rollen (Owner/Admin/HR)
// immer, Fachbereich/Viewer nur mit Job-Zuweisung.
export function JobTeam({
  organizationId,
  jobId,
  isOrgAdmin,
}: {
  organizationId: string;
  jobId: string;
  isOrgAdmin: boolean;
}) {
  const { t } = useTranslation();
  const { data, isLoading } = useTeamData(organizationId);

  if (isLoading) return <Skeleton className="h-16 w-full" />;

  const members = (data?.members || []).filter(
    (m) =>
      m.status !== 'inactive' &&
      (['owner', 'admin', 'hr'].includes(m.role) || m.assigned_jobs.some((j) => j.id === jobId))
  );

  return (
    <div className="space-y-2">
      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('jobdetail.team.empty')}</p>
      ) : (
        members.map((m) => {
          const name = m.full_name || m.email || '—';
          const initials = (m.full_name || m.email || '?')
            .split(/[\s@.]+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => p[0])
            .join('')
            .toUpperCase();
          return (
            <div key={m.id} className="flex items-center gap-3 text-sm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                {initials}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {name}
                {m.status === 'pending' && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {t('jobdetail.team.pending')}
                  </span>
                )}
              </span>
              <Badge variant="secondary" className="shrink-0 text-xs font-normal">
                {t(`team.roles.${m.role}`, m.role)}
              </Badge>
            </div>
          );
        })
      )}
      {isOrgAdmin && (
        <InviteMemberDialog
          organizationId={organizationId}
          defaultRole="hiring_manager"
          defaultJobIds={[jobId]}
          trigger={
            <Button variant="outline" size="sm" className="mt-1 gap-1.5">
              <UserPlus className="h-3.5 w-3.5" />
              {t('jobdetail.actions.invite')}
            </Button>
          }
        />
      )}
    </div>
  );
}

export interface VerlaufEvent {
  when: string; // ISO
  text: string;
}

export function JobVerlauf({ events }: { events: VerlaufEvent[] }) {
  const { t } = useTranslation();
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('jobdetail.verlauf.empty')}</p>;
  }
  return (
    <div className="space-y-1.5">
      {events.map((e, i) => (
        <div key={`${e.when}-${i}`} className="flex gap-3 text-sm">
          <span className="w-12 shrink-0 tabular-nums text-muted-foreground">{fmtTag(e.when)}</span>
          <span className="min-w-0 flex-1">{e.text}</span>
        </div>
      ))}
    </div>
  );
}

// Verwalten: Bearbeiten, Pausieren (mit Konsequenz-Erklärung) und der neue
// Schließen-Flow — jede Aktion erklärt erst, was passiert.
export function JobVerwalten({
  isPaused,
  isTerminal,
  onEdit,
  onPauseToggle,
  onCloseJob,
}: {
  isPaused: boolean;
  isTerminal: boolean;
  onEdit: () => void;
  onPauseToggle: () => void;
  onCloseJob: (reason: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [pauseOpen, setPauseOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [closing, setClosing] = useState(false);

  const confirmClose = async () => {
    setClosing(true);
    try {
      await onCloseJob(closeReason);
      setCloseOpen(false);
      setCloseReason('');
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
          {t('jobdetail.actions.edit')}
        </Button>
        {!isTerminal &&
          (isPaused ? (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onPauseToggle}>
              <Play className="h-3.5 w-3.5" />
              {t('jobdetail.actions.resume')}
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPauseOpen(true)}>
              <Pause className="h-3.5 w-3.5" />
              {t('jobdetail.actions.pause')}
            </Button>
          ))}
        {!isTerminal && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-destructive/40 text-destructive hover:text-destructive"
            onClick={() => setCloseOpen(true)}
          >
            <Lock className="h-3.5 w-3.5" />
            {t('jobdetail.verwalten.close')}
          </Button>
        )}
      </div>
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t('jobdetail.verwalten.hint')}
      </p>

      {/* Pausieren: Konsequenz zuerst */}
      <AlertDialog open={pauseOpen} onOpenChange={setPauseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('jobdetail.verwalten.pause_title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('jobdetail.verwalten.pause_text')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('jobdetail.verwalten.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setPauseOpen(false);
                onPauseToggle();
              }}
            >
              {t('jobdetail.actions.pause')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Schließen: Konsequenz + Grund */}
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('jobdetail.verwalten.close_title')}</DialogTitle>
            <DialogDescription>{t('jobdetail.verwalten.close_text')}</DialogDescription>
          </DialogHeader>
          <div>
            <label htmlFor="job-close-reason" className="mb-1.5 block text-sm font-medium">
              {t('jobdetail.verwalten.close_reason')}
            </label>
            <Select value={closeReason} onValueChange={setCloseReason}>
              <SelectTrigger id="job-close-reason">
                <SelectValue placeholder={t('jobdetail.verwalten.close_reason_placeholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="filled_via_matchunt">
                  {t('jobdetail.verwalten.reason_filled_matchunt')}
                </SelectItem>
                <SelectItem value="filled_elsewhere">
                  {t('jobdetail.verwalten.reason_filled_elsewhere')}
                </SelectItem>
                <SelectItem value="on_hold">{t('jobdetail.verwalten.reason_on_hold')}</SelectItem>
                <SelectItem value="cancelled">{t('jobdetail.verwalten.reason_cancelled')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-2 text-xs text-muted-foreground">
              {t('jobdetail.verwalten.close_pause_hint')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseOpen(false)}>
              {t('jobdetail.verwalten.cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmClose} disabled={!closeReason || closing}>
              {t('jobdetail.verwalten.close_confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
