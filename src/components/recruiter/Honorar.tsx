import type { ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { setHonorarVerdeckt, useHonorarVerdeckt, VERDECKT, verdeckeBetraege } from '@/lib/honorarVerdeckt';

/**
 * Ein Betrag, der das eigene Geld des Headhunters zeigt. Mit dem Auge in der
 * Kopfleiste wird er zu „••••• €“ (21.10.2026). Text-Kinder werden Betrag für
 * Betrag verdeckt („15 % Honorar“ → „•• % Honorar“), alles andere ganz.
 */
export function Honorar({ children, className }: { children: ReactNode; className?: string }) {
  const verdeckt = useHonorarVerdeckt();
  if (!verdeckt) return <>{children}</>;
  const text = typeof children === 'string' || typeof children === 'number' ? String(children) : null;
  const ersatz = text != null ? verdeckeBetraege(text) : `${VERDECKT} €`;
  // Nur die Punkte grau und gesperrt; umgebender Text („Honorar bei Abschluss:“) bleibt normal.
  return <span className={className} title="Beträge verborgen, Auge oben in der Kopfleiste">
    <span aria-hidden="true">{ersatz.split(/(•+(?:\s?[€%])?)/).map((teil, i) => (teil.startsWith('•') ? <span key={i} className="tracking-wider text-muted-foreground">{teil}</span> : teil))}</span>
    <span className="sr-only">Betrag verborgen</span>
  </span>;
}

/** Das Auge in der Kopfleiste: ein Schalter für alle Beträge, gemerkt auf diesem Gerät. */
export function HonorarSchalter() {
  const verdeckt = useHonorarVerdeckt();
  const label = verdeckt ? 'Beträge zeigen' : 'Beträge verbergen';
  return <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon" aria-label={label} aria-pressed={verdeckt} onClick={() => setHonorarVerdeckt(!verdeckt)} className={cn(verdeckt && 'bg-muted')}>
        {verdeckt ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </Button>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>;
}
