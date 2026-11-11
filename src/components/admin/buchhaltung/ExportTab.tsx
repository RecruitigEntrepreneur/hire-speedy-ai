import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { zipStore } from '@/lib/zipStore';
import { buchhaltungApi, dateDe, downloadBlob, downloadText } from '@/lib/buchhaltungApi';
import { CheckList, ErrorLine, Loading, errText, useRefresh } from './ui';

/** A9 Export: Monat wählen, prüfen, herunterladen, festschreiben. */
export function ExportTab() {
  const refresh = useRefresh();
  const [period, setPeriod] = useState<string | undefined>(undefined);
  const q = useQuery({ queryKey: ['admin-buchhaltung', 'export', period], queryFn: () => buchhaltungApi.exportOverview(period), placeholderData: (prev) => prev });
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const d = q.data;
  if (q.isLoading && !d) return <Loading />;
  if (!d) return <ErrorLine error={q.error} />;

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (e) { toast.error(errText(e)); } finally { setBusy(null); }
  };
  const bookings = () => run('bookings', async () => {
    const r = await buchhaltungApi.exportBookings(d.period);
    if (!r.rows) { toast.message('In diesem Monat gibt es keine Buchung.'); return; }
    downloadText(r.csv, r.fileName);
  });
  const docs = () => run('docs', async () => {
    const r = await buchhaltungApi.exportDocuments(d.period);
    if (!r.files.length) { toast.message('In diesem Monat gibt es keinen Beleg.'); return; }
    const parts = await Promise.all(r.files.map(async (f) => {
      const res = await fetch(f.url);
      if (!res.ok) throw new Error(`${f.name} ließ sich nicht laden.`);
      return { name: f.name, bytes: new Uint8Array(await res.arrayBuffer()) };
    }));
    downloadBlob(zipStore(parts), r.fileName);
    if (r.missing.length) toast.error(`Ohne PDF: ${r.missing.join(', ')}`);
  });
  const open = () => run('open', async () => { const r = await buchhaltungApi.exportOpenItems(); downloadText(r.csv, r.fileName); });
  const lock = () => run('lock', async () => { await buchhaltungApi.lockPeriod(d.period); toast.success(`${d.label} ist festgeschrieben.`); setConfirm(false); refresh(); });

  const row = (label: string, sub: string, key: string, onClick: () => void, disabled = false) => (
    <div className="flex flex-wrap items-center gap-3 p-3 text-sm">
      <div className="min-w-0 flex-1"><p>{label}</p><p className="text-xs text-muted-foreground">{sub}</p></div>
      <Button size="sm" variant="outline" disabled={disabled || busy === key} onClick={onClick}>{busy === key && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Herunterladen</Button>
    </div>
  );
  const docsSub = [d.counts.invoices ? `${d.counts.invoices} ${d.counts.invoices === 1 ? 'Rechnung' : 'Rechnungen'}` : null, d.counts.cancellations ? `${d.counts.cancellations} ${d.counts.cancellations === 1 ? 'Storno' : 'Stornos'}` : null, d.counts.creditNotes ? `${d.counts.creditNotes} ${d.counts.creditNotes === 1 ? 'Gutschrift' : 'Gutschriften'}` : null].filter(Boolean).join(', ') || 'keine Belege';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={d.period} onValueChange={setPeriod}>
          <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
          <SelectContent>{d.months.map((m) => <SelectItem key={m.period} value={m.period}>{m.label}</SelectItem>)}</SelectContent>
        </Select>
        {q.isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {d.locked && <span className="text-sm text-muted-foreground">festgeschrieben am {dateDe(String(d.lockedAt).slice(0, 10))}</span>}
      </div>
      <CheckList checks={d.checks} />
      <div className="divide-y rounded-lg border">
        {row('Buchungsstapel für die Software des Steuerberaters*', `${d.counts.bookings} ${d.counts.bookings === 1 ? 'Buchung' : 'Buchungen'} · CSV`, 'bookings', bookings)}
        {row('Belege als ZIP', docsSub, 'docs', docs, d.counts.documents === 0)}
        {row('Offene Posten Kunden und Headhunter', 'Stand heute · CSV', 'open', open)}
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
        <p className="min-w-0 flex-1 text-muted-foreground">Nach dem Festschreiben ändert sich an {d.label} nichts mehr. Korrekturen laufen im neuen Monat.</p>
        <Button size="sm" disabled={!d.canLock || d.locked} title={d.lockWhy ?? undefined} onClick={() => setConfirm(true)}>{d.label.split(' ')[0]} festschreiben</Button>
      </div>
      {!d.canLock && !d.locked && d.lockWhy && <p className="text-xs text-muted-foreground">Festschreiben geht noch nicht: {d.lockWhy}.</p>}
      <p className="text-xs text-muted-foreground">* Allgemeines Format. Das DATEV-Format folgt nach Rücksprache mit dem Steuerberater.</p>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{d.label} festschreiben?</AlertDialogTitle>
            <AlertDialogDescription>Danach gibt es keine Buchung und keinen Beleg mit Datum in diesem Monat mehr. Das lässt sich nicht zurücknehmen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); lock(); }} disabled={busy === 'lock'}>Festschreiben</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
