import { ChevronDown, Euro } from 'lucide-react';
import { recruiterFeeRange } from '@/lib/recruiterFee';

interface Props { feePercentage: number | null; salaryMin: number | null; salaryMax: number | null }
const money = (value: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

export function FeeCalculatorCard({ feePercentage, salaryMin, salaryMax }: Props) {
  const range = recruiterFeeRange(feePercentage, salaryMin, salaryMax);
  const label = range == null ? null : range.min != null && range.max != null
    ? range.min === range.max ? money(range.min) : `${money(range.min)} – ${money(range.max)}`
    : range.min != null ? `ab ${money(range.min)}` : `bis ${money(range.max!)}`;
  return <section className="rounded-xl border border-border bg-card p-5" aria-label="Provisionsbeispiel">
    <h3 className="flex items-center gap-2 text-sm font-medium"><Euro className="h-4 w-4 text-muted-foreground" />Deine mögliche Provision</h3>
    <p className="mt-4 text-xl font-semibold tracking-tight tabular-nums">{label || 'Noch nicht berechenbar'}</p>
    <p className="mt-2 text-xs leading-6 text-muted-foreground">{range ? `Rechenbeispiel: ${range.fee.toLocaleString('de-DE')} % des angegebenen Jahresgehalts.` : 'Ein gültiger Provisionssatz und ein Gehaltswert werden benötigt.'}</p>
    <details className="group mt-4 border-t border-border pt-3"><summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium">Berechnung & Konditionen<ChevronDown className="h-3.5 w-3.5 group-open:rotate-180" /></summary><div className="mt-3 space-y-2 text-xs leading-6 text-muted-foreground"><p>Die Spanne ist eine Beispielrechnung, keine zugesagte Auszahlung. Maßgeblich sind das vereinbarte Gehalt und die Konditionen des Mandats.</p><p>Die genaue Bemessungsgrundlage, Fälligkeit und Garantiebedingungen werden dieser Ansicht nicht mitgeliefert. Vor einer verbindlichen Zusage klären.</p></div></details>
  </section>;
}
