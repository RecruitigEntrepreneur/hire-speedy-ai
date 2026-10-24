import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Search } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { eurCents, useClientInvoices, type ClientInvoice } from '@/lib/billingApi';
import { InvoiceHeader, InvoiceRow, dateDe } from '@/components/rechnungen/InvoiceParts';
import { InvoiceWindow } from '@/components/rechnungen/InvoiceWindow';
import { InvoiceExport } from '@/components/rechnungen/InvoiceExport';
import { BillingSettingsForm } from '@/components/rechnungen/BillingSettingsForm';

/**
 * Kunden-Bereich „Rechnungen“ (Etappe 3, 25.10.2026): eigener Menüpunkt für eine
 * ordentliche Abrechnung und die Buchhaltung. Reiter Offene Posten · Alle Belege ·
 * Zahlungen · Export · Rechnungsdaten; Klick auf einen Beleg öffnet das Beleg-Fenster.
 * Ersetzt die alte Seite „Abrechnung“ (/dashboard/billing).
 */

type Tab = 'op' | 'alle' | 'zahl' | 'exp' | 'daten';

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string | null; tone?: 'bad' }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={tone === 'bad' ? 'text-xl font-semibold text-destructive' : 'text-xl font-semibold'}>{value}</p>
      {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

const CREDIT_TYPES = ['credit_note', 'cancellation'];

export default function ClientRechnungen() {
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
  const tab = ((params.get('reiter') as Tab) || 'op');
  const setTab = (t: Tab) => { const next = new URLSearchParams(params); next.set('reiter', t); setParams(next, { replace: true }); };

  // Direkt zum Beleg (Besetzungen, Mail): ?beleg=<id>
  useEffect(() => {
    const id = params.get('beleg');
    if (!id || !d) return;
    if (d.invoices.some((i) => i.id === id)) setWinId(id);
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
    { key: 'op', label: `Offene Posten (${open.length})` },
    { key: 'alle', label: `Alle Belege (${invoices.length})` },
    { key: 'zahl', label: `Zahlungen (${(d?.payments.length ?? 0) + reported.length})` },
    { key: 'exp', label: 'Export' },
    { key: 'daten', label: 'Rechnungsdaten' },
  ];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Rechnungen</h1>
          <p className="text-sm text-muted-foreground">Alle Belege von Matchunt{s?.name ? ` an ${s.name}` : ''}, für Buchhaltung und Steuerberater.</p>
        </div>

        {q.isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : q.error ? (
          <p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : 'Die Rechnungen konnten nicht geladen werden.'}</p>
        ) : !d?.canSee ? (
          <p className="rounded-xl border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">Rechnungen sehen Inhaber, Admins, HR und die Buchhaltung. Wenden Sie sich an Ihren Admin.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Kpi label="Offen" value={eurCents(d.totals.openCents)} sub={d.totals.openCount ? `${d.totals.openCount === 1 ? '1 Beleg' : `${d.totals.openCount} Belege`}${d.totals.nextDue ? ` · fällig ${dateDe(d.totals.nextDue)}` : ''}` : 'nichts offen'} />
              <Kpi label="Überfällig" value={eurCents(d.totals.overdueCents)} tone={d.totals.overdueCents ? 'bad' : undefined} />
              <Kpi label={`Bezahlt ${new Date().getFullYear()}`} value={eurCents(d.totals.paidYearCents)} sub={d.payments.length ? null : 'noch keine Zahlung'} />
            </div>

            {missingAddress && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3 text-sm">
                Ihre Rechnungsanschrift ist unvollständig. Ohne Straße, PLZ und Ort kann Matchunt keine Rechnung freigeben.{' '}
                {d.canManage
                  ? <button type="button" className="font-medium underline underline-offset-2" onClick={() => setTab('daten')}>Rechnungsdaten ergänzen</button>
                  : 'Bitten Sie Ihren Admin oder die Buchhaltung, sie zu ergänzen.'}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
              {TABS.map((t) => <Button key={t.key} size="sm" variant={tab === t.key ? 'default' : 'outline'} className="h-8" onClick={() => setTab(t.key)}>{t.label}</Button>)}
            </div>

            {tab === 'op' && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Was noch zu zahlen ist, nach Fälligkeit.</p>
                {list(open, 'Nichts offen. Alle Rechnungen sind bezahlt.')}
              </div>
            )}

            {tab === 'alle' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {years.length > 0 && years.map((y) => <Button key={y} size="sm" variant={year === y ? 'secondary' : 'outline'} className="h-7 text-xs" onClick={() => setYear(year === y ? '' : y)}>{y}</Button>)}
                  <Button size="sm" variant={year ? 'outline' : 'secondary'} className="h-7 text-xs" onClick={() => setYear('')}>alle Jahre</Button>
                  <div className="relative ml-auto w-full sm:w-56">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nummer, Name, Bestellnummer" className="h-8 pl-8 text-sm" aria-label="Suchen" />
                  </div>
                </div>
                {list(filtered(invoices.filter((i) => !CREDIT_TYPES.includes(i.type))), search ? 'Nichts gefunden.' : 'Noch keine Rechnungen. Rechnungen entstehen mit einer Einstellung.')}
                <div className="rounded-xl border p-4">
                  <p className="text-sm font-medium">Gutschriften und Korrekturen ({invoices.filter((i) => CREDIT_TYPES.includes(i.type)).length})</p>
                  {invoices.some((i) => CREDIT_TYPES.includes(i.type))
                    ? <div className="mt-2">{list(filtered(invoices.filter((i) => CREDIT_TYPES.includes(i.type))), 'Nichts gefunden.')}</div>
                    : <p className="text-sm text-muted-foreground">Erscheinen hier mit Bezug zur Rechnung, z. B. Erstattung bei Nichtantritt oder 25 % nach erfolgloser erneuter Suche. Eine Korrektur storniert die alte Rechnung sichtbar.</p>}
                </div>
              </div>
            )}

            {tab === 'zahl' && (
              <div className="space-y-2">
                {reported.length === 0 && d.payments.length === 0 ? (
                  <p className="rounded-xl border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">Noch keine Zahlung gebucht. Gemeldete Überweisungen stehen hier, bis Matchunt den Eingang bucht.</p>
                ) : (
                  <div className="divide-y rounded-xl border text-sm">
                    {reported.map((i) => (
                      <button key={`r-${i.id}`} type="button" onClick={() => setWinId(i.id)} className="flex w-full justify-between gap-3 px-4 py-2.5 text-left hover:bg-muted/40">
                        <span>{dateDe(i.reportedPaidOn)} · {i.number} · <span className="text-muted-foreground">von Ihnen gemeldet, Matchunt prüft</span></span>
                        <span className="tabular-nums">{eurCents(i.totalCents)}</span>
                      </button>
                    ))}
                    {d.payments.map((p) => (
                      <button key={`p-${p.invoiceId}`} type="button" onClick={() => setWinId(p.invoiceId)} className="flex w-full justify-between gap-3 px-4 py-2.5 text-left hover:bg-muted/40">
                        <span>{dateDe(p.date)} · {p.number} · <span className="text-muted-foreground">gebucht von Matchunt</span></span>
                        <span className="tabular-nums">{eurCents(p.amountCents)}</span>
                      </button>
                    ))}
                    <div className="flex justify-between gap-3 px-4 py-2.5 font-medium"><span>Bezahlt {new Date().getFullYear()}</span><span className="tabular-nums">{eurCents(d.totals.paidYearCents)}</span></div>
                  </div>
                )}
              </div>
            )}

            {tab === 'exp' && <InvoiceExport invoices={invoices} recipientName={s?.name ?? null} />}
            {tab === 'daten' && s && <BillingSettingsForm settings={s} canManage={d.canManage} />}
          </>
        )}
      </div>
      <InvoiceWindow invoice={current} settings={s ?? null} financeOnly={!!d?.financeOnly} open={!!current} onOpenChange={(o) => { if (!o) setWinId(null); }} />
    </DashboardLayout>
  );
}
