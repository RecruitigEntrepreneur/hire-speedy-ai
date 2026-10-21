import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Eigene Eintraege unter einer Chipauswahl (20.10.2026): Firmennamen und eigene
 * Punkte stehen in keiner Chipliste. Zeigt, was der Kunde selbst eingetragen
 * hat, und nimmt Neues per Enter oder „+“ an. Die Chips selbst bleiben, wo sie
 * sind; hier stehen nur die Werte, die keiner Chip-Beschriftung entsprechen.
 */
export function EigeneEintraege({ alle, chips, placeholder, onChange }: {
  /** Alle gewaehlten Werte der Zeile, Chips und eigene. */
  alle: string[];
  chips: string[];
  placeholder?: string;
  onChange: (werte: string[]) => void;
}) {
  const [neu, setNeu] = useState('');
  const eigene = alle.filter((w) => !chips.includes(w));
  const hinzu = () => {
    const t = neu.trim();
    if (!t || alle.some((w) => w.toLocaleLowerCase('de-DE') === t.toLocaleLowerCase('de-DE'))) { setNeu(''); return; }
    onChange([...alle, t]);
    setNeu('');
  };
  return (
    <div className="mt-2 space-y-1.5">
      {eigene.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {eigene.map((w) => (
            <button key={w} type="button" onClick={() => onChange(alle.filter((x) => x !== w))}
              className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2.5 py-0.5 text-xs">
              <Check className="h-2.5 w-2.5" /> {w} <span className="text-muted-foreground">×</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input value={neu} onChange={(e) => setNeu(e.target.value)} placeholder={placeholder ?? 'Eintragen und Enter …'}
               className="h-8 text-xs"
               onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); hinzu(); } }} />
        <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-xs" disabled={!neu.trim()} onClick={hinzu}>
          +
        </Button>
      </div>
    </div>
  );
}
