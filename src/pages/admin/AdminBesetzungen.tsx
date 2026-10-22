import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, TriangleAlert } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { INVOICE_STATUS, PACKAGE_SHORT, eurCents, pdfBlobUrl, placementApi, type InvoiceRow } from '@/lib/placementApi';

const dateDe = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–');
const todayIso = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });

/** Admin › Besetzungen (Paket 4a): je Einstellung genau ein nächster Schritt; Rechnungen prüfen, freigeben, Zahlung buchen. */
export default function AdminBesetzungen() {
  const q = useQuery({ queryKey: ['admin-besetzungen'], queryFn: () => placementApi.overview() });
  const [review, setReview] = useState<InvoiceRow | null>(null);
  const [payment, setPayment] = useState<InvoiceRow | null>(null);
  const d = q.data;
  const invoiceById = new Map((d?.invoices ?? []).map((i) => [i.id, i]));
  const act = (invoiceId: string | undefined, key: string) => {
    const inv = invoiceId ? invoiceById.get(invoiceId) : undefined;
    if (!inv) return;
    if (key === 'release') setReview(inv);
    if (key === 'payment') setPayment(inv);
  };
  const openPdf = async (id: string) => {
    try { const { url } = await placementApi.file(id); window.open(url, '_blank', 'noopener'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'PDF nicht abrufbar.'); }
  };

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
            <TriangleAlert className="h-4 w-4 shrink-0" />Rechnungen können noch nicht freigegeben werden. Es fehlt: {d.blockers.join(', ')} (in billing-config eintragen).
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          {[['Rechnungen offen', eurCents(d?.kpis.openCents ?? 0)], ['Überfällig', eurCents(d?.kpis.overdueCents ?? 0)], ['Entwürfe zur Freigabe', String(d?.kpis.drafts ?? 0)]].map(([k, v]) => (
            <div key={k} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{k}</p><p className="text-lg font-semibold tabular-nums">{v}</p></div>
          ))}
        </div>

        {q.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : q.error ? (
          <p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : 'Konnte nicht geladen werden.'}</p>
        ) : (
          <Tabs defaultValue="fahrplan">
            <TabsList>
              <TabsTrigger value="fahrplan">Fahrplan</TabsTrigger>
              <TabsTrigger value="rechnungen">Rechnungen</TabsTrigger>
            </TabsList>
            <TabsContent value="fahrplan">
              {(d?.rows ?? []).length === 0 ? <p className="rounded-lg border p-6 text-sm text-muted-foreground">Noch keine Einstellung.</p> : (
                <div className="divide-y rounded-lg border">
                  {d!.rows.map((r) => (
                    <div key={r.placementId} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{r.candidateName} · {r.companyName}</p>
                        <p className="text-xs text-muted-foreground">{r.jobTitle} · {r.recruiterName ?? '–'} · {PACKAGE_SHORT[r.packageKey ?? ''] ?? '–'} · Start {dateDe(r.startDate)}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">Kunde {eurCents(r.clientFeeCents)} · Headhunter {eurCents(r.recruiterInitialCents)}{r.recruiterRetentionCents ? ` + ${eurCents(r.recruiterRetentionCents)}` : ''} · Matchunt {eurCents(r.matchuntCents)}</p>
                      </div>
                      <span className="text-muted-foreground">{r.invoice ? `Rechnung ${INVOICE_STATUS[r.invoice.status] ?? r.invoice.status}${r.invoice.dueDate && r.invoice.status !== 'draft' ? ` bis ${dateDe(r.invoice.dueDate)}` : ''}` : 'ohne Rechnung'}</span>
                      {['release', 'payment'].includes(r.next.key)
                        ? <Button size="sm" variant={r.invoice?.overdue ? 'destructive' : 'default'} onClick={() => act(r.invoice?.id, r.next.key)}>{r.next.label}</Button>
                        : <span className="text-xs text-muted-foreground">{r.next.label}</span>}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="rechnungen">
              {(d?.invoices ?? []).length === 0 ? <p className="rounded-lg border p-6 text-sm text-muted-foreground">Noch keine Rechnung.</p> : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                      <tr><th className="p-2">Nummer</th><th className="p-2">Empfänger</th><th className="p-2">Datum</th><th className="p-2 text-right">Betrag</th><th className="p-2">fällig</th><th className="p-2">Stand</th><th className="p-2" /></tr>
                    </thead>
                    <tbody className="divide-y">
                      {d!.invoices.map((i) => (
                        <tr key={i.id}>
                          <td className="p-2 font-medium">{i.number ?? 'Entwurf'}</td>
                          <td className="p-2">{i.recipient ?? '–'}</td>
                          <td className="p-2">{dateDe(i.issuedAt)}</td>
                          <td className="p-2 text-right tabular-nums">{eurCents(i.totalCents)}</td>
                          <td className="p-2">{i.status === 'draft' ? '–' : dateDe(i.dueDate)}</td>
                          <td className="p-2"><Badge variant={i.status === 'paid' ? 'secondary' : i.overdue ? 'destructive' : 'outline'}>{i.overdue ? 'überfällig' : INVOICE_STATUS[i.status] ?? i.status}</Badge></td>
                          <td className="p-2 text-right">
                            {i.status === 'draft' && <Button size="sm" onClick={() => setReview(i)}>Prüfen</Button>}
                            {['open', 'partially_paid', 'pending'].includes(i.status) && <Button size="sm" variant="outline" onClick={() => setPayment(i)}>Zahlung eingegangen</Button>}
                            {i.hasPdf && <Button size="sm" variant="ghost" onClick={() => openPdf(i.id)}>PDF</Button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
      <ReviewDialog invoice={review} blockers={d?.blockers ?? []} onClose={() => setReview(null)} />
      <PaymentDialog invoice={payment} onClose={() => setPayment(null)} />
    </DashboardLayout>
  );
}

function ReviewDialog({ invoice, blockers, onClose }: { invoice: InvoiceRow | null; blockers: string[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<string[]>(blockers);
  useEffect(() => {
    setUrl(null);
    setBlocked(blockers);
    if (!invoice) return;
    setEmail(invoice.email ?? '');
    let revoked: string | null = null;
    placementApi.preview(invoice.id).then((r) => { revoked = pdfBlobUrl(r.pdfBase64); setUrl(revoked); setBlocked(r.blockers); }).catch((e) => toast.error(e instanceof Error ? e.message : 'Vorschau nicht möglich.'));
    return () => { if (revoked) URL.revokeObjectURL(revoked); };
  }, [invoice?.id]);
  const release = async () => {
    if (!invoice) return;
    setBusy(true);
    try {
      const r = await placementApi.release(invoice.id, email.trim());
      toast.success(r.sent ? `Rechnung ${r.number} gestellt und an ${email.trim()} geschickt.` : `Rechnung ${r.number} gestellt. Mail nicht verschickt: ${r.mailError ?? 'unbekannt'}`);
      queryClient.invalidateQueries({ queryKey: ['admin-besetzungen'] });
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Das hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={!!invoice} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader className="text-left">
          <DialogTitle>Rechnung prüfen · {invoice?.recipient}</DialogTitle>
          <DialogDescription>{eurCents(invoice?.totalCents)} brutto. Mit der Freigabe bekommt sie die feste Nummer, das PDF wird abgelegt und an die Rechnungs-E-Mail geschickt.</DialogDescription>
        </DialogHeader>
        <div className="h-[58vh] overflow-hidden rounded-lg border bg-muted/30">
          {url ? <iframe title="Rechnung" src={url} className="h-full w-full" /> : <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
        </div>
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Rechnungs-E-Mail</span>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} className="h-8 min-w-[18rem] flex-1" />
        </label>
        {blocked.length > 0 && <p className="text-xs text-amber-700 dark:text-amber-400">Freigabe gesperrt, es fehlt: {blocked.join(', ')}.</p>}
        <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button disabled={busy || blocked.length > 0 || !/\S+@\S+\.\S+/.test(email)} onClick={release}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Freigeben und senden</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({ invoice, onClose }: { invoice: InvoiceRow | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [paidOn, setPaidOn] = useState(todayIso());
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const open = invoice ? invoice.totalCents - (invoice.paidCents ?? 0) : 0;
  useEffect(() => {
    if (!invoice) return;
    setPaidOn(todayIso());
    setAmount(new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2 }).format(open / 100));
    setNote('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.id]);
  const cents = Math.round(Number(amount.replace(/\./g, '').replace(',', '.')) * 100);
  const save = async () => {
    if (!invoice) return;
    setBusy(true);
    try {
      const r = await placementApi.bookPayment(invoice.id, paidOn, cents, note);
      toast.success(r.status === 'paid' ? 'Als bezahlt gebucht.' : 'Teilzahlung gebucht; die Rechnung bleibt offen.');
      queryClient.invalidateQueries({ queryKey: ['admin-besetzungen'] });
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Das hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={!!invoice} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle>Zahlung eingegangen</DialogTitle>
          <DialogDescription>Rechnung {invoice?.number} · {invoice?.recipient} · offen {eurCents(open)}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <label className="block"><span className="text-muted-foreground">Eingegangen am</span><Input type="date" value={paidOn} max={todayIso()} onChange={(e) => setPaidOn(e.target.value)} className="mt-1 h-9" /></label>
          <label className="block"><span className="text-muted-foreground">Betrag laut Konto (€)</span><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 h-9" /></label>
        </div>
        <label className="block text-sm"><span className="text-muted-foreground">Notiz (optional)</span><Input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 h-9" /></label>
        <p className={cn('text-xs text-muted-foreground', cents < open && cents > 0 && 'text-amber-700 dark:text-amber-400')}>{cents > 0 && cents < open ? 'Weicht der Betrag ab, bleibt die Rechnung „teilweise bezahlt“.' : 'Mit der vollen Zahlung wird Tranche 1 des Headhunters fällig, sobald die Person angetreten ist.'}</p>
        <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button disabled={busy || !(cents > 0) || !paidOn} onClick={save}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Buchen</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
