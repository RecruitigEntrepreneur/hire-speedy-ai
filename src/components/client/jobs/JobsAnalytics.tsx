import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { FileDown } from 'lucide-react';
import i18n from '@/i18n';
import { Button } from '@/components/ui/button';
import type { BewerberItem } from '@/hooks/useBewerber';
import { fmtDate, fmtNumber } from '@/lib/localeFormat';
import { cn } from '@/lib/utils';

/**
 * Auswertung (15.11.2026, Etappe 1): ehrlich aus den eigenen Daten, keine erfundenen
 * Vergleichswerte. Über alle Stellen (Meine Stellen) oder für eine Stelle (Stellenseite).
 * Etappe 2 (Server): Zeit je Abschnitt vollständig, Trefferquote je Headhunter,
 * Markt gegen Budget, Reaktionszeit im Team.
 */

export interface AnalyticsJob {
  id: string;
  title: string;
  status: string | null;
  approved_at: string | null;
  created_at: string;
  closed_at: string | null;
}

const DAY = 86_400_000;
const days = (a: string, b: string) => Math.max(0, (Date.parse(b) - Date.parse(a)) / DAY);
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const one = (n: number | null) => (n === null ? '–' : fmtNumber(Math.round(n * 10) / 10, undefined, { maximumFractionDigits: 1 }));

/** Erste Entscheidung des Kunden zu einem Vorschlag: Interview angefragt oder abgesagt. */
const decidedAt = (i: BewerberItem): string | null => {
  const xs = [i.requestedAt, i.rejectedAt].filter(Boolean) as string[];
  return xs.length ? xs.sort()[0] : null;
};

function weekKey(d: Date) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - day);
  const start = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return { year: x.getUTCFullYear(), week: Math.ceil(((x.getTime() - start.getTime()) / DAY + 1) / 7) };
}

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border bg-card p-5', className)}>
      <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Bar({ value, max, muted }: { value: number; max: number; muted?: boolean }) {
  return <div className="mt-1 h-1.5 rounded-full bg-muted"><div className={cn('h-1.5 rounded-full', muted ? 'bg-border' : 'bg-foreground/70')} style={{ width: `${max ? Math.max(4, (value / max) * 100) : 0}%` }} /></div>;
}

