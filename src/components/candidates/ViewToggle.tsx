import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export type ViewMode = 'cards' | 'list' | 'table';

interface ViewToggleProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  const { t } = useTranslation('candidates');
  // Zwei Ansichten mit Wort, graue Pille wie die Reiter (24.11.2026); „Tabelle“ steckt in „Liste“.
  const views: { value: ViewMode; label: string }[] = [
    { value: 'cards', label: t('view.cards') },
    { value: 'list', label: t('view.list') },
  ];
  const aktiv = view === 'table' ? 'list' : view;
  return (
    <div role="group" className="inline-flex shrink-0 self-start rounded-full bg-secondary p-1">
      {views.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={aktiv === value}
          onClick={() => onViewChange(value)}
          className={cn('rounded-full px-3.5 py-1.5 text-sm transition-colors',
            aktiv === value ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
