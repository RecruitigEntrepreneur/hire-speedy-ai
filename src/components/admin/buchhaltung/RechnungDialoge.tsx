import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  base64Url, buchhaltungApi, dateShort, eur, euroInput, parseEuro, todayIso, type CorrectionChanges, type InvoiceItem,
} from '@/lib/buchhaltungApi';
import { CheckList, Loading, errText, useRefresh } from './ui';

// ---------------------------------------------------------------------------
// A3 Rechnung prüfen
// ---------------------------------------------------------------------------

export function PruefDialog({ invoiceId, onClose }: { invoiceId: string | null; onClose: () => void }) {
  const refresh = useRefresh();
  const q = useQuery({ queryKey: ['admin-buchhaltung', 'check', invoiceId], queryFn: () => buchhaltungApi.invoiceCheck(invoiceId!), enabled: !!invoiceId, retry: false, staleTime: 0 });
  const [email, setEmail] = useState('');
  const [poFollows, setPoFollows] = useState(true);
  const [busy, setBusy] = useState(false);
  const d = q.data;
  const url = useMemo(() => (d?.pdfBase64 ? base64Url(d.pdfBase64) : null), [d?.pdfBase64]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => { if (d) { setEmail(d.email ?? ''); setPoFollows(true); } }, [d?.invoice.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const release = async () => {
    if (!d) return;
    setBusy(true);
    try {
      const r = await buchhaltungApi.release(d.invoice.id, email.trim(), d.poFollowsPossible ? poFollows : false);
      toast.success(r.sent ? `Rechnung ${r.number} gestellt und verschickt.` : `Rechnung ${r.number} gestellt. Mail nicht verschickt: ${r.mailError ?? 'unbekannt'}`);
      refresh();
      onClose();
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };
  const blocked = !d?.canRelease || (d.poFollowsPossible && !poFollows) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  return (
    <Dialog open={!!invoiceId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader className="text-left">
          <DialogTitle>Rechnung prüfen{d ? ` · ${d.invoice.company}` : ''}</DialogTitle>
          <DialogDescription>{d ? [`${eur(d.invoice.totalCents)} brutto`, d.invoice.candidateName, d.invoice.jobTitle].filter(Boolean).join(' · ') : 'Lädt …'}</DialogDescription>
        </DialogHeader>
        {q.isLoading ? <Loading /> : q.error ? <p className="text-sm text-destructive">{errText(q.error)}</p> : d && (
          <div className="grid gap-4 md:grid-cols-[1fr_20rem]">
            <div className="h-[60vh] overflow-hidden rounded-lg border bg-muted/30">
              {url ? <iframe title="PDF-Vorschau" src={url} className="h-full w-full" /> : null}
            </div>
            <div className="space-y-4">
              <CheckList checks={d.checks} />
              {d.poFollowsPossible && (
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox checked={poFollows} onCheckedChange={(v) => setPoFollows(v === true)} className="mt-0.5" />
                  <span>Mit Vermerk „Bestellnummer folgt“ freigeben</span>
                </label>
              )}
              <label className="block text-sm">
                <span className="text-muted-foreground">Rechnungs-E-Mail</span>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-9" />
                {d.cc.length > 0 && <span className="mt-1 block text-xs text-muted-foreground">plus {d.cc.length} {d.cc.length === 1 ? 'Kopie' : 'Kopien'}: {d.cc.join(', ')}</span>}
              </label>
              {!d.canRelease && <p className="text-xs text-muted-foreground">Ein Kreuz sperrt die Freigabe. Erst ergänzen, dann freigeben.</p>}
            </div>
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button disabled={busy || !d || blocked} onClick={release}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Freigeben und senden</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// A4 Mahnen
// ---------------------------------------------------------------------------

export function MahnDialog({ invoiceId, recruiterFirst, onClose }: { invoiceId: string | null; recruiterFirst?: string | null; onClose: () => void }) {
  const refresh = useRefresh();
  const [level, setLevel] = useState<number | undefined>(undefined);
  const [base, setBase] = useState('');
  const [baseQuery, setBaseQuery] = useState<string | undefined>(undefined);
  const [attach, setAttach] = useState(true);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setLevel(undefined); setBase(''); setBaseQuery(undefined); setAttach(true); setNote(''); }, [invoiceId]);
  useEffect(() => { const t = setTimeout(() => setBaseQuery(base.trim() || undefined), 400); return () => clearTimeout(t); }, [base]);
  const q = useQuery({
    queryKey: ['admin-buchhaltung', 'dunning', invoiceId, level, baseQuery],
    queryFn: () => buchhaltungApi.dunningPreview(invoiceId!, level, baseQuery),
    enabled: !!invoiceId, retry: false, placeholderData: (prev) => prev,
  });
  const d = q.data;
  useEffect(() => {
    if (!d) return;
    if (level === undefined) setLevel(d.level);
    if (!base && d.basePctFromConfig != null) setBase(String(d.basePctFromConfig).replace('.', ','));
  }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = d?.options.find((o) => o.level === (level ?? d?.level));
  const send = async () => {
    if (!d || !current) return;
    setBusy(true);
    try {
      const r = await buchhaltungApi.dunningSend(d.invoice.id, current.level, base.trim() || undefined, attach, note);
      toast.success(current.level === 3 ? 'Vermerkt: Inkasso oder Anwalt.' : `${current.level}. Mahnung an ${(r.sentTo ?? []).join(', ')} geschickt.`);
      refresh();
      onClose();
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };
  const sel = level ?? d?.level;
  return (
    <Dialog open={!!invoiceId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="text-left">
          <DialogTitle>Mahnen{d ? ` · ${d.invoice.number}` : ''}</DialogTitle>
          <DialogDescription>
            {d ? [d.invoice.recipient, `${eur(d.invoice.openCents)} offen seit ${dateShort(d.invoice.dueDate)}`, d.invoice.reminderSentAt ? `Erinnerung am ${dateShort(d.invoice.reminderSentAt)} gesendet` : 'noch keine Erinnerung'].filter(Boolean).join(' · ') : 'Lädt …'}
          </DialogDescription>
        </DialogHeader>
        {!d && q.isLoading ? <Loading /> : q.error && !d ? <p className="text-sm text-destructive">{errText(q.error)}</p> : d && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-1.5">
              {d.options.map((o) => (
                <Button key={o.level} size="sm" variant={sel === o.level ? 'default' : 'outline'} disabled={!o.allowed && sel !== o.level} title={o.why ?? undefined} onClick={() => setLevel(o.level)}>{o.label}</Button>
              ))}
            </div>
            {current && !current.allowed && current.why && <p className="text-xs text-muted-foreground">{current.why}</p>}
            {sel === 2 && (
              <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
                <label className="block"><span className="text-muted-foreground">Basiszinssatz in % (Bundesbank)</span>
                  <Input value={base} onChange={(e) => setBase(e.target.value)} placeholder="z. B. 2,27" inputMode="decimal" className="mt-1 h-9" />
                </label>
                <div className="text-xs text-muted-foreground sm:pt-6">
                  {d.amounts.ratePct != null ? <>Verzugszinsen {String(d.amounts.ratePct).replace('.', ',')} % p. a. für {d.amounts.interestDays} Tage: <span className="text-foreground">{eur(d.amounts.interestCents)}</span> · Pauschale {eur(d.amounts.feeCents)} · gesamt <span className="text-foreground">{eur(d.amounts.totalCents)}</span></> : 'Basiszinssatz eintragen, dann rechnet die App die Zinsen tagesgenau.'}
                </div>
              </div>
            )}
            {sel === 3 ? (
              <label className="block"><span className="text-muted-foreground">Vermerk (z. B. an welches Inkasso oder welchen Anwalt)</span>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="mt-1" />
                <span className="mt-1 block text-xs text-muted-foreground">Es geht nichts an den Kunden raus. Die App legt nur den Vermerk an.</span>
              </label>
            ) : d.preview && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="mb-2 text-xs text-muted-foreground">Vorschau · an {d.recipients.to ?? '–'}{d.recipients.cc.length ? ` und ${d.recipients.cc.length} ${d.recipients.cc.length === 1 ? 'Kopie' : 'Kopien'}` : ''}</p>
                <p className="font-medium">{d.preview.subject}</p>
                <p className="mt-2 whitespace-pre-line text-muted-foreground">{d.preview.text}</p>
              </div>
            )}
            {sel !== 3 && (
              <label className="flex items-center gap-2"><Checkbox checked={attach} onCheckedChange={(v) => setAttach(v === true)} />Mahnung als PDF anhängen</label>
            )}
            <p className="text-xs text-muted-foreground">{recruiterFirst ?? 'Der Headhunter'} sieht in seinem Fahrplan „Mahnstufe {sel}“ (Headhunter-Vertrag § 10 Abs. 3).</p>
            {d.history.filter((h) => h.level > 0).length > 0 && (
              <p className="text-xs text-muted-foreground">Bisher: {d.history.filter((h) => h.level > 0).map((h) => `${h.level === 3 ? 'Inkasso/Anwalt' : `${h.level}. Mahnung`} ${dateShort(h.sentAt)}${h.payUntil ? `, Frist ${dateShort(h.payUntil)}` : ''}`).join(' · ')}</p>
            )}
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button disabled={busy || !current?.allowed || (sel === 2 && !base.trim())} onClick={send}>
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{sel === 3 ? 'Vermerk anlegen' : 'Mahnung senden'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// A5 Stornieren oder korrigieren
// ---------------------------------------------------------------------------

const REASONS = ['Bestellnummer nachgereicht', 'Falsche Anschrift', 'Anderes Gehalt laut Vertrag'];

export function StornoDialog({ target, onClose }: { target: { invoiceId: string; mode: 'cancel' | 'correct' } | null; onClose: () => void }) {
  const refresh = useRefresh();
  const q = useQuery({ queryKey: ['admin-buchhaltung', 'correction', target?.invoiceId], queryFn: () => buchhaltungApi.correctionPreview(target!.invoiceId), enabled: !!target, retry: false, staleTime: 0 });
  const [mode, setMode] = useState<'cancel' | 'correct'>('correct');
  const [reason, setReason] = useState('');
  const [redraft, setRedraft] = useState(true);
  const [f, setF] = useState({ purchaseOrder: '', costCenter: '', name: '', street: '', city: '', country: '', vatId: '', gross: '' });
  const [busy, setBusy] = useState(false);
  const d = q.data;
  useEffect(() => { if (target) { setMode(target.mode); setReason(''); setRedraft(true); } }, [target?.invoiceId, target?.mode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!d) return;
    const r = d.invoice.recipient;
    setF({ purchaseOrder: d.invoice.purchaseOrder ?? '', costCenter: d.invoice.costCenter ?? '', name: r.name, street: r.street, city: r.city, country: r.country, vatId: r.vatId, gross: d.invoice.grossCents ? euroInput(d.invoice.grossCents) : '' });
  }, [d?.invoice.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const changes = (): CorrectionChanges => {
    if (!d) return {};
    const c: CorrectionChanges = {};
    const r = d.invoice.recipient;
    if (f.purchaseOrder !== (d.invoice.purchaseOrder ?? '')) c.purchaseOrder = f.purchaseOrder;
    if (f.costCenter !== (d.invoice.costCenter ?? '')) c.costCenter = f.costCenter;
    if (f.name !== r.name) c.name = f.name;
    if (f.street !== r.street) c.street = f.street;
    if (f.city !== r.city) c.city = f.city;
    if (f.country.toUpperCase() !== (r.country ?? '').toUpperCase()) c.country = f.country;
    if (f.vatId !== r.vatId) c.vatId = f.vatId;
    const g = parseEuro(f.gross);
    if (d.salaryChangeable && Number.isFinite(g) && g > 0 && g !== d.invoice.grossCents) c.grossCents = g;
    return c;
  };
  const ch = changes();
  const newNet = d && ch.grossCents && d.invoice.clientFeePct ? Math.round(ch.grossCents * d.invoice.clientFeePct / 100) : d?.invoice.netCents ?? 0;
  const blockers = d ? [...d.blockers.cancellation, ...(mode === 'correct' ? d.blockers.invoice : [])] : [];
  const save = async () => {
    if (!d) return;
    setBusy(true);
    try {
      const r = await buchhaltungApi.correct(d.invoice.id, mode, reason.trim(), mode === 'correct' ? ch : {}, redraft);
      toast.success(r.mode === 'correct' ? `Storno ${r.stornoNumber} und neue Rechnung ${r.newNumber} erstellt${r.sentTo.length ? ' und verschickt' : ''}.` : `Stornorechnung ${r.stornoNumber} erstellt${r.draftId ? ', neuer Entwurf liegt bei den Rechnungen' : ''}.`);
      refresh();
      onClose();
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };
  const field = (key: keyof typeof f, label: string, cls = '') => (
    <label className={cn('block text-sm', cls)}><span className="text-muted-foreground">{label}</span><Input value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} className="mt-1 h-9" /></label>
  );
  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="text-left">
          <DialogTitle>Rechnung {d?.invoice.number ?? ''}{d?.invoice.candidateName ? ` · ${d.invoice.candidateName}` : ''}</DialogTitle>
          <DialogDescription>{d ? [d.invoice.company, eur(d.invoice.totalCents), d.invoice.paidCents ? `${eur(d.invoice.paidCents)} bezahlt` : 'noch nicht bezahlt'].filter(Boolean).join(' · ') : 'Lädt …'}</DialogDescription>
        </DialogHeader>
        {q.isLoading ? <Loading /> : q.error ? <p className="text-sm text-destructive">{errText(q.error)}</p> : d && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant={mode === 'cancel' ? 'default' : 'outline'} disabled={!d.canCancelOnly} title={!d.canCancelOnly ? 'Schon (teilweise) bezahlt: bitte korrigieren' : undefined} onClick={() => setMode('cancel')}>Stornieren</Button>
              <Button size="sm" variant={mode === 'correct' ? 'default' : 'outline'} onClick={() => setMode('correct')}>Korrigieren (neue Rechnung)</Button>
            </div>
            <label className="block">
              <span className="text-muted-foreground">Grund (Pflicht, steht auf dem Beleg)</span>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className="mt-1 h-9" />
              <span className="mt-1.5 flex flex-wrap gap-1">{REASONS.map((r) => <Button key={r} type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setReason(r)}>{r}</Button>)}</span>
            </label>
            {mode === 'correct' && (
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Was ändert sich? Nur geänderte Felder kommen auf die neue Rechnung.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {field('purchaseOrder', 'Bestellnummer')}
                  {field('costCenter', 'Kostenstelle')}
                  {field('name', 'Firma', 'sm:col-span-2')}
                  {field('street', 'Straße')}
                  {field('city', 'PLZ und Ort')}
                  {field('country', 'Land (z. B. DE, AT, CH)')}
                  {field('vatId', 'USt-IdNr.')}
                  {d.salaryChangeable ? field('gross', 'Bruttojahreszielgehalt laut Vertrag (€)', 'sm:col-span-2') : d.salaryLockedWhy ? <p className="text-xs text-muted-foreground sm:col-span-2">Gehalt: {d.salaryLockedWhy}</p> : null}
                </div>
              </div>
            )}
            {mode === 'cancel' && (
              <label className="flex items-center gap-2"><Checkbox checked={redraft} onCheckedChange={(v) => setRedraft(v === true)} />Danach als Entwurf neu anlegen (geht wieder durch „Prüfen“)</label>
            )}
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="mb-1.5 text-xs text-muted-foreground">Was passiert</p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>Stornorechnung {d.sampleNumbers.cancellation ?? '(Nummer folgt)'} über {eur(-d.invoice.totalCents)} mit Bezug auf {d.invoice.number}</li>
                {mode === 'correct'
                  ? <li>Neue Rechnung {d.sampleNumbers.invoice ?? '(Nummer folgt)'} über {eur(Math.round(newNet * (d.invoice.totalCents / Math.max(1, d.invoice.netCents))))}{ch.purchaseOrder ? ' mit Bestellnummer' : ''}{d.invoice.dueDate ? `, fällig weiter am ${dateShort(d.invoice.dueDate)}` : ''}{d.invoice.paidCents ? `, Zahlung über ${eur(d.invoice.paidCents)} angerechnet` : ''}</li>
                  : redraft ? <li>Ein neuer Entwurf liegt danach bei den Rechnungen</li> : null}
                <li>{d.invoice.company ?? 'Der Kunde'} bekommt {mode === 'correct' ? 'beide' : 'den Beleg'} per Mail.{ch.grossCents ? ' Der Anteil des Headhunters wird neu berechnet.' : ' Für den Headhunter ändert sich nichts.'}</li>
              </ol>
            </div>
            <p className="text-xs text-muted-foreground">Den alten Beleg ändert niemand, so verlangen es die GoBD.</p>
            {blockers.length > 0 && <p className="text-xs text-destructive">Gesperrt, es fehlt: {[...new Set(blockers)].join(', ')}.</p>}
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button disabled={busy || !d || reason.trim().length < 3 || blockers.length > 0 || (mode === 'cancel' && !d.canCancelOnly)} onClick={save}>
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{mode === 'correct' ? 'Korrigieren und senden' : 'Stornieren und senden'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Notweg: Zahlung von Hand
// ---------------------------------------------------------------------------

export function ZahlungVonHandDialog({ invoice, onClose }: { invoice: InvoiceItem | null; onClose: () => void }) {
  const refresh = useRefresh();
  const [paidOn, setPaidOn] = useState(todayIso());
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const open = invoice?.openCents ?? 0;
  useEffect(() => { if (invoice) { setPaidOn(todayIso()); setAmount(euroInput(invoice.openCents)); setNote(''); } }, [invoice?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const cents = parseEuro(amount);
  const save = async () => {
    if (!invoice) return;
    setBusy(true);
    try {
      const r = await buchhaltungApi.manualPayment(invoice.id, paidOn, cents, note);
      toast.success(r.status === 'paid' ? 'Als bezahlt gebucht.' : 'Teilzahlung gebucht, die Rechnung bleibt offen.');
      refresh();
      onClose();
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={!!invoice} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle>Zahlung von Hand</DialogTitle>
          <DialogDescription>Rechnung {invoice?.number} · {invoice?.recipient} · offen {eur(open)}</DialogDescription>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">Nur als Notweg. Normal kommt die Zahlung über den Kontoauszug (Reiter Zahlungen).</p>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <label className="block"><span className="text-muted-foreground">Eingegangen am</span><Input type="date" value={paidOn} max={todayIso()} onChange={(e) => setPaidOn(e.target.value)} className="mt-1 h-9" /></label>
          <label className="block"><span className="text-muted-foreground">Betrag laut Konto (€)</span><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 h-9" /></label>
        </div>
        <label className="block text-sm"><span className="text-muted-foreground">Notiz (optional)</span><Input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 h-9" /></label>
        {cents > 0 && cents < open && <p className="text-xs text-muted-foreground">Teilzahlung: {eur(open - cents)} bleiben offen.</p>}
        {cents > open && <p className="text-xs text-destructive">Der Betrag ist höher als offen.</p>}
        <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button disabled={busy || !(cents > 0) || cents > open || !paidOn} onClick={save}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Buchen</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

