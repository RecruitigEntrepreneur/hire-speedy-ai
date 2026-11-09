import { useRef, useState } from 'react';
import { AlertCircle, FileCheck2, Loader2, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { docxToText, isDocx } from '@/lib/docxText';
import { terminSeiteApi, type LebenslaufZiel } from '@/lib/terminApi';

const zuBase64 = (f: File) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).replace(/^data:[^;]+;base64,/, ''));
  r.onerror = () => reject(r.error);
  r.readAsDataURL(f);
});

export type LebenslaufDatei = { name: string; id: string | null; status: 'laedt' | 'fertig' | 'fehler'; meldung?: string };

/**
 * Lebenslauf für den Headhunter (05.11.2026): hochladen auf der Einladungsseite oder
 * über den Anfrage-Link, wahlweise nur das LinkedIn-Profil. Die Datei wird gleich
 * vorgemerkt; angehängt wird sie erst mit Buchen oder Senden samt Einverständnis.
 */
export function LebenslaufFeld({
  ziel,
  hhVorname,
  datei,
  onDatei,
  linkedin,
  onLinkedin,
  linkedinHinweis = 'oder dein LinkedIn-Profil',
}: {
  ziel: LebenslaufZiel;
  hhVorname: string;
  datei: LebenslaufDatei | null;
  onDatei: (d: LebenslaufDatei | null) => void;
  linkedin: string;
  onLinkedin: (v: string) => void;
  linkedinHinweis?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [ziehen, setZiehen] = useState(false);

  const waehlen = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { onDatei({ name: f.name, id: null, status: 'fehler', meldung: 'Die Datei ist größer als 10 MB.' }); return; }
    const pdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    const word = isDocx(f) || /\.docx?$/i.test(f.name);
    if (!pdf && !word) { onDatei({ name: f.name, id: null, status: 'fehler', meldung: 'Bitte lade den Lebenslauf als PDF oder Word hoch.' }); return; }
    onDatei({ name: f.name, id: null, status: 'laedt' });
    try {
      const text = word && isDocx(f) ? await docxToText(f).catch(() => '') : '';
      const r = await terminSeiteApi.lebenslauf(ziel, { name: f.name, typ: f.type, base64: await zuBase64(f), text: text || undefined });
      onDatei({ name: f.name, id: r.upload_id, status: 'fertig' });
    } catch (e) {
      onDatei({ name: f.name, id: null, status: 'fehler', meldung: e instanceof Error ? e.message : 'Der Lebenslauf konnte nicht hochgeladen werden.' });
    }
  };

  const fertig = datei?.status === 'fertig';
  return <div className="space-y-2">
    <input ref={input} type="file" className="hidden" accept=".pdf,.doc,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
      onChange={e => { void waehlen(e.target.files?.[0]); e.target.value = ''; }}/>
    <button type="button" onClick={() => input.current?.click()}
      onDragOver={e => { e.preventDefault(); setZiehen(true); }} onDragLeave={() => setZiehen(false)}
      onDrop={e => { e.preventDefault(); setZiehen(false); void waehlen(e.dataTransfer.files?.[0]); }}
      className={cn('flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm transition-colors',
        fertig ? 'border-emerald-500/40 bg-emerald-500/[0.05]' : datei?.status === 'fehler' ? 'border-dashed border-destructive/60' : 'border-dashed border-border hover:bg-muted/50',
        ziehen && 'bg-muted/60')}>
      {datei?.status === 'laedt' ? <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground"/>
        : fertig ? <FileCheck2 className="h-5 w-5 shrink-0 text-emerald-600"/>
        : datei?.status === 'fehler' ? <AlertCircle className="h-5 w-5 shrink-0 text-destructive"/>
        : <Upload className="h-5 w-5 shrink-0 text-muted-foreground"/>}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{datei ? datei.name : 'Lebenslauf hochladen'}</span>
        <span className={cn('block text-xs', datei?.status === 'fehler' ? 'text-destructive' : fertig ? 'text-emerald-600' : 'text-muted-foreground')}>
          {datei?.status === 'laedt' ? 'Wird hochgeladen …'
            : fertig ? `Hochgeladen · ${hhVorname} sieht ihn vor dem Gespräch`
            : datei?.status === 'fehler' ? datei.meldung
            : 'PDF oder Word, auch vom Handy'}
        </span>
      </span>
      {datei && datei.status !== 'laedt' && <span className="text-xs text-muted-foreground underline">ändern</span>}
    </button>
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{linkedinHinweis}</p>
      <Input placeholder="linkedin.com/in/…" value={linkedin} onChange={e => onLinkedin(e.target.value)} aria-label="LinkedIn-Profil"/>
    </div>
  </div>;
}
