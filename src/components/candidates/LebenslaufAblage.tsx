import { DragEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

const hatDateien = (e: { dataTransfer: DataTransfer | null }) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');

/**
 * Lebenslauf hineinziehen (05.11.2026, Variante C): In Ruhe sieht der Inhalt aus wie immer.
 * Kommt eine Datei darüber, zeigt sich die Fläche als Ablage. Loslassen gibt alle Dateien
 * an die Live-Ablage weiter (09.11.2026), die falsche aussortiert. Solange die Fläche zu
 * sehen ist, öffnet der Browser eine daneben fallen gelassene Datei nicht mehr selbst.
 */
export function LebenslaufAblage({ onFiles, children, className }: { onFiles: (files: File[]) => void; children: ReactNode; className?: string }) {
  const { t } = useTranslation('candidateAblage');
  const [darueber, setDarueber] = useState(false);
  const tiefe = useRef(0);

  useEffect(() => {
    const abfangen = (e: globalThis.DragEvent) => { if (!e.defaultPrevented && hatDateien(e)) e.preventDefault(); };
    window.addEventListener('dragover', abfangen);
    window.addEventListener('drop', abfangen);
    return () => { window.removeEventListener('dragover', abfangen); window.removeEventListener('drop', abfangen); };
  }, []);

  const loslassen = (e: DragEvent<HTMLDivElement>) => {
    if (!hatDateien(e)) return;
    e.preventDefault();
    tiefe.current = 0;
    setDarueber(false);
    const dateien = Array.from(e.dataTransfer.files);
    if (dateien.length) onFiles(dateien);
  };

  return (
    <div
      className={cn('relative', className)}
      onDragEnter={(e) => { if (!hatDateien(e)) return; e.preventDefault(); tiefe.current += 1; setDarueber(true); }}
      onDragOver={(e) => { if (!hatDateien(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDragLeave={(e) => { if (!hatDateien(e)) return; tiefe.current = Math.max(0, tiefe.current - 1); if (tiefe.current === 0) setDarueber(false); }}
      onDrop={loslassen}
    >
      {children}
      {darueber && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-3 rounded-lg border-2 border-dashed border-foreground bg-muted/95">
          <FileUp className="h-6 w-6 shrink-0" />
          <div>
            <p className="font-semibold">{t('drop.title')}</p>
            <p className="text-sm text-muted-foreground">{t('drop.hint')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
