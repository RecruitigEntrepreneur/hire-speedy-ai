import { useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { besetzungApi, fileToBase64, type BesetzungItem } from '@/lib/besetzungApi';
import { dateDe, endDoneText, endReasons, first, todayKey } from './besetzungView';

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
        catch (e) { text += ` Die Datei kam nicht an (${e instanceof Error ? e.message : 'Fehler'}); Sie können sie über „Unterlage nachreichen“ hochladen.`; }
      }
      onDone(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Das hat nicht geklappt.');
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
        <p className="text-sm font-medium">Besetzung endet · {item.name}</p>
        <p className="text-xs text-muted-foreground">{item.jobTitle}{item.package.replacement ? '' : ` · ${pkgShort}`}</p>
      </div>

      <div className="space-y-1.5">
        {label(`Hat ${who} schon angefangen?`)}
        <div className="flex flex-wrap gap-1.5">
          {canYes && chip(started === true, `Ja${p.startDate ? `, seit ${dateDe(p.startDate)}` : ''}`, () => { setStarted(true); setReason(''); })}
          {!fixed && chip(started === false, 'Nein', () => { setStarted(false); setReason(''); })}
        </div>
      </div>

      {started !== null && (
        <div className="space-y-1.5">
          {label('Was ist passiert?')}
          <div className="flex flex-wrap gap-1.5">{reasons.map((r) => chip(reason === r.key, r.label, () => setReason(r.key)))}</div>
        </div>
      )}

      {started !== null && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">{label('Davon erfahren am')}
            <Input type="date" max={today} className="mt-1 h-9" value={knownOn} onChange={(e) => setKnownOn(e.target.value)} /></label>
          {started && (
            <label className="block text-sm">{label('Letzter Arbeitstag')}
              <Input type="date" min={p.startDate ?? undefined} className="mt-1 h-9" value={lastDay} onChange={(e) => setLastDay(e.target.value)} /></label>
          )}
        </div>
      )}

      {started !== null && (
        <label className="block text-sm">{label(reason === 'other' ? 'Kurz in eigenen Worten (Pflicht)' : 'Kurz in eigenen Worten')}
          <Textarea rows={2} className="mt-1" placeholder={started ? 'z. B. geht zum alten Arbeitgeber zurück …' : 'z. B. Gegenangebot angenommen …'} value={note} onChange={(e) => setNote(e.target.value)} /></label>
      )}

      {started !== null && (
        <div className="space-y-1">
          {label(started ? `Kündigung oder Nachricht von ${who}` : `Absage oder Nachricht von ${who}`)}
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40">
            <Upload className="h-4 w-4" />
            <span className="flex-1 truncate">{file ? file.name : 'Datei wählen (freiwillig, auch später)'}</span>
            <input type="file" accept={ACCEPT} className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
      )}

      {continuity && (
        <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Mit {pkgShort} schreiben wir Ihre Stelle ohne neues Honorar neu für alle Headhunter aus, wenn der Grund nicht bei Ihnen liegt. Bitte melden Sie es binnen 14 Tagen, nachdem Sie davon erfahren haben.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2 border-t pt-3">
        <Button variant="ghost" onClick={onCancel}>Abbrechen</Button>
        <Button disabled={busy || !ok} onClick={() => void submit()}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Melden</Button>
      </div>
    </div>
  );
}
