import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Info, Loader2, Lock, Phone, Send, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  INTERVIEW_DURATIONS,
  MAX_PROPOSALS,
  durationLabel,
  interviewApi,
  normalizeRules,
  weekStartOf,
  type AttendeeDraft,
  type MailPreview,
  type MeetingFormat,
  type RequestContext,
  type SendInput,
  type SendResult,
} from '@/lib/interviewScheduling';
import {
  attendeeIdentity,
  fmtDateDayMonth,
  joinNames,
  roundTitle,
  sameAttendee,
} from '@/lib/interviewRequestUtils';
import { ParticipantsSection } from './ParticipantsSection';
import { ProposalGrid } from './ProposalGrid';
import { useProposalWeek, useSkipEmptyWeek } from './useProposalWeek';
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
  const { t } = useTranslation(['clientInterviews', 'interviews']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [nowIso] = useState(() => new Date().toISOString());
  const minWeek = weekStartOf(nowIso);
  const maxWeek = weekStartOf(nowIso, MAX_WEEKS_AHEAD);

  // Ab Runde 2 meist ein Treffen vor Ort mit dem Team (ohne hinterlegte Anschrift fragt das Formular danach)
  const [format, setFormat] = useState<MeetingFormat>(ctx.round >= 2 ? 'onsite' : 'teams');
  const [onsiteAddress, setOnsiteAddress] = useState(ctx.onsiteDefault ?? '');
  const [locationNote, setLocationNote] = useState(ctx.locationNoteDefault ?? '');
  const [contactName, setContactName] = useState(ctx.onsiteContactDefault?.name ?? '');
  const [contactPhone, setContactPhone] = useState(ctx.onsiteContactDefault?.phone ?? '');
  const [duration, setDuration] = useState(60);
  const [attendees, setAttendees] = useState<AttendeeDraft[]>(() => initialAttendees(ctx));
  const week = useProposalWeek(nowIso, maxWeek);
  const weekStart = week.weekStart;
  const [selected, setSelected] = useState<string[]>([]);
  const [allowAlternative, setAllowAlternative] = useState(true);
  const [defaultRules] = useState(() => normalizeRules(ctx.hours));
  const [rules, setRules] = useState(defaultRules);
  const [message, setMessage] = useState(ctx.defaultMessage ?? '');
  const [preview, setPreview] = useState<MailPreview | null>(null);

  const [needsName, setNeedsName] = useState(!!ctx.me.needsName);

  const isMe = (a: AttendeeDraft) => sameAttendee(a, { userId: ctx.me.userId, email: ctx.me.email });
  const saveName = async (name: string) => {
    const saved = await interviewApi.setName(name);
    setAttendees((cur) => cur.map((a) => (isMe(a) ? { ...a, name: saved.name } : a)));
    setNeedsName(false);
    queryClient.invalidateQueries({ queryKey: ['interview-request-context', ctx.submissionId] });
    toast.success(t('request.nameSaved'));
  };
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
  useSkipEmptyWeek(week, availability.data, availability.isPlaceholderData);

  const toggleSlot = (iso: string) =>
    setSelected((cur) => {
      const at = Date.parse(iso);
      if (cur.some((s) => Date.parse(s) === at)) return cur.filter((s) => Date.parse(s) !== at);
      if (cur.length >= MAX_PROPOSALS) return cur;
      return [...cur, iso];
    });

  const addressMissing = format === 'onsite' && onsiteAddress.trim().length < 5;

  const buildInput = (): SendInput => ({
    submissionId: ctx.submissionId,
    meetingFormat: format,
    onsiteAddress: format === 'onsite' ? onsiteAddress.trim() : null,
    locationNote: format === 'onsite' ? locationNote.trim() || null : null,
    onsiteContactName: format === 'onsite' ? contactName.trim() || null : null,
    onsiteContactPhone: format === 'onsite' ? contactPhone.trim() || null : null,
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
          ? t('request.sentNamed', { name: recruiter })
          : t('request.sent'),
      );
      if (result.warning) toast.warning(result.warning);
      queryClient.invalidateQueries({ queryKey: ['client-interview-agenda'] });
      queryClient.invalidateQueries({ queryKey: ['interview-availability'] });
      // Ab Runde 2 bleibt die Stufe gleich: Zustand im Profil und in der Liste neu laden
      queryClient.invalidateQueries({ queryKey: ['submission-state'] });
      queryClient.invalidateQueries({ queryKey: ['bewerber'] });
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
  const inviteNames = joinNames(attendees.map((a) => (isMe(a) ? t('request.you') : a.name)));

  return (
    <>
      <DialogHeader className="space-y-1 border-b px-4 py-4 pr-12 text-left sm:px-6">
        <DialogTitle>{roundTitle(ctx.round)}</DialogTitle>
        <DialogDescription className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          {!ctx.identityUnlocked && <Lock className="h-3.5 w-3.5 shrink-0" aria-label={t('request.anonymous')} />}
          <span className={cn('text-foreground', !ctx.identityUnlocked && 'font-mono')}>{candidateShown}</span>
          <span>{t('request.forJob', { title: ctx.jobTitle })}</span>
          {recruiter && <span>{t('request.headhunter', { name: recruiter })}</span>}
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4 sm:px-6">
        {ctx.openRequest ? (
          <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p>
              {t('request.openExists', { date: fmtDateDayMonth(ctx.openRequest.createdAt) })}
            </p>
          </div>
        ) : replacesInterviewId ? (
          <div className="flex gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p>{t('request.replaces')}</p>
          </div>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <Section title={t('request.format')}>
            <div className="flex flex-wrap gap-2">
              <Chip active={format === 'teams'} onClick={() => setFormat('teams')}>
                <Video className="h-3.5 w-3.5" /> Microsoft Teams
              </Chip>
              <Chip active={format === 'phone'} onClick={() => setFormat('phone')}>
                <Phone className="h-3.5 w-3.5" /> {t('interviews:meeting.phone')}
              </Chip>
              <Chip active={format === 'onsite'} onClick={() => setFormat('onsite')}>
                <Building2 className="h-3.5 w-3.5" /> {t('interviews:meeting.onsite')}
              </Chip>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {format === 'teams' && (ctx.teamsLink === 'manual'
                ? t('request.teamsManual')
                : t('request.teamsAuto'))}
              {format === 'phone' && t('request.phoneHint')}
              {format === 'onsite' && t('request.onsiteHint')}
            </p>
          </Section>
          <Section title={t('request.duration')}>
            <div className="flex flex-wrap gap-2">
              {INTERVIEW_DURATIONS.map((d) => (
                <Chip key={d} active={duration === d} onClick={() => setDuration(d)}>
                  {durationLabel(d)}
                </Chip>
              ))}
            </div>
          </Section>
        </div>

        {format === 'onsite' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="onsite-address" className="mb-1.5 block text-sm font-medium">{t('request.address')}</label>
              <Textarea
                id="onsite-address"
                value={onsiteAddress}
                onChange={(e) => setOnsiteAddress(e.target.value)}
                rows={3}
                maxLength={300}
                placeholder={t('request.addressPh')}
                className="text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {ctx.onsiteDefault ? t('request.addressFromCompany') : t('request.addressNeeded')}
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label htmlFor="onsite-note" className="mb-1.5 block text-sm font-medium">{t('request.reception')}</label>
                <Input
                  id="onsite-note"
                  value={locationNote}
                  onChange={(e) => setLocationNote(e.target.value)}
                  maxLength={300}
                  placeholder={t('request.receptionPh')}
                  className="text-sm"
                />
              </div>
              <div>
                <p className="mb-1.5 text-sm font-medium">{t('request.contact')}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input aria-label={t('request.contactNameAria')} value={contactName} onChange={(e) => setContactName(e.target.value)} maxLength={120} placeholder={t('request.contactName')} className="text-sm" />
                  <Input aria-label={t('request.contactPhoneAria')} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} maxLength={40} placeholder={t('interviews:meeting.phone')} inputMode="tel" className="text-sm" />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t('request.contactHint')}</p>
              </div>
            </div>
          </div>
        )}

        <Section title={t('request.who')}>
          <ParticipantsSection
            submissionId={ctx.submissionId}
            jobTitle={ctx.jobTitle}
            invite={ctx.invite ?? { allowed: false, adminNames: [] }}
            me={ctx.me}
            team={ctx.team ?? []}
            attendees={attendees}
            onChange={(next) => setAttendees(next.some(isMe) ? next : attendees)}
            people={availability.data?.people}
            calendarConnected={calendarConnected}
            needsName={needsName}
            onSaveName={saveName}
          />
        </Section>

        <Section title={t('request.proposals')}>
          <ProposalGrid
            weekStart={weekStart}
            canGoBack={weekStart > minWeek}
            canGoForward={weekStart < maxWeek}
            onWeekChange={week.go}
            note={week.note}
            data={availability.data}
            isLoading={availability.isLoading}
            isFetching={availability.isFetching}
            error={availability.error}
            onRetry={() => availability.refetch()}
            selected={selected}
            onToggle={toggleSlot}
            onAdd={(iso) => setSelected((cur) => (cur.length >= MAX_PROPOSALS ? cur : [...cur, iso]))}
            peopleCount={attendees.length}
            durationMinutes={duration}
            minNoticeHours={rules.minNoticeHours}
            onCheckTime={(iso) => interviewApi.checkTime({ submissionId: ctx.submissionId, durationMinutes: duration, start: iso, attendees })}
            calendar={ctx.calendar}
            onConnectCalendar={goSettings}
            onOpenHoursSettings={goSettings}
          />
        </Section>

        <Section title={t('request.noneFits')}>
          <AlternativeSection
            allow={allowAlternative}
            onAllowChange={setAllowAlternative}
            rules={rules}
            onRulesChange={setRules}
            defaultRules={defaultRules}
          />
        </Section>

        <Section title={t('request.message')}>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={7} maxLength={2000} className="text-sm" />
        </Section>

        <Section title={t('request.next')}>
          <ol className="space-y-1.5 text-sm">
            {[
              recruiter ? t('request.step1Named', { name: recruiter }) : t('request.step1'),
              t('request.step2'),
              calendarConnected
                // Mit Outlook legt Matchunt den Termin im Kalender des Organisators an; Kollegen lädt Outlook ein
                ? t(attendees.length > 1 ? `request.step3Outlook.${format}Team` : `request.step3Outlook.${format}`)
                : t(`request.step3Mail.${format}`, { names: inviteNames }),
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
          {t('request.previewMail')}
        </button>
        <div className="flex flex-col items-stretch gap-1 sm:flex-row sm:items-center sm:gap-3">
          {needsName ? (
            <span className="text-xs text-muted-foreground sm:text-right">{t('request.needName')}</span>
          ) : selected.length === 0 ? (
            <span className="text-xs text-muted-foreground sm:text-right">{t('request.needSlot')}</span>
          ) : addressMissing ? (
            <span className="text-xs text-muted-foreground sm:text-right">{t('request.needAddress')}</span>
          ) : null}
          <Button
            type="button"
            onClick={() => send.mutate(buildInput())}
            disabled={needsName || selected.length === 0 || addressMissing || send.isPending}
            className="gap-1.5"
          >
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t('request.send')}
          </Button>
        </div>
      </div>

      <MailPreviewDialog preview={preview} open={!!preview} onOpenChange={(o) => !o && setPreview(null)} />
    </>
  );
}
