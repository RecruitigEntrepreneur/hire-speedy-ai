import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { FileDown, Loader2 } from 'lucide-react';
import i18n from '@/i18n';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBewerber } from '@/hooks/useBewerber';
import { useClientAnalyticsBase } from '@/hooks/useClientAnalyticsBase';
import { buildClientAnalytics, buildJobExtras, type AnaJob } from '@/lib/clientAnalytics';
import { fmtDate, fmtNumber } from '@/lib/localeFormat';
import { cn } from '@/lib/utils';
import { AnaCard, BarList, FlowTiles, SalaryBands, TimeBar, WeekBars, type FlowPart } from './AnalyticsParts';

/**
 * Auswertung einer einzelnen Stelle (22.11.2026, Apple-Stil).
 * Hier steht nur, was für diese eine Stelle gilt: wer wartet, Budget gegen Gehaltswünsche,
 * möglicher Start, Zeit gegen den eigenen Schnitt. Das Gesamtbild über alle Stellen
 * steht unter „Analytics“.
 */

export interface JobAnalyticsJob extends AnaJob {
  salary_min: number | null;
  salary_max: number | null;
}

const one = (n: number | null) => (n === null ? '–' : fmtNumber(Math.round(n * 10) / 10, undefined, { maximumFractionDigits: 1 }));

