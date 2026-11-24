import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AnaCard, BarList, Kpi } from '@/components/client/analytics/AnalyticsParts';
import { Honorar } from '@/components/recruiter/Honorar';
import { useRecruiterAnalytics } from '@/hooks/useRecruiterAnalytics';
import { MIN_FOR_RATE, type AnaPeriod } from '@/lib/recruiterAnalytics';
import { cn } from '@/lib/utils';
import { eur0 } from '../../../supabase/functions/_shared/abrechnung-view';

const PERIODS: AnaPeriod[] = ['30', '90', '365'];

/** Eine Frage des Headhunters, die Antwort als Satz, darunter die Zahlen dazu. */
function Frage({ frage, antwort, children }: { frage: string; antwort: ReactNode; children?: ReactNode }) {
  return (
    <AnaCard>
      <p className="text-xs text-muted-foreground">{frage}</p>
      <p className="mt-1 text-[17px] font-semibold leading-snug tracking-tight">{antwort}</p>
      {children && <div className="mt-4">{children}</div>}
    </AnaCard>
  );
}

function Zeile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

/**
 * Auswertung des Headhunters (23.11.2026, Marko: Mix aus drei Entwürfen):
 * Kennzahlen oben, vier Fragen mit je einer Antwort, darunter die Tabelle je Stelle.
 */
