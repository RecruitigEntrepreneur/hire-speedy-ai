import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { Honorar } from '@/components/recruiter/Honorar';
import { cn } from '@/lib/utils';
import { kandidatKuerzel } from '@/lib/kandidatenStand';
import { dm, eur0, eur2, type ChainItem, type OverviewResponse } from '../../../../supabase/functions/_shared/abrechnung-view';

/** Worauf die Besetzung gerade wartet. Die Schritt-Namen kommen vom Server; bekannte werden zu einem Satz, sonst „als Nächstes: …“. */
const WARTET: [RegExp, string][] = [
  [/^(rechnung|invoice|faktura)$/i, 'invoice'],
  [/^(bezahlt|paid|betald|betalt)$/i, 'paid'],
  [/^(antritt|start|tillträde|tiltredelse)$/i, 'start'],
];
function wartetAuf(chain: ChainItem[]): { erledigt: number; satz: string } {
  const erledigt = chain.filter((c) => c.state === 'done').length;
  const jetzt = chain.find((c) => c.state === 'current');
  if (!jetzt) return { erledigt, satz: i18n.t('recruiterEarnings:overview.wait.complete') };
  const art = WARTET.find(([re]) => re.test(jetzt.label.trim()))?.[1];
  return { erledigt, satz: art ? i18n.t(`recruiterEarnings:overview.wait.${art}`) : i18n.t('recruiterEarnings:overview.wait.next', { label: jetzt.label }) };
}

/**
 * Verdienste › Übersicht (H8): nächste Gutschrift, drei Zahlen, deine Besetzungen.
 * Kein „Ausgezahlt“ mehr für Geld, das nur der Kunde gezahlt hat.
 * Apple-Stil (25.11.2026, Fassung A): vier Kacheln in einer Reihe, je Besetzung ein blauer Balken
 * und ein Satz, worauf sie wartet.
 */
export function VerdiensteUebersicht({ data, onOpen, onAbrechnungsdaten, onGutschriften }: { data: OverviewResponse; onOpen: (placementId: string) => void; onAbrechnungsdaten: () => void; onGutschriften: () => void }) {
  const { t } = useTranslation('recruiterEarnings');
  const next = data.next;
  const totals = data.totals;
  // Ein „spätestens“-Datum, das schon vorbei ist, hilft niemandem
  const spaetestens = next && next.slot.latest >= data.today ? dm(next.slot.latest, i18n.language) : null;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="rounded-xl border bg-card p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">{t('overview.next')}</p>
          {next ? (
            <>
              <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight"><Honorar>{eur2(next.netCents, i18n.language)}</Honorar></p>
              <p className="text-sm text-muted-foreground">
                {next.vatCents > 0 && <><Honorar>{t('overview.plusVat', { amount: eur2(next.vatCents, i18n.language) })}</Honorar> · </>}
                {t('overview.items', { count: next.lines.length })}
                {' · '}<button type="button" className="font-medium text-klick hover:underline" onClick={onGutschriften}>{t('overview.view')} ›</button>
              </p>
              <p className="mt-1 text-sm">{next.slot.label}<span className="text-muted-foreground">{spaetestens ? ` · ${t('overview.latest', { date: spaetestens })}` : ` · ${t('overview.moneyAfter')}`}</span></p>
            </>
          ) : <p className="mt-0.5 text-sm">{t('overview.nothingDue')}</p>}
        </div>
        <Kachel label={t('overview.received', { year: data.year })} cents={totals.receivedYearCents} />
        <Kachel label={t('overview.waitingStart')} cents={totals.waitingStartCents} hint={totals.waitingPaymentCents > 0 ? t('overview.waitingPayment', { amount: eur0(totals.waitingPaymentCents, i18n.language) }) : undefined} />
        <Kachel label={t('overview.waitingGuarantee')} cents={totals.waitingGuaranteeCents} />
      </div>
      {data.payoutGaps.length > 0 && (
        <p className="text-sm">
          <span className={cn(next && 'font-semibold')}>{t('overview.gaps', { list: data.payoutGaps.join(', ') })}</span>{' '}
          <button type="button" className="font-medium text-klick hover:underline" onClick={onAbrechnungsdaten}>{t('page.tabBilling')} ›</button>
        </p>
      )}

      <section className="rounded-xl border bg-card">
        <h2 className="px-4 pt-4 text-[15px] font-semibold tracking-tight sm:px-5">{t('overview.placements')} <span className="font-normal tabular-nums text-muted-foreground">· {data.rows.length}</span></h2>
        {data.rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground sm:px-5">{t('overview.noPlacements')}</p>
        ) : (
          <ul className="mt-1 divide-y divide-border">
            {data.rows.map((r) => {
              const w = r.chain.length ? wartetAuf(r.chain) : null;
              return (
                <li key={r.placementId}>
                  <button type="button" onClick={() => onOpen(r.placementId)}
                    className="group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold" aria-hidden="true">{kandidatKuerzel(r.candidateName)}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm">
                        <span className="font-medium">{r.candidateName}</span>
                        <span className="text-muted-foreground">{[r.companyName, r.packageLabel].filter(Boolean).map((x) => ` · ${x}`).join('')}</span>
                      </span>
                      {r.status || !w ? (
                        <span className="mt-0.5 block text-[13px] font-medium">{r.status}</span>
                      ) : (
                        <>
                          <span className="mt-1.5 flex max-w-[16rem] gap-1" role="img" aria-label={t('overview.wait.progress', { done: w.erledigt, total: r.chain.length })}>
                            {r.chain.map((c, i) => <span key={i} className={cn('h-1.5 flex-1 rounded-full', c.state === 'done' ? 'bg-klick' : 'bg-muted-foreground/20')} />)}
                          </span>
                          <span className="mt-1 block text-[13px]">
                            <span className="text-muted-foreground">{t('overview.wait.progress', { done: w.erledigt, total: r.chain.length })} · </span>
                            <span className="font-medium">{w.satz}</span>
                          </span>
                        </>
                      )}
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-semibold tabular-nums">{r.amountCents != null ? <Honorar>{eur0(r.amountCents, i18n.language)}</Honorar> : '–'}</span>
                      {r.amountSub && <span className="block text-xs text-muted-foreground"><Honorar>{r.amountSub}</Honorar></span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Kachel({ label, cents, hint }: { label: string; cents: number; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight"><Honorar>{eur0(cents, i18n.language)}</Honorar></p>
      {hint && <p className="text-xs text-muted-foreground"><Honorar>{hint}</Honorar></p>}
    </div>
  );
}