export function JobAnalytics({ job }: { job: JobAnalyticsJob }) {
  const { t } = useTranslation('clientDashboard');
  const bewerber = useBewerber({ tab: null, jobId: null, search: '', sort: 'newest' });
  const base = useClientAnalyticsBase();
  const [period, setPeriod] = useState(90);

  const periods = [
    { value: 30, label: t('analytics.period.days', { count: 30 }) },
    { value: 90, label: t('analytics.period.days', { count: 90 }) },
    { value: 180, label: t('analytics.period.sixMonths') },
    { value: 365, label: t('analytics.period.year') },
  ];
  const periodLabel = periods.find((x) => x.value === period)?.label ?? '';

  const data = useMemo(() => {
    if (!base.data) return null;
    const items = bewerber.allItems;
    const jobs = base.data.jobs.some((j) => j.id === job.id) ? base.data.jobs : [...base.data.jobs, job];
    const here = buildClientAnalytics({ items, jobs: [job], interviews: base.data.interviews, offers: base.data.offers, periodDays: period });
    const all = buildClientAnalytics({ items, jobs, interviews: base.data.interviews, offers: base.data.offers, periodDays: period });
    const since = Date.now() - period * 86_400_000;
    const mine = items.filter((i) => i.jobId === job.id);
    const extras = buildJobExtras({
      items: mine.filter((i) => i.isMyTurn || (i.submittedAt && Date.parse(i.submittedAt) >= since)),
      budgetMin: job.salary_min,
      budgetMax: job.salary_max,
    });
    const nameOf = new Map(mine.map((i) => [i.submissionId, i.fullName || [i.currentRole, i.anonymizedName].filter(Boolean).join(' · ')]));
    return { here, all, extras, nameOf };
  }, [bewerber.allItems, base.data, job, period]);

  if (bewerber.isLoading || base.isLoading || !data) {
    return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  const { here, all, extras, nameOf } = data;

  const d = (n: number | null) => (n === null ? '–' : t('stats.days', { value: one(n) }));
  const path = (tab: string) => `/dashboard/jobs/${job.id}/${tab}`;
  const sentence = [
    t('jobStats.sentence', { period: periodLabel, proposals: here.proposals, hires: here.hires }),
    here.review !== null && here.review >= 1 ? t('jobStats.waitSentence', { days: one(here.review) }) : null,
  ].filter(Boolean).join(' ');

  const budget = job.salary_min && job.salary_max
    ? t('jobStats.budgetRange', { min: Math.round(job.salary_min / 1000), max: Math.round(job.salary_max / 1000) })
    : job.salary_min || job.salary_max
      ? t('jobStats.budgetOne', { value: Math.round((job.salary_min || job.salary_max)! / 1000) })
      : null;

  // Hinweise nur zu dieser Stelle
  const reviewDiff = here.review !== null && all.review !== null ? here.review - all.review : null;
  const tips: { text: string; to: string; label: string }[] = [];
  if (extras.waiting.length > 0) tips.push({ text: t('jobStats.tip.waiting', { count: extras.waiting.length, days: extras.waiting[0].days }), to: path('kandidaten'), label: t('jobStats.link.check') });
  if (extras.salaryOver > 0) tips.push({ text: t('jobStats.tip.overBudget', { n: extras.salaryOver, total: extras.salaryKnown }), to: path('vertrag'), label: t('jobStats.link.terms') });
  if (job.status === 'published' && extras.daysSinceLast !== null && extras.daysSinceLast >= 14) tips.push({ text: t('jobStats.tip.quiet', { days: extras.daysSinceLast }), to: path('markt'), label: t('jobStats.link.market') });
  if (reviewDiff !== null && reviewDiff >= 3) tips.push({ text: t('jobStats.tip.slower', { days: Math.round(reviewDiff) }), to: path('kandidaten'), label: t('jobStats.link.candidates') });

  const flowParts: FlowPart[] = [
    { key: 'hired', label: t('stats.flow.hired'), value: here.flow.hired, tone: 'green' },
    { key: 'active', label: t('stats.flow.active'), value: here.flow.active, tone: 'klick' },
    { key: 'rejected', label: t('stats.flow.rejected'), value: here.flow.rejected, tone: 'red' },
    { key: 'withdrawn', label: t('stats.flow.withdrawn'), value: here.flow.withdrawn, tone: 'red' },
    { key: 'expired', label: t('stats.flow.expired'), value: here.flow.expired, tone: 'red' },
    { key: 'closed', label: t('stats.flow.closed'), value: here.flow.closed, tone: 'muted' },
  ];

  const seg = (xs: typeof here.segments) => xs.map((s) => ({ key: s.key, label: t(`stats.seg.${s.key}`), short: d(s.days), days: s.days, mine: s.mine }));
  const longest = Math.max(here.timeTotal, all.timeTotal);
  const startRows = (['now', 'soon', 'later', 'unknown'] as const)
    .map((k) => ({ key: k, label: t(`jobStats.start.${k}`), value: extras.start[k], muted: k === 'unknown' }))
    .filter((r) => r.value > 0);

  const share = () => {
    const w = window.open('', '_blank', 'width=820,height=1000');
    if (!w) { toast.error(i18n.t('clientJobs:cockpit.share.blocked') as string); return; }
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
    const flow = flowParts.filter((p) => p.value > 0).map((p) => `${p.value} ${p.label}`).join(' · ');
    const time = here.segments.map((s) => `${t(`stats.seg.${s.key}`)}: ${d(s.days)}`).join(' · ');
    const sal = extras.salary.map((b) => `${b.label}: ${b.count}`).join(' · ');
    const scriptEnd = '</' + 'script>';
    w.document.write(`<!doctype html><html lang="${esc(i18n.language)}"><head><meta charset="utf-8"><title>${esc(job.title)}</title>
<style>body{font:13px/1.55 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111;margin:40px;max-width:760px}h1{font-size:20px;margin:0 0 6px}h2{font-size:14px;margin:24px 0 8px;border-top:1px solid #ddd;padding-top:12px}</style></head><body>
<h1>${esc(job.title)}</h1><p>${esc(fmtDate(new Date()))}</p><p>${esc(sentence)}</p>
<h2>${esc(t('jobStats.flowTitle'))}</h2><p>${here.flow.total} ${esc(t('stats.flow.total'))}${flow ? `: ${esc(flow)}` : ''}</p>
<h2>${esc(t('jobStats.timeTitle'))}</h2><p>${esc(time || t('stats.timeNone'))}</p>
<h2>${esc(t('jobStats.salaryTitle'))}</h2><p>${esc([budget ? t('jobStats.salaryBudget', { budget }) : null, sal || t('jobStats.salaryNone')].filter(Boolean).join(' '))}</p>
<script>window.onload=function(){setTimeout(function(){window.print()},200)}${scriptEnd}</body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="max-w-3xl lg:flex-1">
          <p className="text-base leading-relaxed">{here.proposals ? sentence : t('stats.empty')}</p>
          <Link to="/dashboard/analytics" className="mt-1 inline-block text-sm text-klick hover:underline">‹ {t('jobStats.back')}</Link>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Select value={String(period)} onValueChange={(v) => setPeriod(parseInt(v, 10))}>
            <SelectTrigger className="h-9 w-auto gap-2 rounded-full border-0 bg-secondary px-4 text-sm" aria-label={t('stats.periodAria')}><SelectValue /></SelectTrigger>
            <SelectContent align="end">
              {periods.map((x) => <SelectItem key={x.value} value={String(x.value)}>{x.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-full" onClick={share}><FileDown className="h-3.5 w-3.5" />{t('stats.pdf')}</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([
          [t('stats.kpi.proposals'), here.proposals, false],
          [t('jobStats.kpi.interview'), here.interviews, false],
          [t('jobStats.kpi.hired'), here.hires, true],
          [t('stats.kpi.review'), d(here.review), false],
        ] as const).map(([label, value, green]) => (
          <div key={label} className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn('mt-1 text-3xl font-semibold tracking-tight', green && 'text-green-600')}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {tips.length > 0 && (
          <AnaCard title={t('jobStats.tipTitle')}>
            <ul className="text-sm">
              {tips.slice(0, 3).map((x) => (
                <li key={x.text} className="border-t py-2.5 first:border-t-0 first:pt-0 last:pb-0">
                  <p>{x.text}</p>
                  <Link to={x.to} className="mt-0.5 inline-block whitespace-nowrap text-klick hover:underline">{x.label} ›</Link>
                </li>
              ))}
            </ul>
          </AnaCard>
        )}
        {here.flow.total > 0 && (
          <AnaCard title={t('jobStats.flowTitle')} className={cn(tips.length === 0 && 'lg:col-span-2')}>
            <FlowTiles total={here.flow.total} totalLabel={t('stats.flow.total')} parts={flowParts} />
          </AnaCard>
        )}

        <AnaCard title={t('jobStats.waitTitle')}>
          {extras.waiting.length === 0 ? <p className="text-sm text-muted-foreground">{t('jobStats.waitNone')}</p> : (
            <>
              <ul className="text-sm">
                {extras.waiting.slice(0, 4).map((w) => (
                  <li key={w.submissionId} className="flex items-center justify-between gap-3 border-t py-2.5 first:border-t-0 first:pt-0">
                    <span className="min-w-0 truncate">{nameOf.get(w.submissionId)}</span>
                    <span className={cn('whitespace-nowrap', w.days >= 3 ? 'font-medium text-destructive' : 'text-muted-foreground')}>{t('jobStats.waitDays', { count: w.days })}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
                <Link to={path('kandidaten')} className="text-klick hover:underline">{t('jobStats.link.candidates')} ›</Link>
                {extras.waiting.length > 4 && <span className="text-xs text-muted-foreground">{t('jobStats.waitMore', { count: extras.waiting.length - 4 })}</span>}
              </p>
            </>
          )}
        </AnaCard>

        <AnaCard title={t('jobStats.timeTitle')}>
          {here.segments.length < 2 ? <p className="text-sm text-muted-foreground">{t('stats.timeNone')}</p> : (
            <>
              <p className="mb-1.5 text-xs text-muted-foreground">{t('jobStats.timeHere')}</p>
              <TimeBar segments={seg(here.segments)} legend={false} scaleTo={longest} />
              {all.segments.length >= 2 && (
                <>
                  <p className="mb-1.5 mt-3 text-xs text-muted-foreground">{t('jobStats.timeAvg')}</p>
                  <TimeBar segments={seg(all.segments)} legend={false} scaleTo={longest} />
                </>
              )}
              <ul className="mt-3 space-y-1 border-t pt-3 text-xs">
                {here.segments.map((s) => (
                  <li key={s.key} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', s.mine ? 'bg-klick' : 'bg-border')} />
                      <span className={s.mine ? 'font-medium' : 'text-muted-foreground'}>{t(`stats.seg.${s.key}`)}</span>
                    </span>
                    <span className={cn('whitespace-nowrap', s.mine ? 'font-medium' : 'text-muted-foreground')}>{d(s.days)}</span>
                  </li>
                ))}
              </ul>
              {reviewDiff !== null && (
                <p className="mt-3 border-t pt-3 text-sm">
                  {Math.abs(reviewDiff) < 1 ? t('jobStats.timeSame') : reviewDiff > 0 ? t('jobStats.timeSlower', { days: Math.round(reviewDiff) }) : t('jobStats.timeFaster', { days: Math.round(-reviewDiff) })}
                </p>
              )}
            </>
          )}
        </AnaCard>
      </div>

      <AnaCard title={t('jobStats.salaryTitle')}>
        {extras.salary.length === 0 ? <p className="text-sm text-muted-foreground">{t('jobStats.salaryNone')}</p> : (
          <>
            <div className="max-w-2xl"><SalaryBands bands={extras.salary} /></div>
            <p className="mt-3 border-t pt-3 text-sm">
              {budget && <>{t('jobStats.salaryBudget', { budget })} </>}
              {budget && (extras.salaryOver > 0 ? t('jobStats.salaryOver', { n: extras.salaryOver, total: extras.salaryKnown }) : t('jobStats.salaryOk'))}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('jobStats.salaryKnown', { n: extras.salaryKnown, total: extras.total })}{budget && <> {t('jobStats.salaryLegend')}</>}
            </p>
          </>
        )}
      </AnaCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AnaCard title={t('jobStats.startTitle')}>
          {extras.startKnown === 0 ? <p className="text-sm text-muted-foreground">{t('jobStats.startNone')}</p> : <BarList rows={startRows} />}
        </AnaCard>
        <AnaCard title={t('jobStats.weeksTitle')}>
          <WeekBars values={here.trend.proposals} from={t('stats.trendFrom', { count: here.weekCount })} to={t('stats.trendTo')} />
        </AnaCard>
      </div>
    </div>
  );
}
