import { useEffect, useState } from 'react';
import { AlertTriangle, Gavel, Mail, Plus, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import type { AttendeeDraft, AvailabilityResult, TeamPerson } from '@/lib/interviewScheduling';
import { attendeeIdentity, isValidEmail, personFor, sameAttendee } from '@/lib/interviewRequestUtils';
import { InviteColleagueDialog } from './InviteColleagueDialog';

interface Props {
  submissionId: string;
  jobTitle: string;
  /** Darf ins Team einladen; sonst Namen der Admins */
  invite: { allowed: boolean; adminNames: string[] };
  me: TeamPerson;
  team: TeamPerson[];
  attendees: AttendeeDraft[];
  onChange: (next: AttendeeDraft[]) => void;
  /** Ergebnis der Verfügbarkeit (wer ist im Kalender sichtbar) */
  people: AvailabilityResult['people'] | undefined;
  calendarConnected: boolean;
}

/** Kleine Kalender-Marke für „sichtbar über Outlook“. */
function OutlookMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <rect x="1" y="2" width="14" height="12" rx="2" fill="#0F6CBD" />
      <ellipse cx="6.5" cy="8" rx="2.6" ry="3" fill="none" stroke="#fff" strokeWidth="1.5" />
      <path d="M10.5 5.5h3M10.5 8h3M10.5 10.5h3" stroke="#fff" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function RequiredToggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="inline-flex shrink-0 rounded-full border p-0.5 text-[11px]" role="group" aria-label="Teilnahme">
      {[
        { v: true, label: 'Pflicht' },
        { v: false, label: 'optional' },
      ].map((o) => (
        <button
          key={o.label}
          type="button"
          disabled={disabled}
          aria-pressed={value === o.v}
          onClick={() => onChange(o.v)}
          className={cn(
            'rounded-full px-2 py-0.5 transition-colors',
            value === o.v ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
            disabled && value !== o.v && 'hidden',
            disabled && 'cursor-default',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ExternalPersonForm({ existing, onAdd, open, setOpen, initial }: {
  existing: AttendeeDraft[];
  onAdd: (a: AttendeeDraft) => void;
  open: boolean;
  setOpen: (o: boolean) => void;
  initial: string;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  useEffect(() => {
    if (!open || !initial.trim()) return;
    setName(initial.includes('@') ? '' : initial.trim());
    setEmail(initial.includes('@') ? initial.trim() : '');
  }, [open, initial]);
  const [title, setTitle] = useState('');
  const [touched, setTouched] = useState(false);

  const duplicate = existing.some((a) => sameAttendee(a, { email }));
  const error = !name.trim()
    ? 'Bitte einen Namen eingeben.'
    : !isValidEmail(email)
      ? 'Bitte eine gültige E-Mail-Adresse eingeben.'
      : duplicate
        ? 'Diese Person ist schon dabei.'
        : null;

  const submit = () => {
    setTouched(true);
    if (error) return;
    onAdd({ userId: null, email: email.trim(), name: name.trim(), title: title.trim() || null, required: false, kind: 'external' });
    setName('');
    setEmail('');
    setTitle('');
    setTouched(false);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5">
          <Mail className="h-3.5 w-3.5" /> Person per E-Mail
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2.5" align="start">
        <form
          className="space-y-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="ext-name" className="text-xs">Name</Label>
            <Input id="ext-name" value={name} onChange={(e) => setName(e.target.value)} className="h-8" autoFocus />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ext-email" className="text-xs">E-Mail</Label>
            <Input id="ext-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-8" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ext-title" className="text-xs">Rolle (optional)</Label>
            <Input id="ext-title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-8" placeholder="z. B. Teamleitung" />
          </div>
          {touched && error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end">
            <Button type="submit" size="sm" className="h-8">Hinzufügen</Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export function ParticipantsSection({ submissionId, jobTitle, invite, me, team, attendees, onChange, people, calendarConnected }: Props) {
  const [teamOpen, setTeamOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [externalOpen, setExternalOpen] = useState(false);
  const [seed, setSeed] = useState('');

  const startInvite = () => { setSeed(search); setTeamOpen(false); setInviteOpen(true); };
  const startExternal = () => { setSeed(search); setTeamOpen(false); setExternalOpen(true); };
  const adminHint = invite.adminNames.length ? `Ins Team einladen können nur Admins: ${invite.adminNames.join(', ')}.` : 'Ins Team einladen können nur Admins.';

  const isMe = (a: AttendeeDraft) => sameAttendee(a, { userId: me.userId, email: me.email });
  const available = team.filter(
    (t) => t.userId !== me.userId && !attendees.some((a) => sameAttendee(a, { userId: t.userId, email: t.email })),
  );

  const update = (key: string, patch: Partial<AttendeeDraft>) =>
    onChange(attendees.map((a) => (attendeeIdentity(a) === key ? { ...a, ...patch } : a)));
  const remove = (key: string) => onChange(attendees.filter((a) => attendeeIdentity(a) !== key));

  return (
    <div className="space-y-2">
      <ul className="divide-y rounded-lg border">
        {attendees.map((a) => {
          const key = attendeeIdentity(a);
          const mine = isMe(a);
          const person = personFor(people, a);
          return (
            <li key={key} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate text-sm">
                  {mine && <span className="font-medium">Sie · </span>}
                  <span className={cn(!mine && 'font-medium')}>{a.name}</span>
                  {a.title && <span className="text-muted-foreground">{mine ? ', ' : ' · '}{a.title}</span>}
                </p>
                {a.kind === 'external' && <p className="truncate text-xs text-muted-foreground">{a.email}</p>}
              </div>
              <button
                type="button"
                aria-pressed={!!a.decisionMaker}
                onClick={() => update(key, { decisionMaker: !a.decisionMaker })}
                title="Entscheidet über die Einstellung"
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors',
                  a.decisionMaker ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Gavel className="h-3 w-3" /> Entscheider
              </button>
              <RequiredToggle value={mine ? true : a.required} disabled={mine} onChange={(v) => update(key, { required: v })} />
              <span className="flex min-w-[9.5rem] shrink-0 items-center justify-end gap-1 text-xs">
                {a.invited ? (
                  <span className="rounded-full bg-warning/15 px-2 py-0.5 text-warning">eingeladen</span>
                ) : person?.visible ? (
                  <span className="inline-flex items-center gap-1 text-success">
                    <OutlookMark className="h-3.5 w-3.5" /> sichtbar
                  </span>
                ) : a.kind === 'external' ? (
                  <span className="inline-flex items-center gap-1 text-foreground">
                    <AlertTriangle className="h-3.5 w-3.5 text-warning" /> Kalender nicht sichtbar
                  </span>
                ) : null}
              </span>
              {mine ? (
                <span className="w-6 shrink-0" aria-hidden="true" />
              ) : (
                <button
                  type="button"
                  onClick={() => remove(key)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label={`${a.name} entfernen`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Popover open={teamOpen} onOpenChange={(o) => { setTeamOpen(o); if (o) setSearch(''); }} modal>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5">
              <UserPlus className="h-3.5 w-3.5" /> Kollege aus Ihrem Team
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <Command>
              <CommandInput placeholder="Name oder E-Mail suchen …" value={search} onValueChange={setSearch} />
              <CommandList>
                <CommandEmpty className="space-y-1 p-2 text-sm">
                  <p className="px-1 pb-1 text-muted-foreground">
                    {search.trim() ? `${search.trim()} ist noch nicht in Ihrem Team.` : 'Noch keine Kollegen in Ihrem Team.'}
                  </p>
                  {invite.allowed ? (
                    <button type="button" onClick={startInvite} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left font-medium hover:bg-accent">
                      <UserPlus className="h-3.5 w-3.5" /> {search.trim() ? `${search.trim()} ins Team einladen` : 'Kollegen ins Team einladen'}
                    </button>
                  ) : (
                    <p className="px-1 text-xs text-muted-foreground">{adminHint}</p>
                  )}
                  <button type="button" onClick={startExternal} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-muted-foreground hover:bg-accent hover:text-foreground">
                    <Mail className="h-3.5 w-3.5" /> Nur zu diesem Interview einladen (ohne Matchunt-Zugang)
                  </button>
                </CommandEmpty>
                <CommandGroup>
                  {available.map((t) => (
                    <CommandItem
                      key={t.userId}
                      value={`${t.name} ${t.email} ${t.userId}`}
                      onSelect={() => {
                        onChange([
                          ...attendees,
                          { userId: t.userId, email: t.email, name: t.name, title: t.title, required: true, kind: 'client_user' },
                        ]);
                        setTeamOpen(false);
                      }}
                    >
                      <Plus className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{t.name}</span>
                      {t.title && <span className="ml-2 truncate text-xs text-muted-foreground">{t.title}</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
                {invite.allowed && available.length > 0 && (
                  <CommandGroup>
                    <CommandItem value={`__invite__ ${search}`} onSelect={startInvite}>
                      <UserPlus className="mr-2 h-3.5 w-3.5 text-muted-foreground" /> Neue Person ins Team einladen
                    </CommandItem>
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <ExternalPersonForm existing={attendees} onAdd={(a) => onChange([...attendees, a])} open={externalOpen} setOpen={setExternalOpen} initial={seed} />
      </div>
      <InviteColleagueDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        submissionId={submissionId}
        jobTitle={jobTitle}
        initial={seed}
        onInvited={(a) => {
          const rest = attendees.filter((x) => !sameAttendee(x, a));
          onChange([...rest, a]);
          setSearch('');
        }}
      />

      {calendarConnected && (
        <p className="text-xs text-muted-foreground">
          Kollegen aus Ihrer Firma müssen nichts verbinden. Matchunt liest ihr frei/belegt über Ihren Outlook-Zugang.
        </p>
      )}
    </div>
  );
}
