import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { firmenInitialen } from '@/lib/companyLogo';

interface Props {
  /** Öffentliche Adresse aus client_companies.logo_url (für Headhunter erst nach dem Reveal). */
  url?: string | null;
  name?: string | null;
  /** Kantenlänge in Pixeln. */
  size?: number;
  /** Vor dem Reveal: Schloss statt Logo. */
  locked?: boolean;
  className?: string;
}

/**
 * Firmenlogo auf weißer Kachel — auch im dunklen Modus. Viele Logos sind
 * schwarz auf durchsichtigem Grund (z. B. das „BB" von Bluewater) und
 * verschwänden sonst auf dunklem Hintergrund. Ohne Logo oder wenn das Bild
 * nicht lädt: das Kürzel, im Browser gezeichnet.
 */
export function FirmenLogo({ url, name, size = 20, locked = false, className }: Props) {
  const [kaputt, setKaputt] = useState(false);
  useEffect(() => setKaputt(false), [url]);

  const style = { width: size, height: size };
  if (locked) {
    return (
      <span style={style} className={cn('inline-flex shrink-0 items-center justify-center rounded-md bg-muted/60', className)}>
        <Lock className="text-muted-foreground/60" style={{ width: Math.max(10, size * 0.4), height: Math.max(10, size * 0.4) }} aria-hidden="true" />
      </span>
    );
  }

  // Weiß nur für echte Logos; das Kürzel ist ein Platzhalter und sieht auch so aus
  // (grau wie die übrigen Platzhalter), damit „BB" nicht für ein Logo gehalten wird.
  if (!url || kaputt) {
    return (
      <span
        style={style}
        className={cn('inline-flex shrink-0 items-center justify-center rounded-md bg-muted', className)}
      >
        <span className="font-medium leading-none text-muted-foreground" style={{ fontSize: Math.max(9, Math.round(size * 0.38)) }} aria-hidden="true">
          {firmenInitialen(name)}
        </span>
      </span>
    );
  }

  return (
    <span
      style={style}
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-black/10 bg-white',
        className,
      )}
    >
      <img
        src={url}
        alt=""
        loading="lazy"
        className="h-full w-full object-contain"
        style={{ padding: Math.max(1, Math.round(size * 0.1)) }}
        onError={() => setKaputt(true)}
      />
    </span>
  );
}