export function JobsAnalytics({ items, jobs, single = false, title }: { items: BewerberItem[]; jobs: AnalyticsJob[]; single?: boolean; title?: string }) {
  const { t } = useTranslation('clientJobs');
  useTranslation('clientCandidates');
  const navigate = useNavigate();
  const jobIds = useMemo(() => new Set(jobs.map((j) => j.id)), [jobs]);
  const mine = useMemo(() => items.filter((i) => jobIds.has(i.jobId)), [items, jobIds]);

  const since90 = Date.now() - 90 * DAY;
  const recent = mine.filter((i) => i.submittedAt && Date.parse(i.submittedAt) >= since90);
  const interviewsRecent = recent.filter((i) => !!i.requestedAt).length;
  const hiredRecent = mine.filter((i) => i.archiveKind === 'eingestellt').length;

  // Je Stelle: erster Vorschlag, Ihre Prüfzeit, Trefferquote, Laufzeit
  const rows = jobs.map((j) => {
    const its = mine.filter((i) => i.jobId === j.id);
    const start = j.approved_at || j.created_at;
    const first = its.map((i) => i.submittedAt).filter(Boolean).sort()[0] ?? null;
    const review = avg(its.map((i) => { const d = decidedAt(i); return d && i.submittedAt ? days(i.submittedAt, d) : null; }).filter((x): x is number => x !== null));
    const decided = its.filter((i) => decidedAt(i));
    const hits = its.filter((i) => !!i.requestedAt).length;
    return {
      job: j,
      count: its.length,
      firstDays: first ? days(start, first) : null,
      review,
      hitRate: decided.length ? Math.round((hits / its.length) * 100) : null,
      hits,
      runDays: j.status === 'published' ? days(start, new Date().toISOString()) : null,
    };
  });
  const allReview = avg(mine.map((i) => { const d = decidedAt(i); return d && i.submittedAt ? days(i.submittedAt, d) : null; }).filter((x): x is number => x !== null));

  // Wo Sie Kandidaten verlieren
  const lost = {
    rejected: mine.filter((i) => i.archiveKind === 'abgelehnt').length,
    withdrawn: mine.filter((i) => i.archiveKind === 'zurueckgezogen').length,
    expired: mine.filter((i) => i.archiveKind === 'abgelaufen').length,
  };
  // Jede Stufe zählt auch alle, die schon weiter sind (der Trichter fällt nie an).
  const atInterview = (i: BewerberItem) => i.tab === 'interview' || i.tab === 'angebot' || i.archiveKind === 'eingestellt';
  const reached = {
    proposed: mine.length,
    requested: mine.filter((i) => !!i.requestedAt || atInterview(i)).length,
    interview: mine.filter(atInterview).length,
    hired: mine.filter((i) => i.archiveKind === 'eingestellt').length,
  };

  // Absagegründe
  const reasons = new Map<string, number>();
  for (const i of mine) if (i.archiveKind === 'abgelehnt') reasons.set(i.rejectReason ?? '', (reasons.get(i.rejectReason ?? '') ?? 0) + 1);
  const reasonRows = [...reasons.entries()].sort((a, b) => b[1] - a[1]);
  const reasonTotal = reasonRows.reduce((s, [, n]) => s + n, 0);
  const topReason = reasonRows.find(([k]) => !!k);
  const reasonLabel = (k: string) => (k ? i18n.t(`clientCandidates:rejection.reasons.${k}`, { defaultValue: k }) : t('cand.noReason'));

  // Aktivität: Vorschläge je Woche, letzte 8 Wochen
  const weeks = Array.from({ length: 8 }, (_, n) => {
    const d = new Date(Date.now() - (7 - n) * 7 * DAY);
    return { ...weekKey(d), count: 0 };
  });
  for (const i of mine) {
    if (!i.submittedAt) continue;
    const k = weekKey(new Date(i.submittedAt));
    const w = weeks.find((x) => x.year === k.year && x.week === k.week);
    if (w) w.count += 1;
  }
  const maxWeek = Math.max(1, ...weeks.map((w) => w.count));

  // Eigener Maßstab: besetzte Stellen, Laufzeit bis zum Schließen
  const filled = jobs.filter((j) => j.status === 'filled' && j.closed_at);
  const fillDays = avg(filled.map((j) => days(j.approved_at || j.created_at, j.closed_at!)));

  const sentence = [
    t('ana.sentence', { proposals: recent.length, interviews: interviewsRecent }),
    hiredRecent ? t('ana.hiresTotal', { count: hiredRecent }) : null,
    allReview !== null && allReview >= 1 ? t('ana.reviewSentence', { days: one(allReview) }) : null,
  ].filter(Boolean).join(' ');

  const share = () => {
    const w = window.open('', '_blank', 'width=820,height=1000');
    if (!w) { toast.error(t('cockpit.share.blocked')); return; }
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
    const table = rows.map((r) => `<tr><td>${esc(r.job.title)}</td><td>${r.count}</td><td>${r.firstDays === null ? '–' : one(r.firstDays)}</td><td>${one(r.review)}</td><td>${r.hitRate === null ? '–' : `${r.hitRate} %`}</td></tr>`).join('');
    w.document.write(`<!doctype html><html lang="${esc(i18n.language)}"><head><meta charset="utf-8"><title>${esc(title ?? t('ana.title'))}</title>
<style>body{font:13px/1.55 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111;margin:40px;max-width:760px}h1{font-size:20px;margin:0 0 6px}h2{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#666;margin:24px 0 8px;border-top:1px solid #ddd;padding-top:12px}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:5px 8px 5px 0;border-bottom:1px solid #eee}th{color:#666;font-weight:400}.f{color:#888;font-size:11px;margin-top:30px}</style></head><body>
<h1>${esc(title ?? t('ana.title'))}</h1><p>${esc(t('cockpit.share.asOf', { date: fmtDate(new Date()) }))}</p><p>${esc(sentence)}</p>
<h2>${esc(t('ana.tableTitle'))}</h2><table><tr><th>${esc(t('ana.col.job'))}</th><th>${esc(t('ana.col.count'))}</th><th>${esc(t('ana.col.first'))}</th><th>${esc(t('ana.col.review'))}</th><th>${esc(t('ana.col.hit'))}</th></tr>${table}</table>
<h2>${esc(t('ana.lostTitle'))}</h2><p>${esc(t('ana.lostLine', lost))}</p>
<h2>${esc(t('ana.reasonsTitle'))}</h2><p>${esc(reasonRows.map(([k, n]) => `${reasonLabel(k)} ${n}×`).join(' · ') || t('market.reasonsNone'))}</p>
<p class="f">${esc(t('cockpit.share.footer'))}</p><script>window.onload=function(){setTimeout(function(){window.print()},200)}<\/script></body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-base leading-relaxed">{sentence}</p>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={share}><FileDown className="h-3.5 w-3.5" />{t('ana.pdf')}</Button>
      </div>

      {!single && (
        <Card title={t('ana.tableTitle')}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground">
                <th className="pb-2 font-normal">{t('ana.col.job')}</th><th className="pb-2 font-normal">{t('ana.col.count')}</th>
                <th className="pb-2 font-normal">{t('ana.col.first')}</th><th className="pb-2 font-normal">{t('ana.col.review')}</th>
                <th className="pb-2 font-normal">{t('ana.col.hit')}</th><th className="pb-2 font-normal">{t('ana.col.run')}</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.job.id} className="cursor-pointer border-t hover:bg-muted/40" onClick={() => navigate(`/dashboard/jobs/${r.job.id}/auswertung`)}>
                    <td className="py-2 pr-3 font-medium">{r.job.title}</td>
                    <td className="py-2 pr-3">{r.count}</td>
                    <td className="py-2 pr-3">{r.firstDays === null ? '–' : t('ana.days', { value: one(r.firstDays) })}</td>
                    <td className={cn('py-2 pr-3', r.review !== null && r.review >= 3 && 'text-amber-400 dark:text-amber-600')}>{r.review === null ? '–' : t('ana.days', { value: one(r.review) })}</td>
                    <td className="py-2 pr-3">{r.hitRate === null ? '–' : `${r.hitRate} %`}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.runDays === null ? '–' : t('ana.days', { value: Math.round(r.runDays) })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t('ana.tableHint')}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {single && rows[0] && (
          <Card title={t('ana.timeTitle')}>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t('ana.time.first')}</span><span>{rows[0].firstDays === null ? '–' : t('ana.days', { value: one(rows[0].firstDays) })}</span></div>
              <div className={cn('flex justify-between', rows[0].review !== null && rows[0].review >= 3 && 'text-amber-400 dark:text-amber-600')}><span>{t('ana.time.review')}</span><span>{rows[0].review === null ? '–' : t('ana.days', { value: one(rows[0].review) })}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('ana.time.hit')}</span><span>{rows[0].hitRate === null ? '–' : t('ana.hitValue', { hits: rows[0].hits, total: rows[0].count, pct: rows[0].hitRate })}</span></div>
            </div>
            <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">{rows[0].review !== null && rows[0].review >= 3 ? t('ana.time.tipSlow') : t('ana.time.tip')}</p>
          </Card>
        )}

        <Card title={t('ana.lostTitle')}>
          <div className="space-y-1 text-xs">
            {([['proposed', reached.proposed], ['requested', reached.requested], ['interview', reached.interview], ['hired', reached.hired]] as const).map(([k, n]) => (
              <div key={k}>
                <div className="flex justify-between"><span>{t(`ana.funnel.${k}`)}</span><span>{n}</span></div>
                <Bar value={n} max={Math.max(1, reached.proposed)} />
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{t('ana.lostLine', lost)}</p>
          {(lost.withdrawn + lost.expired) > 0 && <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">{t('ana.lostTip')}</p>}
        </Card>

        <Card title={t('ana.reasonsTitle')}>
          {reasonRows.length === 0 ? <p className="text-sm text-muted-foreground">{t('market.reasonsNone')}</p> : (
            <div className="space-y-1.5 text-xs">
              {reasonRows.map(([k, n]) => (
                <div key={k || 'none'}><div className="flex justify-between"><span>{reasonLabel(k)}</span><span>{n}</span></div><Bar value={n} max={reasonRows[0][1]} muted={!k} /></div>
              ))}
            </div>
          )}
          {topReason && reasonTotal > 0 && topReason[1] / reasonTotal >= 0.5 && (
            <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">{t(`ana.reasonTip.${['salary'].includes(topReason[0]) ? 'salary' : 'other'}`, { reason: reasonLabel(topReason[0]) })}</p>
          )}
        </Card>

        <Card title={t('ana.activityTitle')}>
          <div className="flex h-16 items-end gap-1.5">
            {weeks.map((w) => (
              <div key={`${w.year}-${w.week}`} className="flex h-full flex-1 flex-col justify-end">
                <div className={cn('w-full rounded-t-sm', w.count ? 'bg-foreground/70' : 'bg-border')} style={{ height: w.count ? `${(w.count / maxWeek) * 100}%` : 2 }} title={String(w.count)} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-1.5 text-[10px] text-muted-foreground">{weeks.map((w) => <span key={`${w.year}-${w.week}-l`} className="flex-1 text-center">{t('ana.kw', { week: w.week })}</span>)}</div>
          <p className="mt-3 text-xs text-muted-foreground">{t('ana.activityHint')}</p>
        </Card>

        {/* Eigener Maßstab braucht alle Stellen des Kunden, deshalb nur in der Gesamt-Auswertung. */}
        {!single && <Card title={t('ana.benchTitle')}>
          {filled.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('ana.benchNone')}</p>
          ) : (
            <p className="text-sm">{t('ana.bench', { count: filled.length, days: Math.round(fillDays ?? 0) })}</p>
          )}
          {single && rows[0]?.runDays !== null && rows[0] && filled.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">{t('ana.benchThis', { days: Math.round(rows[0].runDays ?? 0) })}</p>
          )}
          <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">{t('ana.benchNote')}</p>
        </Card>}
      </div>
    </div>
  );
}
