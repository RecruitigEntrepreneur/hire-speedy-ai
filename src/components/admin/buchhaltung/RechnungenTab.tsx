import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { buchhaltungApi, dateShort, eur, openPdf, type InvoiceItem } from '@/lib/buchhaltungApi';
import { Empty, errText, useRefresh } from './ui';

export type RechnungAction =
  | { kind: 'review' | 'dunning'; invoice: InvoiceItem }
  | { kind: 'cancel' | 'correct'; invoice: InvoiceItem }
  | { kind: 'manual'; invoice: InvoiceItem };

const OPEN = ['open', 'partially_paid', 'pending', 'overdue'];

function stand(i: InvoiceItem): { main: string; sub: string | null; warn: boolean } {
  if (i.type === 'cancellation') return { main: `Storno zu ${i.correctsNumber ?? '–'}`, sub: i.cancelReason, warn: false };
  if (i.status === 'draft') {
    const left = i.workdaysLeft;
    return { main: i.releaseBy ? `freigeben bis ${dateShort(i.releaseBy)}` : 'Entwurf', sub: left == null ? null : left >= 0 ? `noch ${left} ${left === 1 ? 'Werktag' : 'Werktage'}` : `${-left} ${left === -1 ? 'Werktag' : 'Werktage'} drüber`, warn: left != null && left < 0 };
  }
  if (i.status === 'cancelled') return { main: 'storniert', sub: i.cancelledByNumber ? `durch ${i.cancelledByNumber}` : null, warn: false };
  if (i.status === 'paid') return { main: i.paidAt ? `bezahlt ${dateShort(i.paidAt)}` : 'bezahlt', sub: i.correctsNumber ? `ersetzt ${i.correctsNumber}` : null, warn: false };
  if (OPEN.includes(i.status)) {
    const subs = [
      i.lastDunning ? `${i.lastDunning.level === 3 ? 'Inkasso/Anwalt vermerkt' : `${i.lastDunning.level}. Mahnung ${dateShort(i.lastDunning.sentAt)}${i.lastDunning.payUntil ? `, Frist ${dateShort(i.lastDunning.payUntil)}` : ''}`}` : i.reminderSentAt ? `Erinnerung ${dateShort(i.reminderSentAt)} gesendet` : null,
      i.poFollows ? 'Best.-Nr. folgt' : null,
      i.reportedPaidOn ? `Kunde meldet Überweisung ${dateShort(i.reportedPaidOn)}` : null,
      i.correctsNumber ? `ersetzt ${i.correctsNumber}` : null,
    ].filter(Boolean);
    return { main: i.overdue ? `überfällig seit ${dateShort(i.dueDate)}` : `fällig ${dateShort(i.dueDate)}`, sub: subs.join(' · ') || null, warn: i.overdue };
  }
  return { main: i.status, sub: null, warn: false };
}

/** A2 Rechnungen: Liste mit Stand, Prüfen/Mahnen und Menü ⋯ (PDF, Mail erneut, Korrigieren, Stornieren, Zahlung von Hand). */
export function RechnungenTab({ invoices, onAction }: { invoices: InvoiceItem[]; onAction: (a: RechnungAction) => void }) {
  const refresh = useRefresh();
  const [search, setSearch] = useState('');
  const list = useMemo(() => {
    const s = search.trim().toLowerCase();
    return s ? invoices.filter((i) => [i.number, i.recipient, i.candidateName].some((x) => String(x ?? '').toLowerCase().includes(s))) : invoices;
  }, [invoices, search]);
  if (!invoices.length) return <Empty>Noch keine Rechnung.</Empty>;
  const resend = async (i: InvoiceItem) => {
    try { const r = await buchhaltungApi.resend(i.id); toast.success(`Noch einmal an ${r.sentTo.join(', ')} geschickt.`); refresh(); } catch (e) { toast.error(errText(e)); }
  };
  const pdf = async (i: InvoiceItem) => { try { await openPdf(() => buchhaltungApi.invoicePdf(i.id)); } catch (e) { toast.error(errText(e)); } };
  return (
    <div className="space-y-3">
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nummer, Kunde oder Name" className="h-9 max-w-xs" />
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr><th className="p-2">Nummer</th><th className="p-2">Für</th><th className="p-2 text-right">Betrag</th><th className="p-2">Stand</th><th className="p-2" /></tr>
          </thead>
          <tbody className="divide-y">
            {list.map((i) => {
              const st = stand(i);
              const isOpen = OPEN.includes(i.status) && i.type !== 'cancellation';
              const issued = i.status !== 'draft';
              const correctable = issued && i.type !== 'cancellation' && i.status !== 'cancelled';
              return (
                <tr key={i.id} className="align-top">
                  <td className="p-2 font-medium">{i.number ?? 'Entwurf'}</td>
                  <td className="p-2"><p>{i.candidateName ?? '–'}</p><p className="text-xs text-muted-foreground">{i.recipient ?? ''}</p></td>
                  <td className="p-2 text-right tabular-nums">
                    {isOpen && i.paidCents > 0 ? <><p>{eur(i.openCents)}</p><p className="text-xs text-muted-foreground">von {eur(i.totalCents)}</p></> : eur(i.totalCents)}
                  </td>
                  <td className="p-2"><p className={cn(st.warn && 'text-destructive')}>{st.main}</p>{st.sub && <p className="text-xs text-muted-foreground">{st.sub}</p>}</td>
                  <td className="p-2">
                    <div className="flex justify-end gap-1">
                      {i.status === 'draft' && <Button size="sm" onClick={() => onAction({ kind: 'review', invoice: i })}>Prüfen</Button>}
                      {isOpen && i.overdue && i.dunningAllowed && <Button size="sm" variant="outline" onClick={() => onAction({ kind: 'dunning', invoice: i })}>Mahnen</Button>}
                      {i.status !== 'draft' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Mehr"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem disabled={!i.hasPdf} onClick={() => pdf(i)}>PDF</DropdownMenuItem>
                            <DropdownMenuItem disabled={!i.hasPdf} onClick={() => resend(i)}>Mail erneut senden</DropdownMenuItem>
                            {correctable && <DropdownMenuSeparator />}
                            {correctable && <DropdownMenuItem onClick={() => onAction({ kind: 'correct', invoice: i })}>Korrigieren</DropdownMenuItem>}
                            {correctable && <DropdownMenuItem disabled={i.paidCents > 0} onClick={() => onAction({ kind: 'cancel', invoice: i })}>Stornieren</DropdownMenuItem>}
                            {isOpen && i.overdue && !i.dunningAllowed && <DropdownMenuItem onClick={() => onAction({ kind: 'dunning', invoice: i })}>Mahnstand ansehen</DropdownMenuItem>}
                            {isOpen && <DropdownMenuSeparator />}
                            {isOpen && <DropdownMenuItem onClick={() => onAction({ kind: 'manual', invoice: i })}>Zahlung von Hand</DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Zahlungen kommen über den Kontoauszug (Reiter Zahlungen). „Zahlung von Hand“ im Menü ⋯ ist nur der Notweg.</p>
    </div>
  );
}
