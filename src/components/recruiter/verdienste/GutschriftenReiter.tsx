import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Honorar } from '@/components/recruiter/Honorar';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { abrechnungApi } from '@/lib/abrechnungApi';
import { downloadBlob } from '@/lib/billingApi';
import { zipStore } from '@/lib/zipStore';
import {
  MONTHS, OBJECTION_TOPICS, dm, eur2, runName, type CreditNoteItem,
} from '../../../../supabase/functions/_shared/abrechnung-view';

const monthOf = (period: string) => MONTHS[Number(String(period).slice(5, 7)) - 1] ?? period;
const linesText = (n: CreditNoteItem) => n.lines.map((l) => l.title).filter(Boolean).join(' · ');

/** Verdienste › Gutschriften (H11): nächster Lauf, ausgestellte Gutschriften, Einwand, Export. */
export function GutschriftenReiter() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['gutschriften', user?.id], queryFn: abrechnungApi.creditNotes, enabled: !!user, retry: false });
  const [einwand, setEinwand] = useState<CreditNoteItem | null>(null);
  const [busy, setBusy] = useState('');
  const thisYear = String(new Date().getFullYear());
  const years = q.data?.years?.length ? q.data.years : [thisYear];
  const [year, setYear] = useState(years[0] ?? thisYear);

  if (q.isLoading) return <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (q.isError) return <p className="py-6 text-sm text-muted-foreground">{q.error instanceof Error ? q.error.message : 'Die Gutschriften konnten nicht geladen werden.'}</p>;
  const data = q.data!;

  const openPdf = async (n: CreditNoteItem) => {
    const win = window.open('', '_blank');
    if (win) win.opener = null;
    setBusy(`pdf-${n.id}`);
    try {
      const { url } = await abrechnungApi.creditNoteFile(n.id);
      if (win) win.location.href = url; else window.location.assign(url);
    } catch (e) {
      win?.close();
      toast.error(e instanceof Error ? e.message : 'Das PDF ist gerade nicht abrufbar.');
    } finally { setBusy(''); }
  };

  const exportYear = async () => {
    setBusy('export');
    try {
      const r = await abrechnungApi.creditNotesExport(year);
      if (!r.count) { toast.error(`Für ${year} gibt es noch keine Gutschriften.`); return; }
      const parts = [{ name: `gutschriften-${year}.csv`, bytes: new TextEncoder().encode(r.csv) }];
      for (const f of r.files) {
        const res = await fetch(f.url);
        if (!res.ok) throw new Error(`${f.number} ließ sich nicht laden.`);
        parts.push({ name: `${f.number.replace(/[^\w.-]/g, '_')}.pdf`, bytes: new Uint8Array(await res.arrayBuffer()) });
      }
      downloadBlob(zipStore(parts), `gutschriften-${year}.zip`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Der Export hat nicht geklappt.');
    } finally { setBusy(''); }
  };

  return (
    <div className="space-y-4">
      {data.upcoming.length === 0 && data.notes.length === 0 && (
        <p className="py-6 text-sm text-muted-foreground">Noch keine Gutschriften. Einmal im Monat rechnen wir alles ab, was fällig ist, und schicken dir die Gutschrift per Mail.</p>
      )}
      {(data.upcoming.length > 0 || data.notes.length > 0) && (
        <ul className="divide-y divide-border border-y border-border">
          {data.upcoming.map((run) => (
            <li key={run.slot.runMonth} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm"><span className="font-medium">{runName(run.slot)}</span><span className="text-muted-foreground"> · in Vorbereitung</span></p>
                <p className="truncate text-xs text-muted-foreground">{run.lines.map((l) => l.label).join(' · ')}</p>
              </div>
              <div className="text-right">
                <p className="text-sm tabular-nums"><Honorar>{eur2(run.netCents)}</Honorar>{run.vatCents > 0 && <span className="text-muted-foreground"> + USt</span>}</p>
                <p className="text-xs text-muted-foreground">{run.slot.short}</p>
              </div>
            </li>
          ))}
          {data.notes.map((n) => (
            <li key={n.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{n.number}</span>
                  <span className="text-muted-foreground">
                    {' · '}{monthOf(n.period)}
                    {' · '}{n.status === 'paid' ? `ausgezahlt ${dm(n.paidOn)}` : n.status === 'cancelled' ? 'storniert' : `Geld bis ${dm(n.payUntil)}`}
                  </span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {linesText(n)}
                  {n.objection
                    ? ` · Einwand ${n.objection.status === 'open' ? 'liegt bei Matchunt' : 'geklärt'}`
                    : n.canObject ? ` · Einwand bis ${dm(n.objectionUntil)}` : ''}
                </p>
                {n.objection?.status === 'resolved' && n.objection.resolution && <p className="text-xs text-muted-foreground">Antwort: {n.objection.resolution}</p>}
              </div>
              <div className="text-right">
                <p className={cn('text-sm tabular-nums', n.status === 'cancelled' && 'line-through text-muted-foreground')}><Honorar>{eur2(n.totalCents)}</Honorar> <span className="text-muted-foreground">brutto</span></p>
                <div className="mt-1 flex justify-end gap-1.5">
                  {n.hasPdf && <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={busy === `pdf-${n.id}`} onClick={() => void openPdf(n)}><FileText className="mr-1 h-3.5 w-3.5" />PDF</Button>}
                  {n.canObject && <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setEinwand(n)}>Einwand</Button>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm">Für deinen Steuerberater <span className="text-muted-foreground">· alle Gutschriften {year} als CSV und die PDFs als ZIP</span></p>
          <div className="flex items-center gap-2">
            {years.length > 1 && (
              <select aria-label="Jahr" className="h-8 rounded-md border border-input bg-background px-2 text-sm" value={year} onChange={(e) => setYear(e.target.value)}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
            <Button variant="outline" size="sm" disabled={busy === 'export'} onClick={() => void exportYear()}>
              {busy === 'export' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}Jahr {year} herunterladen
            </Button>
          </div>
        </CardContent>
      </Card>

      <EinwandDialog note={einwand} onClose={() => setEinwand(null)} onSent={() => { setEinwand(null); void qc.invalidateQueries({ queryKey: ['gutschriften'] }); }} />
    </div>
  );
}

/** H11: Einwand zur Gutschrift, binnen 30 Tagen (Vertrag § 14 Abs. 3). */
function EinwandDialog({ note, onClose, onSent }: { note: CreditNoteItem | null; onClose: () => void; onSent: () => void }) {
  const [topic, setTopic] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const reset = () => { setTopic(''); setText(''); };
  const send = async () => {
    if (!note) return;
    if (!topic) { toast.error('Bitte wählen, was nicht stimmt.'); return; }
    if (!text.trim()) { toast.error('Bitte kurz beschreiben, was nicht stimmt.'); return; }
    setBusy(true);
    try {
      await abrechnungApi.objection(note.id, topic, text.trim());
      toast.success('Dein Einwand ist bei Matchunt.');
      reset();
      onSent();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Dein Einwand konnte nicht gesendet werden.');
    } finally { setBusy(false); }
  };
  return (
    <Dialog open={!!note} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-md">
        {note && (
          <>
            <DialogHeader>
              <DialogTitle>Einwand zur Gutschrift {note.number}</DialogTitle>
              <DialogDescription><Honorar>{`${linesText(note) || 'Gutschrift'} · ${eur2(note.netCents)}${note.vatCents > 0 ? ` + ${eur2(note.vatCents)} USt` : ''}`}</Honorar></DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <p className="text-sm text-muted-foreground">Was stimmt nicht?</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(OBJECTION_TOPICS).map(([key, label]) => (
                    <button key={key} type="button" aria-pressed={topic === key} onClick={() => setTopic(key)}
                      className={cn('rounded-full border px-2.5 py-1 text-xs', topic === key ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="einwand-text" className="sr-only">Beschreibung</Label>
                <Textarea id="einwand-text" rows={4} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="z. B. Laut Vertrag sind es 90.000 € inklusive Bonus" />
              </div>
              <p className="text-xs text-muted-foreground">Frist 30 Tage ab Gutschrift (Vertrag § 14 Abs. 3), also bis {dm(note.objectionUntil)}. Den unstrittigen Teil zahlen wir normal aus.</p>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Abbrechen</Button>
              <Button disabled={busy} onClick={() => void send()}>{busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}Einwand senden</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
