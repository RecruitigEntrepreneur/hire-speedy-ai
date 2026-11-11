import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { base64Url, buchhaltungApi, dateDe, dateShort, downloadText, eur, openPdf, type CreditRunOverview } from '@/lib/buchhaltungApi';
import { Empty, ErrorLine, Loading, errText, useRefresh } from './ui';

/** A7 Gutschriften: Monatslauf in vier Schritten, frühere Läufe, Einwände. */
export function GutschriftenTab() {
  const refresh = useRefresh();
  const q = useQuery({ queryKey: ['admin-buchhaltung', 'gutschriften'], queryFn: () => buchhaltungApi.creditRun() });
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const d = q.data;
  if (q.isLoading) return <Loading />;
  if (q.error || !d) return <ErrorLine error={q.error} />;

  const ready = d.groups.filter((g) => !g.blocked);
  const openRun = d.runs.find((r) => r.status !== 'paid' && r.notes.some((n) => n.status === 'issued'));
  const step = !d.issued ? 1 : openRun ? (openRun.sepaCreatedAt ? 4 : 3) : 4;
  const create = async () => {
    setBusy('create');
    try {
      const r = await buchhaltungApi.createCreditRun(d.period);
      toast.success(`${r.notes.length} ${r.notes.length === 1 ? 'Gutschrift' : 'Gutschriften'} erstellt und verschickt.`);
      if (r.problems.length) toast.error(r.problems.join(' · '));
      refresh();
    } catch (e) { toast.error(errText(e)); } finally { setBusy(null); }
  };
  const sepa = async (runId: string) => {
    setBusy(`sepa${runId}`);
    try {
      const r = await buchhaltungApi.sepa(runId);
      downloadText(r.xml, r.fileName, 'application/xml');
      toast.success(`SEPA-Datei mit ${r.count} ${r.count === 1 ? 'Überweisung' : 'Überweisungen'} (${eur(r.totalCents)}), Ausführung ${dateDe(r.executionDate)}. Bitte im Online-Banking hochladen.`);
      if (r.skipped.length) toast.error(`Nicht enthalten: ${r.skipped.map((s) => `${s.number} (${s.why})`).join(', ')}`);
      refresh();
    } catch (e) { toast.error(errText(e)); } finally { setBusy(null); }
  };
  const steps = ['Prüfen', 'Gutschriften erstellen', 'SEPA-Datei an die Bank', 'Auszahlung über den Kontoauszug bestätigen'];

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-lg border p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-medium">Gutschriftlauf {d.label}</p>
          <p className="text-xs text-muted-foreground">{d.issued ? 'erstellt' : `erstellen ab ${dateShort(d.opensOn)} bis ${dateShort(d.deadline)}, zahlen 7 Tage danach`}</p>
        </div>
        <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {steps.map((s, i) => <li key={s} className={cn('text-muted-foreground', i + 1 === step && 'font-medium text-foreground')}>{i + 1} {s}</li>)}
        </ol>
        {d.blockers.length > 0 && <p className="text-xs text-destructive">Gesperrt, es fehlt: {d.blockers.join(', ')}.</p>}
        {!d.issued && (d.groups.length === 0 ? <Empty>In diesem Lauf ist noch nichts fällig.{d.laterCount ? ` ${d.laterCount} ${d.laterCount === 1 ? 'Posten kommt' : 'Posten kommen'} in den nächsten Lauf.` : ''}</Empty> : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr><th className="p-2">Headhunter</th><th className="p-2">Posten</th><th className="p-2 text-right">Netto</th><th className="p-2 text-right">USt</th><th className="p-2 text-right">Auszahlung</th></tr>
              </thead>
              <tbody className="divide-y">
                {d.groups.map((g) => (
                  <tr key={g.recruiterId} className={cn('align-top', g.blocked && 'text-muted-foreground')}>
                    <td className="p-2"><p className={cn(!g.blocked && 'font-medium')}>{g.name}</p><p className="text-xs text-muted-foreground">{g.blocked ?? g.taxLabel}</p></td>
                    <td className="p-2">{g.items.map((i) => <p key={i.trancheId}>{i.short} · {i.candidateName}</p>)}</td>
                    <td className="p-2 text-right tabular-nums">{eur(g.netCents).replace(' €', '')}</td>
                    <td className="p-2 text-right tabular-nums">{eur(g.vatCents).replace(' €', '')}</td>
                    <td className="p-2 text-right tabular-nums">{g.blocked ? 'gesperrt' : eur(g.totalCents).replace(' €', '')}</td>
                  </tr>
                ))}
                <tr className="bg-muted/20 font-medium">
                  <td className="p-2" colSpan={2}>Summe ohne gesperrte Posten</td>
                  <td className="p-2 text-right tabular-nums">{eur(d.totals.netCents).replace(' €', '')}</td>
                  <td className="p-2 text-right tabular-nums">{eur(d.totals.vatCents).replace(' €', '')}</td>
                  <td className="p-2 text-right tabular-nums">{eur(d.totals.totalCents).replace(' €', '')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}
        {!d.issued && d.groups.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {d.blockedItems > 0 && <p className="mr-auto text-xs text-muted-foreground">Gesperrte Posten wandern in den nächsten Lauf, sobald das Konto bestätigt ist.</p>}
            <Button variant="outline" size="sm" disabled={!ready.length} onClick={() => setPreview(true)}>Vorschau der Gutschriften</Button>
            <Button size="sm" disabled={!d.canCreate || !ready.length || d.blockers.length > 0 || busy === 'create'} title={!d.canCreate ? `Erst ab ${dateDe(d.opensOn)}` : undefined} onClick={create}>
              {busy === 'create' && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{d.totals.notes} {d.totals.notes === 1 ? 'Gutschrift' : 'Gutschriften'} erstellen und senden
            </Button>
          </div>
        )}
        {d.laterCount > 0 && d.groups.length > 0 && <p className="text-xs text-muted-foreground">{d.laterCount} weitere {d.laterCount === 1 ? 'Posten ist' : 'Posten sind'} erst danach fällig und kommen in den nächsten Lauf.</p>}
      </div>

      {d.runs.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Läufe</p>
          {d.runs.map((r) => (
            <div key={r.id} className="rounded-lg border">
              <div className="flex flex-wrap items-center gap-2 border-b p-3 text-sm">
                <p className="flex-1"><span className="font-medium">{r.runName}</span> <span className="text-muted-foreground">· {r.label} · {eur(r.totalCents)}{r.openCents ? ` · ${eur(r.openCents)} noch nicht ausgezahlt` : ' · ausgezahlt'}</span></p>
                {r.openCents > 0 && (
                  <Button size="sm" variant={r.sepaCreatedAt ? 'outline' : 'default'} disabled={!d.sepaReady || busy === `sepa${r.id}`} title={!d.sepaReady ? 'Bankverbindung von Matchunt fehlt' : undefined} onClick={() => sepa(r.id)}>
                    {busy === `sepa${r.id}` && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{r.sepaCreatedAt ? 'SEPA-Datei erneut' : 'SEPA-Datei herunterladen'}
                  </Button>
                )}
              </div>
              <div className="divide-y">
                {r.notes.map((n) => (
                  <div key={n.id} className="flex flex-wrap items-center gap-2 p-2 px-3 text-sm">
                    <span className="w-28 font-medium">{n.number}</span>
                    <span className="flex-1">{n.recruiterName ?? '–'}</span>
                    <span className="tabular-nums">{eur(n.totalCents)}</span>
                    <span className="w-40 text-xs text-muted-foreground">{n.status === 'paid' ? `ausgezahlt ${dateShort(n.paidOn)}` : `zahlen bis ${dateShort(n.payUntil)}`}{n.sentAt ? '' : ' · Mail offen'}</span>
                    <Button size="sm" variant="ghost" disabled={!n.hasPdf} onClick={() => openPdf(() => buchhaltungApi.creditNotePdf(n.id)).catch((e) => toast.error(errText(e)))}>PDF</Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Die Auszahlung bestätigst du im Reiter Zahlungen: Eine Abbuchung mit „GS-…“ im Zweck erkennt die App als Auszahlung der Gutschrift.</p>
        </div>
      )}

      {d.objections.length > 0 && <Einwaende items={d.objections} />}
      <VorschauDialog open={preview} data={d} onClose={() => setPreview(false)} />
    </div>
  );
}

function Einwaende({ items }: { items: CreditRunOverview['objections'] }) {
  const refresh = useRefresh();
  const [open, setOpen] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (id: string) => {
    setBusy(true);
    try { await buchhaltungApi.resolveObjection(id, text.trim()); toast.success('Einwand geklärt, der Headhunter ist informiert.'); setOpen(null); setText(''); refresh(); } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };
  return (
    <div className="rounded-lg border">
      <p className="border-b p-3 text-sm font-medium">Einwände zu Gutschriften ({items.length})</p>
      <div className="divide-y">
        {items.map((o) => (
          <div key={o.id} className="space-y-2 p-3 text-sm">
            <div className="flex flex-wrap items-start gap-2">
              <div className="flex-1"><p>{o.number ?? '–'} · {o.recruiterName ?? '–'} · {o.topic}</p><p className="text-xs text-muted-foreground">„{o.note}“ · {dateShort(o.createdAt)}</p></div>
              {open !== o.id && <Button size="sm" variant="outline" onClick={() => { setOpen(o.id); setText(''); }}>Klären</Button>}
            </div>
            {open === o.id && (
              <div className="space-y-2">
                <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Wie ist der Einwand geklärt? Der Headhunter bekommt den Text." />
                <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setOpen(null)}>Abbrechen</Button><Button size="sm" disabled={busy || !text.trim()} onClick={() => save(o.id)}>Geklärt</Button></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function VorschauDialog({ open, data, onClose }: { open: boolean; data: CreditRunOverview; onClose: () => void }) {
  const ready = data.groups.filter((g) => !g.blocked);
  const [rid, setRid] = useState<string | null>(null);
  const current = rid ?? ready[0]?.recruiterId ?? null;
  const q = useQuery({
    queryKey: ['admin-buchhaltung', 'gutschrift-vorschau', data.period, current],
    queryFn: async () => { const r = await buchhaltungApi.creditNotePreview(data.period, current ?? undefined); return { ...r, url: base64Url(r.pdfBase64) }; },
    enabled: open && !!current, retry: false, staleTime: 60_000,
  });
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader className="text-left">
          <DialogTitle>Vorschau der Gutschriften · {data.label}</DialogTitle>
          <DialogDescription>So sieht die Gutschrift aus. Nummer und Datum vergibt die App beim Erstellen.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5">
          {ready.map((g) => <Button key={g.recruiterId} size="sm" variant={g.recruiterId === current ? 'default' : 'outline'} onClick={() => setRid(g.recruiterId)}>{g.name}</Button>)}
        </div>
        <div className="h-[62vh] overflow-hidden rounded-lg border bg-muted/30">
          {q.isLoading ? <Loading /> : q.error ? <p className="p-3 text-sm text-destructive">{errText(q.error)}</p> : q.data ? <iframe title="Gutschrift" src={q.data.url} className="h-full w-full" /> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
