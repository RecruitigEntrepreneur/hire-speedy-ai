import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { LayoutGrid, List, Table2 } from 'lucide-react';

export type ViewMode = 'cards' | 'list' | 'table';

interface ViewToggleProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  const { t } = useTranslation('candidates');
  const views: { value: ViewMode; icon: typeof LayoutGrid; label: string }[] = [
    { value: 'cards', icon: LayoutGrid, label: t('view.cards') },
    { value: 'list', icon: List, label: t('view.list') },
    { value: 'table', icon: Table2, label: t('view.table') },
  ];

  return (
    <div className="flex items-center border rounded-lg overflow-hidden">
      {views.map(({ value, icon: Icon, label }) => (
        <Button
          key={value}
          variant={view === value ? 'default' : 'ghost'}
          size="sm"
          className="rounded-none px-3"
          onClick={() => onViewChange(value)}
          title={label}
        >
          <Icon className="h-4 w-4" />
        </Button>
      ))}
    </div>
  );
}
