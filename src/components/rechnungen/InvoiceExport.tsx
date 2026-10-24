import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { billingApi, downloadBlob, invoicesCsv, type ClientInvoice } from '@/lib/billingApi';
import { zipStore } from '@/lib/zipStore';

/**
 * Export für Buchhaltung und Steuerberater (Etappe 3, 25.10.2026): Liste als CSV oder
 * alle PDFs eines Zeitraums als ZIP. DATEV-Buchungsstapel folgt, wenn ein Kunde ihn braucht.
 */

type Range = 'month' | 'lastMonth' | 'quarter' | 'year' | 'custom';
const pad = (n: number) => String(n).padStart(2, '0');
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function rangeOf(r: Range, from: string, to: string): { from: string; to: string; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const monthName = (yy: number, mm: number) => new Date(yy, mm, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  if (r === 'month') return { from: key(new Date(y, m, 1)), to: key(new Date(y, m + 1, 0)), label: monthName(y, m) };
  if (r === 'lastMonth') return { from: key(new Date(y, m - 1, 1)), to: key(new Date(y, m, 0)), label: monthName(y, m - 1) };
  if (r === 'quarter') { const q = Math.floor(m / 3); return { from: key(new Date(y, q * 3, 1)), to: key(new Date(y, q * 3 + 3, 0)), label: `Q${q + 1} ${y}` }; }
  if (r === 'year') return { from: `${y}-01-01`, to: `${y}-12-31`, label: String(y) };
  return { from, to, label: from && to ? `${from} bis ${to}` : 'frei' };
}

export function InvoiceExport({ invoices, recipientName }: { invoices: ClientInvoice[]; recipientName: string | null }) {
  const [range, setRange] = useState<Range>('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [format, setFormat] = useState<'csv' | 'zip'>('csv');
  const [busy, setBusy] = useState(false);
  const r = rangeOf(range, from, to);
  const rows = useMemo(() => invoices.filter((i) => i.issuedAt && (!r.from || i.issuedAt.slice(0, 10) >= r.from) && (!r.to || i.issuedAt.slice(0, 10) <= r.to)), [invoices, r.from, r.to]);
  const slug = r.label.replace(/\s+/g, '-').replace(/[^\w.-]/g, '').toLowerCase() || 'zeitraum';

  const download = async () => {
    if (!rows.length) { toast.error('Im Zeitraum gibt es keine Belege.'); return; }
    setBusy(true);
    try {
      if (format === 'csv') {
        downloadBlob(new Blob([invoicesCsv(rows, recipientName)], { type: 'text/csv;charset=utf-8' }), `rechnungen-${slug}.csv`);
      } else {
        const { files } = await billingApi.files(rows.map((i) => i.id));
        if (!files.length) throw new Error('Für diese Belege liegt noch kein PDF vor.');
        const parts = await Promise.all(files.map(async (f) => {
          const res = await fetch(f.url);
          if (!res.ok) throw new Error(`${f.number} ließ sich nicht laden.`);
          return { name: `${f.number.replace(/[^\w.-]/g, '_')}.pdf`, bytes: new Uint8Array(await res.arrayBuffer()) };
        }));
        downloadBlob(zipStore(parts), `rechnungen-${slug}.zip`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Der Export hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };

  const choice = (active: boolean, onClick: () => void, label: string) => (
    <Button key={label} size="sm" variant={active ? 'default' : 'outline'} className="h-8" onClick={onClick}>{label}</Button>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Für Buchhaltung und Steuerberater.</p>
      <div className="rounded-xl border p-4">
        <p className="mb-2 text-xs text-muted-foreground">Zeitraum (Rechnungsdatum)</p>
        <div className="flex flex-wrap gap-1.5">
          {choice(range === 'month', () => setRange('month'), rangeOf('month', '', '').label)}
          {choice(range === 'lastMonth', () => setRange('lastMonth'), rangeOf('lastMonth', '', '').label)}
          {choice(range === 'quarter', () => setRange('quarter'), rangeOf('quarter', '', '').label)}
          {choice(range === 'year', () => setRange('year'), rangeOf('year', '', '').label)}
          {choice(range === 'custom', () => setRange('custom'), 'frei wählen')}
        </div>
        {range === 'custom' && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <Input type="date" className="h-9 w-44" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="von" />
            <span className="text-muted-foreground">bis</span>
            <Input type="date" className="h-9 w-44" value={to} onChange={(e) => setTo(e.target.value)} aria-label="bis" />
          </div>
        )}
      </div>
      <div className="rounded-xl border p-4">
        <p className="mb-2 text-xs text-muted-foreground">Format</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {choice(format === 'csv', () => setFormat('csv'), 'Liste (CSV, Excel)')}
          {choice(format === 'zip', () => setFormat('zip'), 'Alle PDFs (ZIP)')}
          <span className="ml-1 text-xs text-muted-foreground">DATEV folgt später</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {format === 'csv'
            ? 'Spalten: Belegnummer, Art, Rechnungsdatum, Leistungsdatum, Empfänger, USt-ID, Netto, USt-Satz, USt, Brutto, Fällig, Bezahlt am, Status, Bestellnummer, Kostenstelle, Stelle, Kandidat/in.'
            : 'Jede Rechnung als PDF, so wie sie verschickt wurde.'}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button disabled={busy} onClick={() => void download()}>{busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}Herunterladen</Button>
        <span className="text-sm text-muted-foreground">{rows.length === 1 ? '1 Beleg' : `${rows.length} Belege`} im Zeitraum</span>
      </div>
    </div>
  );
}
