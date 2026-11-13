import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { findeZitat, wertAlsText } from '@/lib/anzeigeZitat';

/**
 * "aus der Anzeige" -- blau (Entscheidung Marko 13.11.2026, Farbe 2A), damit es
 * sich vom Orange fuer "fehlt noch" abhebt. Faehrt man darueber (oder tippt
 * auf dem Handy), erscheint der Satz aus der Anzeige, aus dem der Wert stammt.
 * Steht nichts woertlich in der Anzeige, sagt das Etikett, dass er abgeleitet ist.
 */
export function AnzeigeEtikett({ anzeige, wert, abweichend = false, anzeigeText }: {
  anzeige?: string | null;
  /** Der Wert, wie ihn die Anzeige sagt -- nicht die aktuelle Auswahl. */
  wert: unknown;
  /** Der Kunde hat etwas anderes gewaehlt: "laut Anzeige: …" statt "aus der Anzeige". */
  abweichend?: boolean;
  /** Kurzform des Anzeige-Werts fuer das Etikett (z. B. "Vor Ort"). */
  anzeigeText?: string;
}) {
  const [offen, setOffen] = useState(false);
  const zitat = findeZitat(anzeige, wert);
  const kurz = anzeigeText ?? wertAlsText(wert);
  const text = abweichend ? (kurz && kurz.length <= 28 ? `laut Anzeige: ${kurz}` : 'laut Anzeige') : 'aus der Anzeige';
  return (
    <Tooltip open={offen} onOpenChange={setOffen} delayDuration={150}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); setOffen((o) => !o); }}
          className={abweichend
            ? 'cursor-help rounded-full border border-dashed border-blue-500/60 px-1.5 py-px text-[10px] font-normal text-blue-600 dark:text-blue-300'
            : 'cursor-help rounded-full border border-blue-500/40 bg-blue-500/10 px-1.5 py-px text-[10px] font-normal text-blue-600 dark:text-blue-300'}
        >
          {text}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-sm space-y-1.5 p-3 text-xs">
        {abweichend && kurz && (
          <p className="leading-snug">Ihre Anzeige sagt: „{kurz.length > 120 ? `${kurz.slice(0, 117)}…` : kurz}“. Sie haben etwas anderes gewählt.</p>
        )}
        {zitat ? (
          <>
            {zitat.saetze.map((s) => (
              <p key={s} className="border-l-2 border-blue-500/50 pl-2 italic leading-snug">„{s}“</p>
            ))}
            <p className="text-[10px] text-muted-foreground">
              {zitat.vollstaendig ? 'Aus Ihrer Anzeige' : 'Aus Ihrer Anzeige · nicht alles steht dort wörtlich so'}
            </p>
          </>
        ) : (
          <p className="leading-snug">
            {anzeige
              ? 'Steht so nicht wörtlich in Ihrer Anzeige, sondern ist aus ihr abgeleitet. Bitte kurz prüfen.'
              : 'Aus Ihrer Anzeige gelesen.'}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
