import { Lock, Unlock, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CompanyRevealBadgeProps {
  companyRevealed: boolean;
  fullAccess?: boolean;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

/**
 * Badge zur Anzeige des Triple-Blind Enthüllungs-Status
 * 
 * Stufen:
 * 1. 🔒 Firma anonym (grau) - Firmenname nicht sichtbar
 * 2. 🔓 Firma enthüllt (amber) - Name sichtbar nach Kandidaten-Opt-in
 * 3. 👁 Voller Zugriff (grün) - Alle Infos nach Interview-Bestätigung
 */
export function CompanyRevealBadge({
  companyRevealed,
  fullAccess = false,
  showLabel = true,
  size = 'sm',
}: CompanyRevealBadgeProps) {
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  if (fullAccess) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1"
          >
            <Eye className={iconSize} />
            {showLabel && <span>Voller Zugriff</span>}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            Kandidat hat Interview bestätigt. Alle Firmeninfos sind sichtbar.
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (companyRevealed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className="bg-amber-500/10 text-amber-600 border-amber-500/30 gap-1"
          >
            <Unlock className={iconSize} />
            {showLabel && <span>Firma enthüllt</span>}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            Kandidat hat Interesse bekundet. Firmenname ist sichtbar.
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          className="bg-muted text-muted-foreground border-border gap-1"
        >
          <Lock className={iconSize} />
          {showLabel && <span>Firma anonym</span>}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">
          Firmenname wird nach Kandidaten-Opt-in enthüllt.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Kompakte Version nur mit Icon für Listen
 */
export function CompanyRevealIcon({
  companyRevealed,
  fullAccess = false,
}: {
  companyRevealed: boolean;
  fullAccess?: boolean;
}) {
  if (fullAccess) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <Eye className="h-3.5 w-3.5 text-emerald-500" />
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Voller Zugriff</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (companyRevealed) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <Unlock className="h-3.5 w-3.5 text-amber-500" />
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Firma enthüllt</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger>
        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">Firma anonym</p>
      </TooltipContent>
    </Tooltip>
  );
}
