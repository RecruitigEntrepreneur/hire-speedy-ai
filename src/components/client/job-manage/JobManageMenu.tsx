import { ChevronDown, Lock, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/** „Stelle verwalten ▾“ im Kopf der Stellenseite: Pausieren, Weitersuchen, Schließen. */
export function JobManageMenu({
  canManage,
  isPaused,
  onPause,
  onResume,
  onClose,
}: {
  canManage: boolean;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onClose: () => void;
}) {
  if (!canManage) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button variant="outline" size="sm" className="gap-1.5" disabled>
              Stelle verwalten
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Pausieren und Schließen dürfen Owner, Admin und HR.</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          Stelle verwalten
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {isPaused ? (
          <DropdownMenuItem onClick={onResume}>
            <Play className="mr-2 h-4 w-4" />
            Jetzt weitersuchen
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={onPause}>
            <Pause className="mr-2 h-4 w-4" />
            Pausieren …
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onClose} className="text-destructive focus:text-destructive">
          <Lock className="mr-2 h-4 w-4" />
          Stelle schließen …
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
