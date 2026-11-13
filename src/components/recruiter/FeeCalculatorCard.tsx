import { ChevronDown, Euro } from 'lucide-react';
import { recruiterFeeRange } from '@/lib/recruiterFee';
import { Honorar } from './Honorar';
import { useJobEarning } from './verdienste/useJobEarning';
import { earningExplain, eur0 } from '../../../supabase/functions/_shared/abrechnung-view';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '@/i18n/languages';

interface Props { feePercentage: number | null; salaryMin: number | null; salaryMax: number | null; jobId?: string | null }

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
 * Seit dem Umbau 11.11.2026 (H5) mit Paket und Fassung: „So wird ausgezahlt“ und
 * „Wenn etwas schiefgeht“ statt des Satzes, Fälligkeit und Garantie würden nicht
 * mitgeliefert. Ohne Konditionen (Function noch nicht deployt) wie bisher.
 *
 * Kein `dark:` in diesem Bauteil: die Tailwind-Konfiguration hier ist
 * `darkMode: ["class", ".light"]`, `dark:`-Klassen greifen also im HELLEN
 * Thema. Die alte Fassung trug `dark:text-emerald-400` und war damit genau
 * verkehrt herum.
 */
export function FeeCalculatorCard({ feePercentage, salaryMin, salaryMax, jobId }: Props) {
  const { earning: plan, terms } = useJobEarning(jobId ?? null, salaryMin, salaryMax);
  const { t, i18n } = useTranslation('recruiterJobDetail');
  const locale = intlLocale(i18n.language);
  const money = (value: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
  if (plan && terms) {
    const ex = earningExplain(plan, terms, i18n.language);
    const spanne = plan.minCents != null && plan.maxCents != null && plan.minCents !== plan.maxCents ? `${eur0(plan.minCents, i18n.language)} – ${eur0(plan.maxCents, i18n.language)}` : null;
    return <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-5" aria-label={t('earning.yours')}>
      <h3 className="flex items-center gap-2 text-sm font-medium text-emerald-500"><Euro className="h-4 w-4" />{t('earning.yours')}</h3>
      <p className="mt-4 text-3xl font-bold tracking-tight tabular-nums"><Honorar>{eur0(plan.totalCents, i18n.language)}</Honorar></p>
      <p className="mt-1.5 text-xs leading-6 text-muted-foreground">{ex.subtitle}</p>
      <dl className="mt-4 space-y-1.5 border-t border-emerald-500/20 pt-3 text-xs">
        {spanne && <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">{t('earning.range')}</dt><dd className="tabular-nums"><Honorar>{spanne}</Honorar></dd></div>}
        {!plan.research && <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">{t('earning.share')}</dt><dd className="tabular-nums"><Honorar>{t('earning.percentOfTarget', { pct: plan.pct.toLocaleString(locale) })}</Honorar></dd></div>}
        <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">{t('earning.clientPackage')}</dt><dd>{plan.packageText}</dd></div>
      </dl>

      <div className="mt-4 border-t border-emerald-500/20 pt-3">
        <p className="text-xs font-medium">{t('earning.payout')}</p>
        <ol className="mt-1.5 divide-y divide-border/60 text-xs">
          {ex.payout.map((s) => (
            <li key={s.n} className="grid grid-cols-[1rem_minmax(0,1fr)_auto] gap-2 py-1.5">
              <span className="text-muted-foreground">{s.n}</span>
              <span>{s.title}<span className="block text-muted-foreground">{s.note}</span></span>
              <span className="font-medium tabular-nums">{s.cents != null ? <Honorar>{eur0(s.cents, i18n.language)}</Honorar> : ''}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="mt-3 border-t border-emerald-500/20 pt-3">
        <p className="text-xs font-medium">{t('earning.risks')}</p>
        <ul className="mt-1.5 space-y-1 text-xs leading-5 text-muted-foreground">
          {ex.risks.map((r) => <li key={r}>· <Honorar>{r}</Honorar></li>)}
        </ul>
      </div>
    </section>;
  }

  const range = recruiterFeeRange(feePercentage, salaryMin, salaryMax);
  const mitte = range == null ? null
    : range.min != null && range.max != null ? Math.round((range.min + range.max) / 2)
    : (range.min ?? range.max)!;
  const spanne = range?.min != null && range?.max != null && range.min !== range.max
    ? `${money(range.min)} – ${money(range.max)}` : null;

  return <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-5" aria-label={t('earning.exampleAria')}>
    <h3 className="flex items-center gap-2 text-sm font-medium text-emerald-500"><Euro className="h-4 w-4" />{t('earning.yours')}</h3>

    {mitte == null ? (
      <p className="mt-4 text-sm text-muted-foreground">{t('earning.notCalculable')}</p>
    ) : (
      <>
        <p className="mt-4 text-3xl font-bold tracking-tight tabular-nums"><Honorar>{money(mitte)}</Honorar></p>
        <p className="mt-1.5 text-xs leading-6 text-muted-foreground">{t('earning.onSuccess')}</p>
        <dl className="mt-4 space-y-1.5 border-t border-emerald-500/20 pt-3 text-xs">
          {spanne && <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{t('earning.range')}</dt><dd className="tabular-nums"><Honorar>{spanne}</Honorar></dd>
          </div>}
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{t('earning.share')}</dt>
            <dd className="tabular-nums"><Honorar>{`${range!.fee.toLocaleString(locale)} %`}</Honorar></dd>
          </div>
          {(salaryMin || salaryMax) && <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{t('earning.fixedSalary')}</dt>
            <dd className="tabular-nums">{[salaryMin, salaryMax].filter(Boolean).map(v => money(v!)).join(' – ')}</dd>
          </div>}
        </dl>
      </>
    )}

    <details className="group mt-4 border-t border-emerald-500/20 pt-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium">{t('earning.calcTerms')}<ChevronDown className="h-3.5 w-3.5 group-open:rotate-180" /></summary>
      <div className="mt-3 space-y-2 text-xs leading-6 text-muted-foreground">
        <p>{t('earning.exampleNote')}</p>
        <p>{t('earning.payoutNote')}</p>
      </div>
    </details>
  </section>;
}
