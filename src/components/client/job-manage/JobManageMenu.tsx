import { ChevronDown, Lock, Pause, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('clientJobs');
  if (!canManage) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button variant="outline" size="sm" className="gap-1.5" disabled>
              {t('manage.title')}
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{t('manage.noRights')}</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          {t('manage.title')}
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {isPaused ? (
          <DropdownMenuItem onClick={onResume}>
            <Play className="mr-2 h-4 w-4" />
            {t('manage.resume')}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={onPause}>
            <Pause className="mr-2 h-4 w-4" />
            {t('manage.pause')}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onClose} className="text-destructive focus:text-destructive">
          <Lock className="mr-2 h-4 w-4" />
          {t('manage.close')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
