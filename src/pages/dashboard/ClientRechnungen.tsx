import { cn } from '@/lib/utils';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Search } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useClientInvoices, type ClientInvoice } from '@/lib/billingApi';
import { InvoiceHeader, InvoiceRow } from '@/components/rechnungen/InvoiceParts';
import { dateDe, eurC as eurCents, isCorrection, kpiSubs } from '@/components/rechnungen/invoiceView';
import { InvoiceWindow } from '@/components/rechnungen/InvoiceWindow';
import { InvoiceExport } from '@/components/rechnungen/InvoiceExport';
import { BillingSettingsForm } from '@/components/rechnungen/BillingSettingsForm';
import { useTranslation } from 'react-i18next';

/**
 * Kunden-Bereich „Rechnungen“ (Etappe 3, 25.10.2026; Umbau 11.11.2026, K9–K12): eigener
 * Menüpunkt für eine ordentliche Abrechnung und die Buchhaltung. Reiter Offene Posten ·
 * Alle Belege · Zahlungen · Export · Rechnungsdaten; Klick auf einen Beleg öffnet das
 * Beleg-Fenster. Ruhig: keine Farbpillen, nur Überfälliges farbig, Teilzahlungen sichtbar.
 */

type Tab = 'op' | 'alle' | 'zahl' | 'exp' | 'daten';

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string | null; tone?: 'bad' }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3 max-sm:px-2 max-sm:py-2">
      <p className="text-xs text-muted-foreground max-sm:text-[10.5px] max-sm:leading-tight">{label}</p>
      <p className={cn('text-xl font-semibold max-sm:text-sm max-sm:tabular-nums', tone === 'bad' && 'text-destructive')}>{value}</p>
      {sub && <p className="truncate text-xs text-muted-foreground max-sm:text-[10.5px]">{sub}</p>}
    </div>
  );
}


