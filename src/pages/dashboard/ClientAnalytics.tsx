import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowDown, FileDown, Loader2 } from 'lucide-react';
import i18n from '@/i18n';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AnaCard, BarList, Columns, FlowTiles, Kpi, Ring, TimeBar, TrendLines, type FlowPart } from '@/components/client/analytics/AnalyticsParts';
import { useBewerber } from '@/hooks/useBewerber';
import { useClientAnalyticsBase } from '@/hooks/useClientAnalyticsBase';
import { buildClientAnalytics } from '@/lib/clientAnalytics';
import { fmtDate, fmtNumber } from '@/lib/localeFormat';
import { cn } from '@/lib/utils';

/**
 * Analytics der Kunden-Seite (22.11.2026): das Gesamtbild über alle Stellen.
 * Alles, was eine einzelne Stelle betrifft, steht in der Auswertung der Stelle
 * (Stellenseite › Auswertung); die Tabelle unten ist die Tür dorthin.
 */

type SortKey = 'review' | 'count' | 'hired' | 'run';
const one = (n: number | null) => (n === null ? '–' : fmtNumber(Math.round(n * 10) / 10, undefined, { maximumFractionDigits: 1 }));

export default function ClientAnalytics() {
  const { t } = useTranslation('clientDashboard');
  useTranslation('clientCandidates');
  const bewerber = useBewerber({ tab: null, jobId: null, search: '', sort: 'newest' });
  const [period, setPeriod] = useState(90);
  const [sort, setSort] = useState<SortKey>('review');

  const base = useClientAnalyticsBase();

  const periods = [
    { value: 30, label: t('analytics.period.days', { count: 30 }) },
    { value: 90, label: t('analytics.period.days', { count: 90 }) },
    { value: 180, label: t('analytics.period.sixMonths') },
    { value: 365, label: t('analytics.period.year') },
  ];
  const periodLabel = periods.find((x) => x.value === period)?.label ?? '';

  const a = useMemo(
    () => (base.data ? buildClientAnalytics({ items: bewerber.allItems, ...base.data, periodDays: period }) : null),
    [bewerber.allItems, base.data, period],
  );

  if (bewerber.isLoading || base.isLoading || !a) {
    return (
      <DashboardLayout>
        <div className="space-y-5">
          <h1 className="text-2xl font-bold">{t('analytics.title')}</h1>
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        </div>
      </DashboardLayout>
    );
  }

  const d = (n: number | null) => (n === null ? '–' : t('stats.days', { value: one(n) }));
  const sentence = [
    t('stats.sentence', { count: a.jobsTotal, period: periodLabel, proposals: a.proposals, hires: a.hires }),
    a.review !== null && a.review >= 1 ? t('stats.waitSentence', { days: one(a.review) }) : null,
  ].filter(Boolean).join(' ');

  const tips: { text: string; link?: boolean }[] = [];
  if (a.waiting > 0) tips.push({ text: t('stats.tip.waiting', { count: a.waiting }), link: true });
  if (a.slowJobs > 0) tips.push({ text: t('stats.tip.slow', { n: a.slowJobs, total: a.jobsWithReview }), link: a.waiting === 0 });
  if (a.reasonsMissing > 0) tips.push({ text: t('stats.tip.noReason', { count: a.reasonsMissing }) });
  if (a.flow.withdrawn + a.flow.expired > 0) tips.push({ text: t('stats.tip.lost') });

  const flowParts: FlowPart[] = [
    { key: 'hired', label: t('stats.flow.hired'), value: a.flow.hired, tone: 'green' },
    { key: 'active', label: t('stats.flow.active'), value: a.flow.active, tone: 'klick' },
    { key: 'rejected', label: t('stats.flow.rejected'), value: a.flow.rejected, tone: 'red' },
    { key: 'withdrawn', label: t('stats.flow.withdrawn'), value: a.flow.withdrawn, tone: 'red' },
    { key: 'expired', label: t('stats.flow.expired'), value: a.flow.expired, tone: 'red' },
    { key: 'closed', label: t('stats.flow.closed'), value: a.flow.closed, tone: 'muted' },
  ];

  const reasonLabel = (k: string) => (k ? (i18n.t(`clientCandidates:rejection.reasons.${k}`, { defaultValue: k }) as string) : t('stats.noReason'));
  const speedTotal = a.speed.sameDay + a.speed.upTo3 + a.speed.upTo7 + a.speed.longer;
  const rows = [...a.rows].sort((x, y) => {
    const v = (r: typeof x) => (sort === 'review' ? r.review : sort === 'count' ? r.count : sort === 'hired' ? r.hired : r.runDays) ?? -1;
    return v(y) - v(x);
  });
  const cols: { key: SortKey; label: string }[] = [
    { key: 'count', label: t('stats.col.count') },
    { key: 'review', label: t('stats.col.review') },
    { key: 'hired', label: t('stats.col.hired') },
    { key: 'run', label: t('stats.col.run') },
  ];

  const share = () => {
    const w = window.open('', '_blank', 'width=820,height=1000');
    if (!w) { toast.error(i18n.t('clientJobs:cockpit.share.blocked') as string); return; }
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
    const table = rows.map((r) => `<tr><td>${esc(r.job.title)}</td><td>${r.count}</td><td>${esc(d(r.review))}</td><td>${r.hired}</td></tr>`).join('');
    const flow = flowParts.filter((p) => p.value > 0).map((p) => `${p.value} ${p.label}`).join(' · ');
    const time = a.segments.map((s) => `${t(`stats.seg.${s.key}`)}: ${d(s.days)}`).join(' · ');
    const scriptEnd = '</' + 'script>';
    w.document.write(`<!doctype html><html lang="${esc(i18n.language)}"><head><meta charset="utf-8"><title>${esc(t('analytics.title'))}</title>
<style>body{font:13px/1.55 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111;margin:40px;max-width:760px}h1{font-size:20px;margin:0 0 6px}h2{font-size:14px;margin:24px 0 8px;border-top:1px solid #ddd;padding-top:12px}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:5px 8px 5px 0;border-bottom:1px solid #eee}th{color:#666;font-weight:400}</style></head><body>
<h1>${esc(t('analytics.title'))}</h1><p>${esc(fmtDate(new Date()))}</p><p>${esc(sentence)}</p>
<h2>${esc(t('stats.flowTitle'))}</h2><p>${a.flow.total} ${esc(t('stats.flow.total'))}: ${esc(flow)}</p>
<h2>${esc(t('stats.timeTitle'))}</h2><p>${esc(time || t('stats.timeNone'))}</p>
<h2>${esc(t('stats.tableTitle'))}</h2><table><tr><th>${esc(t('stats.col.job'))}</th><th>${esc(t('stats.col.count'))}</th><th>${esc(t('stats.col.review'))}</th><th>${esc(t('stats.col.hired'))}</th></tr>${table}</table>
<script>window.onload=function(){setTimeout(function(){window.print()},200)}${scriptEnd}</body></html>`);
    w.document.close();
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">{t('analytics.title')}</h1>
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

        <p className="max-w-3xl text-base leading-relaxed">{a.proposals ? sentence : t('stats.empty')}</p>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label={t('stats.kpi.proposals')} value={a.proposals} spark={a.trend.proposals} />
          <Kpi label={t('stats.kpi.interviews')} value={a.interviews} spark={a.trend.interviews} />
          <Kpi label={t('stats.kpi.hires')} value={a.hires} spark={a.trend.hires} tone="green" green />
          <Kpi label={t('stats.kpi.review')} value={d(a.review)} spark={a.trend.review} tone="muted" />
        </div>

        {/* Hinweise und Verbleib der Vorschläge nebeneinander, je halbe Breite */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {tips.length > 0 && (
            <AnaCard title={t('stats.tipTitle')}>
              <ul className="text-sm">
                {tips.slice(0, 3).map((x) => (
                  <li key={x.text} className="border-t py-2.5 first:border-t-0 first:pt-0 last:pb-0">
                    <p>{x.text}</p>
                    {x.link && <Link to="/dashboard/candidates" className="mt-0.5 inline-block whitespace-nowrap text-klick hover:underline">{t('stats.tip.open')} ›</Link>}
                  </li>
                ))}
              </ul>
            </AnaCard>
          )}
          {a.flow.total > 0 && (
            <AnaCard title={t('stats.flowTitle')} className={cn(tips.length === 0 && 'lg:col-span-2')}>
              <FlowTiles total={a.flow.total} totalLabel={t('stats.flow.total')} parts={flowParts} />
            </AnaCard>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AnaCard title={t('stats.timeTitle')}>
            {a.segments.length < 2 ? <p className="text-sm text-muted-foreground">{t('stats.timeNone')}</p> : (
              <>
                <TimeBar segments={a.segments.map((s) => ({ key: s.key, label: t(`stats.seg.${s.key}`), short: d(s.days), days: s.days, mine: s.mine }))} />
                <p className="mt-3 border-t pt-3 text-sm">{t('stats.timeMine', { mine: Math.round(a.timeMine), total: Math.round(a.timeTotal) })}</p>
              </>
            )}
          </AnaCard>

          <AnaCard title={t('stats.speedTitle')}>
            {speedTotal === 0 ? <p className="text-sm text-muted-foreground">{t('stats.speedNone')}</p> : (
              <Columns data={(['sameDay', 'upTo3', 'upTo7', 'longer'] as const).map((k) => ({ label: t(`stats.speed.${k}`), value: a.speed[k] }))} />
            )}
          </AnaCard>

          <AnaCard title={t('stats.filledTitle')}>
            <div className="flex items-center gap-5">
              <Ring value={a.jobsFilled} total={a.jobsTotal} />
              <div className="text-sm">
                <p>{t('stats.filled', { filled: a.jobsFilled, total: a.jobsTotal })}{a.fillDays !== null && <> {t('stats.filledDays', { days: Math.round(a.fillDays) })}</>}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">{t('stats.running', { running: a.jobsRunning, n: a.runningWithInterview })}</p>
              </div>
            </div>
          </AnaCard>

          <AnaCard title={t('stats.trendTitle')}>
            <TrendLines
              from={t('stats.trendFrom', { count: a.weekCount })}
              to={t('stats.trendTo')}
              series={[
                { key: 'p', label: t('stats.kpi.proposals'), values: a.trend.proposals, tone: 'klick' },
                { key: 'i', label: t('stats.kpi.interviews'), values: a.trend.interviews, tone: 'muted' },
                { key: 'h', label: t('stats.kpi.hires'), values: a.trend.hires, tone: 'green' },
              ]}
            />
          </AnaCard>

          <AnaCard title={t('stats.reasonsTitle')}>
            {a.reasons.length === 0 ? <p className="text-sm text-muted-foreground">{t('stats.reasonsNone')}</p> : (
              <BarList rows={a.reasons.map(([k, n]) => ({ key: k || 'none', label: reasonLabel(k), value: n, muted: !k }))} />
            )}
          </AnaCard>

          <AnaCard title={t('stats.profileTitle')}>
            {a.experience.length === 0 ? <p className="text-sm text-muted-foreground">{t('stats.empty')}</p> : (
              <>
                <p className="mb-2 text-xs text-muted-foreground">{t('stats.profileExp')}</p>
                <BarList rows={a.experience.map(([k, n]) => ({ key: k, label: k, value: n, muted: !/\d/.test(k) }))} />
                {a.regions.length > 0 && (
                  <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">{t('stats.profileRegion')}: {a.regions.map(([k, n]) => `${k} ${n}`).join(' · ')}</p>
                )}
              </>
            )}
          </AnaCard>
        </div>

        <AnaCard title={t('stats.tableTitle')}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-normal">{t('stats.col.job')}</th>
                  {cols.map((c) => (
                    <th key={c.key} className="pb-2 font-normal">
                      <button type="button" onClick={() => setSort(c.key)} aria-label={t('stats.sortBy', { col: c.label })} className={cn('inline-flex items-center gap-1 hover:text-foreground', sort === c.key && 'font-medium text-foreground')}>
                        {c.label}{sort === c.key && <ArrowDown className="h-3 w-3" />}
                      </button>
                    </th>
                  ))}
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.job.id} className="border-t">
                    <td className="py-2.5 pr-3 font-medium">{r.job.title}</td>
                    <td className="py-2.5 pr-3">{r.count}</td>
                    <td className={cn('py-2.5 pr-3', r.review !== null && r.review >= 3 && 'font-semibold')}>{d(r.review)}</td>
                    <td className="py-2.5 pr-3">{r.hired}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{r.runDays === null ? '–' : t('stats.days', { value: Math.round(r.runDays) })}</td>
                    <td className="py-2.5 text-right"><Link to={`/dashboard/jobs/${r.job.id}/auswertung`} className="whitespace-nowrap text-klick hover:underline">{t('stats.openJob')} ›</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AnaCard>
      </div>
    </DashboardLayout>
  );
}
