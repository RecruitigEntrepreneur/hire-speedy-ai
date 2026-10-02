import { useState } from 'react';
import { de } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MAX_PROPOSALS } from '@/lib/interviewScheduling';
import { berlinLocalToIso } from '@/lib/interviewRequestUtils';

interface Props {
  selected: string[];
  onAdd: (iso: string) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** „Uhrzeit frei eingeben“: Datum + Uhrzeit in deutscher Zeit, ergibt einen Vorschlag. */
export function FreeTimePopover({ selected, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState('10:00');
  const [error, setError] = useState<string | null>(null);

  const full = selected.length >= MAX_PROPOSALS;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const add = () => {
    if (!date) return setError('Bitte ein Datum wählen.');
    // Der angeklickte Kalendertag ist ein Tag, kein Zeitpunkt: Jahr/Monat/Tag direkt übernehmen.
    const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const iso = berlinLocalToIso(key, time);
    if (!iso) return setError('Bitte eine Uhrzeit im Format HH:MM eingeben.');
    if (Date.parse(iso) <= Date.now()) return setError('Dieser Zeitpunkt liegt in der Vergangenheit.');
    if (selected.some((s) => Date.parse(s) === Date.parse(iso))) return setError('Dieser Termin ist schon ausgewählt.');
    if (full) return setError(`Höchstens ${MAX_PROPOSALS} Vorschläge.`);
    onAdd(iso);
    setError(null);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setError(null);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={full}
          className="text-xs font-medium text-primary underline underline-offset-2 hover:opacity-80 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
          title={full ? `Höchstens ${MAX_PROPOSALS} Vorschläge` : undefined}
        >
          Uhrzeit frei eingeben
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={de}
          weekStartsOn={1}
          selected={date}
          onSelect={(d) => {
            setDate(d);
            setError(null);
          }}
          disabled={{ before: today }}
          initialFocus
        />
        <div className="space-y-2 border-t p-3">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="free-time" className="text-xs">Uhrzeit (deutsche Zeit)</Label>
              <Input
                id="free-time"
                type="time"
                step={900}
                value={time}
                onChange={(e) => {
                  setTime(e.target.value);
                  setError(null);
                }}
                className="h-8"
              />
            </div>
            <Button type="button" size="sm" className="h-8" onClick={add}>
              Hinzufügen
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
