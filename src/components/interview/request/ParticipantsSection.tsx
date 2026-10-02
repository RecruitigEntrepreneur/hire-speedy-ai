import { useState } from 'react';
import { AlertTriangle, Mail, Plus, UserPlus, X } from 'lucide-react';
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

interface Props {
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

function ExternalPersonForm({ existing, onAdd }: { existing: AttendeeDraft[]; onAdd: (a: AttendeeDraft) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
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

export function ParticipantsSection({ me, team, attendees, onChange, people, calendarConnected }: Props) {
  const [teamOpen, setTeamOpen] = useState(false);

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
              <RequiredToggle value={mine ? true : a.required} disabled={mine} onChange={(v) => update(key, { required: v })} />
              <span className="flex min-w-[9.5rem] shrink-0 items-center justify-end gap-1 text-xs">
                {person?.visible ? (
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
        <Popover open={teamOpen} onOpenChange={setTeamOpen} modal>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5">
              <UserPlus className="h-3.5 w-3.5" /> Kollege aus Ihrem Team
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <Command>
              <CommandInput placeholder="Name suchen …" />
              <CommandList>
                <CommandEmpty>
                  {team.length <= 1 ? 'Noch keine Kollegen in Ihrem Team.' : 'Keine weiteren Kollegen gefunden.'}
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
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <ExternalPersonForm existing={attendees} onAdd={(a) => onChange([...attendees, a])} />
      </div>

      {calendarConnected && (
        <p className="text-xs text-muted-foreground">
          Kollegen aus Ihrer Firma müssen nichts verbinden. Matchunt liest ihr frei/belegt über Ihren Outlook-Zugang.
        </p>
      )}
    </div>
  );
}
