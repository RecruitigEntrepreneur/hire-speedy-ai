import { addHours, addDays, nextMonday, setHours, setMinutes, startOfTomorrow } from 'date-fns';
import { Clock, Calendar, Sun, ArrowRight } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface SnoozeDropdownProps {
  onSnooze: (until: Date) => void;
  triggerClassName?: string;
}

export function SnoozeDropdown({ onSnooze, triggerClassName }: SnoozeDropdownProps) {
  const presets = [
    {
      label: 'In 2 Stunden',
      icon: Clock,
      getDate: () => addHours(new Date(), 2),
    },
    {
      label: 'Morgen früh (08:00)',
      icon: Sun,
      getDate: () => setMinutes(setHours(startOfTomorrow(), 8), 0),
    },
    {
      label: 'In 3 Tagen',
      icon: Calendar,
      getDate: () => addDays(new Date(), 3),
    },
    {
      label: 'Nächste Woche (Mo)',
      icon: ArrowRight,
      getDate: () => setMinutes(setHours(nextMonday(new Date()), 8), 0),
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={triggerClassName || 'h-6 w-6 text-muted-foreground hover:text-foreground'}
          onClick={(e) => e.stopPropagation()}
        >
          <Clock className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Snooze
        </div>
        <DropdownMenuSeparator />
        {presets.map((preset) => (
          <DropdownMenuItem
            key={preset.label}
            onClick={() => onSnooze(preset.getDate())}
            className="flex items-center gap-2"
          >
            <preset.icon className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{preset.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
