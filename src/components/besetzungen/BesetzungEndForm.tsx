import { useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { besetzungApi, fileToBase64, type BesetzungItem } from '@/lib/besetzungApi';
import { dateDe, endDoneText, endReasons, first, todayKey } from './besetzungView';
import { useTranslation } from 'react-i18next';

/**
 * K5 „Besetzung endet“ (11.11.2026): ein Dialog für vor und nach dem Start. Ersetzt
 * „Tritt nicht an“ (mit Erstattungstext) und „Ausgeschieden“ (drei Datumsfelder, elf Gründe).
 * Bei Core fehlt der Kasten zur Nachbesetzung; die Meldung ist dort nur Information.
 */

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.eml,.msg';

interface Props {
  item: BesetzungItem;
  /** Vorauswahl „Hat … schon angefangen?“ (z. B. „Nein“ aus „Hat nicht angefangen“) */
  preset?: boolean | null;
  onCancel: () => void;
  /** Satz für „Erledigt.“ */
  onDone: (text: string) => void;
}

export function BesetzungEndForm({ item, preset = null, onCancel, onDone }: Props) {
  const { t } = useTranslation('clientPlacements');
  const p = item.placement!;
  const who = first(item.name);
  const today = todayKey();
  const fixed = !!p.startFixedAt || ['started', 'ended_early', 'completed'].includes(p.state);
  const canYes = fixed || (!!p.startDate && p.startDate <= today);
  const [started, setStarted] = useState<boolean | null>(fixed ? true : !canYes ? false : preset);
  const [reason, setReason] = useState('');
  const [knownOn, setKnownOn] = useState(today);
  const [lastDay, setLastDay] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const continuity = !!item.package.continuityDays && !item.package.replacement;
  const pkgShort = item.package.key === 'continuity_90' ? 'Continuity 90' : item.package.key === 'continuity_180' ? 'Continuity 180' : item.package.name;
  const reasons = started === null ? [] : endReasons(started, who);
  const ok = started !== null && !!reason && !!knownOn && (!started || !!lastDay) && (reason !== 'other' || note.trim().length > 0);

  const submit = async () => {
    if (!ok || started === null) return;
    setBusy(true);
    setError(null);
    try {
      const r = await besetzungApi.reportEnd({ placementId: p.id, started, reason, knownOn, lastDay: started ? lastDay : null, note: note.trim() || undefined });
      let text = endDoneText(r.outcome, r.kind, r.reviewUntil, reason);
      if (file) {
        try { await besetzungApi.endDocument(p.id, file.name, await fileToBase64(file)); }
        catch (e) { text += t('end.fileFailed', { error: e instanceof Error ? e.message : t('common.error') }); }
      }
      onDone(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setBusy(false);
    }
  };

  const label = (text: string) => <span className="text-xs text-muted-foreground">{text}</span>;
  const chip = (active: boolean, text: string, onClick: () => void, disabled = false) => (
    <Button key={text} type="button" size="sm" variant={active ? 'secondary' : 'outline'} disabled={disabled}
      className={active ? 'h-7 rounded-full text-xs ring-1 ring-foreground/30' : 'h-7 rounded-full text-xs'} onClick={onClick}>{text}</Button>
  );

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">{t('end.title', { name: item.name })}</p>
        <p className="text-xs text-muted-foreground">{item.jobTitle}{item.package.replacement ? '' : ` · ${pkgShort}`}</p>
      </div>

      <div className="space-y-1.5">
        {label(t('end.startedQ', { who }))}
        <div className="flex flex-wrap gap-1.5">
          {canYes && chip(started === true, p.startDate ? t('end.yesSince', { date: dateDe(p.startDate) }) : t('end.yes'), () => { setStarted(true); setReason(''); })}
          {!fixed && chip(started === false, t('end.no'), () => { setStarted(false); setReason(''); })}
        </div>
      </div>

      {started !== null && (
        <div className="space-y-1.5">
          {label(t('end.what'))}
          <div className="flex flex-wrap gap-1.5">{reasons.map((r) => chip(reason === r.key, r.label, () => setReason(r.key)))}</div>
        </div>
      )}

      {started !== null && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">{label(t('end.knownOn'))}
            <Input type="date" max={today} className="mt-1 h-9" value={knownOn} onChange={(e) => setKnownOn(e.target.value)} /></label>
          {started && (
            <label className="block text-sm">{label(t('end.lastDay'))}
              <Input type="date" min={p.startDate ?? undefined} className="mt-1 h-9" value={lastDay} onChange={(e) => setLastDay(e.target.value)} /></label>
          )}
        </div>
      )}

      {started !== null && (
        <label className="block text-sm">{label(reason === 'other' ? t('end.ownWordsRequired') : t('end.ownWords'))}
          <Textarea rows={2} className="mt-1" placeholder={started ? t('end.placeholderStarted') : t('end.placeholderNotStarted')} value={note} onChange={(e) => setNote(e.target.value)} /></label>
      )}

      {started !== null && (
        <div className="space-y-1">
          {label(started ? t('end.fileStarted', { who }) : t('end.fileNotStarted', { who }))}
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40">
            <Upload className="h-4 w-4" />
            <span className="flex-1 truncate">{file ? file.name : t('end.filePick')}</span>
            <input type="file" accept={ACCEPT} className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
      )}

      {continuity && (
        <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          {t('end.continuity', { pkg: pkgShort })}
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2 border-t pt-3">
        <Button variant="ghost" onClick={onCancel}>{t('common.cancel')}</Button>
        <Button disabled={busy || !ok} onClick={() => void submit()}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{t('common.report')}</Button>
      </div>
    </div>
  );
}
