import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  FUNCTION_DEFAULT_ACCESS,
  FUNCTION_LABELS,
  interviewApi,
  type AttendeeDraft,
  type FunctionKey,
} from '@/lib/interviewScheduling';
import { isValidEmail } from '@/lib/interviewRequestUtils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string;
  jobTitle: string;
  /** Vorbelegung aus der Suche (Name oder E-Mail) */
  initial: string;
  onInvited: (attendee: AttendeeDraft) => void;
}

const FUNCTIONS: FunctionKey[] = ['fachbereich', 'fuehrungskraft', 'geschaeftsfuehrung', 'hr', 'andere'];

/** Kollegen aus dem Anfrage-Fenster ins Team einladen: Funktion zuerst, Zugriff folgt daraus. */
export function InviteColleagueDialog({ open, onOpenChange, submissionId, jobTitle, initial, onInvited }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [fn, setFn] = useState<FunctionKey>('fachbereich');
  const [otherLabel, setOtherLabel] = useState('');
  const [decisionMaker, setDecisionMaker] = useState(false);
  const [access, setAccess] = useState<'job' | 'all'>('job');
  const [accessTouched, setAccessTouched] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const text = initial.trim();
    setName(text.includes('@') ? '' : text);
    setEmail(text.includes('@') ? text : '');
    setFn('fachbereich');
    setOtherLabel('');
    setDecisionMaker(false);
    setAccess('job');
    setAccessTouched(false);
    setTouched(false);
  }, [open, initial]);

  const pickFunction = (key: FunctionKey) => {
    setFn(key);
    if (!accessTouched) setAccess(FUNCTION_DEFAULT_ACCESS[key]);
    if (key === 'geschaeftsfuehrung') setDecisionMaker(true);
  };

  const error = name.trim().length < 2
    ? 'Bitte den Namen angeben.'
    : !isValidEmail(email)
      ? 'Bitte eine gültige E-Mail-Adresse angeben.'
      : null;

  const submit = async () => {
    setTouched(true);
    if (error) return;
    setBusy(true);
    try {
      const result = await interviewApi.inviteColleague({
        submissionId,
        name: name.trim(),
        email: email.trim(),
        functionKey: fn,
        functionLabel: fn === 'andere' ? otherLabel.trim() : undefined,
        decisionMaker,
        access,
      });
      onInvited(result.attendee);
      if (result.note) toast.message(result.note);
      else toast.success(`Einladung an ${result.attendee.name} gesendet. ${result.attendee.name.split(' ')[0]} ist beim Interview dabei.`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Die Einladung hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kollegen ins Team einladen</DialogTitle>
          <DialogDescription>
            Die Person bekommt eine Einladung zu Matchunt und ist beim Interview dabei.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="inv-name" className="text-xs">Name</Label>
              <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} className="h-9" autoFocus={!name} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inv-email" className="text-xs">E-Mail</Label>
              <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9" autoFocus={!!name} />
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium">Funktion im Gespräch</p>
            <div className="flex flex-wrap gap-1.5">
              {FUNCTIONS.map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={fn === key}
                  onClick={() => pickFunction(key)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-sm transition-colors',
                    fn === key ? 'border-foreground bg-foreground text-background' : 'hover:bg-accent',
                  )}
                >
                  {key === 'andere' ? 'Andere …' : FUNCTION_LABELS[key]}
                </button>
              ))}
            </div>
            {fn === 'andere' && (
              <Input value={otherLabel} onChange={(e) => setOtherLabel(e.target.value)} maxLength={60} placeholder="z. B. Betriebsrat" className="h-9" />
            )}
            <label className="flex items-center gap-2 pt-1 text-sm">
              <Checkbox checked={decisionMaker} onCheckedChange={(v) => setDecisionMaker(v === true)} />
              Entscheidet über die Einstellung
            </label>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium">Zugriff in Matchunt</p>
            {([
              { v: 'all', title: 'Alle Stellen und Bewerber', hint: 'vorgeschlagen für Geschäftsführung und HR' },
              { v: 'job', title: `Nur „${jobTitle}“`, hint: 'vorgeschlagen für Fachbereich und Führungskraft' },
            ] as const).map((o) => (
              <button
                key={o.v}
                type="button"
                aria-pressed={access === o.v}
                onClick={() => { setAccess(o.v); setAccessTouched(true); }}
                className={cn(
                  'block w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                  access === o.v ? 'border-primary ring-1 ring-primary' : 'hover:bg-accent',
                )}
              >
                <span className="font-medium">{o.title}</span>
                <span className="text-muted-foreground"> · {o.hint}</span>
              </button>
            ))}
          </div>

          {touched && error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="submit" disabled={busy} className="gap-1.5">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Einladen und hinzufügen
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
