import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { buchhaltungApi, dateShort, eur0, type InvoiceItem } from '@/lib/buchhaltungApi';
import { FahrplanTab, type FahrplanAction } from '@/components/admin/buchhaltung/FahrplanTab';
import { RechnungenTab, type RechnungAction } from '@/components/admin/buchhaltung/RechnungenTab';
import { MahnDialog, PruefDialog, StornoDialog, ZahlungVonHandDialog } from '@/components/admin/buchhaltung/RechnungDialoge';
import { ZahlungenTab } from '@/components/admin/buchhaltung/ZahlungenTab';
import { GutschriftenTab } from '@/components/admin/buchhaltung/GutschriftenTab';
import { AntrittDialog, FaelleTab, FallDialog, JokerDialog, NachbesetzungDialog, type FallOpen } from '@/components/admin/buchhaltung/FaelleTab';
import { ExportTab } from '@/components/admin/buchhaltung/ExportTab';
import { ErrorLine, Kpi, Loading } from '@/components/admin/buchhaltung/ui';

const TABS = ['fahrplan', 'rechnungen', 'zahlungen', 'gutschriften', 'faelle', 'export'] as const;
type Tab = (typeof TABS)[number];

/**
 * Admin › Besetzungen (A1–A9, Umbau 11.11.2026): Fahrplan · Rechnungen · Zahlungen ·
 * Gutschriften · Fälle · Export. Beträge rechnet nur das System; Korrektur nur als
 * Storno mit Grund.
 */
export default function AdminBesetzungen() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('reiter');
  const tab: Tab = (TABS as readonly string[]).includes(raw ?? '') ? (raw as Tab) : 'fahrplan';
  const setTab = (t: string) => { const next = new URLSearchParams(params); next.set('reiter', t); setParams(next, { replace: true }); };

  const q = useQuery({ queryKey: ['admin-buchhaltung', 'overview'], queryFn: () => buchhaltungApi.overview() });
  const cases = useQuery({ queryKey: ['admin-buchhaltung', 'faelle'], queryFn: () => buchhaltungApi.cases() });
  const d = q.data;

  const [review, setReview] = useState<string | null>(null);
  const [dunning, setDunning] = useState<{ invoiceId: string; recruiterFirst: string | null } | null>(null);
  const [correct, setCorrect] = useState<{ invoiceId: string; mode: 'cancel' | 'correct' } | null>(null);
  const [manual, setManual] = useState<InvoiceItem | null>(null);
  const [fall, setFall] = useState<FallOpen>(null);

  const recruiterOf = (inv: InvoiceItem) => d?.rows.find((r) => r.placementId === inv.placementId)?.recruiterFirst ?? null;
  const onFahrplan = (a: FahrplanAction) => {
    if (a.kind === 'release') setReview(a.invoiceId);
    else if (a.kind === 'dunning') setDunning({ invoiceId: a.invoiceId, recruiterFirst: a.recruiterFirst });
    else if (a.kind === 'case') setFall({ kind: 'case', claimId: a.claimId });
    else if (a.kind === 'joker' || a.kind === 'start') setFall({ kind: a.kind, placementId: a.placementId });
  };
  const onRechnung = (a: RechnungAction) => {
    if (a.kind === 'review') setReview(a.invoice.id);
    else if (a.kind === 'dunning') setDunning({ invoiceId: a.invoice.id, recruiterFirst: recruiterOf(a.invoice) });
    else if (a.kind === 'cancel' || a.kind === 'correct') setCorrect({ invoiceId: a.invoice.id, mode: a.kind });
    else setManual(a.invoice);
  };
  const k = d?.kpis;
  const caseCount = cases.data?.count ?? 0;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">Besetzungen</h1>
            <p className="text-sm text-muted-foreground">Beträge rechnet nur das System aus Paket und Vertragsgehalt. Korrektur nur als Storno mit Grund, nie durch Überschreiben.</p>
          </div>
          <Button variant="outline" size="sm" asChild><Link to="/admin/vertraege">Unterschriften klären</Link></Button>
        </div>

        {d && d.blockers.length > 0 && (
          <p className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3 text-sm text-amber-700 dark:text-amber-400">
            <TriangleAlert className="h-4 w-4 shrink-0" />Rechnungen, Stornos und Gutschriften sind gesperrt, bis das hier eingetragen ist: {d.blockers.join(', ')} (als Secret in Lovable).
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-4">
          <Kpi label="Zur Freigabe" value={k ? String(k.drafts) : '–'} sub={k?.draftsUntil ? (k.draftsUntil < d!.today ? `Frist seit ${dateShort(k.draftsUntil)} vorbei` : `bis ${dateShort(k.draftsUntil)}`) : null} />
          <Kpi label="Offen" value={k ? eur0(k.openCents) : '–'} />
          <Kpi label="Überfällig" value={k ? eur0(k.overdueCents) : '–'} tone={k && k.overdueCents > 0 ? 'warn' : undefined} sub={k?.dunnable ? 'Mahnung möglich' : null} />
          <Kpi label={k?.run.runName ?? 'Nächster Lauf'} value={k ? `${k.run.items} Posten` : '–'} sub={k ? `bis ${dateShort(k.run.deadline)}${k.run.blockedItems ? ` · ${k.run.blockedItems} gesperrt` : ''}` : null} />
        </div>

        {q.isLoading ? <Loading /> : q.error ? <ErrorLine error={q.error} /> : d && (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="flex h-auto flex-wrap justify-start">
              <TabsTrigger value="fahrplan">Fahrplan</TabsTrigger>
              <TabsTrigger value="rechnungen">Rechnungen</TabsTrigger>
              <TabsTrigger value="zahlungen">Zahlungen</TabsTrigger>
              <TabsTrigger value="gutschriften">Gutschriften</TabsTrigger>
              <TabsTrigger value="faelle">Fälle{caseCount ? ` (${caseCount})` : ''}</TabsTrigger>
              <TabsTrigger value="export">Export</TabsTrigger>
            </TabsList>
            <TabsContent value="fahrplan"><FahrplanTab rows={d.rows} onAction={onFahrplan} /></TabsContent>
            <TabsContent value="rechnungen"><RechnungenTab invoices={d.invoices} onAction={onRechnung} /></TabsContent>
            <TabsContent value="zahlungen">{tab === 'zahlungen' && <ZahlungenTab />}</TabsContent>
            <TabsContent value="gutschriften">{tab === 'gutschriften' && <GutschriftenTab />}</TabsContent>
            <TabsContent value="faelle"><FaelleTab onOpen={setFall} /></TabsContent>
            <TabsContent value="export">{tab === 'export' && <ExportTab />}</TabsContent>
          </Tabs>
        )}
      </div>
      <PruefDialog invoiceId={review} onClose={() => setReview(null)} />
      <MahnDialog invoiceId={dunning?.invoiceId ?? null} recruiterFirst={dunning?.recruiterFirst} onClose={() => setDunning(null)} />
      <StornoDialog target={correct} onClose={() => setCorrect(null)} />
      <ZahlungVonHandDialog invoice={manual} onClose={() => setManual(null)} />
      <FallDialog claimId={fall?.kind === 'case' ? fall.claimId : null} onClose={() => setFall(null)} />
      <JokerDialog placementId={fall?.kind === 'joker' ? fall.placementId : null} onClose={() => setFall(null)} />
      <AntrittDialog placementId={fall?.kind === 'start' ? fall.placementId : null} onClose={() => setFall(null)} />
      <NachbesetzungDialog placementId={fall?.kind === 'research' ? fall.placementId : null} onClose={() => setFall(null)} />
    </DashboardLayout>
  );
}
