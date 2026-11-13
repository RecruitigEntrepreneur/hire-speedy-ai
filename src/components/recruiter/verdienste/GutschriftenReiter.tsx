import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Trans, useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { intlLocale } from '@/i18n/languages';
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
  OBJECTION_TOPICS, dm, eur2, runName, type CreditNoteItem,
} from '../../../../supabase/functions/_shared/abrechnung-view';

// Monatsname in der Sprache der Oberfläche (deutsch wie bisher „Oktober“).
const monthOf = (period: string) => {
  const month = Number(String(period).slice(5, 7));
  return month >= 1 && month <= 12 ? new Date(Date.UTC(2000, month - 1, 15)).toLocaleDateString(intlLocale(i18n.language), { month: 'long', timeZone: 'UTC' }) : period;
};
const linesText = (n: CreditNoteItem) => n.lines.map((l) => l.title).filter(Boolean).join(' · ');

/** Verdienste › Gutschriften (H11): nächster Lauf, ausgestellte Gutschriften, Einwand, Export. */
export function GutschriftenReiter() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { t } = useTranslation('recruiterEarnings');
  const q = useQuery({ queryKey: ['gutschriften', user?.id, i18n.language], queryFn: abrechnungApi.creditNotes, enabled: !!user, retry: false });
  const [einwand, setEinwand] = useState<CreditNoteItem | null>(null);
  const [busy, setBusy] = useState('');
  const thisYear = String(new Date().getFullYear());
  const years = q.data?.years?.length ? q.data.years : [thisYear];
  const [year, setYear] = useState(years[0] ?? thisYear);

  if (q.isLoading) return <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (q.isError) return <p className="py-6 text-sm text-muted-foreground">{q.error instanceof Error ? q.error.message : t('notes.loadFailed')}</p>;
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
      toast.error(e instanceof Error ? e.message : t('api.creditNoteFile'));
    } finally { setBusy(''); }
  };

  const exportYear = async () => {
    setBusy('export');
    try {
      const r = await abrechnungApi.creditNotesExport(year);
      if (!r.count) { toast.error(t('notes.noneForYear', { year })); return; }
      const parts = [{ name: `${t('notes.csvName', { year })}.csv`, bytes: new TextEncoder().encode(r.csv) }];
      for (const f of r.files) {
        const res = await fetch(f.url);
        if (!res.ok) throw new Error(t('notes.fileFailed', { number: f.number }));
        parts.push({ name: `${f.number.replace(/[^\w.-]/g, '_')}.pdf`, bytes: new Uint8Array(await res.arrayBuffer()) });
      }
      downloadBlob(zipStore(parts), `${t('notes.csvName', { year })}.zip`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('api.export'));
    } finally { setBusy(''); }
  };

  return (
    <div className="space-y-4">
      {data.upcoming.length === 0 && data.notes.length === 0 && (
        <p className="py-6 text-sm text-muted-foreground">{t('notes.empty')}</p>
      )}
      {(data.upcoming.length > 0 || data.notes.length > 0) && (
        <ul className="divide-y divide-border border-y border-border">
          {data.upcoming.map((run) => (
            <li key={run.slot.runMonth} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm"><span className="font-medium">{runName(run.slot, i18n.language)}</span><span className="text-muted-foreground">{t('notes.preparing')}</span></p>
                <p className="truncate text-xs text-muted-foreground">{run.lines.map((l) => l.label).join(' · ')}</p>
              </div>
              <div className="text-right">
                <p className="text-sm tabular-nums"><Honorar>{eur2(run.netCents, i18n.language)}</Honorar>{run.vatCents > 0 && <span className="text-muted-foreground">{t('notes.plusVat')}</span>}</p>
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
                    {' · '}{n.status === 'paid' ? t('notes.paidOn', { date: dm(n.paidOn, i18n.language) }) : n.status === 'cancelled' ? t('notes.cancelled') : t('notes.moneyUntil', { date: dm(n.payUntil, i18n.language) })}
                  </span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {linesText(n)}
                  {n.objection
                    ? (n.objection.status === 'open' ? t('notes.objectionOpen') : t('notes.objectionResolved'))
                    : n.canObject ? t('notes.objectionUntil', { date: dm(n.objectionUntil, i18n.language) }) : ''}
                </p>
                {n.objection?.status === 'resolved' && n.objection.resolution && <p className="text-xs text-muted-foreground">{t('notes.answer', { text: n.objection.resolution })}</p>}
              </div>
              <div className="text-right">
                <p className={cn('text-sm tabular-nums', n.status === 'cancelled' && 'line-through text-muted-foreground')}><Honorar>{eur2(n.totalCents, i18n.language)}</Honorar> <span className="text-muted-foreground">{t('notes.gross')}</span></p>
                <div className="mt-1 flex justify-end gap-1.5">
                  {n.hasPdf && <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={busy === `pdf-${n.id}`} onClick={() => void openPdf(n)}><FileText className="mr-1 h-3.5 w-3.5" />PDF</Button>}
                  {n.canObject && <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setEinwand(n)}>{t('notes.objection')}</Button>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm"><Trans t={t} i18nKey="notes.forAdvisor" values={{ year }} components={{ muted: <span className="text-muted-foreground" /> }} /></p>
          <div className="flex items-center gap-2">
            {years.length > 1 && (
              <select aria-label={t('notes.year')} className="h-8 rounded-md border border-input bg-background px-2 text-sm" value={year} onChange={(e) => setYear(e.target.value)}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
            <Button variant="outline" size="sm" disabled={busy === 'export'} onClick={() => void exportYear()}>
              {busy === 'export' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}{t('notes.downloadYear', { year })}
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
  const { t } = useTranslation('recruiterEarnings');
  const reset = () => { setTopic(''); setText(''); };
  const send = async () => {
    if (!note) return;
    if (!topic) { toast.error(t('objection.chooseTopic')); return; }
    if (!text.trim()) { toast.error(t('objection.describe')); return; }
    setBusy(true);
    try {
      await abrechnungApi.objection(note.id, topic, text.trim());
      toast.success(t('objection.sent'));
      reset();
      onSent();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('api.objection'));
    } finally { setBusy(false); }
  };
  return (
    <Dialog open={!!note} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-md">
        {note && (
          <>
            <DialogHeader>
              <DialogTitle>{t('objection.title', { number: note.number })}</DialogTitle>
              <DialogDescription><Honorar>{`${linesText(note) || t('objection.creditNote')} · ${eur2(note.netCents, i18n.language)}${note.vatCents > 0 ? t('objection.plusVat', { amount: eur2(note.vatCents, i18n.language) }) : ''}`}</Honorar></DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <p className="text-sm text-muted-foreground">{t('objection.question')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(OBJECTION_TOPICS).map((key) => (
                    <button key={key} type="button" aria-pressed={topic === key} onClick={() => setTopic(key)}
                      className={cn('rounded-full border px-2.5 py-1 text-xs', topic === key ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}>{t(`objection.topics.${key}`, { defaultValue: OBJECTION_TOPICS[key] })}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="einwand-text" className="sr-only">{t('objection.label')}</Label>
                <Textarea id="einwand-text" rows={4} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('objection.placeholder')} />
              </div>
              <p className="text-xs text-muted-foreground">{t('objection.deadline', { date: dm(note.objectionUntil, i18n.language) })}</p>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { reset(); onClose(); }}>{t('cancel')}</Button>
              <Button disabled={busy} onClick={() => void send()}>{busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}{t('objection.send')}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
