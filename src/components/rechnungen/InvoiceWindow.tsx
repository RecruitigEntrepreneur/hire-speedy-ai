import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { BillingSettings, ClientInvoice } from '@/lib/billingApi';
import { clientTasksApi } from '@/lib/clientTasksApi';
import { placementApi } from '@/lib/placementApi';
import { dateDe, eurC, forLine, invoiceState, taxLine } from './invoiceView';

/**
 * Beleg-Fenster (Etappe 3, 25.10.2026; Umbau 11.11.2026, K10): Eckdaten, Empfänger,
 * Positionen, Zahlungen mit Rest, Bankhinweis (nur, wenn die Bankverbindung hinterlegt ist)
 * und Verlauf. Überweisung melden nur mit Verwaltungsrecht (HR liest nur).
 * E-Rechnung (XML) kommt später (Bauplan 1.13), deshalb kein Knopf.
 */

interface Props {
  invoice: ClientInvoice | null;
  settings: BillingSettings | null;
  financeOnly: boolean;
  /** Inhaber, Admin, Buchhaltung; HR sieht nur */
  canManage?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const todayIso = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });

export function InvoiceWindow({ invoice, settings, financeOnly, canManage = true, open, onOpenChange }: Props) {
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
  const state = invoiceState(i);
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
  const rest = i.open ? i.restCents : 0;
  const payments = i.payments.length ? i.payments : i.paidAt ? [{ date: i.paidAt.slice(0, 10), amountCents: i.paidCents || i.totalCents, source: 'manual' }] : [];

  let body: React.ReactNode;
  if (done) {
    body = (
      <>
        <div className="flex items-start gap-2 rounded-lg border p-3 text-sm">
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
          {fact('Bestellnummer', i.purchaseOrder ?? (i.poFollows ? 'folgt' : '–'))}
          {fact('Kostenstelle', i.costCenter ?? '–')}
        </div>
        {(i.correctsNumber || i.cancelledByNumber) && (
          <p className="text-sm text-muted-foreground">
            {i.correctsNumber ? `Bezieht sich auf Rechnung ${i.correctsNumber}.` : ''}{i.correctsNumber && i.cancelledByNumber ? ' ' : ''}{i.cancelledByNumber ? `Storniert durch ${i.cancelledByNumber}.` : ''}
          </p>
        )}
        <div className="rounded-lg border p-2.5 text-sm">
          <p className="text-xs text-muted-foreground">Empfänger</p>
          <p>{r.name ?? settings?.name ?? '–'}</p>
          <p className="text-xs text-muted-foreground">{[address || 'Anschrift fehlt auf diesem Beleg', r.vatId ? `USt-ID ${r.vatId}` : null].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="divide-y text-sm">
          <div className="flex justify-between gap-3 py-2">
            <div className="min-w-0"><p>{line?.title ?? 'Personalvermittlung'}</p>{details.map((d) => <p key={d} className="text-xs text-muted-foreground">{d}</p>)}</div>
            <span className="shrink-0 tabular-nums">{eurC(i.netCents)}</span>
          </div>
          <div className="flex justify-between gap-3 py-2">
            <span>{taxLine(i)}</span>
            <span className="shrink-0 tabular-nums">{eurC(i.vatCents)}</span>
          </div>
          <div className="flex justify-between gap-3 py-2 font-semibold"><span>Gesamt</span><span className="tabular-nums">{eurC(i.totalCents)}</span></div>
        </div>
        {payments.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Zahlungen</p>
            <div className="divide-y text-sm">
              {payments.map((p, n) => (
                <div key={n} className="flex justify-between gap-3 py-1.5">
                  <span>Überweisung eingegangen · {dateDe(p.date)}</span>
                  <span className="shrink-0 tabular-nums">− {eurC(p.amountCents)}</span>
                </div>
              ))}
              {i.open && <div className="flex justify-between gap-3 py-1.5 font-medium"><span>Noch offen</span><span className="tabular-nums">{eurC(rest)}</span></div>}
            </div>
          </div>
        )}
        {i.open && bank && (
          <div className="rounded-lg bg-muted/40 p-2.5 text-sm">
            <p>Bitte überweisen Sie {eurC(rest)} an {bank.holder} · Verwendungszweck <span className="font-medium">{i.number}</span></p>
            <p className="text-xs text-muted-foreground">IBAN {bank.iban}{bank.bic ? ` · BIC ${bank.bic}` : ''}</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {i.open && !i.reportedPaidOn && canManage && <Button size="sm" onClick={() => setForm('paid')}>Überwiesen melden</Button>}
          {i.hasPdf && <Button size="sm" variant="outline" onClick={() => void openPdf()}>PDF</Button>}
          <Button size="sm" variant="outline" onClick={() => setForm('frage')}>Frage zur Rechnung</Button>
          {!financeOnly && i.submissionId && <Button size="sm" variant="outline" onClick={() => { onOpenChange(false); navigate(`/dashboard/besetzungen?besetzung=${i.submissionId}`); }}>Zur Besetzung</Button>}
        </div>
        {i.events.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Verlauf</p>
            <ol className="divide-y text-sm">
              {i.events.map((e, n) => (
                <li key={n} className="flex justify-between gap-3 py-1.5"><span>{e.text}</span><span className="shrink-0 text-xs text-muted-foreground">{dateDe(e.at)}</span></li>
              ))}
            </ol>
          </div>
        )}
        <div className="flex justify-end border-t pt-3"><Button variant="ghost" onClick={() => onOpenChange(false)}>Schließen</Button></div>
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader className="text-left">
          <DialogTitle className="pr-6">
            Rechnung {i.number}
            <span className={cn('font-normal', state.tone === 'bad' ? 'text-destructive' : 'text-muted-foreground')}> · {state.text}</span>
          </DialogTitle>
          <DialogDescription>{forLine(i)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">{body}</div>
      </DialogContent>
    </Dialog>
  );
}
