import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { Card, CardContent } from '@/components/ui/card';
import { Honorar } from '@/components/recruiter/Honorar';
import { cn } from '@/lib/utils';
import { Kette } from './Schritte';
import { dm, eur0, eur2, type OverviewResponse, type UpcomingRun } from '../../../../supabase/functions/_shared/abrechnung-view';

function naechsteZeile(run: UpcomingRun) {
  const first = run.lines[0];
  const rest = run.lines.length - 1;
  return rest > 0 ? i18n.t('recruiterEarnings:overview.more', { label: first.label, count: rest }) : first.label;
}

/**
 * Verdienste › Übersicht (H8): nächste Gutschrift, drei Zahlen, deine Besetzungen.
 * Kein „Ausgezahlt“ mehr für Geld, das nur der Kunde gezahlt hat.
 */
export function VerdiensteUebersicht({ data, onOpen, onAbrechnungsdaten }: { data: OverviewResponse; onOpen: (placementId: string) => void; onAbrechnungsdaten: () => void }) {
  const { t } = useTranslation('recruiterEarnings');
  const next = data.next;
  const totals = data.totals;
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
          {next ? (
            <>
              <div>
                <p className="text-sm text-muted-foreground">{t('overview.next')}</p>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums"><Honorar>{eur2(next.netCents, i18n.language)}</Honorar></p>
                <p className="text-sm text-muted-foreground">
                  {next.vatCents > 0 && <><Honorar>{t('overview.plusVat', { amount: eur2(next.vatCents, i18n.language) })}</Honorar> · </>}
                  {naechsteZeile(next)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">{next.slot.label}</p>
                <p className="text-sm text-muted-foreground">{t('overview.latest', { date: dm(next.slot.latest, i18n.language) })}</p>
              </div>
            </>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground">{t('overview.next')}</p>
              <p className="mt-0.5 text-sm">{t('overview.nothingDue')}</p>
            </div>
          )}
        </CardContent>
      </Card>
      {data.payoutGaps.length > 0 && (
        <p className="text-sm text-muted-foreground">
          <span className={cn(next && 'text-warning')}>{t('overview.gaps', { list: data.payoutGaps.join(', ') })}</span>{' '}
          <button type="button" className="underline underline-offset-4 hover:text-foreground" onClick={onAbrechnungsdaten}>{t('page.tabBilling')}</button>
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Kachel label={t('overview.received', { year: data.year })} cents={totals.receivedYearCents} />
        <Kachel label={t('overview.waitingStart')} cents={totals.waitingStartCents} hint={totals.waitingPaymentCents > 0 ? t('overview.waitingPayment', { amount: eur0(totals.waitingPaymentCents, i18n.language) }) : undefined} />
        <Kachel label={t('overview.waitingGuarantee')} cents={totals.waitingGuaranteeCents} />
      </div>

      <div>
        <h2 className="mb-1 font-medium">{t('overview.placements')}</h2>
        {data.rows.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">{t('overview.noPlacements')}</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {data.rows.map((r) => (
              <li key={r.placementId}>
                <button type="button" onClick={() => onOpen(r.placementId)}
                  className="group grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="min-w-0">
                    <span className="block truncate text-sm">
                      {r.candidateName}
                      <span className="text-muted-foreground">{[r.companyName, r.packageLabel].filter(Boolean).map((x) => ` · ${x}`).join('')}</span>
                    </span>
                    {r.status
                      ? <span className="block text-xs text-muted-foreground">{r.status}</span>
                      : <span className="block"><Kette items={r.chain} /></span>}
                  </span>
                  <span className="text-right">
                    <span className="block text-sm tabular-nums">{r.amountCents != null ? <Honorar>{eur0(r.amountCents, i18n.language)}</Honorar> : '–'}</span>
                    {r.amountSub && <span className="block text-xs text-muted-foreground"><Honorar>{r.amountSub}</Honorar></span>}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Kachel({ label, cents, hint }: { label: string; cents: number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-lg font-semibold tabular-nums"><Honorar>{eur0(cents, i18n.language)}</Honorar></p>
        {hint && <p className="text-xs text-muted-foreground"><Honorar>{hint}</Honorar></p>}
      </CardContent>
    </Card>
  );
}
