import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { eurCents, type BillingSettings, type ClientInvoice } from '@/lib/billingApi';
import { clientTasksApi } from '@/lib/clientTasksApi';
import { placementApi } from '@/lib/placementApi';
import { InvoiceStatus, dateDe } from './InvoiceParts';

/**
 * Beleg-Fenster (Etappe 3, 25.10.2026): Eckdaten, Empfänger, Positionen, Zahlung und
 * Verlauf einer Rechnung. Überweisung melden und Frage zur Rechnung wie in Aufgabe 15.
 */

interface Props {
  invoice: ClientInvoice | null;
  settings: BillingSettings | null;
  financeOnly: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const todayIso = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });

export function InvoiceWindow({ invoice, settings, financeOnly, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<'paid' | 'frage' | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [question, setQuestion] = useState('');

  useEffect(() => { if (open) { setForm(null); setDone(null); setDate(todayIso()); setQuestion(''); } }, [open, invoice?.id]);
  if (!invoice) return null;
  const i = invoice;
  const line = i.lines[0];
  const details = (line?.details ?? []).filter((d) => !d.startsWith('Arbeitsvertrag geschlossen'));
  const run = async (work: () => Promise<string>) => {
    setBusy(true);
    try { setDone(await work()); queryClient.invalidateQueries({ queryKey: ['client-invoices'] }); queryClient.invalidateQueries({ queryKey: ['client-tasks'] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Das hat nicht geklappt.'); }
    finally { setBusy(false); }
  };
  const openPdf = async () => {
    try { const { url } = await placementApi.file(i.id); window.open(url, '_blank', 'noopener'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Das PDF ist gerade nicht abrufbar.'); }
  };
  const fact = (label: string, value: string) => (
    <div className="rounded-lg border p-2.5"><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm">{value}</p></div>
  );
  const r = i.recipient ?? {};
  const address = [r.street, r.city].filter(Boolean).join(' · ');
  const bank = settings?.bank;

  let body: React.ReactNode;
  if (done) {
    body = (
      <>
        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <div><p className="font-medium">Erledigt.</p><p className="text-muted-foreground">{done}</p></div>
        </div>
        <div className="flex justify-end gap-2 border-t pt-3">
          <Button variant="ghost" onClick={() => { setDone(null); setForm(null); }}>Zurück zum Beleg</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Schließen</Button>
        </div>
      </>
    );
  } else if (form === 'paid') {
    body = (
      <div className="space-y-3">
        <p className="text-sm font-medium">Überweisung melden</p>
        <label className="block text-sm"><span className="text-muted-foreground">Überwiesen am</span>
          <Input type="date" max={todayIso()} className="mt-1 h-9 w-48" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <p className="text-xs text-muted-foreground">Das ist ein Hinweis an Matchunt, kein Zahlungsnachweis. Bis Matchunt den Eingang bucht, steht hier „Zahlung wird geprüft“.</p>
        <div className="flex justify-end gap-2 border-t pt-3">
          <Button variant="ghost" onClick={() => setForm(null)}>Abbrechen</Button>
          <Button disabled={busy || !date} onClick={() => run(async () => { await clientTasksApi.invoicePaid(i.id, date); return 'Gemeldet. Matchunt prüft den Zahlungseingang.'; })}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Melden</Button>
        </div>
      </div>
    );
  } else if (form === 'frage') {
    body = (
      <div className="space-y-3">
        <p className="text-sm font-medium">Frage zur Rechnung</p>
        <Textarea rows={3} placeholder="z. B. Bestellnummer fehlt, Anschrift falsch …" value={question} onChange={(e) => setQuestion(e.target.value)} />
        <p className="text-xs text-muted-foreground">Matchunt antwortet per Mail. Ist eine Angabe falsch, stellt Matchunt eine Korrektur und storniert die alte Rechnung sichtbar.</p>
        <div className="flex justify-end gap-2 border-t pt-3">
          <Button variant="ghost" onClick={() => setForm(null)}>Abbrechen</Button>
          <Button disabled={busy || question.trim().length < 3} onClick={() => run(async () => { await clientTasksApi.invoiceQuestion(i.id, question.trim()); return 'Gesendet. Matchunt antwortet per Mail.'; })}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Senden</Button>
        </div>
      </div>
    );
  } else {
    body = (
      <>
        <div className="grid grid-cols-2 gap-2">
          {fact('Rechnungsdatum', dateDe(i.issuedAt))}
          {fact('Fällig', i.dueDate ? `${dateDe(i.dueDate)}${settings ? ` · ${settings.paymentTermsDays} Tage` : ''}` : '–')}
          {fact('Bestellnummer', i.purchaseOrder ?? '–')}
          {fact('Kostenstelle', i.costCenter ?? '–')}
        </div>
        <div className="rounded-lg border p-2.5 text-sm">
          <p className="text-xs text-muted-foreground">Empfänger</p>
          <p>{r.name ?? settings?.name ?? '–'}</p>
          <p className="text-xs text-muted-foreground">{[address || 'Anschrift fehlt auf diesem Beleg', r.vatId ? `USt-ID ${r.vatId}` : null].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="divide-y text-sm">
          <div className="flex justify-between gap-3 py-2">
            <div className="min-w-0"><p>{line?.title ?? 'Personalvermittlung'}</p>{details.map((d) => <p key={d} className="text-xs text-muted-foreground">{d}</p>)}</div>
            <span className="shrink-0 tabular-nums">{eurCents(i.netCents)}</span>
          </div>
          <div className="flex justify-between gap-3 py-2">
            <span>{i.reverseCharge ? 'Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge)' : `zzgl. ${i.vatRate ?? 19} % USt`}</span>
            <span className="shrink-0 tabular-nums">{eurCents(i.vatCents)}</span>
          </div>
          <div className="flex justify-between gap-3 py-2 font-semibold"><span>Gesamt</span><span className="tabular-nums">{eurCents(i.totalCents)}</span></div>
        </div>
        {i.open && (
          <div className="rounded-lg bg-muted/40 p-2.5 text-sm">
            <p>Zahlung an {bank?.holder || 'Bluewater & Bridge GmbH'} · Verwendungszweck <span className="font-medium">{i.number}</span></p>
            {bank ? <p className="text-xs text-muted-foreground">IBAN {bank.iban}{bank.bic ? ` · BIC ${bank.bic}` : ''}</p> : <p className="text-xs text-muted-foreground">Die Bankverbindung steht auf der Rechnung.</p>}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {i.open && !i.reportedPaidOn && <Button size="sm" onClick={() => setForm('paid')}>Überwiesen melden</Button>}
          {i.hasPdf && <Button size="sm" variant="outline" onClick={() => void openPdf()}>PDF</Button>}
          <Button size="sm" variant="outline" onClick={() => setForm('frage')}>Frage zur Rechnung</Button>
          {!financeOnly && i.submissionId && <Button size="sm" variant="outline" onClick={() => { onOpenChange(false); navigate(`/dashboard/besetzungen?besetzung=${i.submissionId}`); }}>Zur Besetzung</Button>}
        </div>
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Verlauf</p>
          <ol className="divide-y text-sm">
            <li className="flex justify-between gap-3 py-1.5"><span>Gestellt{i.sentTo ? ` und an ${i.sentTo} gesendet` : ''}</span><span className="shrink-0 text-xs text-muted-foreground">{dateDe(i.issuedAt)}</span></li>
            {i.reportedPaidOn && <li className="flex justify-between gap-3 py-1.5"><span>Überweisung gemeldet, Matchunt prüft</span><span className="shrink-0 text-xs text-muted-foreground">{dateDe(i.reportedPaidOn)}</span></li>}
            {i.paidAt && <li className="flex justify-between gap-3 py-1.5"><span>Zahlung eingegangen, gebucht von Matchunt</span><span className="shrink-0 text-xs text-muted-foreground">{dateDe(i.paidAt)}</span></li>}
          </ol>
        </div>
        <div className="flex justify-end border-t pt-3"><Button variant="ghost" onClick={() => onOpenChange(false)}>Schließen</Button></div>
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader className="text-left">
          <div className="flex flex-wrap items-center gap-2 pr-6">
            <DialogTitle>Rechnung {i.number}</DialogTitle>
            <InvoiceStatus invoice={i} />
          </div>
          <DialogDescription>{[i.candidateName, i.jobTitle].filter(Boolean).join(' · ') || 'Personalvermittlung'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">{body}</div>
      </DialogContent>
    </Dialog>
  );
}
