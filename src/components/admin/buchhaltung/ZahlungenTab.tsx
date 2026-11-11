import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { buchhaltungApi, dateShort, eur, readStatementFile, type BankTx } from '@/lib/buchhaltungApi';
import { Empty, ErrorLine, Loading, errText, useRefresh } from './ui';

const signed = (c: number) => `${c > 0 ? '+ ' : '− '}${eur(Math.abs(c)).replace(' €', '')}`;

/** A6 Zahlungen: Kontoauszug hochladen, Vorschläge prüfen, jede Zeile bestätigen. Von selbst wird nichts gebucht. */
export function ZahlungenTab() {
  const refresh = useRefresh();
  const q = useQuery({ queryKey: ['admin-buchhaltung', 'zahlungen'], queryFn: () => buchhaltungApi.payments() });
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [assign, setAssign] = useState<BankTx | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const hidden = useQuery({ queryKey: ['admin-buchhaltung', 'zahlungen-ausgeblendet'], queryFn: () => buchhaltungApi.hidden(), enabled: showHidden });
  const d = q.data;

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy('upload');
    try {
      const content = await readStatementFile(file);
      const r = await buchhaltungApi.importStatement(file.name, content);
      toast.success(`${r.imported} ${r.imported === 1 ? 'Buchung' : 'Buchungen'} eingelesen${r.duplicates ? `, ${r.duplicates} schon bekannt` : ''}${r.skipped ? `, ${r.skipped} übersprungen` : ''}.`);
      if (r.warnings.length) toast.message(r.warnings.join(' '));
      refresh();
    } catch (e) { toast.error(errText(e)); } finally { setBusy(null); if (fileRef.current) fileRef.current.value = ''; }
  };
  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); toast.success(ok); refresh(); } catch (e) { toast.error(errText(e)); } finally { setBusy(null); }
  };
  const bookSafe = async () => {
    setBusy('safe');
    try {
      const r = await buchhaltungApi.bookSafe();
      toast.success(`${r.booked} ${r.booked === 1 ? 'Zahlung' : 'Zahlungen'} gebucht.`);
      if (r.problems.length) toast.error(r.problems.join(' · '));
      refresh();
    } catch (e) { toast.error(errText(e)); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
        <div className="min-w-0 flex-1">
          <p className="font-medium">Kontoauszug hochladen</p>
          <p className="text-xs text-muted-foreground">CAMT.053 (XML) oder CSV aus dem Online-Banking. Schon bekannte Buchungen werden erkannt und nicht doppelt eingelesen.</p>
        </div>
        <input ref={fileRef} type="file" accept=".xml,.csv,.txt,text/csv,application/xml,text/xml" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
        <Button size="sm" variant="outline" disabled={busy === 'upload'} onClick={() => fileRef.current?.click()}>
          {busy === 'upload' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}Datei wählen
        </Button>
      </div>

      {q.isLoading ? <Loading /> : q.error ? <ErrorLine error={q.error} /> : d && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-muted-foreground">
              {d.lastImport ? `Auszug ${dateShort(d.lastImport.periodFrom)}–${d.lastImport.periodTo ? `${dateShort(d.lastImport.periodTo)}${d.lastImport.periodTo.slice(0, 4)}` : ''} · ` : ''}
              {d.open.length} offene {d.open.length === 1 ? 'Buchung' : 'Buchungen'} · {d.safeCount} sichere {d.safeCount === 1 ? 'Vorschlag' : 'Vorschläge'}
            </p>
            {d.safeCount > 0 && <Button size="sm" disabled={busy === 'safe'} onClick={bookSafe}>{busy === 'safe' && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{d.safeCount} sichere {d.safeCount === 1 ? 'Vorschlag' : 'Vorschläge'} buchen</Button>}
          </div>

          {d.open.length === 0 ? <Empty>Keine offenen Kontobewegungen. Lade einen neuen Auszug hoch, wenn Zahlungen eingegangen sind.</Empty> : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr><th className="p-2">Datum</th><th className="p-2">Von / an · Zweck</th><th className="p-2 text-right">Betrag</th><th className="p-2">Vorschlag</th><th className="p-2" /></tr>
                </thead>
                <tbody className="divide-y">
                  {d.open.map((t) => {
                    const s = t.suggestion;
                    const has = s && s.kind !== 'none';
                    return (
                      <tr key={t.id} className="align-top">
                        <td className="p-2 tabular-nums">{dateShort(t.bookedOn)}</td>
                        <td className="p-2"><p>{t.counterparty ?? '–'}</p><p className="max-w-md truncate text-xs text-muted-foreground" title={t.purpose ?? ''}>„{t.purpose ?? ''}“</p></td>
                        <td className="p-2 text-right tabular-nums">{signed(t.amountCents)}</td>
                        <td className="p-2"><p className={cn(!has && 'text-muted-foreground')}>{s?.label ?? '–'}</p>{s?.detail && <p className="text-xs text-muted-foreground">{s.detail}</p>}</td>
                        <td className="p-2">
                          <div className="flex justify-end gap-1">
                            {has && <Button size="sm" variant={s.safe ? 'default' : 'outline'} disabled={!!busy} onClick={() => run(t.id, () => buchhaltungApi.book(t.id), 'Gebucht.')}>{busy === t.id && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Buchen</Button>}
                            <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => setAssign(t)}>Zuordnen</Button>
                            {!has && <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => run(`h${t.id}`, () => buchhaltungApi.hide(t.id), 'Ausgeblendet.')}>Ausblenden</Button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {d.reported.length > 0 && (
            <div className="rounded-lg border p-3 text-sm">
              <p className="mb-1 text-xs text-muted-foreground">Vom Kunden gemeldet, noch nicht im Auszug</p>
              {d.reported.map((r) => <p key={r.id}>{r.number} · {r.candidateName ?? '–'} · gemeldet {dateShort(r.reportedOn)} · {eur(r.openCents)} offen</p>)}
            </div>
          )}

          {d.booked.length > 0 && (
            <details className="rounded-lg border p-3 text-sm">
              <summary className="cursor-pointer text-muted-foreground">Zuletzt gebucht ({d.booked.length})</summary>
              <div className="mt-2 divide-y">
                {d.booked.map((t) => <p key={t.id} className="py-1.5 tabular-nums">{dateShort(t.bookedOn)} · {t.counterparty ?? '–'} · {signed(t.amountCents)} → {t.target ?? '–'}</p>)}
              </div>
            </details>
          )}
          {d.hiddenCount > 0 && (
            <div className="text-sm">
              <Button size="sm" variant="ghost" onClick={() => setShowHidden(!showHidden)}>{showHidden ? 'Ausgeblendete verbergen' : `${d.hiddenCount} ausgeblendete zeigen`}</Button>
              {showHidden && (hidden.data?.rows ?? []).map((t) => (
                <div key={t.id} className="flex items-center gap-2 py-1 text-muted-foreground">
                  <span className="flex-1 tabular-nums">{dateShort(t.bookedOn)} · {t.counterparty ?? '–'} · „{t.purpose ?? ''}“ · {signed(t.amountCents)}</span>
                  <Button size="sm" variant="ghost" onClick={() => run(`u${t.id}`, () => buchhaltungApi.hide(t.id, false), 'Wieder eingeblendet.')}>Einblenden</Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <ZuordnenDialog tx={assign} targets={d?.targets ?? null} onClose={() => setAssign(null)} />
    </div>
  );
}

function ZuordnenDialog({ tx, targets, onClose }: { tx: BankTx | null; targets: { invoices: { id: string; number: string; openCents: number; recipient: string | null; candidateName: string | null }[]; creditNotes: { id: string; number: string; totalCents: number; recruiterName: string | null }[] } | null; onClose: () => void }) {
  const refresh = useRefresh();
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const incoming = (tx?.amountCents ?? 0) > 0;
  const s = search.trim().toLowerCase();
  const options = incoming
    ? (targets?.invoices ?? []).map((i) => ({ kind: 'invoice' as const, id: i.id, label: `${i.number} · ${i.candidateName ?? i.recipient ?? ''}`, detail: `${eur(i.openCents)} offen · ${i.recipient ?? ''}` }))
    : (targets?.creditNotes ?? []).map((n) => ({ kind: 'credit_note' as const, id: n.id, label: `${n.number} · ${n.recruiterName ?? ''}`, detail: `Auszahlung ${eur(n.totalCents)}` }));
  const shown = s ? options.filter((o) => `${o.label} ${o.detail}`.toLowerCase().includes(s)) : options;
  const pick = async (o: (typeof options)[number]) => {
    if (!tx) return;
    setBusy(true);
    try { const r = await buchhaltungApi.book(tx.id, { kind: o.kind, id: o.id }); toast.success(`Auf ${r.number} gebucht.`); refresh(); onClose(); } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={!!tx} onOpenChange={(o) => { if (!o) { setSearch(''); onClose(); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle>Zuordnen</DialogTitle>
          <DialogDescription>{tx ? `${dateShort(tx.bookedOn)} · ${tx.counterparty ?? '–'} · ${signed(tx.amountCents)} · „${tx.purpose ?? ''}“` : ''}</DialogDescription>
        </DialogHeader>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={incoming ? 'Rechnung, Kunde oder Name' : 'Gutschrift oder Headhunter'} className="h-9" />
        <div className="max-h-80 divide-y overflow-y-auto rounded-lg border">
          {shown.length === 0 ? <p className="p-3 text-sm text-muted-foreground">{incoming ? 'Keine offene Rechnung.' : 'Keine offene Gutschrift. Eine Abbuchung ohne Matchunt-Beleg einfach ausblenden.'}</p> : shown.map((o) => (
            <button key={o.id} type="button" disabled={busy} className="flex w-full items-center gap-2 p-2 text-left text-sm hover:bg-muted/50" onClick={() => pick(o)}>
              <span className="flex-1"><span className="block">{o.label}</span><span className="block text-xs text-muted-foreground">{o.detail}</span></span>
              <span className="text-xs text-muted-foreground">buchen</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
