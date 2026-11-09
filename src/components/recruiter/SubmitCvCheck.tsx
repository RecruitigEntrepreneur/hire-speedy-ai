/**
 * Lebenslauf im Einreichen-Fenster (Wireframe 3 und 4, Entscheidung 12.10.2026).
 *
 *   a) fehlt          → Einreichen gesperrt, Hochladen direkt hier
 *   b) älter 6 Monate → Rückfrage „noch aktuell?“, sperrt nicht
 *   c) Akte ≠ CV      → nur Hinweis
 */
import { useRef, useState } from 'react';
import { CheckCircle2, FileText, FileUp, Info, Loader2, Mail, Upload, X, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  CV_ACCEPT,
  CV_MISSING_MESSAGE,
  CurrentCv,
  CvMismatch,
  cvAgeLabel,
  cvAgeMonths,
  cvFileProblem,
  cvStandDate,
  formatCvDate,
  isCvStale,
} from '@/lib/candidateCv';
import { confirmCvCurrent, cvViewUrl } from '@/hooks/useCandidateCv';

async function openCv(cv: CurrentCv) {
  const url = await cvViewUrl(cv);
  if (url) window.open(url, '_blank', 'noopener');
  else toast.error('Der Lebenslauf konnte nicht geöffnet werden.');
}

export function SubmitCvCheck({
  cv,
  loading,
  mismatches,
  onUpload,
  anfrage,
}: {
  cv: CurrentCv | null;
  loading: boolean;
  mismatches: CvMismatch[];
  /** Lebenslauf hochladen oder ersetzen (öffnet den Lebenslauf-Import) */
  onUpload: () => void;
  /** Beim Kandidaten anfragen (05.11.2026), z. B. „Bei Lena anfragen“ */
  anfrage?: { label: string; onClick: () => void };
}) {
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Lebenslauf wird geprüft …
      </div>
    );
  }

  const stale = !!cv && confirmedId !== cv.id && isCvStale(cv);

  const confirm = async () => {
    if (!cv) return;
    setConfirming(true);
    try {
      await confirmCvCurrent(cv.id);
      setConfirmedId(cv.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bestätigung konnte nicht gespeichert werden.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">Lebenslauf</span>
        {cv && (
          <span className="text-xs text-muted-foreground">
            <button type="button" className="text-foreground underline-offset-2 hover:underline" onClick={() => openCv(cv)}>
              <FileText className="mr-1 inline h-3.5 w-3.5" />
              {cv.file_name}
            </button>
            {' · '}Stand {formatCvDate(cvStandDate(cv))}
          </span>
        )}
      </div>

      {!cv && (
        <div className="space-y-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <p>
            <XCircle className="mr-1.5 inline h-4 w-4" />
            Lebenslauf fehlt. {CV_MISSING_MESSAGE}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" className="bg-background" onClick={onUpload}>
              <Upload className="mr-1.5 h-3.5 w-3.5" /> Lebenslauf hochladen
            </Button>
            {anfrage && (
              <Button type="button" size="sm" variant="outline" className="bg-background" onClick={anfrage.onClick}>
                <Mail className="mr-1.5 h-3.5 w-3.5" /> {anfrage.label}
              </Button>
            )}
          </div>
        </div>
      )}

      {cv && stale && (
        <div className="space-y-2 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
          <p>
            Stand {formatCvDate(cvStandDate(cv))}, {cvAgeLabel(cvAgeMonths(cv))}. Ist der Lebenslauf noch aktuell?
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" className="bg-background" disabled={confirming} onClick={confirm}>
              {confirming && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Ja, aktuell
            </Button>
            <Button type="button" size="sm" variant="outline" className="bg-background" onClick={onUpload}>
              <Upload className="mr-1.5 h-3.5 w-3.5" /> Neuen hochladen
            </Button>
          </div>
        </div>
      )}

      {cv && confirmedId === cv.id && (
        <p className="text-xs text-success">
          <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> Als aktuell bestätigt.
        </p>
      )}

      {cv && mismatches.length > 0 && (
        <div className="space-y-1.5 rounded-md bg-primary/5 px-3 py-2 text-sm">
          <p className="font-medium text-primary">
            <Info className="mr-1.5 inline h-4 w-4" />
            Hinweis: Akte und Lebenslauf weichen ab
          </p>
          <ul className="space-y-0.5 text-xs">
            {mismatches.map((m) => (
              <li key={m.key}>
                <span className="font-medium">{m.label}:</span> Akte „{m.akte}“ · Lebenslauf „{m.cv}“
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Einreichen geht trotzdem. Prüfe, ob die Akte stimmt, oder lade einen neuen Lebenslauf hoch.</p>
        </div>
      )}

      {cv && !stale && mismatches.length === 0 && confirmedId !== cv.id && (
        <p className="text-xs text-success">
          <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> Lebenslauf liegt vor.
        </p>
      )}
    </div>
  );
}

/** Pflichtfeld Lebenslauf beim neuen Kandidaten: nur PDF oder Word, kein Link. */
export function CvFileDrop({ file, onChange }: { file: File | null; onChange: (file: File | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = (f: File | null | undefined) => {
    if (!f) return;
    const problem = cvFileProblem(f);
    if (problem) { toast.error(problem); return; }
    onChange(f);
  };

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">
        Lebenslauf (PDF oder Word) <span className="text-destructive">*</span>
      </p>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]); }}
        className={cn(
          'cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors',
          dragging || file ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
        )}
      >
        <input ref={inputRef} type="file" accept={CV_ACCEPT} className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        <FileUp className="mx-auto mb-1.5 h-6 w-6 text-muted-foreground" />
        {file ? (
          <p className="text-sm font-medium">
            {file.name}
            <button
              type="button"
              className="ml-1 text-muted-foreground hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              aria-label="Datei entfernen"
            >
              <X className="inline h-3.5 w-3.5" />
            </button>
          </p>
        ) : (
          <>
            <p className="text-sm">Datei hierher ziehen oder klicken</p>
            <p className="text-xs text-muted-foreground">PDF oder Word, bis 10 MB. Ein Link reicht nicht.</p>
          </>
        )}
      </div>
    </div>
  );
}
