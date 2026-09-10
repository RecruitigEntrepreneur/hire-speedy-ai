import { ChevronDown, Euro } from 'lucide-react';
import { recruiterFeeRange } from '@/lib/recruiterFee';

interface Props { feePercentage: number | null; salaryMin: number | null; salaryMax: number | null }
const money = (value: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

/**
 * Der Verdienst — die Zahl, an der ein Headhunter zuerst entscheidet.
 *
 * Sie steht gross und ganz oben in der Seitenspalte, nicht klein in der
 * Eckdatenleiste und nicht unter vier Knoepfen. Ein Versuch, sie als Zeile in
 * die Leiste zu setzen, war schlechter: "11.625 € 10,5k – 12,8k" in
 * Fliesstextgroesse zwischen Gehalt und Sprachen liest sich wie eine Fussnote.
 *
 * Der Punktwert ist die Mitte des Bandes -- eine Zahl, die man ueber Stellen
 * hinweg vergleichen kann. Die Spanne steht darunter, weil eine einzelne Zahl
 * ohne sie mehr verspricht, als bekannt ist.
 *
 * Kein `dark:` in diesem Bauteil: die Tailwind-Konfiguration hier ist
 * `darkMode: ["class", ".light"]`, `dark:`-Klassen greifen also im HELLEN
 * Thema. Die alte Fassung trug `dark:text-emerald-400` und war damit genau
 * verkehrt herum.
 */
export function FeeCalculatorCard({ feePercentage, salaryMin, salaryMax }: Props) {
  const range = recruiterFeeRange(feePercentage, salaryMin, salaryMax);
  const mitte = range == null ? null
    : range.min != null && range.max != null ? Math.round((range.min + range.max) / 2)
    : (range.min ?? range.max)!;
  const spanne = range?.min != null && range?.max != null && range.min !== range.max
    ? `${money(range.min)} – ${money(range.max)}` : null;

  return <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-5" aria-label="Provisionsbeispiel">
    <h3 className="flex items-center gap-2 text-sm font-medium text-emerald-500"><Euro className="h-4 w-4" />Dein Verdienst</h3>

    {mitte == null ? (
      <p className="mt-4 text-sm text-muted-foreground">Noch nicht berechenbar — es fehlen ein gültiger Provisionssatz und ein Gehaltswert.</p>
    ) : (
      <>
        <p className="mt-4 text-3xl font-bold tracking-tight tabular-nums">{money(mitte)}</p>
        <p className="mt-1.5 text-xs leading-6 text-muted-foreground">Bei erfolgreicher Vermittlung</p>
        <dl className="mt-4 space-y-1.5 border-t border-emerald-500/20 pt-3 text-xs">
          {spanne && <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Spanne</dt><dd className="tabular-nums">{spanne}</dd>
          </div>}
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Dein Anteil</dt>
            <dd className="tabular-nums">{range!.fee.toLocaleString('de-DE')} %</dd>
          </div>
          {(salaryMin || salaryMax) && <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Fixgehalt</dt>
            <dd className="tabular-nums">{[salaryMin, salaryMax].filter(Boolean).map(v => money(v!)).join(' – ')}</dd>
          </div>}
        </dl>
      </>
    )}

    <details className="group mt-4 border-t border-emerald-500/20 pt-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium">Berechnung & Konditionen<ChevronDown className="h-3.5 w-3.5 group-open:rotate-180" /></summary>
      <div className="mt-3 space-y-2 text-xs leading-6 text-muted-foreground">
        <p>Die Spanne ist eine Beispielrechnung, keine zugesagte Auszahlung. Maßgeblich sind das vereinbarte Gehalt und die Konditionen des Mandats.</p>
        <p>Die genaue Bemessungsgrundlage, Fälligkeit und Garantiebedingungen werden dieser Ansicht nicht mitgeliefert. Vor einer verbindlichen Zusage klären.</p>
      </div>
    </details>
  </section>;
}
