import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Check, ChevronDown } from 'lucide-react';

/**
 * Eine Gruppe, die zugeklappt eine Zeile ist.
 *
 * BEFUND (05.09.2026): Die linke Spalte der Aufnahme war ~2.500 px lang und
 * trug zwoelf gerahmte Kaesten, bis zu drei ineinander. Gemessen standen 107
 * von 130 Textgroessen im Band zwischen 10 und 14 px -- alles sah gleich
 * wichtig aus, und deshalb fuehrte nichts das Auge.
 *
 * Der groesste Einzelposten waren die FIRMENDATEN: Firmenblock, Benefits und
 * Arbeitszeit standen vor dem eigentlichen Positionsprofil und nahmen
 * zusammen rund 1.200 px, bevor der Kunde seine Stelle sah. Es sind aber
 * Werte, die er EINMAL bestaetigt und die ab der zweiten Stelle vererbt
 * werden -- kein Grund, sie vor die Position zu stellen.
 *
 * Deshalb dieses Muster, von Deel uebernommen: Erledigtes verschwindet, und
 * die zugeklappte Zeile traegt die Auskunft selbst. Wer nichts zu tun hat,
 * sieht eine Zeile; wer etwas zu tun hat, sieht wie viel.
 */

interface Props {
  titel: string;
  /** Kurzfassung des Inhalts, wenn zugeklappt. Traegt die Zeile. */
  zusammenfassung?: string;
  /** Wie viele Pflichtangaben in dieser Gruppe noch fehlen. */
  offen?: number;
  /** Ein Satz darunter, wenn aufgeklappt -- z. B. warum es das einmal gibt. */
  fussnote?: string;
  /** Zugeklappt starten, sobald nichts mehr offen ist. */
  standardOffen?: boolean;
  children: ReactNode;
}

export function CollapsibleGroup({
  titel,
  zusammenfassung,
  offen = 0,
  fussnote,
  standardOffen,
  children,
}: Props) {
  const [auf, setAuf] = useState(standardOffen ?? offen > 0);
  const fertig = offen === 0;

  return (
    <div className="rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setAuf((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-accent/40"
      >
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {titel}
        </span>

        {/* Der Zustand steht als Wort da, nicht als Prozentwert: keines der
            19 untersuchten Produkte zeigt an dieser Stelle eine Prozentzahl. */}
        {fertig ? (
          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <Check className="h-3 w-3" /> vollständig
          </span>
        ) : (
          <span className="shrink-0 text-xs text-muted-foreground">{offen} offen</span>
        )}

        {zusammenfassung && !auf && (
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {zusammenfassung}
          </span>
        )}

        <ChevronDown
          className={cn(
            'ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
            auf && 'rotate-180',
          )}
        />
      </button>

      {auf && (
        <div className="border-t p-4">
          {children}
          {fussnote && (
            <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">{fussnote}</p>
          )}
        </div>
      )}
    </div>
  );
}