export default function ClientRechnungen() {
  const { t } = useTranslation('clientInvoices');
  const [params, setParams] = useSearchParams();
  const q = useClientInvoices();
  const [search, setSearch] = useState('');
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [winId, setWinId] = useState<string | null>(null);

  const d = q.data;
  const invoices = useMemo(() => d?.invoices ?? [], [d]);
  const open = invoices.filter((i) => i.open).sort((a, b) => String(a.dueDate ?? '').localeCompare(String(b.dueDate ?? '')));
  const years = useMemo(() => [...new Set(invoices.map((i) => String(i.issuedAt ?? '').slice(0, 4)).filter(Boolean))].sort().reverse(), [invoices]);
  const reported = invoices.filter((i) => i.open && i.reportedPaidOn);
  const subs = d ? kpiSubs(d) : null;
  const tab = ((params.get('reiter') as Tab) || 'op');
  const setTab = (t: Tab) => { const next = new URLSearchParams(params); next.set('reiter', t); setParams(next, { replace: true }); };

  // Direkt zum Beleg (Besetzungen, Mail): ?beleg=<id>. Die Glocke kennt nur die Einreichung
  // (invoice_issued, 15.11.2026): dann die neueste Rechnung dieser Einreichung.
  useEffect(() => {
    const id = params.get('beleg');
    if (!id || !d) return;
    const treffer = d.invoices.find((i) => i.id === id)
      ?? [...d.invoices].filter((i) => i.submissionId === id).sort((a, b) => String(b.issuedAt ?? '').localeCompare(String(a.issuedAt ?? '')))[0];
    if (treffer) setWinId(treffer.id);
    const next = new URLSearchParams(params); next.delete('beleg'); setParams(next, { replace: true });
  }, [params, d, setParams]);

  const current = invoices.find((i) => i.id === winId) ?? null;
  const s = d?.settings;
  const missingAddress = !!s && (!s.street || !s.city || !s.postalCode);
  const filtered = (rows: ClientInvoice[]) => {
    const t = search.trim().toLowerCase();
    return rows.filter((i) => (!year || String(i.issuedAt ?? '').startsWith(year)) && (!t || `${i.number} ${i.candidateName ?? ''} ${i.jobTitle ?? ''} ${i.purchaseOrder ?? ''}`.toLowerCase().includes(t)));
  };
  const list = (rows: ClientInvoice[], empty: string) => rows.length === 0
    ? <p className="rounded-xl border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">{empty}</p>
    : <div className="space-y-1.5"><InvoiceHeader />{rows.map((i) => <InvoiceRow key={i.id} invoice={i} onOpen={() => setWinId(i.id)} />)}</div>;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'op', label: t('page.tabs.op', { count: open.length }) },
    { key: 'alle', label: t('page.tabs.alle', { count: invoices.length }) },
    { key: 'zahl', label: t('page.tabs.zahl', { count: (d?.payments.length ?? 0) + reported.length }) },
    { key: 'exp', label: t('page.tabs.exp') },
    { key: 'daten', label: t('page.tabs.daten') },
  ];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold">{t('page.title')}</h1>
          <p className="text-sm text-muted-foreground">{s?.name ? t('page.subtitleTo', { name: s.name }) : t('page.subtitle')}</p>
        </div>

        {q.isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : q.error ? (
          <p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : t('page.loadError')}</p>
        ) : !d?.canSee ? (
          <p className="rounded-xl border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">{t('page.noAccess')}</p>
        ) : (
          <>
            {/* Handy (17.11.2026): drei kleine Kacheln nebeneinander statt untereinander */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              <Kpi label={t('page.open')} value={eurCents(d.totals.openCents)} sub={subs?.open} />
              <Kpi label={t('page.overdue')} value={eurCents(d.totals.overdueCents)} tone={d.totals.overdueCents ? 'bad' : undefined} sub={subs?.overdue} />
              <Kpi label={t('page.paidYear', { year: new Date().getFullYear() })} value={eurCents(d.totals.paidYearCents)} sub={subs?.paid} />
            </div>

            {missingAddress && (
              <div className="rounded-xl border bg-card px-4 py-3 text-sm">
                {t('page.missingAddress')}{' '}
                {d.canManage
                  ? <button type="button" className="font-medium text-klick hover:underline" onClick={() => setTab('daten')}>{t('page.completeData')}</button>
                  : t('page.askAdmin')}
              </div>
            )}

            {/* Apple-Stil (22.11.2026): Reiter als ruhige graue Pillen */}
            <div role="tablist" className="handy-wischen flex flex-wrap items-center gap-1">
              {TABS.map((x) => (
                <button key={x.key} type="button" role="tab" aria-selected={tab === x.key} onClick={() => setTab(x.key)}
                  className={cn('h-8 shrink-0 whitespace-nowrap rounded-full px-3.5 text-xs font-medium transition-colors', tab === x.key ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground')}>
                  {x.label}
                </button>
              ))}
            </div>

            {tab === 'op' && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{t('page.openIntro')}</p>
                {list(open, t('page.nothingOpen'))}
              </div>
            )}

            {tab === 'alle' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {years.length > 0 && years.map((y) => <Button key={y} size="sm" variant={year === y ? 'secondary' : 'ghost'} className="h-7 text-xs" onClick={() => setYear(year === y ? '' : y)}>{y}</Button>)}
                  <Button size="sm" variant={year ? 'ghost' : 'secondary'} className="h-7 text-xs" onClick={() => setYear('')}>{t('page.allYears')}</Button>
                  <div className="relative ml-auto w-full sm:w-56">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('page.searchPlaceholder')} className="h-8 pl-8 text-sm" aria-label={t('page.search')} />
                  </div>
                </div>
                {list(filtered(invoices.filter((i) => !isCorrection(i))), search ? t('page.nothingFound') : t('page.noInvoices'))}
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-sm font-medium">{t('page.corrections', { count: invoices.filter(isCorrection).length })}</p>
                  {invoices.some(isCorrection)
                    ? <div className="mt-2">{list(filtered(invoices.filter(isCorrection)), t('page.nothingFound'))}</div>
                    : <p className="text-sm text-muted-foreground">{t('page.correctionsHint')}</p>}
                </div>
              </div>
            )}

            {tab === 'zahl' && (
              <div className="space-y-2">
                {reported.length === 0 && d.payments.length === 0 ? (
                  <p className="rounded-xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground">{t('page.noPayments')}</p>
                ) : (
                  <div className="divide-y rounded-xl border bg-card text-sm">
                    {reported.map((i) => (
                      <button key={`r-${i.id}`} type="button" onClick={() => setWinId(i.id)} className="flex w-full justify-between gap-3 px-4 py-2.5 text-left hover:bg-muted/40">
                        <span>{dateDe(i.reportedPaidOn)} · {i.number} · <span className="text-muted-foreground">{t('page.reportedByYou')}</span></span>
                        <span className="tabular-nums">{eurCents(i.restCents || i.totalCents)}</span>
                      </button>
                    ))}
                    {d.payments.map((p) => (
                      <button key={`p-${p.key}`} type="button" onClick={() => setWinId(p.invoiceId)} className="flex w-full justify-between gap-3 px-4 py-2.5 text-left hover:bg-muted/40">
                        <span>{dateDe(p.date)} · {p.number}{p.partial ? t('page.partial') : ''}</span>
                        <span className="tabular-nums">{eurCents(p.amountCents)}</span>
                      </button>
                    ))}
                    <div className="flex justify-between gap-3 px-4 py-2.5 font-medium"><span>{t('page.paidYearRow', { year: new Date().getFullYear() })}</span><span className="tabular-nums">{eurCents(d.totals.paidYearCents)}</span></div>
                  </div>
                )}
              </div>
            )}

            {tab === 'exp' && <InvoiceExport invoices={invoices} recipientName={s?.name ?? null} />}
            {tab === 'daten' && s && <BillingSettingsForm settings={s} canManage={d.canManage} />}
          </>
        )}
      </div>
      <InvoiceWindow invoice={current} settings={s ?? null} financeOnly={!!d?.financeOnly} canManage={!!d?.canManage} open={!!current} onOpenChange={(o) => { if (!o) setWinId(null); }} />
    </DashboardLayout>
  );
}