export default function RecruiterAnalytics() {
  const { t, i18n } = useTranslation('recruiterAnalytics');
  const [period, setPeriod] = useState<AnaPeriod>('90');
  const { analytics: a, isLoading, isError } = useRecruiterAnalytics(period);
  const tage = (n: number | null) => (n == null ? '–' : t('days', { count: n }));
  const geld = (cents: number) => <Honorar>{eur0(cents, i18n.language)}</Honorar>;

  return (
    <DashboardLayout>
      <div className="max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>
          <div className="inline-flex rounded-full bg-secondary p-0.5" role="group" aria-label={t('periodAria')}>
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={period === p}
                onClick={() => setPeriod(p)}
                className={cn('rounded-full px-3.5 py-1.5 text-sm transition-colors', period === p ? 'bg-card font-medium text-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                {t(`period.${p}`)}
              </button>
            ))}
          </div>
        </div>

        {isError ? (
          <AnaCard><p className="text-sm text-muted-foreground">{t('error')}</p></AnaCard>
        ) : isLoading || !a ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((n) => <div key={n} className="h-28 animate-pulse rounded-2xl border bg-card" />)}</div>
        ) : a.submitted === 0 ? (
          <AnaCard>
            <p className="text-[15px] font-semibold tracking-tight">{t('empty.title')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('empty.text')}</p>
            <Link to="/recruiter/jobs" className="mt-3 inline-block text-sm text-klick hover:underline">{t('empty.link')} ›</Link>
          </AnaCard>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Kpi label={t('kpi.submitted')} value={a.submitted} spark={a.weeks} />
              <Kpi label={t('kpi.invited')} value={a.inviteRate != null ? `${a.inviteRate} %` : a.interviews} spark={a.weeksInterviews} />
              <Kpi label={t('kpi.hired')} value={a.hired} spark={a.weeksHired} tone="green" green={a.hired > 0} />
              <Kpi label={t('kpi.fee')} value={geld(a.feeCents)} spark={[]} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Frage
                frage={t('arrive.question')}
                antwort={a.inviteRate == null ? t('arrive.few', { min: MIN_FOR_RATE }) : t('arrive.answer', { percent: a.inviteRate })}
              >
                <BarList rows={[
                  { key: 'submitted', label: t('stage.submitted'), value: a.submitted },
                  { key: 'interview', label: t('stage.interview'), value: a.interviews },
                  { key: 'offer', label: t('stage.offer'), value: a.offers },
                  { key: 'hired', label: t('stage.hired'), value: a.hired },
                ]} />
              </Frage>

              <Frage
                frage={t('speed.question')}
                antwort={a.daysToInvite == null ? t('speed.none') : t('speed.answer', { count: a.daysToInvite })}
              >
                <div className="divide-y">
                  <Zeile label={t('speed.toInvite')} value={tage(a.daysToInvite)} />
                  <Zeile label={t('speed.toHire')} value={tage(a.daysToHire)} />
                  <Zeile label={t('speed.waiting')} value={a.waiting ? t('speed.waitingValue', { count: a.waiting, days: a.waitingMaxDays ?? 0 }) : '–'} />
                </div>
              </Frage>

              <Frage
                frage={t('fail.question')}
                antwort={a.rejected === 0 ? t('fail.none') : t('fail.answer', { count: a.rejected })}
              >
                <div className="divide-y">
                  <Zeile label={t('fail.rejected')} value={a.rejected} />
                  <Zeile label={t('fail.withdrawn')} value={a.withdrawn} />
                </div>
                {a.reasons.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground">{t('fail.reasons')}</p>
                    <ul className="mt-1 space-y-1 text-sm">
                      {a.reasons.map((r, n) => <li key={n} className="line-clamp-2">„{r}“</li>)}
                    </ul>
                  </div>
                )}
              </Frage>

              <Frage
                frage={t('money.question')}
                antwort={a.hired === 0 ? t('money.none') : <Honorar>{t('money.answer', { amount: eur0(a.feeCents, i18n.language), count: a.hired })}</Honorar>}
              >
                <div className="divide-y">
                  <Zeile label={t('money.perHire')} value={a.hired ? geld(Math.round(a.feeCents / a.hired)) : '–'} />
                  <Zeile label={t('money.perSubmission')} value={a.hired ? geld(Math.round(a.feeCents / a.submitted)) : '–'} />
                </div>
                <Link to="/recruiter/earnings" className="mt-3 inline-block text-sm text-klick hover:underline">{t('money.link')} ›</Link>
              </Frage>
            </div>

            <AnaCard title={t('jobs.title')}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-normal">{t('jobs.job')}</th>
                      <th className="pb-2 text-right font-normal">{t('stage.submitted')}</th>
                      <th className="pb-2 text-right font-normal">{t('stage.interview')}</th>
                      <th className="pb-2 text-right font-normal">{t('stage.hired')}</th>
                      <th className="pb-2 text-right font-normal">{t('jobs.toInvite')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.jobs.map((j) => (
                      <tr key={j.jobId} className="border-t">
                        <td className="max-w-0 py-2.5 pr-3">
                          <Link to={`/recruiter/jobs/${j.jobId}`} className="block truncate font-medium hover:underline">{j.title || t('jobs.unknown')}</Link>
                          {j.meta && <span className="block truncate text-xs text-muted-foreground">{j.meta}</span>}
                        </td>
                        <td className="py-2.5 text-right tabular-nums">{j.submitted}</td>
                        <td className={cn('py-2.5 text-right tabular-nums', !j.interviews && 'text-muted-foreground/60')}>{j.interviews}</td>
                        <td className={cn('py-2.5 text-right tabular-nums', !j.hired && 'text-muted-foreground/60')}>{j.hired}</td>
                        <td className="py-2.5 text-right tabular-nums">{tage(j.daysToInvite)}</td>
                      </tr>
                    ))}
                    <tr className="border-t font-semibold">
                      <td className="py-2.5">{t('jobs.total')}</td>
                      <td className="py-2.5 text-right tabular-nums">{a.submitted}</td>
                      <td className="py-2.5 text-right tabular-nums">{a.interviews}</td>
                      <td className="py-2.5 text-right tabular-nums">{a.hired}</td>
                      <td className="py-2.5 text-right tabular-nums">{tage(a.daysToInvite)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </AnaCard>

            <p className="text-xs text-muted-foreground">{t('note')}</p>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
