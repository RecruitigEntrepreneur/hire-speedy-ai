import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight, Hourglass, MessageSquareWarning, X } from 'lucide-react';

export type AgendaFocus = 'counter' | 'feedback' | 'awaiting' | null;

interface Props {
  counts: { counter: number; feedback: number; awaiting: number };
  focus: AgendaFocus;
  onFocusChange: (f: AgendaFocus) => void;
}

/** Dringlichkeits-Chips: zeigen nur, was wirklich Handeln erfordert.
 *  Klick fokussiert die jeweilige Sektion, zweiter Klick hebt den Fokus auf. */
export function ActionChips({ counts, focus, onFocusChange }: Props) {
  const { t } = useTranslation('clientInterviews');
  const chips: { key: Exclude<AgendaFocus, null>; count: number; label: string; icon: typeof Hourglass; cls: string; active: string }[] = [
    {
      key: 'counter',
      count: counts.counter,
      label: t('chips.counter', { count: counts.counter }),
      icon: ArrowLeftRight,
      cls: 'bg-destructive/10 text-destructive hover:bg-destructive/15',
      active: 'ring-2 ring-destructive/40',
    },
    {
      key: 'feedback',
      count: counts.feedback,
      label: t('chips.feedback', { count: counts.feedback }),
      icon: MessageSquareWarning,
      cls: 'bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400',
      active: 'ring-2 ring-amber-500/40',
    },
    {
      key: 'awaiting',
      count: counts.awaiting,
      label: t('chips.awaiting', { count: counts.awaiting }),
      icon: Hourglass,
      cls: 'bg-primary/10 text-primary hover:bg-primary/15',
      active: 'ring-2 ring-primary/40',
    },
  ];

  const visible = chips.filter((c) => c.count > 0);
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {visible.map(({ key, label, icon: Icon, cls, active }) => (
        <button
          key={key}
          onClick={() => onFocusChange(focus === key ? null : key)}
          aria-pressed={focus === key}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all',
            cls,
            focus === key && active,
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
          {focus === key && <X className="h-3 w-3" />}
        </button>
      ))}
    </div>
  );
}
