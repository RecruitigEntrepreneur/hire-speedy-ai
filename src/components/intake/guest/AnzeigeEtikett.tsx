import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { findeZitat, wertAlsText } from '@/lib/anzeigeZitat';

/**
 * "aus der Anzeige" -- blau (Entscheidung Marko 13.11.2026, Farbe 2A), damit es
 * sich vom Orange fuer "fehlt noch" abhebt. Faehrt man darueber (oder tippt
 * auf dem Handy), erscheint der Satz aus der Anzeige, aus dem der Wert stammt.
 * Steht nichts woertlich in der Anzeige, sagt das Etikett, dass er abgeleitet ist.
 */
export function AnzeigeEtikett({ anzeige, wert, abweichend = false, anzeigeText, alternativen = [] }: {
  anzeige?: string | null;
  /** Der Wert, wie ihn die Anzeige sagt -- nicht die aktuelle Auswahl. */
  wert: unknown;
  /** Der Kunde hat etwas anderes gewaehlt: "laut Anzeige: …" statt "aus der Anzeige". */
  abweichend?: boolean;
  /** Kurzform des Anzeige-Werts fuer das Etikett, in der Sprache des Lesers (z. B. "On site"). */
  anzeigeText?: string;
  /**
   * Weitere Schreibweisen fuer die Suche im Wortlaut -- die Anzeige ist oft
   * deutsch, auch wenn der Leser Englisch eingestellt hat ("Vor Ort" statt "On site").
   */
  alternativen?: unknown[];
}) {
  const { t } = useTranslation(['intake', 'intakeCatalog']);
  const [offen, setOffen] = useState(false);
  const zitat = [wert, ...alternativen].map((w) => findeZitat(anzeige, w)).find(Boolean) ?? null;
  const kurz = anzeigeText ?? wertAlsText(wert);
  const text = abweichend
    ? (kurz && kurz.length <= 28 ? t('etappen.anzeige.labelOther', { value: kurz }) : t('etappen.anzeige.labelOtherShort'))
    : t('etappen.anzeige.label');
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
          <p className="leading-snug">{t('etappen.anzeige.saysOther', { value: kurz.length > 120 ? `${kurz.slice(0, 117)}…` : kurz })}</p>
        )}
        {zitat ? (
          <>
            {zitat.saetze.map((s) => (
              <p key={s} className="border-l-2 border-blue-500/50 pl-2 italic leading-snug">„{s}“</p>
            ))}
            <p className="text-[10px] text-muted-foreground">
              {zitat.vollstaendig ? t('etappen.anzeige.fromAd') : t('etappen.anzeige.fromAdPartial')}
            </p>
          </>
        ) : (
          <p className="leading-snug">
            {anzeige
              ? t('etappen.anzeige.derived')
              : t('etappen.anzeige.readFromAd')}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
